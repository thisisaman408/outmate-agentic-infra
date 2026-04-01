from __future__ import annotations

import asyncio
import logging
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, cast, Integer, text

from app.api.deps.auth import get_current_user
from app.core.redis import RedisManager
from app.db.deps import get_db
from app.db.session import SessionLocal
from app.db.models.company import Company
from app.db.models.prospect import Prospect
from app.db.models.visitor import Visit, SiteConfig
from app.db.models.watcher import Watcher
from app.services.campaign_dashboard_service import CampaignDashboardService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dashboard"])

# Thread pool for blocking DB work inside async endpoints
_executor = ThreadPoolExecutor(max_workers=4)
_dashboard_service = CampaignDashboardService()


def _now() -> datetime:
    return datetime.utcnow()


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def _relative_time(dt: Optional[datetime]) -> str:
    if not dt:
        return "unknown"
    now = _now()
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    delta = now - dt
    if delta.days >= 1:
        return f"{delta.days}d ago"
    hours = delta.seconds // 3600
    if hours >= 1:
        return f"{hours}h ago"
    minutes = delta.seconds // 60
    if minutes >= 1:
        return f"{minutes}m ago"
    return "just now"


def _percent_change(current: float, previous: float) -> float:
    if previous <= 0:
        return 0.0
    return round(((current - previous) / previous) * 100, 1)


