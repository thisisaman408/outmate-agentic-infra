"""
Signal Event Bus — Redis Streams-based event broker.

Handles:
- Publishing raw signal events to stream
- Consuming + processing signals
- Publishing enriched signals to Co-Pilot queue
- Manages consumer groups for fault tolerance

Stream: outmate:signals:stream:events
Consumer Group: signal-processors
Co-Pilot Queue: outmate:signals:copilot:queue
"""

import json
import logging
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime

from app.core.redis import RedisManager

logger = logging.getLogger(__name__)

# Stream and queue keys
SIGNAL_STREAM_KEY = "outmate:signals:stream:events"
COPILOT_QUEUE_KEY = "outmate:signals:copilot:queue"
CONSUMER_GROUP = "signal-processors"
CONSUMER_NAME = "signal-processor-1"


class SignalEventPayload:
    """Request model for publishing a signal event."""

    def __init__(
        self,
        signal_type: str,
        source: str,
        company_domain: Optional[str] = None,
        company_name: Optional[str] = None,
        prospect_email: Optional[str] = None,
        prospect_name: Optional[str] = None,
        raw_data: Optional[Dict[str, Any]] = None,
        discovered_at: Optional[datetime] = None,
    ):
        self.signal_type = signal_type
        self.source = source
        self.company_domain = company_domain
        self.company_name = company_name
        self.prospect_email = prospect_email
        self.prospect_name = prospect_name
        self.raw_data = raw_data or {}
        self.discovered_at = discovered_at or datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "signal_type": self.signal_type,
            "source": self.source,
            "company_domain": self.company_domain or "",
            "company_name": self.company_name or "",
            "prospect_email": self.prospect_email or "",
            "prospect_name": self.prospect_name or "",
            "raw_data": json.dumps(self.raw_data),
            "discovered_at": self.discovered_at.isoformat(),
        }


class EnrichedSignal:
    """Enriched signal ready for Co-Pilot queue."""

    def __init__(
        self,
        signal_id: str,
        signal_type: str,
        company_domain: str,
        company_name: str,
        prospect_email: Optional[str],
        prospect_name: Optional[str],
        icp_score: int,
        icp_match_factors: List[str],
        credits_consumed: int,
        raw_data: Dict[str, Any],
    ):
        self.signal_id = signal_id
        self.signal_type = signal_type
        self.company_domain = company_domain
        self.company_name = company_name
        self.prospect_email = prospect_email
        self.prospect_name = prospect_name
        self.icp_score = icp_score
        self.icp_match_factors = icp_match_factors
        self.credits_consumed = credits_consumed
        self.raw_data = raw_data

    def to_dict(self) -> Dict[str, Any]:
        return {
            "signal_id": self.signal_id,
            "signal_type": self.signal_type,
            "company_domain": self.company_domain,
            "company_name": self.company_name,
            "prospect_email": self.prospect_email or "",
            "prospect_name": self.prospect_name or "",
            "icp_score": self.icp_score,
            "icp_match_factors": self.icp_match_factors,
            "credits_consumed": self.credits_consumed,
            "timestamp": datetime.utcnow().isoformat(),
        }


