"""
Celery tasks for the Co-Pilot feature.

Scheduled tasks (via Celery Beat):
  - check_and_generate_due_briefs  — heartbeat every 5 min, dispatches per-user brief tasks
  - pipeline_scan_task             — every 6 hours
  - delete_expired_briefs          — nightly cleanup at 00:10 UTC

On-demand tasks:
  - generate_brief_for_user_task
  - send_brief_notification_task
  - send_pipeline_alert_notification_task
  - send_hot_signal_slack
"""

import asyncio
import logging
from datetime import datetime, timezone

from celery.schedules import crontab

from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Celery Beat schedule
# ---------------------------------------------------------------------------

celery_app.conf.beat_schedule.update({
    "check-brief-schedule": {
        "task": "app.tasks.copilot_tasks.check_and_generate_due_briefs",
        "schedule": crontab(minute="*/5"),
    },
    "pipeline-scan": {
        "task": "app.tasks.copilot_tasks.pipeline_scan_task",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    "cleanup-expired-briefs": {
        "task": "app.tasks.copilot_tasks.delete_expired_briefs",
        "schedule": crontab(hour=0, minute=10),
    },
    "renew-calendar-webhooks": {
        "task": "app.tasks.copilot_tasks.renew_calendar_webhooks_task",
        "schedule": crontab(hour=6, minute=0),
    },
})


# ---------------------------------------------------------------------------
# Scheduled: heartbeat — check which users are due for a brief
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.check_and_generate_due_briefs")
def check_and_generate_due_briefs():
    """Every 5 minutes: find users whose brief time has come and dispatch per-user tasks."""
    return asyncio.run(_check_due_briefs())


async def _check_due_briefs():
    from app.db.models.copilot_preferences import CopilotUserPreferences
    from app.db.models.copilot_brief import CopilotBrief
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    from datetime import date

    db = SessionLocal()
    dispatched = 0
    try:
        prefs_list = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.daily_brief_enabled == True)
            .all()
        )

        for prefs in prefs_list:
            user_id = str(prefs.user_id)
            tz_str = prefs.daily_brief_timezone or "UTC"
            brief_time_str = prefs.daily_brief_time or "08:00"

            try:
                tz = ZoneInfo(tz_str)
            except (ZoneInfoNotFoundError, Exception):
                tz = ZoneInfo("UTC")

            local_now = datetime.now(tz)
            local_date = local_now.date()
            local_minutes = local_now.hour * 60 + local_now.minute

            try:
                h, m = [int(x) for x in brief_time_str.split(":")]
                target_minutes = h * 60 + m
            except Exception:
                target_minutes = 8 * 60  # default 08:00

            # ±2 minute window
            if abs(local_minutes - target_minutes) > 2:
                continue

            # Check if brief already generated for today
            existing = (
                db.query(CopilotBrief)
                .filter(
                    CopilotBrief.user_id == user_id,
                    CopilotBrief.brief_date == local_date,
                )
                .first()
            )
            if existing:
                continue

            generate_brief_for_user_task.delay(
                user_id=user_id,
                local_date_iso=local_date.isoformat(),
                tz_str=tz_str,
                notify_email=bool(prefs.notify_email),
                notify_slack=bool(prefs.notify_slack),
            )
            dispatched += 1
            logger.info("Dispatched brief task for user %s (%s)", user_id, local_date.isoformat())

    finally:
        db.close()

    logger.info("Brief heartbeat done. dispatched=%d", dispatched)
    return {"dispatched": dispatched}


# ---------------------------------------------------------------------------
# On-demand: generate brief for a single user (dispatched by heartbeat)
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.generate_brief_for_user_task", bind=True, max_retries=2)
def generate_brief_for_user_task(
    self,
    user_id: str,
    local_date_iso: str | None = None,
    tz_str: str = "UTC",
    notify_email: bool = False,
    notify_slack: bool = False,
):
    """Generate a daily brief for a single user and optionally send notifications."""
    try:
        return asyncio.run(
            _generate_for_user(user_id, local_date_iso, tz_str, notify_email, notify_slack)
        )
    except Exception as exc:
        logger.error("generate_brief_for_user_task failed for %s: %s", user_id, exc)
        raise self.retry(exc=exc, countdown=60)


