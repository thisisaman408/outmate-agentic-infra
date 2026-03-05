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
from sqlalchemy.pool import QueuePool
import logging

from app.core.settings import settings

logger = logging.getLogger(__name__)

# Production-grade connection pool for Supabase Session Pooler
# QueuePool: appropriate for remote managed databases with timeouts/recycling
engine = create_engine(
    settings.DATABASE_URL,
    # Use QueuePool for better connection management with remote databases
    poolclass=QueuePool,
    # Connection pool sizing (tune based on concurrent load)
    pool_size=settings.DATABASE_POOL_SIZE,              # Persistent connections
    max_overflow=settings.DATABASE_MAX_OVERFLOW,        # Additional connections when pool full
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,        # Timeout waiting for connection
    pool_recycle=settings.DATABASE_POOL_RECYCLE,        # Recycle connections after N seconds
    pool_pre_ping=True,                                 # Verify connection before use
    # Connection arguments
    connect_args={
        "sslmode": "require",                           # Enforce SSL/TLS
        "connect_timeout": 10,                          # Connection timeout
        "options": "-c statement_timeout=30000"         # 30 second statement timeout
    },
    # Echo SQL in development (disable in production)
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

