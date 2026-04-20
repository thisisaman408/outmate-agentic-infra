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
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.prospect import Prospect
from app.db.models.signal_event import SignalEvent
from app.db.models.signal_watcher_match import SignalWatcherMatch


def _base_query(db: Session, user_id: UUID, params: Dict[str, Any]):
    """Shared filter — signals scoped to the user, LEFT-joined to prospects.

    History note (2026-04):  Originally this INNER-joined ``prospects`` on
    ``SignalEvent.prospect_id``.  That silently dropped every signal whose
    pipeline hadn't resolved a specific person yet — which is most of them
    for signal types like "funding" or "hiring" that fire at company level.
    For a tenant with 141 matched signals and 0 prospect_ids populated,
    the old query returned zero rows, making Hot Signals campaigns
    impossible to launch.

    Current behaviour: outer-join, so signals without a resolved prospect
    still come through.  Callers fall back to the signal's inline
    ``prospect_name``/``prospect_email``/``prospect_title`` columns and
    flag the row ``needs_enrichment=True`` so the Celery enrichment pass
    tries to find a phone number before dialling.
    """
    min_intent = int(params.get("min_intent", 70))
    days = int(params.get("days", 7))
    signal_types = params.get("signal_types") or []
    since = datetime.now(timezone.utc) - timedelta(days=days)

    q = (
        db.query(SignalEvent, Prospect)
        .join(SignalWatcherMatch, SignalWatcherMatch.signal_id == SignalEvent.id)
        .outerjoin(Prospect, Prospect.id == SignalEvent.prospect_id)
        .filter(SignalWatcherMatch.user_id == user_id)
        .filter(SignalEvent.is_archived == False)  # noqa: E712
        .filter(SignalEvent.discovered_at >= since)
        .filter(SignalEvent.icp_score.isnot(None))
        .filter(SignalEvent.icp_score >= min_intent)
    )
    if signal_types:
        q = q.filter(SignalEvent.signal_type.in_(signal_types))
    return q.order_by(SignalEvent.icp_score.desc(), SignalEvent.discovered_at.desc())


def _dedup_key(signal: SignalEvent, prospect: Optional[Prospect]) -> Optional[str]:
    """Stable identity for de-duplication across multiple signals.

    Preference order — use the most specific identifier we have:
      1. Prospect.id               (best — real identity)
      2. prospect_email            (very likely unique per person)
      3. (prospect_name, company)  (weak but better than losing rows)
    Returns None for rows with zero identifying info — caller should skip.
    """
    if prospect is not None:
        return f"pid:{prospect.id}"
    email = (signal.prospect_email or "").strip().lower()
    if email:
        return f"email:{email}"
    name = (signal.prospect_name or "").strip().lower()
    company = (signal.company_name or signal.company_domain or "").strip().lower()
    if name and company:
        return f"namecompany:{name}|{company}"
    if name:
        return f"name:{name}"
    return None


def _compose_prospect_dict(signal: SignalEvent, prospect: Optional[Prospect]) -> Dict[str, Any]:
    """Assemble the TriggerCallRequest-shaped dict, preferring Prospect
    fields and falling back to the signal's inline columns."""
    if prospect is not None:
        phone = (prospect.phone or "").strip()
        name = (
            prospect.full_name
            or f"{prospect.first_name or ''} {prospect.last_name or ''}".strip()
            or signal.prospect_name
            or "Unknown"
        )
        role = prospect.job_title or signal.prospect_title or ""
        city = prospect.city or ""
    else:
        phone = ""  # phantom prospect — no phone on file, enrichment must find one
        name = signal.prospect_name or "Unknown"
        role = signal.prospect_title or ""
        city = ""

    return {
        "prospect_name": name,
        "prospect_phone": phone,
        "prospect_company": signal.company_name or "",
        "prospect_role": role,
        "prospect_city": city,
        "prospect_industry": "",
        "context": _describe_signal(signal),
        "needs_enrichment": not phone,
        "signal_event_id": str(signal.id),
    }


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

    With the outer-join in `_base_query`, rows where ``prospect`` is None
    are "phantom prospects" — the signal fired but hasn't been resolved to
    a specific person yet.  We return them (if opted-in) with empty phone
    and needs_enrichment=True so the Celery pass tries to find a number.
    """
    max_prospects = int(params.get("max_prospects", 200))

    rows = _base_query(db, user_id, params).limit(max_prospects).all()

    seen_keys: set = set()
    prospects: List[Dict[str, Any]] = []
    for signal, prospect in rows:
        key = _dedup_key(signal, prospect)
        if not key or key in seen_keys:
            continue

        record = _compose_prospect_dict(signal, prospect)

        # If the user opted out of enrichment, only include rows we can
        # dial right now (real phone on a real Prospect row).
        if not include_without_phone and record["needs_enrichment"]:
            continue

        seen_keys.add(key)
        prospects.append(record)
    return prospects


def count_hot_signals_breakdown(
    db: Session, user_id: UUID, params: Dict[str, Any]
) -> Dict[str, int]:
    """Return counts used by the campaign wizard's preview step so the user
    sees cost + callability BEFORE committing credits.

    Returned keys:
        - total_matching: every signal passing the filters (de-duped)
        - callable_now:   subset with a phone already on file
        - enrichable:     subset with no phone, but enrichable via BetterContact/CrustData
                          (includes phantom prospects — signals with no prospect_id yet)
    """
    rows = _base_query(db, user_id, params).limit(int(params.get("max_prospects", 200))).all()

    seen_keys: set = set()
    total = 0
    callable_now = 0
    enrichable = 0
    for signal, prospect in rows:
        key = _dedup_key(signal, prospect)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        total += 1
        phone = (prospect.phone or "").strip() if prospect is not None else ""
        if phone:
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
