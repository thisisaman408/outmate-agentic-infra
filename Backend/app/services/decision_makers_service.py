"""
Decision Makers Service — multi-source waterfall
Priority: ContactOut → CrustData (decision_makers/cxos/founders fields) → BetterContact
Returns a normalised list of decision maker dicts.
"""
import asyncio
import httpx
import logging
from typing import List, Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Shape normaliser helpers
# ─────────────────────────────────────────────────────────────────────────────

def _linkedin_url(vanity: str) -> str:
    if not vanity:
        return ""
    v = vanity.strip().lstrip("/")
    if v.startswith("http"):
        return v
    return f"https://www.linkedin.com/in/{v}"


def _norm_contactout(raw: Dict[str, Any]) -> Dict[str, Any]:
    company = raw.get("company") or {}
    return {
        "full_name": raw.get("full_name") or raw.get("name") or "",
        "first_name": raw.get("first_name") or "",
        "last_name": raw.get("last_name") or "",
        "title": raw.get("title") or raw.get("headline") or "",
        "headline": raw.get("headline") or "",
        "linkedin_url": _linkedin_url(raw.get("li_vanity") or raw.get("linkedin_url") or ""),
        "profile_picture_url": raw.get("profile_picture_url") or "",
        "location": raw.get("location") or "",
        "email": "",   # blurred – revealed on demand
        "phone": "",
        "company_name": company.get("name") or raw.get("company_name") or "",
        "company_domain": company.get("domain") or raw.get("company_domain") or "",
        "job_function": raw.get("job_function") or "",
        "seniority": raw.get("seniority") or "",
        "contact_availability": raw.get("contact_availability") or {},
        "source": "contactout",
        "raw_data": raw,
    }


def _norm_crustdata_person(raw: Dict[str, Any], company_domain: str = "") -> Dict[str, Any]:
    """Normalise a person object from CrustData decision_makers / cxos / founders."""
    name = (
        raw.get("full_name")
        or f"{raw.get('first_name', '')} {raw.get('last_name', '')}".strip()
        or raw.get("name")
        or ""
    )
    li_url = (
        raw.get("linkedin_profile_url")
        or raw.get("linkedin_url")
        or _linkedin_url(raw.get("li_vanity") or "")
    )
    return {
        "full_name": name,
        "first_name": raw.get("first_name") or "",
        "last_name": raw.get("last_name") or "",
        "title": raw.get("title") or raw.get("headline") or "",
        "headline": raw.get("headline") or raw.get("title") or "",
        "linkedin_url": li_url,
        "profile_picture_url": raw.get("profile_picture_url") or raw.get("profile_image_url") or "",
        "location": raw.get("location") or raw.get("region") or "",
        "email": "",
        "phone": "",
        "company_name": raw.get("company_name") or raw.get("company") or "",
        "company_domain": company_domain,
        "job_function": raw.get("function_category") or raw.get("job_function") or "",
        "seniority": raw.get("seniority_level") or raw.get("seniority") or "",
        "contact_availability": {},
        "source": "crustdata",
        "raw_data": raw,
    }


