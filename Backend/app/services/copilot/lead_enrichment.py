"""
Lead Enrichment Pipeline — gathers multi-source intelligence on a specific
lead before email generation.  Each source runs concurrently via asyncio.gather
with independent error handling so a single failure never blocks the others.

Sources:
  1. Google Search (Serper) — lead's recent activity & mentions
  2. YouTube (Serper site:youtube.com) — talks, interviews, webinars
  3. LinkedIn (Tavily site:linkedin.com) — public posts & articles
  4. Company firmographics (Explorium) — via existing enrichment module
  5. Company news (Tavily) — via existing enrichment module
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings
from app.services.copilot.enrichment import (
    enrich_company,
    fetch_recent_news,
    format_company_context,
    format_news_context,
    _tavily_search,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared httpx client — reused across all enrichment calls to avoid
# connection setup overhead per request.
# ---------------------------------------------------------------------------

_shared_client: Optional[httpx.AsyncClient] = None


def _get_shared_client() -> httpx.AsyncClient:
    """Get or create a shared httpx AsyncClient with connection pooling."""
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(
            timeout=10.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _shared_client


# ---------------------------------------------------------------------------
# Lead context dataclass
# ---------------------------------------------------------------------------

@dataclass
class LeadContext:
    """Aggregated enrichment data for a single lead."""

    # Lead identity
    name: str
    company: str
    role: str
    domain: Optional[str] = None

    # Enriched data (all default to empty — graceful fallback)
    google_mentions: List[Dict[str, Any]] = field(default_factory=list)
    youtube_appearances: List[Dict[str, Any]] = field(default_factory=list)
    linkedin_posts: List[Dict[str, Any]] = field(default_factory=list)
    company_data: Dict[str, Any] = field(default_factory=dict)
    recent_news: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def sources_used(self) -> List[str]:
        sources = []
        if self.google_mentions:
            sources.append("google")
        if self.youtube_appearances:
            sources.append("youtube")
        if self.linkedin_posts:
            sources.append("linkedin")
        if self.company_data:
            sources.append("explorium")
        if self.recent_news:
            sources.append("tavily_news")
        return sources

    def to_prompt_context(self) -> str:
        """Format all enrichment into a structured text block for the LLM prompt."""
        sections: List[str] = []

        # Google mentions
        if self.google_mentions:
            lines = [f"=== RECENT MENTIONS OF {(self.name or "").upper()} (Google) ==="]
            for item in self.google_mentions[:5]:
                lines.append(f"- {item.get('title', '')}: {item.get('snippet', '')[:200]}")
            lines.append("=== END MENTIONS ===")
            sections.append("\n".join(lines))

        # YouTube appearances
        if self.youtube_appearances:
            lines = [f"=== YOUTUBE APPEARANCES — {(self.name or "").upper()} ==="]
            for item in self.youtube_appearances[:5]:
                lines.append(f"- {item.get('title', '')} ({item.get('link', '')})")
            lines.append("=== END YOUTUBE ===")
            sections.append("\n".join(lines))

        # LinkedIn posts
        if self.linkedin_posts:
            lines = [f"=== LINKEDIN ACTIVITY — {(self.name or "").upper()} ==="]
            for item in self.linkedin_posts[:5]:
                title = item.get("title") or item.get("content", "")[:120]
                lines.append(f"- {title}")
            lines.append("=== END LINKEDIN ===")
            sections.append("\n".join(lines))

        # Company data (reuse existing formatter)
        company_block = format_company_context(self.company_data)
        if company_block:
            sections.append(company_block)

        # Recent news (reuse existing formatter)
        news_block = format_news_context(self.recent_news)
        if news_block:
            sections.append(news_block)

        return "\n\n".join(sections)


# ---------------------------------------------------------------------------
# Serper Google search (reuses pattern from ai_agents_service._call_serper)
# ---------------------------------------------------------------------------

async def _serper_search(query: str, num: int = 5) -> List[Dict[str, Any]]:
    """Run a Google search via Serper. Returns list of {title, snippet, link}."""
    api_key = settings.SERPER_API_KEY
    if not api_key:
        return []
    try:
        client = _get_shared_client()
        resp = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query, "num": num},
        )
        if resp.status_code == 429:
            await asyncio.sleep(1)
            resp = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "num": num},
            )
        resp.raise_for_status()
        return resp.json().get("organic", [])
    except Exception as exc:
        logger.warning("Serper search failed for %r: %s", query, exc)
        return []


# ---------------------------------------------------------------------------
# Individual enrichment sources
# ---------------------------------------------------------------------------

async def _fetch_google_mentions(name: str, company: str, role: str) -> List[Dict[str, Any]]:
    """Google search for lead's recent activity and mentions."""
    query = f"{name} {company} {role} recent news interview podcast"
    return await _serper_search(query, num=5)


