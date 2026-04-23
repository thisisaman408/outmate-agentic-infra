"""Source dispatcher — routes search to correct source(s), merges results.

CrustData is ALWAYS used as the primary source. Apify/BrightData enhance
when configured. If optional sources fail or aren't configured, we still
return CrustData results. Nothing breaks.
"""

from __future__ import annotations
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from app.services.social_listening.sources import linkedin_crustdata
from app.services.social_listening.sources import linkedin_apify
from app.services.social_listening.sources import linkedin_post_detail
from app.services.social_listening.sources import twitter_apify
from app.services.social_listening.sources import job_changes_crustdata
from app.services.social_listening.sources import brightdata_discover

logger = logging.getLogger(__name__)


# ── Freshness enforcement ──────────────────────────────────────────────
# Defensive client-side filter applied AFTER the source-level filters.
# BrightData has been observed to ignore `date_range` on some queries,
# and Apify actors can return posts older than `datePosted` when
# LinkedIn's own search is loose.  We drop anything older than the
# caller's window so the UI never shows year-old posts under a
# "past-week" watcher.

_TIME_FRAME_TO_SECONDS: Dict[str, int] = {
    "hour":  60 * 60,
    "day":   60 * 60 * 24,
    "week":  60 * 60 * 24 * 7,
    "month": 60 * 60 * 24 * 30,
    "year":  60 * 60 * 24 * 365,
    "all":   60 * 60 * 24 * 365,  # hard-cap "all" at 1y
}

# Human-written "posted 3 weeks ago" / "2mo" / "5h" date hints LinkedIn
# sprinkles into scraped content.  Used when a result has no explicit
# `posted_at` / `date` field.
_RELATIVE_DATE_RE = re.compile(
    r"\b(\d{1,3})\s*(s|second|sec|m|min|minute|h|hr|hour|d|day|w|wk|week|mo|month|y|yr|year)s?\s*(?:ago)?\b",
    re.IGNORECASE,
)
_UNIT_TO_SECONDS = {
    "s": 1, "second": 1, "sec": 1,
    "m": 60, "min": 60, "minute": 60,
    "h": 3600, "hr": 3600, "hour": 3600,
    "d": 86400, "day": 86400,
    "w": 604800, "wk": 604800, "week": 604800,
    "mo": 2592000, "month": 2592000,
    "y": 31536000, "yr": 31536000, "year": 31536000,
}


def _parse_age_seconds(item: Dict[str, Any]) -> Optional[int]:
    """Return the post's age in seconds if we can figure it out, else None.

    Tries (in order): explicit ISO/epoch fields → LinkedIn relative
    phrases inside the content blob.  Returning None means "don't know" —
    the caller treats that as pass-through rather than drop, since we'd
    rather show a possibly-stale post than silently hide a real one.
    """
    now = datetime.now(timezone.utc)

    for key in ("posted_at", "published_at", "date", "post_date", "created_at"):
        value = item.get(key)
        if not value:
            continue
        try:
            if isinstance(value, (int, float)):
                ts = float(value)
                if ts > 1e12:  # milliseconds
                    ts /= 1000.0
                return max(0, int((now.timestamp() - ts)))
            if isinstance(value, str):
                cleaned = value.replace("Z", "+00:00")
                dt = datetime.fromisoformat(cleaned)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return max(0, int((now - dt).total_seconds()))
        except (ValueError, TypeError):
            continue

    # Fallback: scrape "posted 3d ago" / "2 weeks ago" from the content.
    blob = " ".join(
        str(item.get(k) or "") for k in ("content", "description", "snippet", "title")
    )
    match = _RELATIVE_DATE_RE.search(blob)
    if match:
        qty, unit = match.group(1), match.group(2).lower()
        seconds = int(qty) * _UNIT_TO_SECONDS.get(unit, 0)
        if seconds:
            return seconds

    return None


def _filter_by_freshness(
    results: List[Dict[str, Any]], time_frame: str
) -> List[Dict[str, Any]]:
    """Drop results older than the requested window.  Pass-through when
    we can't determine the age (better to show a maybe-old post than to
    hide a legitimate one on a parse miss)."""
    cutoff = _TIME_FRAME_TO_SECONDS.get((time_frame or "week").lower())
    if not cutoff:
        return results
    kept: List[Dict[str, Any]] = []
    dropped = 0
    for item in results:
        age = _parse_age_seconds(item)
        if age is None or age <= cutoff:
            kept.append(item)
        else:
            dropped += 1
    if dropped:
        logger.info("freshness filter dropped %d/%d results older than %s",
                    dropped, len(results), time_frame)
    return kept

# Source name -> handler mapping
SOURCE_HANDLERS = {
    "linkedin_posts": "linkedin",
    "linkedin_activity": "linkedin",
    "linkedin_comments": "linkedin",
    "twitter_posts": "twitter",
    "x_posts": "twitter",
    "job_changes": "job_changes",
}


