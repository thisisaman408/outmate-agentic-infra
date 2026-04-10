"""
Main FastAPI application
Production-grade setup with logging, CORS, and organized routes
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from starlette.middleware.base import BaseHTTPMiddleware

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import logging
from typing import Annotated

# Load environment variables from .env file
load_dotenv()

SEPARATOR = "================================"

from app.db.vector_setup import setup_vector_database
from app.db.base import Base
from app.db.session import engine, SessionLocal
from sqlalchemy import inspect, text

from app.db.deps import get_db
from app.db.models.company_resolution_alias import CompanyResolutionAlias
from app.db.models.anonymous_visitor_profile import AnonymousVisitorProfile
from app.db.models.office_ip_cluster import OfficeIpCluster
from app.db.models.company_visitor_memory import CompanyVisitorMemory
from app.db.models.person_resolution_learning_stat import PersonResolutionLearningStat
from app.db.models.visitor_journey_sequence import VisitorJourneySequence
from app.db.models.user import User
from app.db.models.watcher import Watcher as WatcherModel  # ensures table is created
from app.core.redis import RedisManager, start_keepalive

from app.api.routes import leads, contactout_routes, crustdata_routes
from app.api.routes import explorium_routes
from app.api.routes import auth
from app.api.routes import signals
from app.api.routes import signal_pipeline
from app.api.routes import campaigns
from app.api.routes import chat
from app.api.routes import chat_history
from app.api.routes import bettercontact_routes
from app.api.routes import enrichment_routes
from app.api.routes import ai_agents
from app.api.routes import gtm_agents
from app.api.routes import visitors
from app.api.routes import diagnostics
from app.api.routes import copilot
from app.api.routes.copilot import sse_router as copilot_sse_router
from app.api.routes import calendar as calendar_router
from app.api.routes import calendly as calendly_router
from app.api.routes import watchers
from app.api.routes import dashboard
from app.api.routes import events_routes
from app.api.routes import database_finder
from app.api.routes import outmate_agentic
from app.api.routes import social_listening

# Import Celery tasks to register them (must be before app startup)
from app.tasks import signal_tasks  # noqa: F401

# Register routers

from app.core.logging import setup_logging
from app.core.config import settings
from app.core.rate_limiting import setup_rate_limiting

# Import API routes
from app.api.routes import prospects, companies
from app.api.deps.auth import get_current_user

# Setup logging first (before any logging occurs)
setup_logging(log_level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


def _seed_company_resolution_aliases() -> None:
    seed_rows = [
        {"match_type": "asn_org", "match_value": "comcast", "notes": "Suppress residential ISP false positives", "metadata_json": {"action": "suppress", "reason": "isp"}},
        {"match_type": "asn_org", "match_value": "xfinity", "notes": "Suppress residential ISP false positives", "metadata_json": {"action": "suppress", "reason": "isp"}},
        {"match_type": "asn_org", "match_value": "verizon", "notes": "Suppress generic telco IP-owner matches", "metadata_json": {"action": "suppress", "reason": "telco"}},
        {"match_type": "asn_org", "match_value": "charter communications", "notes": "Suppress residential ISP false positives", "metadata_json": {"action": "suppress", "reason": "isp"}},
        {"match_type": "asn_org", "match_value": "cox communications", "notes": "Suppress residential ISP false positives", "metadata_json": {"action": "suppress", "reason": "isp"}},
        {"match_type": "asn_org", "match_value": "frontier communications", "notes": "Suppress residential ISP false positives", "metadata_json": {"action": "suppress", "reason": "isp"}},
        {"match_type": "asn_org", "match_value": "t-mobile", "notes": "Suppress mobile carrier false positives", "metadata_json": {"action": "suppress", "reason": "carrier"}},
        {"match_type": "asn_org", "match_value": "at&t", "notes": "Suppress mobile/broadband carrier false positives", "metadata_json": {"action": "suppress", "reason": "carrier"}},
        {"match_type": "asn_org", "match_value": "reliance jio", "notes": "Suppress mobile carrier false positives", "metadata_json": {"action": "suppress", "reason": "carrier"}},
        {"match_type": "asn_org", "match_value": "bharti airtel", "notes": "Suppress mobile carrier false positives", "metadata_json": {"action": "suppress", "reason": "carrier"}},
        {"match_type": "asn_org", "match_value": "vodafone idea", "notes": "Suppress mobile carrier false positives", "metadata_json": {"action": "suppress", "reason": "carrier"}},
        {"match_type": "asn_org", "match_value": "bsnl", "notes": "Suppress telecom false positives", "metadata_json": {"action": "suppress", "reason": "carrier"}},
        {"match_type": "asn_org", "match_value": "nordvpn", "notes": "Suppress VPN traffic as company signal", "metadata_json": {"action": "suppress", "reason": "vpn"}},
        {"match_type": "asn_org", "match_value": "expressvpn", "notes": "Suppress VPN traffic as company signal", "metadata_json": {"action": "suppress", "reason": "vpn"}},
        {"match_type": "asn_org", "match_value": "surfshark", "notes": "Suppress VPN traffic as company signal", "metadata_json": {"action": "suppress", "reason": "vpn"}},
        {"match_type": "asn_org", "match_value": "mullvad", "notes": "Suppress VPN traffic as company signal", "metadata_json": {"action": "suppress", "reason": "vpn"}},
    ]

    db = SessionLocal()
    try:
        for row in seed_rows:
            exists = (
                db.query(CompanyResolutionAlias)
                .filter(
                    CompanyResolutionAlias.match_type == row["match_type"],
                    CompanyResolutionAlias.match_value == row["match_value"],
                )
                .first()
            )
            if exists:
                continue
            db.add(CompanyResolutionAlias(
                match_type=row["match_type"],
                match_value=row["match_value"],
                notes=row.get("notes"),
                metadata_json=row.get("metadata_json") or {},
                is_active=True,
                confidence_boost=0,
            ))
        db.commit()
    finally:
        db.close()

# Dependency shortcuts
auth_dependencies = [Depends(get_current_user)]

# Create FastAPI app with metadata
# Disable interactive docs in production to prevent API schema exposure
app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade API for prospect and company search with CrustData integration",
    version=settings.APP_VERSION,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    # Disable automatic trailing-slash redirects (307). Next.js proxy strips
    # trailing slashes before forwarding, causing FastAPI to redirect, which
    # drops the Authorization header → 401 on all authenticated GET endpoints.
    redirect_slashes=False,
)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting — must be configured before routes are hit
setup_rate_limiting(app, environment=settings.ENVIRONMENT)

# CORS Configuration
# NOTE: Using wildcard for broad compatibility. Starlette CORSMiddleware
# automatically echoes the request origin when allow_credentials=True.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Pixel-Key"],
)

# Pixel CORS Middleware — must be added AFTER CORSMiddleware so it runs first
# (Starlette middleware stack is LIFO). The tracking pixel is embedded on
# third-party websites, so /track and /pixel.js must accept any origin.
_PIXEL_PATHS = {"/api/v1/visitors/track", "/api/v1/visitors/pixel.js"}

class PixelCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path not in _PIXEL_PATHS:
            return await call_next(request)

        origin = request.headers.get("origin", "*")

        # Handle preflight — short-circuit before any route logic runs
        if request.method == "OPTIONS":
            from starlette.responses import Response as StarletteResponse
            return StarletteResponse(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "X-Pixel-Key, Content-Type, Authorization",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age": "86400",
                    "Vary": "Origin",
                },
            )

        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
        return response

app.add_middleware(PixelCORSMiddleware)

# Add custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """
    Custom handler for Pydantic validation errors.
    Logs full detail server-side; returns only field/type info to the client
    (never echoes the request body back, which could contain credentials).
    """
    # Sanitised errors safe to return: only loc + type + msg, no input values
    safe_errors = [
        {"field": list(e.get("loc", [])), "type": e.get("type"), "message": e.get("msg")}
        for e in exc.errors()
    ]

    logger.warning(
        "Request validation failed",
        extra={
            "url": str(request.url),
            "method": request.method,
            "error_count": len(exc.errors()),
            "errors": safe_errors,
        }
    )

    return JSONResponse(
        status_code=422,
        content={"detail": safe_errors},
    )

# Register API routers
app.include_router(prospects.router, dependencies=auth_dependencies)
logger.info("Prospects router registered")

app.include_router(companies.router, dependencies=auth_dependencies)
logger.info("Companies router registered")

app.include_router(auth.router)
logger.info("Auth router registered")

app.include_router(leads.router, prefix="/api/v1/leads", tags=["leads"], dependencies=auth_dependencies)
app.include_router(contactout_routes.router, prefix="/api/v1/contactout", tags=["contactout"], dependencies=auth_dependencies)
app.include_router(crustdata_routes.router, prefix="/api/v1/crustdata", tags=["crustdata"], dependencies=auth_dependencies)
app.include_router(explorium_routes.router, prefix="/api/v1/explorium", tags=["explorium"], dependencies=auth_dependencies)
app.include_router(signals.router, prefix="/api/v1/signals", tags=["signals"], dependencies=auth_dependencies)
logger.info("Signals router registered")
app.include_router(signal_pipeline.router, tags=["signal_pipeline"], dependencies=auth_dependencies)
logger.info("Signal Pipeline router registered")
app.include_router(campaigns.public_router, prefix="/api/v1/campaigns", tags=["campaigns"])
logger.info("Campaigns public router registered")
app.include_router(campaigns.router, prefix="/api/v1/campaigns", tags=["campaigns"], dependencies=auth_dependencies)
logger.info("Campaigns router registered")
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"], dependencies=auth_dependencies)
logger.info("Chat router registered")

# Integrated routes from both branches
app.include_router(chat_history.router, dependencies=auth_dependencies)
logger.info("Chat history router registered")
app.include_router(bettercontact_routes.router, prefix="/api/v1/bettercontact", tags=["bettercontact"], dependencies=auth_dependencies)
logger.info("BetterContact router registered")
app.include_router(enrichment_routes.router, prefix="/api/v1/enrich", tags=["enrichment"], dependencies=auth_dependencies)
logger.info("Enrichment router registered")
app.include_router(ai_agents.router, prefix="/api/v1/ai-agents", tags=["ai-agents"], dependencies=auth_dependencies)
logger.info("AI Agents router registered")
app.include_router(gtm_agents.router, dependencies=auth_dependencies)
logger.info("GTM Agents router registered")

@app.get("/health")
async def health_check():
    """Production health endpoint with database and Redis checks."""
    db_ready = bool(getattr(app.state, "db_ready", False))
    redis_ready = await RedisManager.health_check()
    
    status = "healthy" if (db_ready and redis_ready) else "degraded"
    status_code = 200 if (db_ready and redis_ready) else 503
    
    response = {
        "status": status,
        "service": "outmate-backend",
        "version": settings.APP_VERSION,
        "database": {"ready": db_ready},
        "redis": {"ready": redis_ready},
    }
    
    if status_code == 503:
        return JSONResponse(status_code=status_code, content=response)
    return response

# Public pixel endpoints — no JWT required (pixel is embedded on client sites)
app.include_router(visitors.public_router)
# Protected dashboard endpoints — JWT required
app.include_router(visitors.router, dependencies=auth_dependencies)
logger.info("Visitors router registered")
app.include_router(watchers.router, dependencies=auth_dependencies)
# Legacy /api/watchers routes: the old frontend bundle doesn't send
# Authorization headers, so these are registered WITHOUT auth.
# The watchers table has no user_id column, so there is no data leak.
# TODO: remove once the frontend cache rotates to the new bundle.
app.include_router(watchers.legacy_router)
logger.info("Watchers router registered")

# Diagnostics endpoints for health checks
app.include_router(diagnostics.router, prefix="/api/v1/diagnostics", tags=["diagnostics"])
logger.info("Diagnostics router registered")

app.include_router(dashboard.router, prefix="/api/v1", tags=["dashboard"], dependencies=auth_dependencies)
logger.info("Dashboard router registered")

app.include_router(copilot.router, prefix="/api/copilot", tags=["copilot"], dependencies=auth_dependencies)
app.include_router(copilot_sse_router, prefix="/api/copilot")  # no auth — SSE validates JWT via ?token=
logger.info("Copilot router registered")

app.include_router(calendar_router.router, prefix="/api/calendar", tags=["calendar"])
logger.info("Calendar router registered")

app.include_router(calendly_router.router, prefix="/api/calendly", tags=["calendly"])
logger.info("Calendly router registered")

app.include_router(events_routes.router, prefix="/api/v1/events", tags=["events"], dependencies=auth_dependencies)
logger.info("Events router registered")

app.include_router(database_finder.router, prefix="/api/v1/database", tags=["database"], dependencies=auth_dependencies)
logger.info("Database Finder router registered")

# Outmate-agentic backed agents (Lead Discovery / Social Listening etc.)
# Auth + tenant isolation are enforced INSIDE the route module via
# get_current_user + hard user_id filters on every query, so we deliberately
# do NOT add auth_dependencies here (the router already requires it).
app.include_router(outmate_agentic.router)
logger.info("Outmate-agentic agents router registered")

# Social Listening (continuous monitoring + signal feed) — same pattern,
# tenant isolation is enforced inside the router via watcher.user_id and
# the signal_watcher_matches.user_id denormalised join column.
app.include_router(social_listening.router)
logger.info("Social Listening router registered")

@app.on_event("startup")
async def startup_event():
    logger.info(SEPARATOR)
    logger.info("Starting Outmate AI - Backend API v1.0.0")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(SEPARATOR)
    
    app.state.db_ready = False
    app.state.redis_ready = False

    # DB boot should never crash the whole app; routes can return 503 if unavailable.
    try:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("users")}

        # Ensure columns added across releases exist (idempotent ALTER TABLE)
        migrations = [
            ("hashed_password",    "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);"),
            ("google_id",          "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);"),
            ("is_email_verified",  "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;"),
            ("terms_accepted_at",  "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;"),
            ("gmail_access_token", "ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_access_token TEXT;"),
            ("gmail_refresh_token", "ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;"),
            ("anthropic_api_key",  "ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;"),
            ("use_byok",           "ALTER TABLE users ADD COLUMN IF NOT EXISTS use_byok BOOLEAN DEFAULT FALSE;"),
        ]
        with engine.begin() as conn:
            for col_name, ddl in migrations:
                if col_name not in columns:
                    conn.execute(text(ddl))
                    logger.info(f"Added missing users.{col_name} column")

        watcher_columns = {col["name"] for col in inspector.get_columns("watchers")} if inspector.has_table("watchers") else set()
        if "watchers" in {t for t in inspector.get_table_names()} and "matches" not in watcher_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE watchers ADD COLUMN IF NOT EXISTS matches JSON;"))
            logger.info("Added missing watchers.matches column")

        # ── Visitor tracker v2 schema migrations (idempotent) ─────────────────
        # site_configs new columns
        site_config_cols = (
            {col["name"] for col in inspector.get_columns("site_configs")}
            if inspector.has_table("site_configs") else set()
        )
        visitor_v2_site_config_ddl = [
            ("webhook_secret", "ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(64);"),
            ("isp_allowlist",  "ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS isp_allowlist JSONB DEFAULT '[]';"),
            ("anonymize_ips",  "ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS anonymize_ips BOOLEAN DEFAULT false;"),
            ("gdpr_mode",      "ALTER TABLE site_configs ADD COLUMN IF NOT EXISTS gdpr_mode BOOLEAN DEFAULT false;"),
        ]
        with engine.begin() as conn:
            for col_name, ddl in visitor_v2_site_config_ddl:
                if col_name not in site_config_cols:
                    conn.execute(text(ddl))
                    logger.info(f"Added missing site_configs.{col_name} column")
            # Backfill webhook_secret for any existing rows that have it NULL
            if inspector.has_table("site_configs"):
                conn.execute(text(
                    "UPDATE site_configs SET webhook_secret = encode(gen_random_bytes(32), 'hex') "
                    "WHERE webhook_secret IS NULL"
                ))

        # visits.enrichment_status column
        visits_cols = (
            {col["name"] for col in inspector.get_columns("visits")}
            if inspector.has_table("visits") else set()
        )
        if "enrichment_status" not in visits_cols:
            with engine.begin() as conn:
                conn.execute(text(
                    "ALTER TABLE visits ADD COLUMN IF NOT EXISTS "
                    "enrichment_status VARCHAR(20) NOT NULL DEFAULT 'done';"
                ))
            logger.info("Added missing visits.enrichment_status column")

        # visitor_sessions table + indexes (create_all handles the table,
        # but add the partial/expression indexes here since create_all can't)
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_visits_org_matched_partial "
                "ON visits (org_id, created_at DESC) WHERE matched = true"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_visits_fingerprint_expr "
                "ON visits ((resolution->>'fingerprint')) "
                "WHERE resolution->>'fingerprint' IS NOT NULL"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_visits_visitor_id_expr "
                "ON visits ((resolution->>'visitor_id')) "
                "WHERE resolution->>'visitor_id' IS NOT NULL"
            ))
        logger.info("✓ Visitor tracker v2 schema migrations applied")

        # ── Identity graph v2 indexes (idempotent) ─────────────────────────────
        # Expression index on raw_data->>'fingerprint' for O(log n) cross-org
        # fingerprint lookups. Subnet scan index on ip column for /24 NAT clustering.
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_identity_nodes_fingerprint_expr "
                "ON identity_nodes ((raw_data->>'fingerprint')) "
                "WHERE raw_data->>'fingerprint' IS NOT NULL"
            ))
        logger.info("✓ Identity graph v2 indexes applied")
        # ── end identity graph v2 ──────────────────────────────────────────────

        # ── end visitor tracker v2 ─────────────────────────────────────────────

        # Ensure pgvector extension exists before create_all (needed for Vector columns)
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

        Base.metadata.create_all(bind=engine)
        app.state.db_ready = True
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_company_resolution_aliases_active_match "
                "ON company_resolution_aliases (is_active, match_type, match_value)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_anonymous_visitor_profiles_org_identity "
                "ON anonymous_visitor_profiles (org_id, visitor_id, fingerprint, session_id)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_office_ip_clusters_org_domain_prefix "
                "ON office_ip_clusters (org_id, company_domain, ip_prefix)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_company_visitor_memories_org_domain "
                "ON company_visitor_memories (org_id, company_domain)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_person_resolution_learning_stats_org_feature "
                "ON person_resolution_learning_stats (org_id, feature_type, feature_value)"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_visitor_journey_sequences_org_identity "
                "ON visitor_journey_sequences (org_id, visitor_id, fingerprint, session_id)"
            ))
        _seed_company_resolution_aliases()
        logger.info("✓ Database tables ensured")

        # ── Signal pipeline v1 indexes (idempotent) ──────────────────
        # Ensure signal_events table indexes exist
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_signal_type "
                "ON signal_events (signal_type);"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_company_id "
                "ON signal_events (company_id);"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_company_domain "
                "ON signal_events (company_domain);"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_prospect_id "
                "ON signal_events (prospect_id);"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_fingerprint "
                "ON signal_events (fingerprint);"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_is_archived "
                "ON signal_events (is_archived);"
            ))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_signal_events_ingested_at "
                "ON signal_events (ingested_at);"
            ))
        logger.info("✓ Signal pipeline v1 indexes ensured")
        # HubSpot tokens stored in user_integrations table — no ALTER TABLE needed.
    except Exception as e:
        logger.error(f"✗ Database init failed (app will start without DB): {e}")

    # Seed the default visitor pixel key (idempotent — safe to run every startup)
    try:
        from app.api.routes.visitors import _ensure_default_site_config
        _ensure_default_site_config()
        logger.info("✓ Default visitor SiteConfig ensured")
    except Exception as e:
        logger.warning(f"⚠ Could not seed visitor SiteConfig: {e}")

    try:
        connected = RedisManager.connect()
        app.state.redis_ready = bool(connected)
        if connected:
            logger.info("✓ Redis connection established")
            # Ping every 45 s to prevent Upstash / managed-Redis idle disconnects
            app.state.redis_keepalive_task = start_keepalive(interval=45)
        else:
            logger.warning("⚠ Redis unavailable (continuing without Redis)")
    except Exception as e:
        logger.error(f"✗ Redis init failed (app will start without Redis): {e}")
    app.state.db_ready = True
    app.state.redis_ready = True

    # Preload embedding model so first chatbot request doesn't pay the load cost.
    # Skip if OUTMATE_SKIP_EMBEDDING_PRELOAD=true (used in local dev to bypass a
    # known abseil/grpc mutex deadlock that hangs SentenceTransformer init on
    # some Mac configurations).  The model still lazy-loads on first request.
    if os.getenv("OUTMATE_SKIP_EMBEDDING_PRELOAD", "").lower() == "true":
        logger.info("⏭ Skipping embedding model preload (OUTMATE_SKIP_EMBEDDING_PRELOAD=true)")
    else:
        try:
            from app.core.embeddings import get_embedding_model
            get_embedding_model()
            logger.info("✓ Embedding model preloaded")
        except Exception as e:
            logger.warning(f"⚠ Embedding model preload failed (will load on first request): {e}")

    # Resolve the Social Listening flow ID from the agentic infra so we
    # don't break when the engine regenerates UUIDs on cold start.
    try:
        from app.core.agentic_flow_resolver import get_social_listening_flow
        flow_id, node_id, node_type = get_social_listening_flow()
        logger.info("✓ Social Listening flow resolved: flow=%s node=%s type=%s", flow_id, node_id, node_type)
    except Exception as e:
        logger.warning("⚠ Social Listening flow resolution failed (will retry on first call): %s", e)

    logger.info("✓ Application startup (optimized) complete")
    logger.info("================================")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event handler"""
    logger.info("Shutting down application")
    # Cancel background keepalive ping task if running
    task = getattr(app.state, "redis_keepalive_task", None)
    if task and not task.done():
        task.cancel()
    try:
        await RedisManager.close()
        logger.info("Redis connection closed")
    except Exception as e:
        logger.error(f"Error closing Redis connection: {e}")
    logger.info("Application shutdown complete")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        }
    }


@app.get("/health/db")
def health_db(db: Annotated[Session, Depends(get_db)]):
    try:
        user_count = db.query(User).count()
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        user_count = None
        db_status = "error"

    return {
        "status": "ok",
        "service": "outmate-backend",
        "version": settings.APP_VERSION,
        "database": {
            "status": db_status,
            "users": user_count,
        },
    }

@app.get("/v1/models")
def openai_models():
    return {
        "data": [
            {
                "id": "anthropic/claude-sonnet-4-5",
                "object": "model",
                "created": 1677610602,
                "owned_by": "anthropic"
            },
            {
                "id": "anthropic/claude-sonnet-4",
                "object": "model",
                "created": 1677610602,
                "owned_by": "anthropic"
            }
        ],
        "object": "list"
    }
