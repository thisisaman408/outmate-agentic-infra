"""Signal enrichment -- find email/phone for social listening signals.

Uses CrustData person enrichment as primary, BetterContact as fallback.
Designed to be called both on-demand (Enrich button) and automatically
(auto_enrich=True on search creation).
"""

import logging
from typing import Any, Dict, Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.signal_event import SignalEvent

logger = logging.getLogger(__name__)

CRUSTDATA_PERSON_ENRICH = "https://api.crustdata.com/screener/person/enrich"


async def enrich_signal(signal: SignalEvent, db: Session) -> Dict[str, Any]:
    """Enrich a signal with email, phone, and detailed profile data.

    Returns dict with enrichment results.
    """
    raw = signal.raw_data or {}
    linkedin_url = raw.get("linkedin", "")
    name = signal.prospect_name or ""
    company = signal.company_name or ""

    result: Dict[str, Any] = {"status": "no_data", "email": None, "phone": None}

    # BetterContact first (cheaper than CrustData for enrichment)
    if name and getattr(settings, "BETTERCONTACT_API_KEY", None):
        bc_result = await _enrich_bettercontact(name, company, linkedin_url)
        if bc_result:
            result = bc_result

    # CrustData person enrichment as fallback only if BetterContact missed
    if not result.get("email") and linkedin_url and settings.CRUSTDATA_API_KEY:
        crustdata_result = await _enrich_crustdata(linkedin_url)
        if crustdata_result:
            for k, v in crustdata_result.items():
                if v and not result.get(k):
                    result[k] = v

    # Update the signal record.  We only WRITE when the existing column
    # is empty — never overwrite what the scraper originally captured.
    # This turns "Reveal contact" into a proper identity backfill: if
    # the post was ingested as Unknown (empty name/company), the reveal
    # pass pulls those in alongside the email so the card stops showing
    # "Unknown" the moment the user clicks through.
    if result.get("email") and not signal.prospect_email:
        signal.prospect_email = result["email"]
    # Titles: LinkedIn search scrapers (Apify actors, BrightData Discover)
    # frequently truncate the `headline` to "Founder and CEO" / "VP Sales" —
    # the UI then looks stripped-down on every card.  CrustData returns the
    # full headline ("Founder & CEO @ X | Building Y for Z | 10+ yrs…"), so
    # when the enrichment headline is meaningfully richer, upgrade the row
    # rather than silently dropping the better data on the floor.
    enriched_title = result.get("title") or ""
    current_title = signal.prospect_title or ""
    if enriched_title and len(enriched_title) > len(current_title) + 10:
        signal.prospect_title = enriched_title
    elif enriched_title and not current_title:
        signal.prospect_title = enriched_title
    enrichment_name = result.get("name") or result.get("full_name")
    if enrichment_name and not signal.prospect_name:
        signal.prospect_name = enrichment_name
    enrichment_company = result.get("company") or result.get("company_name")
    if enrichment_company and not signal.company_name:
        signal.company_name = enrichment_company

    # Store enrichment data in raw_data
    enrichment_data = dict(raw)
    enrichment_data["enrichment"] = result
    if result.get("email"):
        enrichment_data["email_unverified"] = not result.get("email_verified", False)
    # Backfill profile picture on reveal if the scraper didn't have one.
    # CrustData's person-enrich returns `profile_picture_url`; BetterContact
    # uses `profile_image`.  Normalise to a single key.
    picture = (
        result.get("profile_picture_url")
        or result.get("profile_image")
        or result.get("picture")
    )
    if picture and not enrichment_data.get("profile_picture_url"):
        enrichment_data["profile_picture_url"] = picture
    signal.raw_data = enrichment_data

    db.add(signal)
    db.flush()

    result["status"] = "enriched" if result.get("email") else "no_email_found"
    return result


async def _enrich_crustdata(linkedin_url: str) -> Optional[Dict[str, Any]]:
    """CrustData person enrichment by LinkedIn URL."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                CRUSTDATA_PERSON_ENRICH,
                params={"linkedin_profile_url": linkedin_url},
                headers={"Authorization": f"Token {settings.CRUSTDATA_API_KEY}"},
            )
            if resp.status_code >= 400:
                logger.debug("CrustData person enrich failed: %s", resp.status_code)
                return None
            data = resp.json()

            # CrustData returns person data directly or in a list
            person = (
                data[0]
                if isinstance(data, list) and data
                else data
                if isinstance(data, dict)
                else None
            )
            if not person:
                return None

            return {
                "email": (
                    person.get("work_email")
                    or person.get("personal_email")
                    or person.get("email")
                ),
                "email_verified": bool(person.get("work_email")),
                "phone": person.get("phone_number") or person.get("phone"),
                "title": person.get("title") or person.get("headline"),
                "company": person.get("company_name"),
                "location": person.get("location"),
                "source": "crustdata",
            }
    except Exception as exc:
        logger.debug("CrustData person enrich error: %s", exc)
        return None


async def _enrich_bettercontact(
    name: str, company: str, linkedin_url: str = ""
) -> Optional[Dict[str, Any]]:
    """BetterContact enrichment fallback."""
    if not settings.BETTERCONTACT_API_KEY:
        return None

    try:
        # Split name into first/last
        parts = name.strip().split(" ", 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://app.bettercontact.rocks/api/v2/contacts/enrich",
                headers={
                    "Authorization": f"Bearer {settings.BETTERCONTACT_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "first_name": first_name,
                    "last_name": last_name,
                    "company_name": company,
                    "linkedin_url": linkedin_url,
                },
            )
            if resp.status_code >= 400:
                return None
            data = resp.json()

            return {
                "email": data.get("email") or data.get("work_email"),
                "email_verified": data.get("email_status") == "valid",
                "phone": data.get("phone") or data.get("mobile_phone"),
                "title": data.get("job_title"),
                "source": "bettercontact",
            }
    except Exception as exc:
        logger.debug("BetterContact enrich error: %s", exc)
        return None
