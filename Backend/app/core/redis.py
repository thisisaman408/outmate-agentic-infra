import asyncio
import redis.asyncio as redis
import redis.exceptions as redis_exc
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
                    # Include redis-specific connection errors alongside built-ins
                    retry_on_error=[
                        ConnectionError,
                        TimeoutError,
                        redis_exc.ConnectionError,
                        redis_exc.TimeoutError,
                    ],
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
        """Discard the current client and immediately create a new one.
        Call this after a connection error so the NEXT request succeeds
        instead of also hitting a dead socket."""
        cls.client = None
        cls.ready = False

    @classmethod
    def new_loop_local_client(cls) -> redis.Redis:
        """Return a FRESH async Redis client, not the singleton.

        Why this exists:
          redis.asyncio clients bind their ConnectionPool to the event
          loop they're first awaited on.  Our cls.client singleton is
          created under FastAPI's uvicorn loop; any other context that
          needs async Redis (Celery task threads calling `asyncio.run`,
          each of which creates a NEW short-lived event loop) will get
          `Event loop is closed` on first await if they reuse that
          singleton.

          Each `asyncio.run(...)` inside a Celery task should therefore
          build its own client via this helper, then `await client.close()`
          in a finally block.  Cheap: one TCP connection for ~100ms.

        Do NOT call this from FastAPI request handlers — they share
        uvicorn's loop and should reuse the singleton via `get_client()`.
        """
        return redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=10,
            socket_timeout=10,
            socket_keepalive=True,
            decode_responses=True,
        )
        cls.connect()  # reconnect immediately — avoids a second failure

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


async def _keepalive_loop(interval: int = 45) -> None:
    """Background task that pings Redis every `interval` seconds.

    Upstash (and many managed Redis providers) forcibly close TCP connections
    that are idle for 60-90 seconds.  A periodic PING issued by this task
    keeps the connection alive so requests never hit a dead socket.
    """
    while True:
        await asyncio.sleep(interval)
        try:
            client = RedisManager.get_client()
            if client is not None:
                await client.ping()
                logger.debug("Redis keepalive ping OK")
        except Exception as exc:
            logger.warning("Redis keepalive ping failed — resetting client: %s", exc)
            RedisManager.reset()


def start_keepalive(interval: int = 45) -> asyncio.Task:
    """Schedule the keepalive loop as an asyncio background task.
    Call this inside a FastAPI lifespan startup block."""
    return asyncio.create_task(_keepalive_loop(interval))


# ---------------------------------------------------------------------------
# Notification pub/sub helpers
# ---------------------------------------------------------------------------

async def publish_notification(user_id: str, payload: dict) -> None:
    """Publish a notification payload to the user's Redis channel (async)."""
    import json as _json
    try:
        client = RedisManager.get_client()
        channel = f"notifications:{user_id}"
        await client.publish(channel, _json.dumps(payload))
    except Exception as exc:
        logger.warning("publish_notification failed for user %s: %s", user_id, exc)


async def subscribe_notifications(user_id: str):
    """Async generator that yields raw JSON strings from the user's channel.

    Usage (inside an async generator / SSE route):
        async for message in subscribe_notifications(user_id):
            yield f"data: {message}\n\n"
    """
    import redis.asyncio as aioredis
    from app.core.config import settings

    # Each SSE connection needs its own dedicated pubsub object.
    client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = client.pubsub()
    channel = f"notifications:{user_id}"
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                yield message["data"]
    finally:
        await pubsub.unsubscribe(channel)
        await client.aclose()
