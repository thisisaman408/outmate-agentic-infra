import json
from typing import Any, Optional
from app.core.redis import RedisManager

class RedisService:
    def __init__(self):
        self.redis = RedisManager.get_client()

    async def get_cached_filter_result(self, filter_key: str) -> Optional[Any]:
        """
        Get cached response for specific filters.
        'filter_key' should be a unique hash or string representing the filter state.
        """
        data = await self.redis.get(f"filter:{filter_key}")
        if data:
            return json.loads(data)
        return None

    async def set_cached_filter_result(self, filter_key: str, value: Any, ttl: int = 3600):
        """
        Cache filter response to ensure instant response for same filters.
        Default TTL: 1 hour.
        """
        await self.redis.setex(f"filter:{filter_key}", ttl, json.dumps(value))

    async def get_crustdata(self, identifier: str) -> Optional[Any]:
        """
        Retrieve Crustdata if it has been called once already.
        """
        data = await self.redis.get(f"crustdata:{identifier}")
        if data:
            return json.loads(data)
        return None

    async def set_crustdata(self, identifier: str, data: Any, ttl: int = 86400):
        """
        Store Crustdata response to prevent re-fetching.
        Default TTL: 24 hours (or longer/indefinite as needed).
        """
        await self.redis.setex(f"crustdata:{identifier}", ttl, json.dumps(data))

    async def initialize_user_credits(self, user_id: str, amount: int):
        """Set initial credits for a user if not exists."""
        await self.redis.setnx(f"credits:{user_id}", amount)

    async def get_user_credits(self, user_id: str) -> int:
        """Get available credits."""
        val = await self.redis.get(f"credits:{user_id}")
        return int(val) if val else 0

    async def consume_credit(self, user_id: str, cost: int = 1) -> bool:
        """
        Atomically check and deduct credits.
        Returns True if credits were deducted, False if insufficient balance.
        """
        # Lua script for atomic check-and-decrement
        lua_script = """
        local current = tonumber(redis.call('get', KEYS[1]) or 0)
        if current >= tonumber(ARGV[1]) then
            redis.call('decrby', KEYS[1], ARGV[1])
            return 1
        else
            return 0
        end
        """
        # keys=[key_name], args=[cost]
        result = await self.redis.eval(lua_script, 1, f"credits:{user_id}", cost)
        return bool(result)
