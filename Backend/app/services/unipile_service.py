"""
Unipile Service - LinkedIn messaging via Unipile API.
Resolves LinkedIn profile URLs to provider IDs and sends messages.
"""

import os
import re
import logging
from typing import Optional, Dict, Any, List
import httpx

logger = logging.getLogger(__name__)


class UnipileService:
    def __init__(self):
        self.api_key = os.getenv("UNIPILE_API_KEY")
        self.dsn = os.getenv("UNIPILE_DSN", "https://api24.unipile.com:15484")
        self.account_id: Optional[str] = None

    async def _ensure_account_id(self):
        """Fetch the first linked LinkedIn account ID if not cached."""
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
                    if acc.get("type") == "LINKEDIN" or "linkedin" in str(acc.get("provider", "")).lower():
                        self.account_id = acc.get("id")
                        print(f">>> [Unipile] Found LinkedIn account: {self.account_id}", flush=True)
                        return
                # If no explicit LinkedIn account, use the first one
                if accounts:
                    self.account_id = accounts[0].get("id")
                    print(f">>> [Unipile] Using first account: {self.account_id}", flush=True)
            else:
                print(f">>> [Unipile] Failed to list accounts: {response.status_code} {response.text}", flush=True)

    def _extract_linkedin_identifier(self, linkedin_url: str) -> Optional[str]:
        """Extract LinkedIn vanity name or ID from a profile URL."""
        if not linkedin_url:
            return None

        # Match patterns like /in/username or /sales/lead/ACo... or /sales/people/ACo...
        patterns = [
            r"linkedin\.com/in/([^/?]+)",
            r"linkedin\.com/sales/lead/([^/?]+)",
            r"linkedin\.com/sales/people/([^/?]+)",
        ]
        for pat in patterns:
            match = re.search(pat, linkedin_url)
            if match:
                return match.group(1).strip("/")

        return None

    async def resolve_provider_id(self, linkedin_url: str) -> Optional[str]:
        """Resolve a LinkedIn profile URL to a Unipile provider_id."""
        await self._ensure_account_id()
        if not self.account_id:
            raise ValueError("No LinkedIn account connected in Unipile")

        identifier = self._extract_linkedin_identifier(linkedin_url)
        if not identifier:
            print(f">>> [Unipile] Could not extract identifier from: {linkedin_url}", flush=True)
            return None

        # Use the user profile endpoint to get the provider_id
        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            response = await client.get(
                f"{self.dsn}/api/v1/users/{identifier}",
                headers={
                    "X-API-KEY": self.api_key,
                    "accept": "application/json",
                },
                params={"account_id": self.account_id}
            )

            if response.status_code == 200:
                data = response.json()
                # The provider_id might be in different fields
                provider_id = (
                    data.get("provider_id")
                    or data.get("id")
                    or data.get("member_urn")
                    or data.get("network_id")
                )
                print(f">>> [Unipile] Resolved {identifier} -> {provider_id}", flush=True)
                return provider_id
            else:
                print(f">>> [Unipile] Profile lookup failed for {identifier}: {response.status_code} {response.text[:200]}", flush=True)
                return None

    async def send_message(
        self,
        linkedin_url: str,
        message: str,
    ) -> Dict[str, Any]:
        """Send a LinkedIn message to a user via Unipile."""
        await self._ensure_account_id()
        if not self.account_id:
            raise ValueError("No LinkedIn account connected in Unipile")

        # Resolve the provider ID
        provider_id = await self.resolve_provider_id(linkedin_url)
        if not provider_id:
            raise ValueError(f"Could not resolve LinkedIn profile: {linkedin_url}")

        # Start a new chat (DM) via Unipile
        async with httpx.AsyncClient(timeout=30, verify=False) as client:
            response = await client.post(
                f"{self.dsn}/api/v1/chats",
                headers={
                    "X-API-KEY": self.api_key,
                    "accept": "application/json",
                },
                data={
                    "account_id": self.account_id,
                    "attendees_ids": provider_id,
                    "text": message,
                }
            )

            if response.status_code in (200, 201):
                result = response.json()
                chat_id = result.get("chat_id") or result.get("id")
                print(f">>> [Unipile] Message sent, chat_id: {chat_id}", flush=True)
                return {
                    "success": True,
                    "chat_id": chat_id,
                    "provider_id": provider_id,
                    "linkedin_url": linkedin_url,
                }
            else:
                error = response.text
                print(f">>> [Unipile] Send message failed: {response.status_code} {error[:300]}", flush=True)
                raise ValueError(f"Unipile message send failed: {response.status_code} - {error[:200]}")

    def is_connected(self) -> Dict[str, Any]:
        """Check if Unipile is configured with API key."""
        return {
            "connected": bool(self.api_key),
            "dsn": self.dsn if self.api_key else None,
        }
