from fastapi import APIRouter, Header, Form, HTTPException, Request, Query, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.exc import OperationalError
from urllib.parse import urlparse
import logging
import asyncio
import httpx
import jwt as pyjwt
import secrets
import io
import csv
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
from pydantic import BaseModel, Field

import uuid as _uuid

from app.core.config import settings
from app.db.session import SessionLocal
from app.core.redis import RedisManager
from app.db.models.visitor import SiteConfig, Visit
from app.db.models.company_resolution_alias import CompanyResolutionAlias
from app.db.models.user import User
from app.api.deps.auth import get_current_user

# ── Default test SiteConfig ──────────────────────────────────────────────────
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
    """
    cfg = db.query(SiteConfig).filter(SiteConfig.org_id == user_id).first()
    if not cfg:
        pixel_key = "pk_" + secrets.token_hex(16)
        webhook_secret = secrets.token_hex(32)  # 64-char hex HMAC secret
        cfg = SiteConfig(org_id=user_id, pixel_key=pixel_key, domain="", webhook_secret=webhook_secret)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
        logger.info("Created SiteConfig for user %s (pixel_key=%s)", user_id, pixel_key)
    elif not cfg.webhook_secret:
        # Backfill missing secret for existing configs
        cfg.webhook_secret = secrets.token_hex(32)
        db.commit()
    return cfg


# public_router: no JWT required — tracking pixel and pixel.js
public_router = APIRouter(prefix="/api/v1/visitors", tags=["visitors"])

# router: JWT required — dashboard UI
router = APIRouter(prefix="/api/v1/visitors", tags=["visitors"])

logger = logging.getLogger(__name__)

_db_executor = ThreadPoolExecutor(max_workers=4)
DB_TIMEOUT = 15  # seconds

# ── Intent scoring signals ────────────────────────────────────────────────────
_HIGH_INTENT_PATHS = {
    "/pricing", "/demo", "/contact", "/signup", "/book",
    "/get-started", "/trial", "/checkout", "/buy", "/upgrade",
    "/schedule", "/request", "/start", "/register",
}
_MED_INTENT_PATHS = {
    "/features", "/product", "/solutions", "/use-cases",
    "/case-studies", "/customers", "/about", "/integrations",
}


def _compute_intent_score(url: str) -> float:
    """
    Multi-signal intent scoring (0.0 – 1.0).
    High-intent pages → 1.0, medium-intent → 0.7, else → 0.5.
    """
    if not url:
        return 0.5
    try:
        path = urlparse(url).path.lower()
    except Exception:
        path = url.lower()

    for segment in _HIGH_INTENT_PATHS:
        if segment in path:
            return 1.0
    for segment in _MED_INTENT_PATHS:
        if segment in path:
            return 0.7
    return 0.5


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
    exp = res.get("explorium") or {}
    person_resolution = res.get("person_resolution") or {}
    person_identification = res.get("person_identification") or {}
    journey_sequence = res.get("journey_sequence") or {}
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
        "company": res.get("company") or exp.get("name"),
        "domain": res.get("domain") or exp.get("domain"),
        "website": exp.get("website") or res.get("website"),
        "geo": res.get("geo"),
        "confidence": res.get("confidence", 0),
        "person_resolution_status": person_resolution.get("status"),
        "person_resolution_confidence": person_resolution.get("confidence"),
        "person_identification_status": person_identification.get("status"),
        "person_identification_method": person_identification.get("method"),
        "sequence_type": journey_sequence.get("sequence_type"),
        "sequence_score": journey_sequence.get("sequence_score"),
        "account_stage": person_resolution.get("account_stage"),
        "account_score": person_resolution.get("account_score"),
        "account_role_coverage": person_resolution.get("account_role_coverage") or [],
        "account_unique_visitor_count": person_resolution.get("account_unique_visitor_count"),
        "predicted_person": res.get("predicted_person"),
        "person_resolution": person_resolution,
        "email": res.get("email") or person.get("email"),
        "phone": res.get("phone") or person.get("phone") or exp.get("phone"),
        "full_name": res.get("full_name") or person.get("full_name") or person.get("name"),
        "linkedin_url": res.get("linkedin_url") or person.get("linkedin_url") or person.get("linkedin"),
        "job_title": res.get("job_title") or person.get("title") or person.get("job_title"),
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
        # Which customer site this visit came from (set at track time from SiteConfig.domain)
        "source_site": res.get("source_site") or "",
        "enrichment_status": v.enrichment_status,
    }


class ServerIdentityEventRequest(BaseModel):
    visitor_id: Optional[str] = None
    session_id: Optional[str] = None
    event_source: str = Field(default="server")
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    domain: Optional[str] = None
    linkedin_url: Optional[str] = None
    ip: Optional[str] = None


class CompanyAliasRequest(BaseModel):
    match_type: str
    match_value: str
    canonical_company: Optional[str] = None
    canonical_domain: Optional[str] = None
    confidence_boost: int = 10
    notes: Optional[str] = None
    metadata_json: dict = Field(default_factory=dict)


# ── Rate limiting helpers ─────────────────────────────────────────────────────

async def _check_track_rate_limit(ip: str, pixel_key: str) -> bool:
    """
    Returns True (allow), False (rate-limited).
    Limits: 30 req/min per IP, 1000 req/min per pixel_key.
    Uses Redis sliding-window counters (INCR + EXPIRE).
    """
    try:
        redis_client = RedisManager.get_client()
        if redis_client is None:
            return True  # Redis unavailable — allow through

        window = 60  # seconds
        ip_key = f"rl:track:ip:{ip}"
        pk_key = f"rl:track:pk:{pixel_key}"

        pipe = redis_client.pipeline()
        pipe.incr(ip_key)
        pipe.expire(ip_key, window)
        pipe.incr(pk_key)
        pipe.expire(pk_key, window)
        results = await pipe.execute()

        ip_count = results[0]
        pk_count = results[2]

        if ip_count > 30:
            logger.warning("Rate limit hit: IP %s (%d req/min)", ip, ip_count)
            return False
        if pk_count > 1000:
            logger.warning("Rate limit hit: pixel_key %s (%d req/min)", pixel_key, pk_count)
            return False
        return True
    except Exception as e:
        logger.warning("Rate limit check failed (allowing): %s", e)
        return True  # Fail open — don't block on Redis error


# ── Public Routes ─────────────────────────────────────────────────────────────

@public_router.get("/pixel.js")
async def get_pixel():
    """Serves the tracking pixel JavaScript."""
    import os
    from fastapi.responses import FileResponse
    pixel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../static/pixel.js"))
    if not os.path.exists(pixel_path):
        logger.error("pixel.js not found at %s", pixel_path)
        return JSONResponse(status_code=404, content={"error": "pixel.js not found"})
    return FileResponse(pixel_path, media_type="application/javascript")


@public_router.post("/track")
async def track_visitor(request: Request):
    """
    Public tracking endpoint — accepts JSON, form-data, or query params.
    Rate limited: 30 req/min per IP, 1000 req/min per pixel_key.
    """
    try:
        user_agent = request.headers.get("user-agent", "Unknown")
        x_forwarded_for = request.headers.get("x-forwarded-for")
        x_pixel_key = request.headers.get("x-pixel-key")

        # Extract body — query params, then JSON, then form (priority order)
        data: dict = {}
        data.update(dict(request.query_params))
        try:
            json_data = await request.json()
            if isinstance(json_data, dict):
                data.update(json_data)
        except Exception:
            pass
        try:
            form_data = await request.form()
            if form_data:
                data.update(dict(form_data))
        except Exception:
            pass

        url = data.get("url") or data.get("page_url") or data.get("URL")
        pixel_key = data.get("pixel_key") or x_pixel_key or data.get("pixelKey") or data.get("key")
        email = data.get("email") or None
        referrer = data.get("referrer") or data.get("ref") or data.get("Ref")
        visitor_id = data.get("visitor_id")
        action = data.get("action") or "pageview"
        dwell_time = data.get("dwell_time")

        if not url:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing url", "received_keys": list(data.keys())}
            )
        if not pixel_key:
            return JSONResponse(status_code=400, content={"error": "Missing pixel key"})

        # Validate pixel key
        def _validate_key():
            db = SessionLocal()
            try:
                return db.query(SiteConfig).filter(SiteConfig.pixel_key == pixel_key).first()
            finally:
                db.close()

        site_config = await _run_db(_validate_key)
        if not site_config:
            return JSONResponse(status_code=401, content={"error": "Invalid pixel key"})

        # Extract real IP — check all proxy headers in priority order
        def _first_real_ip(raw: Optional[str]) -> Optional[str]:
            if not raw:
                return None
            val = raw.split(",")[0].strip()
            return val if val not in ("127.0.0.1", "::1", "localhost", "") else None

        ip = (
            _first_real_ip(request.headers.get("cf-connecting-ip"))      # Cloudflare
            or _first_real_ip(request.headers.get("x-real-ip"))          # nginx / Next.js proxy route
            or _first_real_ip(x_forwarded_for)                           # standard
            or (request.client.host if request.client else "127.0.0.1")
        )

        # GDPR opt-out check
        visitor_id_for_optout = data.get("visitor_id")
        if visitor_id_for_optout:
            try:
                rc = RedisManager.get_client()
                if rc and await rc.get(f"optout:{visitor_id_for_optout}"):
                    return {"status": "opted_out"}
            except Exception:
                pass

        # Rate limiting (after pixel key validated, before enrichment)
        if not await _check_track_rate_limit(ip, pixel_key):
            return JSONResponse(
                status_code=429,
                content={"error": "Too many requests"},
                headers={"Retry-After": "60"},
            )

        intent_score = _compute_intent_score(url)

        # Redis deduplication (skip for identified visitors).
        # Keyed on (org, fingerprint-or-ip, url) so a page reload on the same
        # URL within the dedupe window collapses, but navigation to a different
        # URL or a reload after the window register as new visits.
        if not email:
            try:
                dedupe_seconds = settings.VISITOR_DEDUPE_SECONDS
                if dedupe_seconds > 0:
                    redis_client = RedisManager.get_client()
                    if redis_client is not None:
                        fp = data.get("fp")
                        identity_token = fp or ip
                        dedupe_key = f"visits:{site_config.org_id}:{identity_token}:{url}"
                        if await redis_client.get(dedupe_key):
                            return {"status": "deduplicated"}
                        await redis_client.setex(dedupe_key, dedupe_seconds, "1")
            except Exception as e:
                logger.warning("Redis deduplication failed: %s", e)

        from app.tasks.visitors import process_visitor_task, _process_visitor_data

        payload = {
            "action": action,
            "dwell_time": dwell_time,
            "ip": ip,
            "url": url,
            "referrer": referrer,
            "user_agent": user_agent,
            "intent_score": intent_score,
            "email": email,
            "visitor_id": visitor_id,
            "fp": data.get("fp"),
            "viewport_w": data.get("viewport_w"),
            "viewport_h": data.get("viewport_h"),
            "scroll_depth": data.get("scroll_depth"),
            "cta_clicks": data.get("cta_clicks"),
            "session_id": data.get("session_id"),
            "active_ms": data.get("active_ms"),
            "outbound_clicks": data.get("outbound_clicks"),
            "last_outbound_domain": data.get("last_outbound_domain"),
            "page_type": data.get("page_type"),
            "form_stage": data.get("form_stage"),
            "form_fields": data.get("form_fields"),
            "identity_traits": data.get("identity_traits") if isinstance(data.get("identity_traits"), dict) else {
                "email": data.get("email"),
                "first_name": data.get("first_name"),
                "last_name": data.get("last_name"),
                "full_name": data.get("full_name"),
                "job_title": data.get("job_title"),
                "company_name": data.get("company_name"),
                "linkedin_url": data.get("linkedin_url"),
            },
            # Pixel owner's domain — used to label visit source when company
            # cannot be identified from IP enrichment alone.
            "source_site": site_config.domain or "",
        }

        # In dev/single-process deployments (no Celery worker), process inline so
        # visits actually persist instead of piling up in the broker queue forever.
        # Production sets VISITOR_TRACKING_INLINE=False and runs a separate worker.
        if settings.VISITOR_TRACKING_INLINE:
            queued_via = "inline"
            asyncio.create_task(_process_visitor_data(str(site_config.org_id), payload))
        else:
            queued_via = "celery"
            try:
                process_visitor_task.delay(str(site_config.org_id), payload)
            except Exception as e:
                logger.warning("Celery unavailable, processing inline: %s", e)
                queued_via = "inline"
                asyncio.create_task(_process_visitor_data(str(site_config.org_id), payload))

        # Update real-time active visitor counter (Redis sorted set, 30-min window)
        try:
            redis_client = RedisManager.get_client()
            if redis_client:
                rt_key = f"outmate:visitors:active:{site_config.org_id}"
                now_ts = datetime.now(timezone.utc).timestamp()
                await redis_client.zadd(rt_key, {ip: now_ts})
                await redis_client.expire(rt_key, 1800)  # 30 min TTL on entire key
        except Exception as e:
            logger.debug("Real-time counter update failed: %s", e)

        logger.info("Visitor tracked: %s for org %s", ip, site_config.org_id)
        return {"status": "queued", "queued_via": queued_via}

    except HTTPException:
        raise
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})
    except Exception as e:
        logger.error("Error in /track: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.post("/sse-token")
async def issue_sse_token(current_user: User = Depends(get_current_user)):
    """
    Issue a short-lived SSE exchange token (60s TTL).

    The SSE stream endpoint must NOT receive the main JWT in a URL query param
    because URLs are logged by proxies, load balancers, and browser history.
    Instead the frontend calls this endpoint (Bearer header = safe), receives a
    short opaque token, and passes that in ?token= to the stream URL.

    Token lifecycle:
      1. POST /sse-token  → returns {"sse_token": "<32-byte hex>", "expires_in": 60}
      2. Frontend opens   EventSource("/stream?token=<sse_token>") immediately
      3. Backend checks   Redis key  sse_token:{token}  → org_id (TTL=60s)
      4. Token is consumed on first successful stream connection (single-use)
    """
    token = secrets.token_hex(32)  # 64-char opaque hex
    org_id = str(current_user.id)
    try:
        redis_client = RedisManager.get_client()
        await redis_client.setex(f"sse_token:{token}", 60, org_id)
    except Exception as exc:
        logger.error("Cannot issue SSE token — Redis unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Realtime stream temporarily unavailable")
    logger.info("SSE exchange token issued for org=%s (60s TTL)", org_id)
    return {"sse_token": token, "expires_in": 60}


@public_router.get("/stream")
async def stream_visitors(request: Request, org_id: str = "all", token: Optional[str] = Query(None)):
    """
    Server-Sent Events stream for real-time visitor updates.

    Authentication (two accepted paths):
      1. Short-lived SSE exchange token via ?token=  (preferred — obtained from POST /sse-token)
         Stored in Redis as sse_token:{token} → org_id.  Single-use, 60s TTL.
      2. Main JWT via ?token= (legacy fallback — still supported for now)

    EventSource cannot send custom headers so query param is unavoidable here.
    The exchange token limits exposure: it is opaque, single-use, and expires in 60s.
    """
    raw_token = token or request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if not raw_token:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})

    scoped_org_id: Optional[str] = None

    # Path 1: Try SSE exchange token first (preferred — short-lived, opaque)
    try:
        redis_client = RedisManager.get_client()
        sse_org = await redis_client.get(f"sse_token:{raw_token}")
        if sse_org:
            # Single-use: delete immediately after first connection
            await redis_client.delete(f"sse_token:{raw_token}")
            scoped_org_id = sse_org if isinstance(sse_org, str) else sse_org.decode()
            logger.info("SSE exchange token accepted for org=%s", scoped_org_id)
    except Exception:
        pass  # Redis unavailable — fall through to JWT path

    # Path 2: Fallback to main JWT validation
    if not scoped_org_id:
        try:
            payload_data = pyjwt.decode(raw_token, settings.JWT_SECRET, algorithms=["HS256"])
            scoped_org_id = payload_data.get("sub")
        except pyjwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"error": "Token expired"})
        except pyjwt.PyJWTError:
            return JSONResponse(status_code=401, content={"error": "Invalid token"})

    if not scoped_org_id:
        return JSONResponse(status_code=401, content={"error": "Could not resolve org from token"})

    try:
        redis_client = RedisManager.get_client()
        await redis_client.ping()
    except Exception as exc:
        logger.error("Redis unavailable for stream: %s", exc)
        return JSONResponse(status_code=503, content={"error": "Realtime stream unavailable — Redis connection failed."})

    channel = f"visitors:{scoped_org_id}"

    async def event_generator():
        pubsub = None
        reconnect_delay = 1.0

        while True:
            try:
                # (Re)connect Redis and subscribe
                rc = RedisManager.get_client()
                pubsub = rc.pubsub()
                await pubsub.subscribe(channel)
                yield f": subscribed {channel}\n\n"
                reconnect_delay = 1.0  # reset backoff on successful connect

                while True:
                    if await request.is_disconnected():
                        return
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                    if message and message.get("type") == "message":
                        data = message.get("data")
                        if data is not None:
                            yield f"data: {data}\n\n"
                    else:
                        yield ": heartbeat\n\n"
                    await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                return
            except Exception as e:
                logger.warning("SSE Redis connection lost (%s) — reconnecting in %.0fs", e, reconnect_delay)
                # Reset the singleton so next get_client() creates a fresh connection
                RedisManager.reset()
                yield f": reconnecting\n\n"
            finally:
                if pubsub is not None:
                    try:
                        await pubsub.unsubscribe(channel)
                        await pubsub.aclose()
                    except Exception:
                        pass
                    pubsub = None

            # Exponential backoff before reconnect (cap at 30s)
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 30.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Authenticated Routes ──────────────────────────────────────────────────────

@router.get("/site-config")
async def get_site_config(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's SiteConfig. Auto-creates if missing."""
    def _get():
        db = SessionLocal()
        try:
            cfg = _get_or_create_site_config(db, current_user.id)
            return {
                "org_id": str(cfg.org_id),
                "pixel_key": cfg.pixel_key,
                "domain": cfg.domain or "",
                "webhook_urls": cfg.webhook_urls or [],
                "webhook_secret": cfg.webhook_secret or "",
                "icp_filters": cfg.icp_filters or {},
                "isp_allowlist": cfg.isp_allowlist or [],
                "anonymize_ips": cfg.anonymize_ips or False,
                "gdpr_mode": cfg.gdpr_mode or False,
                "created_at": cfg.created_at.isoformat() if cfg.created_at else None,
            }
        finally:
            db.close()

    try:
        return await _run_db(_get)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