async def _fetch_youtube_appearances(name: str, company: str) -> List[Dict[str, Any]]:
    """YouTube search via Serper site filter."""
    query = f"{name} {company} site:youtube.com"
    return await _serper_search(query, num=5)


async def _fetch_linkedin_posts(name: str, company: str) -> List[Dict[str, Any]]:
    """LinkedIn public posts via Tavily site search."""
    query = f"{name} {company} LinkedIn post OR article site:linkedin.com"
    results = await _tavily_search(query, max_results=5)
    # Normalize to same shape as other sources
    return [
        {"title": r.get("title", ""), "content": r.get("content", ""), "link": r.get("url", "")}
        for r in results
    ]


async def _fetch_company_data(company: str, domain: Optional[str]) -> Dict[str, Any]:
    """Company enrichment via Explorium (reuses existing module)."""
    return await enrich_company(company, domain)


async def _fetch_company_news(company: str) -> List[Dict[str, Any]]:
    """Recent company news via Tavily (reuses existing module)."""
    return await fetch_recent_news(company, max_results=5)


# ---------------------------------------------------------------------------
# Main enrichment service
# ---------------------------------------------------------------------------

class LeadEnrichmentService:
    """Orchestrates concurrent enrichment from all sources for a single lead."""

    @staticmethod
    async def enrich(
        name: str,
        company: str,
        role: str = "",
        domain: Optional[str] = None,
        include_company_data: bool = True,
        include_company_news: bool = True,
    ) -> LeadContext:
        """
        Gather all enrichment data concurrently.
        Every source is independent — individual failures are logged and skipped.
        """
        async def _maybe_company_data() -> Dict[str, Any]:
            if not include_company_data:
                return {}
            return await _fetch_company_data(company, domain)

        async def _maybe_company_news() -> List[Dict[str, Any]]:
            if not include_company_news:
                return []
            return await _fetch_company_news(company)

        try:
            (
                google_mentions,
                youtube_appearances,
                linkedin_posts,
                company_data,
                recent_news,
            ) = await asyncio.wait_for(
                asyncio.gather(
                    _fetch_google_mentions(name, company, role),
                    _fetch_youtube_appearances(name, company),
                    _fetch_linkedin_posts(name, company),
                    _maybe_company_data(),
                    _maybe_company_news(),
                    return_exceptions=True,
                ),
                timeout=15.0,
            )
        except asyncio.TimeoutError:
            logger.warning("Lead enrichment pipeline timed out after 15s — returning partial context")
            google_mentions = []
            youtube_appearances = []
            linkedin_posts = []
            company_data = {}
            recent_news = []

        # Convert any exceptions to safe defaults
        if isinstance(google_mentions, BaseException):
            logger.warning("Google mentions enrichment failed: %s", google_mentions)
            google_mentions = []
        if isinstance(youtube_appearances, BaseException):
            logger.warning("YouTube enrichment failed: %s", youtube_appearances)
            youtube_appearances = []
        if isinstance(linkedin_posts, BaseException):
            logger.warning("LinkedIn enrichment failed: %s", linkedin_posts)
            linkedin_posts = []
        if isinstance(company_data, BaseException):
            logger.warning("Company enrichment failed: %s", company_data)
            company_data = {}
        if isinstance(recent_news, BaseException):
            logger.warning("Company news enrichment failed: %s", recent_news)
            recent_news = []

        return LeadContext(
            name=name,
            company=company,
            role=role,
            domain=domain,
            google_mentions=google_mentions,
            youtube_appearances=youtube_appearances,
            linkedin_posts=linkedin_posts,
            company_data=company_data,
            recent_news=recent_news,
        )
