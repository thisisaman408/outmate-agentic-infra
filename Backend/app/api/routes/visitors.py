from fastapi import APIRouter, Header, Form, HTTPException, Request, Query, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.exc import OperationalError
from urllib.parse import urlparse
import logging
import asyncio
import httpx
import jwt as pyjwt
import secrets
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict

import uuid as _uuid

from app.core.config import settings
from app.db.session import SessionLocal
from app.core.redis import RedisManager
from app.db.models.visitor import SiteConfig, Visit
from app.db.models.user import User
from app.api.deps.auth import get_current_user

# ── Default test SiteConfig ──────────────────────────────────────────────────
# This pixel key is what the dashboard's "Setup Tracking Pixel" dialog shows.
# It is seeded automatically at module load so the tracker works out-of-the-box.
_DEFAULT_PIXEL_KEY = "outmate_test_key_123"
_DEFAULT_ORG_ID = _uuid.UUID("00000000-0000-0000-0000-000000000001")

def _ensure_default_site_config() -> None:
    """Idempotently create the default SiteConfig row if it doesn't exist."""
    db = SessionLocal()
    try:
        exists = db.query(SiteConfig).filter(SiteConfig.pixel_key == _DEFAULT_PIXEL_KEY).first()
        if not exists:
            db.add(SiteConfig(org_id=_DEFAULT_ORG_ID, pixel_key=_DEFAULT_PIXEL_KEY, domain="localhost"))
            db.commit()
            logger.info("Seeded default SiteConfig (pixel_key=%s)", _DEFAULT_PIXEL_KEY)
        else:
            logger.debug("Default SiteConfig already present (org_id=%s)", exists.org_id)
    except Exception as exc:
        db.rollback()
        logger.warning("Could not seed default SiteConfig: %s", exc)
    finally:
        db.close()

def _get_or_create_site_config(db, user_id: _uuid.UUID) -> SiteConfig:
    """
    Return the SiteConfig for a user's org, creating one if it doesn't exist.
    Uses user.id as org_id (1:1 user→org model).
    Pixel key format: pk_<16 random hex chars> — unique, URL-safe.
    """
    cfg = db.query(SiteConfig).filter(SiteConfig.org_id == user_id).first()
    if not cfg:
        pixel_key = "pk_" + secrets.token_hex(16)
        cfg = SiteConfig(org_id=user_id, pixel_key=pixel_key, domain="")
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
        logger.info("Created SiteConfig for user %s (pixel_key=%s)", user_id, pixel_key)
    return cfg


# public_router: no JWT required — used by the tracking pixel and pixel.js file
# (registered in main.py WITHOUT auth_dependencies)
public_router = APIRouter(prefix="/api/v1/visitors", tags=["visitors"])

# router: JWT required — used by the dashboard UI
# (registered in main.py WITH auth_dependencies)
router = APIRouter(prefix="/api/v1/visitors", tags=["visitors"])

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
    exp = res.get("explorium") or {}  # Explorium company firmographic data
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
        # Company identity
        "company": res.get("company") or exp.get("name"),
        "domain": res.get("domain") or exp.get("domain"),
        "website": exp.get("website") or res.get("website"),
        "geo": res.get("geo"),
        "confidence": res.get("confidence", 0),
        # Person contact (from Enrich.so)
        "email": res.get("email") or person.get("email"),
        "phone": res.get("phone") or person.get("phone") or exp.get("phone"),
        "full_name": res.get("full_name") or person.get("full_name") or person.get("name"),
        "linkedin_url": res.get("linkedin_url") or person.get("linkedin_url") or person.get("linkedin"),
        "job_title": res.get("job_title") or person.get("title") or person.get("job_title"),
        # Company firmographics (from Explorium)
        "company_linkedin_url": exp.get("linkedin_url"),
        "industry": exp.get("industry") or exp.get("linkedin_industry_category"),
        "employee_count_range": exp.get("employee_count_range"),
        "employee_count_exact": exp.get("employee_count_exact"),
        "revenue_range": exp.get("revenue_range"),
        "funding_stage": exp.get("funding_stage"),
        "funding_total": exp.get("funding_total"),
        "technologies": exp.get("technologies") or [],
        "headquarters_city": exp.get("headquarters_city"),
        "headquarters_country": exp.get("headquarters_country"),
        "description": exp.get("description"),
    }


