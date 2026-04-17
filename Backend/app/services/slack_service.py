"""Slack OAuth service for Slack integration."""

import logging
from typing import Optional
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

SLACK_AUTH_URL = "https://slack.com/oauth/v2/authorize"
SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access"
SLACK_SCOPES = ["chat:write", "channels:read", "groups:read", "im:read", "im:write", "mpim:read", "mpim:write"]


class SlackService:
    """Slack OAuth service."""

    @staticmethod
    def is_available() -> bool:
        return bool(settings.SLACK_CLIENT_ID and settings.SLACK_CLIENT_SECRET)

    @classmethod
    def get_auth_url(cls, state: str = "") -> str:
        params = {
            "client_id": settings.SLACK_CLIENT_ID,
            "redirect_uri": settings.SLACK_REDIRECT_URI,
            "scope": " ".join(SLACK_SCOPES),
        }
        if state:
            params["state"] = state
        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{SLACK_AUTH_URL}?{query_string}"

    async def exchange_code(self, code: str, state: str = "") -> dict:
        data = {
            "client_id": settings.SLACK_CLIENT_ID,
            "client_secret": settings.SLACK_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.SLACK_REDIRECT_URI,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(SLACK_TOKEN_URL, data=data)
            resp.raise_for_status()
            result = resp.json()
            if not result.get("ok"):
                raise RuntimeError(f"Slack OAuth failed: {result.get('error', 'Unknown error')}")
            return result

    def store_tokens(self, user_id, token_data: dict, db=None) -> None:
        """Store Slack tokens in user.integrations."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            raise RuntimeError("db session required")

        creds = {
            "access_token": token_data.get("access_token"),
            "team_id": token_data.get("team", {}).get("id"),
            "team_name": token_data.get("team", {}).get("name"),
            "enterprise_id": token_data.get("enterprise", {}).get("id"),
            "bot_user_id": token_data.get("bot_user_id"),
            "bot_scopes": token_data.get("scope", ""),
            "installed_at": str(datetime.now(timezone.utc)),
        }

        # Update user.integrations with slack connection status
        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            ints = {}
        else:
            import json
            ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["slack"] = {
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
        """Remove Slack tokens."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            return

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["slack"] = {
            "connected": False,
            "skipped": False,
        }

        db.execute(
            text("UPDATE users SET integrations = :ints WHERE id = :uid"),
            {"ints": json.dumps(ints), "uid": str(user_id)},
        )
        db.commit()

    def is_connected(self, user_id, db=None) -> bool:
        """Check if a user has connected their Slack account."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return False

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if not ints:
            return False

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints
        slack_status = ints.get("slack", {})
        return slack_status.get("connected", False)
