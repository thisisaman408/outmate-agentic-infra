"""Data-access layer for Co-Pilot in-app notifications."""

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.copilot_notification import CopilotNotification

logger = logging.getLogger(__name__)

# Keep at most 50 notifications per user.
MAX_NOTIFICATIONS = 50

# Grouping window: same company + same type within this many minutes → merge.
GROUP_WINDOW_MINUTES = 60


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def create(
        self,
        user_id: str,
        type: str,
        title: str,
        body: str,
        cta_url: str = "",
        priority: str = "green",
        company: Optional[str] = None,
    ) -> CopilotNotification:
        """
        Insert a new notification.
        - Checks grouping: same company+type within GROUP_WINDOW_MINUTES → increment grouped_count only.
        - Prunes oldest rows to keep ≤ MAX_NOTIFICATIONS per user.
        - Publishes to Redis for SSE delivery.
        """
        # 1. Grouping check (skip for types that should never group)
        if company and type not in ("meeting_prep_ready",):
            existing = self._find_group_candidate(user_id, type, company)
            if existing:
                existing.grouped_count += 1
                existing.is_read = False  # resurface unread
                existing.created_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(existing)
                self._publish(user_id, existing)
                return existing

        # 2. Insert
        notif = CopilotNotification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            cta_url=cta_url,
            priority=priority,
        )
        self.db.add(notif)
        self.db.flush()  # get id before prune

        # 3. Prune oldest rows if over limit
        self._prune(user_id)

        self.db.commit()
        self.db.refresh(notif)
        self._publish(user_id, notif)
        return notif

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def list_for_user(
        self,
        user_id: str,
        limit: int = 50,
        unread_only: bool = False,
    ) -> List[CopilotNotification]:
        q = self.db.query(CopilotNotification).filter(
            CopilotNotification.user_id == user_id
        )
        if unread_only:
            q = q.filter(CopilotNotification.is_read == False)
        return q.order_by(CopilotNotification.created_at.desc()).limit(limit).all()

    def count_unread(self, user_id: str) -> int:
        return (
            self.db.query(CopilotNotification)
            .filter(
                CopilotNotification.user_id == user_id,
                CopilotNotification.is_read == False,
            )
            .count()
        )

    # ------------------------------------------------------------------
    # Mark read
    # ------------------------------------------------------------------

    def mark_read(self, user_id: str, notif_id: UUID) -> Optional[CopilotNotification]:
        notif = (
            self.db.query(CopilotNotification)
            .filter(
                CopilotNotification.id == notif_id,
                CopilotNotification.user_id == user_id,
            )
            .first()
        )
        if notif:
            notif.is_read = True
            self.db.commit()
        return notif

    def mark_all_read(self, user_id: str) -> int:
        updated = (
            self.db.query(CopilotNotification)
            .filter(
                CopilotNotification.user_id == user_id,
                CopilotNotification.is_read == False,
            )
            .update({"is_read": True}, synchronize_session=False)
        )
        self.db.commit()
        return updated

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _find_group_candidate(
        self, user_id: str, type: str, company: str
    ) -> Optional[CopilotNotification]:
        """Find an existing notification for same user+type that mentions company."""
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=GROUP_WINDOW_MINUTES)
        candidates = (
            self.db.query(CopilotNotification)
            .filter(
                CopilotNotification.user_id == user_id,
                CopilotNotification.type == type,
                CopilotNotification.created_at >= cutoff,
            )
            .all()
        )
        company_lower = company.lower()
        for c in candidates:
            if company_lower in c.title.lower() or company_lower in c.body.lower():
                return c
        return None

    def _prune(self, user_id: str) -> None:
        """Delete oldest notifications beyond MAX_NOTIFICATIONS for this user."""
        total = (
            self.db.query(CopilotNotification)
            .filter(CopilotNotification.user_id == user_id)
            .count()
        )
        if total <= MAX_NOTIFICATIONS:
            return
        excess = total - MAX_NOTIFICATIONS
        oldest_ids = (
            self.db.query(CopilotNotification.id)
            .filter(CopilotNotification.user_id == user_id)
            .order_by(CopilotNotification.created_at.asc())
            .limit(excess)
            .all()
        )
        ids = [row[0] for row in oldest_ids]
        self.db.query(CopilotNotification).filter(
            CopilotNotification.id.in_(ids)
        ).delete(synchronize_session=False)

    def _publish(self, user_id: str, notif: CopilotNotification) -> None:
        """Best-effort publish to Redis for SSE delivery."""
        try:
            from app.core.redis import RedisManager
            import asyncio

            payload = {
                "id": str(notif.id),
                "type": notif.type,
                "title": notif.title,
                "body": notif.body,
                "cta_url": notif.cta_url,
                "priority": notif.priority,
                "is_read": notif.is_read,
                "grouped_count": notif.grouped_count,
                "created_at": notif.created_at.isoformat(),
            }

            # Celery workers run sync; we publish via sync Redis.
            import redis as sync_redis
            from app.core.config import settings

            r = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)
            channel = f"notifications:{user_id}"
            r.publish(channel, json.dumps(payload))
        except Exception as exc:
            logger.warning("Notification Redis publish failed (non-fatal): %s", exc)
