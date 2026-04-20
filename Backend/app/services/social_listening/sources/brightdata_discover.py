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

    # Freshness filter — BrightData Discover accepts Google-style date
    # qualifiers ("d", "w", "m", "y").  We map our internal names.  Without
    # this, results have been returning months-old LinkedIn posts because
    # Google ranks by relevance, not recency.
    _DATE_RANGE = {
        "hour": "d",   # BrightData doesn't have sub-day granularity; go day
        "day": "d",
        "week": "w",
        "month": "m",
        "year": "y",
        "all": "y",    # cap at a year even when caller says "all"
    }
    date_range = _DATE_RANGE.get((time_frame or "week").lower(), "w")

    payload: Dict[str, Any] = {
        "query": query,
        "intent": intent,
        "remove_duplicates": True,
        "include_content": True,
        "num_results": min(max_results, 20),  # BrightData max is 20
        # Apply the freshness filter at the search layer so we don't waste
        # credits on ancient posts.  Keys intentionally duplicated — the
        # BrightData API has shipped both `date_range` and `freshness` as
        # the accepted filter name across versions; extra keys are ignored.
        "date_range": date_range,
        "freshness": date_range,
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

        # ── Name resolution ───────────────────────────────────────────
        # Try multiple extractors.  BrightData's output shape varies by
        # post type (posts/pulse/activity), and the person's name can
        # appear in the title, inside the content blob between pipes, or
        # only recoverable from the post URL's `/posts/<username>-…` slug.
        person_name = (
            _extract_person_from_title(title)
            or _extract_person_from_content(content)
            or _humanize_username(link)
        )

        # ── Profile URL ───────────────────────────────────────────────
        linkedin_profile = _extract_profile_from_post_url(link)

        # ── Company (best-effort) ─────────────────────────────────────
        company = _extract_company_from_content(content)

        # ── Media — post images + author's profile picture ────────────
        # BrightData returns these under several possible keys depending
        # on the post type; collect all of them so the UI can render a
        # thumbnail + avatar without an extra scrape.
        post_images = _extract_post_images(item)
        profile_pic = _extract_profile_picture(item)

        # Clean content — remove LinkedIn boilerplate
        clean_content = _clean_linkedin_content(content)

        results.append({
            "source": "brightdata_discover",
            "name": person_name,
            "title": "",  # BrightData doesn't return person's job title
            "company": company,
            "linkedin": linkedin_profile,
            "post_url": link,
            "post_snippet": clean_content[:500] if clean_content else "",
            "post_images": post_images,           # list of image URLs from the post
            "profile_picture_url": profile_pic,   # author's DP if BrightData gave us one
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
        # Cookie / footer / legal chunks that appear in discovered snippets
        r",?\s*you agree to\s*\*?\s*\[About\].*$",
        r"\*\s*\[(About|Accessibility|User Agreement|Privacy Policy|Cookie Policy|Copyright Policy|Brand Policy|Guest Controls|Community Guidelines)\][^*]*",
    ]
    for p in patterns:
        content = re.sub(p, "", content, flags=re.DOTALL | re.IGNORECASE)
    return content.strip()[:2000]


# ────────────────────────────────────────────────────────────────────────
# Parsing helpers — name, company, images, DP
#
# BrightData Discover doesn't return structured author/post-media fields,
# and the shape of its `content` blob varies per post type.  The helpers
# below try several patterns from most-specific to most-forgiving so the
# UI can stop showing "Unknown" on every card.
# ────────────────────────────────────────────────────────────────────────

# "| Dirk Sahlmer | 17 comments", "| Neil Griffin, you agree to …",
# "| Jane Doe · 3h", "| John Smith posted…"  →  extracts the name token
_CONTENT_NAME_RE = re.compile(
    r"\|\s*"                                      # pipe separator
    r"([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,3})"   # 2-4 capitalised words
    r"\s*(?:\||,|·|\s+posted|\s+\d+\s+(?:comments?|reactions?|likes?))",
    re.UNICODE,
)

# Rough "Name at/@ Company" patterns.  Weak by design — we'd rather miss
# a company than mis-attribute one.  Returns empty string on ambiguity.
_CONTENT_COMPANY_RES = [
    re.compile(r"(?:works?|working|founder|ceo|cto|vp|head)\s+(?:at|@|of)\s+([A-Z][\w&\. -]{2,40})", re.IGNORECASE),
    re.compile(r"\b@\s*([A-Z][\w&\. -]{2,40})(?:\s|$|\|)"),
]


def _extract_person_from_content(content: str) -> str:
    """Pull the author's name out of the LinkedIn post content blob.

    Handles the format visible in prod screenshots, e.g.
      '#saas #startups #vc | Dirk Sahlmer | 17 comments , you agree …'
      'Technation Scale Up Playbook | Neil Griffin , you agree to …'
    """
    if not content:
        return ""
    match = _CONTENT_NAME_RE.search(content)
    if not match:
        return ""
    name = re.sub(r"[^\w\s\'-]", "", match.group(1)).strip()
    return name if 1 < len(name) < 60 else ""


def _extract_company_from_content(content: str) -> str:
    """Best-effort company extraction from a post body."""
    if not content:
        return ""
    for pattern in _CONTENT_COMPANY_RES:
        m = pattern.search(content)
        if m:
            candidate = m.group(1).strip().rstrip(".,;:|")
            # Filter generic words that aren't companies
            if candidate.lower() in {"linkedin", "google", "home", "the", "a"}:
                continue
            if 2 < len(candidate) < 50:
                return candidate
    return ""


def _humanize_username(post_url: str) -> str:
    """Fallback: turn a LinkedIn post-url slug into a plausible display name.

    'linkedin.com/posts/dirk-sahlmer_activity-…'  →  'Dirk Sahlmer'
    Used only when title + content parsers both came up empty; marks the
    card as something-instead-of-Unknown even for low-signal scrapes.
    """
    match = re.search(r"linkedin\.com/posts/([a-zA-Z0-9_-]+)", post_url or "")
    if not match:
        return ""
    slug = match.group(1).split("_", 1)[0]   # drop activity suffix
    if not slug or len(slug) > 80:
        return ""
    # Strip trailing numeric IDs like '-1a2b3c' LinkedIn sometimes appends
    slug = re.sub(r"-[a-f0-9]{4,}$", "", slug)
    parts = [p for p in re.split(r"[-\.]+", slug) if p]
    if not parts:
        return ""
    humanized = " ".join(p.capitalize() for p in parts if not p.isdigit())
    return humanized if 1 < len(humanized) < 80 else ""


# BrightData has shipped post-media under at least four different keys
# depending on account + product version.  We collect from all of them
# and dedupe.
_IMAGE_FIELDS = ("images", "image_urls", "media", "thumbnails", "photos")
_SINGLE_IMAGE_FIELDS = ("image", "image_url", "thumbnail", "og_image")


def _extract_post_images(item: Dict[str, Any]) -> List[str]:
    """Return an ordered, deduped list of post image URLs from a result."""
    urls: List[str] = []
    seen: set = set()

    def _add(value: Any) -> None:
        if not value:
            return
        if isinstance(value, str):
            if value.startswith(("http://", "https://")) and value not in seen:
                seen.add(value)
                urls.append(value)
        elif isinstance(value, dict):
            _add(value.get("url") or value.get("src") or value.get("href"))
        elif isinstance(value, list):
            for v in value:
                _add(v)

    for key in _SINGLE_IMAGE_FIELDS:
        _add(item.get(key))
    for key in _IMAGE_FIELDS:
        _add(item.get(key))

    # Sometimes BrightData nests media inside a `raw` sub-object
    raw = item.get("raw") or item.get("metadata") or {}
    if isinstance(raw, dict):
        for key in _SINGLE_IMAGE_FIELDS + _IMAGE_FIELDS:
            _add(raw.get(key))

    # Filter out LinkedIn's static/UI assets — we only want content media
    return [
        u for u in urls
        if "static.licdn.com" not in u
        and "static-exp" not in u
        and "/emoji/" not in u
    ][:5]  # cap to 5 — the frontend only renders a small carousel


def _extract_profile_picture(item: Dict[str, Any]) -> str:
    """Return the post author's LinkedIn profile picture URL, if present."""
    for key in ("profile_picture", "profile_pic_url", "author_image", "author_picture", "avatar", "author_avatar"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith(("http://", "https://")):
            return value
        if isinstance(value, dict):
            url = value.get("url") or value.get("src")
            if url:
                return url

    # Nested under author/profile objects
    for parent_key in ("author", "profile", "user"):
        parent = item.get(parent_key)
        if isinstance(parent, dict):
            for inner_key in ("picture", "profile_picture", "image", "avatar"):
                v = parent.get(inner_key)
                if isinstance(v, str) and v.startswith(("http://", "https://")):
                    return v
                if isinstance(v, dict):
                    url = v.get("url") or v.get("src")
                    if url:
                        return url
    return ""
