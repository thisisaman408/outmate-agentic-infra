"""
Gmail Service - OAuth2 authentication and email sending via Gmail API.
Uses httpx for HTTP calls instead of the Google client library.
"""

import os
import json
import base64
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from urllib.parse import urlencode
import httpx

logger = logging.getLogger(__name__)

# In-memory token storage (per-session). In production, persist to DB.
_gmail_tokens: Dict[str, Dict[str, Any]] = {}

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
SCOPES = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email"


class GmailService:
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        self.redirect_uri = os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:8000/api/campaigns/gmail/callback"
        )

    def get_auth_url(self, state: str = "") -> str:
        """Generate Google OAuth2 authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access + refresh tokens."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data={
                "code": code,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": self.redirect_uri,
                "grant_type": "authorization_code",
            })

            if response.status_code != 200:
                error = response.text
                logger.error(f"Gmail token exchange failed: {error}")
                raise ValueError(f"Token exchange failed: {error}")

            tokens = response.json()
            print(f">>> [Gmail] Token exchange successful", flush=True)

            # Get user email
            user_info = await self._get_user_info(tokens["access_token"])
            email = user_info.get("email", "unknown")

            # Store tokens keyed by email
            _gmail_tokens[email] = {
                "access_token": tokens["access_token"],
                "refresh_token": tokens.get("refresh_token"),
                "email": email,
            }

            return {"email": email, "connected": True}

    async def _get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Get user info from Google."""
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if response.status_code == 200:
                return response.json()
            return {}

    async def _refresh_token(self, email: str) -> Optional[str]:
        """Refresh the access token using the stored refresh token."""
        token_data = _gmail_tokens.get(email)
        if not token_data or not token_data.get("refresh_token"):
            return None

        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": token_data["refresh_token"],
                "grant_type": "refresh_token",
            })

            if response.status_code == 200:
                new_tokens = response.json()
                _gmail_tokens[email]["access_token"] = new_tokens["access_token"]
                return new_tokens["access_token"]

        return None

    def is_connected(self, email: Optional[str] = None) -> Dict[str, Any]:
        """Check if a Gmail account is connected."""
        if email and email in _gmail_tokens:
            return {"connected": True, "email": email}
        if _gmail_tokens:
            first_email = next(iter(_gmail_tokens))
            return {"connected": True, "email": first_email}
        return {"connected": False, "email": None}

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send an email via Gmail API."""
        # Find the connected account
        status = self.is_connected(from_email)
        if not status["connected"]:
            raise ValueError("Gmail not connected. Please connect your Google account first.")

        sender_email = status["email"]
        token_data = _gmail_tokens[sender_email]
        access_token = token_data["access_token"]

        # Build the email
        message = MIMEMultipart()
        message["to"] = to_email
        message["from"] = sender_email
        message["subject"] = subject
        message.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")

        # Send via Gmail API
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{GMAIL_API_BASE}/users/me/messages/send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"raw": raw}
            )

            if response.status_code == 401:
                # Token expired, try refresh
                new_token = await self._refresh_token(sender_email)
                if new_token:
                    response = await client.post(
                        f"{GMAIL_API_BASE}/users/me/messages/send",
                        headers={
                            "Authorization": f"Bearer {new_token}",
                            "Content-Type": "application/json",
                        },
                        json={"raw": raw}
                    )

            if response.status_code == 200:
                result = response.json()
                print(f">>> [Gmail] Email sent to {to_email}, message ID: {result.get('id')}", flush=True)
                return {
                    "success": True,
                    "message_id": result.get("id"),
                    "to": to_email,
                }
            else:
                error = response.text
                print(f">>> [Gmail] Send failed: {response.status_code} - {error}", flush=True)
                raise ValueError(f"Gmail send failed: {response.status_code} - {error}")
