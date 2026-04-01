"""
Signal Archiver — Archive signals older than 7 days.

Signals beyond the 7-day freshness window are archived and not served in active feeds.
Archival is triggered by Celery task running daily.
"""

import logging
from datetime import datetime, timedelta
from typing import Tuple

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.signal_event import SignalEvent

logger = logging.getLogger(__name__)

SIGNAL_FRESHNESSDAYS = 7


class SignalArchiver:
    """Archive stale signals."""

    def __init__(self, db: Session):
        self.db = db

    async def archive_stale_signals(self) -> Tuple[int, int]:
        """
        Archive signals older than 7 days.

        Returns:
            Tuple of (archived_count, error_count)
        """
        try:
            # Calculate cutoff time
            cutoff_time = datetime.utcnow() - timedelta(days=SIGNAL_FRESHNESSDAYS)

            logger.info(f"Archiving signals older than {cutoff_time}")

            # Query stale unarchived signals
            stale_signals = self.db.query(SignalEvent).filter(
                and_(
                    SignalEvent.discovered_at < cutoff_time,
                    SignalEvent.is_archived == False,
                )
            ).all()

            archived_count = 0
            for signal in stale_signals:
                try:
                    signal.is_archived = True
                    signal.archived_at = datetime.utcnow()
                    self.db.add(signal)
                    archived_count += 1
                except Exception as e:
                    logger.error(f"Failed to archive signal {signal.id}: {e}")

            self.db.commit()
            logger.info(f"Archived {archived_count} stale signals")

            return archived_count, 0
        except Exception as e:
            logger.error(f"Signal archival failed: {e}", exc_info=True)
            self.db.rollback()
            return 0, 1

    async def get_active_signal_count(self) -> int:
        """Get count of non-archived signals."""
        try:
            count = self.db.query(SignalEvent).filter_by(is_archived=False).count()
            return count
        except Exception as e:
            logger.error(f"Failed to get active signal count: {e}")
            return 0

    async def get_archived_signal_count(self) -> int:
        """Get count of archived signals."""
        try:
            count = self.db.query(SignalEvent).filter_by(is_archived=True).count()
            return count
        except Exception as e:
            logger.error(f"Failed to get archived signal count: {e}")
            return 0