@router.get("/site-config")
async def get_site_config(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's SiteConfig (pixel_key, domain, webhooks). Auto-creates if missing."""
    def _get():
        db = SessionLocal()
        try:
            cfg = _get_or_create_site_config(db, current_user.id)
            return {
                "org_id": str(cfg.org_id),
                "pixel_key": cfg.pixel_key,
                "domain": cfg.domain or "",
                "webhook_urls": cfg.webhook_urls or [],
                "icp_filters": cfg.icp_filters or {},
                "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
            }
        finally:
            db.close()

    try:
        return await _run_db(_get)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


@router.post("/site-config")
async def update_site_config(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Update domain, webhook_urls, or icp_filters for the user's SiteConfig."""
    body = await request.json()
    def _update():
        db = SessionLocal()
        try:
            cfg = _get_or_create_site_config(db, current_user.id)
            if "domain" in body:
                cfg.domain = str(body["domain"])[:255]
            if "webhook_urls" in body and isinstance(body["webhook_urls"], list):
                cfg.webhook_urls = body["webhook_urls"][:10]
            if "icp_filters" in body and isinstance(body["icp_filters"], dict):
                cfg.icp_filters = body["icp_filters"]
            db.commit()
            return {"status": "updated", "pixel_key": cfg.pixel_key, "domain": cfg.domain}
        finally:
            db.close()

    try:
        return await _run_db(_update)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


@router.post("/test-hit")
async def send_test_hit(request: Request, current_user: User = Depends(get_current_user)):
    """
    Fire a synthetic visitor event scoped to the authenticated user's org.
    Uses 1.1.1.1 (Cloudflare) as the test IP — well-known corporate IP with
    full IPinfo + Explorium data (Cloudflare Inc., San Francisco, US).
    """
    try:
        def _get_config():
            db = SessionLocal()
            try:
                return _get_or_create_site_config(db, current_user.id)
            finally:
                db.close()

        site_config = await _run_db(_get_config)

        # 1.1.1.1 → IPinfo: Cloudflare Inc., San Francisco, US, domain=cloudflare.com
        ip = "1.1.1.1"
        logger.info("test-hit: user=%s org=%s using IP %s", current_user.id, site_config.org_id, ip)

        from app.tasks.visitors import _process_visitor_data
        payload = {
            "ip": ip,
            "url": "http://localhost:3000/pricing",
            "referrer": "https://google.com",
            "user_agent": request.headers.get("user-agent", "Outmate-Test"),
            "intent_score": 1.0,
        }
        asyncio.create_task(_process_visitor_data(str(site_config.org_id), payload))
        return {"status": "queued", "ip": ip, "message": f"Test visit queued for IP {ip} — refresh in a few seconds"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("test-hit error: %s", e)
        return JSONResponse(status_code=500, content={"error": str(e)})


@public_router.get("/pixel.js")
async def get_pixel():
    """Serves the tracking pixel JavaScript."""
    import os
    from fastapi.responses import FileResponse
    # Use path relative to this file's directory: app/api/routes -> ../../static/pixel.js
    pixel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../static/pixel.js"))
    
    if not os.path.exists(pixel_path):
        logger.error(f"pixel.js not found at {pixel_path}")
        return JSONResponse(status_code=404, content={"error": "pixel.js not found"})
        
    return FileResponse(pixel_path, media_type="application/javascript")


@public_router.post("/track")
async def track_visitor(request: Request):
    """
    Robust tracking endpoint that accepts both Form and JSON data
    delivered via various cross-origin methods.
    """
    try:
        # 1. Extract Headers
        user_agent = request.headers.get("user-agent", "Unknown")
        x_forwarded_for = request.headers.get("x-forwarded-for")
        x_pixel_key = request.headers.get("x-pixel-key")
        
        # 2. Extract Body (Ultra-Robust Combined Extraction)
        data = {}
        
        # Priority 1: Query Parameters (easy to parse, impossible to fail)
        data.update(dict(request.query_params))
        
        # Priority 2: JSON Body
        try:
            json_data = await request.json()
            if isinstance(json_data, dict):
                data.update(json_data)
        except Exception:
            pass
            
        # Priority 3: Form Data (if not already handled by JSON)
        try:
            form_data = await request.form()
            if form_data:
                data.update(dict(form_data))
        except Exception:
            pass

        # 3. Consolidate Fields and Aliases
        url = data.get("url") or data.get("page_url") or data.get("URL")
        pixel_key = data.get("pixel_key") or x_pixel_key or data.get("pixelKey") or data.get("key")
        email = data.get("email")
        referrer = data.get("referrer") or data.get("ref") or data.get("Ref")

        if not url:
            # If still missing, we return a detailed debug error
            return JSONResponse(
                status_code=400, 
                content={
                    "error": "Missing url", 
                    "received_keys": list(data.keys()),
                    "content_type": request.headers.get("content-type")
                }
            )
        if not pixel_key:
            return JSONResponse(status_code=400, content={"error": "Missing pixel key"})
        
        # 5. Validate Pixel Key
        def _validate_key():
            db = SessionLocal()
            try:
                return db.query(SiteConfig).filter(SiteConfig.pixel_key == pixel_key).first()
            finally:
                db.close()
        
        site_config = await _run_db(_validate_key)
        if not site_config:
            return JSONResponse(status_code=401, content={"error": "Invalid pixel key"})

        # 5. Geolocation / IP
        ip = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else (request.client.host if request.client else "127.0.0.1")
        
        # 6. Intent Score
        intent_score = 1.0 if any(x in url.lower() for x in ["/pricing", "/demo", "/contact", "/signup", "/book"]) else 0.5
        
        # 7. Redis Deduplication (Skip if identified)
        if not email:
            try:
                dedupe_seconds = settings.VISITOR_DEDUPE_SECONDS
                if dedupe_seconds > 0:
                    redis_client = RedisManager.get_client()
                    if redis_client is not None:
                        domain = urlparse(url).netloc
                        dedupe_key = f"visits:{site_config.org_id}:{ip}:{domain}"
                        if await redis_client.get(dedupe_key):
                            return {"status": "deduplicated"}
                        await redis_client.setex(dedupe_key, dedupe_seconds, "1")
            except Exception as e:
                logger.warning(f"Redis deduplication failed: {e}")

        # 8. Process Visitor (Async via Celery)
        from app.tasks.visitors import process_visitor_task, _process_visitor_data
        
        payload = {
            "ip": ip,
            "url": url,
            "referrer": referrer,
            "user_agent": user_agent,
            "intent_score": intent_score,
            "email": email,
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


@router.get("")   # matches /api/v1/visitors  (Next.js proxy strips trailing slash)
@router.get("/")  # matches /api/v1/visitors/ (direct calls)
async def list_visitors(limit: int = 100, current_user: User = Depends(get_current_user)):
    """Get recent visits scoped to the authenticated user's org."""
    org_id = current_user.id
    try:
        def _query():
            db = SessionLocal()
            try:
                visits = (
                    db.query(Visit)
                    .filter(Visit.org_id == org_id)
                    .order_by(Visit.created_at.desc())
                    .limit(limit)
                    .all()
                )
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
async def get_visitor_stats(current_user: User = Depends(get_current_user)):
    """Get visitor stats scoped to the authenticated user's org."""
    org_id = current_user.id
    try:
        def _query():
            db = SessionLocal()
            try:
                total = db.query(Visit).filter(Visit.org_id == org_id).count()
                matched = db.query(Visit).filter(Visit.org_id == org_id, Visit.matched == True).count()
                recent = (
                    db.query(Visit.resolution)
                    .filter(Visit.org_id == org_id)
                    .order_by(Visit.created_at.desc())
                    .limit(2000)
                    .all()
                )
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
async def get_visitor_analytics(
    hours: int = 24,
    live_window_minutes: int = 5,
    top_n: int = 10,
    current_user: User = Depends(get_current_user),
):
    """
    Visitor analytics for charts on the Visitors page.
    - hours ≤ 48  → hourly timeseries buckets
    - hours > 48  → daily timeseries buckets (supports up to 31 days / 744 hours)
    Returns 503 if database is unavailable.
    """
    hours = max(1, min(int(hours), 744))   # 1h..31d
    live_window_minutes = max(1, min(int(live_window_minutes), 60))
    top_n = max(3, min(int(top_n), 50))
    use_daily = hours > 48                 # daily buckets for 7d / 30d views
    org_id = current_user.id
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)
    live_since = now - timedelta(minutes=live_window_minutes)

    try:
        def _query():
            db = SessionLocal()
            try:
                rows = (
                    db.query(
                        Visit.created_at, Visit.ip, Visit.url, Visit.referrer,
                        Visit.intent_score, Visit.matched, Visit.resolution, Visit.user_agent,
                    )
                    .filter(Visit.org_id == org_id, Visit.created_at >= since)
                    .order_by(Visit.created_at.desc())
                    .limit(50000)
                    .all()
                )

                live_ips = set()
                buckets = defaultdict(lambda: {"total": 0, "matched": 0, "company": 0, "prospect": 0, "unknown": 0})
                page_counts = Counter()
                ref_counts = Counter()
                intent_buckets = Counter({"0-49": 0, "50-69": 0, "70-84": 0, "85-100": 0})
                geo_country = Counter()
                geo_city = Counter()
                industry_counts = Counter()
                tech_counts = Counter()
                total = matched_count = company_count = prospect_count = 0

                for created_at, ip, url, ref, intent, matched, res, ua in rows:
                    if not created_at:
                        continue

                    # Bucket key: daily (YYYY-MM-DD) or hourly (YYYY-MM-DDTHH:00:00)
                    if use_daily:
                        bucket_key = created_at.strftime("%Y-%m-%d")
                    else:
                        bucket_key = created_at.replace(minute=0, second=0, microsecond=0).isoformat()

                    res = res or {}
                    cat = (res.get("category") or "unknown").lower()
                    if cat not in ("company", "prospect", "unknown"):
                        cat = "unknown"

                    buckets[bucket_key]["total"] += 1
                    total += 1
                    if matched:
                        buckets[bucket_key]["matched"] += 1
                        matched_count += 1
                    buckets[bucket_key][cat] += 1
                    if cat == "company":
                        company_count += 1
                    elif cat == "prospect":
                        prospect_count += 1

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

                    # Geo breakdown
                    geo = res.get("geo") or {}
                    country = geo.get("country") or (res.get("explorium") or {}).get("headquarters_country")
                    city = geo.get("city") or (res.get("explorium") or {}).get("headquarters_city")
                    if country:
                        geo_country[country] += 1
                    if city and country:
                        geo_city[f"{city}, {country}"] += 1

                    # Industry breakdown (from Explorium)
                    exp = res.get("explorium") or {}
                    industry = exp.get("industry") or exp.get("linkedin_industry_category")
                    if industry:
                        industry_counts[industry] += 1

                    # Technology breakdown
                    for tech in (exp.get("technologies") or [])[:5]:
                        tech_counts[tech] += 1

                timeseries = [
                    {
                        "bucket": k,
                        "total": v["total"],
                        "matched": v["matched"],
                        "company": v["company"],
                        "prospect": v["prospect"],
                        "unknown": v["unknown"],
                    }
                    for k, v in sorted(buckets.items(), key=lambda kv: kv[0])
                ]

                return {
                    "window": {"hours": hours, "since": since.isoformat(), "use_daily": use_daily},
                    "live": {"window_minutes": live_window_minutes, "unique_ips": len(live_ips)},
                    "summary": {
                        "total": total,
                        "matched": matched_count,
                        "companies": company_count,
                        "prospects": prospect_count,
                        "match_rate": round(matched_count / total * 100, 1) if total else 0,
                    },
                    "timeseries": timeseries,
                    "top_pages": [{"page": p, "count": c} for p, c in page_counts.most_common(top_n)],
                    "top_referrers": [{"referrer": r, "count": c} for r, c in ref_counts.most_common(top_n)],
                    "intent_distribution": [{"bucket": b, "count": c} for b, c in intent_buckets.items()],
                    "geo_countries": [{"country": c, "count": n} for c, n in geo_country.most_common(top_n)],
                    "geo_cities": [{"city": c, "count": n} for c, n in geo_city.most_common(top_n)],
                    "industry_breakdown": [{"industry": i, "count": n} for i, n in industry_counts.most_common(top_n)],
                    "top_technologies": [{"tech": t, "count": n} for t, n in tech_counts.most_common(top_n)],
                }
            finally:
                db.close()

        return await _run_db(_query)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


@public_router.get("/stream")
async def stream_visitors(request: Request, org_id: str = "all", token: Optional[str] = Query(None)):
    """
    Server-Sent Events stream for realtime visitor updates.
    Accepts JWT via ?token= query param (EventSource cannot send headers).
    Requires Redis (pubsub); if unavailable responds with 503.
    """
    # Validate JWT — accept via query param (EventSource) or Authorization header
    raw_token = token or request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not raw_token:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})
    try:
        payload_data = pyjwt.decode(raw_token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id_from_token = payload_data.get("sub")
    except pyjwt.ExpiredSignatureError:
        return JSONResponse(status_code=401, content={"error": "Token expired"})
    except pyjwt.PyJWTError:
        return JSONResponse(status_code=401, content={"error": "Invalid token"})

    # Scope channel to authenticated user's org — prevents cross-tenant SSE leakage
    # (org_id query param is kept for backwards compat but overridden by token sub)
    scoped_org_id = user_id_from_token or org_id

    try:
        redis_client = RedisManager.get_client()
        await redis_client.ping()
    except Exception as exc:
        logger.error(f"Redis unavailable for stream: {exc}")
        return JSONResponse(status_code=503, content={
            "error": "Realtime stream unavailable - Redis connection failed."
        })

    channel = f"visitors:{scoped_org_id}"
    pubsub = redis_client.pubsub()

    async def event_generator():
        try:
            await pubsub.subscribe(channel)
            yield f": subscribed {channel}\n\n"
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                if message and message.get("type") == "message":
                    data = message.get("data")
                    if data is not None:
                        yield f"data: {data}\n\n"
                else:
                    yield ": heartbeat\n\n"
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Error in SSE generator: {e}")
            yield f"event: error\ndata: {str(e)}\n\n"
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disables nginx/Azure front-door buffering
            "Connection": "keep-alive",
        },
    )