"""HubSpot list → prospect dicts for voice campaigns.

Params schema:
    {"list_id": "42"}

Uses the existing OAuth token (HubSpotService) — no separate auth flow
on the voice-agent side.  If the user has not connected HubSpot yet,
the endpoint caller raises a 400 before we get here.
"""

from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.hubspot_service import HubSpotService


async def resolve_hubspot_list(
    db: Session, user_id: UUID, params: Dict[str, Any]
) -> List[Dict[str, str]]:
    list_id = str(params.get("list_id") or "").strip()
    if not list_id:
        return []

    svc = HubSpotService(db)
    contacts = await svc.list_contacts_in_list(user_id, list_id)

    prospects: List[Dict[str, str]] = []
    seen_phones: set[str] = set()
    for c in contacts:
        props = c.get("properties") or {}
        phone = (props.get("phone") or props.get("mobilephone") or "").strip()
        if not phone or phone in seen_phones:
            continue
        seen_phones.add(phone)
        first = (props.get("firstname") or "").strip()
        last = (props.get("lastname") or "").strip()
        name = f"{first} {last}".strip() or (props.get("email") or "Unknown")
        prospects.append({
            "prospect_name": name,
            "prospect_phone": phone,
            "prospect_company": (props.get("company") or "").strip(),
            "prospect_role": (props.get("jobtitle") or "").strip(),
            "prospect_city": (props.get("city") or "").strip(),
            "prospect_industry": "",
            "context": f"Imported from HubSpot list {list_id}.",
        })
    return prospects
