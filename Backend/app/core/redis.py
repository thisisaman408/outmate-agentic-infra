import redis.asyncio as redis
from typing import Optional
from app.core.config import REDIS_URL


class RedisManager:
    """Singleton manager for async Redis client with resilient defaults.

    - Performs a quick synchronous ping during startup to detect local availability
      but always creates an async client instance with reconnect settings so
      callers can continue operating (best-effort) even when Redis is flaky.
    """

    client: Optional[redis.Redis] = None
    ready: bool = False

    @classmethod
    def connect(cls) -> bool:
        """Ensure an async Redis client exists. Return True if initial sync ping succeeded."""
        if cls.client is None:
            # Quick synchronous health check (non-blocking for startup)
            try:
                import redis as sync_redis

                checker = sync_redis.from_url(REDIS_URL, socket_timeout=1)
                checker.ping()
                cls.ready = True
                print("Connected to Redis (sync check)")
            except Exception as e:
                cls.ready = False
                print(f"WARNING: Redis sync ping failed for {REDIS_URL}: {e}")

            # Create an async client with reasonable reconnection defaults
            try:
                cls.client = redis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                    encoding="utf-8",
                    socket_connect_timeout=5,
                    socket_keepalive=True,
                    max_connections=50,
                    retry_on_timeout=True,
                )
            except Exception as e:
                # Failed to create async client (unusual) — leave as None
                print(f"ERROR: Failed to create async redis client: {e}")

            return cls.ready

        return cls.ready

    @classmethod
    async def close(cls):
        if cls.client:
            try:
                await cls.client.close()
            except Exception:
                pass
            cls.client = None
            cls.ready = False
            print("Closed Redis connection")

    @classmethod
    def get_client(cls) -> redis.Redis:
        """Return async Redis client, creating it if missing.

        Note: callers that use async methods should handle exceptions when Redis
        is temporarily unavailable.
        """
        if cls.client is None:
            cls.connect()
        return cls.client


# FastAPI dependency helper (for async injection)
async def get_redis() -> redis.Redis:
    if RedisManager.client is None:
        RedisManager.connect()
    return RedisManager.client
