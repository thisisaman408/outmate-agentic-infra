"""
Gmail Service - Send emails via Gmail API using tokens stored in the User model.
"""

import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"


class GmailService:
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET

    def is_connected(self, user) -> Dict[str, Any]:
        """Check if a user has Gmail tokens stored."""
        if user and user.gmail_refresh_token:
            return {"connected": True, "email": user.email}
        return {"connected": False, "email": None}

    async def _refresh_token(self, refresh_token: str) -> Optional[str]:
        """Refresh the access token using a refresh token."""
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            })
            if response.status_code == 200:
                return response.json()["access_token"]
        return None

    async def send_email(
        self,
        user,
        to_email: str,
        subject: str,
        body: str,
        db=None,
    ) -> Dict[str, Any]:
        """Send an email via Gmail API using the user's stored tokens."""
        if not user or not user.gmail_refresh_token:
            raise ValueError("Gmail not connected. Please sign in with Google first.")

        access_token = user.gmail_access_token

        # Build the email
        message = MIMEMultipart()
        message["to"] = to_email
        message["from"] = user.email
        message["subject"] = subject
        message.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{GMAIL_API_BASE}/users/me/messages/send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"raw": raw},
            )

            if response.status_code == 401:
                # Token expired — refresh
                new_token = await self._refresh_token(user.gmail_refresh_token)
                if new_token:
                    user.gmail_access_token = new_token
                    if db:
                        db.commit()
                    response = await client.post(
                        f"{GMAIL_API_BASE}/users/me/messages/send",
                        headers={
                            "Authorization": f"Bearer {new_token}",
                            "Content-Type": "application/json",
                        },
                        json={"raw": raw},
                    )

            if response.status_code == 200:
                result = response.json()
                logger.info("Email sent to %s, message ID: %s", to_email, result.get("id"))
                return {
                    "success": True,
                    "message_id": result.get("id"),
                    "to": to_email,
                }
            else:
                error = response.text
                logger.error("Gmail send failed: %s - %s", response.status_code, error)
                raise ValueError(f"Gmail send failed: {response.status_code} - {error}")
