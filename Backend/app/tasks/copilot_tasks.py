"""
Celery tasks for the Co-Pilot feature.

Scheduled tasks (via Celery Beat):
  - generate_daily_briefs_task  — runs at 08:00 UTC daily
  - pipeline_scan_task          — runs every 6 hours

On-demand tasks:
  - send_brief_notification_task
  - send_pipeline_alert_notification_task
"""

import asyncio
import logging

from celery.schedules import crontab

from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Celery Beat schedule
# ---------------------------------------------------------------------------

celery_app.conf.beat_schedule = {
    "generate-daily-briefs": {
        "task": "app.tasks.copilot_tasks.generate_daily_briefs_task",
        "schedule": crontab(hour=8, minute=0),  # 08:00 UTC daily
    },
    "pipeline-scan": {
        "task": "app.tasks.copilot_tasks.pipeline_scan_task",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
}


# ---------------------------------------------------------------------------
# Scheduled: generate daily briefs for all opted-in users
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.generate_daily_briefs_task")
def generate_daily_briefs_task():
    """Generate today's daily brief for every user who has it enabled."""
    return asyncio.run(_generate_all_daily_briefs())


async def _generate_all_daily_briefs():
    from app.db.models.copilot_preferences import CopilotUserPreferences
    from app.services.copilot.daily_brief_service import DailyBriefService
    from app.services.copilot.notification_service import NotificationService

    db = SessionLocal()
    notifier = NotificationService()
    generated = 0
    errors = 0

    try:
        prefs_list = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.daily_brief_enabled == True)
            .all()
        )
        logger.info("Generating daily briefs for %d users", len(prefs_list))

        for prefs in prefs_list:
            user_id = str(prefs.user_id)
            try:
                svc = DailyBriefService(db)
                brief = await svc.generate(user_id)
                generated += 1

                if prefs.notify_email or prefs.notify_slack:
                    to_email = _get_user_email(db, user_id) if prefs.notify_email else None
                    slack_url = prefs.slack_webhook_url if prefs.notify_slack else None
                    notifier.send_daily_brief(
                        to_email=to_email,
                        slack_webhook_url=slack_url,
                        brief=brief,
                    )
            except Exception as exc:
                logger.error("Failed to generate brief for user %s: %s", user_id, exc)
                errors += 1
    finally:
        db.close()

    logger.info("Daily brief generation complete. generated=%d errors=%d", generated, errors)
    return {"generated": generated, "errors": errors}


# ---------------------------------------------------------------------------
# Scheduled: pipeline scan placeholder
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.pipeline_scan_task")
def pipeline_scan_task():
    """
    Placeholder scheduled pipeline scan.

    The scan is currently triggered on-demand from the frontend.
    This task will run rule-based checks once CRM integration is available.
    """
    logger.info("Scheduled pipeline scan task ran — no CRM integration yet.")
    return {"status": "noop"}


# ---------------------------------------------------------------------------
# On-demand: send brief notification for a single user
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.send_brief_notification_task")
def send_brief_notification_task(user_id: str, brief: dict):
    """Send a daily-brief notification for a specific user (fire-and-forget)."""
    from app.db.models.copilot_preferences import CopilotUserPreferences
    from app.services.copilot.notification_service import NotificationService

    db = SessionLocal()
    try:
        prefs = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.user_id == user_id)
            .first()
        )
        if not prefs:
            return {"status": "no_prefs"}

        notifier = NotificationService()
        to_email = _get_user_email(db, user_id) if prefs.notify_email else None
        slack_url = prefs.slack_webhook_url if prefs.notify_slack else None

        notifier.send_daily_brief(
            to_email=to_email,
            slack_webhook_url=slack_url,
            brief=brief,
        )
        return {"status": "sent"}
    except Exception as exc:
        logger.error("send_brief_notification_task failed for user %s: %s", user_id, exc)
        return {"status": "error", "detail": str(exc)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# On-demand: send pipeline alert notification
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.send_pipeline_alert_notification_task")
def send_pipeline_alert_notification_task(
    user_id: str,
    alert_title: str,
    alert_description: str,
    recommendation: str,
    severity: str = "medium",
):
    """Send a pipeline alert notification for a specific user (fire-and-forget)."""
    from app.db.models.copilot_preferences import CopilotUserPreferences
    from app.services.copilot.notification_service import NotificationService

    db = SessionLocal()
    try:
        prefs = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.user_id == user_id)
            .first()
        )
        if not prefs:
            return {"status": "no_prefs"}

        notifier = NotificationService()
        to_email = _get_user_email(db, user_id) if prefs.notify_email else None
        slack_url = prefs.slack_webhook_url if prefs.notify_slack else None

        notifier.send_pipeline_alert(
            to_email=to_email,
            slack_webhook_url=slack_url,
            alert_title=alert_title,
            alert_description=alert_description,
            recommendation=recommendation,
            severity=severity,
        )
        return {"status": "sent"}
    except Exception as exc:
        logger.error(
            "send_pipeline_alert_notification_task failed for user %s: %s", user_id, exc
        )
        return {"status": "error", "detail": str(exc)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_email(db, user_id: str) -> str | None:
    """Return the email for a user ID, best-effort (returns None on any error)."""
    try:
        from app.db.models.user import User  # noqa: F401
        user = db.query(User).filter(User.id == user_id).first()
        return getattr(user, "email", None)
    except Exception:
        return None
