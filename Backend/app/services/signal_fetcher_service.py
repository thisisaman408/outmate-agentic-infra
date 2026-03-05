"""
Signal Fetcher Service — Python equivalent of Sweedal's signalFetcher.js.
Uses feedparser + httpx for Google News RSS, X mentions, LinkedIn posts, RSS feeds.
"""

import hashlib
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus, urlparse, parse_qs
from uuid import uuid4

import feedparser
import httpx

logger = logging.getLogger(__name__)

GOOGLE_NEWS_RSS = "https://news.google.com/rss/search"
THIRTY_DAYS = timedelta(days=30)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def is_recent(date_string: Optional[str], max_age: timedelta = THIRTY_DAYS) -> bool:
    """Check if a date string is within the allowed age window."""
    if not date_string:
        return True
    try:
        parsed = feedparser._parse_date(date_string)
        if parsed is None:
            return True
        from time import mktime
        dt = datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
        return (datetime.now(timezone.utc) - dt) <= max_age
    except Exception:
        return True


def generate_fingerprint(item: Dict[str, Any]) -> str:
    """MD5 fingerprint of source_url + title + pubDate for dedup."""
    raw = f"{item.get('source_url', '')}{item.get('title', '')}{item.get('pubDate', '')}"
    return hashlib.md5(raw.encode()).hexdigest()


def extract_twitter_url(google_news_url: str) -> Optional[str]:
    """Extract actual Twitter/X URL from a Google News redirect link."""
    try:
        parsed = urlparse(google_news_url)
        qs = parse_qs(parsed.query)
        url = qs.get("url", [None])[0]
        if url and ("twitter.com" in url or "x.com" in url):
            return url
    except Exception:
        pass
    return google_news_url


def _parse_feed_entry(entry: Any) -> Dict[str, Any]:
    """Convert a feedparser entry to our standard result shape."""
    title = getattr(entry, "title", "") or ""
    link = getattr(entry, "link", "") or ""
    published = getattr(entry, "published", "") or getattr(entry, "updated", "") or ""
    summary = getattr(entry, "summary", "") or ""
    source = ""
    if hasattr(entry, "source") and hasattr(entry.source, "title"):
        source = entry.source.title
    elif link:
        try:
            source = urlparse(link).netloc
        except Exception:
            source = ""

    # Strip HTML tags from summary
    snippet = re.sub(r"<[^>]+>", "", summary)[:300]

    return {
        "title": title,
        "link": link,
        "pubDate": published,
        "snippet": snippet,
        "source": source,
    }


async def fetch_google_news(
    query: str, num: int = 100, time_frame: str = "7d"
) -> List[Dict[str, Any]]:
    """Fetch Google News RSS for a query, filter to recent items."""
    encoded = quote_plus(query)
    when_param = time_frame if time_frame else "7d"
    url = f"{GOOGLE_NEWS_RSS}?q={encoded}&hl=en-US&gl=US&ceid=US:en&num={num}&when={when_param}"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        results = []
        for entry in feed.entries:
            item = _parse_feed_entry(entry)
            if is_recent(item["pubDate"]):
                results.append(item)
        return results
    except Exception as e:
        logger.warning("[signal_fetcher] fetch_google_news error for %s: %s", query, e)
        return []


async def fetch_x_mentions(
    handle_or_keyword: str, max_results: int = 20
) -> List[Dict[str, Any]]:
    """Fetch X/Twitter mentions via Google News RSS with site: filters."""
    queries = [
        f"site:twitter.com {handle_or_keyword}",
        f"site:x.com {handle_or_keyword}",
    ]
    results = await fetch_multiple_queries(queries, max_results=max_results, time_frame="7d")
    # Resolve twitter redirect URLs
    for item in results:
        resolved = extract_twitter_url(item.get("link", ""))
        if resolved:
            item["link"] = resolved
    return results[:max_results]


async def fetch_multiple_queries(
    queries: List[str], max_results: int = 50, time_frame: str = "7d"
) -> List[Dict[str, Any]]:
    """Run multiple RSS queries and dedup by fingerprint."""
    all_items: List[Dict[str, Any]] = []
    seen_fps: set = set()
    for q in queries:
        items = await fetch_google_news(q, num=max_results, time_frame=time_frame)
        for item in items:
            fp = generate_fingerprint(item)
            if fp not in seen_fps:
                seen_fps.add(fp)
                all_items.append(item)
    return all_items[:max_results]


async def fetch_professional_posts(
    target: str, max_results: int = 20
) -> List[Dict[str, Any]]:
    """Fetch LinkedIn posts via Google News RSS with site: filter."""
    query = f"site:linkedin.com/posts {target}"
    results = await fetch_google_news(query, num=max_results, time_frame="7d")
    return results[:max_results]


async def fetch_professional_post_interactions(
    target: str,
) -> List[Dict[str, Any]]:
    """Mock professional post interactions (same as Sweedal)."""
    return [
        {
            "title": f"Interaction on post by {target}",
            "link": f"https://linkedin.com/posts/{quote_plus(target)}",
            "pubDate": _now_iso(),
            "snippet": f"New interaction detected on a professional post mentioning {target}",
            "source": "LinkedIn",
        }
    ]


async def fetch_rss_feed(
    url: str, max_results: int = 20
) -> List[Dict[str, Any]]:
    """Parse any RSS/Atom feed URL."""
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        results = []
        for entry in feed.entries[:max_results]:
            results.append(_parse_feed_entry(entry))
        return results
    except Exception as e:
        logger.warning("[signal_fetcher] fetch_rss_feed error for %s: %s", url, e)
        return []


