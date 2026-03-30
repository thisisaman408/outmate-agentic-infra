import logging
from app.schemas.signal_event import SignalEvent

logger = logging.getLogger(__name__)
HOT_TYPES = {"interested_reply", "champion_move"}
HOT_ICP_THRESHOLD = 80.0
QUEUE_KEY_PREFIX = "signal_events"
QUEUE_TTL_SECONDS = 86400 * 2


async def push_signal_event(event: SignalEvent) -> None:
    from app.core.redis import get_redis
    redis = await get_redis()
    key = f"{QUEUE_KEY_PREFIX}:{event.user_id}"
    await redis.rpush(key, event.model_dump_json())
    await redis.expire(key, QUEUE_TTL_SECONDS)
    is_hot = event.icp_score >= HOT_ICP_THRESHOLD or event.type in HOT_TYPES
    if is_hot:
        from app.core.celery_app import celery_app
        celery_app.send_task(
            "app.tasks.copilot_tasks.send_hot_signal_slack",
            args=[event.model_dump(mode="json")],
        )


async def drain_signal_queue(redis, user_id: str) -> list:
    key = f"{QUEUE_KEY_PREFIX}:{user_id}"
    async with redis.pipeline(transaction=True) as pipe:
        await pipe.lrange(key, 0, -1)
        await pipe.delete(key)
        results = await pipe.execute()
    raw_list = results[0]
    events = []
    for raw in raw_list:
        try:
            events.append(SignalEvent.model_validate_json(raw))
        except Exception as exc:
            logger.warning("Malformed signal event dropped: %s | %s", raw, exc)
    return events