async def dispatch_search(
    source: str,
    keywords: List[str],
    boolean_query: Optional[Dict[str, List[str]]] = None,
    filters: Optional[Dict[str, Any]] = None,
    max_results: int = 10,
    time_frame: str = "week",
) -> List[Dict[str, Any]]:
    """Run the search against the appropriate source(s).

    Returns merged, deduplicated list of normalized signal dicts.
    """
    handler = SOURCE_HANDLERS.get(source, "linkedin")

    if handler == "twitter":
        return await _search_twitter(keywords, max_results, time_frame)

    if handler == "job_changes":
        return await _search_job_changes(keywords, filters, max_results, time_frame)

    # Default: LinkedIn
    return await _search_linkedin(keywords, boolean_query, filters, max_results, time_frame)


async def _search_linkedin(
    keywords: List[str],
    boolean_query: Optional[Dict[str, List[str]]],
    filters: Optional[Dict[str, Any]],
    max_results: int,
    time_frame: str,
) -> List[Dict[str, Any]]:
    """LinkedIn search: BrightData Discover (primary, cheap) → CrustData (fallback only).

    BrightData Discover is the primary source — it's intent-aware and cheaper
    than CrustData. CrustData is ONLY used as a fallback when BrightData
    returns fewer results than requested or is unavailable.
    Apify enhances if both above are short.

    Cost priority: BrightData (~$0.01/result) > CrustData (~$0.05/result) > Apify
    """
    all_results: List[Dict[str, Any]] = []

    # 1. BrightData Discover — PRIMARY source (cheap, intent-aware)
    if brightdata_discover.is_available():
        try:
            bd_results = await brightdata_discover.search_linkedin_posts(
                keywords=keywords,
                boolean_query=boolean_query,
                max_results=max_results,
                time_frame=time_frame,
            )
            all_results.extend(bd_results)
            logger.info("BrightData Discover returned %d results", len(bd_results))
        except Exception as exc:
            logger.warning("BrightData Discover failed (non-fatal): %s", exc)

    # 2. CrustData — FALLBACK only when BrightData returned nothing
    if not all_results:
        try:
            crustdata_results = await linkedin_crustdata.search_linkedin_posts(
                keywords=keywords,
                boolean_query=boolean_query,
                filters=filters,
                max_results=max_results,
                time_frame=time_frame,
            )
            all_results.extend(crustdata_results)
            logger.info("CrustData fallback returned %d results", len(crustdata_results))
        except Exception as exc:
            logger.warning("CrustData fallback failed: %s", exc)

    # 3. Apify — always run alongside BrightData (NOT a fallback).
    #
    # Historical behaviour was "only call Apify if BrightData came up
    # short", but BrightData almost always returns the full quota — so
    # Apify effectively never ran even when configured.  That meant zero
    # post images or author DPs in the UI, since BrightData Discover is
    # a search API that doesn't return media.
    #
    # Now: always run Apify too, then merge.  On URL collisions Apify's
    # row wins (richer data incl. images + profile_picture_url).  Apify
    # costs roughly $0.30-1.00 per 1k posts on typical LinkedIn actors,
    # which is worth it for the UX improvement.
    if linkedin_apify.is_available():
        try:
            apify_results = await linkedin_apify.search_linkedin_posts(
                keywords=keywords,
                max_results=max_results,
                time_frame=time_frame,
            )
            # Apify is the richer source — put it first so _merge_and_dedupe
            # keeps its version when the same post URL appears in both.
            all_results = _merge_and_dedupe(apify_results, all_results)
        except Exception as exc:
            logger.warning("Apify LinkedIn enhancement failed (non-fatal): %s", exc)

    # Defensive client-side freshness filter — catches stale posts that
    # slip past the source-level date filters.  See _filter_by_freshness.
    all_results = _filter_by_freshness(all_results, time_frame)

    # Trim to the caller's quota BEFORE the post-detail enrichment pass so we
    # don't waste an actor run on rows we're about to drop.
    all_results = all_results[:max_results]

    # ── Post-detail enrichment ─────────────────────────────────────────
    # BrightData Discover returns URLs + snippets but rarely images, author
    # DP, or the full headline — and Apify's search actor only surfaces
    # those for posts it found itself (URL-collisions during merge).  Any
    # BrightData-only row lands in the feed with the gradient fallback
    # avatar + the generic "LinkedIn Post" placeholder tile.
    #
    # Fix: take every URL still missing media/headline and run Apify's
    # post-detail actor on exactly those URLs.  That's the only way to
    # render the real post thumbnail + author's DP on a BrightData row.
    await _enrich_missing_post_details(all_results)

    return all_results


