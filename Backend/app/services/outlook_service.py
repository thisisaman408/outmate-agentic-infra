"""Microsoft Outlook service — OAuth token management + email operations.

Stores tokens in the existing `user_integrations` table (JSONB credentials)
so no ALTER TABLE on the users table is needed.
"""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlencode
from uuid import UUID

import httpx
from sqlalchemy.orm import Session
import jwt

from app.core.config import settings
from app.db.models.integration import Integration, UserIntegration
from app.services.integration_engine.credential_vault import decrypt_credentials, encrypt_credentials

logger = logging.getLogger(__name__)

# Microsoft OAuth 2.0 endpoints
OUTLOOK_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
OUTLOOK_API_BASE = "https://graph.microsoft.com/v1.0"
INTEGRATION_TYPE = "outlook"

OUTLOOK_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
]


class OutlookService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    @staticmethod
    def is_available() -> bool:
        return bool(settings.OUTLOOK_CLIENT_ID and settings.OUTLOOK_CLIENT_SECRET)

    @staticmethod
    def _user_uuid(user_id):
        return user_id if isinstance(user_id, UUID) else UUID(str(user_id))

    def is_connected(self, user) -> Dict[str, Any]:
        """Check if a user has connected their Outlook account."""
        row = self._get_integration_row(user.id)
        if row and row["status"] == "connected":
            creds = row.get("credentials") or {}
            return {
                "connected": True,
                "email": creds.get("email"),
                "connected_at": str(row.get("connected_at", "")),
            }
        return {"connected": False, "email": None, "connected_at": None}

    @staticmethod
    def build_state(user_id) -> str:
        payload = {
            "uid": str(user_id),
            "provider": INTEGRATION_TYPE,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        }
        return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def verify_state(state: str) -> Optional[str]:
        try:
            payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("provider") != INTEGRATION_TYPE:
                return None
            return payload.get("uid")
        except Exception:
            return None

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.OUTLOOK_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": settings.OUTLOOK_REDIRECT_URI,
            "scope": " ".join(OUTLOOK_SCOPES),
            "response_mode": "query",
            "prompt": "select_account",
        }
        if state:
            params["state"] = state
        return f"{OUTLOOK_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, state: str = "") -> Dict[str, Any]:
        data: Dict[str, str] = {
            "grant_type": "authorization_code",
            "client_id": settings.OUTLOOK_CLIENT_ID,
            "client_secret": settings.OUTLOOK_CLIENT_SECRET,
            "redirect_uri": settings.OUTLOOK_REDIRECT_URI,
            "code": code,
            "scope": " ".join(OUTLOOK_SCOPES),
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(OUTLOOK_TOKEN_URL, data=data)
            resp.raise_for_status()
            return resp.json()

    async def fetch_profile(self, access_token: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{OUTLOOK_API_BASE}/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            resp.raise_for_status()
            return resp.json()

    async def store_tokens(self, user_id, token_data: Dict[str, Any]) -> None:
        """Store Outlook tokens in user_integrations table."""
        if not self.db:
            raise RuntimeError("db session required")

        profile = {}
        if token_data.get("access_token"):
            try:
                profile = await self.fetch_profile(token_data["access_token"])
            except Exception as exc:
                logger.warning("Outlook profile fetch failed: %s", exc)

        creds = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
            "scope": token_data.get("scope"),
            "email": profile.get("mail") or profile.get("userPrincipalName"),
        }

        integration = self._get_catalog_integration()
        row = self._get_integration_row(user_id)
        encrypted = encrypt_credentials(creds)
        now = datetime.now(timezone.utc)
        if row:
            row["model"].credentials_encrypted = encrypted
            row["model"].status = "connected"
            row["model"].error_message = None
            row["model"].config = {"type": INTEGRATION_TYPE}
            row["model"].extra_data = {"provider": "outlook", "email": creds.get("email")}
            row["model"].connected_at = now
        else:
            self.db.add(
                UserIntegration(
                    user_id=self._user_uuid(user_id),
                    integration_id=integration.id,
                    status="connected",
                    credentials_encrypted=encrypted,
                    config={"type": INTEGRATION_TYPE},
                    extra_data={"provider": "outlook", "email": creds.get("email")},
                    connected_at=now,
                )
            )
        self.db.commit()

    def disconnect(self, user_id) -> None:
        """Remove Outlook tokens."""
        if not self.db:
            return
        row = self._get_integration_row(user_id)
        if row:
            row["model"].status = "disconnected"
            row["model"].credentials_encrypted = None
            row["model"].error_message = None
        self.db.commit()

    async def refresh_token(self, user_id) -> Optional[str]:
        """Refresh the access token."""
        row = self._get_integration_row(user_id)
        if not row:
            return None
        creds = row.get("credentials") or {}
        refresh = creds.get("refresh_token")
        if not refresh:
            return None
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    OUTLOOK_TOKEN_URL,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": settings.OUTLOOK_CLIENT_ID,
                        "client_secret": settings.OUTLOOK_CLIENT_SECRET,
                        "refresh_token": refresh,
                        "scope": " ".join(OUTLOOK_SCOPES),
                    },
                )
            resp.raise_for_status()
            data = resp.json()
            creds["access_token"] = data["access_token"]
            if data.get("refresh_token"):
                creds["refresh_token"] = data["refresh_token"]
            if self.db:
                row["model"].credentials_encrypted = encrypt_credentials(creds)
                self.db.commit()
            return data["access_token"]
        except Exception as exc:
            logger.warning("Outlook token refresh failed: %s", exc)
            return None

    def _get_access_token(self, user_id) -> Optional[str]:
        row = self._get_integration_row(user_id)
        if not row:
            return None
        return (row.get("credentials") or {}).get("access_token")

    async def send_email(self, user_id, to_email: str, subject: str, body: str, html_body: str = None) -> Dict[str, Any]:
        """Send an email using Outlook."""
        token = self._get_access_token(user_id)
        if not token:
            token = await self.refresh_token(user_id)
        if not token:
            raise RuntimeError("Outlook not connected")

        email_data = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML" if html_body else "Text",
                    "content": html_body or body,
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": to_email
                        }
                    }
                ]
            }
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{OUTLOOK_API_BASE}/me/sendMail",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=email_data,
            )
            if resp.status_code == 401:
                token = await self.refresh_token(user_id)
                if not token:
                    raise RuntimeError("Outlook token expired")
                resp = await client.post(
                    f"{OUTLOOK_API_BASE}/me/sendMail",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=email_data,
                )
            resp.raise_for_status()
            return {"success": True}

    async def get_emails(self, user_id, limit: int = 10) -> Dict[str, Any]:
        """Get recent emails from Outlook."""
        token = self._get_access_token(user_id)
        if not token:
            token = await self.refresh_token(user_id)
        if not token:
            raise RuntimeError("Outlook not connected")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{OUTLOOK_API_BASE}/me/mailFolders/Inbox/messages?$top={limit}&$orderby=receivedDateTime desc",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 401:
                token = await self.refresh_token(user_id)
                if not token:
                    raise RuntimeError("Outlook token expired")
                resp = await client.get(
                    f"{OUTLOOK_API_BASE}/me/mailFolders/Inbox/messages?$top={limit}&$orderby=receivedDateTime desc",
                    headers={"Authorization": f"Bearer {token}"},
                )
            resp.raise_for_status()
            return resp.json()

    # ── API Key Support ─────────────────────────────────────────────────────

    async def get_profile(self, user_id) -> Dict[str, Any]:
        token = self._get_access_token(user_id)
        if not token:
            token = await self.refresh_token(user_id)
        if not token:
            raise RuntimeError("Outlook not connected")
        return await self.fetch_profile(token)

    async def get_folders(self, user_id) -> Dict[str, Any]:
        token = self._get_access_token(user_id)
        if not token:
            token = await self.refresh_token(user_id)
        if not token:
            raise RuntimeError("Outlook not connected")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{OUTLOOK_API_BASE}/me/mailFolders",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 401:
                token = await self.refresh_token(user_id)
                if not token:
                    raise RuntimeError("Outlook token expired")
                resp = await client.get(
                    f"{OUTLOOK_API_BASE}/me/mailFolders",
                    headers={"Authorization": f"Bearer {token}"},
                )
            resp.raise_for_status()
            return resp.json()

    # ── Internal ─────────────────────────────────────────────────────

    def _get_catalog_integration(self) -> Integration:
        integration = self.db.query(Integration).filter(Integration.slug == INTEGRATION_TYPE).first()
        if not integration:
            integration = Integration(
                slug=INTEGRATION_TYPE,
                name="Outlook / Office 365",
                category="email",
                short_description="Send and read mailbox data through Microsoft Graph delegated OAuth",
                auth_type="oauth2",
                is_active=True,
                is_coming_soon=False,
                credit_cost="Free",
            )
            self.db.add(integration)
            self.db.flush()
        return integration

    def _get_integration_row(self, user_id) -> Optional[Dict[str, Any]]:
        """Fetch the Outlook integration row from user_integrations."""
        if not self.db:
            return None
        integration = self._get_catalog_integration()
        model = (
            self.db.query(UserIntegration)
            .filter(
                UserIntegration.user_id == self._user_uuid(user_id),
                UserIntegration.integration_id == integration.id,
            )
            .first()
        )
        if not model:
            return None
        creds = {}
        if model.credentials_encrypted:
            try:
                creds = decrypt_credentials(model.credentials_encrypted)
            except Exception:
                try:
                    creds = json.loads(model.credentials_encrypted)
                except (json.JSONDecodeError, TypeError):
                    pass
        return {
            "id": str(model.id),
            "model": model,
            "status": model.status,
            "credentials": creds,
            "connected_at": model.connected_at,
        }