async def _generate_for_user(
    user_id: str,
    local_date_iso: str | None,
    tz_str: str,
    notify_email: bool,
    notify_slack: bool,
):
    from app.services.copilot.daily_brief_service import DailyBriefService, _extract_first_name
    from app.services.signal_event_service import drain_signal_queue
    from app.core.redis import get_redis

    db = SessionLocal()
    try:
        user_email = _get_user_email(db, user_id) or ""
        first_name = _extract_first_name(user_email) if user_email else "there"

        redis = await get_redis()
        events = await drain_signal_queue(redis, user_id)

        svc = DailyBriefService(db)
        brief = await svc.generate(
            user_id,
            first_name=first_name,
            events=events,
            local_date_iso=local_date_iso,
            tz_str=tz_str,
        )

        if notify_email or notify_slack:
            send_brief_notification_task.delay(user_id, brief)

        # In-app notification
        try:
            from app.db.repositories.notification_repository import NotificationRepository
            from app.db.models.copilot_notification import CopilotNotification
            from datetime import datetime, timezone, timedelta

            repo = NotificationRepository(db)

            # Check if a brief_ready notification already exists for today (within last 24 hours)
            one_day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
            existing = (
                db.query(CopilotNotification)
                .filter(
                    CopilotNotification.user_id == user_id,
                    CopilotNotification.type == "brief_ready",
                    CopilotNotification.created_at >= one_day_ago,
                )
                .first()
            )

            if not existing:
                repo.create(
                    user_id=user_id,
                    type="brief_ready",
                    title="Your Daily Brief Is Ready",
                    body="Today's pipeline summary and priority actions are ready to review.",
                    cta_url="/copilot/daily-brief",
                    priority="green",
                )
            else:
                logger.info("brief_ready notification already exists for user %s, skipping creation", user_id)
        except Exception as _ne:
            logger.warning("Failed to create brief_ready notification: %s", _ne)

        return {"status": "generated", "user_id": user_id}
    finally:
        db.close()


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
# Scheduled: nightly cleanup of expired briefs
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.delete_expired_briefs")
def delete_expired_briefs():
    """Remove briefs whose expires_at is in the past."""
    from app.db.models.copilot_brief import CopilotBrief

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        deleted = (
            db.query(CopilotBrief)
            .filter(CopilotBrief.expires_at != None, CopilotBrief.expires_at < now)
            .delete(synchronize_session=False)
        )
        db.commit()
        logger.info("Deleted %d expired briefs", deleted)
        return {"deleted": deleted}
    except Exception as exc:
        logger.error("delete_expired_briefs failed: %s", exc)
        db.rollback()
        return {"error": str(exc)}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# On-demand: send brief notification for a single user
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.send_brief_notification_task", bind=True, max_retries=3)
def send_brief_notification_task(self, user_id: str, brief: dict):
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
            logger.warning("send_brief_notification_task: no prefs found for user %s", user_id)
            return {"status": "no_prefs"}

        logger.info("send_brief_notification_task: prefs for user %s - notify_email=%s, notify_slack=%s, slack_webhook_url=%s",
                    user_id, prefs.notify_email, prefs.notify_slack, prefs.slack_webhook_url)

        notifier = NotificationService()
        to_email = _get_user_email(db, user_id) if prefs.notify_email else None
        slack_url = prefs.slack_webhook_url if prefs.notify_slack else None

        logger.info("send_brief_notification_task: sending - to_email=%s, slack_url=%s", to_email, slack_url)

        notifier.send_daily_brief(
            to_email=to_email,
            slack_webhook_url=slack_url,
            brief=brief,
        )
        logger.info("send_brief_notification_task: sent successfully for user %s", user_id)
        return {"status": "sent"}
    except Exception as exc:
        logger.error("send_brief_notification_task failed for user %s: %s", user_id, exc)
        raise self.retry(exc=exc, countdown=30)
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
# On-demand: send hot signal Slack notification
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.send_hot_signal_slack", bind=True, max_retries=3)
def send_hot_signal_slack(self, event_data: dict):
    """Send a Slack Block Kit message for a hot signal event."""
    from app.db.models.copilot_preferences import CopilotUserPreferences
    from app.services.copilot.notification_service import NotificationService

    user_id = event_data.get("user_id")
    if not user_id:
        return {"status": "no_user_id"}

    db = SessionLocal()
    try:
        prefs = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.user_id == user_id)
            .first()
        )
        if not prefs or not prefs.notify_slack or not prefs.slack_webhook_url:
            return {"status": "slack_not_configured"}

        blocks = _build_hot_signal_block(event_data)
        notifier = NotificationService()
        notifier.send_slack_blocks(
            webhook_url=prefs.slack_webhook_url,
            blocks=blocks,
            text=f"Hot signal: {event_data.get('company')} — {event_data.get('type')}",
        )

        # In-app notification
        company = event_data.get("company", "Unknown")
        contact = event_data.get("contact", "Unknown")
        try:
            from app.db.repositories.notification_repository import NotificationRepository
            repo = NotificationRepository(db)
            repo.create(
                user_id=user_id,
                type="hot_signal",
                title=f"Hot Signal: {company} ICP Match",
                body=f"{company} scored 80+ on ICP. {contact} is likely a buyer.",
                cta_url="/copilot/pipeline-alerts",
                priority="red",
                company=company,
            )
        except Exception as _ne:
            logger.warning("Failed to create hot_signal notification: %s", _ne)

        return {"status": "sent"}
    except Exception as exc:
        logger.error("send_hot_signal_slack failed for user %s: %s", user_id, exc)
        raise self.retry(exc=exc, countdown=30)
    finally:
        db.close()


