"""
Main FastAPI application
Production-grade setup with logging, CORS, and organized routes
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

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
from app.db.session import engine
from sqlalchemy import inspect, text

from app.db.deps import get_db
from app.db.models.user import User
from app.core.redis import RedisManager

from app.api.routes import leads, contactout_routes, crustdata_routes
from app.api.routes import explorium_routes
from app.api.routes import auth
from app.api.routes import signals
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
# NOTE: allow_origin_regex=".*" was deliberately removed — it bypasses the
# whitelist entirely and allows any origin to send credentialed requests.
# Add your production domain(s) to CORS_ALLOWED_ORIGINS in settings instead.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

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

app.include_router(visitors.router, dependencies=auth_dependencies)
logger.info("Visitors router registered")

# Diagnostics endpoints for health checks
app.include_router(diagnostics.router, prefix="/api/v1/diagnostics", tags=["diagnostics"])
logger.info("Diagnostics router registered")

app.include_router(copilot.router, prefix="/api/copilot", tags=["copilot"], dependencies=auth_dependencies)
logger.info("Copilot router registered")

@app.on_event("startup")
async def startup_event():
    logger.info(SEPARATOR)
    logger.info("Starting Outmate AI - Backend API v1.0.0")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Database URL (masked): {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'redacted'}")
    logger.info(f"Redis URL (masked): {settings.REDIS_URL.split('@')[1] if '@' in settings.REDIS_URL else 'redacted'}")
    logger.info(SEPARATOR)
    
    app.state.db_ready = False
    app.state.redis_ready = False

    # DB boot should never crash the whole app; routes can return 503 if unavailable.
    try:
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("users")}
        if "hashed_password" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);"))
            logger.info("Added missing users.hashed_password column")
        Base.metadata.create_all(bind=engine)
        app.state.db_ready = True
        logger.info("✓ Database tables ensured")
    except Exception as e:
        logger.error(f"✗ Database init failed (app will start without DB): {e}")

    try:
        connected = RedisManager.connect()
        app.state.redis_ready = bool(connected)
        if connected:
            logger.info("✓ Redis connection established")
        else:
            logger.warning("⚠ Redis unavailable (continuing without Redis)")
    except Exception as e:
        logger.error(f"✗ Redis init failed (app will start without Redis): {e}")
    
    # Initialize Vector Database in the background
    async def run_setup():
        try:
            await setup_vector_database()
            logger.info("✓ Vector database setup finished")
        except Exception as e:
            logger.error(f"✗ Vector database setup failed: {e}")

    import asyncio
    app.state.setup_task = asyncio.create_task(run_setup())
    logger.info("Vector database initialization started in background")
    
    logger.info("================================")
    logger.info("Application startup complete")
    logger.info("================================")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event handler"""
    logger.info("Shutting down application")
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

