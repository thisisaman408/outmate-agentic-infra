"""
Copilot Data Enrichment — fetches real data from Explorium & Tavily
before passing it to the LLM.  Each helper returns a plain-text block
that can be injected straight into a user prompt.

Every external call is wrapped in try/except so a failure simply returns
an empty string and the copilot falls back to LLM-only behaviour.
"""

import asyncio
import logging
from typing import Dict, Any, Optional

import httpx
from app.core.config import settings
from app.services.explorium_service import ExploriumService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tavily (lightweight inline helper — avoids importing the full AiAgentsService)
# ---------------------------------------------------------------------------

async def _tavily_search(query: str, max_results: int = 5) -> list[dict]:
    """Run a Tavily web search. Returns a list of {title, url, content}."""
    api_key = settings.TAVILY_API_KEY
    if not api_key:
        return []
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "include_answer": False,
        "include_raw_content": False,
        "max_results": max_results,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post("https://api.tavily.com/search", json=payload)
            resp.raise_for_status()
            return resp.json().get("results", [])
    except Exception as exc:
        logger.warning("Tavily search failed for %r: %s", query, exc)
        return []


# ---------------------------------------------------------------------------
# Company enrichment via Explorium
# ---------------------------------------------------------------------------

async def enrich_company(company_name: str, company_domain: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch real company data from Explorium.
    Returns a dict with whatever was found, or {} on failure.
    """
    try:
        svc = ExploriumService()
        filters: Dict[str, Any] = {}
        if company_domain:
            filters["domain"] = company_domain
        if company_name:
            filters["name"] = company_name

        result = await svc.search_companies(filters, limit=1)
        companies = result.get("companies", [])
        if not companies:
            return {}

        company = companies[0]

        # Use the existing enrich_company_fully which does all modules
        # (firmographics, funding, technographics, financials, etc.)
        try:
            enriched = await svc.enrich_company_fully(company)
            if enriched:
                return enriched
        except Exception as exc:
            logger.debug("enrich_company_fully failed, returning search result: %s", exc)

        return company
    except Exception as exc:
        logger.warning("Company enrichment failed for %r: %s", company_name, exc)
        return {}


# ---------------------------------------------------------------------------
# News / web search for company or prospect
# ---------------------------------------------------------------------------

async def fetch_recent_news(company_name: str, max_results: int = 5) -> list[dict]:
    """Search for recent news about a company. Returns [{title, url, content}]."""
    return await _tavily_search(f"{company_name} latest news 2026", max_results=max_results)


async def fetch_prospect_info(prospect_name: str, company_name: str) -> list[dict]:
    """Search for public info about a prospect. Returns [{title, url, content}]."""
    return await _tavily_search(
        f"{prospect_name} {company_name} executive background",
        max_results=3,
    )


# ---------------------------------------------------------------------------
# Format helpers — turn raw enrichment data into LLM-ready text blocks
# ---------------------------------------------------------------------------

def format_company_context(data: Dict[str, Any]) -> str:
    """Build a text block of real company data for the LLM prompt."""
    if not data:
        return ""
    lines = ["=== VERIFIED COMPANY DATA (from Explorium) ==="]
    _add(lines, "Name", data.get("name"))
    _add(lines, "Domain", data.get("domain"))
    _add(lines, "Industry", data.get("industry"))
    _add(lines, "Employee range", data.get("employee_count_range"))
    _add(lines, "Revenue range", data.get("revenue_range"))
    _add(lines, "Headquarters", _join_location(data))
    _add(lines, "Founded", data.get("founding_year") or data.get("founded_year"))
    _add(lines, "Funding stage", data.get("funding_stage"))
    _add(lines, "Total funding", data.get("funding_total"))
    _add(lines, "Last funding date", data.get("last_funding_date"))
    _add(lines, "Investors", _list_str(data.get("investors")))
    _add(lines, "Technologies", _list_str(data.get("technologies")))
    _add(lines, "Competitors", _list_str(data.get("competitors")))
    _add(lines, "Headcount growth (6m)", data.get("headcount_growth_6m"))
    _add(lines, "Headcount growth (12m)", data.get("headcount_growth_12m"))
    _add(lines, "LinkedIn followers", data.get("follower_count") or data.get("linkedin_followers"))
    if data.get("business_challenges"):
        lines.append(f"Business challenges: {data['business_challenges']}")
    lines.append("=== END COMPANY DATA ===")
    return "\n".join(lines)


def format_news_context(articles: list[dict]) -> str:
    """Build a text block of recent news for the LLM prompt."""
    if not articles:
        return ""
    lines = ["=== RECENT NEWS (from web search) ==="]
    for a in articles[:5]:
        title = a.get("title", "")
        snippet = a.get("content", "")[:200]
        lines.append(f"- {title}: {snippet}")
    lines.append("=== END NEWS ===")
    return "\n".join(lines)


def format_prospect_context(articles: list[dict], prospect_name: str) -> str:
    """Build a text block of prospect information for the LLM prompt."""
    if not articles:
        return ""
    lines = [f"=== PUBLIC INFO ABOUT {(prospect_name or '').upper()} (from web search) ==="]
    for a in articles[:3]:
        title = a.get("title", "")
        snippet = a.get("content", "")[:200]
        lines.append(f"- {title}: {snippet}")
    lines.append("=== END PROSPECT INFO ===")
    return "\n".join(lines)


def _add(lines: list, label: str, value) -> None:
    if value and str(value).strip() and str(value).strip().lower() not in ("none", "n/a", "unknown", "0"):
        lines.append(f"{label}: {value}")


def _list_str(val) -> str:
    if isinstance(val, list):
        items = [str(x).strip() for x in val[:10] if x]
        return ", ".join(items) if items else ""
    return str(val) if val else ""


def _join_location(data: dict) -> str:
    parts = [
        data.get("headquarters_city"),
        data.get("headquarters_state"),
        data.get("headquarters_country"),
    ]
    return ", ".join(p for p in parts if p) or ""
