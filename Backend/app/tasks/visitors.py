import logging
import httpx
from typing import Dict, Any
import uuid
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.redis import RedisManager
from app.db.session import SessionLocal
from app.db.models.visitor import Visit, SiteConfig, Alert
from app.db.repositories.company_repository import CompanyRepository
from app.db.repositories.prospect_repository import ProspectRepository
from app.services.visitor_enrich import VisitorEnricher, is_isp_or_cloud
import asyncio
import json

logger = logging.getLogger(__name__)

# ── Celery task ───────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.visitors.process_visitor_task")
def process_visitor_task(org_id: str, data: Dict[str, Any]):
    """Celery task: enrich visitor data and save to DB."""
    return asyncio.run(_process_visitor_data(org_id, data))


@celery_app.task(
    name="app.tasks.visitors.deliver_webhook",
    bind=True,
    max_retries=3,
    default_retry_delay=5,
)
def deliver_webhook(self, webhook_url: str, payload: dict, visit_id: str, alert_id: str):
    """
    Deliver a single webhook with exponential backoff retry.
    Retry schedule: 5s → 60s → 300s (3 attempts total).
    """
    db = SessionLocal()
    try:
        import httpx as _httpx
        with _httpx.Client(timeout=10.0) as client:
            response = client.post(webhook_url, json=payload)
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


async def _process_visitor_data(org_id: str, data: Dict[str, Any]):
    """Background coroutine: enrich visitor data and save to DB."""
    db = SessionLocal()
    try:
        ip = data.get("ip")
        url = data.get("url")
        email = data.get("email")
        intent_score = data.get("intent_score", 0.5)
        visitor_id = data.get("visitor_id")
        source_site = data.get("source_site") or ""

        logger.info("Starting enrichment for IP: %s (email=%s, visitor_id=%s, org=%s)", ip, email, visitor_id, org_id)
        enricher = VisitorEnricher()
        resolution = await enricher.enrich_ip(ip, url, intent_score, email=email)

        # Tag every visit with the pixel owner's domain so the dashboard can
        # show which customer site the visitor came from even when IP enrichment
        # can't identify their company.
        if source_site:
            resolution["source_site"] = source_site

        resolution = _categorize_and_attach(db, resolution)
        category = resolution.get("category", "unknown")
        logger.info("Categorized visit for %s: %s (org=%s)", ip, category, org_id)

        if visitor_id:
            resolution["visitor_id"] = visitor_id

        is_matched = (
            bool(resolution.get("matched_entity"))
            or (
                resolution.get("confidence", 0) >= 0.4
                and bool(resolution.get("company") or resolution.get("domain"))
            )
        )
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
        )
        db.add(new_visit)
        db.commit()
        db.refresh(new_visit)
        logger.info("Saved visit %s for IP %s. Matched: %s", new_visit.id, ip, new_visit.matched)

        # Retroactive linking: link prior anonymous sessions from same visitor_id
        if visitor_id and email and is_matched:
            try:
                from sqlalchemy import text
                updated = db.execute(
                    text("""
                        UPDATE visits
                        SET matched = true,
                            resolution = jsonb_set(
                                jsonb_set(
                                    COALESCE(resolution, '{}'::jsonb),
                                    '{email}', to_jsonb(:email::text)
                                ),
                                '{retrolinked}', 'true'::jsonb
                            )
                        WHERE org_id = :org_id
                          AND matched = false
                          AND resolution->>'visitor_id' = :visitor_id
                          AND id != :current_id
                    """),
                    {"email": email, "org_id": org_id, "visitor_id": visitor_id, "current_id": str(new_visit.id)}
                )
                db.commit()
                if updated.rowcount > 0:
                    logger.info("Retroactively linked %d anonymous visit(s) for visitor_id=%s", updated.rowcount, visitor_id)
            except Exception as e:
                logger.warning("Retroactive linking failed: %s", e)

        # Real-time SSE publish (best-effort)
        await _publish_visit_event(org_id=str(new_visit.org_id), visit=new_visit)

        # Webhooks for matched visits
        if new_visit.matched:
            await _enqueue_webhooks(db, new_visit)

    except Exception as e:
        logger.error("Error processing visitor data: %s", e)
        db.rollback()
    finally:
        db.close()


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
    person = res.get("person") or {}
    email = res.get("email") or person.get("email") or person.get("work_email") or person.get("personal_email")
    domain = _normalize_domain(res.get("domain") or person.get("company_domain"))
    company_name = res.get("company") or person.get("company_name")

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

        try:
            # Dispatch as Celery task (async, with retry)
            deliver_webhook.delay(
                webhook_url=webhook_url,
                payload=payload,
                visit_id=str(visit.id),
                alert_id=str(alert.id),
            )
        except Exception as e:
            # Celery unavailable — attempt synchronous delivery
            logger.warning("Celery unavailable for webhook, trying synchronous: %s", e)
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(webhook_url, json=payload)
                alert.status = "success" if resp.status_code < 300 else "failed"
            except Exception as ex:
                logger.error("Synchronous webhook delivery failed: %s", ex)
                alert.status = "error"
            db.commit()


# ── Legacy synchronous trigger (kept for backwards compat) ───────────────────

async def trigger_webhooks(db, visit: Visit):
    """Backwards-compatible alias → now delegates to _enqueue_webhooks."""
    await _enqueue_webhooks(db, visit)