def _build_hot_signal_block(event_data: dict) -> list:
    """Build a Slack Block Kit message for a hot signal."""
    company = event_data.get("company", "Unknown")
    contact = event_data.get("contact", "Unknown")
    signal_type = event_data.get("type", "signal").upper()
    icp_score = event_data.get("icp_score", 0)
    context = event_data.get("signal_context", "")

    return [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"🔥 Hot Signal: {company}"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Type:*\n{signal_type}"},
                {"type": "mrkdwn", "text": f"*ICP Score:*\n{icp_score}"},
                {"type": "mrkdwn", "text": f"*Contact:*\n{contact}"},
                {"type": "mrkdwn", "text": f"*Company:*\n{company}"},
            ],
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Context:*\n{context}"},
        },
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_email(db, user_id: str) -> str | None:
    """Return the email for a user ID, best-effort (returns None on any error)."""
    try:
        from app.db.models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        return getattr(user, "email", None)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Calendar: schedule a meeting brief T-30min before event start
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.schedule_meeting_brief_task")
def schedule_meeting_brief_task(
    user_id: str,
    event_id: str,
    event_data: dict,
    user_email: str,
):
    """
    Called by the calendar webhook handler.
    Deduplicates via Redis and schedules generate_meeting_brief_task at T-30.
    """
    import redis as redis_lib
    from app.core.config import settings

    # Dedup: skip if we already scheduled for this event
    try:
        r = redis_lib.from_url(settings.REDIS_URL, decode_responses=True)
        redis_key = f"meeting_brief:{user_id}:{event_id}"
        if r.get(redis_key):
            logger.info("Meeting brief already scheduled for user %s event %s — skip", user_id, event_id)
            return {"status": "dedup_skip"}
        r.setex(redis_key, 7200, "scheduled")  # 2hr TTL
    except Exception as exc:
        logger.warning("Redis dedup check failed (continuing): %s", exc)

    # Parse event start time
    start_str = event_data.get("start", {}).get("dateTime")
    if not start_str:
        logger.info("Event %s has no dateTime start — skipping", event_id)
        return {"status": "no_datetime"}

    try:
        from datetime import datetime, timezone, timedelta
        # Parse ISO datetime (may include timezone offset)
        event_start = datetime.fromisoformat(start_str)
        if event_start.tzinfo is None:
            event_start = event_start.replace(tzinfo=timezone.utc)
        eta = event_start - timedelta(minutes=30)
        now = datetime.now(timezone.utc)
        if eta <= now:
            eta = None  # run immediately
    except Exception as exc:
        logger.error("Could not parse event start %s: %s", start_str, exc)
        return {"status": "parse_error"}

    kwargs = dict(
        user_id=user_id,
        event_id=event_id,
        event_data=event_data,
        user_email=user_email,
    )
    if eta:
        generate_meeting_brief_task.apply_async(kwargs=kwargs, eta=eta)
        logger.info("Scheduled meeting brief for user %s event %s at %s", user_id, event_id, eta)
    else:
        generate_meeting_brief_task.apply_async(kwargs=kwargs)
        logger.info("Meeting brief running immediately for user %s event %s", user_id, event_id)

    return {"status": "scheduled", "eta": eta.isoformat() if eta else "immediate"}


