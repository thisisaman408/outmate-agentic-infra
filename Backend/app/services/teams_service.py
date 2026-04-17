"""Microsoft Teams OAuth service for Teams integration."""

import logging
from typing import Optional
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TEAMS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
TEAMS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
TEAMS_SCOPES = ["https://graph.microsoft.com/ChannelMessage.Send.All", "https://graph.microsoft.com/Chat.ReadWrite", "https://graph.microsoft.com/Team.ReadBasic.All"]


class TeamsService:
    """Microsoft Teams OAuth service."""

    @staticmethod
    def is_available() -> bool:
        return bool(settings.TEAMS_CLIENT_ID and settings.TEAMS_CLIENT_SECRET)

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.TEAMS_CLIENT_ID,
            "redirect_uri": settings.TEAMS_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(TEAMS_SCOPES),
        }
        if state:
            params["state"] = state
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{TEAMS_AUTH_URL}?{query_string}"

    async def exchange_code(self, code: str, state: str = "") -> dict:
        data = {
            "client_id": settings.TEAMS_CLIENT_ID,
            "client_secret": settings.TEAMS_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.TEAMS_REDIRECT_URI,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(TEAMS_TOKEN_URL, data=data)
            resp.raise_for_status()
            result = resp.json()
            if "error" in result:
                raise RuntimeError(f"Teams OAuth failed: {result.get('error', 'Unknown error')}")
            return result

    def store_tokens(self, user_id, token_data: dict, db=None) -> None:
        """Store Teams tokens in user.integrations."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            raise RuntimeError("db session required")

        creds = {
            "access_token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "token_type": token_data.get("token_type", "Bearer"),
            "expires_in": token_data.get("expires_in"),
            "scope": token_data.get("scope", ""),
            "installed_at": str(datetime.now(timezone.utc)),
        }

        # Update user.integrations with teams connection status
        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            ints = {}
        else:
            import json
            ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["teams"] = {
            "connected": True,
            "skipped": False,
            "connected_at": str(datetime.now(timezone.utc)),
            "credentials": creds,
        }

        db.execute(
            text("UPDATE users SET integrations = :ints WHERE id = :uid"),
            {"ints": json.dumps(ints), "uid": str(user_id)},
        )
        db.commit()

    def disconnect(self, user_id, db=None) -> None:
        """Remove Teams tokens."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            return

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["teams"] = {
            "connected": False,
            "skipped": False,
        }

        db.execute(
            text("UPDATE users SET integrations = :ints WHERE id = :uid"),
            {"ints": json.dumps(ints), "uid": str(user_id)},
        )
        db.commit()

    def is_connected(self, user_id, db=None) -> bool:
        """Check if a user has connected their Teams account."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return False

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if not ints:
            return False

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints
        teams_status = ints.get("teams", {})
        return teams_status.get("connected", False)
