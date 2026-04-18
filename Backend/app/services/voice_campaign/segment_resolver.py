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


def _base_query(db: Session, user_id: UUID, params: Dict[str, Any]):
    """Shared filter — signals joined to prospects, scoped to the user."""
    min_intent = int(params.get("min_intent", 70))
    days = int(params.get("days", 7))
    signal_types = params.get("signal_types") or []
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
    )
    if signal_types:
        q = q.filter(SignalEvent.signal_type.in_(signal_types))
    return q.order_by(SignalEvent.icp_score.desc(), SignalEvent.discovered_at.desc())


def resolve_hot_signals(
    db: Session,
    user_id: UUID,
    params: Dict[str, Any],
    include_without_phone: bool = False,
) -> List[Dict[str, Any]]:
    """Return a list of prospect dicts ready for `TriggerCallRequest`.

    By default only returns prospects that *already* have a phone (safe to
    call right now).  When ``include_without_phone`` is True, also returns
    prospects without phones — each marked with ``needs_enrichment: True``
    and carrying their ``signal_event_id`` so the Celery enrichment pass
    can look up the signal's LinkedIn URL and try to populate a phone.

    The user opts into this wider net via the campaign wizard's "enrich
    first" toggle.  No enrichment happens inside this function — it just
    decides which rows make it into the campaign.
    """
    max_prospects = int(params.get("max_prospects", 200))

    q = _base_query(db, user_id, params)
    if not include_without_phone:
        q = q.filter(Prospect.phone.isnot(None)).filter(Prospect.phone != "")
    rows = q.limit(max_prospects).all()

    # Dedup by prospect_id (one prospect, one call, however many signals).
    seen_prospect_ids: set = set()
    prospects: List[Dict[str, Any]] = []
    for signal, prospect in rows:
        if prospect.id in seen_prospect_ids:
            continue
        seen_prospect_ids.add(prospect.id)

        phone = (prospect.phone or "").strip()
        needs_enrichment = not phone
        name = prospect.full_name or f"{prospect.first_name or ''} {prospect.last_name or ''}".strip() or "Unknown"

        prospects.append({
            "prospect_name": name,
            "prospect_phone": phone,
            "prospect_company": signal.company_name or "",
            "prospect_role": prospect.job_title or signal.prospect_title or "",
            "prospect_city": prospect.city or "",
            "prospect_industry": "",
            "context": _describe_signal(signal),
            "needs_enrichment": needs_enrichment,
            "signal_event_id": str(signal.id),
        })
    return prospects


def count_hot_signals_breakdown(
    db: Session, user_id: UUID, params: Dict[str, Any]
) -> Dict[str, int]:
    """Return counts used by the campaign wizard's preview step so the user
    sees cost + callability BEFORE committing credits.

    Returned keys:
        - total_matching: every signal passing the filters (de-duped by prospect)
        - callable_now:   subset whose prospect already has a phone
        - enrichable:     subset whose prospect is missing a phone
    """
    q = _base_query(db, user_id, params)
    rows = q.limit(int(params.get("max_prospects", 200))).all()

    seen_prospect_ids: set = set()
    total = 0
    callable_now = 0
    enrichable = 0
    for signal, prospect in rows:
        if prospect.id in seen_prospect_ids:
            continue
        seen_prospect_ids.add(prospect.id)
        total += 1
        if (prospect.phone or "").strip():
            callable_now += 1
        else:
            enrichable += 1
    return {
        "total_matching": total,
        "callable_now": callable_now,
        "enrichable": enrichable,
    }


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
