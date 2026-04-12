"""Apify LinkedIn source — optional enhancer for deeper profile data."""

from __future__ import annotations
import asyncio
import logging
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"
# LinkedIn post scraper actor
LINKEDIN_POSTS_ACTOR = "curious_coder~linkedin-post-search-scraper"


def is_available() -> bool:
    """Check if Apify is configured."""
    return bool(getattr(settings, "APIFY_API_TOKEN", "") or getattr(settings, "APIFY_API_KEY", ""))


async def search_linkedin_posts(
    keywords: List[str],
    max_results: int = 10,
    time_frame: str = "week",
) -> List[Dict[str, Any]]:
    """Search LinkedIn posts via Apify actor. Returns normalized signal dicts."""
    token = getattr(settings, "APIFY_API_TOKEN", "") or getattr(settings, "APIFY_API_KEY", "")
    if not token:
        return []

    query = " ".join(keywords)

    input_data = {
        "searchTerms": [query],
        "maxResults": max_results,
        "sortBy": "date_posted",
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            # Start the actor run
            resp = await client.post(
                f"{APIFY_BASE}/acts/{LINKEDIN_POSTS_ACTOR}/runs",
                params={"token": token},
                json=input_data,
            )
            if resp.status_code >= 400:
                logger.warning("Apify LinkedIn actor start failed: %s", resp.status_code)
                return []

            run_data = resp.json().get("data", {})
            run_id = run_data.get("id")
            if not run_id:
                return []

            # Poll for completion (max 90s)
            dataset_id = None
            for _ in range(18):
                await asyncio.sleep(5)
                status_resp = await client.get(
                    f"{APIFY_BASE}/actor-runs/{run_id}",
                    params={"token": token},
                )
                run_info = status_resp.json().get("data", {})
                if run_info.get("status") == "SUCCEEDED":
                    dataset_id = run_info.get("defaultDatasetId")
                    break
                if run_info.get("status") in ("FAILED", "ABORTED", "TIMED-OUT"):
                    logger.warning("Apify run %s ended with status %s", run_id, run_info["status"])
                    return []

            if not dataset_id:
                logger.warning("Apify run %s timed out", run_id)
                return []

            # Fetch results
            items_resp = await client.get(
                f"{APIFY_BASE}/datasets/{dataset_id}/items",
                params={"token": token, "limit": max_results},
            )
            items = items_resp.json() if items_resp.status_code == 200 else []

    except Exception as exc:
        logger.warning("Apify LinkedIn search error: %s", exc)
        return []

    results: List[Dict[str, Any]] = []
    for item in (items if isinstance(items, list) else []):
        name = item.get("authorName") or item.get("author", {}).get("name", "") or ""
        results.append({
            "source": "apify_linkedin",
            "name": name,
            "title": item.get("authorHeadline") or item.get("author", {}).get("headline", "") or "",
            "company": item.get("authorCompany") or "",
            "linkedin": item.get("authorProfileUrl") or item.get("authorUrl") or "",
            "post_url": item.get("url") or item.get("postUrl") or "",
            "post_snippet": (item.get("text") or item.get("content") or "")[:500],
            "email": "",
            "likes": item.get("likesCount", 0) or 0,
            "comments_count": item.get("commentsCount", 0) or 0,
            "raw": item,
        })

    logger.info("Apify LinkedIn search returned %d results", len(results))
    return results
