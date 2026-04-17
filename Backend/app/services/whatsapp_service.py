"""WhatsApp Business service using Unipile API."""

import logging
from typing import Optional
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    """WhatsApp Business service using Unipile API."""

    def __init__(self):
        self.api_key = settings.UNIPILE_API_KEY
        self.dsn = settings.UNIPILE_DSN
        self.account_id: Optional[str] = None

    @staticmethod
    def is_available() -> bool:
        return bool(settings.UNIPILE_API_KEY and settings.UNIPILE_DSN)

    async def _ensure_account_id(self):
        """Fetch the first linked WhatsApp account ID if not cached."""
        if self.account_id:
            return

        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            response = await client.get(
                f"{self.dsn}/api/v1/accounts",
                headers={
                    "X-API-KEY": self.api_key,
                    "accept": "application/json",
                }
            )

            if response.status_code == 200:
                data = response.json()
                accounts = data if isinstance(data, list) else data.get("items", data.get("accounts", []))
                for acc in accounts:
                    if acc.get("type") == "WHATSAPP" or "whatsapp" in str(acc.get("provider", "")).lower():
                        self.account_id = acc.get("id")
                        logger.info(f"Found WhatsApp account: {self.account_id}")
                        return
                # If no explicit WhatsApp account, use the first one
                if accounts:
                    self.account_id = accounts[0].get("id")
                    logger.info(f"Using first account: {self.account_id}")
            else:
                logger.error(f"Failed to list accounts: {response.status_code} {response.text}")

    def store_api_key(self, user_id, phone_number_id: str = "", access_token: str = "", webhook_verify_token: str = "", db=None) -> None:
        """Store WhatsApp Unipile connection credentials."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            raise RuntimeError("db session required")

        creds = {
            "account_id": self.account_id,
            "phone_number_id": phone_number_id,
            "access_token": access_token,
            "webhook_verify_token": webhook_verify_token,
            "installed_at": str(datetime.now(timezone.utc)),
        }

        # Update user.integrations with whatsapp connection status
        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            ints = {}
        else:
            import json
            ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["whatsapp"] = {
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
        """Remove WhatsApp credentials."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if ints is None:
            return

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints

        ints["whatsapp"] = {
            "connected": False,
            "skipped": False,
        }

        db.execute(
            text("UPDATE users SET integrations = :ints WHERE id = :uid"),
            {"ints": json.dumps(ints), "uid": str(user_id)},
        )
        db.commit()

    def is_connected(self, user_id, db=None) -> bool:
        """Check if a user has connected their WhatsApp Business account."""
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        if not db:
            return False

        ints = db.execute(text("SELECT integrations FROM users WHERE id = :uid"), {"uid": str(user_id)}).scalar()
        if not ints:
            return False

        import json
        ints = json.loads(ints) if isinstance(ints, str) else ints
        whatsapp_status = ints.get("whatsapp", {})
        return whatsapp_status.get("connected", False)

    async def send_message(self, phone_number: str, message: str) -> dict:
        """Send a WhatsApp message via Unipile."""
        await self._ensure_account_id()
        if not self.account_id:
            raise ValueError("No WhatsApp account connected in Unipile")

        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            response = await client.post(
                f"{self.dsn}/api/v1/messages",
                headers={
                    "X-API-KEY": self.api_key,
                    "accept": "application/json",
                },
                data={
                    "account_id": self.account_id,
                    "recipient": phone_number,
                    "text": message,
                }
            )

            if response.status_code in (200, 201):
                result = response.json()
                message_id = result.get("message_id") or result.get("id")
                logger.info(f"WhatsApp message sent, message_id: {message_id}")
                return {
                    "success": True,
                    "message_id": message_id,
                    "phone_number": phone_number,
                }
            else:
                error = response.text
                logger.error(f"WhatsApp message send failed: {response.status_code} {error[:300]}")
                raise ValueError(f"Unipile WhatsApp message send failed: {response.status_code} - {error[:200]}")
