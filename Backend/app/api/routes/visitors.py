from fastapi import APIRouter, Header, Form, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.exc import OperationalError
from urllib.parse import urlparse
import logging
import asyncio
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from collections import Counter, defaultdict

from app.core.config import settings
from app.db.session import SessionLocal
from app.core.redis import RedisManager
from app.db.models.visitor import SiteConfig, Visit

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


def _visit_to_dict(v: Visit) -> dict:
    res = v.resolution or {}
    person = res.get("person") or {}
    return {
        "id": str(v.id),
        "ip": str(v.ip),
        "url": v.url,
        "referrer": v.referrer,
        "intent_score": v.intent_score,
        "matched": v.matched,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "resolution": res,
        "category": res.get("category"),
        "matched_entity": res.get("matched_entity"),
        "matched_company": res.get("matched_company"),
        "matched_prospect": res.get("matched_prospect"),
        "company": res.get("company"),
        "domain": res.get("domain"),
        "geo": res.get("geo"),
        "confidence": res.get("confidence", 0),
        "email": res.get("email") or person.get("email"),
        "phone": res.get("phone") or person.get("phone"),
        "full_name": res.get("full_name") or person.get("full_name") or person.get("name"),
        "linkedin_url": res.get("linkedin_url") or person.get("linkedin_url") or person.get("linkedin"),
        "job_title": res.get("job_title") or person.get("title") or person.get("job_title"),
    }


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
        from app.tasks.visitors import process_visitor_task, _process_visitor_data

        payload = {
            "ip": ip,
            "url": url,
            "referrer": referrer,
            "user_agent": user_agent,
            "intent_score": intent_score,
        }

        queued_via = "celery"
        try:
            process_visitor_task.delay(str(site_config.org_id), payload)
        except Exception as e:
            # Common in local dev when Redis (Celery broker) isn't running.
            logger.warning(f"Celery unavailable, processing inline: {e}")
            queued_via = "inline"
            asyncio.create_task(_process_visitor_data(str(site_config.org_id), payload))
        
        logger.info(f"Visitor tracked: {ip} for org {site_config.org_id}")
        return {"status": "queued", "queued_via": queued_via, "message": "Visitor tracking data received"}
    
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
                return [_visit_to_dict(v) for v in visits]
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
                # category breakdown (best-effort; JSONB may be null)
                recent = db.query(Visit.resolution).order_by(Visit.created_at.desc()).limit(2000).all()
                cats = Counter([(r[0] or {}).get("category") or "unknown" for r in recent])
                return {
                    "total_visits": total,
                    "matched_visits": matched,
                    "match_rate": (matched / total * 100) if total > 0 else 0,
                    "category_breakdown_sampled": dict(cats),
                }
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


@router.get("/analytics")
async def get_visitor_analytics(hours: int = 24, live_window_minutes: int = 5, top_n: int = 10):
    """
    Visitor analytics for charts on the Visitors page.
    Returns 503 if database is unavailable.
    """
    hours = max(1, min(int(hours), 168))  # 1h..7d
    live_window_minutes = max(1, min(int(live_window_minutes), 60))
    top_n = max(3, min(int(top_n), 50))
    since = datetime.utcnow() - timedelta(hours=hours)
    live_since = datetime.utcnow() - timedelta(minutes=live_window_minutes)

    try:
        def _query():
            db = SessionLocal()
            try:
                rows = (
                    db.query(Visit.created_at, Visit.ip, Visit.url, Visit.referrer, Visit.intent_score, Visit.matched, Visit.resolution)
                    .filter(Visit.created_at >= since)
                    .order_by(Visit.created_at.desc())
                    .limit(20000)
                    .all()
                )

                # Live online: unique IPs in the recent window
                live_ips = set()

                # Timeseries buckets (hourly)
                buckets = defaultdict(lambda: {"total": 0, "matched": 0, "company": 0, "prospect": 0, "unknown": 0})

                # Top pages / referrers
                page_counts = Counter()
                ref_counts = Counter()

                # Intent buckets
                intent_buckets = Counter({"0-49": 0, "50-69": 0, "70-84": 0, "85-100": 0})

                for created_at, ip, url, ref, intent, matched, res in rows:
                    if not created_at:
                        continue
                    hour_key = created_at.replace(minute=0, second=0, microsecond=0).isoformat()
                    cat = ((res or {}).get("category") or "unknown").lower()
                    if cat not in ("company", "prospect", "unknown"):
                        cat = "unknown"

                    buckets[hour_key]["total"] += 1
                    if matched:
                        buckets[hour_key]["matched"] += 1
                    buckets[hour_key][cat] += 1

                    if created_at >= live_since and ip:
                        live_ips.add(str(ip))

                    try:
                        page = urlparse(url).path or "/"
                    except Exception:
                        page = url or ""
                    if page:
                        page_counts[page] += 1

                    if ref:
                        try:
                            ref_counts[urlparse(ref).netloc or ref] += 1
                        except Exception:
                            ref_counts[ref] += 1

                    try:
                        score = float(intent or 0) * 100
                    except Exception:
                        score = 0
                    if score < 50:
                        intent_buckets["0-49"] += 1
                    elif score < 70:
                        intent_buckets["50-69"] += 1
                    elif score < 85:
                        intent_buckets["70-84"] += 1
                    else:
                        intent_buckets["85-100"] += 1

                timeseries = [
                    {
                        "hour": k,
                        "total": v["total"],
                        "matched": v["matched"],
                        "company": v["company"],
                        "prospect": v["prospect"],
                        "unknown": v["unknown"],
                    }
                    for k, v in sorted(buckets.items(), key=lambda kv: kv[0])
                ]

                return {
                    "window": {"hours": hours, "since": since.isoformat()},
                    "live": {"window_minutes": live_window_minutes, "unique_ips": len(live_ips)},
                    "timeseries": timeseries,
                    "top_pages": [{"page": p, "count": c} for p, c in page_counts.most_common(top_n)],
                    "top_referrers": [{"referrer": r, "count": c} for r, c in ref_counts.most_common(top_n)],
                    "intent_distribution": [{"bucket": b, "count": c} for b, c in intent_buckets.items()],
                }
            finally:
                db.close()

        return await _run_db(_query)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


@router.get("/stream")
async def stream_visitors(org_id: str = "all"):
    """
    Server-Sent Events stream for realtime visitor updates.
    Requires Redis (pubsub). Falls back to 503 if Redis unavailable.
    """
    redis_client = RedisManager.get_client()
    channel = "visitors:all" if org_id == "all" else f"visitors:{org_id}"
    pubsub = redis_client.pubsub()

    async def event_generator():
        try:
            await pubsub.subscribe(channel)
            # Initial comment to open the stream
            yield f": subscribed {channel}\n\n"
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if message and message.get("type") == "message":
                    data = message.get("data")
                    if data is not None:
                        yield f"data: {data}\n\n"
                else:
                    # heartbeat
                    yield ": heartbeat\n\n"
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            yield f"event: error\ndata: {str(e)}\n\n"
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except Exception:
                pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")
