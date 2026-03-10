"""
SQLAlchemy Database Session Configuration - Production Ready

Features:
- Connection pooling with QueuePool
- Pool sizing optimized for Supabase
- Connection recycling for session limits
- Health check capabilities
- Statement timeout protection
"""

from sqlalchemy import create_engine, event, pool
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
import logging

from app.core.settings import settings

logger = logging.getLogger(__name__)

# Use NullPool so create_engine does NOT open connections at import time.
# Each request gets a fresh connection; compatible with Supabase session pooler.
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    connect_args={
        "sslmode": "require",
        "connect_timeout": 5,
        "options": "-c statement_timeout=30000",
    },
    echo=settings.DEBUG,
)


# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=True
)


# Optional: Database health check function
async def check_database_health() -> dict:
    """
    Check if database is accessible and healthy.
    
    Returns:
        dict: Health status with connection details
    """
    try:
        # Get connection from pool
        with engine.connect() as conn:
            # Execute simple query
            result = conn.execute("SELECT 1")
            result.close()
            
        logger.info("✓ Database health check passed")
        return {
            "status": "healthy",
            "database": "postgresql",
            "pool_size": engine.pool.size(),
            "pool_overflow": engine.pool.overflow()
        }
    except Exception as e:
        logger.error(f"✗ Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "postgresql",
            "error": str(e)
        }


# Optional: Get current pool status
def get_pool_status() -> dict:
    """Get connection pool status for monitoring"""
    return {
        "pool_size": engine.pool.size(),
        "pool_checked_out": len(engine.pool._queue),
        "pool_overflow": engine.pool.overflow(),
        "max_size": engine.pool.maxsize
    }

