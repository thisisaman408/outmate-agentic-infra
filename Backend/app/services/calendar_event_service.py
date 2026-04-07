"""
Calendar Event Service — Google Calendar API helpers.

Handles:
- Fetching events from Google Calendar API
- Filtering external attendees (different domain)
- Refreshing OAuth tokens (same pattern as gmail_service.py)
"""

import logging
from typing import Optional, List, Dict, Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"


class CalendarEventService:
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET

    async def refresh_calendar_token(self, refresh_token: str) -> Optional[str]:
        """Get a fresh access token from a refresh token."""
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(GOOGLE_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            })
            if resp.status_code == 200:
                return resp.json().get("access_token")
            logger.error("Token refresh failed: %s %s", resp.status_code, resp.text)
        return None

    async def get_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single calendar event by ID."""
        url = f"{CALENDAR_API_BASE}/calendars/{calendar_id}/events/{event_id}"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code == 200:
                return resp.json()
            logger.error("get_event failed: %s %s", resp.status_code, resp.text)
        return None

    def is_all_day(self, event: Dict[str, Any]) -> bool:
        """True if the event is an all-day event (has 'date' key instead of 'dateTime')."""
        return "date" in event.get("start", {})

    def get_external_attendees(
        self,
        event: Dict[str, Any],
        user_email_domain: str,
    ) -> List[Dict[str, Any]]:
        """
        Return attendees whose email domain differs from the rep's domain.
        Skips resource/room attendees (resource=True).
        """
        attendees = event.get("attendees", [])
        external = []
        for att in attendees:
            email = att.get("email", "")
            if att.get("resource"):
                continue
            domain = email.split("@")[-1] if "@" in email else ""
            if domain and domain.lower() != user_email_domain.lower():
                external.append(att)
        return external

    def get_meeting_title(self, event: Dict[str, Any]) -> str:
        """Return the event summary/title."""
        return event.get("summary", "Untitled Meeting")

    def get_event_start_utc(self, event: Dict[str, Any]) -> Optional[str]:
        """Return the event start as an ISO datetime string (dateTime field)."""
        return event.get("start", {}).get("dateTime")
