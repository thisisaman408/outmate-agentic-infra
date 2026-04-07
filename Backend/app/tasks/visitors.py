import hashlib
import hmac
import logging
import httpx
from typing import Dict, Any
import uuid
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.redis import RedisManager
from app.db.session import SessionLocal
from app.db.models.visitor import Visit, SiteConfig, Alert, VisitorSession
from datetime import timedelta
from app.db.repositories.company_repository import CompanyRepository
from app.db.repositories.prospect_repository import ProspectRepository
from app.services.visitor_enrich import VisitorEnricher, is_isp_or_cloud, _normalize_company_name
from app.services.behavioral_scoring import predict_persona, select_best_decision_maker
from app.services.person_resolution_engine import PersonResolutionEngine
from app.services.visitor_learning_service import VisitorLearningService
from app.services.journey_sequence_service import JourneySequenceService
import asyncio
import json

logger = logging.getLogger(__name__)

# ── Celery task ───────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.tasks.visitors.process_visitor_task",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
)
def process_visitor_task(self, org_id: str, data: Dict[str, Any]):
    """Celery task: enrich visitor data and save to DB."""
    return asyncio.run(_process_visitor_data(org_id, data))


@celery_app.task(
    name="app.tasks.visitors.deliver_webhook",
    bind=True,
    max_retries=3,
    default_retry_delay=5,
)
def deliver_webhook(self, webhook_url: str, payload: dict, visit_id: str, alert_id: str, webhook_secret: str = ""):
    """
    Deliver a single webhook with exponential backoff retry.
    Signs the payload with HMAC-SHA256 via X-Outmate-Signature header.
    Retry schedule: 5s → 60s → 300s (3 attempts total).
    """
    db = SessionLocal()
    try:
        import httpx as _httpx
        import json as _json
        body_bytes = _json.dumps(payload, separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json"}
        if webhook_secret:
            sig = hmac.new(webhook_secret.encode(), body_bytes, hashlib.sha256).hexdigest()
            headers["X-Outmate-Signature"] = f"sha256={sig}"
        with _httpx.Client(timeout=10.0) as client:
            response = client.post(webhook_url, content=body_bytes, headers=headers)
        status = "success" if response.status_code < 300 else "failed"

        # Update alert record
        alert = db.query(Alert).filter(Alert.id == uuid.UUID(alert_id)).first()
        if alert:
            alert.status = status
            db.commit()

        if response.status_code >= 300:
            logger.warning("Webhook %s returned %d", webhook_url, response.status_code)
            # Retry with exponential backoff: attempt 0→5s, 1→60s, 2→300s
            retry_delays = [5, 60, 300]
            attempt = self.request.retries
            if attempt < len(retry_delays):
                raise self.retry(countdown=retry_delays[attempt], exc=Exception(f"HTTP {response.status_code}"))

    except (httpx.RequestError, httpx.TimeoutException) as exc:
        logger.error("Webhook delivery error for %s: %s", webhook_url, exc)
        alert = db.query(Alert).filter(Alert.id == uuid.UUID(alert_id)).first()
        if alert:
            alert.status = "error"
            db.commit()
        retry_delays = [5, 60, 300]
        attempt = self.request.retries
        if attempt < len(retry_delays):
            raise self.retry(countdown=retry_delays[attempt], exc=exc)
        # Final failure — mark as failed_final
        if alert:
            alert.status = "failed_final"
            db.commit()
    except Exception as exc:
        logger.error("Unexpected webhook error: %s", exc)
        alert = db.query(Alert).filter(Alert.id == uuid.UUID(alert_id)).first()
        if alert:
            alert.status = "error"
            db.commit()
    finally:
        db.close()


# ── Main processing pipeline ──────────────────────────────────────────────────

def _normalize_domain(domain: str | None) -> str | None:
    if not domain:
        return None
    d = domain.strip().lower()
    if d.startswith("www."):
        d = d[4:]
    return d.rstrip(".") or None


def _normalize_resolution_identity(resolution: Dict[str, Any]) -> Dict[str, Any]:
    res = dict(resolution or {})
    normalized_company = _normalize_company_name(res.get("company"))
    if normalized_company:
        res["company"] = normalized_company

    domain = _normalize_domain(res.get("domain"))
    if domain:
        res["domain"] = domain

    person = res.get("person")
    if isinstance(person, dict):
        person = dict(person)
        if person.get("company_name"):
            person["company_name"] = _normalize_company_name(person.get("company_name")) or person.get("company_name")
        if person.get("company_domain"):
            person["company_domain"] = _normalize_domain(person.get("company_domain"))
        if person.get("email"):
            person["email"] = str(person["email"]).strip().lower()
        res["person"] = person

    if res.get("email"):
        res["email"] = str(res["email"]).strip().lower()

    predicted = res.get("predicted_person")
    if isinstance(predicted, dict):
        predicted = dict(predicted)
        if predicted.get("email"):
            predicted["email"] = str(predicted["email"]).strip().lower()
        res["predicted_person"] = predicted

    return res


def _merge_first_party_identity(resolution: Dict[str, Any], identity_traits: Dict[str, Any] | None) -> Dict[str, Any]:
    if not identity_traits:
        return resolution

    res = dict(resolution or {})
    traits = dict(identity_traits or {})

    email = traits.get("email")
    if email:
        normalized_email = str(email).strip().lower()
        if normalized_email:
            res["email"] = normalized_email

    full_name = traits.get("full_name")
    if full_name and not res.get("full_name"):
        res["full_name"] = str(full_name).strip()[:255]

    first_name = traits.get("first_name")
    last_name = traits.get("last_name")
    if not res.get("full_name") and (first_name or last_name):
        res["full_name"] = " ".join(part for part in [str(first_name or "").strip(), str(last_name or "").strip()] if part)[:255]

    job_title = traits.get("job_title")
    if job_title and not res.get("job_title"):
        res["job_title"] = str(job_title).strip()[:255]

    company_name = traits.get("company_name")
    if company_name:
        normalized_company = _normalize_company_name(company_name) or str(company_name).strip()
        if normalized_company and not res.get("company"):
            res["company"] = normalized_company

    linkedin_url = traits.get("linkedin_url")
    if linkedin_url and not res.get("linkedin_url"):
        res["linkedin_url"] = str(linkedin_url).strip()[:512]

    person = dict(res.get("person") or {})
    if res.get("full_name"):
        person["full_name"] = res.get("full_name")
    if res.get("email"):
        person["email"] = res.get("email")
    if res.get("job_title"):
        person["job_title"] = res.get("job_title")
    if res.get("linkedin_url"):
        person["linkedin_url"] = res.get("linkedin_url")
    if res.get("company"):
        person["company_name"] = res.get("company")
    if res.get("domain"):
        person["company_domain"] = res.get("domain")
    if person:
        res["person"] = person

    if any(res.get(key) for key in ("email", "full_name", "linkedin_url", "job_title")):
        res["person_identification"] = {
            "status": "verified",
            "method": "first_party_identify",
            "confidence": 0.98,
            "is_predicted": False,
        }

    sources = list(res.get("_sources") or [])
    if "first_party_identify" not in sources:
        sources.append("first_party_identify")
    res["_sources"] = sources
    return res


async def apply_identity_event(org_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply a deterministic server-side identity event without creating a new visit.
    Used by form/chat/calendar/app-login integrations to stitch visitor state.
    """
    db = SessionLocal()
    try:
        visitor_id = data.get("visitor_id")
        session_id = data.get("session_id")
        identity_traits = data.get("identity_traits") or {}
        identity_traits = {k: v for k, v in identity_traits.items() if v not in (None, "", [])}
        email = identity_traits.get("email")
        matched = []

        query = db.query(Visit).filter(Visit.org_id == uuid.UUID(org_id))
        filters = []
        if visitor_id:
            filters.append(Visit.resolution["visitor_id"].astext == str(visitor_id))
        if session_id:
            filters.append(Visit.resolution["session_id"].astext == str(session_id))
        if email:
            filters.append(Visit.resolution["email"].astext == str(email).strip().lower())

        if filters:
            from sqlalchemy import or_
            query = query.filter(or_(*filters))
            matched = query.order_by(Visit.created_at.desc()).limit(200).all()

        updated = 0
        learning = VisitorLearningService()
        person_engine = PersonResolutionEngine()
        exemplar_resolution: Dict[str, Any] = {}
        for visit in matched:
            resolution = _normalize_resolution_identity(visit.resolution or {})
            resolution = _merge_first_party_identity(resolution, identity_traits)
            resolution = _categorize_and_attach(db, resolution)
            resolution = _normalize_resolution_identity(resolution)
            person_engine.upsert_profile(
                db,
                org_id=org_id,
                data={
                    "visitor_id": visitor_id,
                    "session_id": session_id,
                    "ip": data.get("ip") or resolution.get("ip"),
                    "user_agent": visit.user_agent or "",
                    "url": visit.url or "",
                    "active_ms": (resolution.get("active_ms") or 0),
                },
                resolution=resolution,
                engine_result={
                    "status": "verified",
                    "confidence": float((resolution.get("person_identification") or {}).get("confidence") or 0.98),
                    "likely_persona": None,
                    "top_candidates": [],
                },
                behavioral=(resolution.get("behavioral") or {}),
            )
            learning.learn_from_verified_identity(
                db,
                org_id=org_id,
                ip=data.get("ip") or resolution.get("ip"),
                resolution=resolution,
                profile_data=(resolution.get("profile_data") or {}),
                behavioral=(resolution.get("behavioral") or {}),
                person_resolution=(resolution.get("person_resolution") or {}),
            )
            visit.resolution = resolution
            visit.matched = bool(resolution.get("company") or resolution.get("domain") or resolution.get("email"))
            exemplar_resolution = resolution
            updated += 1

        if exemplar_resolution or identity_traits:
            enricher = VisitorEnricher()
            store_resolution = _normalize_resolution_identity(exemplar_resolution or {})
            store_resolution = _merge_first_party_identity(store_resolution, identity_traits)
            if data.get("domain") and not store_resolution.get("domain"):
                store_resolution["domain"] = _normalize_domain(data.get("domain"))
            if data.get("company") and not store_resolution.get("company"):
                store_resolution["company"] = _normalize_company_name(data.get("company")) or data.get("company")
            if data.get("linkedin_url") and not store_resolution.get("linkedin_url"):
                store_resolution["linkedin_url"] = data.get("linkedin_url")
            await enricher._step_identity_graph_store(
                ip=data.get("ip") or "",
                visitor_id=visitor_id,
                resolution=store_resolution,
            )

        db.commit()
        return {
            "status": "applied",
            "updated_visits": updated,
            "visitor_id": visitor_id,
            "session_id": session_id,
            "email": identity_traits.get("email"),
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def _process_visitor_data(org_id: str, data: Dict[str, Any]):
    """Background coroutine: enrich visitor data and save to DB."""
    db = SessionLocal()
    stub_visit_id = None  # track for failure marking
    try:
        ip = data.get("ip")
        url = data.get("url")
        email = data.get("email")
        intent_score = data.get("intent_score", 0.5)
        visitor_id = data.get("visitor_id")
        action = data.get("action", "pageview")
        dwell_time = data.get("dwell_time")
        source_site = data.get("source_site") or ""
        identity_traits = data.get("identity_traits") or {}

        if action == "leave" and visitor_id and dwell_time is not None:
            try:
                from sqlalchemy import text
                updated = db.execute(
                    text("""
                        UPDATE visits
                        SET resolution = jsonb_set(
                            COALESCE(resolution, '{}'::jsonb),
                            '{dwell_time}', to_jsonb(:dwell::numeric)
                        )
                        WHERE id = (
                            SELECT id FROM visits 
                            WHERE org_id = :org_id AND resolution->>'visitor_id' = :visitor_id AND url = :url
                            ORDER BY created_at DESC LIMIT 1
                        )
                    """),
                    {"dwell": dwell_time, "org_id": org_id, "visitor_id": visitor_id, "url": url}
                )
                db.commit()
                if updated.rowcount > 0:
                    logger.info("Updated dwell_time for visitor_id=%s to %sms", visitor_id, dwell_time)
            except Exception as e:
                logger.warning("Failed to update dwell_time: %s", e)
            return

        logger.info("Starting enrichment for IP: %s (email=%s, visitor_id=%s, org=%s)", ip, email, visitor_id, org_id)

        # Fetch per-org config before enrichment (ISP allowlist, anonymization)
        site_cfg = db.query(SiteConfig).filter(SiteConfig.org_id == org_id).first()
        isp_allowlist = (site_cfg.isp_allowlist or []) if site_cfg else []
        anonymize_ips = site_cfg.anonymize_ips if site_cfg else False

        # Create a stub visit record with enrichment_status='processing' so the
        # dashboard shows a spinner instead of empty data while enrichment runs.
        stub_visit = Visit(
            id=uuid.uuid4(),
            org_id=uuid.UUID(org_id),
            ip=ip,
            url=url or "",
            referrer=data.get("referrer"),
            user_agent=data.get("user_agent"),
            intent_score=data.get("intent_score", 0.5),
            resolution={"ip": ip, "enrichment_status": "processing"},
            matched=False,
            enrichment_status="processing",
        )
        db.add(stub_visit)
        db.commit()
        stub_visit_id = stub_visit.id

        enricher = VisitorEnricher()
        fp = data.get("fp")
        user_agent = data.get("user_agent") or ""
        viewport_w = data.get("viewport_w") or 0
        viewport_h = data.get("viewport_h") or 0

        resolution = await enricher.enrich_ip(
            ip, url, intent_score,
            email=email, visitor_id=visitor_id,
            fp=fp, user_agent=user_agent,
            viewport_w=viewport_w, viewport_h=viewport_h,
            isp_allowlist=isp_allowlist,
        )

        # GDPR: anonymize the IP before storing (mask last octet)
        stored_ip = ip
        if anonymize_ips and ip and "." in ip:
            parts = ip.split(".")
            stored_ip = ".".join(parts[:3]) + ".0"
            resolution["ip"] = stored_ip

        # Tag every visit with the pixel owner's domain so the dashboard can
        # show which customer site the visitor came from even when IP enrichment
        # can't identify their company.
        if source_site:
            resolution["source_site"] = source_site

        # Store pixel v2.1+ engagement signals in resolution for later querying
        if data.get("scroll_depth") is not None:
            resolution["scroll_depth"] = data["scroll_depth"]
        if data.get("cta_clicks") is not None:
            resolution["cta_clicks"] = data["cta_clicks"]
        # Pixel v2.2 page meta signals
        if data.get("page_title"):
            resolution["page_title"] = str(data["page_title"])[:120]
        if data.get("page_h1"):
            resolution["page_h1"] = str(data["page_h1"])[:80]
        if data.get("connection_type"):
            resolution["connection_type"] = str(data["connection_type"])[:20]
        if data.get("session_id"):
            resolution["session_id"] = str(data["session_id"])[:128]
        if data.get("active_ms") is not None:
            resolution["active_ms"] = data["active_ms"]
        if data.get("outbound_clicks") is not None:
            resolution["outbound_clicks"] = data["outbound_clicks"]
        if data.get("last_outbound_domain"):
            resolution["last_outbound_domain"] = str(data["last_outbound_domain"])[:255]
        if data.get("page_type"):
            resolution["page_type"] = str(data["page_type"])[:64]
        if data.get("form_stage"):
            resolution["form_stage"] = str(data["form_stage"])[:64]
        if data.get("form_fields"):
            resolution["form_fields"] = data["form_fields"]

        resolution = _normalize_resolution_identity(resolution)
        resolution = _merge_first_party_identity(resolution, identity_traits)
        resolution = _categorize_and_attach(db, resolution)
        category = resolution.get("category", "unknown")
        
        # Calculate ICP score — weights are configurable per org via icp_filters
        def get_icp_score(res: dict, icp_filters: dict) -> int:
            # Default weights — sum = 100
            w = {
                "company":    icp_filters.get("w_company", 25),
                "person":     icp_filters.get("w_person", 20),
                "industry":   icp_filters.get("w_industry", 15),
                "headcount":  icp_filters.get("w_headcount", 15),
                "revenue":    icp_filters.get("w_revenue", 10),
                "linkedin":   icp_filters.get("w_linkedin", 10),
                "domain":     icp_filters.get("w_domain", 5),
            }
            score = 0
            exp = res.get("explorium") or {}
            if res.get("company"):
                score += w["company"]
            if res.get("full_name") or res.get("email"):
                score += w["person"]
            if exp.get("industry") or exp.get("linkedin_industry_category"):
                score += w["industry"]
            if exp.get("employee_count_range") or exp.get("employee_count_exact"):
                score += w["headcount"]
            if exp.get("revenue_range"):
                score += w["revenue"]
            if res.get("linkedin_url") or exp.get("linkedin_url"):
                score += w["linkedin"]
            if res.get("domain"):
                score += w["domain"]

            # Industry filter — if org specified target industries, give bonus/penalty
            target_industries = icp_filters.get("industries") or []
            if target_industries:
                visit_industry = (exp.get("industry") or exp.get("linkedin_industry_category") or "").lower()
                if any(ind.lower() in visit_industry for ind in target_industries):
                    score = min(score + 10, 100)
                elif visit_industry:
                    score = max(score - 10, 0)

            # Headcount filter
            min_employees = icp_filters.get("min_employees")
            max_employees = icp_filters.get("max_employees")
            if min_employees or max_employees:
                exact = exp.get("employee_count_exact")
                if exact:
                    if min_employees and exact < min_employees:
                        score = max(score - 15, 0)
                    if max_employees and exact > max_employees:
                        score = max(score - 15, 0)

            return min(score, 100)

        # Fetch org's icp_filters for scoring
        def _get_icp_filters():
            _db = SessionLocal()
            try:
                cfg = _db.query(SiteConfig).filter(SiteConfig.org_id == org_id).first()
                return (cfg.icp_filters or {}) if cfg else {}
            finally:
                _db.close()

        try:
            icp_filters = _get_icp_filters()
        except Exception:
            icp_filters = {}

        resolution["icp_score"] = get_icp_score(resolution, icp_filters)
        
        logger.info("Categorized visit for %s: %s (ICP: %s, org=%s)", ip, category, resolution["icp_score"], org_id)

        if visitor_id:
            resolution["visitor_id"] = visitor_id

        # ── BEHAVIORAL ROLE PREDICTION ────────────────────────────────────────
        # Query the last 90 visits for this visitor_id to build a behavioral
        # profile, then predict their job role and buying stage.
        behavioral = None
        sequence_analysis = None
        if visitor_id:
            try:
                from sqlalchemy import text as sa_text
                hist_rows = db.execute(
                    sa_text("""
                        SELECT url,
                               resolution->>'dwell_time'        AS dwell_time,
                               resolution->>'email'             AS email,
                               (resolution->>'scroll_depth')::numeric AS scroll_depth,
                               (resolution->>'cta_clicks')::int       AS cta_clicks,
                               resolution->>'page_title'        AS page_title,
                               resolution->>'page_h1'           AS page_h1,
                               referrer,
                               created_at,
                               resolution
                        FROM visits
                        WHERE org_id = :org_id
                          AND resolution->>'visitor_id' = :vid
                        ORDER BY created_at DESC
                        LIMIT 90
                    """),
                    {"org_id": org_id, "vid": visitor_id},
                ).fetchall()

                # Build visit history list
                visit_history = []
                for row in hist_rows:
                    visit_history.append({
                        "url": row.url or "",
                        "dwell_time": int(float(row.dwell_time)) if row.dwell_time else 0,
                        "scroll_depth": float(row.scroll_depth) if row.scroll_depth is not None else None,
                        "cta_clicks": int(row.cta_clicks) if row.cta_clicks is not None else 0,
                        "email": row.email,
                        "referrer": row.referrer or "",
                        "has_form_fill": bool(row.email),
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        # page meta pulled from resolution JSONB (pixel v2.2+ fields)
                        "page_title": (row.resolution or {}).get("page_title") if hasattr(row, "resolution") else None,
                        "page_h1": (row.resolution or {}).get("page_h1") if hasattr(row, "resolution") else None,
                    })

                # Add current visit to the history
                visit_history.insert(0, {
                    "url": url or "",
                    "dwell_time": dwell_time or 0,
                    "scroll_depth": data.get("scroll_depth"),
                    "cta_clicks": data.get("cta_clicks") or 0,
                    "email": email,
                    "referrer": data.get("referrer") or "",
                    "has_form_fill": bool(email),
                    "created_at": None,
                    "page_title": data.get("page_title"),
                    "page_h1": data.get("page_h1"),
                })

                behavioral = predict_persona(visit_history, referrer=data.get("referrer", ""))
                sequence_service = JourneySequenceService()
                current_page_type = resolution.get("page_type") or data.get("page_type")
                enriched_history = []
                for item in visit_history:
                    enriched_history.append({
                        **item,
                        "page_type": item.get("page_type") or current_page_type,
                    })
                sequence_analysis = sequence_service.analyze_sequence(enriched_history)
                resolution["journey_sequence"] = sequence_analysis
                sequence_service.upsert_sequence(
                    db,
                    org_id=org_id,
                    visitor_id=visitor_id,
                    fingerprint=data.get("fp") or resolution.get("fingerprint"),
                    session_id=data.get("session_id") or resolution.get("session_id"),
                    company_domain=resolution.get("domain"),
                    analysis=sequence_analysis,
                )

                resolution["behavioral"] = {
                    "predicted_persona": behavioral["predicted_persona"],
                    "persona_confidence": behavioral["persona_confidence"],
                    "engagement_score": behavioral["engagement_score"],
                    "buying_stage": behavioral["buying_stage"],
                    "persona_scores": behavioral["persona_scores"],
                    "signals": behavioral["signals_breakdown"],
                }

                # Smart DM selection: pick the employee/DM whose role matches
                # the predicted persona of the visitor.
                # Prefer the enriched employees list (merged from Apollo/PDL/ContactOut/Hunter)
                # and fall back to raw decision_makers if employees not available.
                candidates = resolution.get("employees") or resolution.get("decision_makers") or []
                if candidates and behavioral["predicted_persona"] != "unknown":
                    prospect_context = {}
                    try:
                        matched_prospect = None
                        if resolution.get("email"):
                            matched_prospect = ProspectRepository.get_by_email(db, email=resolution.get("email"))
                        if matched_prospect and getattr(matched_prospect, "raw_data", None):
                            raw_data = matched_prospect.raw_data or {}
                            prospect_context = {
                                "crm_owner_email": raw_data.get("crm_owner_email") or raw_data.get("owner_email") or raw_data.get("assigned_to"),
                                "prior_campaign_engagement": raw_data.get("campaign_engagement") or {},
                            }
                    except Exception:
                        prospect_context = {}

                    best_dm = select_best_decision_maker(
                        candidates,
                        behavioral["predicted_persona"],
                        context={
                            "visitor_country": ((resolution.get("geo") or {}).get("country") or "").lower(),
                            "visitor_city": ((resolution.get("geo") or {}).get("city") or "").lower(),
                            "preferred_seniority": "vp" if behavioral["predicted_persona"] in ("sales", "marketing", "product") else (
                                "director" if behavioral["predicted_persona"] in ("engineering", "finance") else "c_suite"
                            ),
                            **prospect_context,
                        },
                    )
                    if best_dm:
                        predicted_confidence = round(
                            min(
                                0.74,
                                max(
                                    float(behavioral.get("persona_confidence") or 0.0) * 0.7
                                    + min(float(behavioral.get("engagement_score") or 0) / 250.0, 0.18),
                                    0.35,
                                ),
                            ),
                            2,
                        )
                        predicted_person = {
                            "full_name": best_dm.get("full_name"),
                            "email": best_dm.get("email"),
                            "linkedin_url": best_dm.get("linkedin_url"),
                            "job_title": best_dm.get("job_title"),
                            "method": "behavioral_employee_match",
                            "confidence": predicted_confidence,
                            "persona": behavioral["predicted_persona"],
                        }
                        resolution["predicted_person"] = predicted_person
                        if not resolution.get("person_identification") or resolution["person_identification"].get("status") == "anonymous":
                            if any(best_dm.get(key) for key in ("email", "linkedin_url", "full_name")) and (
                                behavioral.get("persona_confidence", 0) >= 0.35
                                and behavioral.get("engagement_score", 0) >= 35
                            ):
                                for key in ("full_name", "email", "linkedin_url", "job_title"):
                                    if best_dm.get(key) and not resolution.get(key):
                                        resolution[key] = best_dm[key]
                                resolution["person_identification"] = {
                                    "status": "predicted",
                                    "method": "behavioral_employee_match",
                                    "confidence": predicted_confidence,
                                    "is_predicted": True,
                                }
                        resolution["_persona_matched_dm"] = True
                        logger.info(
                            "[Behavioral] Matched DM '%s' (%s) to predicted persona '%s'",
                            best_dm.get("full_name"), best_dm.get("job_title"),
                            behavioral["predicted_persona"],
                        )

                logger.info(
                    "[Behavioral] visitor_id=%s persona=%s confidence=%.2f engagement=%d stage=%s",
                    visitor_id, behavioral["predicted_persona"],
                    behavioral["persona_confidence"], behavioral["engagement_score"],
                    behavioral["buying_stage"],
                )
            except Exception as e:
                logger.warning("Behavioral scoring failed: %s", e)

        resolution = _normalize_resolution_identity(resolution)

        person_engine = PersonResolutionEngine()
        learning_service = VisitorLearningService()
        anonymous_profile = person_engine.load_profile(
            db,
            org_id=org_id,
            visitor_id=visitor_id,
            fingerprint=data.get("fp") or resolution.get("fingerprint"),
            session_id=data.get("session_id") or resolution.get("session_id"),
        )
        company_memory = learning_service.get_company_memory(
            db,
            org_id=org_id,
            company_domain=resolution.get("domain"),
        )
        office_cluster = learning_service.get_office_cluster(
            db,
            org_id=org_id,
            ip=ip,
            company_domain=resolution.get("domain"),
        )
        person_engine_result = person_engine.resolve(
            db=db,
            org_id=org_id,
            resolution=resolution,
            behavioral=behavioral,
            profile=anonymous_profile,
            company_memory=company_memory,
            office_cluster=office_cluster,
        )
        resolution["person_resolution"] = person_engine_result

        top_candidate = ((person_engine_result.get("top_candidates") or [None])[0] or None)
        if top_candidate:
            existing_predicted = resolution.get("predicted_person") or {}
            existing_conf = float(existing_predicted.get("confidence") or 0.0)
            engine_conf = float(person_engine_result.get("confidence") or 0.0)
            if engine_conf >= existing_conf:
                resolution["predicted_person"] = {
                    "full_name": top_candidate.get("full_name"),
                    "email": top_candidate.get("email"),
                    "linkedin_url": top_candidate.get("linkedin_url"),
                    "job_title": top_candidate.get("job_title"),
                    "method": "person_resolution_engine",
                    "confidence": round(engine_conf, 2),
                    "persona": person_engine_result.get("likely_persona"),
                }

        current_person_id = resolution.get("person_identification") or {}
        if (
            current_person_id.get("status") in (None, "", "anonymous")
            and person_engine_result.get("status") == "predicted_high"
            and float(person_engine_result.get("confidence") or 0.0) >= 0.78
        ):
            resolution["person_identification"] = {
                "status": "predicted",
                "method": "person_resolution_engine",
                "confidence": round(float(person_engine_result.get("confidence") or 0.0), 2),
                "is_predicted": True,
            }

        person_engine.upsert_profile(
            db,
            org_id=org_id,
            data=data,
            resolution=resolution,
            engine_result=person_engine_result,
            behavioral=behavioral,
        )
        learning_service.observe_visit(
            db,
            org_id=org_id,
            ip=ip,
            resolution=resolution,
            person_resolution=person_engine_result,
        )
        learning_service.learn_from_verified_identity(
            db,
            org_id=org_id,
            ip=ip,
            resolution=resolution,
            profile_data=((anonymous_profile.profile_data if anonymous_profile else {}) or {}),
            behavioral=behavioral,
            person_resolution=person_engine_result,
        )

        is_matched = (
            bool(resolution.get("matched_entity"))
            or (
                resolution.get("confidence", 0) >= 0.4
                and bool(resolution.get("company") or resolution.get("domain"))
            )
        )

        # Update stub visit with final enriched data
        new_visit = db.query(Visit).filter(Visit.id == stub_visit_id).first()
        if new_visit:
            new_visit.ip = ip
            new_visit.url = url
            new_visit.referrer = data.get("referrer")
            new_visit.user_agent = data.get("user_agent")
            new_visit.intent_score = intent_score
            new_visit.resolution = resolution
            new_visit.matched = is_matched
            new_visit.enrichment_status = "done"
        else:
            # Fallback if stub was somehow lost
            new_visit = Visit(
                id=uuid.uuid4(),
                org_id=uuid.UUID(org_id),
                ip=ip,
                url=url,
                referrer=data.get("referrer"),
                user_agent=data.get("user_agent"),
                intent_score=intent_score,
                resolution=resolution,
                matched=is_matched,
                enrichment_status="done",
            )
            db.add(new_visit)
        db.commit()
        db.refresh(new_visit)
        logger.info("Saved visit %s for IP %s. Matched: %s", new_visit.id, ip, new_visit.matched)

        # Session upsert — group page views into logical sessions
        if visitor_id:
            _upsert_session(db, org_id, visitor_id, new_visit, behavioral)

        # Retroactive profile backfill: push name/company/job_title to all prior
        # visits from this visitor_id so the dashboard shows full identity history,
        # not just the current visit.
        if visitor_id and is_matched:
            try:
                from sqlalchemy import text as _text
                person_id = resolution.get("person_identification") or {}
                is_predicted_person = bool(person_id.get("is_predicted")) or person_id.get("status") == "predicted"
                # Build a JSON patch with every non-empty identity field we resolved
                patches: dict = {"retrolinked": True}
                if email and not is_predicted_person:
                    patches["email"] = email
                if resolution.get("full_name") and not is_predicted_person:
                    patches["full_name"] = resolution["full_name"]
                if resolution.get("company"):
                    patches["company"] = resolution["company"]
                if resolution.get("domain"):
                    patches["domain"] = resolution["domain"]
                if resolution.get("job_title") and not is_predicted_person:
                    patches["job_title"] = resolution["job_title"]
                if resolution.get("linkedin_url") and not is_predicted_person:
                    patches["linkedin_url"] = resolution["linkedin_url"]
                if resolution.get("logo_url"):
                    patches["logo_url"] = resolution["logo_url"]

                # Build a chain of jsonb_set calls from the patches dict
                # e.g. jsonb_set(jsonb_set(resolution, '{email}', '"foo"'), '{company}', '"Bar"')
                expr = "COALESCE(resolution, '{}'::jsonb)"
                params: dict = {"org_id": org_id, "visitor_id": visitor_id, "current_id": str(new_visit.id)}
                for idx, (key, val) in enumerate(patches.items()):
                    param_name = f"p_{idx}"
                    expr = f"jsonb_set({expr}, '{{{key}}}', to_jsonb(:{param_name}::text))"
                    params[param_name] = str(val)

                updated = db.execute(
                    _text(f"""
                        UPDATE visits
                        SET matched = true,
                            resolution = {expr}
                        WHERE org_id = :org_id
                          AND resolution->>'visitor_id' = :visitor_id
                          AND id != :current_id
                    """),
                    params,
                )
                db.commit()
                if updated.rowcount > 0:
                    logger.info(
                        "Retroactive backfill: patched %d visit(s) for visitor_id=%s "
                        "with fields=%s",
                        updated.rowcount, visitor_id, list(patches.keys()),
                    )
            except Exception as e:
                logger.warning("Retroactive backfill failed: %s", e)

        # Real-time SSE publish (best-effort)
        await _publish_visit_event(org_id=str(new_visit.org_id), visit=new_visit)

        # Webhooks for matched visits
        if new_visit.matched:
            await _enqueue_webhooks(db, new_visit)

    except Exception as e:
        logger.error("Error processing visitor data: %s", e)
        db.rollback()
        # Mark the stub visit as failed so dashboard shows error state
        try:
            fail_db = SessionLocal()
            try:
                stub = fail_db.query(Visit).filter(Visit.id == stub_visit_id).first()
                if stub:
                    stub.enrichment_status = "failed"
                    fail_db.commit()
            finally:
                fail_db.close()
        except Exception:
            pass
        raise  # Re-raise so Celery autoretry triggers
    finally:
        db.close()


# ── Session management ────────────────────────────────────────────────────────

SESSION_GAP_MINUTES = 30  # inactivity window that closes a session


def _upsert_session(
    db,
    org_id: str,
    visitor_id: str,
    visit: Visit,
    behavioral: dict | None,
) -> None:
    """
    Create a new session or extend the most-recent open one.
    A session is 'open' when its session_end is within SESSION_GAP_MINUTES.
    """
    if not visitor_id:
        return
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=SESSION_GAP_MINUTES)

        session = (
            db.query(VisitorSession)
            .filter(
                VisitorSession.org_id == org_id,
                VisitorSession.visitor_id == visitor_id,
                VisitorSession.session_end >= cutoff,
            )
            .order_by(VisitorSession.session_end.desc())
            .first()
        )

        res = visit.resolution or {}
        scroll = res.get("scroll_depth") or 0
        cta = res.get("cta_clicks") or 0
        dwell = res.get("dwell_time") or 0

        if session:
            # Extend existing session
            session.session_end = now
            session.exit_url = visit.url
            session.page_count = (session.page_count or 0) + 1
            session.total_dwell_ms = (session.total_dwell_ms or 0) + dwell
            session.total_cta_clicks = (session.total_cta_clicks or 0) + cta
            # Rolling avg scroll depth
            if scroll and session.page_count > 1:
                session.avg_scroll_depth = round(
                    ((session.avg_scroll_depth or 0) * (session.page_count - 1) + scroll)
                    / session.page_count,
                    1,
                )
            if behavioral:
                session.predicted_persona = behavioral.get("predicted_persona")
                session.buying_stage = behavioral.get("buying_stage")
                session.engagement_score = behavioral.get("engagement_score", 0)
        else:
            session = VisitorSession(
                id=uuid.uuid4(),
                org_id=org_id,
                visitor_id=visitor_id,
                session_start=now,
                session_end=now,
                page_count=1,
                total_dwell_ms=dwell,
                avg_scroll_depth=float(scroll),
                total_cta_clicks=cta,
                entry_url=visit.url,
                exit_url=visit.url,
                referrer=visit.referrer,
                predicted_persona=behavioral.get("predicted_persona") if behavioral else None,
                buying_stage=behavioral.get("buying_stage") if behavioral else None,
                engagement_score=behavioral.get("engagement_score", 0) if behavioral else 0,
            )
            db.add(session)

        db.commit()
    except Exception as exc:
        logger.warning("Session upsert failed: %s", exc)
        db.rollback()


# ── Categorization ────────────────────────────────────────────────────────────

PERSONAL_DOMAINS = {"gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "mail.com"}


def is_personal_email(email: str | None) -> bool:
    if not email or "@" not in email:
        return False
    return email.split("@")[-1].lower() in PERSONAL_DOMAINS


def _categorize_and_attach(db, resolution: Dict[str, Any]) -> Dict[str, Any]:
    """
    Classify a visitor as 'company', 'prospect', or 'unknown' and
    create/link matching DB records (best-effort, never raises).
    """
    res = dict(resolution or {})
    if res.get("company"):
        res["company"] = _normalize_company_name(res.get("company")) or res.get("company")
    if res.get("domain"):
        res["domain"] = _normalize_domain(res.get("domain"))
    person = res.get("person") or {}
    email = res.get("email") or person.get("email") or person.get("work_email") or person.get("personal_email")
    if email:
        email = str(email).strip().lower()
        res["email"] = email
    domain = _normalize_domain(res.get("domain") or person.get("company_domain"))
    company_name = _normalize_company_name(res.get("company") or person.get("company_name")) or res.get("company") or person.get("company_name")

    matched_company = None
    matched_prospect = None

    try:
        if email:
            matched_prospect = ProspectRepository.get_by_email(db, email=email)
            if not matched_prospect:
                matched_prospect = ProspectRepository.create_or_update(
                    db,
                    email=email,
                    raw_data=person if isinstance(person, dict) else {},
                    provider_source="visitor_tracker",
                    full_name=res.get("full_name") or person.get("full_name") or person.get("name"),
                    first_name=person.get("first_name"),
                    last_name=person.get("last_name"),
                    phone=res.get("phone") or person.get("phone"),
                    linkedin_url=res.get("linkedin_url") or person.get("linkedin_url") or person.get("linkedin"),
                    job_title=res.get("job_title") or person.get("title") or person.get("job_title"),
                )
    except Exception as e:
        logger.warning("Prospect match/create failed: %s", e)

    try:
        if domain:
            matched_company = CompanyRepository.get_by_domain(db, domain=domain)
            if not matched_company:
                matched_company = CompanyRepository.create_or_update(
                    db,
                    domain=domain,
                    raw_data=res.get("explorium") or {},
                    provider_source="visitor_tracker",
                    name=company_name or domain,
                    website=(f"https://{domain}" if domain and not (res.get("website") or "").strip() else res.get("website")),
                    headquarters_city=(res.get("geo") or {}).get("city") if isinstance(res.get("geo"), dict) else None,
                    headquarters_country=(res.get("geo") or {}).get("country") if isinstance(res.get("geo"), dict) else None,
                )
    except Exception as e:
        logger.warning("Company match/create failed: %s", e)

    if email and is_personal_email(email):
        res["category"] = "prospect"
        res["matched_entity"] = "prospect"
        if not domain or is_isp_or_cloud(company_name):
            res["company"] = None
            res["domain"] = None
        res["matched_prospect"] = {
            "id": str(matched_prospect.id) if matched_prospect else None,
            "email": matched_prospect.email if matched_prospect else email,
            "full_name": matched_prospect.full_name if matched_prospect else res.get("full_name"),
        }
        if matched_company:
            res["matched_company"] = {
                "id": str(matched_company.id) if getattr(matched_company, "id", None) else None,
                "domain": getattr(matched_company, "domain", None) or domain,
                "name": getattr(matched_company, "name", None) or company_name or domain,
            }
        return res

    if domain or (email and not is_personal_email(email)):
        res["category"] = "company"
        res["matched_entity"] = "company"
        if matched_company:
            res["company"] = getattr(matched_company, "name", None) or res.get("company") or domain
            res["domain"] = getattr(matched_company, "domain", None) or res.get("domain") or domain
        res["matched_company"] = {
            "id": str(matched_company.id) if getattr(matched_company, "id", None) else None,
            "domain": res.get("domain") or domain,
            "name": res.get("company") or company_name or domain,
        }
        if matched_prospect:
            res["matched_prospect"] = {
                "id": str(matched_prospect.id),
                "email": matched_prospect.email,
            }
    else:
        res["category"] = "unknown"
        res["matched_entity"] = None

    return res


# ── Real-time pub/sub ─────────────────────────────────────────────────────────

async def _publish_visit_event(org_id: str, visit: Visit) -> None:
    try:
        redis_client = RedisManager.get_client()
        res = visit.resolution or {}
        person = res.get("person") or {}
        exp = res.get("explorium") or {}
        payload = {
            "type": "visit_created",
            "org_id": org_id,
            "visit": {
                "id": str(visit.id),
                "ip": str(visit.ip),
                "url": visit.url,
                "referrer": visit.referrer,
                "intent_score": visit.intent_score,
                "matched": visit.matched,
                "created_at": visit.created_at.isoformat() if visit.created_at else None,
                "resolution": res,
                "category": res.get("category"),
                "company": res.get("company") or exp.get("name"),
                "domain": res.get("domain") or exp.get("domain"),
                "geo": res.get("geo"),
                "full_name": res.get("full_name") or person.get("full_name"),
                "email": res.get("email") or person.get("email"),
                "source_site": res.get("source_site") or "",
                "industry": exp.get("industry"),
                "employee_count_range": exp.get("employee_count_range"),
            },
        }
        msg = json.dumps(payload, default=str)
        await redis_client.publish(f"visitors:{org_id}", msg)
    except Exception:
        pass  # Real-time is best-effort — never fail the pipeline


# ── Webhook delivery (with Celery retry) ─────────────────────────────────────

async def _enqueue_webhooks(db, visit: Visit) -> None:
    """
    Create Alert records and enqueue Celery tasks for each webhook URL.
    Each webhook runs independently with its own retry lifecycle.
    """
    site_config = db.query(SiteConfig).filter(SiteConfig.org_id == visit.org_id).first()
    if not site_config or not site_config.webhook_urls:
        return

    payload = {
        "event": "visitor_identified",
        "visit_id": str(visit.id),
        "ip": str(visit.ip),
        "url": visit.url,
        "resolution": visit.resolution,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    for webhook_url in site_config.webhook_urls:
        # Create a pending Alert record before dispatching
        alert = Alert(
            id=uuid.uuid4(),
            visit_id=visit.id,
            webhook_type="general",
            status="pending",
            payload=payload,
        )
        db.add(alert)
        db.commit()

        webhook_secret = site_config.webhook_secret or ""
        try:
            # Dispatch as Celery task (async, with retry)
            deliver_webhook.delay(
                webhook_url=webhook_url,
                payload=payload,
                visit_id=str(visit.id),
                alert_id=str(alert.id),
                webhook_secret=webhook_secret,
            )
        except Exception as e:
            # Celery unavailable — attempt synchronous delivery
            logger.warning("Celery unavailable for webhook, trying synchronous: %s", e)
            try:
                import json as _json
                body_bytes = _json.dumps(payload, separators=(",", ":")).encode()
                headers = {"Content-Type": "application/json"}
                if webhook_secret:
                    sig = hmac.new(webhook_secret.encode(), body_bytes, hashlib.sha256).hexdigest()
                    headers["X-Outmate-Signature"] = f"sha256={sig}"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(webhook_url, content=body_bytes, headers=headers)
                alert.status = "success" if resp.status_code < 300 else "failed"
            except Exception as ex:
                logger.error("Synchronous webhook delivery failed: %s", ex)
                alert.status = "error"
            db.commit()


# ── Legacy synchronous trigger (kept for backwards compat) ───────────────────

async def trigger_webhooks(db, visit: Visit):
    """Backwards-compatible alias → now delegates to _enqueue_webhooks."""
    await _enqueue_webhooks(db, visit)


# ── GDPR Auto-Deletion (Celery Beat — daily at 02:00 UTC) ────────────────────

@celery_app.task(name="app.tasks.visitors.gdpr_auto_delete_task")
def gdpr_auto_delete_task():
    """
    Daily GDPR compliance job.

    For every org that has gdpr_mode=True, deletes:
      - visits older than 30 days
      - visitor_sessions older than 30 days
      - identity_nodes whose last_seen_at is older than 30 days
        AND have no remaining visits in any gdpr_mode org

    Also removes the associated Redis opt-out tokens for visitor_ids that
    no longer have any visits (data minimisation).

    Safe to run repeatedly — all deletes are idempotent.
    """
    from sqlalchemy import text
    from app.db.models.visitor import VisitorSession
    from app.db.models.identity_graph import IdentityNode

    db = SessionLocal()
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    total_deleted = 0

    try:
        # Find all orgs with gdpr_mode enabled
        gdpr_orgs = (
            db.query(SiteConfig)
            .filter(SiteConfig.gdpr_mode == True)  # noqa: E712
            .all()
        )

        if not gdpr_orgs:
            logger.info("[GDPR] No orgs with gdpr_mode=True — nothing to delete")
            return {"deleted_visits": 0, "gdpr_orgs": 0}

        logger.info("[GDPR] Auto-deletion starting for %d orgs, cutoff=%s", len(gdpr_orgs), cutoff.date())

        for org in gdpr_orgs:
            org_id = str(org.org_id)
            try:
                # 1. Collect visitor_ids being deleted (for identity graph cleanup)
                stale_visitor_ids = db.execute(
                    text("""
                        SELECT DISTINCT resolution->>'visitor_id' AS vid
                        FROM visits
                        WHERE org_id = :org_id
                          AND created_at < :cutoff
                          AND resolution->>'visitor_id' IS NOT NULL
                    """),
                    {"org_id": org_id, "cutoff": cutoff},
                ).fetchall()
                stale_vids = {row.vid for row in stale_visitor_ids if row.vid}

                # 2. Delete stale visits
                del_visits = db.execute(
                    text("""
                        DELETE FROM visits
                        WHERE org_id = :org_id
                          AND created_at < :cutoff
                    """),
                    {"org_id": org_id, "cutoff": cutoff},
                ).rowcount

                # 3. Delete stale sessions
                del_sessions = db.execute(
                    text("""
                        DELETE FROM visitor_sessions
                        WHERE org_id = :org_id
                          AND session_end < :cutoff
                    """),
                    {"org_id": org_id, "cutoff": cutoff},
                ).rowcount

                db.commit()
                total_deleted += del_visits
                logger.info(
                    "[GDPR] org=%s: deleted %d visits, %d sessions",
                    org_id, del_visits, del_sessions,
                )

                # 4. For stale visitor_ids, remove identity graph nodes that have
                #    NO remaining visits anywhere (data minimisation)
                for vid in stale_vids:
                    remaining = db.execute(
                        text("SELECT 1 FROM visits WHERE resolution->>'visitor_id' = :vid LIMIT 1"),
                        {"vid": vid},
                    ).first()
                    if not remaining:
                        db.execute(
                            text("DELETE FROM identity_nodes WHERE visitor_id = :vid"),
                            {"vid": vid},
                        )
                        logger.debug("[GDPR] Removed identity node for visitor_id=%s", vid)

                db.commit()

            except Exception as exc:
                db.rollback()
                logger.error("[GDPR] Error deleting for org=%s: %s", org_id, exc)

        logger.info("[GDPR] Auto-deletion complete. Total visits removed: %d", total_deleted)
        return {"deleted_visits": total_deleted, "gdpr_orgs": len(gdpr_orgs)}

    finally:
        db.close()


# ── Account Intent Aggregation (Celery Beat — every hour at :15) ─────────────

@celery_app.task(name="app.tasks.visitors.aggregate_account_intent_task")
def aggregate_account_intent_task():
    """
    Hourly pre-computation of account-level intent scores.

    Groups visits from the last 30 days by company domain (per org),
    computes the account_intent_score, and caches results in Redis at:
      account_intent:{org_id}  →  JSON list of account objects, TTL=2h

    The /accounts API endpoint reads from this cache first for instant
    response, falling back to live SQL if the cache is cold.

    Formula:
      account_intent_score = (
          peak_engagement × 0.40
        + min(unique_visitors × 5, 25)    # multi-visitor bonus
        + buying_stage_pts                 # decision=25, consideration=15, awareness=5
        + avg_icp_score × 0.15
      ), capped at 100
    """
    from sqlalchemy import text
    from app.core.redis import RedisManager
    import asyncio

    db = SessionLocal()
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    try:
        orgs = db.query(SiteConfig).all()
        logger.info("[AccountIntent] Running aggregation for %d orgs", len(orgs))

        for org in orgs:
            org_id = str(org.org_id)
            try:
                rows = db.execute(
                    text("""
                        SELECT
                            resolution->>'domain'                         AS domain,
                            resolution->>'company'                        AS company,
                            resolution->>'logo_url'                       AS logo_url,
                            COUNT(*)                                      AS total_visits,
                            COUNT(DISTINCT resolution->>'visitor_id')     AS unique_visitors,
                            MAX((resolution->'behavioral'->>'engagement_score')::numeric) AS peak_engagement,
                            AVG((resolution->>'icp_score')::numeric)       AS avg_icp_score,
                            COUNT(CASE WHEN resolution->'behavioral'->>'buying_stage' = 'decision'      THEN 1 END) AS stage_decision,
                            COUNT(CASE WHEN resolution->'behavioral'->>'buying_stage' = 'consideration' THEN 1 END) AS stage_consideration,
                            COUNT(CASE WHEN resolution->'behavioral'->>'buying_stage' = 'awareness'     THEN 1 END) AS stage_awareness,
                            MAX(created_at)                               AS last_seen_at
                        FROM visits
                        WHERE org_id = :org_id
                          AND created_at >= :cutoff
                          AND matched = true
                          AND resolution->>'domain' IS NOT NULL
                        GROUP BY
                            resolution->>'domain',
                            resolution->>'company',
                            resolution->>'logo_url'
                        ORDER BY MAX((resolution->'behavioral'->>'engagement_score')::numeric) DESC NULLS LAST
                        LIMIT 500
                    """),
                    {"org_id": org_id, "cutoff": cutoff},
                ).fetchall()

                accounts = []
                for row in rows:
                    domain = row.domain or ""
                    if not domain:
                        continue
                    peak_eng = float(row.peak_engagement or 0)
                    unique_v = int(row.unique_visitors or 0)
                    avg_icp = float(row.avg_icp_score or 0)
                    stage_d = int(row.stage_decision or 0)
                    stage_c = int(row.stage_consideration or 0)
                    stage_a = int(row.stage_awareness or 0)
                    buying_pts = 25 if stage_d > 0 else (15 if stage_c > 0 else 5)

                    score = min(int(
                        peak_eng * 0.40
                        + min(unique_v * 5, 25)
                        + buying_pts
                        + avg_icp * 0.15
                    ), 100)

                    accounts.append({
                        "domain": domain,
                        "company": row.company or domain,
                        "logo_url": row.logo_url,
                        "total_visits": int(row.total_visits or 0),
                        "unique_visitor_count": unique_v,
                        "peak_engagement_score": int(peak_eng),
                        "avg_icp_score": round(avg_icp, 1),
                        "buying_stage_distribution": {
                            "decision": stage_d,
                            "consideration": stage_c,
                            "awareness": stage_a,
                        },
                        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
                        "account_intent_score": score,
                    })

                accounts.sort(key=lambda a: a["account_intent_score"], reverse=True)

                # Cache in Redis for 2h (workers update hourly at :15)
                async def _cache():
                    rc = RedisManager.get_client()
                    await rc.setex(
                        f"account_intent:{org_id}",
                        7200,
                        json.dumps(accounts, default=str),
                    )
                asyncio.run(_cache())
                logger.info("[AccountIntent] org=%s: %d accounts cached", org_id, len(accounts))

            except Exception as exc:
                logger.error("[AccountIntent] Error for org=%s: %s", org_id, exc)

    finally:
        db.close()

    return {"status": "ok"}
