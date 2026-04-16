"""Salesforce CRM service — OAuth token management + contact/deal creation.

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

SALESFORCE_AUTH_URL = "https://login.salesforce.com/services/oauth2/authorize"
SALESFORCE_TOKEN_URL = "https://login.salesforce.com/services/oauth2/token"
INTEGRATION_TYPE = "salesforce"

SALESFORCE_SCOPES = [
    "api",
    "refresh_token",
]


class SalesforceService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    @staticmethod
    def is_available() -> bool:
        return bool(settings.SALESFORCE_CLIENT_ID and settings.SALESFORCE_CLIENT_SECRET)

    def is_connected(self, user) -> Dict[str, Any]:
        """Check if a user has connected their Salesforce account."""
        row = self._get_integration_row(user.id)
        if row and row["status"] == "connected":
            creds = row.get("credentials") or {}
            return {
                "connected": True,
                "instance_url": creds.get("instance_url"),
                "connected_at": str(row.get("connected_at", "")),
            }
        return {"connected": False, "instance_url": None, "connected_at": None}

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.SALESFORCE_CLIENT_ID,
            "redirect_uri": settings.SALESFORCE_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(SALESFORCE_SCOPES),
        }
        if state:
            params["state"] = state
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{SALESFORCE_AUTH_URL}?{query}"

    async def exchange_code(self, code: str, state: str = "") -> Dict[str, Any]:
        data: Dict[str, str] = {
            "grant_type": "authorization_code",
            "client_id": settings.SALESFORCE_CLIENT_ID,
            "client_secret": settings.SALESFORCE_CLIENT_SECRET,
            "redirect_uri": settings.SALESFORCE_REDIRECT_URI,
            "code": code,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(SALESFORCE_TOKEN_URL, data=data)
            resp.raise_for_status()
            return resp.json()

    def store_tokens(self, user_id, token_data: Dict[str, Any]) -> None:
        """Store Salesforce tokens in user_integrations table."""
        if not self.db:
            raise RuntimeError("db session required")

        creds = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "instance_url": token_data.get("instance_url"),
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
                    "meta": json.dumps({"provider": "salesforce", "instance_url": creds["instance_url"]}),
                    "now": datetime.now(timezone.utc),
                },
            )
        self.db.commit()

    def disconnect(self, user_id) -> None:
        """Remove Salesforce tokens."""
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
                    SALESFORCE_TOKEN_URL,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": settings.SALESFORCE_CLIENT_ID,
                        "client_secret": settings.SALESFORCE_CLIENT_SECRET,
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
            logger.warning("Salesforce token refresh failed: %s", exc)
            return None

    def _get_access_token(self, user_id) -> Optional[str]:
        row = self._get_integration_row(user_id)
        if not row:
            return None
        # Check for OAuth access token first, then API key
        creds = row.get("credentials") or {}
        if creds.get("access_token"):
            return creds.get("access_token")
        return creds.get("api_key")

    def _get_instance_url(self, user_id) -> Optional[str]:
        row = self._get_integration_row(user_id)
        if not row:
            return None
        creds = row.get("credentials") or {}
        return creds.get("instance_url") or "https://login.salesforce.com"

    def store_api_key(self, user_id, api_key: str, description: str = "", instance_url: str = "") -> None:
        """Store Salesforce API key with description in user_integrations table."""
        if not self.db:
            raise RuntimeError("db session required")

        creds = {
            "api_key": api_key,
            "description": description,
            "instance_url": instance_url or "https://login.salesforce.com",
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
                    "meta": json.dumps({"provider": "salesforce", "auth_type": "api_key"}),
                    "now": datetime.now(timezone.utc),
                },
            )
        self.db.commit()

    async def create_contact(self, user_id, properties: Dict[str, str]) -> Dict[str, Any]:
        row = self._get_integration_row(user_id)
        if not row:
            raise RuntimeError("Salesforce not connected")
        
        creds = row.get("credentials") or {}
        auth_type = creds.get("auth_type", "oauth")
        instance_url = creds.get("instance_url") or "https://login.salesforce.com"
        
        if auth_type == "api_key" or "api_key" in creds:
            # Use API key authentication
            api_key = creds.get("api_key")
            if not api_key:
                raise RuntimeError("Salesforce API key not found")
            
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{instance_url}/services/data/v59.0/sobjects/Contact",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=properties,
                )
                resp.raise_for_status()
                return resp.json()
        else:
            # Use OAuth authentication
            token = creds.get("access_token")
            if not token:
                token = await self.refresh_token(user_id)
            if not token:
                raise RuntimeError("Salesforce not connected")

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{instance_url}/services/data/v59.0/sobjects/Contact",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json=properties,
                )
                if resp.status_code == 401:
                    token = await self.refresh_token(user_id)
                    if not token:
                        raise RuntimeError("Salesforce token expired")
                    resp = await client.post(
                        f"{instance_url}/services/data/v59.0/sobjects/Contact",
                        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                        json=properties,
                    )
                resp.raise_for_status()
                return resp.json()

    async def search_contact(self, user_id, email: str) -> Optional[Dict[str, Any]]:
        row = self._get_integration_row(user_id)
        if not row:
            return None
        
        creds = row.get("credentials") or {}
        auth_type = creds.get("auth_type", "oauth")
        instance_url = creds.get("instance_url") or "https://login.salesforce.com"
        
        if auth_type == "api_key" or "api_key" in creds:
            # Use API key authentication
            api_key = creds.get("api_key")
            if not api_key:
                return None
            
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{instance_url}/services/data/v59.0/query?q=SELECT+Id,FirstName,LastName,Email+FROM+Contact+WHERE+Email='{email}'",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get("records", [])
                    return records[0] if records else None
            return None
        else:
            # Use OAuth authentication
            token = creds.get("access_token")
            if not token:
                token = await self.refresh_token(user_id)
            if not token:
                return None

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{instance_url}/services/data/v59.0/query?q=SELECT+Id,FirstName,LastName,Email+FROM+Contact+WHERE+Email='{email}'",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get("records", [])
                    return records[0] if records else None
            return None

    # ── Internal ─────────────────────────────────────────────────────

    def _get_integration_row(self, user_id) -> Optional[Dict[str, Any]]:
        """Fetch the Salesforce integration row from user_integrations."""
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