async def _search_twitter(
    keywords: List[str],
    max_results: int,
    time_frame: str,
) -> List[Dict[str, Any]]:
    """Twitter/X search via Apify."""
    if not twitter_apify.is_available():
        logger.info("Twitter source requested but APIFY_API_TOKEN not set — returning empty")
        return []

    return await twitter_apify.search_tweets(
        keywords=keywords,
        max_results=max_results,
        time_frame=time_frame,
    )


async def _search_job_changes(
    keywords: List[str],
    filters: Optional[Dict[str, Any]],
    max_results: int,
    time_frame: str,
) -> List[Dict[str, Any]]:
    """Job change search via CrustData."""
    return await job_changes_crustdata.search_job_changes(
        keywords=keywords,
        filters=filters,
        max_results=max_results,
        time_frame=time_frame,
    )


_GENERIC_TITLES = {
    "",
    "founder",
    "ceo",
    "co-founder",
    "cofounder",
    "founder & ceo",
    "founder and ceo",
    "founder, ceo",
    "ceo & founder",
    "ceo and founder",
    "owner",
    "director",
    "entrepreneur",
    "self-employed",
}


def _needs_post_detail(result: Dict[str, Any]) -> bool:
    """A row needs the post-detail pass when any of the things we render
    on the card (post imagery, author DP, a real headline) is missing or
    generic.  Cheap boolean check — called once per result."""
    if not (result.get("post_url") or "").strip():
        return False
    if not result.get("post_images"):
        return True
    if not (result.get("profile_picture_url") or "").strip():
        return True
    title = (result.get("title") or "").strip().lower().rstrip(".,;|")
    if title in _GENERIC_TITLES:
        return True
    # Very short headlines ("CEO", "PM", "VP") are almost always Apify's
    # author-headline field truncated to the role keyword — worth retrying
    # via the post-detail actor which usually returns the full headline.
    if len(title) < 10:
        return True
    return False


async def _enrich_missing_post_details(results: List[Dict[str, Any]]) -> None:
    """In-place enrichment: fill missing images/DP/headline on any row that
    has a post URL but came back from search without the full media payload.

    Silent on failure — a timeout or actor error should never drop search
    results.  Worst case we render the gradient+placeholder UI that was
    already shipping before this pass existed.
    """
    if not results or not linkedin_post_detail.is_available():
        return

    urls_to_enrich = [
        (r.get("post_url") or "").strip()
        for r in results
        if _needs_post_detail(r)
    ]
    urls_to_enrich = [u for u in urls_to_enrich if u]
    if not urls_to_enrich:
        return

    try:
        enrichment_map = await linkedin_post_detail.enrich_post_urls(urls_to_enrich)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Post-detail enrichment failed (non-fatal): %s", exc)
        return
    if not enrichment_map:
        return

    updated = 0
    for row in results:
        url = linkedin_post_detail._normalize_url(row.get("post_url") or "")
        data = enrichment_map.get(url)
        if not data:
            continue

        # Images: only write when the search pass didn't capture any — never
        # clobber an existing list with a potentially-smaller one.
        if data.get("post_images") and not row.get("post_images"):
            row["post_images"] = data["post_images"]

        # Author DP: same rule — only fill, never replace.
        if data.get("profile_picture_url") and not row.get(
            "profile_picture_url"
        ):
            row["profile_picture_url"] = data["profile_picture_url"]

        # Headline: replace the existing value when the enriched one is
        # meaningfully richer.  LinkedIn headlines like "Founder & CEO"
        # (standalone) get upgraded to the full "Founder & CEO at Acme |
        # Building X..." string.
        existing_title = (row.get("title") or "").strip()
        new_title = (data.get("title") or "").strip()
        if new_title and (
            not existing_title
            or existing_title.lower().rstrip(".,;|") in _GENERIC_TITLES
            or len(new_title) > len(existing_title) + 10
        ):
            row["title"] = new_title

        # Author identity: fill only when missing.  We don't want a richer
        # profile link overwriting a link the search pass already validated.
        if not (row.get("name") or "").strip() and data.get("name"):
            row["name"] = data["name"]
        if not (row.get("linkedin") or "").strip() and data.get("linkedin"):
            row["linkedin"] = data["linkedin"]

        updated += 1

    if updated:
        logger.info(
            "Post-detail enrichment filled %d/%d rows",
            updated,
            len(urls_to_enrich),
        )


def _merge_and_dedupe(
    primary: List[Dict[str, Any]],
    secondary: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge two result lists, deduplicating by post_url or (name + company)."""
    seen = set()
    for item in primary:
        key = item.get("post_url") or f"{item.get('name','')}|{item.get('company','')}"
        if key:
            seen.add(key.lower())

    merged = list(primary)
    for item in secondary:
        key = item.get("post_url") or f"{item.get('name','')}|{item.get('company','')}"
        if key and key.lower() not in seen:
            seen.add(key.lower())
            merged.append(item)

    return merged
