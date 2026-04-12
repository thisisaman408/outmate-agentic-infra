"""BrightData Discover API source — intent-aware web + LinkedIn search.

Uses BrightData's Discover API which understands search INTENT, not just
keywords. When searching for "AI agents for GTM", it finds people who are
actually building, struggling with, or evaluating AI GTM tools — not
random posts that happen to mention "AI".

The API is async (returns task_id, poll for results), so we poll with
exponential backoff up to 60 seconds.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

BRIGHTDATA_DISCOVER_URL = "https://api.brightdata.com/discover"
MAX_POLL_SECONDS = 60
POLL_INTERVAL = 3


def is_available() -> bool:
    """Check if BrightData Discover API is configured."""
    return bool(getattr(settings, "BRIGHTDATA_API_TOKEN", "") or getattr(settings, "BRIGHTDATA_DISCOVER_KEY", ""))


def _get_key() -> str:
    return (
        getattr(settings, "BRIGHTDATA_DISCOVER_KEY", "")
        or getattr(settings, "BRIGHTDATA_API_TOKEN", "")
        or ""
    )


async def search_linkedin_posts(
    keywords: List[str],
    boolean_query: Optional[Dict[str, List[str]]] = None,
    intent: str = "",
    max_results: int = 10,
    time_frame: str = "week",
) -> List[Dict[str, Any]]:
    """Search LinkedIn posts via BrightData Discover with intent understanding.

    Returns normalized signal dicts ready for ingestion.
    """
    key = _get_key()
    if not key:
        return []

    # Build the query — site:linkedin.com/posts + keywords
    keyword_part = " ".join(keywords)
    query = f"site:linkedin.com/posts {keyword_part}"

    # Build intent from boolean query context
    if not intent:
        must = (boolean_query or {}).get("must", keywords)
        intent = (
            f"LinkedIn posts from people actively discussing, building, "
            f"evaluating, or facing challenges with {', '.join(must)}. "
            f"Looking for posts where someone shares their experience, "
            f"asks for recommendations, announces a new role, or discusses "
            f"pain points that could be addressed with a relevant solution."
        )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}",
    }

    payload: Dict[str, Any] = {
        "query": query,
        "intent": intent,
        "remove_duplicates": True,
        "include_content": True,
        "num_results": min(max_results, 20),  # BrightData max is 20
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(BRIGHTDATA_DISCOVER_URL, headers=headers, json=payload)
            if resp.status_code >= 400:
                logger.warning("BrightData Discover start failed: %s %s", resp.status_code, resp.text[:200])
                return []
            data = resp.json()
            task_id = data.get("task_id")
            if not task_id:
                return []

        # Poll for results
        results_data = await _poll_results(task_id, key)
        if not results_data:
            return []

    except Exception as exc:
        logger.warning("BrightData Discover error: %s", exc)
        return []

    # Normalize results into signal dicts
    results: List[Dict[str, Any]] = []
    for item in results_data:
        link = item.get("link", "")
        # Only process LinkedIn post URLs
        if "linkedin.com/posts/" not in link and "linkedin.com/pulse/" not in link:
            continue

        title = item.get("title", "")
        content = item.get("content", "") or item.get("description", "")
        relevance = item.get("relevance_score", 0)

        # Extract person name from title (format: "Post Title | Person Name posted on...")
        person_name = _extract_person_from_title(title)
        # Extract LinkedIn profile URL from post URL
        linkedin_profile = _extract_profile_from_post_url(link)

        # Clean content — remove LinkedIn boilerplate
        clean_content = _clean_linkedin_content(content)

        results.append({
            "source": "brightdata_discover",
            "name": person_name,
            "title": "",  # BrightData doesn't return person's job title
            "company": "",
            "linkedin": linkedin_profile,
            "post_url": link,
            "post_snippet": clean_content[:500] if clean_content else "",
            "email": "",
            "email_unverified": False,
            "likes": 0,
            "comments_count": 0,
            "best_hook": "",
            "message": "",
            "relevance_score": relevance,
            "raw": item,
        })

    logger.info("BrightData Discover returned %d LinkedIn posts", len(results))
    return results


async def _poll_results(task_id: str, key: str) -> Optional[List[Dict[str, Any]]]:
    """Poll for task completion with exponential backoff."""
    elapsed = 0
    interval = POLL_INTERVAL

    async with httpx.AsyncClient(timeout=15) as client:
        while elapsed < MAX_POLL_SECONDS:
            await asyncio.sleep(interval)
            elapsed += interval

            resp = await client.get(
                f"{BRIGHTDATA_DISCOVER_URL}?task_id={task_id}",
                headers={"Authorization": f"Bearer {key}"},
            )
            if resp.status_code >= 400:
                logger.warning("BrightData Discover poll failed: %s", resp.status_code)
                return None

            data = resp.json()
            status = data.get("status")

            if status == "done":
                return data.get("results", [])
            if status in ("failed", "error"):
                logger.warning("BrightData Discover task failed: %s", data)
                return None
            # Still processing — continue polling
            interval = min(interval * 1.5, 10)

    logger.warning("BrightData Discover task %s timed out after %ds", task_id, MAX_POLL_SECONDS)
    return None


def _extract_person_from_title(title: str) -> str:
    """Extract person name from LinkedIn post title.

    Format: "Post content summary | Person Name posted on the topic"
    """
    if "|" in title:
        after_pipe = title.split("|")[-1].strip()
        name = re.sub(r"\s+posted on.*$", "", after_pipe).strip()
        # Remove emojis and special characters
        name = re.sub(r"[^\w\s\'-]", "", name).strip()
        if name and len(name) < 60:
            return name
    return ""


def _extract_profile_from_post_url(post_url: str) -> str:
    """Extract LinkedIn profile URL from a post URL.

    Post URL: https://www.linkedin.com/posts/username_something-activity-123
    Profile URL: https://www.linkedin.com/in/username
    """
    match = re.search(r"linkedin\.com/posts/([a-zA-Z0-9_-]+)", post_url)
    if match:
        username = match.group(1).split("_")[0]  # Remove the post slug suffix
        return f"https://www.linkedin.com/in/{username}"
    return ""


def _clean_linkedin_content(content: str) -> str:
    """Remove LinkedIn boilerplate from scraped content."""
    if not content:
        return ""
    # Remove common LinkedIn boilerplate
    patterns = [
        r"Agree & Join LinkedIn.*?sign in",
        r"By clicking Continue to join.*?applicable\.",
        r"LinkedIn.*?© \d{4}",
        r"Skip to main content",
        r"LinkedIn and 3rd parties.*?Cookie Policy\.",
    ]
    for p in patterns:
        content = re.sub(p, "", content, flags=re.DOTALL | re.IGNORECASE)
    return content.strip()[:2000]
