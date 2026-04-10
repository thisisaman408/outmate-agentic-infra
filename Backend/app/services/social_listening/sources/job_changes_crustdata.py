"""CrustData job change detection source.

Reuses the existing champion job-change infrastructure (champion_tasks.py)
but exposes it as a social listening source.  Searches for recent job
changes matching keywords (job titles, companies, industries).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

CRUSTDATA_PERSON_SEARCH = "https://api.crustdata.com/screener/person/search"


async def search_job_changes(
    keywords: List[str],
    filters: Optional[Dict[str, Any]] = None,
    max_results: int = 10,
    time_frame: str = "week",
) -> List[Dict[str, Any]]:
    """Search for recent job changes matching keywords via CrustData.

    Uses the person search endpoint filtered by title keywords and
    recent job start dates.
    """
    if not settings.CRUSTDATA_API_KEY:
        logger.warning("CRUSTDATA_API_KEY not set — skipping job change search")
        return []

    # Build title/company keywords for person search
    query = " OR ".join(f'"{kw}"' for kw in keywords)

    # Job title filters from the wizard
    job_titles = []
    seniority = []
    if filters:
        job_titles = filters.get("job_titles", [])
        seniority = filters.get("seniority", [])

    headers = {
        "Authorization": f"Token {settings.CRUSTDATA_API_KEY}",
        "Content-Type": "application/json",
    }

    # Use the LinkedIn posts endpoint with job_change content type
    # CrustData surfaces job change announcements as posts
    payload: Dict[str, Any] = {
        "keyword": query,
        "sort_by": "date_posted",
        "date_posted": "past-week" if time_frame in ("week", "today", "hour") else "past-month",
        "page": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Search LinkedIn posts about job changes
            resp = await client.post(
                f"{settings.CRUSTDATA_BASE_URL}/screener/linkedin_posts/keyword_search/",
                headers=headers,
                json={
                    "keyword": f"({query}) AND (new role OR joined OR excited to announce OR started OR new position OR new chapter)",
                    "sort_by": "date_posted",
                    "date_posted": payload["date_posted"],
                    "page": 1,
                },
            )
            if resp.status_code >= 400:
                logger.warning("CrustData job change search failed: %s", resp.status_code)
                return []
            data = resp.json()
    except Exception as exc:
        logger.warning("CrustData job change search error: %s", exc)
        return []

    posts = data if isinstance(data, list) else data.get("posts", data.get("data", []))

    results: List[Dict[str, Any]] = []
    for post in posts[:max_results]:
        person = post.get("person_details") or {}
        company_d = post.get("company_details") or {}

        name = person.get("person_name") or post.get("actor_name") or ""
        title = person.get("person_title") or ""
        company = company_d.get("company_name") or ""
        linkedin = (
            person.get("person_linkedin_flagship_profile_url")
            or company_d.get("company_linkedin_url")
            or ""
        )
        post_url = post.get("share_url") or ""
        post_text = post.get("text") or ""

        if not post_text:
            continue

        results.append({
            "source": "crustdata_job_change",
            "signal_type": "social_job_change",
            "name": name,
            "title": title,
            "company": company,
            "linkedin": linkedin,
            "post_url": post_url,
            "post_snippet": post_text[:500],
            "email": "",
            "email_unverified": False,
            "likes": post.get("total_reactions") or 0,
            "comments_count": post.get("total_comments") or 0,
            "best_hook": "",
            "message": "",
            "raw": post,
        })

    logger.info("CrustData job change search returned %d results", len(results))
    return results