async def fetch_google_search(
    query: str, max_results: int = 20
) -> List[Dict[str, Any]]:
    """Google News with 1d timeframe for fresh search results."""
    results = await fetch_google_news(query, num=max_results, time_frame="1d")
    return results[:max_results]


# ---------- Signal type routing ----------

# Map of signal types -> fetch function key
_TYPE_ROUTES = {
    "x_mentions": "x_mentions",
    "monitor_mentions_from_x": "x_mentions",
    "monitor_x_mentions": "x_mentions",
    "monitor_profiles_on_x_by_topic": "x_mentions",
    "x_profiles": "x_mentions",
    "monitor_professional_posts": "professional_posts",
    "monitor_interactions_with_professional_post": "professional_post_interactions",
    "monitor_rss_feed": "rss_feed",
    "monitor_google_search_results": "google_search",
    "monitor_google_news_rss_feed": "google_search",
    "monitor_stargazers_on_github": "github",
    "monitor_forks_on_github": "github",
    "monitor_issues_on_github": "github",
    "monitor_pull_requests_on_github": "github",
    "monitor_commits_on_github": "github",
    "monitor_for_youtube_videos_or_creators": "youtube",
}

_REALTIME_TYPES = {
    "monitor_snowflake_table_changes",
    "monitor_databricks_table_changes",
    "monitor_bigquery_table_changes",
    "monitor_postgres_table_changes",
    "monitor_mysql_table_changes",
    "monitor_webhook_events",
}


async def _dispatch_fetch(
    signal_type: str, config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Route a signal type to the correct fetch function."""
    target = config.get("target") or config.get("keywords") or ""
    max_results = int(config.get("maxResults", 20))
    time_frame = config.get("timeFrame", "7d")

    # Normalize type: hyphens → underscores
    normalized = signal_type.replace("-", "_")

    route = _TYPE_ROUTES.get(normalized)

    if route == "x_mentions":
        return await fetch_x_mentions(target, max_results=max_results)

    if route == "professional_posts":
        return await fetch_professional_posts(target, max_results=max_results)

    if route == "professional_post_interactions":
        return await fetch_professional_post_interactions(target)

    if route == "rss_feed":
        feed_url = config.get("feedUrl") or config.get("feed_url") or target
        return await fetch_rss_feed(feed_url, max_results=max_results)

    if route == "google_search":
        return await fetch_google_news(target, num=max_results, time_frame=time_frame)

    if route == "github":
        github_query = f"site:github.com {target}"
        return await fetch_google_news(github_query, num=max_results, time_frame=time_frame)

    if route == "youtube":
        youtube_query = f"site:youtube.com {target}"
        return await fetch_google_news(youtube_query, num=max_results, time_frame=time_frame)

    if normalized in _REALTIME_TYPES:
        # Synthetic event (same as Sweedal)
        return [
            {
                "title": f"Realtime event from {normalized}",
                "link": "",
                "pubDate": _now_iso(),
                "snippet": f"Synthetic realtime event for {target}",
                "source": normalized,
            }
        ]

    # Default: Google News with target
    return await fetch_google_news(target, num=max_results, time_frame=time_frame)


async def run_signal(
    signal: Dict[str, Any],
    signal_results_store: Dict[str, List[Dict[str, Any]]],
    signal_store: Optional[List[Dict[str, Any]]] = None,
    no_save: bool = False,
) -> List[Dict[str, Any]]:
    """
    Main dispatch — fetch results for a signal, dedup, optionally persist.
    Returns list of new result dicts.
    """
    signal_id = signal.get("_id", "")
    signal_type = signal.get("type", "")
    config = signal.get("configuration", {})
    cursor_state = signal.get("cursor_state", {})
    last_seen_ts = cursor_state.get("last_seen_timestamp")

    # Fetch raw items
    raw_items = await _dispatch_fetch(signal_type, config)

    # Filter by cursor (last_seen_timestamp)
    if last_seen_ts:
        try:
            cutoff = datetime.fromisoformat(last_seen_ts.replace("Z", "+00:00"))
            filtered = []
            for item in raw_items:
                if is_recent(item.get("pubDate"), max_age=THIRTY_DAYS):
                    filtered.append(item)
            raw_items = filtered
        except Exception:
            pass

    # Build result objects
    now = _now_iso()
    results: List[Dict[str, Any]] = []

    # Get existing fingerprints for dedup
    existing_fps: set = set()
    if not no_save and signal_id:
        for existing in signal_results_store.get(signal_id, []):
            fp = existing.get("fingerprint", "")
            if fp:
                existing_fps.add(fp)

    for item in raw_items:
        fp = generate_fingerprint(item)
        if fp in existing_fps:
            continue

        result = {
            "_id": f"result-{uuid4().hex[:8]}",
            "signal_id": signal_id,
            "title": item.get("title", ""),
            "description": item.get("snippet", ""),
            "source_url": item.get("link", ""),
            "metadata": {"source": item.get("source", ""), "pubDate": item.get("pubDate", "")},
            "found_at": now,
            "fingerprint": fp,
        }
        results.append(result)
        existing_fps.add(fp)

    # Persist if not preview mode
    if not no_save and signal_id:
        if signal_id not in signal_results_store:
            signal_results_store[signal_id] = []
        signal_results_store[signal_id].extend(results)

        # Update cursor state and last_run_at on the signal
        signal["cursor_state"] = {
            "last_seen_timestamp": now,
        }
        signal["last_run_at"] = now

    return results