def _watcher_counts(watchers: List[Watcher]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for watcher in watchers:
        key_candidates = [
            watcher.account_domain,
            watcher.account_name,
            watcher.lead_company,
        ]
        for key in key_candidates:
            if not key:
                continue
            normalized = key.strip().lower()
            counts[normalized] = counts.get(normalized, 0) + 1
    return counts


def _signals_confidence(watcher: Watcher) -> int:
    raw = watcher.match_count
    if raw:
        try:
            value = int(raw)
            return max(50, min(95, 60 + value * 5))
        except Exception:
            pass
    return 70


@router.get("/dashboard/kpis")
async def dashboard_kpis(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> Dict[str, Any]:
    total_companies = db.query(Company).filter(Company.user_id == _user.id).count()
    total_prospects = db.query(Prospect).filter(Prospect.user_id == _user.id).count()
    total_leads = total_companies + total_prospects

    active_signals = db.query(Watcher).filter(Watcher.user_id == _user.id, Watcher.status == "active").count()

    campaigns = await _dashboard_service.list_campaigns()
    running_campaigns = len([c for c in campaigns if c.get("status") == "running"])

    reply_rates = [c.get("stats", {}).get("replyRate", 0) for c in campaigns]
    conversion_rate = round(sum(reply_rates) / max(len(reply_rates), 1), 1)

    now = _now()
    recent_start = now - timedelta(days=7)
    prev_start = now - timedelta(days=14)

    recent_leads = (
        db.query(Company).filter(Company.user_id == _user.id, Company.created_at >= recent_start).count()
        + db.query(Prospect).filter(Prospect.user_id == _user.id, Prospect.created_at >= recent_start).count()
    )
    prev_leads = (
        db.query(Company)
        .filter(Company.user_id == _user.id, Company.created_at >= prev_start, Company.created_at < recent_start)
        .count()
        + db.query(Prospect)
        .filter(Prospect.user_id == _user.id, Prospect.created_at >= prev_start, Prospect.created_at < recent_start)
        .count()
    )

    recent_signals = db.query(Watcher).filter(Watcher.user_id == _user.id, Watcher.created_at >= recent_start).count()
    prev_signals = db.query(Watcher).filter(Watcher.user_id == _user.id, Watcher.created_at >= prev_start, Watcher.created_at < recent_start).count()

    recent_campaigns = len(
        [c for c in campaigns if (_parse_dt(c.get("createdAt")) or now) >= recent_start]
    )
    prev_campaigns = len(
        [c for c in campaigns if prev_start <= (_parse_dt(c.get("createdAt")) or now) < recent_start]
    )

    return {
        "totalLeads": total_leads,
        "activeSignals": active_signals,
        "runningCampaigns": running_campaigns,
        "conversionRate": conversion_rate,
        "changePercentage": {
            "totalLeads": _percent_change(recent_leads, prev_leads),
            "activeSignals": _percent_change(recent_signals, prev_signals),
            "runningCampaigns": _percent_change(recent_campaigns, prev_campaigns),
            "conversionRate": 0.0,
        },
    }


@router.get("/dashboard/recent-leads")
async def dashboard_recent_leads(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    companies = (
        db.query(Company)
        .filter(Company.user_id == _user.id)
        .order_by(Company.created_at.desc())
        .limit(limit * 2)
        .all()
    )
    prospects = (
        db.query(Prospect, Company)
        .filter(Prospect.user_id == _user.id)
        .outerjoin(Company, Prospect.company_id == Company.id)
        .order_by(Prospect.created_at.desc())
        .limit(limit * 2)
        .all()
    )

    watchers = db.query(Watcher).limit(200).all()
    watcher_counts = _watcher_counts(watchers)

    merged: List[Dict[str, Any]] = []

    for company in companies:
        key_name = (company.name or "").strip().lower()
        key_domain = (company.domain or "").strip().lower()
        signals_count = max(
            watcher_counts.get(key_name, 0),
            watcher_counts.get(key_domain, 0),
        )
        merged.append(
            {
                "id": str(company.id),
                "companyName": company.name or company.domain or "Unknown",
                "contactName": "Team",
                "title": "Company",
                "industry": company.industry or "Unknown",
                "signalsCount": signals_count,
                "addedAt": _relative_time(company.created_at),
                "_created": company.created_at or datetime.min,
            }
        )

    for prospect, company in prospects:
        company_name = None
        if company and company.name:
            company_name = company.name
        elif prospect.raw_data:
            company_name = prospect.raw_data.get("company")
        company_name = company_name or "Unknown"
        key_company = company_name.strip().lower()
        signals_count = watcher_counts.get(key_company, 0)
        full_name = prospect.full_name or " ".join(
            part for part in [prospect.first_name, prospect.last_name] if part
        ).strip()
        merged.append(
            {
                "id": str(prospect.id),
                "companyName": company_name,
                "contactName": full_name or "Unknown",
                "title": prospect.job_title or "Prospect",
                "industry": company.industry if company else "Unknown",
                "signalsCount": signals_count,
                "addedAt": _relative_time(prospect.created_at),
                "_created": prospect.created_at or datetime.min,
            }
        )

    merged.sort(key=lambda item: item.get("_created") or datetime.min, reverse=True)
    trimmed = merged[:limit]
    for item in trimmed:
        item.pop("_created", None)
    return trimmed


@router.get("/dashboard/active-signals")
async def dashboard_active_signals(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    watchers = (
        db.query(Watcher)
        .filter(Watcher.user_id == _user.id, Watcher.status == "active")
        .order_by(Watcher.updated_at.desc())
        .limit(limit)
        .all()
    )
    results: List[Dict[str, Any]] = []
    for watcher in watchers:
        company_name = watcher.account_name or watcher.account_domain or watcher.lead_company or watcher.name
        description = watcher.description
        if not description and watcher.triggers:
            try:
                description = watcher.triggers[0]
            except Exception:
                description = None
        results.append(
            {
                "id": watcher.id,
                "companyName": company_name or "Unknown",
                "type": watcher.type or "signal",
                "confidence": _signals_confidence(watcher),
                "description": description or "Signal active",
                "timestamp": _relative_time(watcher.updated_at or watcher.created_at),
            }
        )
    return results


@router.get("/dashboard/campaign-performance")
async def dashboard_campaign_performance(
    limit: int = Query(3, ge=1, le=10),
    _user=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    campaigns = await _dashboard_service.list_campaigns()
    results: List[Dict[str, Any]] = []
    for campaign in campaigns[:limit]:
        stats = campaign.get("stats", {})
        sent = stats.get("sent", 0)
        opened = stats.get("opened", 0)
        replied = stats.get("replied", 0)
        open_rate = stats.get("openRate") or (round((opened / sent) * 100, 1) if sent else 0)
        reply_rate = stats.get("replyRate") or (round((replied / sent) * 100, 1) if sent else 0)
        results.append(
            {
                "id": campaign.get("id"),
                "name": campaign.get("name", "Campaign"),
                "status": campaign.get("status", "draft"),
                "sent": sent,
                "opened": opened,
                "replied": replied,
                "openRate": open_rate,
                "replyRate": reply_rate,
            }
        )
    return results


@router.get("/dashboard/ai-activity")
async def dashboard_ai_activity(
    limit: int = Query(3, ge=1, le=10),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    activities: List[Dict[str, Any]] = []
    now = _now()

    recent_company = db.query(Company).filter(Company.user_id == _user.id).order_by(Company.created_at.desc()).first()
    if recent_company:
        activities.append(
            {
                "id": f"company-{recent_company.id}",
                "agentType": "Enrichment Agent",
                "action": f"Enriched {recent_company.name or recent_company.domain}",
                "result": "Lead added to database",
                "timestamp": _relative_time(recent_company.created_at),
            }
        )

    recent_prospect = db.query(Prospect).filter(Prospect.user_id == _user.id).order_by(Prospect.created_at.desc()).first()
    if recent_prospect:
        activities.append(
            {
                "id": f"prospect-{recent_prospect.id}",
                "agentType": "Prospect Agent",
                "action": f"Captured {recent_prospect.full_name or 'new prospect'}",
                "result": "Prospect enriched",
                "timestamp": _relative_time(recent_prospect.created_at),
            }
        )

    watcher = db.query(Watcher).filter(Watcher.user_id == _user.id).order_by(Watcher.updated_at.desc()).first()
    if watcher:
        activities.append(
            {
                "id": f"signal-{watcher.id}",
                "agentType": "Signal Agent",
                "action": f"Signal active for {watcher.account_name or watcher.name}",
                "result": watcher.description or "Monitoring signal",
                "timestamp": _relative_time(watcher.updated_at or watcher.created_at),
            }
        )

    campaigns = await _dashboard_service.list_campaigns()
    if campaigns:
        campaign = campaigns[0]
        activities.append(
            {
                "id": f"campaign-{campaign.get('id')}",
                "agentType": "Campaign Agent",
                "action": f"Campaign {campaign.get('name')} updated",
                "result": f"Status: {campaign.get('status', 'draft')}",
                "timestamp": _relative_time(_parse_dt(campaign.get("updatedAt")) or now),
            }
        )

    return activities[:limit]


@router.get("/dashboard/time-series")
async def dashboard_time_series(
    days: int = Query(7, ge=3, le=30),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> List[Dict[str, Any]]:
    end_date = _now().date()
    start_date = end_date - timedelta(days=days - 1)
    start_dt = datetime.combine(start_date, datetime.min.time())

    date_range = [start_date + timedelta(days=i) for i in range(days)]
    lead_counts = {date: 0 for date in date_range}
    signal_counts = {date: 0 for date in date_range}
    campaign_counts = {date: 0 for date in date_range}

    companies = db.query(Company.created_at).filter(Company.created_at >= start_dt).all()
    prospects = db.query(Prospect.created_at).filter(Prospect.created_at >= start_dt).all()
    watchers = db.query(Watcher.created_at).filter(Watcher.created_at >= start_dt).all()

    for (created_at,) in companies + prospects:
        if created_at:
            lead_counts[created_at.date()] = lead_counts.get(created_at.date(), 0) + 1

    for (created_at,) in watchers:
        if created_at:
            signal_counts[created_at.date()] = signal_counts.get(created_at.date(), 0) + 1

    campaigns = await _dashboard_service.list_campaigns()
    for campaign in campaigns:
        created_at = _parse_dt(campaign.get("createdAt"))
        if created_at and created_at.date() in campaign_counts:
            campaign_counts[created_at.date()] += 1

    series: List[Dict[str, Any]] = []
    for d in date_range:
        series.append(
            {
                "date": d.strftime("%b %d"),
                "leads": lead_counts.get(d, 0),
                "signals": signal_counts.get(d, 0),
                "campaigns": campaign_counts.get(d, 0),
            }
        )
    return series


# ═══════════════════════════════════════════════════════════════════════════════
# VISITOR INTELLIGENCE — dashboard-level visitor metrics
# ═══════════════════════════════════════════════════════════════════════════════

# Redis key for real-time active visitor counter.
# Format: outmate:visitors:active:{org_id}  → Redis sorted set keyed by IP,
# scored by last-seen unix timestamp.  Entries older than 30 min are pruned on
# every read so the ZCARD always reflects "active right now".
_ACTIVE_VISITORS_KEY = "outmate:visitors:active:{org_id}"
_ACTIVE_WINDOW_SECONDS = 30 * 60  # 30 minutes


async def _run_db(fn):
    """Run a blocking DB callable on the thread-pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, fn)


@router.get("/dashboard/visitor-intelligence")
async def dashboard_visitor_intelligence(
    days: int = Query(7, ge=1, le=90, description="Lookback window: 7, 30, or 90"),
    _user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Dashboard visitor intelligence metrics.

    Returns:
      - realtime_visitors: count of active visitors right now (30-min window)
      - icp_traffic_ratio: % of visitors with ICP score >= 70
      - company_id_rate: % of visitors identified to a company
      - person_id_rate: % of company-identified visitors matched to a person
      - top_pages_by_icp: top 10 pages sorted by ICP visitor count
      - traffic_trend: daily visitor counts for the requested period

    Performance: Uses pre-aggregation in a single DB pass (no raw-event scan per
    metric).  P99 target < 3 s for 90-day queries.
    """
    org_id = _user.id
    days = max(1, min(int(days), 90))

    # ── 1. Real-time active visitors (Redis sorted set) ──────────────────────
    realtime_count = 0
    try:
        redis = RedisManager.get_client()
        if redis:
            key = _ACTIVE_VISITORS_KEY.format(org_id=org_id)
            cutoff = datetime.utcnow().timestamp() - _ACTIVE_WINDOW_SECONDS
            # Prune stale entries
            await redis.zremrangebyscore(key, "-inf", cutoff)
            realtime_count = await redis.zcard(key)
    except Exception as e:
        logger.debug(f"Redis realtime count unavailable: {e}")

    # ── 2. Aggregated metrics from DB (single pass) ──────────────────────────
    since = datetime.utcnow() - timedelta(days=days)

    def _query():
        db = SessionLocal()
        try:
            rows = (
                db.query(
                    Visit.created_at,
                    Visit.url,
                    Visit.matched,
                    Visit.resolution,
                )
                .filter(Visit.org_id == org_id, Visit.created_at >= since)
                .order_by(Visit.created_at.desc())
                .limit(100_000)
                .all()
            )

            total = 0
            icp_fit = 0          # ICP score >= 70
            company_matched = 0  # category == "company" or "prospect"
            person_matched = 0   # category == "prospect"

            # Daily rollups
            daily: Dict[str, Dict[str, int]] = defaultdict(
                lambda: {"total": 0, "matched": 0, "icp_fit": 0}
            )

            # Page → ICP visitor count
            page_icp_counts: Counter = Counter()

            for created_at, url, matched, resolution in rows:
                if not created_at:
                    continue

                total += 1
                res = resolution or {}
                cat = (res.get("category") or "unknown").lower()
                icp_score = 0

                # Extract ICP score (stored in resolution.icp_score)
                try:
                    icp_score = int(res.get("icp_score") or 0)
                except (TypeError, ValueError):
                    icp_score = 0

                is_icp = icp_score >= 70
                if is_icp:
                    icp_fit += 1

                if cat in ("company", "prospect"):
                    company_matched += 1
                if cat == "prospect":
                    person_matched += 1

                # Daily rollup
                day_key = created_at.strftime("%Y-%m-%d")
                daily[day_key]["total"] += 1
                if matched:
                    daily[day_key]["matched"] += 1
                if is_icp:
                    daily[day_key]["icp_fit"] += 1

                # Page ICP count
                if is_icp and url:
                    try:
                        page = urlparse(url).path or "/"
                    except Exception:
                        page = url
                    page_icp_counts[page] += 1

            # Build traffic trend (fill gaps with zeros)
            trend = []
            for i in range(days):
                d = (datetime.utcnow() - timedelta(days=days - 1 - i)).date()
                dk = d.strftime("%Y-%m-%d")
                bucket = daily.get(dk, {"total": 0, "matched": 0, "icp_fit": 0})
                trend.append({
                    "date": d.strftime("%b %d"),
                    "date_raw": dk,
                    "visitors": bucket["total"],
                    "matched": bucket["matched"],
                    "icp_fit": bucket["icp_fit"],
                })

            # Top 10 pages by ICP traffic
            top_pages = [
                {"page": page, "icp_visitors": count}
                for page, count in page_icp_counts.most_common(10)
            ]

            return {
                "total": total,
                "icp_fit": icp_fit,
                "company_matched": company_matched,
                "person_matched": person_matched,
                "trend": trend,
                "top_pages": top_pages,
            }
        finally:
            db.close()

    data = await _run_db(_query)

    total = data["total"]
    icp_fit = data["icp_fit"]
    company_matched = data["company_matched"]
    person_matched = data["person_matched"]

    return {
        "realtime_visitors": realtime_count,
        "icp_traffic_ratio": round(icp_fit / total * 100, 1) if total else 0,
        "company_id_rate": round(company_matched / total * 100, 1) if total else 0,
        "person_id_rate": round(person_matched / company_matched * 100, 1) if company_matched else 0,
        "total_visitors": total,
        "icp_fit_count": icp_fit,
        "company_matched_count": company_matched,
        "person_matched_count": person_matched,
        "top_pages_by_icp": data["top_pages"],
        "traffic_trend": data["trend"],
        "period_days": days,
    }


@router.post("/dashboard/visitor-heartbeat")
async def visitor_heartbeat(
    _user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Called by the frontend every 15 s to get the latest real-time visitor count.
    Lightweight — Redis only, no DB hit.
    """
    org_id = _user.id
    realtime_count = 0
    try:
        redis = RedisManager.get_client()
        if redis:
            key = _ACTIVE_VISITORS_KEY.format(org_id=org_id)
            cutoff = datetime.utcnow().timestamp() - _ACTIVE_WINDOW_SECONDS
            await redis.zremrangebyscore(key, "-inf", cutoff)
            realtime_count = await redis.zcard(key)
    except Exception as e:
        logger.debug(f"Redis heartbeat unavailable: {e}")

    return {"realtime_visitors": realtime_count}


# ═══════════════════════════════════════════════════════════════════════════════
# SEQUENCE ANALYTICS — outreach performance per sequence / channel / A-B test
# ═══════════════════════════════════════════════════════════════════════════════

import math

# Platform-wide benchmark averages (updated periodically from aggregate data)
_PLATFORM_BENCHMARKS = {
    "open_rate": 48.2,
    "reply_rate": 4.8,
    "meeting_booked_rate": 1.2,
    "bounce_rate": 2.5,
}

# Minimum sends per variant before declaring A/B test winner
_AB_MIN_SENDS = 200


def _z_test_two_proportions(p1: float, n1: int, p2: float, n2: int) -> float:
    """
    Two-proportion z-test.  Returns the z-score.
    |z| > 1.96 → 95 % confidence the difference is real.
    """
    if n1 == 0 or n2 == 0:
        return 0.0
    p_pool = (p1 * n1 + p2 * n2) / (n1 + n2)
    if p_pool <= 0 or p_pool >= 1:
        return 0.0
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
    if se == 0:
        return 0.0
    return (p1 - p2) / se


def _safe_rate(numerator: int, denominator: int) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0


@router.get("/dashboard/sequence-analytics")
async def dashboard_sequence_analytics(
    days: int = Query(7, ge=1, le=90),
    _user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Sequence-level outreach analytics.

    Returns:
      - sequences: per-sequence open / reply / meeting-booked rates
      - channel_breakdown: email vs LinkedIn vs Voice AI attribution
      - ab_tests: A/B comparisons with statistical significance
      - trend: daily performance over time
      - benchmarks: comparison vs platform averages
      - data_freshness: timestamp of most recent data sync

    Notes:
      - Open-rate data from mail providers may have 24-48 hr delay.
      - Apple Mail Privacy Protection inflates open rates — a warning is included.
      - A/B test winner requires ≥ 200 sends per variant (statistical significance).
    """
    campaigns = await _dashboard_service.list_campaigns()
    sequences = await _dashboard_service.list_sequences()

    now = _now()
    cutoff = now - timedelta(days=days)

    # ── 1. Per-sequence metrics ──────────────────────────────────────────────
    sequence_rows: List[Dict[str, Any]] = []
    # Aggregate channel totals
    channel_totals: Dict[str, Dict[str, int]] = {
        "email": {"sent": 0, "opened": 0, "replied": 0, "meetings": 0},
        "linkedin": {"sent": 0, "opened": 0, "replied": 0, "meetings": 0},
        "voice_ai": {"sent": 0, "opened": 0, "replied": 0, "meetings": 0},
    }
    # Daily trend buckets
    daily_trend: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"sent": 0, "opened": 0, "replied": 0, "meetings": 0}
    )
    # Collect A/B variant pairs
    ab_pairs: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    all_items = []
    for c in campaigns:
        created = _parse_dt(c.get("createdAt"))
        if created and created < cutoff:
            continue
        all_items.append(c)
    for s in sequences:
        created = _parse_dt(s.get("createdAt"))
        if created and created < cutoff:
            continue
        all_items.append(s)

    for item in all_items:
        stats = item.get("stats", {})
        sent = int(stats.get("sent", 0))
        opened = int(stats.get("opened", 0))
        replied = int(stats.get("replied", 0))
        bounced = int(stats.get("bounced", 0))
        meetings = int(stats.get("meetingsBooked", 0) or stats.get("meetings", 0) or 0)

        open_rate = _safe_rate(opened, sent)
        reply_rate = _safe_rate(replied, sent)
        meeting_rate = _safe_rate(meetings, sent)
        bounce_rate = _safe_rate(bounced, sent)

        # Channel attribution (from item metadata or default to email)
        channel = (item.get("channel") or "email").lower()
        if channel not in channel_totals:
            channel = "email"

        channel_totals[channel]["sent"] += sent
        channel_totals[channel]["opened"] += opened
        channel_totals[channel]["replied"] += replied
        channel_totals[channel]["meetings"] += meetings

        # Daily trend (bucket by createdAt date)
        created = _parse_dt(item.get("createdAt") or item.get("updatedAt"))
        if created:
            dk = created.strftime("%Y-%m-%d")
            daily_trend[dk]["sent"] += sent
            daily_trend[dk]["opened"] += opened
            daily_trend[dk]["replied"] += replied
            daily_trend[dk]["meetings"] += meetings

        # Track A/B test variants
        ab_group = item.get("ab_test_group") or item.get("abTestGroup")
        variant_label = item.get("variant") or item.get("ab_variant")
        subject = item.get("subject") or item.get("message", "")[:80]
        if ab_group:
            ab_pairs[ab_group].append({
                "variant": variant_label or item.get("name", "Variant"),
                "subject": subject,
                "sent": sent,
                "opened": opened,
                "replied": replied,
                "open_rate": open_rate,
                "reply_rate": reply_rate,
            })

        sequence_rows.append({
            "id": item.get("id"),
            "name": item.get("name", "Untitled"),
            "status": item.get("status", "draft"),
            "channel": channel,
            "sent": sent,
            "opened": opened,
            "replied": replied,
            "bounced": bounced,
            "meetings_booked": meetings,
            "open_rate": open_rate,
            "reply_rate": reply_rate,
            "meeting_booked_rate": meeting_rate,
            "bounce_rate": bounce_rate,
        })

    # Sort by sent descending
    sequence_rows.sort(key=lambda r: r["sent"], reverse=True)

    # ── 2. Channel breakdown ────────────────────────────────────────────────
    channel_breakdown = []
    for ch, totals in channel_totals.items():
        s = totals["sent"]
        channel_breakdown.append({
            "channel": ch,
            "sent": s,
            "opened": totals["opened"],
            "replied": totals["replied"],
            "meetings": totals["meetings"],
            "open_rate": _safe_rate(totals["opened"], s),
            "reply_rate": _safe_rate(totals["replied"], s),
            "meeting_rate": _safe_rate(totals["meetings"], s),
        })

    # ── 3. A/B test results with significance ───────────────────────────────
    ab_tests: List[Dict[str, Any]] = []
    for group_name, variants in ab_pairs.items():
        if len(variants) < 2:
            continue
        # Sort by reply_rate descending
        variants.sort(key=lambda v: v["reply_rate"], reverse=True)
        a = variants[0]
        b = variants[1]

        enough_data = a["sent"] >= _AB_MIN_SENDS and b["sent"] >= _AB_MIN_SENDS

        z_open = _z_test_two_proportions(
            a["open_rate"] / 100, a["sent"], b["open_rate"] / 100, b["sent"]
        ) if enough_data else 0.0
        z_reply = _z_test_two_proportions(
            a["reply_rate"] / 100, a["sent"], b["reply_rate"] / 100, b["sent"]
        ) if enough_data else 0.0

        significant_open = abs(z_open) >= 1.96
        significant_reply = abs(z_reply) >= 1.96

        if enough_data and (significant_reply or significant_open):
            winner = a["variant"]
            confidence = min(99.9, round(50 + abs(z_reply) * 20, 1))
            status = "winner_declared"
        elif not enough_data:
            winner = None
            confidence = 0
            status = "insufficient_data"
        else:
            winner = None
            confidence = round(50 + abs(z_reply) * 20, 1)
            status = "no_significant_difference"

        ab_tests.append({
            "group": group_name,
            "status": status,
            "winner": winner,
            "confidence": confidence,
            "min_sends_required": _AB_MIN_SENDS,
            "variants": [
                {
                    "label": v["variant"],
                    "subject": v["subject"],
                    "sent": v["sent"],
                    "open_rate": v["open_rate"],
                    "reply_rate": v["reply_rate"],
                }
                for v in variants[:4]  # max 4 variants
            ],
        })

    # ── 4. Trend lines (daily) ──────────────────────────────────────────────
    trend = []
    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).date()
        dk = d.strftime("%Y-%m-%d")
        bucket = daily_trend.get(dk, {"sent": 0, "opened": 0, "replied": 0, "meetings": 0})
        trend.append({
            "date": d.strftime("%b %d"),
            "date_raw": dk,
            "sent": bucket["sent"],
            "opened": bucket["opened"],
            "replied": bucket["replied"],
            "meetings": bucket["meetings"],
        })

    # ── 5. Benchmark comparison ─────────────────────────────────────────────
    total_sent = sum(r["sent"] for r in sequence_rows)
    total_opened = sum(r["opened"] for r in sequence_rows)
    total_replied = sum(r["replied"] for r in sequence_rows)
    total_meetings = sum(r["meetings_booked"] for r in sequence_rows)

    user_open = _safe_rate(total_opened, total_sent)
    user_reply = _safe_rate(total_replied, total_sent)
    user_meeting = _safe_rate(total_meetings, total_sent)

    def _benchmark_delta(user_val: float, bench_val: float) -> Dict[str, Any]:
        diff = round(user_val - bench_val, 1)
        return {
            "your_rate": user_val,
            "platform_avg": bench_val,
            "difference": diff,
            "status": "above" if diff > 0.5 else ("below" if diff < -0.5 else "at_average"),
        }

    benchmarks = {
        "open_rate": _benchmark_delta(user_open, _PLATFORM_BENCHMARKS["open_rate"]),
        "reply_rate": _benchmark_delta(user_reply, _PLATFORM_BENCHMARKS["reply_rate"]),
        "meeting_booked_rate": _benchmark_delta(user_meeting, _PLATFORM_BENCHMARKS["meeting_booked_rate"]),
    }

    # ── 6. Data freshness ───────────────────────────────────────────────────
    latest_update = None
    for item in all_items:
        updated = _parse_dt(item.get("updatedAt") or item.get("createdAt"))
        if updated and (latest_update is None or updated > latest_update):
            latest_update = updated

    return {
        "sequences": sequence_rows,
        "channel_breakdown": channel_breakdown,
        "ab_tests": ab_tests,
        "trend": trend,
        "benchmarks": benchmarks,
        "period_days": days,
        "total_sequences": len(sequence_rows),
        "data_freshness": {
            "last_sync": latest_update.isoformat() if latest_update else None,
            "note": "Open-rate data from mail providers may be delayed 24-48 hours.",
        },
        "warnings": [
            "Open rates may be inflated due to Apple Mail Privacy Protection (MPP)."
        ],
    }
