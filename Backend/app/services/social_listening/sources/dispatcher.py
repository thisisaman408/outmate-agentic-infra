"""Source dispatcher — routes search to correct source(s), merges results.

CrustData is ALWAYS used as the primary source. Apify/BrightData enhance
when configured. If optional sources fail or aren't configured, we still
return CrustData results. Nothing breaks.
"""

from __future__ import annotations
import logging
from typing import Any, Dict, List, Optional
from app.services.social_listening.sources import linkedin_crustdata
from app.services.social_listening.sources import linkedin_apify
from app.services.social_listening.sources import twitter_apify
from app.services.social_listening.sources import job_changes_crustdata
from app.services.social_listening.sources import brightdata_discover

logger = logging.getLogger(__name__)

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

    # 3. Apify — optional enhancement if still short
    remaining = max_results - len(all_results)
    if remaining > 0 and linkedin_apify.is_available():
        try:
            apify_results = await linkedin_apify.search_linkedin_posts(
                keywords=keywords,
                max_results=remaining,
                time_frame=time_frame,
            )
            all_results = _merge_and_dedupe(all_results, apify_results)
        except Exception as exc:
            logger.warning("Apify LinkedIn enhancement failed (non-fatal): %s", exc)

    return all_results[:max_results]


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
