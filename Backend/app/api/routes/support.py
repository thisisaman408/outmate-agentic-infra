from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import logging

from app.api.deps.auth import get_current_user
from app.db.models.user import User
from app.db.deps import get_db
from app.services.email import send_developer_invite, send_support_notification, send_booking_confirmation
from app.services.calendar_event_service import CalendarEventService
from app.core.config import settings
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/support", tags=["support"])
logger = logging.getLogger(__name__)

class DevInviteRequest(BaseModel):
    email: EmailStr

class SupportMessageRequest(BaseModel):
    message: str

class CallBookingRequest(BaseModel):
    slot: str

@router.post("/invite-dev")
async def invite_developer(
    body: DevInviteRequest,
    user: User = Depends(get_current_user)
):
    """Send technical installation instructions to a developer."""
    pixel_url = f"{settings.APP_WEBHOOK_URL}/api/v1/visitors/pixel.js"
    # Fallback for local dev
    if "localhost" in settings.APP_WEBHOOK_URL or "127.0.0.1" in settings.APP_WEBHOOK_URL:
        pixel_url = "http://localhost:8000/api/v1/visitors/pixel.js"

    workspace_name = user.company_name or "Outmate"
    sent = await send_developer_invite(
        to_email=body.email,
        workspace_name=workspace_name,
        pixel_key=str(user.id),
        pixel_url=pixel_url
    )

    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send invitation email")

    return {"success": True, "message": f"Invitation sent to {body.email}"}

@router.post("/message")
async def send_support_message(
    body: SupportMessageRequest,
    user: User = Depends(get_current_user)
):
    """Notify support team about a new inquiry."""
    logger.info(f"Support message from {user.email}: {body.message}")

    sent = await send_support_notification(user_email=user.email, message=body.message)
    if not sent:
        # We still return 200 but log the failure, so user isn't blocked
        logger.error(f"Failed to send support email notification for {user.email}")

    return {"success": True, "message": "Support message received"}

@router.post("/book-call")
async def book_support_call(
    body: CallBookingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Book a 1:1 GTM session. Creates a Google Calendar event with Meet link if possible."""
    logger.info(f"Call booking from {user.email} for slot: {body.slot}")

    meet_link: Optional[str] = None
    event_created = False

    # Try to create a Google Calendar event with Meet link
    if user.gmail_refresh_token:
        try:
            cal = CalendarEventService()
            access_token = await cal.refresh_calendar_token(user.gmail_refresh_token)
            if access_token:
                # Parse the slot into a datetime
                start_dt = _parse_slot_to_datetime(body.slot)
                end_dt = start_dt + timedelta(minutes=30)

                event = await cal.create_event(
                    access_token=access_token,
                    summary="Outmate.ai — 1:1 GTM Strategy Session",
                    start_iso=start_dt.isoformat(),
                    end_iso=end_dt.isoformat(),
                    attendees=[user.email],
                    description=(
                        "Your personalised GTM strategy session with the Outmate.ai team.\n\n"
                        "We'll cover:\n"
                        "• Your ICP and outreach configuration\n"
                        "• Pipeline and campaign optimisation\n"
                        "• Best practices for B2B outreach\n\n"
                        "Join via the Google Meet link attached to this event."
                    ),
                )

                if event:
                    meet_link = (
                        event.get("hangoutLink")
                        or event.get("conferenceData", {})
                        .get("entryPoints", [{}])[0]
                        .get("uri")
                    )
                    event_created = True
                    logger.info(f"Calendar event created for {user.email}, meet_link={meet_link}")
        except Exception as e:
            logger.error(f"Failed to create calendar event for {user.email}: {e}")

    # Send confirmation email (with meet link if we have one)
    sent_to_user = await send_booking_confirmation(
        user_email=user.email,
        slot=body.slot,
        meet_link=meet_link,
    )

    # Also notify the team
    await send_support_notification(
        user_email=user.email,
        message=f"USER BOOKED A CALL\nSlot: {body.slot}\nCalendar created: {event_created}\nMeet link: {meet_link or 'N/A'}\nTeam notification."
    )

    return {
        "success": True,
        "message": f"Call booked for {body.slot}",
        "meet_link": meet_link,
        "calendar_event_created": event_created,
    }


def _parse_slot_to_datetime(slot: str) -> datetime:
    """
    Convert a human-readable slot like 'Tomorrow at 10:00 AM' or 'Monday at 2:00 PM'
    into a datetime object. Falls back to tomorrow 10:00 AM if parsing fails.
    """
    now = datetime.utcnow()
    slot_lower = slot.lower()

    # Extract time
    hour = 10  # default
    minute = 0
    try:
        import re
        time_match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", slot_lower)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
            if time_match.group(3) == "pm" and hour != 12:
                hour += 12
            elif time_match.group(3) == "am" and hour == 12:
                hour = 0
    except Exception:
        pass

    # Extract day
    if "tomorrow" in slot_lower:
        day = now + timedelta(days=1)
    elif "today" in slot_lower:
        day = now
    else:
        # Try to match a weekday name
        weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        target_weekday = None
        for i, wd in enumerate(weekdays):
            if wd in slot_lower:
                target_weekday = i
                break
        if target_weekday is not None:
            days_ahead = target_weekday - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            day = now + timedelta(days=days_ahead)
        else:
            day = now + timedelta(days=1)  # fallback: tomorrow

    return day.replace(hour=hour, minute=minute, second=0, microsecond=0)
