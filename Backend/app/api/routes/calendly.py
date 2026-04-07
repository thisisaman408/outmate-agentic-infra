"""
Calendly Webhook Route.

Option A (no OAuth) — users paste your server URL into their Calendly dashboard:
  Calendly Dashboard → Integrations → Webhooks → Add webhook
  URL: https://<your-server>/api/calendly/webhook
  Events: invitee.created, invitee.canceled

Set CALENDLY_WEBHOOK_SIGNING_KEY in .env (copy from Calendly webhook settings page).

Endpoint:
  POST /api/calendly/webhook  — receive Calendly invitee events
"""

import hashlib
import hmac
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Signature verification ───────────────────────────────────────────────────

def _verify_signature(body: bytes, signature_header: str) -> bool:
    """
    Calendly signs each webhook with HMAC-SHA256 using the signing key.
    Header format: "sha256=<hex_digest>"
    Returns True if valid, False otherwise.
    If no signing key is configured, skip verification (dev mode).
    """
    if not settings.CALENDLY_WEBHOOK_SIGNING_KEY:
        logger.warning("CALENDLY_WEBHOOK_SIGNING_KEY not set — skipping signature check (dev mode)")
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(
        settings.CALENDLY_WEBHOOK_SIGNING_KEY.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    received = signature_header[len("sha256="):]
    return hmac.compare_digest(expected, received)


# ─── Payload normalizer ───────────────────────────────────────────────────────

def _normalize_calendly_event(payload: dict) -> dict:
    """
    Convert Calendly invitee.created payload into a Google-Calendar-compatible
    event_data dict so the existing schedule_meeting_brief_task works unchanged.

    Calendly payload shape:
      payload.event        — scheduled event details (name, start_time, end_time)
      payload.invitee      — the external person who booked
      payload.event_type   — event type metadata
    """
    event = payload.get("event", {})
    invitee = payload.get("invitee", {})

    return {
        "summary": event.get("name") or "Calendly Meeting",
        "start": {"dateTime": event.get("start_time", "")},
        "end":   {"dateTime": event.get("end_time", "")},
        "attendees": [
            {
                "email": invitee.get("email", ""),
                "displayName": invitee.get("name", ""),
            }
        ],
        "description": invitee.get("questions_and_answers", []),
        "source": "calendly",
        "hangoutLink": event.get("location", {}).get("join_url") if isinstance(event.get("location"), dict) else None,
    }


# ─── POST /api/calendly/webhook ───────────────────────────────────────────────

@router.post("/webhook")
async def calendly_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receive Calendly invitee.created / invitee.canceled events.
    Must return 200 immediately. Processing happens in background.
    """
    body = await request.body()
    signature = request.headers.get("Calendly-Webhook-Signature", "")

    if not _verify_signature(body, signature):
        logger.warning("Calendly webhook: invalid signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        import json
        data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("event", "")       # "invitee.created" | "invitee.canceled"
    payload    = data.get("payload", {})

    logger.info("Calendly webhook received: event_type=%s", event_type)

    # Only trigger meeting prep for new bookings
    if event_type != "invitee.created":
        return JSONResponse(status_code=200, content={"status": "ignored", "event": event_type})

    # Resolve the Outmate user — Calendly sends the organizer's email in
    # payload.event.assigned_to[] or payload.event_type.owner.email
    organizer_email = _extract_organizer_email(payload)
    if not organizer_email:
        logger.warning("Calendly webhook: could not extract organizer email")
        return JSONResponse(status_code=200, content={"status": "no_organizer_email"})

    background_tasks.add_task(
        _process_calendly_booking,
        organizer_email=organizer_email,
        payload=payload,
    )

    return JSONResponse(status_code=200, content={"status": "accepted"})


def _extract_organizer_email(payload: dict) -> str:
    """
    Try multiple locations in the Calendly payload for the organizer email.
    Priority: event.assigned_to[0] → event_type.owner.email → scheduling_url owner
    """
    event = payload.get("event", {})

    # assigned_to is a list of organizer emails
    assigned = event.get("assigned_to", [])
    if assigned and isinstance(assigned, list):
        return assigned[0]

    # event_type.owner.email
    event_type = payload.get("event_type", {})
    owner = event_type.get("owner", {})
    if owner.get("email"):
        return owner["email"]

    return ""


# ─── Background processor ─────────────────────────────────────────────────────

async def _process_calendly_booking(organizer_email: str, payload: dict):
    """
    Find the Outmate user by organizer email, normalize the Calendly event,
    then fire schedule_meeting_brief_task — same as the Google Calendar path.
    """
    from app.db.session import SessionLocal
    from app.db.models.user import User as UserModel
    from app.tasks.copilot_tasks import schedule_meeting_brief_task

    db = SessionLocal()
    try:
        user = db.query(UserModel).filter(
            UserModel.email == organizer_email
        ).first()

        if not user:
            logger.warning(
                "Calendly webhook: no Outmate user found for organizer email %s",
                organizer_email,
            )
            return

        event_data = _normalize_calendly_event(payload)
        event = payload.get("event", {})

        # Use the Calendly event URI as event_id (stable, unique per booking)
        event_id = event.get("uri", f"calendly-{int(datetime.now(timezone.utc).timestamp())}")

        schedule_meeting_brief_task.delay(
            user_id=str(user.id),
            event_id=event_id,
            event_data=event_data,
            user_email=user.email,
        )
        logger.info(
            "Calendly: scheduled meeting brief for user %s event %s",
            user.id, event_id,
        )

    except Exception as exc:
        logger.error("_process_calendly_booking failed: %s", exc)
    finally:
        db.close()
