"""Hot Signals segment resolver.

Query `signal_events` joined with `signal_watcher_matches` (tenant
isolation) and `prospects` (phone number) to produce the list of callable
prospects for a "hot_signals" campaign.

Params schema (`source_params`):
    {
      "min_intent": 70,              # icp_score >= this
      "days": 7,                     # discovered_at within last N days
      "signal_types": ["funding", "hiring", "job_change"],  # optional
      "max_prospects": 200,          # hard cap
    }
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.prospect import Prospect
from app.db.models.signal_event import SignalEvent
from app.db.models.signal_watcher_match import SignalWatcherMatch


def resolve_hot_signals(
    db: Session, user_id: UUID, params: Dict[str, Any]
) -> List[Dict[str, str]]:
    """Return a list of prospect dicts ready for `TriggerCallRequest`.

    Joins signal_events → signal_watcher_matches (to enforce user scope) →
    prospects (to pull a callable phone number).  Signals without a
    matched prospect that has a phone are filtered out.
    """
    min_intent = int(params.get("min_intent", 70))
    days = int(params.get("days", 7))
    signal_types = params.get("signal_types") or []
    max_prospects = int(params.get("max_prospects", 200))

    since = datetime.now(timezone.utc) - timedelta(days=days)

    q = (
        db.query(SignalEvent, Prospect)
        .join(SignalWatcherMatch, SignalWatcherMatch.signal_id == SignalEvent.id)
        .join(Prospect, Prospect.id == SignalEvent.prospect_id)
        .filter(SignalWatcherMatch.user_id == user_id)
        .filter(SignalEvent.is_archived == False)  # noqa: E712
        .filter(SignalEvent.discovered_at >= since)
        .filter(SignalEvent.icp_score.isnot(None))
        .filter(SignalEvent.icp_score >= min_intent)
        .filter(Prospect.phone.isnot(None))
        .filter(Prospect.phone != "")
    )

    if signal_types:
        q = q.filter(SignalEvent.signal_type.in_(signal_types))

    q = q.order_by(SignalEvent.icp_score.desc(), SignalEvent.discovered_at.desc()).limit(max_prospects)

    rows = q.all()

    # Dedup by phone — one prospect, one call, regardless of how many signals.
    seen_phones: set[str] = set()
    prospects: List[Dict[str, str]] = []
    for signal, prospect in rows:
        if not prospect.phone or prospect.phone in seen_phones:
            continue
        seen_phones.add(prospect.phone)

        name = prospect.full_name or f"{prospect.first_name or ''} {prospect.last_name or ''}".strip() or "Unknown"
        signal_blurb = _describe_signal(signal)
        prospects.append({
            "prospect_name": name,
            "prospect_phone": prospect.phone,
            "prospect_company": signal.company_name or "",
            "prospect_role": prospect.job_title or signal.prospect_title or "",
            "prospect_city": prospect.city or "",
            "prospect_industry": "",
            "context": signal_blurb,
        })

    return prospects


def _describe_signal(signal: SignalEvent) -> str:
    """One-sentence context line fed into the Retell `lead_context` variable."""
    st = (signal.signal_type or "").lower()
    co = signal.company_name or "their company"
    if st == "funding":
        return f"{co} recently raised funding — time-sensitive discovery call."
    if st == "hiring":
        return f"{co} is actively hiring GTM roles — scaling outbound team."
    if st == "job_change":
        return f"{signal.prospect_name or 'Prospect'} recently changed roles at {co}."
    if st == "g2_intent":
        return f"{co} showed buying intent in a competitive review context."
    if st == "website_visit":
        return f"{co} visited the Outmate website recently."
    return f"Fresh signal detected for {co} ({st or 'general'})."
