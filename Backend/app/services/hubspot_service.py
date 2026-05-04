"""HubSpot CRM service - user-owned OAuth and private app token support."""

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from uuid import UUID

import httpx
import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.integration import Integration, UserIntegration
from app.services.integration_engine.credential_vault import decrypt_credentials, encrypt_credentials

logger = logging.getLogger(__name__)

HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize"
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

    @staticmethod
    def _user_uuid(user_id):
        return user_id if isinstance(user_id, UUID) else UUID(str(user_id))

    def is_connected(self, user) -> Dict[str, Any]:
        row = self._get_integration_row(user.id)
        if row and row["status"] == "connected":
            creds = row.get("credentials") or {}
            return {
                "connected": True,
                "portal_id": creds.get("portal_id"),
                "auth_type": creds.get("auth_type", "oauth"),
                "connected_at": str(row.get("connected_at", "")),
            }
        return {"connected": False, "portal_id": None, "connected_at": None}

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
            "client_id": settings.HUBSPOT_CLIENT_ID,
            "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
            "scope": " ".join(HUBSPOT_SCOPES),
        }
        if settings.HUBSPOT_PKCE_CHALLENGE:
            params["code_challenge"] = settings.HUBSPOT_PKCE_CHALLENGE
            params["code_challenge_method"] = "S256"
        if state:
            params["state"] = state
        return f"{HUBSPOT_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, state: str = "") -> Dict[str, Any]:
        data: Dict[str, str] = {
            "grant_type": "authorization_code",
            "client_id": settings.HUBSPOT_CLIENT_ID,
            "client_secret": settings.HUBSPOT_CLIENT_SECRET,
            "redirect_uri": settings.HUBSPOT_REDIRECT_URI,
            "code": code,
        }
        if settings.HUBSPOT_PKCE_VERIFIER:
            data["code_verifier"] = settings.HUBSPOT_PKCE_VERIFIER
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(HUBSPOT_TOKEN_URL, data=data)
            resp.raise_for_status()
            return resp.json()

    def store_tokens(self, user_id, token_data: Dict[str, Any]) -> None:
        if not self.db:
            raise RuntimeError("db session required")

        creds = {
            "auth_type": "oauth",
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "portal_id": str(token_data.get("hub_id") or token_data.get("hub-id") or ""),
            "expires_in": token_data.get("expires_in"),
            "scope": token_data.get("scope"),
        }

        integration = self._get_catalog_integration()
        row = self._get_integration_row(user_id)
        encrypted = encrypt_credentials(creds)
        now = datetime.now(timezone.utc)

        if row:
            model = row["model"]
            model.credentials_encrypted = encrypted
            model.status = "connected"
            model.error_message = None
            model.config = {"type": INTEGRATION_TYPE, "auth_type": "oauth"}
            model.extra_data = {"provider": INTEGRATION_TYPE, "portal_id": creds["portal_id"]}
            model.connected_at = now
        else:
            self.db.add(
                UserIntegration(
                    user_id=self._user_uuid(user_id),
                    integration_id=integration.id,
                    status="connected",
                    credentials_encrypted=encrypted,
                    config={"type": INTEGRATION_TYPE, "auth_type": "oauth"},
                    extra_data={"provider": INTEGRATION_TYPE, "portal_id": creds["portal_id"]},
                    connected_at=now,
                )
            )
        self.db.commit()

    def disconnect(self, user_id) -> None:
        if not self.db:
            return
        row = self._get_integration_row(user_id)
        if row:
            row["model"].status = "disconnected"
            row["model"].credentials_encrypted = None
            row["model"].error_message = None
        self.db.commit()

    async def refresh_token(self, user_id) -> Optional[str]:
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
                    row["model"].credentials_encrypted = encrypt_credentials(creds)
                    self.db.commit()
                return data["access_token"]
        except Exception as exc:
            logger.warning("HubSpot token refresh failed: %s", exc)
            return None

    def _get_access_token(self, user_id) -> Optional[str]:
        row = self._get_integration_row(user_id)
        if not row:
            return None
        creds = row.get("credentials") or {}
        return creds.get("access_token") or creds.get("api_key")

    def store_api_key(self, user_id, api_key: str, description: str = "") -> None:
        """Store the user's own HubSpot private app access token."""
        if not self.db:
            raise RuntimeError("db session required")

        # HubSpot Private App Tokens often arrive with stray whitespace from
        # copy/paste (trailing newline, leading space). Strip aggressively
        # so the bearer header doesn't get an invalid value.
        api_key = (api_key or "").strip().strip('"').strip("'")

        creds = {
            "auth_type": "private_app_token",
            "api_key": api_key,
            "description": description,
        }

        integration = self._get_catalog_integration()
        row = self._get_integration_row(user_id)
        encrypted = encrypt_credentials(creds)
        now = datetime.now(timezone.utc)

        if row:
            model = row["model"]
            model.credentials_encrypted = encrypted
            model.status = "connected"
            model.error_message = None
            model.config = {"type": INTEGRATION_TYPE, "auth_type": "private_app_token"}
            model.extra_data = {"provider": INTEGRATION_TYPE, "auth_type": "private_app_token"}
            model.connected_at = now
        else:
            self.db.add(
                UserIntegration(
                    user_id=self._user_uuid(user_id),
                    integration_id=integration.id,
                    status="connected",
                    credentials_encrypted=encrypted,
                    config={"type": INTEGRATION_TYPE, "auth_type": "private_app_token"},
                    extra_data={"provider": INTEGRATION_TYPE, "auth_type": "private_app_token"},
                    connected_at=now,
                )
            )
        self.db.commit()

    async def create_contact(self, user_id, properties: Dict[str, str]) -> Dict[str, Any]:
        row = self._get_integration_row(user_id)
        if not row:
            raise RuntimeError("HubSpot not connected")

        creds = row.get("credentials") or {}
        if creds.get("auth_type") in ("api_key", "private_app_token") or "api_key" in creds:
            api_key = creds.get("api_key")
            if not api_key:
                raise RuntimeError("HubSpot private app token not found")
            return await self._create_contact_with_token(api_key, properties, refresh_user_id=None)

        token = creds.get("access_token") or await self.refresh_token(user_id)
        if not token:
            raise RuntimeError("HubSpot not connected")
        return await self._create_contact_with_token(token, properties, refresh_user_id=user_id)

    async def _create_contact_with_token(
        self,
        token: str,
        properties: Dict[str, str],
        refresh_user_id=None,
    ) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"properties": properties},
            )
            if resp.status_code == 401 and refresh_user_id is not None:
                token = await self.refresh_token(refresh_user_id)
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
        row = self._get_integration_row(user_id)
        if not row:
            return None

        creds = row.get("credentials") or {}
        token = creds.get("api_key") or creds.get("access_token") or await self.refresh_token(user_id)
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
        token = self._get_access_token(user_id)
        if token:
            return token
        return await self.refresh_token(user_id)

    def _get_catalog_integration(self) -> Integration:
        integration = self.db.query(Integration).filter(Integration.slug == INTEGRATION_TYPE).first()
        if not integration:
            integration = Integration(
                slug=INTEGRATION_TYPE,
                name="HubSpot",
                category="crm",
                short_description="Connect each user's own HubSpot portal for CRM sync",
                auth_type="oauth2",
                is_active=True,
                is_coming_soon=False,
                credit_cost="Free",
            )
            self.db.add(integration)
            self.db.flush()
        return integration

    def _get_integration_row(self, user_id) -> Optional[Dict[str, Any]]:
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
