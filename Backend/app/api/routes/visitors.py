from fastapi import APIRouter, Depends, Header, Form, HTTPException
from sqlalchemy.orm import Session
from urllib.parse import urlparse
import logging
from typing import Optional

from app.db.deps import get_db
from app.core.redis import RedisManager
from app.db.models.visitor import SiteConfig, Visit
from app.services.visitor_enrich import VisitorEnricher

# In a real app, these tasks would be in app/tasks/visitors.py
# For now, we'll define a placeholder or implement the logic directly if Celery is not ready
# However, the plan SPECIFIES Celery.

router = APIRouter(prefix="/api/visitors", tags=["visitors"])
logger = logging.getLogger(__name__)

@router.get("/pixel.js")
async def get_pixel():
    """
    Serves the tracking pixel JavaScript.
    In production, this would be served by a CDN or static file server.
    """
    import os
    from fastapi.responses import FileResponse
    # Paths are relative to the backend root
    pixel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../Frontend/public/pixel.js"))
    
    if not os.path.exists(pixel_path):
        # Fallback for development if Frontend is not sibling
        return {"error": "pixel.js not found"}
        
    return FileResponse(pixel_path, media_type="application/javascript")

@router.post("/track")
async def track_visitor(
    url: str = Form(...),
    referrer: Optional[str] = Form(None),
    user_agent: str = Header(...),
    x_forwarded_for: Optional[str] = Header(None),
    pixel_key: str = Header(..., alias="X-Pixel-Key"),
    db: Session = Depends(get_db)
):
    # 1. Validate Pixel Key
    site_config = db.query(SiteConfig).filter(SiteConfig.pixel_key == pixel_key).first()
    if not site_config:
        logger.error(f"Invalid pixel key: {pixel_key}")
        raise HTTPException(status_code=401, detail="Invalid pixel key")

    # 2. Get IP
    ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else "127.0.0.1"
    
    # 3. Calculate Intent Score
    intent_score = 1.0 if any(x in url.lower() for x in ["/pricing", "/demo", "/contact"]) else 0.5
    
    # 4. Redis Deduplication (1 hour)
    try:
        redis_client = RedisManager.get_client()
        domain = urlparse(url).netloc
        dedupe_key = f"visits:{site_config.org_id}:{ip}:{domain}"
        
        # async check if using redis.asyncio
        if await redis_client.get(dedupe_key):
            return {"status": "deduplicated"}
        
        await redis_client.setex(dedupe_key, 3600, "1")
    except Exception as e:
        logger.error(f"Redis deduplication failed: {e}")
        # Continue even if redis fails, just won't deduplicate

    # 5. Process Visitor (Async via Celery)
    from app.tasks.visitors import process_visitor_task
    
    process_visitor_task.delay(str(site_config.org_id), {
        "ip": ip, 
        "url": url, 
        "referrer": referrer, 
        "user_agent": user_agent, 
        "intent_score": intent_score
    })
    
    logger.info(f"Visitor tracked: {ip} for org {site_config.org_id}")
    
    return {"status": "queued", "message": "Visitor tracking data received"}

@router.get("/")
async def list_visitors(
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get recent visits. In a real app, this would be filtered by org_id from auth.
    """
    visits = db.query(Visit).order_by(Visit.created_at.desc()).limit(limit).all()
    return visits

@router.get("/stats")
async def get_visitor_stats(db: Session = Depends(get_db)):
    """
    Get simple visitor stats.
    """
    total_visits = db.query(Visit).count()
    matched_visits = db.query(Visit).filter(Visit.matched == True).count()
    
    return {
        "total_visits": total_visits,
        "matched_visits": matched_visits,
        "match_rate": (matched_visits / total_visits * 100) if total_visits > 0 else 0
    }
