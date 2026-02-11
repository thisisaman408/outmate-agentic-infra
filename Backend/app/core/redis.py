import redis.asyncio as redis
from app.core.config import REDIS_URL

class RedisManager:
    client: redis.Redis = None

    @classmethod
    def connect(cls):
        if cls.client is None:
            cls.client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                encoding="utf-8",
            )
            print("Connected to Redis")

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

