"""
Main FastAPI application
Production-grade setup with logging, CORS, and organized routes
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import logging

# Load environment variables from .env file
load_dotenv()

from app.db.vector_setup import setup_vector_database
from app.db.base import Base
from app.db.session import engine

from app.db.deps import get_db
from app.db.models.user import User
from app.core.redis import RedisManager

from app.api.routes import leads, contactout_routes, crustdata_routes
from app.api.routes import explorium_routes
from app.api.routes import signals
from app.api.routes import campaigns
from app.api.routes import chat
from app.api.routes import chat_history
from app.api.routes import bettercontact_routes
from app.api.routes import enrichment_routes
from app.api.routes import ai_agents

# Register routers

from app.core.logging import setup_logging
from app.core.config import settings

# Import API routes
from app.api.routes import prospects, companies

# Setup logging first (before any logging occurs)
setup_logging(log_level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Create FastAPI app with metadata
app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade API for prospect and company search with CrustData integration",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Add custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """
    Custom handler for Pydantic validation errors
    """
    try:
        body = await request.json()
    except:
        body = "Could not parse body"
    
    logger.error(
        "VALIDATION ERROR DETAILS",
        extra={
            "url": str(request.url),
            "method": request.method,
            "body": body,
            "errors": exc.errors(),
            "error_count": len(exc.errors())
        }
    )
    
    for i, error in enumerate(exc.errors(), 1):
        logger.error(
            f"Validation Error #{i}",
            extra={
                "field": error.get('loc'),
                "error_type": error.get('type'),
                "error_message": error.get('msg'),
                "input": error.get('input')
            }
        )
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": body
        }
    )

# Register API routers
app.include_router(prospects.router)
logger.info("Prospects router registered")

app.include_router(companies.router)
logger.info("Companies router registered")

app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
app.include_router(contactout_routes.router, prefix="/api/contactout", tags=["contactout"])
app.include_router(crustdata_routes.router, prefix="/api/crustdata", tags=["crustdata"])
app.include_router(explorium_routes.router, prefix="/api/explorium", tags=["explorium"])
app.include_router(signals.router, prefix="/api/signals", tags=["signals"])
logger.info("Signals router registered")
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
logger.info("Campaigns router registered")
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
logger.info("Chat router registered")

# Integrated routes from both branches
app.include_router(chat_history.router)
logger.info("Chat history router registered")
app.include_router(bettercontact_routes.router, prefix="/api/bettercontact", tags=["bettercontact"])
logger.info("BetterContact router registered")
app.include_router(enrichment_routes.router, prefix="/api/enrich", tags=["enrichment"])
logger.info("Enrichment router registered")
app.include_router(ai_agents.router, prefix="/api/ai-agents", tags=["ai-agents"])
logger.info("AI Agents router registered")

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Outmate AI - Backend API v1.0.0")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured")

    RedisManager.connect()
    logger.info("Redis connection established")
    
    try:
        await setup_vector_database()
        logger.info("Vector database initialized")
    except Exception as e:
        logger.error(f"Vector database setup failed: {e}")
    
    logger.info("Application startup complete")


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


@app.get("/health")
def health(db: Session = Depends(get_db)):
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
            "users": user_count
        }
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

