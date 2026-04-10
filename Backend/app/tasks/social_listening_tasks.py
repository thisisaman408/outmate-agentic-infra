"""Celery tasks for the Social Listening feature.

`poll_due_social_searches` is the engine of "continuous monitoring" — it
runs on a 15-minute beat and dispatches the discovery agent for every
active `social_listening` watcher whose schedule says it's due.

Why poll instead of cron-per-watcher?  Because a user can create a new
watcher at any time and we don't want to register a new beat entry per
user — that doesn't scale.  Instead, every 15 min the task asks "which
of my active watchers haven't run for ≥1h / 24h / 7d (per their
schedule), and runs them."
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from celery import shared_task

from app.db.deps import SessionLocal
from app.db.models.watcher import Watcher
from app.services.social_listening import SocialListeningService

logger = logging.getLogger(__name__)

# How long since last_synced_at qualifies a watcher as "due", per schedule.
SCHEDULE_TO_INTERVAL = {
    "hourly": timedelta(hours=1),
    "daily": timedelta(hours=24),
    "weekly": timedelta(days=7),
    # 'manual' is excluded from polling on purpose
}


@shared_task(name="app.tasks.social_listening_tasks.poll_due_social_searches")
def poll_due_social_searches() -> Dict[str, Any]:
    """Run discovery for every active social_listening watcher that's due.

    Returns a small summary so it shows up cleanly in flower / logs.
    """
    db = SessionLocal()
    started = datetime.now(timezone.utc)
    summary = {
        "checked": 0,
        "ran": 0,
        "skipped": 0,
        "errors": 0,
        "started_at": started.isoformat(),
    }

    try:
        watchers: List[Watcher] = (
            db.query(Watcher)
            .filter(Watcher.type == "social_listening", Watcher.status == "active")
            .all()
        )

        due_watchers: List[Watcher] = []
        now = datetime.now(timezone.utc)
        for w in watchers:
            summary["checked"] += 1
            schedule = ((w.criteria or {}).get("schedule") or "daily").lower()
            interval = SCHEDULE_TO_INTERVAL.get(schedule)
            if not interval:
                summary["skipped"] += 1
                continue
            if w.last_synced_at and (now - w.last_synced_at) < interval:
                summary["skipped"] += 1
                continue
            due_watchers.append(w)

        if not due_watchers:
            return summary

        # Run them sequentially.  At v1 scale (single-digit watchers per user),
        # parallelising would just hammer the agentic infra; the agent itself
        # already takes 30s-2min per call so spreading them is healthy backpressure.
        service = SocialListeningService(db)
        for w in due_watchers:
            try:
                result = asyncio.run(service.run_for_watcher(w))
                if result.get("status") == "success":
                    summary["ran"] += 1
                else:
                    summary["errors"] += 1
                db.commit()
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "social-listening poll failed for watcher_id=%s: %s",
                    w.id,
                    exc,
                )
                db.rollback()
                summary["errors"] += 1

    finally:
        db.close()

    summary["finished_at"] = datetime.now(timezone.utc).isoformat()
    logger.info("poll_due_social_searches summary=%s", summary)
    return summary
