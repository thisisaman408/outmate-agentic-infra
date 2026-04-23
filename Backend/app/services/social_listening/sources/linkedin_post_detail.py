"""Apify LinkedIn post-detail source — URL-driven enricher.

The primary LinkedIn discovery source (BrightData Discover) returns post
URLs, author names, and snippets but almost never surfaces post images,
the author's DP, or the full author headline.  Apify's post-detail
actors take a specific post URL and return the fully-rendered post
payload (images, author object, likes, etc.) — we use that to fill the
gaps *after* the search has finished.

Actor ID is configurable via `APIFY_POST_DETAIL_ACTOR` (default
`apimaestro~linkedin-post-detail`) so teams can swap to whichever actor
their Apify account has access to without code changes.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Iterable, List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"
POLL_INTERVAL = 5
MAX_POLL_SECONDS = 180


def is_available() -> bool:
    return bool(
        getattr(settings, "APIFY_API_TOKEN", "")
        or getattr(settings, "APIFY_API_KEY", "")
    )


def _token() -> str:
    return (
        getattr(settings, "APIFY_API_TOKEN", "")
        or getattr(settings, "APIFY_API_KEY", "")
        or ""
    )


def _actor_id() -> str:
    return (
        getattr(settings, "APIFY_POST_DETAIL_ACTOR", "")
        or "apimaestro~linkedin-post-detail"
    )


def _normalize_url(url: str) -> str:
    """Drop query + fragment so dedup works across tracking params."""
    if not url:
        return ""
    base = url.split("?", 1)[0].split("#", 1)[0].rstrip("/")
    return base


async def enrich_post_urls(post_urls: Iterable[str]) -> Dict[str, Dict[str, Any]]:
    """Resolve a batch of LinkedIn post URLs to {normalized_url: enriched_fields}.

    Returned fields (all best-effort, may be empty strings / empty lists):
      - post_images: List[str]
      - profile_picture_url: str
      - title: str               (author headline)
      - name: str                (author display name)
      - linkedin: str            (author profile URL)

    Silent on failure — callers treat an empty dict as "enrichment didn't run"
    and fall back to whatever the search already captured.
    """
    token = _token()
    if not token:
        return {}

    unique_urls = sorted({_normalize_url(u) for u in post_urls if u})
    unique_urls = [u for u in unique_urls if u]
    if not unique_urls:
        return {}

    actor = _actor_id()

    # Different post-detail actors accept the URL list under different keys;
    # pass all common variants so we don't have to bake one vendor's schema
    # into the caller.
    payload: Dict[str, Any] = {
        "urls": unique_urls,
        "postUrls": unique_urls,
        "startUrls": [{"url": u} for u in unique_urls],
        "proxy": {"useApifyProxy": True},
    }

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            start = await client.post(
                f"{APIFY_BASE}/acts/{actor}/runs",
                params={"token": token},
                json=payload,
            )
            if start.status_code >= 400:
                logger.warning(
                    "Apify post-detail start failed actor=%s status=%s body=%s",
                    actor,
                    start.status_code,
                    start.text[:200],
                )
                return {}

            run_id = (start.json().get("data") or {}).get("id")
            if not run_id:
                return {}

            dataset_id = await _poll_run(client, run_id, token)
            if not dataset_id:
                return {}

            items_resp = await client.get(
                f"{APIFY_BASE}/datasets/{dataset_id}/items",
                params={"token": token, "clean": "true"},
            )
            items = items_resp.json() if items_resp.status_code == 200 else []

    except Exception as exc:  # noqa: BLE001 — non-fatal; caller logs aggregate
        logger.warning("Apify post-detail exception: %s", exc)
        return {}

    if not isinstance(items, list):
        return {}

    out: Dict[str, Dict[str, Any]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        url = _normalize_url(
            item.get("url")
            or item.get("postUrl")
            or item.get("link")
            or item.get("permalink")
            or ""
        )
        if not url:
            continue
        out[url] = _normalize_item(item)

    logger.info(
        "Apify post-detail enriched %d/%d URLs via actor=%s",
        len(out),
        len(unique_urls),
        actor,
    )
    return out


async def _poll_run(client: httpx.AsyncClient, run_id: str, token: str) -> str:
    """Block until an actor run finishes, returning its dataset id (or "")."""
    elapsed = 0
    while elapsed < MAX_POLL_SECONDS:
        await asyncio.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
        resp = await client.get(
            f"{APIFY_BASE}/actor-runs/{run_id}",
            params={"token": token},
        )
        if resp.status_code >= 400:
            return ""
        info = (resp.json() or {}).get("data") or {}
        status = info.get("status")
        if status == "SUCCEEDED":
            return info.get("defaultDatasetId") or ""
        if status in {"FAILED", "ABORTED", "TIMED-OUT"}:
            logger.warning("Apify post-detail run ended status=%s run_id=%s", status, run_id)
            return ""
    logger.warning("Apify post-detail run timed out run_id=%s", run_id)
    return ""


# ── Field extractors ────────────────────────────────────────────────────
# Actors return wildly different shapes.  Keep the list of candidate keys
# in one place so new actors can be supported without changing callers.


_AUTHOR_KEYS = ("author", "profile", "user", "creator", "postedBy")

_PROFILE_PIC_KEYS = (
    "authorAvatar",
    "authorProfilePicture",
    "authorProfilePictureUrl",
    "authorImage",
    "authorPictureUrl",
    "profile_picture_url",
    "profilePictureUrl",
    "avatarUrl",
)

_AUTHOR_NESTED_PIC_KEYS = (
    "avatar",
    "profilePicture",
    "profilePictureUrl",
    "picture",
    "image",
    "imageUrl",
    "pictureUrl",
)

_HEADLINE_KEYS = (
    "authorHeadline",
    "authorTitle",
    "authorDescription",
    "headline",
    "subtitle",
    "authorJobTitle",
)

_AUTHOR_NESTED_HEADLINE_KEYS = (
    "headline",
    "title",
    "description",
    "occupation",
    "subtitle",
    "jobTitle",
)

_AUTHOR_NAME_KEYS = ("authorName", "authorFullName")
_AUTHOR_NESTED_NAME_KEYS = ("name", "fullName", "displayName")

_AUTHOR_PROFILE_URL_KEYS = ("authorProfileUrl", "authorUrl", "authorLink")
_AUTHOR_NESTED_URL_KEYS = ("profileUrl", "url", "link", "publicProfileUrl")

_POST_IMAGE_LIST_KEYS = ("images", "media", "attachments", "post_images", "photos", "pictures")
_POST_IMAGE_SINGLE_KEYS = ("imageUrl", "image_url", "thumbnail", "image", "coverImage", "heroImage")


def _first_string(source: Dict[str, Any], keys: Iterable[str]) -> str:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nested = value.get("url") or value.get("src") or value.get("href")
            if isinstance(nested, str) and nested.strip():
                return nested.strip()
    return ""


def _collect_images(item: Dict[str, Any]) -> List[str]:
    urls: List[str] = []
    seen: set = set()

    def _add(value: Any) -> None:
        if value is None:
            return
        if isinstance(value, str):
            v = value.strip()
            if v.startswith(("http://", "https://")) and v not in seen:
                seen.add(v)
                urls.append(v)
        elif isinstance(value, dict):
            _add(value.get("url") or value.get("src") or value.get("href"))
        elif isinstance(value, list):
            for v in value:
                _add(v)

    for key in _POST_IMAGE_SINGLE_KEYS:
        _add(item.get(key))
    for key in _POST_IMAGE_LIST_KEYS:
        _add(item.get(key))

    # Some actors nest media under a `post` or `content` sub-object
    for parent_key in ("post", "content", "data"):
        parent = item.get(parent_key)
        if isinstance(parent, dict):
            for key in _POST_IMAGE_SINGLE_KEYS + _POST_IMAGE_LIST_KEYS:
                _add(parent.get(key))

    # Filter LinkedIn static/UI assets — only content media is useful.
    filtered = [
        u for u in urls
        if "static.licdn.com" not in u
        and "static-exp" not in u
        and "/emoji/" not in u
        and "spinner" not in u.lower()
    ]
    return filtered[:5]


def _normalize_item(item: Dict[str, Any]) -> Dict[str, Any]:
    author = {}
    for key in _AUTHOR_KEYS:
        value = item.get(key)
        if isinstance(value, dict):
            author = value
            break

    profile_pic = _first_string(item, _PROFILE_PIC_KEYS) or _first_string(
        author, _AUTHOR_NESTED_PIC_KEYS
    )
    headline = _first_string(item, _HEADLINE_KEYS) or _first_string(
        author, _AUTHOR_NESTED_HEADLINE_KEYS
    )
    name = _first_string(item, _AUTHOR_NAME_KEYS) or _first_string(
        author, _AUTHOR_NESTED_NAME_KEYS
    )
    profile_url = _first_string(item, _AUTHOR_PROFILE_URL_KEYS) or _first_string(
        author, _AUTHOR_NESTED_URL_KEYS
    )

    return {
        "post_images": _collect_images(item),
        "profile_picture_url": profile_pic,
        "title": headline,
        "name": name,
        "linkedin": profile_url,
    }
