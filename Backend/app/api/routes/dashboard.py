from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.company import Company
from app.db.models.prospect import Prospect
from app.db.models.watcher import Watcher
from app.services.campaign_dashboard_service import CampaignDashboardService

router = APIRouter(tags=["dashboard"])
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
    for date in date_range:
        series.append(
            {
                "date": date.strftime("%b %d"),
                "leads": lead_counts.get(date, 0),
                "signals": signal_counts.get(date, 0),
                "campaigns": campaign_counts.get(date, 0),
            }
        )
    return series