def _norm_bettercontact(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "full_name": raw.get("full_name") or raw.get("name") or "",
        "first_name": raw.get("first_name") or "",
        "last_name": raw.get("last_name") or "",
        "title": raw.get("job_title") or raw.get("title") or "",
        "headline": raw.get("headline") or "",
        "linkedin_url": raw.get("linkedin_url") or "",
        "profile_picture_url": raw.get("profile_picture_url") or "",
        "location": raw.get("location") or "",
        "email": raw.get("email") or "",
        "phone": raw.get("phone") or "",
        "company_name": raw.get("company") or raw.get("company_name") or "",
        "company_domain": raw.get("domain") or "",
        "job_function": "",
        "seniority": raw.get("seniority") or "",
        "contact_availability": {},
        "source": "bettercontact",
        "raw_data": raw,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Source 1: ContactOut
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_contactout(domain: str) -> List[Dict[str, Any]]:
    from app.services.contactout_service import ContactOutService
    try:
        svc = ContactOutService()
        dm_data = await svc.get_decision_makers(domain=domain, reveal_info=False, page=1)
        profiles = dm_data.get("profiles") or {}
        if isinstance(profiles, dict):
            people = list(profiles.values())
        elif isinstance(profiles, list):
            people = profiles
        else:
            people = []
        result = [_norm_contactout(p) for p in people if isinstance(p, dict)]
        if result:
            logger.info("DecisionMakers: ContactOut returned %d people for %s", len(result), domain)
        return result
    except Exception as exc:
        logger.warning("DecisionMakers: ContactOut failed for %s: %s", domain, exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Source 2: CrustData enrichment (decision_makers, cxos, founders fields)
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_crustdata(domain: str) -> List[Dict[str, Any]]:
    from app.services.crustdata_service import CrustdataService
    try:
        svc = CrustdataService()
        data = await svc.enrich_company(
            domain=domain,
            fields="decision_makers,cxos,founders",
            exact_match=True,
            enrich_realtime=False,
        )

        companies = data.get("companies") if isinstance(data, dict) else None
        company = companies[0] if isinstance(companies, list) and companies else (data if isinstance(data, dict) else {})

        people: List[Dict[str, Any]] = []

        for field in ("decision_makers", "cxos", "founders"):
            raw_list = company.get(field) or []
            if isinstance(raw_list, list):
                for p in raw_list:
                    if isinstance(p, dict) and (p.get("full_name") or p.get("name")):
                        people.append(_norm_crustdata_person(p, domain))

        # Deduplicate by linkedin_url, fall back to name
        seen: set = set()
        unique: List[Dict[str, Any]] = []
        for p in people:
            key = p.get("linkedin_url") or p.get("full_name")
            if key and key not in seen:
                seen.add(key)
                unique.append(p)

        if unique:
            logger.info("DecisionMakers: CrustData returned %d people for %s", len(unique), domain)
        return unique
    except Exception as exc:
        logger.warning("DecisionMakers: CrustData failed for %s: %s", domain, exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Source 3: BetterContact (people search by company domain)
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_bettercontact(domain: str) -> List[Dict[str, Any]]:
    api_key = getattr(settings, "BETTERCONTACT_API_KEY", None)
    if not api_key:
        return []
    try:
        # BetterContact /people/search endpoint
        url = "https://app.bettercontact.rocks/api/v2/async/people"
        payload = {
            "company_domain": domain,
            "seniority": ["c_suite", "vp", "director", "manager"],
            "limit": 10,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            if not resp.is_success:
                logger.warning("DecisionMakers: BetterContact returned %d for %s", resp.status_code, domain)
                return []
            data = resp.json()

        people_raw = data.get("data") or data.get("people") or data.get("results") or []
        if isinstance(people_raw, dict):
            people_raw = list(people_raw.values())

        result = [_norm_bettercontact(p) for p in people_raw if isinstance(p, dict)]
        if result:
            logger.info("DecisionMakers: BetterContact returned %d people for %s", len(result), domain)
        return result
    except Exception as exc:
        logger.warning("DecisionMakers: BetterContact failed for %s: %s", domain, exc)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def get_decision_makers(domain: str, max_results: int = 10) -> Dict[str, Any]:
    """
    Waterfall: ContactOut → CrustData → BetterContact.
    Returns { decision_makers: [...], source: str, total: int }
    """
    # Try ContactOut first
    people = await _fetch_contactout(domain)
    source = "contactout"

    # Fallback: CrustData
    if not people:
        people = await _fetch_crustdata(domain)
        source = "crustdata"

    # Fallback: BetterContact
    if not people:
        people = await _fetch_bettercontact(domain)
        source = "bettercontact"

    people = people[:max_results]

    return {
        "decision_makers": people,
        "source": source if people else "none",
        "total": len(people),
    }
