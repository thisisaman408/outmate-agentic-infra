import logging
import httpx
from typing import Dict, Any
import uuid
from datetime import datetime

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models.visitor import Visit, SiteConfig, Alert
from app.services.visitor_enrich import VisitorEnricher
import asyncio

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
            matched=resolution.get("confidence", 0) > 0.4
        )
        db.add(new_visit)
        db.commit()
        db.refresh(new_visit)
        logger.info(f"Saved visit {new_visit.id} for IP {ip}. Matched: {new_visit.matched}")
        
        # 3. Trigger Webhooks if matched
        if new_visit.matched:
            await trigger_webhooks(db, new_visit)
            
    except Exception as e:
        logger.error(f"Error processing visitor data: {e}")
        db.rollback()
    finally:
        db.close()

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
