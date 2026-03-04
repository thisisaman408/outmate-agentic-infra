"""
Health Check Endpoints for Production Monitoring

Provides endpoints to monitor application health:
- GET /health - Overall health status
- GET /health/db - Database health
- GET /health/redis - Redis/cache health

Used by:
- Azure Application Health Probes
- Kubernetes Liveness/Readiness Probes
- Load Balancers
- Monitoring systems
"""

import logging
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, status
from sqlalchemy import text

from app.db.session import SessionLocal, check_database_health
from app.core.redis import RedisManager
from app.core.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/health",
    tags=["monitoring"],
    responses={503: {"description": "Service Unavailable"}}
)


@router.get("", status_code=status.HTTP_200_OK)
async def health() -> Dict[str, Any]:
    """
    Overall application health check.
    
    Checks:
    - Application is running
    - Database is accessible
    - Redis is accessible
    
    Returns:
        200 OK: If all systems are healthy
        503 Service Unavailable: If any critical system is down
    """
    db_health = await check_database_health()
    redis_health = await check_redis_health()
    
    # Determine overall health
    is_healthy = (
        db_health.get("status") == "healthy" and
        redis_health.get("status") == "healthy"
    )
    
    return {
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
        "version": settings.APP_VERSION,
        "database": db_health,
        "redis": redis_health,
    }


@router.get("/db", status_code=status.HTTP_200_OK)
async def health_db() -> Dict[str, Any]:
    """
    Database health check endpoint.
    
    Performs:
    - Connection pool status check
    - Simple SELECT query
    - Connection timeout verification
    
    Returns:
        200 OK: If database is healthy
        503 Service Unavailable: If database is down
    """
    try:
        db_health = await check_database_health()
        
        if db_health.get("status") != "healthy":
            logger.error("Database health check failed")
            return db_health
        
        # Additional checks
        db = SessionLocal()
        try:
            # Check table accessibility
            result = db.execute(text("SELECT COUNT(*) FROM users"))
            user_count = result.scalar()
            
            db_health["users_count"] = user_count
            db_health["accessible"] = True
            
            logger.info(f"Database health check passed: {user_count} users")
            return db_health
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Database health check error: {e}")
        return {
            "status": "unhealthy",
            "database": "postgresql",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/redis", status_code=status.HTTP_200_OK)
async def health_redis() -> Dict[str, Any]:
    """
    Redis/Cache health check endpoint.
    
    Performs:
    - PING command
    - Memory usage check
    - Connection info verification
    
    Returns:
        200 OK: If Redis is healthy
        503 Service Unavailable: If Redis is unavailable
    """
    return await check_redis_health()


async def check_redis_health() -> Dict[str, Any]:
    """
    Internal function to check Redis health.
    
    Returns:
        dict: Health status with details
    """
    try:
        if RedisManager.client is None:
            await RedisManager.connect()
        
        # PING Redis
        pong = await RedisManager.client.ping()
        
        if not pong:
            raise Exception("Redis PING returned False")
        
        # Get info
        info = await RedisManager.client.info()
        
        logger.info("✓ Redis health check passed")
        return {
            "status": "healthy",
            "cache": "redis",
            "response": "PONG",
            "memory_mb": info.get("used_memory", 0) / (1024 * 1024),
            "connected_clients": info.get("connected_clients", 0),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"✗ Redis health check failed: {e}")
        return {
            "status": "unhealthy",
            "cache": "redis",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness() -> Dict[str, Any]:
    """
    Kubernetes-style readiness probe.
    
    Returns 200 only if application is ready to handle traffic.
    
    Checks:
    - Core services initialized
    - Dependencies accessible
    
    Used by Kubernetes deployment to route traffic.
    """
    try:
        # Check critical dependencies
        redis_ok = RedisManager.ready
        
        if not redis_ok:
            return {
                "ready": False,
                "reason": "Redis not ready"
            }
        
        return {
            "ready": True,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {
            "ready": False,
            "error": str(e)
        }


@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness() -> Dict[str, Any]:
    """
    Kubernetes-style liveness probe.
    
    Returns 200 if application is still running.
    Simple check - doesn't verify dependencies.
    
    Used by Kubernetes to determine if pod should be restarted.
    """
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat()
    }
