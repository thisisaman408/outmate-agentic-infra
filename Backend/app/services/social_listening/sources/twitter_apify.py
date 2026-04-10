"""Apify Twitter/X source — optional, for monitoring X posts."""

from __future__ import annotations
import asyncio
import logging
from typing import Any, Dict, List
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"
TWITTER_ACTOR = "apidojo~tweet-scraper"


def is_available() -> bool:
    return bool(getattr(settings, "APIFY_API_TOKEN", "") or getattr(settings, "APIFY_API_KEY", ""))


async def search_tweets(
    keywords: List[str],
    max_results: int = 10,
    time_frame: str = "week",
) -> List[Dict[str, Any]]:
    """Search Twitter/X posts via Apify. Returns normalized signal dicts."""
    token = getattr(settings, "APIFY_API_TOKEN", "") or getattr(settings, "APIFY_API_KEY", "")
    if not token:
        return []

    query = " ".join(keywords)

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{APIFY_BASE}/acts/{TWITTER_ACTOR}/runs",
                params={"token": token},
                json={
                    "searchTerms": [query],
                    "maxTweets": max_results,
                    "sort": "Latest",
                },
            )
            if resp.status_code >= 400:
                logger.warning("Apify Twitter actor failed: %s", resp.status_code)
                return []

            run_id = resp.json().get("data", {}).get("id")
            if not run_id:
                return []

            dataset_id = None
            for _ in range(18):
                await asyncio.sleep(5)
                sr = await client.get(f"{APIFY_BASE}/actor-runs/{run_id}", params={"token": token})
                info = sr.json().get("data", {})
                if info.get("status") == "SUCCEEDED":
                    dataset_id = info.get("defaultDatasetId")
                    break
                if info.get("status") in ("FAILED", "ABORTED", "TIMED-OUT"):
                    return []

            if not dataset_id:
                return []

            items_resp = await client.get(
                f"{APIFY_BASE}/datasets/{dataset_id}/items",
                params={"token": token, "limit": max_results},
            )
            items = items_resp.json() if items_resp.status_code == 200 else []

    except Exception as exc:
        logger.warning("Apify Twitter search error: %s", exc)
        return []

    results: List[Dict[str, Any]] = []
    for item in (items if isinstance(items, list) else []):
        author = item.get("author", {}) if isinstance(item.get("author"), dict) else {}
        results.append({
            "source": "apify_twitter",
            "name": author.get("name") or item.get("authorName") or "",
            "title": author.get("description", "")[:100] or "",
            "company": "",
            "linkedin": "",
            "post_url": item.get("url") or item.get("tweetUrl") or "",
            "post_snippet": (item.get("text") or item.get("full_text") or "")[:500],
            "email": "",
            "likes": item.get("likeCount", 0) or item.get("favorite_count", 0) or 0,
            "comments_count": item.get("replyCount", 0) or 0,
            "raw": item,
        })

    logger.info("Apify Twitter search returned %d results", len(results))
    return results
