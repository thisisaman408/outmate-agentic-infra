from fastapi import APIRouter, Header, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from urllib.parse import urlparse
import logging
import asyncio
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings
from app.db.session import SessionLocal
from app.core.redis import RedisManager
from app.db.models.visitor import SiteConfig, Visit
from app.services.visitor_enrich import VisitorEnricher

router = APIRouter(prefix="/api/visitors", tags=["visitors"])
logger = logging.getLogger(__name__)

# Thread pool for running synchronous DB operations with timeouts
_db_executor = ThreadPoolExecutor(max_workers=4)
DB_TIMEOUT = 15  # seconds — if DB doesn't respond within this, return 503


async def _run_db(func, timeout=DB_TIMEOUT):
    """Run a synchronous DB function in a thread with a hard timeout."""
    loop = asyncio.get_event_loop()
    try:
        return await asyncio.wait_for(
            loop.run_in_executor(_db_executor, func),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        logger.error("Database query timed out after %s seconds", timeout)
        raise


@router.get("/pixel.js")
async def get_pixel():
    """Serves the tracking pixel JavaScript."""
    import os
    from fastapi.responses import FileResponse
    pixel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../Frontend/public/pixel.js"))
    
    if not os.path.exists(pixel_path):
        return {"error": "pixel.js not found"}
        
    return FileResponse(pixel_path, media_type="application/javascript")


@router.post("/track")
async def track_visitor(
    request: Request,
    url: str = Form(...),
    referrer: Optional[str] = Form(None),
    user_agent: str = Header(...),
    x_forwarded_for: Optional[str] = Header(None),
    pixel_key: str = Header(..., alias="X-Pixel-Key"),
):
    try:
        # 1. Validate Pixel Key (DB call with timeout)
        def _validate_key():
            db = SessionLocal()
            try:
                return db.query(SiteConfig).filter(SiteConfig.pixel_key == pixel_key).first()
            finally:
                db.close()
        
        site_config = await _run_db(_validate_key)
        if not site_config:
            raise HTTPException(status_code=401, detail="Invalid pixel key")

        # 2. Get IP
        forwarded = x_forwarded_for or request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "127.0.0.1")
        
        # 3. Calculate Intent Score
        intent_score = 1.0 if any(x in url.lower() for x in ["/pricing", "/demo", "/contact"]) else 0.5
        
        # 4. Redis Deduplication (1 hour)
        try:
            dedupe_seconds = settings.VISITOR_DEDUPE_SECONDS
            if dedupe_seconds > 0:
                redis_client = RedisManager.get_client()
                domain = urlparse(url).netloc
                dedupe_key = f"visits:{site_config.org_id}:{ip}:{domain}"
                
                if await redis_client.get(dedupe_key):
                    return {"status": "deduplicated"}
                
                await redis_client.setex(dedupe_key, dedupe_seconds, "1")
        except Exception as e:
            logger.error(f"Redis deduplication failed: {e}")

        # 5. Process Visitor (Async via Celery)
        from app.tasks.visitors import process_visitor_task
        
        process_visitor_task.delay(str(site_config.org_id), {
            "ip": ip, "url": url, "referrer": referrer, 
            "user_agent": user_agent, "intent_score": intent_score
        })
        
        logger.info(f"Visitor tracked: {ip} for org {site_config.org_id}")
        return {"status": "queued", "message": "Visitor tracking data received"}
    
    except HTTPException:
        raise
    except (OperationalError, asyncio.TimeoutError) as e:
        logger.error(f"Database unavailable in /track: {e}")
        return JSONResponse(status_code=503, content={
            "error": "Database temporarily unavailable"
        })
    except Exception as e:
        logger.error(f"Error in /track: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/")
async def list_visitors(limit: int = 100):
    """Get recent visits. Returns 503 if database is unavailable."""
    try:
        def _query():
            db = SessionLocal()
            try:
                visits = db.query(Visit).order_by(Visit.created_at.desc()).limit(limit).all()
                result = []
                for v in visits:
                    res = v.resolution or {}
                    person = res.get("person") or {}
                    result.append({
                        "id": str(v.id),
                        "ip": v.ip,
                        "url": v.url,
                        "referrer": v.referrer,
                        "intent_score": v.intent_score,
                        "matched": v.matched,
                        "created_at": v.created_at.isoformat() if v.created_at else None,
                        "resolution": res,
                        "company": res.get("company"),
                        "domain": res.get("domain"),
                        "geo": res.get("geo"),
                        "confidence": res.get("confidence", 0),
                        "email": res.get("email") or person.get("email"),
                        "phone": res.get("phone") or person.get("phone"),
                        "full_name": res.get("full_name") or person.get("full_name") or person.get("name"),
                        "linkedin_url": res.get("linkedin_url") or person.get("linkedin_url") or person.get("linkedin"),
                        "job_title": res.get("job_title") or person.get("title") or person.get("job_title"),
                    })
                return result
            finally:
                db.close()
        
        return await _run_db(_query)
    
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={
            "error": "Database temporarily unavailable. Please check your Supabase connection."
        })
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.get("/stats")
async def get_visitor_stats():
    """Get visitor stats. Returns zeros with 503 if database is unavailable."""
    try:
        def _query():
            db = SessionLocal()
            try:
                total = db.query(Visit).count()
                matched = db.query(Visit).filter(Visit.matched == True).count()
                return {"total_visits": total, "matched_visits": matched,
                        "match_rate": (matched / total * 100) if total > 0 else 0}
            finally:
                db.close()
        
        return await _run_db(_query)
    
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={
            "error": "Database temporarily unavailable",
            "total_visits": 0, "matched_visits": 0, "match_rate": 0
        })
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "error": str(e), "total_visits": 0, "matched_visits": 0, "match_rate": 0
        })