class SignalEventBus:
    """Redis Streams orchestrator for signal events.

    Why we don't just reuse RedisManager.client:
      redis.asyncio clients are bound to the event loop they were created
      on.  Our singleton client is created under FastAPI's uvicorn loop,
      but Celery tasks call this class inside `asyncio.run(...)` which
      creates a fresh loop per task.  Reusing the singleton raises
      `Event loop is closed` on the first await.  Solution: open a
      throwaway client bound to the current loop.  Cheap — one TCP
      connection that lives for the ~100ms duration of the task.
    """

    def __init__(self):
        # Fresh loop-local client — see RedisManager.new_loop_local_client
        # for why reusing the singleton across asyncio.run() loops fails.
        try:
            self.redis = RedisManager.new_loop_local_client()
            self._owns_client = True
        except Exception as exc:
            logger.warning("SignalEventBus couldn't open its own Redis client (%s); "
                           "falling back to RedisManager singleton", exc)
            self.redis = RedisManager.client
            self._owns_client = False

        if not self.redis:
            logger.warning("Redis not available for SignalEventBus")

    async def aclose(self) -> None:
        """Close the loop-local client.  Safe to call multiple times.
        Invoke at the end of the task to release the TCP connection
        immediately; otherwise GC handles it but triggers a harmless
        `Unclosed client session` warning."""
        if self._owns_client and self.redis is not None:
            try:
                await self.redis.close()
            except Exception as exc:  # noqa: BLE001
                logger.debug("SignalEventBus close failed (non-fatal): %s", exc)
            self.redis = None

    async def ensure_consumer_group(self) -> bool:
        """Ensure consumer group exists. Create if missing (idempotent)."""
        if not self.redis:
            return False

        try:
            await self.redis.xgroup_create(
                SIGNAL_STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True
            )
            logger.info(f"Created consumer group {CONSUMER_GROUP}")
            return True
        except Exception as e:
            # Group likely already exists
            if "BUSYGROUP" in str(e):
                logger.debug(f"Consumer group {CONSUMER_GROUP} already exists")
                return True
            logger.error(f"Failed to create consumer group: {e}")
            return False

    async def publish_signal(self, event: SignalEventPayload) -> Optional[str]:
        """
        Publish a raw signal event to the stream.

        Args:
            event: SignalEventPayload with raw signal data

        Returns:
            Stream ID if published, None if failed
        """
        if not self.redis:
            logger.warning("Redis unavailable; signal not published")
            return None

        try:
            event_data = event.to_dict()
            stream_id = await self.redis.xadd(SIGNAL_STREAM_KEY, event_data)
            logger.debug(f"Published signal to stream: {stream_id}")
            return stream_id
        except Exception as e:
            logger.error(f"Failed to publish signal: {e}")
            return None

    async def consume_signals(self, count: int = 100, block_ms: int = 1000) -> List[Dict[str, Any]]:
        """
        Consume pending signals from stream (non-destructive).

        Args:
            count: Max signals to consume per call
            block_ms: Blocking timeout in ms

        Returns:
            List of (stream_id, data_dict) tuples
        """
        if not self.redis:
            return []

        try:
            # Ensure consumer group exists
            await self.ensure_consumer_group()

            # Read pending messages from consumer group.
            # redis-py signature is xreadgroup(groupname, consumername,
            # streams, count=None, block=None) — the original code had
            # the first three args in the wrong order, which made the
            # library validate `streams` against the consumername string
            # and throw "XREADGROUP streams must be a non empty dict"
            # on every call.  Fixed here.
            messages = await self.redis.xreadgroup(
                CONSUMER_GROUP,
                CONSUMER_NAME,
                {SIGNAL_STREAM_KEY: ">"},
                count=count,
                block=block_ms,
            )

            results = []
            if messages:
                for stream_key, stream_messages in messages:
                    for msg_id, data in stream_messages:
                        # Decode binary keys/values to strings
                        decoded_data = {}
                        for k, v in data.items():
                            key = k.decode() if isinstance(k, bytes) else k
                            value = v.decode() if isinstance(v, bytes) else v
                            decoded_data[key] = value

                        results.append({"stream_id": msg_id.decode(), "data": decoded_data})

            logger.debug(f"Consumed {len(results)} signals from stream")
            return results
        except Exception as e:
            logger.error(f"Failed to consume signals: {e}")
            return []

    async def acknowledge_signal(self, stream_id: str) -> bool:
        """
        Acknowledge a consumed signal (removes from pending).

        Args:
            stream_id: Stream message ID

        Returns:
            True if ack succeeded
        """
        if not self.redis:
            return False

        try:
            await self.redis.xack(SIGNAL_STREAM_KEY, CONSUMER_GROUP, stream_id)
            logger.debug(f"Acknowledged signal: {stream_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to acknowledge signal: {e}")
            return False

    async def publish_to_copilot_queue(self, signal: EnrichedSignal) -> bool:
        """
        Publish enriched signal to Co-Pilot queue (Redis list).

        Args:
            signal: EnrichedSignal ready for Co-Pilot consumption

        Returns:
            True if published
        """
        if not self.redis:
            logger.warning("Redis unavailable; signal not sent to Co-Pilot queue")
            return False

        try:
            signal_json = json.dumps(signal.to_dict())
            await self.redis.rpush(COPILOT_QUEUE_KEY, signal_json)
            logger.debug(f"Published signal to Co-Pilot queue: {signal.signal_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish to Co-Pilot queue: {e}")
            return False

    async def peek_copilot_queue(self, count: int = 10) -> List[Dict[str, Any]]:
        """
        Peek at Co-Pilot queue without consuming (for debugging).

        Args:
            count: Max items to peek

        Returns:
            List of queued signals
        """
        if not self.redis:
            return []

        try:
            items = await self.redis.lrange(COPILOT_QUEUE_KEY, 0, count - 1)
            result = []
            for item in items:
                if isinstance(item, bytes):
                    item = item.decode()
                result.append(json.loads(item))
            return result
        except Exception as e:
            logger.error(f"Failed to peek Co-Pilot queue: {e}")
            return []

    async def get_stream_stats(self) -> Dict[str, Any]:
        """Get stream health stats."""
        if not self.redis:
            return {}

        try:
            info = await self.redis.xinfo_stream(SIGNAL_STREAM_KEY)
            pending = await self.redis.xpending(SIGNAL_STREAM_KEY, CONSUMER_GROUP)

            return {
                "stream_length": info["length"],
                "consumer_count": info["groups"][0]["consumers"] if info.get("groups") else 0,
                "pending_messages": pending["pending"],
            }
        except Exception as e:
            logger.warning(f"Failed to get stream stats: {e}")
            return {}
