"""CRM OAuth service — centralized OAuth handler for CRM integrations.

This service provides a unified interface for OAuth flows across different CRM platforms.
"""

import json
import secrets
from typing import Dict, Optional

from app.core.config import settings


class CrmOAuthService:
    """Centralized OAuth service for CRM integrations."""

    # OAuth configuration for supported platforms
    OAUTH_CONFIG = {
        "hubspot": {
            "auth_url": "https://app.hubspot.com/oauth/authorize",
            "token_url": "https://api.hubapi.com/oauth/v1/token",
            "client_id": settings.HUBSPOT_CLIENT_ID if hasattr(settings, "HUBSPOT_CLIENT_ID") else None,
            "client_secret": settings.HUBSPOT_CLIENT_SECRET if hasattr(settings, "HUBSPOT_CLIENT_SECRET") else None,
            "scopes": ["crm.objects.contacts.read", "crm.objects.contacts.write"],
        },
        "salesforce": {
            "auth_url": "https://login.salesforce.com/services/oauth2/authorize",
            "token_url": "https://login.salesforce.com/services/oauth2/token",
            "client_id": settings.SALESFORCE_CLIENT_ID if hasattr(settings, "SALESFORCE_CLIENT_ID") else None,
            "client_secret": settings.SALESFORCE_CLIENT_SECRET if hasattr(settings, "SALESFORCE_CLIENT_SECRET") else None,
            "scopes": ["api", "refresh_token", "offline_access"],
        },
        "zoho-crm": {
            "auth_url": "https://accounts.zoho.com/oauth/v2/auth",
            "token_url": "https://accounts.zoho.com/oauth/v2/token",
            "client_id": settings.ZOHO_CLIENT_ID if hasattr(settings, "ZOHO_CLIENT_ID") else None,
            "client_secret": settings.ZOHO_CLIENT_SECRET if hasattr(settings, "ZOHO_CLIENT_SECRET") else None,
            "scopes": ["ZohoCRM.users.ALL", "ZohoCRM.modules.ALL"],
        },
        "dynamics-365": {
            "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            "client_id": settings.DYNAMICS_CLIENT_ID if hasattr(settings, "DYNAMICS_CLIENT_ID") else None,
            "client_secret": settings.DYNAMICS_CLIENT_SECRET if hasattr(settings, "DYNAMICS_CLIENT_SECRET") else None,
            "scopes": ["https://graph.microsoft.com/.default"],
        },
    }

    def build_state(self, user_id: str, slug: str) -> str:
        """Build OAuth state parameter."""
        state_data = {
            "uid": user_id,
            "slug": slug,
            "nonce": secrets.token_hex(16),
        }
        # In production, this should be encrypted/signed
        return json.dumps(state_data)

    def verify_state(self, state: str) -> Optional[Dict]:
        """Verify and decode OAuth state parameter."""
        try:
            return json.loads(state)
        except (json.JSONDecodeError, TypeError):
            return None

    def build_auth_url(self, slug: str, redirect_uri: str, state: str) -> str:
        """Build OAuth authorization URL for a given CRM platform."""
        if slug not in self.OAUTH_CONFIG:
            raise RuntimeError(f"OAuth provider '{slug}' not supported")

        config = self.OAUTH_CONFIG[slug]
        if not config["client_id"]:
            raise RuntimeError(f"OAuth provider '{slug}' not configured (missing client ID)")

        params = {
            "client_id": config["client_id"],
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": " ".join(config["scopes"]),
        }

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{config['auth_url']}?{query_string}"
