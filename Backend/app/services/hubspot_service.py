"""HubSpot CRM service — OAuth token management + contact/deal creation.

Stores tokens in the existing `user_integrations` table (JSONB credentials)
so no ALTER TABLE on the users table is needed.
"""

import base64
import hashlib
import json
import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

# MCP Auth Apps use mcp-na2.hubspot.com, not app.hubspot.com
HUBSPOT_AUTH_URL = "https://mcp-na2.hubspot.com/oauth/authorize/user"
HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token"
HUBSPOT_API_BASE = "https://api.hubapi.com"
INTEGRATION_TYPE = "hubspot"

HUBSPOT_SCOPES = [
    "crm.objects.contacts.read",
    "crm.objects.contacts.write",
    "crm.objects.deals.read",
    "crm.objects.deals.write",
    "crm.objects.companies.read",
    "crm.objects.companies.write",
]


class HubSpotService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db

    @staticmethod
    def is_available() -> bool:
        return bool(settings.HUBSPOT_CLIENT_ID and settings.HUBSPOT_CLIENT_SECRET)

    def is_connected(self, user) -> Dict[str, Any]:
        """Check if a user has connected their HubSpot account."""
        row = self._get_integration_row(user.id)
        if row and row["status"] == "connected":
            creds = row.get("credentials") or {}
            return {
                "connected": True,
                "portal_id": creds.get("portal_id"),
                "connected_at": str(row.get("connected_at", "")),
            }
        return {"connected": False, "portal_id": None, "connected_at": None}

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.HUBSPOT_CLIENT_ID,
            "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
            "scope": " ".join(HUBSPOT_SCOPES),
            "code_challenge": settings.HUBSPOT_PKCE_CHALLENGE,
            "code_challenge_method": "S256",
        }
        if state:
            params["state"] = state
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{HUBSPOT_AUTH_URL}?{query}"

    async def exchange_code(self, code: str, state: str = "") -> Dict[str, Any]:
        data: Dict[str, str] = {
            "grant_type": "authorization_code",
            "client_id": settings.HUBSPOT_CLIENT_ID,
            "client_secret": settings.HUBSPOT_CLIENT_SECRET,
            "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
            "code": code,
            "code_verifier": settings.HUBSPOT_PKCE_VERIFIER,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(HUBSPOT_TOKEN_URL, data=data)
            resp.raise_for_status()
            return resp.json()

    def store_tokens(self, user_id, token_data: Dict[str, Any]) -> None:
        """Store HubSpot tokens in user_integrations table."""
        if not self.db:
            raise RuntimeError("db session required")

        creds = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "portal_id": str(token_data.get("hub_id") or token_data.get("hub-id") or ""),
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
                    "meta": json.dumps({"provider": "hubspot", "portal_id": creds["portal_id"]}),
                    "now": datetime.now(timezone.utc),
                },
            )
        self.db.commit()

    def disconnect(self, user_id) -> None:
        """Remove HubSpot tokens."""
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
                    HUBSPOT_TOKEN_URL,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": settings.HUBSPOT_CLIENT_ID,
                        "client_secret": settings.HUBSPOT_CLIENT_SECRET,
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
            logger.warning("HubSpot token refresh failed: %s", exc)
            return None

    def _get_access_token(self, user_id) -> Optional[str]:
        row = self._get_integration_row(user_id)
        if not row:
            return None
        return (row.get("credentials") or {}).get("access_token")

    async def create_contact(self, user_id, properties: Dict[str, str]) -> Dict[str, Any]:
        token = self._get_access_token(user_id)
        if not token:
            token = await self.refresh_token(user_id)
        if not token:
            raise RuntimeError("HubSpot not connected")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"properties": properties},
            )
            if resp.status_code == 401:
                token = await self.refresh_token(user_id)
                if not token:
                    raise RuntimeError("HubSpot token expired")
                resp = await client.post(
                    f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"properties": properties},
                )
            resp.raise_for_status()
            return resp.json()

    async def search_contact(self, user_id, email: str) -> Optional[Dict[str, Any]]:
        token = self._get_access_token(user_id)
        if not token:
            token = await self.refresh_token(user_id)
        if not token:
            return None

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts/search",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "filterGroups": [{
                        "filters": [{"propertyName": "email", "operator": "EQ", "value": email}]
                    }]
                },
            )
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                return results[0] if results else None
        return None

    async def list_contact_lists(self, user_id, limit: int = 50) -> List[Dict[str, Any]]:
        """Return all HubSpot contact lists the user can see.

        Uses HubSpot's v3 lists endpoint.  Each result has {listId, name,
        processingType, additionalProperties}.
        """
        token = await self._get_or_refresh_token(user_id)
        if not token:
            return []

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{HUBSPOT_API_BASE}/crm/v3/lists",
                headers={"Authorization": f"Bearer {token}"},
                params={"count": limit},
            )
            if resp.status_code != 200:
                return []
            body = resp.json()
            return body.get("lists", []) or body.get("results", [])

    async def list_contacts_in_list(
        self, user_id, list_id: str, limit: int = 200
    ) -> List[Dict[str, Any]]:
        """Return contacts in a specific HubSpot list.

        Calls GET /crm/v3/lists/{listId}/memberships then fetches contact
        details in bulk to get phone + company properties.
        """
        token = await self._get_or_refresh_token(user_id)
        if not token:
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            mem_resp = await client.get(
                f"{HUBSPOT_API_BASE}/crm/v3/lists/{list_id}/memberships",
                headers={"Authorization": f"Bearer {token}"},
                params={"limit": limit},
            )
            if mem_resp.status_code != 200:
                return []
            record_ids = [m.get("recordId") for m in mem_resp.json().get("results", []) if m.get("recordId")]
            if not record_ids:
                return []

            batch_resp = await client.post(
                f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "properties": ["firstname", "lastname", "email", "phone",
                                   "mobilephone", "company", "jobtitle", "city"],
                    "inputs": [{"id": rid} for rid in record_ids],
                },
            )
            if batch_resp.status_code != 200:
                return []
            return batch_resp.json().get("results", [])

    async def _get_or_refresh_token(self, user_id) -> Optional[str]:
        """Get a valid token, refreshing if the stored one is expired."""
        token = self._get_access_token(user_id)
        if token:
            return token
        return await self.refresh_token(user_id)

    # ── Internal ─────────────────────────────────────────────────────

    def _get_integration_row(self, user_id) -> Optional[Dict[str, Any]]:
        """Fetch the HubSpot integration row from user_integrations."""
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
