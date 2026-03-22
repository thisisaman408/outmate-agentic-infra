"""
FullContact Enrich Service — resolve person by email or IP.

Uses the FullContact v3 Person Enrich API.
Free tier: 500 matches/month.
"""

import httpx
import logging
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class FullContactService:
    BASE_URL = "https://api.fullcontact.com/v3/person.enrich"

    def __init__(self):
        self.api_key = getattr(settings, "FULLCONTACT_API_KEY", None)

    async def resolve_person(
        self, email: Optional[str] = None, ip: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Enrich a person via FullContact.
        Returns normalized person dict or None.
        """
        if not self.api_key:
            return None
        if not email and not ip:
            return None

        payload: Dict[str, Any] = {}
        if email:
            payload["email"] = email
        if ip:
            payload["ipAddress"] = ip

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    self.BASE_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

            if resp.status_code != 200:
                logger.info("[FullContact] HTTP %d for %s", resp.status_code, email or ip)
                return None

            data = resp.json()
            return self._normalize(data)

        except Exception as e:
            logger.warning("[FullContact] resolve_person failed: %s", e)
            return None

    @staticmethod
    def _normalize(data: Dict[str, Any]) -> Dict[str, Any]:
        """Map FullContact response to standard person fields."""
        full_name = data.get("fullName")
        details = data.get("details", {})
        emails = details.get("emails", [])
        phones = details.get("phones", [])
        profiles = details.get("profiles", {})
        employment = data.get("employment", [])

        linkedin = profiles.get("linkedin", {}).get("url") if isinstance(profiles, dict) else None

        job_title = None
        company_name = None
        company_domain = None
        if employment:
            current = employment[0]
            job_title = current.get("title")
            company_name = current.get("name")
            company_domain = current.get("domain")

        return {
            "full_name": full_name,
            "email": emails[0].get("value") if emails else None,
            "phone": phones[0].get("value") if phones else None,
            "linkedin_url": linkedin,
            "job_title": job_title,
            "company_name": company_name,
            "company_domain": company_domain,
            "source": "fullcontact",
        }
