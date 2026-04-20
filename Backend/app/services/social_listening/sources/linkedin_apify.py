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

    # Map our freshness window to the Apify actor's datePosted enum.
    # The `curious_coder~linkedin-post-search-scraper` actor (and most
    # LinkedIn search actors) accept LinkedIn's native filter values;
    # anything unrecognised makes the actor return all posts regardless
    # of age — which is exactly the bug we hit.
    _DATE_FILTER = {
        "hour": "past-24h",
        "day": "past-24h",
        "week": "past-week",
        "month": "past-month",
        "year": "past-year",
        "all": "past-year",  # hard cap at a year even when caller says "all"
    }
    date_posted = _DATE_FILTER.get((time_frame or "week").lower(), "past-week")

    input_data = {
        "searchTerms": [query],
        "maxResults": max_results,
        "sortBy": "date_posted",
        # Multiple key names in case the actor's schema differs between versions
        "datePosted": date_posted,
        "dateFilter": date_posted,
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
        author = item.get("author") if isinstance(item.get("author"), dict) else {}
        name = item.get("authorName") or author.get("name") or ""

        # Author DP — different Apify LinkedIn actors name this differently,
        # so check every common variant plus the nested author object.
        profile_pic = (
            item.get("authorAvatar")
            or item.get("authorProfilePicture")
            or item.get("authorProfilePictureUrl")
            or item.get("authorImage")
            or author.get("avatar")
            or author.get("profilePicture")
            or author.get("picture")
            or ""
        )

        # Post images — actors that scrape post bodies return a list under
        # keys like `images`, `media`, `attachments`, or a single
        # `imageUrl`.  Normalise everything to a List[str] of absolute URLs.
        post_images: List[str] = []
        for key in ("images", "media", "attachments", "post_images"):
            value = item.get(key)
            if isinstance(value, list):
                for v in value:
                    if isinstance(v, str) and v.startswith("http"):
                        post_images.append(v)
                    elif isinstance(v, dict):
                        url = v.get("url") or v.get("src") or v.get("href")
                        if url and url.startswith("http"):
                            post_images.append(url)
        for key in ("imageUrl", "image_url", "thumbnail", "image"):
            value = item.get(key)
            if isinstance(value, str) and value.startswith("http"):
                post_images.append(value)
        # Dedup preserving order, cap at 5
        seen: set = set()
        post_images = [u for u in post_images if not (u in seen or seen.add(u))][:5]

        results.append({
            "source": "apify_linkedin",
            "name": name,
            "title": item.get("authorHeadline") or author.get("headline", "") or "",
            "company": item.get("authorCompany") or "",
            "linkedin": item.get("authorProfileUrl") or item.get("authorUrl") or "",
            "post_url": item.get("url") or item.get("postUrl") or "",
            "post_snippet": (item.get("text") or item.get("content") or "")[:500],
            "post_images": post_images,
            "profile_picture_url": profile_pic,
            "email": "",
            "likes": item.get("likesCount", 0) or 0,
            "comments_count": item.get("commentsCount", 0) or 0,
            "raw": item,
        })

    logger.info("Apify LinkedIn search returned %d results", len(results))
    return results
