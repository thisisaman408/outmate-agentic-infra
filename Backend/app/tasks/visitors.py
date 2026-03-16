import logging
import httpx
from typing import Dict, Any
import uuid
from datetime import datetime

from app.core.celery_app import celery_app
from app.core.redis import RedisManager
from app.db.session import SessionLocal
from app.db.models.visitor import Visit, SiteConfig, Alert
from app.db.repositories.company_repository import CompanyRepository
from app.db.repositories.prospect_repository import ProspectRepository
from app.services.visitor_enrich import VisitorEnricher
import asyncio
import json

logger = logging.getLogger(__name__)

@celery_app.task(name="app.tasks.visitors.process_visitor_task")
def process_visitor_task(org_id: str, data: Dict[str, Any]):
    """
    Celery task to enrich visitor data and save to DB.
    """
    return asyncio.run(_process_visitor_data(org_id, data))

async def _process_visitor_data(org_id: str, data: Dict[str, Any]):
    """
    Background task to enrich visitor data and save to DB.
    """
    db = SessionLocal()
    try:
        ip = data.get("ip")
        url = data.get("url")
        intent_score = data.get("intent_score", 0.5)
        
        # 1. Enrich data
        logger.info(f"Starting enrichment for IP: {ip}")
        enricher = VisitorEnricher()
        resolution = await enricher.enrich_ip(ip, url, intent_score)
        logger.info(f"Enrichment completed for IP: {ip}. Confidence: {resolution.get('confidence')}")

        # 1b. Categorize visitor (company vs prospect) and attach matches
        resolution = _categorize_and_attach(db, resolution)
        
        # 2. Save Visit
        new_visit = Visit(
            id=uuid.uuid4(),
            org_id=uuid.UUID(org_id),
            ip=ip,
            url=url,
            referrer=data.get("referrer"),
            user_agent=data.get("user_agent"),
            intent_score=intent_score,
            resolution=resolution,
            # A visit is "matched" (Identified) when we have real data:
            # - a DB-matched entity (prospect or company record), OR
            # - high confidence (≥0.7) from Enrich.so/Explorium, OR
            # - IPinfo returned a real org/domain (confidence ≥0.4) — ASN orgs
            #   are real companies even without person-level enrichment
            matched=(
                bool(resolution.get("matched_entity"))
                or (
                    resolution.get("confidence", 0) >= 0.4
                    and bool(resolution.get("company") or resolution.get("domain"))
                )
            )
        )
        db.add(new_visit)
        db.commit()
        db.refresh(new_visit)
        logger.info(f"Saved visit {new_visit.id} for IP {ip}. Matched: {new_visit.matched}")

        # 2b. Publish realtime event (best-effort)
        await _publish_visit_event(org_id=str(new_visit.org_id), visit=new_visit)
        
        # 3. Trigger Webhooks if matched
        if new_visit.matched:
            await trigger_webhooks(db, new_visit)
            
    except Exception as e:
        logger.error(f"Error processing visitor data: {e}")
        db.rollback()
    finally:
        db.close()

def _normalize_domain(domain: str | None) -> str | None:
    if not domain:
        return None
    d = domain.strip().lower()
    if d.startswith("www."):
        d = d[4:]
    # ipinfo hostname can be a reverse DNS host; keep it but trim trailing dot
    return d.rstrip(".") or None

def _categorize_and_attach(db, resolution: Dict[str, Any]) -> Dict[str, Any]:
    """
    Classify a visitor as a 'company' or 'prospect' and attach matched entities (best-effort).

    - **prospect**: we have a person email (or can map to an existing Prospect)
    - **company**: we have a company/domain (or can map to an existing Company)
    - **unknown**: neither found
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
        logger.warning(f"Prospect match/create failed: {e}")

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
        logger.warning(f"Company match/create failed: {e}")

    if matched_prospect:
        res["category"] = "prospect"
        res["matched_entity"] = "prospect"
        res["matched_prospect"] = {
            "id": str(matched_prospect.id),
            "email": matched_prospect.email,
            "full_name": matched_prospect.full_name,
        }
        if matched_prospect.company_id:
            res["matched_company_id"] = str(matched_prospect.company_id)
    elif matched_company:
        res["category"] = "company"
        res["matched_entity"] = "company"
        res["matched_company"] = {
            "id": str(matched_company.id) if getattr(matched_company, "id", None) else None,
            "domain": getattr(matched_company, "domain", None),
            "name": getattr(matched_company, "name", None),
        }
    else:
        res["category"] = "unknown"
        res["matched_entity"] = None

    return res

async def _publish_visit_event(org_id: str, visit: Visit) -> None:
    try:
        redis_client = RedisManager.get_client()
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
                "resolution": visit.resolution or {},
            },
        }
        msg = json.dumps(payload, default=str)
        # Publish only to the org-scoped channel (no global "visitors:all" to prevent cross-tenant leakage)
        await redis_client.publish(f"visitors:{org_id}", msg)
    except Exception:
        # Realtime is best-effort; don't fail background processing.
        return

async def trigger_webhooks(db, visit: Visit):
    """
    Send webhook alerts for matched visitors.
    """
    site_config = db.query(SiteConfig).filter(SiteConfig.org_id == visit.org_id).first()
    if not site_config or not site_config.webhook_urls:
        return

    payload = {
        "event": "visitor_identified",
        "visit_id": str(visit.id),
        "ip": visit.ip,
        "url": visit.url,
        "resolution": visit.resolution,
        "timestamp": datetime.utcnow().isoformat()
    }

    async with httpx.AsyncClient() as client:
        for webhook_url in site_config.webhook_urls:
            try:
                response = await client.post(webhook_url, json=payload, timeout=10.0)
                
                # Save Alert record
                alert = Alert(
                    id=uuid.uuid4(),
                    visit_id=visit.id,
                    webhook_type="general",
                    status="success" if response.status_code < 300 else "failed",
                    payload=payload
                )
                db.add(alert)
                db.commit()
            except Exception as e:
                logger.error(f"Webhook failed for {webhook_url}: {e}")
                alert = Alert(
                    id=uuid.uuid4(),
                    visit_id=visit.id,
                    webhook_type="general",
                    status="error",
                    payload={"error": str(e)}
                )
                db.add(alert)
                db.commit()
