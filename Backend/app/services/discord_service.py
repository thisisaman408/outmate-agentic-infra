"""Discord OAuth service for Discord integration."""

import logging
from typing import Optional
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

DISCORD_AUTH_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_SCOPES = ["identify", "bot", "applications.commands"]


class DiscordService:
    """Discord OAuth service."""

    @staticmethod
    def is_available() -> bool:
        return bool(settings.DISCORD_CLIENT_ID and settings.DISCORD_CLIENT_SECRET)

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.DISCORD_CLIENT_ID,
            "redirect_uri": settings.DISCORD_REDIRECT_URI,
            "response_type": "code",
            "scope": " ".join(DISCORD_SCOPES),
        }
        if state:
            params["state"] = state
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{DISCORD_AUTH_URL}?{query_string}"

    async def exchange_code(self, code: str, state: str = "") -> dict:
        data = {
            "client_id": settings.DISCORD_CLIENT_ID,
            "client_secret": settings.DISCORD_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.DISCORD_REDIRECT_URI,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(DISCORD_TOKEN_URL, data=data)
            resp.raise_for_status()
            result = resp.json()
            if "error" in result:
                raise RuntimeError(f"Discord OAuth failed: {result.get('error', 'Unknown error')}")
            return result

    def store_tokens(self, user_id, token_data: dict, db=None) -> None:
        """Store Discord tokens in user.integrations."""
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

        # Update user.integrations with discord connection status
        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            ints = {}
        else:
            import json
            ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["discord"] = {
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
        """Remove Discord tokens."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            return

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["discord"] = {
            "connected": False,
            "skipped": False,
        }

        db.execute(
            text("UPDATE users SET integrations = :ints WHERE id = :uid"),
            {"ints": json.dumps(ints), "uid": str(user_id)},
        )
        db.commit()

    def is_connected(self, user_id, db=None) -> bool:
        """Check if a user has connected their Discord account."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return False

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if not ints:
            return False

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints
        discord_status = ints.get("discord", {})
        return discord_status.get("connected", False)
