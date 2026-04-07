"""
Google Calendar API Routes.

Endpoints:
  POST /api/calendar/register  — Subscribe to Google Calendar push notifications
  POST /api/calendar/webhook   — Receive Google Calendar push notifications
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_valid_access_token(user: User) -> Optional[str]:
    """Return a fresh access token, refreshing if needed."""
    if not user.gmail_refresh_token:
        return None
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": user.gmail_refresh_token,
            "grant_type": "refresh_token",
        })
        if resp.status_code == 200:
            return resp.json().get("access_token")
    return None


# ─── POST /api/calendar/register ──────────────────────────────────────────────

@router.post("/register")
async def register_calendar_webhook(
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Subscribe to Google Calendar push notifications for the current user.
    Stores channel_id, resource_id, and expiry on the User model.
    """
    if not current_user.gmail_refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar not connected. Please reconnect your Google account.",
        )

    access_token = await _get_valid_access_token(current_user)
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to obtain Google access token.")

    if not settings.GOOGLE_CALENDAR_WEBHOOK_URL:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_CALENDAR_WEBHOOK_URL not configured on server.",
        )

    channel_id = str(uuid.uuid4())
    expiry_ms = int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp() * 1000)

    url = f"{CALENDAR_API_BASE}/calendars/primary/events/watch"
    payload = {
        "id": channel_id,
        "type": "web_hook",
        "address": settings.GOOGLE_CALENDAR_WEBHOOK_URL,
        "token": str(current_user.id),  # echoed back in X-Goog-Channel-Token
        "expiration": str(expiry_ms),
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code not in (200, 201):
        logger.error("Calendar watch registration failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=502,
            detail=f"Google Calendar API error: {resp.status_code}",
        )

    data = resp.json()
    resource_id = data.get("resourceId", "")
    expiry_dt = datetime.fromtimestamp(int(data.get("expiration", expiry_ms)) / 1000, tz=timezone.utc)

    current_user.google_calendar_channel_id = channel_id
    current_user.google_calendar_resource_id = resource_id
    current_user.google_calendar_webhook_expiry = expiry_dt
    db.commit()

    logger.info("Calendar webhook registered for user %s, expiry %s", current_user.id, expiry_dt)
    return {
        "status": "registered",
        "channel_id": channel_id,
        "expires_at": expiry_dt.isoformat(),
    }


# ─── POST /api/calendar/webhook ───────────────────────────────────────────────

@router.post("/webhook")
async def calendar_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db=Depends(get_db),
):
    """
    Receive Google Calendar push notifications.
    Must return 200 immediately. Processing is done in background.
    """
    # Google headers
    channel_token = request.headers.get("X-Goog-Channel-Token", "")  # contains user_id
    resource_state = request.headers.get("X-Goog-Resource-State", "")
    channel_id = request.headers.get("X-Goog-Channel-ID", "")
    resource_id_header = request.headers.get("X-Goog-Resource-ID", "")
    calendar_id = request.headers.get("X-Goog-Calendar-ID", "primary")

    logger.info(
        "Calendar webhook: state=%s channel=%s user_id=%s",
        resource_state, channel_id, channel_token,
    )

    # Sync notifications are just confirmation pings — ignore
    if resource_state == "sync":
        return JSONResponse(status_code=200, content={"status": "sync_ack"})

    # Only process "exists" (create/update) events
    if resource_state != "exists":
        return JSONResponse(status_code=200, content={"status": "ignored"})

    user_id = channel_token
    if not user_id:
        return JSONResponse(status_code=200, content={"status": "no_user_id"})

    # Find user to get their refresh token
    try:
        from app.db.models.user import User as UserModel
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user or not user.gmail_refresh_token:
            return JSONResponse(status_code=200, content={"status": "user_not_found"})
    except Exception as exc:
        logger.error("Webhook user lookup failed: %s", exc)
        return JSONResponse(status_code=200, content={"status": "error"})

    # Background: fetch changed events and schedule brief
    background_tasks.add_task(
        _process_calendar_update,
        user_id=user_id,
        refresh_token=user.gmail_refresh_token,
        user_email=user.email,
        calendar_id=calendar_id,
    )

    return JSONResponse(status_code=200, content={"status": "accepted"})


async def _process_calendar_update(
    user_id: str,
    refresh_token: str,
    user_email: str,
    calendar_id: str,
):
    """
    Fetch upcoming events changed since last sync and schedule meeting briefs.
    Called as a background task — never raises to the webhook handler.
    """
    from app.services.calendar_event_service import CalendarEventService
    from app.tasks.copilot_tasks import schedule_meeting_brief_task

    try:
        svc = CalendarEventService()
        access_token = await svc.refresh_calendar_token(refresh_token)
        if not access_token:
            logger.error("Could not refresh token for user %s", user_id)
            return

        # Fetch upcoming events (next 24h) to find what changed
        now_utc = datetime.now(timezone.utc)
        time_min = now_utc.isoformat()
        time_max = (now_utc + timedelta(hours=24)).isoformat()

        url = f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events"
        params = {
            "timeMin": time_min,
            "timeMax": time_max,
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": "10",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {access_token}"},
            )

        if resp.status_code != 200:
            logger.error("Failed to list events for user %s: %s", user_id, resp.status_code)
            return

        events = resp.json().get("items", [])
        user_domain = user_email.split("@")[-1] if "@" in user_email else ""

        for event in events:
            # Skip all-day events
            if svc.is_all_day(event):
                continue
            # Skip events with no external attendees
            external = svc.get_external_attendees(event, user_domain)
            if not external:
                continue

            event_id = event.get("id", "")
            schedule_meeting_brief_task.delay(
                user_id=user_id,
                event_id=event_id,
                event_data=event,
                user_email=user_email,
            )
            logger.info("Scheduled brief task for user %s event %s", user_id, event_id)

    except Exception as exc:
        logger.error("_process_calendar_update failed for user %s: %s", user_id, exc)