@router.post("/site-config")
async def update_site_config(request: Request, current_user: User = Depends(get_current_user)):
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
    Uses the caller's real IP address so enrichment returns real data.
    Accepts optional { "ip": "x.x.x.x" } in the body to override IP detection
    (needed when Next.js rewrites proxy the request via localhost).
    """
    try:
        def _get_config():
            db = SessionLocal()
            try:
                return _get_or_create_site_config(db, current_user.id)
            finally:
                db.close()

        site_config = await _run_db(_get_config)

        # IP resolution — check all sources in priority order:
        # 1. Body IP override (sent by Next.js proxy route in local dev)
        # 2. CF-Connecting-IP (Cloudflare)
        # 3. X-Real-IP (nginx / Next.js proxy route)
        # 4. X-Forwarded-For (standard)
        # 5. Socket connection IP (fallback)
        body_ip: Optional[str] = None
        try:
            body = await request.json()
            body_ip = (body.get("ip") or "").strip() or None
        except Exception:
            pass

        def _first_real(raw: Optional[str]) -> Optional[str]:
            if not raw:
                return None
            ip_val = raw.split(",")[0].strip()
            return ip_val if ip_val not in ("127.0.0.1", "::1", "localhost", "") else None

        ip = (
            body_ip
            or _first_real(request.headers.get("cf-connecting-ip"))
            or _first_real(request.headers.get("x-real-ip"))
            or _first_real(request.headers.get("x-forwarded-for"))
            or (request.client.host if request.client else "127.0.0.1")
        )
        logger.info("test-hit: body_ip=%s x-real-ip=%s x-forwarded-for=%s using=%s",
                    body_ip,
                    request.headers.get("x-real-ip"),
                    request.headers.get("x-forwarded-for"),
                    ip)

        from app.tasks.visitors import _process_visitor_data
        payload = {
            "ip": ip,
            "url": "https://app.outmate.ai/pricing",
            "referrer": "https://google.com",
            "user_agent": request.headers.get("user-agent", "Outmate-Test"),
            "intent_score": 1.0,
            # No email — enrichment must resolve company/person from IP alone
        }
        asyncio.create_task(_process_visitor_data(str(site_config.org_id), payload))
        return {"status": "queued", "ip": ip, "message": f"Test visit queued for IP {ip} — refresh in a few seconds"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("test-hit error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.post("/identify")
async def identify_visitor_server_side(
    body: ServerIdentityEventRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Server-side deterministic identity stitching for forms/chat/calendar/app-login.
    Applies first-party identity to existing visits without creating a new visit row.
    """
    try:
        from app.tasks.visitors import apply_identity_event

        payload = {
            "visitor_id": body.visitor_id,
            "session_id": body.session_id,
            "ip": body.ip,
            "domain": body.domain,
            "company": body.company_name,
            "linkedin_url": body.linkedin_url,
            "identity_traits": {
                "email": body.email,
                "first_name": body.first_name,
                "last_name": body.last_name,
                "full_name": body.full_name,
                "job_title": body.job_title,
                "company_name": body.company_name,
                "linkedin_url": body.linkedin_url,
                "event_source": body.event_source,
            },
        }
        result = await apply_identity_event(str(current_user.id), payload)
        return result
    except Exception as e:
        logger.error("identify_visitor_server_side error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.get("/company-aliases")
async def list_company_aliases(current_user: User = Depends(get_current_user)):
    def _list():
        db = SessionLocal()
        try:
            rows = (
                db.query(CompanyResolutionAlias)
                .order_by(CompanyResolutionAlias.updated_at.desc())
                .limit(200)
                .all()
            )
            return [
                {
                    "id": str(row.id),
                    "match_type": row.match_type,
                    "match_value": row.match_value,
                    "canonical_company": row.canonical_company,
                    "canonical_domain": row.canonical_domain,
                    "confidence_boost": row.confidence_boost,
                    "is_active": row.is_active,
                    "notes": row.notes,
                    "metadata_json": row.metadata_json or {},
                }
                for row in rows
            ]
        finally:
            db.close()
    try:
        return {"aliases": await _run_db(_list)}
    except Exception as e:
        logger.error("list_company_aliases error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.get("/detail/{visitor_id}")
async def get_visitor_detail(visitor_id: str, current_user: User = Depends(get_current_user)):
    """Get a single visitor by ID, scoped to the current user's org."""
    def _find():
        db = SessionLocal()
        try:
            v = (
                db.query(Visit)
                .filter(Visit.id == visitor_id, Visit.org_id == current_user.id)
                .first()
            )
            if not v:
                return None
            return _visit_to_dict(v)
        finally:
            db.close()

    visitor = await _run_db(_find)
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return visitor


@router.get("/first-success")
async def get_first_success_visitor(current_user: User = Depends(get_current_user)):
    """
    Find the first corporate visitor for the user's pixel. 
    Triggers an email on the first discovery.
    If none found, returns a 'waiting' state.
    """
    def _find():
        db = SessionLocal()
        try:
            # Look for identified companies with intent
            v = (
                db.query(Visit)
                .filter(Visit.org_id == current_user.id)
                .filter(Visit.matched == True)
                .order_by(Visit.created_at.desc())
                .first()
            )
            if not v:
                return None
            return _visit_to_dict(v)
        finally:
            db.close()

    visitor = await _run_db(_find)
    
    if visitor:
        # Check if we should send email (idempotent via Redis or User flag)
        # For simplicity, we trigger it if onboarding is not yet finished
        if not current_user.onboarding_completed:
            from app.services.email import send_first_visitor_alert
            # Check if alert already sent in last 24h
            try:
                rc = RedisManager.get_client()
                sent_key = f"first_visitor_email_sent:{current_user.id}"
                if rc and not await rc.get(sent_key):
                    await send_first_visitor_alert(
                        to_email=current_user.email,
                        company_name=visitor.get("company", "A new company"),
                        domain=visitor.get("domain", ""),
                        score=int(visitor.get("intent_score", 0.5) * 100),
                        visitor_name=visitor.get("full_name"),
                        visitor_id=visitor.get("id"),
                    )
                    await rc.setex(sent_key, 86400, "1")
            except Exception:
                pass
                
        return {"status": "success", "visitor": visitor}

    return {"status": "waiting"}


@router.post("/company-aliases")
async def create_company_alias(
    body: CompanyAliasRequest,
    current_user: User = Depends(get_current_user),
):
    def _create():
        db = SessionLocal()
        try:
            match_type = body.match_type.strip().lower()
            match_value = body.match_value.strip().lower()
            alias = (
                db.query(CompanyResolutionAlias)
                .filter(
                    CompanyResolutionAlias.match_type == match_type,
                    CompanyResolutionAlias.match_value == match_value,
                )
                .first()
            )
            if not alias:
                alias = CompanyResolutionAlias(match_type=match_type, match_value=match_value)
                db.add(alias)
            alias.canonical_company = body.canonical_company
            alias.canonical_domain = (body.canonical_domain or "").strip().lower() or None
            alias.confidence_boost = body.confidence_boost
            alias.notes = body.notes
            alias.metadata_json = body.metadata_json or {}
            alias.is_active = True
            db.commit()
            db.refresh(alias)
            return {
                "id": str(alias.id),
                "match_type": alias.match_type,
                "match_value": alias.match_value,
                "canonical_company": alias.canonical_company,
                "canonical_domain": alias.canonical_domain,
                "confidence_boost": alias.confidence_boost,
                "is_active": alias.is_active,
                "notes": alias.notes,
                "metadata_json": alias.metadata_json or {},
            }
        finally:
            db.close()
    try:
        return {"alias": await _run_db(_create)}
    except Exception as e:
        logger.error("create_company_alias error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.get("")
@router.get("/")
async def list_visitors(
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    matched_only: bool = Query(default=False),
    category: Optional[str] = Query(default=None),
    min_icp_score: Optional[int] = Query(default=None, ge=0, le=100),
    current_user: User = Depends(get_current_user),
):
    """
    Get visits scoped to the authenticated user's org.
    Supports pagination (offset/limit) and optional filtering.
    Returns: { visits, total, has_more, offset, limit }
    """
    org_id = current_user.id
    try:
        def _query():
            db = SessionLocal()
            try:
                from sqlalchemy import cast, Integer
                q = db.query(Visit).filter(Visit.org_id == org_id)
                
                if matched_only:
                    q = q.filter(Visit.matched == True)  # noqa: E712
                    
                if category and category in ("company", "prospect", "unknown"):
                    q = q.filter(Visit.resolution.op("->>")("category") == category)
                    
                if min_icp_score is not None:
                    q = q.filter(cast(Visit.resolution.op("->>")("icp_score"), Integer) >= min_icp_score)

                total = q.count()
                visits = (
                    q.order_by(Visit.created_at.desc())
                    .offset(offset)
                    .limit(limit)
                    .all()
                )
                items = [_visit_to_dict(v) for v in visits]
                
                return {
                    "visits": items,
                    "total": total,
                    "has_more": (offset + limit) < total,
                    "offset": offset,
                    "limit": limit,
                }
            finally:
                db.close()

        return await _run_db(_query)

    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})
    except Exception as e:
        logger.error("list_visitors error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.get("/stats")
async def get_visitor_stats(current_user: User = Depends(get_current_user)):
    """Get visitor stats scoped to the authenticated user's org."""
    org_id = current_user.id
    try:
        def _query():
            db = SessionLocal()
            try:
                total = db.query(Visit).filter(Visit.org_id == org_id).count()
                matched = db.query(Visit).filter(Visit.org_id == org_id, Visit.matched == True).count()  # noqa: E712
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
        logger.error("get_visitor_stats error: %s", e)
        return JSONResponse(status_code=503, content={
            "error": "Internal server error", "total_visits": 0, "matched_visits": 0, "match_rate": 0
        })


@router.get("/export")
async def export_visitors(
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    hours: int = Query(default=168, ge=1, le=744),
    matched_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
):
    """
    Export visits as CSV or JSON.
    - format: "csv" (default) or "json"
    - hours: time window (default 168h = 7 days, max 744h = 31 days)
    - matched_only: only export identified visitors
    """
    org_id = current_user.id
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    try:
        def _query():
            db = SessionLocal()
            try:
                q = db.query(Visit).filter(Visit.org_id == org_id, Visit.created_at >= since)
                if matched_only:
                    q = q.filter(Visit.matched == True)  # noqa: E712
                return [_visit_to_dict(v) for v in q.order_by(Visit.created_at.desc()).limit(10000).all()]
            finally:
                db.close()

        rows = await _run_db(_query)

        if format == "json":
            import json
            content = json.dumps(rows, default=str, indent=2)
            return StreamingResponse(
                iter([content]),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename=visitors_{hours}h.json"},
            )

        # CSV export
        CSV_FIELDS = [
            "id", "created_at", "ip", "url", "referrer", "matched", "category",
            "company", "domain", "industry", "employee_count_range", "revenue_range",
            "funding_stage", "headquarters_city", "headquarters_country",
            "full_name", "email", "phone", "job_title", "linkedin_url",
            "intent_score", "confidence",
        ]

        def _stream_csv():
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, extrasaction="ignore")
            writer.writeheader()
            yield output.getvalue()
            for row in rows:
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, extrasaction="ignore")
                writer.writerow({k: row.get(k, "") for k in CSV_FIELDS})
                yield output.getvalue()

        filename = f"visitors_{hours}h{'_identified' if matched_only else ''}.csv"
        return StreamingResponse(
            _stream_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})
    except Exception as e:
        logger.error("export_visitors error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ── SSE short-lived token exchange — see @router.post("/sse-token") above ─────


# ── GDPR / Privacy endpoints ──────────────────────────────────────────────────

@router.delete("/data/{visitor_id}")
async def gdpr_delete_visitor(
    visitor_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    GDPR right-to-erasure: delete all data for a specific visitor_id.
    Removes matching visits, sessions, identity graph nodes, and Redis caches.
    """
    org_id = current_user.id

    def _delete():
        db = SessionLocal()
        try:
            from sqlalchemy import text
            from app.db.models.identity_graph import IdentityNode
            from app.db.models.visitor import VisitorSession

            # Delete visits for this visitor
            deleted_visits = db.execute(
                text("""
                    DELETE FROM visits
                    WHERE org_id = :org_id
                      AND resolution->>'visitor_id' = :vid
                """),
                {"org_id": str(org_id), "vid": visitor_id},
            ).rowcount

            # Delete sessions
            db.query(VisitorSession).filter(
                VisitorSession.org_id == org_id,
                VisitorSession.visitor_id == visitor_id,
            ).delete(synchronize_session=False)

            # Delete identity graph node
            db.query(IdentityNode).filter(
                IdentityNode.visitor_id == visitor_id
            ).delete(synchronize_session=False)

            db.commit()
            return deleted_visits
        finally:
            db.close()

    try:
        deleted = await _run_db(_delete)

        # Clear Redis caches for this visitor
        try:
            rc = RedisManager.get_client()
            if rc:
                await rc.delete(f"visits:{org_id}:fp:{visitor_id}")
        except Exception:
            pass

        logger.info("[GDPR] Deleted %d visits for visitor_id=%s org=%s", deleted, visitor_id, org_id)
        return {"status": "deleted", "visitor_id": visitor_id, "deleted_visits": deleted}

    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})
    except Exception as e:
        logger.error("GDPR delete error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.post("/gdpr-config")
async def update_gdpr_config(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Update GDPR settings for the org:
      - anonymize_ips: bool  — mask last IP octet before storage
      - gdpr_mode: bool      — enforce visitor opt-out tokens
    """
    body = await request.json()

    def _update():
        db = SessionLocal()
        try:
            cfg = _get_or_create_site_config(db, current_user.id)
            if "anonymize_ips" in body:
                cfg.anonymize_ips = bool(body["anonymize_ips"])
            if "gdpr_mode" in body:
                cfg.gdpr_mode = bool(body["gdpr_mode"])
            if "isp_allowlist" in body and isinstance(body["isp_allowlist"], list):
                cfg.isp_allowlist = [str(k)[:64] for k in body["isp_allowlist"][:20]]
            db.commit()
            return {
                "status": "updated",
                "anonymize_ips": cfg.anonymize_ips,
                "gdpr_mode": cfg.gdpr_mode,
                "isp_allowlist": cfg.isp_allowlist or [],
            }
        finally:
            db.close()

    try:
        return await _run_db(_update)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


@public_router.post("/optout")
async def visitor_optout(request: Request):
    """
    GDPR opt-out endpoint called by pixel.js outmate.optOut().
    Stores the visitor_id in Redis with a long TTL so future track
    calls are silently discarded.
    """
    try:
        data: dict = {}
        try:
            data = await request.json()
        except Exception:
            pass
        visitor_id = data.get("visitor_id") or ""
        if not visitor_id:
            return JSONResponse(status_code=400, content={"error": "Missing visitor_id"})

        rc = RedisManager.get_client()
        if rc:
            # 2 years TTL — long enough to honour the opt-out durably
            await rc.setex(f"optout:{visitor_id}", 365 * 2 * 24 * 3600, "1")

        return {"status": "opted_out"}
    except Exception as e:
        logger.error("Optout error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.get("/analytics")
async def get_visitor_analytics(
    hours: int = 24,
    live_window_minutes: int = 5,
    top_n: int = 10,
    current_user: User = Depends(get_current_user),
):
    """
    Visitor analytics for charts.
    - hours ≤ 48  → hourly buckets
    - hours > 48  → daily buckets (up to 31 days)
    """
    hours = max(1, min(int(hours), 744))
    live_window_minutes = max(1, min(int(live_window_minutes), 60))
    top_n = max(3, min(int(top_n), 50))
    use_daily = hours > 48
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

                live_ips: set = set()
                buckets: dict = defaultdict(lambda: {"total": 0, "matched": 0, "company": 0, "prospect": 0, "unknown": 0})
                page_counts: Counter = Counter()
                ref_counts: Counter = Counter()
                intent_buckets: Counter = Counter({"0-49": 0, "50-69": 0, "70-84": 0, "85-100": 0})
                geo_country: Counter = Counter()
                geo_city: Counter = Counter()
                industry_counts: Counter = Counter()
                tech_counts: Counter = Counter()
                person_resolution_status: Counter = Counter()
                person_identification_status: Counter = Counter()
                sequence_type_counts: Counter = Counter()
                account_stage_counts: Counter = Counter()
                predicted_people = 0
                verified_people = 0
                total = matched_count = company_count = prospect_count = 0

                for created_at, ip, url, ref, intent, matched, res, ua in rows:
                    if not created_at:
                        continue

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

                    geo = res.get("geo") or {}
                    country = geo.get("country") or (res.get("explorium") or {}).get("headquarters_country")
                    city = geo.get("city") or (res.get("explorium") or {}).get("headquarters_city")
                    if country:
                        geo_country[country] += 1
                    if city and country:
                        geo_city[f"{city}, {country}"] += 1

                    exp = res.get("explorium") or {}
                    industry = exp.get("industry") or exp.get("linkedin_industry_category")
                    if industry:
                        industry_counts[industry] += 1
                    for tech in (exp.get("technologies") or [])[:5]:
                        tech_counts[tech] += 1

                    prs = ((res.get("person_resolution") or {}).get("status") or "anonymous").lower()
                    pis = ((res.get("person_identification") or {}).get("status") or "anonymous").lower()
                    seq = ((res.get("journey_sequence") or {}).get("sequence_type") or "unknown").lower()
                    acc_stage = ((res.get("person_resolution") or {}).get("account_stage") or "single_visitor").lower()
                    person_resolution_status[prs] += 1
                    person_identification_status[pis] += 1
                    sequence_type_counts[seq] += 1
                    account_stage_counts[acc_stage] += 1
                    if pis == "verified":
                        verified_people += 1
                    elif pis == "predicted" or prs in {"predicted_high", "predicted_medium"}:
                        predicted_people += 1

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

                # Calculate bounce rate and conversions
                visitor_pageviews = Counter()
                conversions = 0
                for r in rows:
                    res = r.resolution or {}
                    if res.get("visitor_id"):
                        visitor_pageviews[res["visitor_id"]] += 1
                    try:
                        if float(r.intent_score or 0) >= 1.0:
                            conversions += 1
                    except Exception:
                        pass

                total_sessions = len(visitor_pageviews)
                sessions_one_pageview = sum(1 for count in visitor_pageviews.values() if count == 1)
                bounce_rate = round((sessions_one_pageview / total_sessions * 100), 1) if total_sessions > 0 else 0

                return {
                    "window": {"hours": hours, "since": since.isoformat(), "use_daily": use_daily},
                    "live": {"window_minutes": live_window_minutes, "unique_ips": len(live_ips)},
                    "summary": {
                        "total": total,
                        "matched": matched_count,
                        "companies": company_count,
                        "prospects": prospect_count,
                        "match_rate": round(matched_count / total * 100, 1) if total else 0,
                        "bounce_rate": bounce_rate,
                        "total_sessions": total_sessions,
                        "conversions": conversions,
                        "verified_people": verified_people,
                        "predicted_people": predicted_people,
                    },
                    "timeseries": timeseries,
                    "top_pages": [{"page": p, "count": c} for p, c in page_counts.most_common(top_n)],
                    "top_referrers": [{"referrer": r, "count": c} for r, c in ref_counts.most_common(top_n)],
                    "intent_distribution": [{"bucket": b, "count": c} for b, c in intent_buckets.items()],
                    "geo_countries": [{"country": c, "count": n} for c, n in geo_country.most_common(top_n)],
                    "geo_cities": [{"city": c, "count": n} for c, n in geo_city.most_common(top_n)],
                    "industry_breakdown": [{"industry": i, "count": n} for i, n in industry_counts.most_common(top_n)],
                    "top_technologies": [{"tech": t, "count": n} for t, n in tech_counts.most_common(top_n)],
                    "person_resolution_breakdown": [{"status": s, "count": n} for s, n in person_resolution_status.most_common()],
                    "person_identification_breakdown": [{"status": s, "count": n} for s, n in person_identification_status.most_common()],
                    "sequence_breakdown": [{"sequence_type": s, "count": n} for s, n in sequence_type_counts.most_common(top_n)],
                    "account_stage_breakdown": [{"stage": s, "count": n} for s, n in account_stage_counts.most_common(top_n)],
                }
            finally:
                db.close()

        return await _run_db(_query)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})


# ── Account-level intent scores ───────────────────────────────────────────────

@router.get("/accounts")
async def get_account_intent(
    hours: int = Query(default=168, ge=1, le=720),
    min_score: int = Query(default=0, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
):
    """
    Account-Based Marketing view: aggregate intent across ALL visitors from
    the same company domain, giving a single account-level buying signal.

    This is the B2B equivalent of 6sense / Demandbase account scoring:
    a single employee visiting is a weak signal; 5 employees from the same
    company visiting pricing + demo pages is a very strong signal.

    Returns accounts sorted by account_intent_score descending.
    Each account object contains:
      - domain / company name / firmographics
      - total_visits, unique_visitor_count (distinct visitor_ids)
      - peak_engagement_score, avg_icp_score
      - buying_stage_distribution  {"decision": N, "consideration": N, "awareness": N}
      - hot_pages  [list of most-visited pages from this account]
      - last_seen_at
      - account_intent_score  (0–100, composite)
    """
    org_id = current_user.id
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    def _query():
        db = SessionLocal()
        try:
            from sqlalchemy import text as _t
            rows = db.execute(
                _t("""
                    SELECT
                        resolution->>'domain'                         AS domain,
                        resolution->>'company'                        AS company,
                        resolution->>'logo_url'                       AS logo_url,
                        MAX(resolution->'explorium'->'industry')      AS industry,
                        MAX(resolution->'explorium'->'employee_count_range') AS emp_range,
                        COUNT(*)                                      AS total_visits,
                        COUNT(DISTINCT resolution->>'visitor_id')     AS unique_visitors,
                        MAX((resolution->'behavioral'->>'engagement_score')::numeric) AS peak_engagement,
                        AVG((resolution->>'icp_score')::numeric)       AS avg_icp_score,
                        COUNT(CASE WHEN resolution->'behavioral'->>'buying_stage' = 'decision'      THEN 1 END) AS stage_decision,
                        COUNT(CASE WHEN resolution->'behavioral'->>'buying_stage' = 'consideration' THEN 1 END) AS stage_consideration,
                        COUNT(CASE WHEN resolution->'behavioral'->>'buying_stage' = 'awareness'     THEN 1 END) AS stage_awareness,
                        MAX(created_at)                               AS last_seen_at,
                        ARRAY_AGG(DISTINCT url ORDER BY url)          AS urls
                    FROM visits
                    WHERE org_id = :org_id
                      AND created_at >= :since
                      AND matched = true
                      AND resolution->>'domain' IS NOT NULL
                    GROUP BY
                        resolution->>'domain',
                        resolution->>'company',
                        resolution->>'logo_url'
                    HAVING COUNT(*) >= 1
                    ORDER BY peak_engagement DESC NULLS LAST
                    LIMIT :limit
                """),
                {"org_id": str(org_id), "since": since, "limit": limit * 2},
            ).fetchall()

            accounts = []
            for row in rows:
                domain = row.domain or ""
                if not domain:
                    continue

                total_visits = int(row.total_visits or 0)
                unique_visitors = int(row.unique_visitors or 0)
                peak_eng = float(row.peak_engagement or 0)
                avg_icp = float(row.avg_icp_score or 0)
                stage_d = int(row.stage_decision or 0)
                stage_c = int(row.stage_consideration or 0)
                stage_a = int(row.stage_awareness or 0)

                # Account intent score formula:
                #   Base = peak engagement (0-100) × 0.40
                #   + multi-visitor bonus (up to 25 pts)
                #   + buying stage weight (decision=25, consideration=15, awareness=5)
                #   + ICP score weight × 0.15
                multi_visitor_pts = min(unique_visitors * 5, 25)
                buying_stage_pts = (
                    25 if stage_d > 0 else (15 if stage_c > 0 else 5)
                )
                account_score = min(int(
                    peak_eng * 0.40
                    + multi_visitor_pts
                    + buying_stage_pts
                    + avg_icp * 0.15
                ), 100)

                if account_score < min_score:
                    continue

                # Top 5 most-visited URLs from this account
                all_urls = row.urls or []
                url_counter: dict = {}
                for u in all_urls:
                    url_counter[u] = url_counter.get(u, 0) + 1
                hot_pages = sorted(url_counter, key=url_counter.get, reverse=True)[:5]

                accounts.append({
                    "domain": domain,
                    "company": row.company or domain,
                    "logo_url": row.logo_url,
                    "industry": row.industry,
                    "employee_count_range": row.emp_range,
                    "total_visits": total_visits,
                    "unique_visitor_count": unique_visitors,
                    "peak_engagement_score": int(peak_eng),
                    "avg_icp_score": round(avg_icp, 1),
                    "buying_stage_distribution": {
                        "decision": stage_d,
                        "consideration": stage_c,
                        "awareness": stage_a,
                    },
                    "hot_pages": hot_pages,
                    "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
                    "account_intent_score": account_score,
                    "account_stage": None,
                    "account_score": None,
                    "role_coverage": [],
                    "active_sequence_types": [],
                    "revealed_people_count": 0,
                })

            from app.db.models.company_visitor_memory import CompanyVisitorMemory
            memories = (
                db.query(CompanyVisitorMemory)
                .filter(CompanyVisitorMemory.org_id == org_id)
                .all()
            )
            memory_map = {m.company_domain: m for m in memories if m.company_domain}
            for account in accounts:
                mem = memory_map.get(account["domain"])
                if not mem:
                    continue
                intelligence = ((mem.evidence or {}).get("account_intelligence") or {})
                account["account_stage"] = intelligence.get("stage")
                account["account_score"] = intelligence.get("account_score")
                account["role_coverage"] = list(mem.role_coverage or [])[:6]
                account["active_sequence_types"] = list(mem.active_sequence_types or [])[:6]
                account["revealed_people_count"] = len(list(mem.revealed_people or []))

            # Sort by account_intent_score and enforce limit
            accounts.sort(key=lambda a: a["account_intent_score"], reverse=True)
            return accounts[:limit]
        finally:
            db.close()

    try:
        result = await _run_db(_query)
        return {"accounts": result, "total": len(result), "hours": hours}
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})
    except Exception as e:
        logger.error("get_account_intent error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


@router.get("/intelligence-insights")
async def get_visitor_intelligence_insights(
    hours: int = Query(default=168, ge=1, le=720),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregated diagnostics for visitor intelligence quality and model behavior.
    Useful for dashboard explainability and tuning.
    """
    org_id = current_user.id
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    def _query():
        db = SessionLocal()
        try:
            rows = (
                db.query(Visit.resolution, Visit.created_at)
                .filter(Visit.org_id == org_id, Visit.created_at >= since)
                .order_by(Visit.created_at.desc())
                .limit(50000)
                .all()
            )

            model_method_counts: Counter = Counter()
            evidence_counts: Counter = Counter()
            contradiction_counts: Counter = Counter()
            account_stage_counts: Counter = Counter()
            sequence_type_counts: Counter = Counter()
            confidence_sum = 0.0
            confidence_n = 0
            negative_penalty_sum = 0.0
            promoted_count = 0

            for row in rows:
                res = row.resolution or {}
                pr = res.get("person_resolution") or {}
                method = pr.get("method") or "unknown"
                model_method_counts[method] += 1
                for item in (pr.get("evidence") or [])[:10]:
                    evidence_counts[str(item)] += 1
                for item in (pr.get("contradictions") or [])[:10]:
                    contradiction_counts[str(item)] += 1
                stage = pr.get("account_stage") or "single_visitor"
                seq = pr.get("sequence_type") or ((res.get("journey_sequence") or {}).get("sequence_type")) or "unknown"
                account_stage_counts[str(stage)] += 1
                sequence_type_counts[str(seq)] += 1
                try:
                    conf = float(pr.get("confidence") or 0.0)
                    confidence_sum += conf
                    confidence_n += 1
                except Exception:
                    pass
                try:
                    negative_penalty_sum += float(pr.get("negative_learning_penalty") or 0.0)
                except Exception:
                    pass
                if pr.get("promote_to_ui"):
                    promoted_count += 1

            avg_confidence = round(confidence_sum / confidence_n, 3) if confidence_n else 0.0
            avg_negative_penalty = round(negative_penalty_sum / confidence_n, 3) if confidence_n else 0.0
            return {
                "window_hours": hours,
                "summary": {
                    "avg_person_resolution_confidence": avg_confidence,
                    "avg_negative_learning_penalty": avg_negative_penalty,
                    "ui_promoted_predictions": promoted_count,
                    "analyzed_visits": len(rows),
                },
                "methods": [{"method": k, "count": v} for k, v in model_method_counts.most_common()],
                "top_evidence": [{"evidence": k, "count": v} for k, v in evidence_counts.most_common(20)],
                "top_contradictions": [{"contradiction": k, "count": v} for k, v in contradiction_counts.most_common(20)],
                "account_stages": [{"stage": k, "count": v} for k, v in account_stage_counts.most_common()],
                "sequence_types": [{"sequence_type": k, "count": v} for k, v in sequence_type_counts.most_common()],
            }
        finally:
            db.close()

    try:
        return await _run_db(_query)
    except (OperationalError, asyncio.TimeoutError):
        return JSONResponse(status_code=503, content={"error": "Database temporarily unavailable"})
    except Exception as e:
        logger.error("get_visitor_intelligence_insights error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ── Consent opt-in (revoke opt-out) ─────────────────────────────────────────

@public_router.delete("/optout")
async def visitor_optin(request: Request):
    """
    Revoke a previous opt-out — called by pixel.js outmateTracker.optIn().
    Removes the opt-out flag from Redis so tracking resumes.
    """
    try:
        data: dict = {}
        try:
            data = await request.json()
        except Exception:
            pass
        visitor_id = data.get("visitor_id") or ""
        if not visitor_id:
            return JSONResponse(status_code=400, content={"error": "Missing visitor_id"})
        rc = RedisManager.get_client()
        if rc:
            await rc.delete(f"optout:{visitor_id}")
        return {"status": "opted_in"}
    except Exception as e:
        logger.error("Opt-in error: %s", e)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ── Bulk enrichment ──────────────────────────────────────────────────────────

class BulkEnrichRequest(BaseModel):
    visitor_ids: list[str]
    actions: list[str]


@router.post("/enrich-bulk")
async def enrich_bulk(
    req: BulkEnrichRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Queue bulk enrichment actions for the given visitors.
    Marks each visitor as enrichment_status='processing' so the UI can
    show progress, then kicks off enrichment asynchronously.
    """
    org_id = current_user.id
    if not req.visitor_ids or not req.actions:
        raise HTTPException(status_code=400, detail="visitor_ids and actions are required")

    updated = 0
    try:
        def _mark():
            nonlocal updated
            db = SessionLocal()
            try:
                visits = (
                    db.query(Visit)
                    .filter(
                        Visit.org_id == org_id,
                        Visit.id.in_(req.visitor_ids),
                    )
                    .all()
                )
                for v in visits:
                    v.enrichment_status = "processing"
                    updated += 1
                db.commit()
            finally:
                db.close()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_db_executor, _mark)

        return {
            "status": "queued",
            "visitors_queued": updated,
            "actions": req.actions,
        }
    except Exception as e:
        logger.error("Bulk enrich error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to start enrichment")
