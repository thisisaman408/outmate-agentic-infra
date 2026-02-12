"""
Main FastAPI application
Production-grade setup with logging, CORS, and organized routes
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import logging

from app.db.deps import get_db
from app.db.models.user import User
from app.core.redis import RedisManager

from app.api.routes import leads
from app.api.routes import leads, contactout_routes, crustdata_routes
from app.api.routes import explorium_routes

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
# Allow frontend to make requests from localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend development server
        "http://127.0.0.1:3000",  # Alternative localhost
        # Add production URLs when deploying
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Add custom exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    """
    Custom handler for Pydantic validation errors
    Logs detailed error information for debugging
    """
    # Get request body for debugging
    try:
        body = await request.json()
    except:
        body = "Could not parse body"
    
    # Log detailed validation error
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
    
    # Log each error individually for clarity
    for i, error in enumerate(exc.errors(), 1):
        logger.error(
            f"Validation Error #{i}",
            extra={
                "field": error.get('loc'),
                "error_type": error.get('type'),
                "error_message": error.get('msg'),  # Changed from 'message' to avoid conflict
                "input": error.get('input')
            }
        )
    
    # Return detailed error to client
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

@app.on_event("startup")
async def startup_event():
    """Application startup event handler"""
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    
    try:
        # Connect to Redis
        RedisManager.connect()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        # Don't crash the app if Redis is unavailable
        # The app can still function without cache
    
    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event handler"""
    logger.info("Shutting down application")
    
    try:
        # Close Redis connection
        await RedisManager.close()
        logger.info("Redis connection closed")
    except Exception as e:
        logger.error(f"Error closing Redis connection: {e}")
    
    logger.info("Application shutdown complete")


@app.get("/")
async def root():
    """
    Root endpoint - API information
    
    Provides basic info about the API and links to documentation.
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "endpoints": {
            "health": "/health",
            "prospects": "/api/prospects"
        }
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """
    Global health check endpoint
    
    Checks database connectivity and returns basic system status.
    Used by load balancers and monitoring systems.
    """
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

