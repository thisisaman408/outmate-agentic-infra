import redis.asyncio as redis
from app.core.config import REDIS_URL

class RedisManager:
    client: redis.Redis = None

    @classmethod
    def connect(cls):
        if cls.client is None:
            import redis as sync_redis
            from app.core.config import REDIS_URL
            
            # Use synchronous client for initial ping check to avoid blocking
            try:
                checker = sync_redis.from_url(REDIS_URL, socket_timeout=1)
                checker.ping()
                print("Connected to Redis")
            except Exception as e:
                print(f"ERROR: Could not connect to Redis at {REDIS_URL}: {e}")
                print("PLEASE ENSURE REDIS SERVER IS RUNNING.")
                # We still create the client but it will fail on use
            
            cls.client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                encoding="utf-8",
            )

    @classmethod
    async def close(cls):
        if cls.client:
            await cls.client.close()
            cls.client = None
            print("Closed Redis connection")

    @classmethod
    def get_client(cls) -> redis.Redis:
        if cls.client is None:
            cls.connect()
        return cls.client

# Dependency for FastAPI
async def get_redis() -> redis.Redis:
    if RedisManager.client is None:
         RedisManager.connect()
    return RedisManager.client