# ---------------------------------------------------------------------------
# Calendar: generate the meeting brief at T-30
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.generate_meeting_brief_task", bind=True, max_retries=2)
def generate_meeting_brief_task(
    self,
    user_id: str,
    event_id: str,
    event_data: dict,
    user_email: str,
):
    """Run at T-30: enrich attendees, call LLM, save brief, notify via Slack."""
    try:
        return asyncio.run(
            _generate_meeting_brief(user_id, event_id, event_data, user_email)
        )
    except Exception as exc:
        logger.error("generate_meeting_brief_task failed for user %s: %s", user_id, exc)
        raise self.retry(exc=exc, countdown=60)


async def _generate_meeting_brief(
    user_id: str,
    event_id: str,
    event_data: dict,
    user_email: str,
):
    from app.services.calendar_event_service import CalendarEventService
    from app.services.copilot.prompts import CALENDAR_MEETING_BRIEF_SYSTEM_PROMPT
    from app.services.openrouter_service import OpenRouterService
    from app.services.copilot.notification_service import NotificationService
    from app.db.models.copilot_meeting_prep import CopilotMeetingPrep
    from app.db.models.copilot_preferences import CopilotUserPreferences

    cal_svc = CalendarEventService()
    user_domain = user_email.split("@")[-1] if "@" in user_email else ""
    meeting_title = cal_svc.get_meeting_title(event_data)
    event_start_str = cal_svc.get_event_start_utc(event_data) or ""
    external_attendees = cal_svc.get_external_attendees(event_data, user_domain)

    # Build context for LLM
    attendee_lines = [
        f"- {a.get('displayName', a.get('email', ''))} <{a.get('email', '')}>"
        for a in external_attendees
    ]

    # Try enrichment for first external attendee's company
    enrichment_used = False
    enrichment_context = ""
    if external_attendees:
        first_email = external_attendees[0].get("email", "")
        first_domain = first_email.split("@")[-1] if "@" in first_email else ""
        if first_domain:
            try:
                from app.services.enrichment import enrich_company
                enrichment_data = await enrich_company(first_domain)
                if enrichment_data:
                    enrichment_used = True
                    enrichment_context = f"\nCompany data: {enrichment_data}"
            except Exception as exc:
                logger.warning("Enrichment failed for %s: %s", first_domain, exc)

    user_prompt = f"""
Meeting: {meeting_title}
Time: {event_start_str}
External attendees:
{chr(10).join(attendee_lines)}
{enrichment_context}
"""

    # Call LLM
    llm_result = {}
    try:
        llm = OpenRouterService()
        import json, re
        raw = await llm.chat_completion_text(
            system_prompt=CALENDAR_MEETING_BRIEF_SYSTEM_PROMPT,
            user_message=user_prompt,
            max_tokens=500,
            temperature=0.3,
        )
        logger.info("Meeting brief LLM raw response: %s", raw[:300])
        # Strip markdown code fences if present
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE).strip()
        llm_result = json.loads(cleaned)
    except Exception as exc:
        logger.error("LLM call failed for meeting brief: %s | raw=%s", exc, locals().get("raw", ""))
        llm_result = {
            "context": f"Meeting with {meeting_title} at {event_start_str}",
            "objections": [],
            "talking_points": ["Review attendee LinkedIn before the call"],
            "ask": "Confirm next steps before end of call",
        }

    # Save to DB
    db = SessionLocal()
    try:
        prep = CopilotMeetingPrep(
            user_id=user_id,
            company_name=meeting_title,
            calendar_event_id=event_id,
            meeting_type="calendar_auto",
            content={
                "context": llm_result.get("context", ""),
                "objections": llm_result.get("objections", []),
                "talking_points": llm_result.get("talking_points", []),
                "ask": llm_result.get("ask", ""),
                "event_start": event_start_str,
                "enrichment_used": enrichment_used,
                "external_attendees": attendee_lines,
            },
        )
        db.add(prep)
        db.commit()
        db.refresh(prep)
        brief_id = str(prep.id)
        logger.info("Meeting brief saved: id=%s user=%s", brief_id, user_id)

        # Notify via Slack
        prefs = (
            db.query(CopilotUserPreferences)
            .filter(CopilotUserPreferences.user_id == user_id)
            .first()
        )
        if prefs and prefs.notify_slack and prefs.slack_webhook_url:
            notifier = NotificationService()
            notifier.send_meeting_brief_slack(
                webhook_url=prefs.slack_webhook_url,
                brief=llm_result,
                meeting_title=meeting_title,
                event_start=event_start_str,
            )

        # In-app notification
        try:
            from app.db.repositories.notification_repository import NotificationRepository
            repo = NotificationRepository(db)
            repo.create(
                user_id=user_id,
                type="meeting_prep_ready",
                title=f"Meeting Brief Ready: {meeting_title}",
                body=f"Pre-call brief for {meeting_title} generated 30 minutes before your meeting.",
                cta_url="/copilot/meeting-prep?show=latest",
                priority="green",
            )
        except Exception as _ne:
            logger.warning("Failed to create meeting_prep_ready notification: %s", _ne)
    finally:
        db.close()

    return {"status": "generated", "brief_id": brief_id}


