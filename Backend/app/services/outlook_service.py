"""Microsoft Outlook service — OAuth token management + email operations.

Stores tokens in the existing `user_integrations` table (JSONB credentials)
so no ALTER TABLE on the users table is needed.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# Microsoft OAuth 2.0 endpoints
OUTLOOK_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
OUTLOOK_API_BASE = "https://graph.microsoft.com/v1.0"
INTEGRATION_TYPE = "outlook"

OUTLOOK_SCOPES = [
    "User.Read",
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Mail.ReadBasic",
]


class OutlookService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    @staticmethod
    def is_available() -> bool:
        return bool(settings.OUTLOOK_CLIENT_ID and settings.OUTLOOK_CLIENT_SECRET)

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

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.OUTLOOK_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": settings.OUTLOOK_REDIRECT_URI,
            "scope": " ".join(OUTLOOK_SCOPES),
            "response_mode": "query",
        }
        if state:
            params["state"] = state
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{OUTLOOK_AUTH_URL}?{query}"

    async def exchange_code(self, code: str, state: str = "") -> Dict[str, Any]:
        data: Dict[str, str] = {
            "grant_type": "authorization_code",
            "client_id": settings.OUTLOOK_CLIENT_ID,
            "client_secret": settings.OUTLOOK_CLIENT_SECRET,
            "redirect_uri": settings.OUTLOOK_REDIRECT_URI,
            "code": code,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(OUTLOOK_TOKEN_URL, data=data)
            resp.raise_for_status()
            return resp.json()

    def store_tokens(self, user_id, token_data: Dict[str, Any]) -> None:
        """Store Outlook tokens in user_integrations table."""
        if not self.db:
            raise RuntimeError("db session required")

        creds = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in"),
        }

        row = self._get_integration_row(user_id)
        if row:
            self.db.execute(
                text(
                    "UPDATE user_integrations SET "
                    "credentials_encrypted = :creds, status = 'connected', "
                    "connected_at = :now, updated_at = :now "
                    "WHERE id = :row_id"
                ),
                {"creds": json.dumps(creds), "now": datetime.now(timezone.utc), "row_id": row["id"]},
            )
        else:
            self.db.execute(
                text(
                    "INSERT INTO user_integrations "
                    "(id, user_id, status, credentials_encrypted, config, metadata, connected_at, created_at, updated_at) "
                    "VALUES (:id, :user_id, 'connected', :creds, :config, :meta, :now, :now, :now)"
                ),
                {
                    "id": str(uuid4()),
                    "user_id": str(user_id),
                    "creds": json.dumps(creds),
                    "config": json.dumps({"type": INTEGRATION_TYPE}),
                    "meta": json.dumps({"provider": "outlook"}),
                    "now": datetime.now(timezone.utc),
                },
            )
        self.db.commit()

    def disconnect(self, user_id) -> None:
        """Remove Outlook tokens."""
        if not self.db:
            return
        self.db.execute(
            text(
                "UPDATE user_integrations SET status = 'disconnected', "
                "credentials_encrypted = NULL, updated_at = :now "
                "WHERE user_id = :uid AND config->>'type' = :itype"
            ),
            {"uid": str(user_id), "itype": INTEGRATION_TYPE, "now": datetime.now(timezone.utc)},
        )
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
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                creds["access_token"] = data["access_token"]
                if data.get("refresh_token"):
                    creds["refresh_token"] = data["refresh_token"]
                if self.db:
                    self.db.execute(
                        text(
                            "UPDATE user_integrations SET credentials_encrypted = :creds, updated_at = :now "
                            "WHERE id = :row_id"
                        ),
                        {"creds": json.dumps(creds), "now": datetime.now(timezone.utc), "row_id": row["id"]},
                    )
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

    def store_api_key(self, user_id, api_key: str, description: str = "") -> None:
        """Store Outlook API key with description in user_integrations table."""
        if not self.db:
            raise RuntimeError("db session required")

        # Get existing row to preserve credentials if they exist
        row = self._get_integration_row(user_id)
        existing_creds = row.get("credentials") or {} if row else {}

        # Update or add API key
        existing_creds["api_key"] = api_key
        existing_creds["description"] = description
        existing_creds["auth_type"] = "api_key"

        if row:
            self.db.execute(
                text(
                    "UPDATE user_integrations SET "
                    "credentials_encrypted = :creds, status = 'connected', "
                    "connected_at = :now, updated_at = :now "
                    "WHERE id = :row_id"
                ),
                {"creds": json.dumps(existing_creds), "now": datetime.now(timezone.utc), "row_id": row["id"]},
            )
        else:
            self.db.execute(
                text(
                    "INSERT INTO user_integrations "
                    "(id, user_id, status, credentials_encrypted, config, metadata, connected_at, created_at, updated_at) "
                    "VALUES (:id, :user_id, 'connected', :creds, :config, :meta, :now, :now, :now)"
                ),
                {
                    "id": str(uuid4()),
                    "user_id": str(user_id),
                    "creds": json.dumps(existing_creds),
                    "config": json.dumps({"type": INTEGRATION_TYPE}),
                    "meta": json.dumps({"provider": "outlook", "auth_type": "api_key"}),
                    "now": datetime.now(timezone.utc),
                },
            )
        self.db.commit()

    # ── Internal ─────────────────────────────────────────────────────

    def _get_integration_row(self, user_id) -> Optional[Dict[str, Any]]:
        """Fetch the Outlook integration row from user_integrations."""
        if not self.db:
            return None
        result = self.db.execute(
            text(
                "SELECT id, user_id, status, credentials_encrypted, config, metadata, connected_at "
                "FROM user_integrations "
                "WHERE user_id = :uid AND config->>'type' = :itype "
                "LIMIT 1"
            ),
            {"uid": str(user_id), "itype": INTEGRATION_TYPE},
        )
        row = result.mappings().first()
        if not row:
            return None
        creds = {}
        if row.get("credentials_encrypted"):
            try:
                creds = json.loads(row["credentials_encrypted"]) if isinstance(row["credentials_encrypted"], str) else row["credentials_encrypted"]
            except (json.JSONDecodeError, TypeError):
                pass
        return {
            "id": str(row["id"]),
            "status": row["status"],
            "credentials": creds,
            "connected_at": row.get("connected_at"),
        }
