import redis.asyncio as redis
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class RedisManager:
    """Singleton manager for async Redis client with production-grade retry and TLS.

    - Supports Upstash Redis with rediss:// (TLS) protocol
    - Implements exponential backoff retry strategy
    - Health check interval for detecting outages
    - Gracefully handles connection failures
    """

    client: Optional[redis.Redis] = None
    ready: bool = False

    @classmethod
    def connect(cls) -> bool:
        """Create async Redis client with TLS and retry strategy."""
        if cls.client is None:
            # Quick synchronous health check (non-blocking for startup)
            try:
                import redis as sync_redis

                sync_client = sync_redis.from_url(
                    settings.REDIS_URL,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    decode_responses=True,
                )
                sync_client.ping()
                cls.ready = True
                logger.info("Redis sync health check passed")
            except Exception as e:
                cls.ready = False
                logger.warning(f"Redis sync health check failed: {e}")

            # Create async client with exponential backoff retry
            try:
                retry = Retry(ExponentialBackoff(), 3)
                cls.client = redis.from_url(
                    settings.REDIS_URL,
                    retry=retry,
                    retry_on_error=[ConnectionError, TimeoutError],
                    health_check_interval=30,
                    socket_connect_timeout=10,
                    socket_timeout=10,
                    socket_keepalive=True,
                    decode_responses=True,
                )
                logger.info("Redis async client created with retry strategy")
            except Exception as e:
                logger.error(f"Failed to create async redis client: {e}")

            return cls.ready

        return cls.ready

    @classmethod
    async def close(cls):
        if cls.client:
            try:
                await cls.client.close()
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {e}")
            cls.client = None
            cls.ready = False
            logger.info("Redis connection closed")

    @classmethod
    def get_client(cls) -> redis.Redis:
        """Return async Redis client, creating it if missing.

        Note: Callers should handle exceptions for transient failures.
        """
        if cls.client is None:
            cls.connect()
        return cls.client

    @classmethod
    def reset(cls) -> None:
        """Discard the current client so the next get_client() call
        creates a fresh connection. Call this after a connection error."""
        cls.client = None
        cls.ready = False

    @classmethod
    async def health_check(cls) -> bool:
        """Check if Redis is available. Returns True if ping succeeds."""
        try:
            client = cls.get_client()
            await client.ping()
            return True
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            return False


# FastAPI dependency helper (for async injection)
async def get_redis() -> redis.Redis:
    if RedisManager.client is None:
        RedisManager.connect()
    return RedisManager.client