# ---------------------------------------------------------------------------
# Scheduled: renew calendar webhooks before 7-day Google expiry
# ---------------------------------------------------------------------------

@celery_app.task(name="app.tasks.copilot_tasks.renew_calendar_webhooks_task")
def renew_calendar_webhooks_task():
    """Daily at 06:00 UTC: re-register webhooks expiring within 2 days."""
    return asyncio.run(_renew_webhooks())


async def _renew_webhooks():
    import uuid as uuid_lib
    from datetime import datetime, timezone, timedelta
    import httpx
    from app.db.models.user import User
    from app.core.config import settings

    CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

    db = SessionLocal()
    renewed = 0
    errors = 0
    try:
        cutoff = datetime.now(timezone.utc) + timedelta(days=2)
        users = (
            db.query(User)
            .filter(
                User.gmail_refresh_token != None,
                User.google_calendar_webhook_expiry != None,
                User.google_calendar_webhook_expiry <= cutoff,
            )
            .all()
        )

        for user in users:
            try:
                # Refresh access token
                async with httpx.AsyncClient(timeout=15) as client:
                    tok_resp = await client.post(GOOGLE_TOKEN_URL, data={
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "refresh_token": user.gmail_refresh_token,
                        "grant_type": "refresh_token",
                    })
                if tok_resp.status_code != 200:
                    logger.error("Token refresh failed for user %s: %s", user.id, tok_resp.status_code)
                    errors += 1
                    continue

                access_token = tok_resp.json().get("access_token")
                channel_id = str(uuid_lib.uuid4())
                expiry_ms = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp() * 1000)

                # Register new watch
                async with httpx.AsyncClient(timeout=20) as client:
                    watch_resp = await client.post(
                        f"{CALENDAR_API_BASE}/calendars/primary/events/watch",
                        json={
                            "id": channel_id,
                            "type": "web_hook",
                            "address": settings.GOOGLE_CALENDAR_WEBHOOK_URL,
                            "token": str(user.id),
                            "expiration": str(expiry_ms),
                        },
                        headers={"Authorization": f"Bearer {access_token}"},
                    )

                if watch_resp.status_code not in (200, 201):
                    logger.error("Watch renewal failed for user %s: %s", user.id, watch_resp.status_code)
                    errors += 1
                    continue

                data = watch_resp.json()
                expiry_dt = datetime.fromtimestamp(
                    int(data.get("expiration", expiry_ms)) / 1000, tz=timezone.utc
                )
                user.google_calendar_channel_id = channel_id
                user.google_calendar_resource_id = data.get("resourceId", "")
                user.google_calendar_webhook_expiry = expiry_dt
                db.commit()
                renewed += 1
                logger.info("Renewed calendar webhook for user %s, expiry %s", user.id, expiry_dt)

            except Exception as exc:
                logger.error("Webhook renewal error for user %s: %s", user.id, exc)
                errors += 1

    finally:
        db.close()

    logger.info("Calendar webhook renewal done. renewed=%d errors=%d", renewed, errors)
    return {"renewed": renewed, "errors": errors}
