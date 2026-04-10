"""CrustData LinkedIn Posts source — the primary, always-available source."""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

async def search_linkedin_posts(
    keywords: List[str],
    boolean_query: Optional[Dict[str, List[str]]] = None,
    filters: Optional[Dict[str, Any]] = None,
    max_results: int = 10,
    time_frame: str = "week",
) -> List[Dict[str, Any]]:
    """Search LinkedIn posts via CrustData keyword search.

    Returns a list of normalized signal dicts ready for ingestion.
    """
    if not settings.CRUSTDATA_API_KEY:
        logger.warning("CRUSTDATA_API_KEY not set — skipping LinkedIn search")
        return []

    # Build the keyword query
    query = " ".join(keywords)
    if boolean_query:
        must = boolean_query.get("must", [])
        should = boolean_query.get("should", [])
        must_not = boolean_query.get("must_not", [])
        if must:
            query = " AND ".join(f'"{w}"' for w in must)
        if should:
            query += " OR " + " OR ".join(f'"{w}"' for w in should)
        if must_not:
            query += " NOT " + " NOT ".join(f'"{w}"' for w in must_not)

    # Map time_frame to CrustData's date_posted parameter
    date_map = {
        "hour": "past-24h",
        "today": "past-24h",
        "week": "past-week",
        "month": "past-month",
        "all": "past-month",
    }
    date_posted = date_map.get(time_frame, "past-week")

    headers = {
        "Authorization": f"Token {settings.CRUSTDATA_API_KEY}",
        "Content-Type": "application/json",
    }

    # CrustData's keyword_search cannot send page + limit together.
    # We paginate by incrementing page until we have enough results.
    all_posts: List[Dict[str, Any]] = []
    max_pages = min(5, (max_results // 10) + 1)  # ~10 per page, cap at 5 pages

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            for page in range(1, max_pages + 1):
                payload: Dict[str, Any] = {
                    "keyword": query,
                    "sort_by": "date_posted",
                    "date_posted": date_posted,
                    "page": page,
                }
                if filters and filters.get("must_contain_links"):
                    payload["content_type"] = "articles"

                resp = await client.post(
                    f"{settings.CRUSTDATA_BASE_URL}/screener/linkedin_posts/keyword_search/",
                    headers=headers,
                    json=payload,
                )
                if resp.status_code >= 400:
                    logger.warning("CrustData keyword search page %d failed: %s", page, resp.status_code)
                    break
                data = resp.json()
                page_posts = data if isinstance(data, list) else data.get("posts", data.get("data", []))
                if not page_posts:
                    break
                all_posts.extend(page_posts)
                if len(all_posts) >= max_results:
                    break
    except Exception as exc:
        logger.warning("CrustData keyword search error: %s", exc)
        if not all_posts:
            return []

    posts = all_posts

    results: List[Dict[str, Any]] = []
    for post in posts[:max_results]:
        # CrustData keyword_search returns person_details / company_details dicts.
        person = post.get("person_details") or {}
        company_d = post.get("company_details") or {}

        name = (
            person.get("person_name")
            or post.get("actor_name")
            or ""
        )
        title = person.get("person_title") or ""
        company = (
            company_d.get("company_name")
            or ""
        )
        linkedin = (
            person.get("person_linkedin_flagship_profile_url")
            or company_d.get("company_linkedin_url")
            or ""
        )
        company_domain = company_d.get("company_domain") or ""

        post_url = post.get("share_url") or ""
        post_text = post.get("text") or ""

        # Engagement
        likes = post.get("total_reactions") or 0
        comments_count = post.get("total_comments") or 0

        if not post_text:
            continue

        results.append({
            "source": "crustdata_linkedin",
            "name": name,
            "title": title,
            "company": company,
            "linkedin": linkedin,
            "post_url": post_url,
            "post_snippet": post_text[:500],
            "email": "",
            "email_unverified": False,
            "likes": likes,
            "comments_count": comments_count,
            "best_hook": "",
            "message": "",
            "raw": post,
        })

    logger.info("CrustData LinkedIn search returned %d results for query=%s", len(results), query[:50])
    return results
