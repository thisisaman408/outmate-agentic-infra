"""
Signal Deduplicator — Suppress duplicate signals within 24-hour window.

Uses Redis to track seen signals. If same signal (by fingerprint) seen within 24hr,
the new one is suppressed.
"""

import logging
from typing import Optional

from app.core.redis import RedisManager

logger = logging.getLogger(__name__)

# Redis key prefix for dedup tracking (24hr TTL)
DEDUP_KEY_PREFIX = "outmate:signals:dedup:24h"

# 24 hours in seconds
DEDUP_WINDOW_SECONDS = 24 * 3600


class SignalDeduplicator:
    """Check and enforce 24-hour signal dedup window."""

    def __init__(self):
        self.redis = RedisManager.client
        if not self.redis:
            logger.warning("Redis not available for SignalDeduplicator")

    async def should_suppress(
        self,
        fingerprint: str,
        company_domain: Optional[str] = None,
        signal_type: Optional[str] = None,
    ) -> bool:
        """
        Check if signal should be suppressed due to 24-hour dedup window.

        Args:
            fingerprint: MD5 fingerprint of signal
            company_domain: Company domain (for logging)
            signal_type: Signal type (for logging)

        Returns:
            True if should suppress, False if should process
        """
        if not self.redis:
            return False

        if not fingerprint:
            return False

        try:
            # Construct dedup key
            dedup_key = f"{DEDUP_KEY_PREFIX}:{fingerprint}"

            # Check if key exists (i.e., we've seen this signal before)
            exists = await self.redis.exists(dedup_key)

            if exists:
                logger.info(
                    f"Suppressing duplicate signal: type={signal_type}, "
                    f"domain={company_domain}, fingerprint={fingerprint}"
                )
                return True

            return False
        except Exception as e:
            logger.error(f"Dedup check failed: {e}")
            # On error, do NOT suppress (be permissive)
            return False

    async def mark_processed(
        self,
        fingerprint: str,
        company_domain: Optional[str] = None,
        signal_type: Optional[str] = None,
    ) -> bool:
        """
        Mark a signal as processed (prevents duplicates for 24 hours).

        Args:
            fingerprint: MD5 fingerprint of signal
            company_domain: Company domain (for logging)
            signal_type: Signal type (for logging)

        Returns:
            True if marked, False if failed
        """
        if not self.redis:
            return False

        if not fingerprint:
            return False

        try:
            dedup_key = f"{DEDUP_KEY_PREFIX}:{fingerprint}"

            # Set key with 24-hour TTL
            await self.redis.setex(dedup_key, DEDUP_WINDOW_SECONDS, "1")

            logger.debug(
                f"Marked signal as processed: type={signal_type}, "
                f"domain={company_domain}, fingerprint={fingerprint}, "
                f"ttl={DEDUP_WINDOW_SECONDS}s"
            )

            return True
        except Exception as e:
            logger.error(f"Failed to mark signal as processed: {e}")
            return False

    async def get_dedup_stats(self) -> dict:
        """Get dedup cache statistics."""
        if not self.redis:
            return {}

        try:
            info = await self.redis.info("keyspace")
            return {"redis_info": info}
        except Exception as e:
            logger.warning(f"Failed to get dedup stats: {e}")
            return {}
