"""Social Listening API — saved searches, signal feed, KPI stats, per-signal actions.

URL surface (all under /api/v1/social):
    GET    /searches                           list user's saved searches
    POST   /searches                           create a saved search
    PATCH  /searches/{id}                      update / pause / resume
    DELETE /searches/{id}                      delete (cascades to matches)
    POST   /searches/{id}/run-now              fire the agent for one search now

    GET    /signals                            paged feed (filter, sort)
    GET    /signals/{id}                       single signal detail
    POST   /signals/{id}/enrich                async enrichment (debits credits)
    POST   /signals/{id}/outreach              generate AI outreach draft
    POST   /signals/{id}/crm-push              push to HubSpot (v1)

    GET    /stats                              KPI cards (totals + day-over-day deltas)

Tenant isolation: every read joins through `signal_watcher_matches.user_id`,
which is denormalised onto each row at ingest time.  No row touched here
can belong to another user; the filters are hard-coded.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.services.hubspot_service import HubSpotService

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.signal_event import SignalEvent
from app.db.models.signal_watcher_match import SignalWatcherMatch
from app.db.models.user import User
from app.db.models.watcher import Watcher
from app.services.social_listening import SocialListeningService
from app.services.social_listening.service import (
    ALL_SOCIAL_SIGNAL_TYPES,
    SIGNAL_TYPE_POST,
    SOCIAL_LISTENING_SOURCE,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/social", tags=["social-listening"])


# ============================================================================
# Schemas
# ============================================================================


class BooleanQuerySchema(BaseModel):
    must: List[str] = Field(default_factory=list)
    should: List[str] = Field(default_factory=list)
    must_not: List[str] = Field(default_factory=list)


class QueryFiltersSchema(BaseModel):
    job_titles: List[str] = Field(default_factory=list)
    seniority: List[str] = Field(default_factory=list)
    industries: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    countries: List[str] = Field(default_factory=list)
    hide_replies: bool = True
    must_contain_links: bool = False
    exclude_sponsored: bool = True


class SearchCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1024)
    keywords: List[str] = Field(..., min_length=1, max_length=20)
    signal_types: List[str] = Field(default_factory=lambda: [SIGNAL_TYPE_POST])
    schedule: str = Field("daily", pattern=r"^(hourly|daily|weekly|manual)$")
    max_leads: int = Field(10, ge=1, le=50)
    # v2 wizard fields
    source: str = Field("linkedin_posts")
    boolean_query: Optional[BooleanQuerySchema] = None
    filters: Optional[QueryFiltersSchema] = None
    time_frame: str = Field("week")
    auto_enrich: bool = False
    auto_outreach: bool = False
    auto_crm_push: bool = False
    # Sender / company context (used by the outreach drafter inside the agent)
    client_company: Optional[str] = None
    client_description: Optional[str] = None
    sender_name: Optional[str] = None
    message_type: Optional[str] = None
    tone: Optional[str] = None


class SearchUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None
    signal_types: Optional[List[str]] = None
    schedule: Optional[str] = Field(None, pattern=r"^(hourly|daily|weekly|manual)$")
    max_leads: Optional[int] = Field(None, ge=1, le=50)
    status: Optional[str] = Field(None, pattern=r"^(active|paused)$")
    source: Optional[str] = None
    boolean_query: Optional[BooleanQuerySchema] = None
    filters: Optional[QueryFiltersSchema] = None
    time_frame: Optional[str] = None
    auto_enrich: Optional[bool] = None
    auto_outreach: Optional[bool] = None
    auto_crm_push: Optional[bool] = None
    client_company: Optional[str] = None
    client_description: Optional[str] = None
    sender_name: Optional[str] = None
    message_type: Optional[str] = None
    tone: Optional[str] = None


class SearchResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    keywords: List[str]
    signal_types: List[str]
    schedule: str
    max_leads: int
    status: str
    total_signals: int
    enriched_signals: int
    last_synced_at: Optional[datetime]
    created_at: Optional[datetime]
    client_company: Optional[str] = None
    client_description: Optional[str] = None
    sender_name: Optional[str] = None
    message_type: Optional[str] = None
    tone: Optional[str] = None


class SignalResponse(BaseModel):
    id: UUID
    signal_type: str
    person_name: Optional[str]
    person_title: Optional[str]
    person_company: Optional[str]
    person_email: Optional[str]
    person_email_verified: bool
    person_linkedin: Optional[str]
    post_url: Optional[str]
    post_snippet: Optional[str]
    best_hook: Optional[str]
    intent_score: Optional[int]
    intent_tier: str  # 'hot' | 'warm' | 'cold'
    match_factors: List[str]
    matched_search_ids: List[str]
    matched_search_names: List[str]
    discovered_at: datetime
    outreach_message: Optional[str] = None
    outreach_char_count: Optional[int] = None
    # Taxonomy fields populated from raw_data.taxonomy
    signal_category: Optional[str] = None   # Sales-Led, Product-Led, etc.
    signal_strength: Optional[str] = None   # High, Medium, Low
    funnel_stage: Optional[str] = None      # Awareness, Consideration, etc.
    trigger_type: Optional[str] = None      # History-Based, Behavioral, etc.
    # Media — pulled from raw_data when the scraper surfaced them.  Empty
    # defaults mean the UI should render initials / no thumbnail, not fail.
    post_images: List[str] = []             # post attachment image URLs
    profile_picture_url: Optional[str] = None   # author's DP


class StatsResponse(BaseModel):
    total_signals: int
    total_signals_delta_pct: int
    enriched_contacts: int
    enriched_contacts_delta_pct: int
    hot_intent_leads: int
    hot_intent_leads_delta: int
    active_searches: int
    running_searches: int


# ============================================================================
# Search Suggestions
# ============================================================================


ROLE_TEMPLATES = [
    "CTOs", "VPs of Engineering", "Founders", "Sales leaders",
    "Product managers", "CMOs", "RevOps leaders", "SDR managers",
    "Growth leads", "CIOs", "Engineering managers", "DevRel leads",
]

TOPIC_TEMPLATES = [
    "discussing AI stack", "evaluating outbound tools", "posting about GTM strategy",
    "hiring for sales teams", "building AI agents", "switching CRM platforms",
    "scaling outbound", "adopting signal-based selling", "automating workflows",
    "complaining about tool fatigue", "sharing sales playbooks", "announcing funding",
    "launching new products", "exploring AI automation", "debating cold email vs social",
]


@router.get("/suggestions")
def get_search_suggestions(
    q: str = Query("", max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return smart search name + keyword suggestions based on user input."""
    import random

    q_lower = q.strip().lower()

    # Filter roles and topics that match the partial input
    if q_lower:
        matching_roles = [r for r in ROLE_TEMPLATES if q_lower in r.lower() or any(w in r.lower() for w in q_lower.split())]
        matching_topics = [t for t in TOPIC_TEMPLATES if q_lower in t.lower() or any(w in t.lower() for w in q_lower.split())]
    else:
        matching_roles = ROLE_TEMPLATES[:6]
        matching_topics = TOPIC_TEMPLATES[:6]

    # If no matches, show top suggestions
    if not matching_roles:
        matching_roles = random.sample(ROLE_TEMPLATES, min(4, len(ROLE_TEMPLATES)))
    if not matching_topics:
        matching_topics = random.sample(TOPIC_TEMPLATES, min(4, len(TOPIC_TEMPLATES)))

    # Combine into full search name suggestions
    suggestions = []
    for role in matching_roles[:4]:
        for topic in matching_topics[:3]:
            suggestions.append(f"{role} {topic}")
            if len(suggestions) >= 8:
                break
        if len(suggestions) >= 8:
            break

    # Also suggest keywords for the query builder
    keyword_suggestions = []
    if q_lower:
        keyword_suggestions = [w for w in q_lower.split() if len(w) > 2]
        keyword_suggestions.extend([t.split()[-1] for t in matching_topics[:5]])
    else:
        keyword_suggestions = ["AI agents", "GTM", "outbound", "automation", "sales tools", "CRM"]

    return {
        "name_suggestions": suggestions[:8],
        "keyword_suggestions": list(dict.fromkeys(keyword_suggestions))[:10],
    }


# ============================================================================
# Searches CRUD
# ============================================================================


@router.get("/searches", response_model=List[SearchResponse])
def list_searches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SearchResponse]:
    rows = (
        db.query(Watcher)
        .filter(Watcher.user_id == current_user.id, Watcher.type == "social_listening")
        .order_by(Watcher.created_at.desc())
        .all()
    )
    return [_serialize_search(w, db) for w in rows]


@router.post("/searches", response_model=SearchResponse, status_code=status.HTTP_201_CREATED)
def create_search(
    payload: SearchCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    _validate_signal_types(payload.signal_types)

    wid = f"w-{uuid4().hex[:8]}"
    criteria: Dict[str, Any] = {
        "keywords": [k.strip() for k in payload.keywords if k.strip()],
        "signal_types": payload.signal_types or [SIGNAL_TYPE_POST],
        "schedule": payload.schedule,
        "max_leads": payload.max_leads,
        "source": payload.source or "linkedin_posts",
        "time_frame": payload.time_frame or "week",
        "auto_enrich": payload.auto_enrich,
        "auto_outreach": payload.auto_outreach,
        "auto_crm_push": payload.auto_crm_push,
        "client_company": payload.client_company or "",
        "client_description": payload.client_description or "",
        "sender_name": payload.sender_name or "",
        "message_type": payload.message_type or "Connection Request (300 chars)",
        "tone": payload.tone or "Casual & Friendly",
    }
    if payload.boolean_query:
        criteria["boolean_query"] = payload.boolean_query.model_dump()
    if payload.filters:
        criteria["filters"] = payload.filters.model_dump()

    watcher = Watcher(
        id=wid,
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        type="social_listening",
        status="active",
        criteria=criteria,
        notification_settings={"email": True, "slack": False},
        match_count="0",
        recent_updates=[],
    )
    db.add(watcher)
    db.commit()
    db.refresh(watcher)
    return _serialize_search(watcher, db)


@router.get("/searches/{search_id}", response_model=SearchResponse)
def get_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    return _serialize_search(watcher, db)


@router.patch("/searches/{search_id}", response_model=SearchResponse)
def update_search(
    search_id: str,
    payload: SearchUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    criteria = dict(watcher.criteria or {})

    if payload.name is not None:
        watcher.name = payload.name
    if payload.description is not None:
        watcher.description = payload.description
    if payload.keywords is not None:
        criteria["keywords"] = [k.strip() for k in payload.keywords if k.strip()]
    if payload.signal_types is not None:
        _validate_signal_types(payload.signal_types)
        criteria["signal_types"] = payload.signal_types
    if payload.schedule is not None:
        criteria["schedule"] = payload.schedule
    if payload.max_leads is not None:
        criteria["max_leads"] = payload.max_leads
    if payload.status is not None:
        watcher.status = payload.status
    for fld in ("client_company", "client_description", "sender_name", "message_type", "tone",
                 "source", "time_frame"):
        val = getattr(payload, fld)
        if val is not None:
            criteria[fld] = val
    for bool_fld in ("auto_enrich", "auto_outreach", "auto_crm_push"):
        val = getattr(payload, bool_fld)
        if val is not None:
            criteria[bool_fld] = val
    if payload.boolean_query is not None:
        criteria["boolean_query"] = payload.boolean_query.model_dump()
    if payload.filters is not None:
        criteria["filters"] = payload.filters.model_dump()

    watcher.criteria = criteria
    db.add(watcher)
    db.commit()
    db.refresh(watcher)
    return _serialize_search(watcher, db)


@router.delete("/searches/{search_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    db.delete(watcher)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class RunNowResponse(BaseModel):
    run_id: str
    task_id: str
    status: str
    watcher_id: str


class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    leads_count: int
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    search: Optional[SearchResponse] = None


@router.post("/searches/{search_id}/run-now", response_model=RunNowResponse, status_code=202)
def run_search_now(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunNowResponse:
    """Queue a background discovery run for this watcher.

    Returns immediately with a `run_id` the client can poll via
    `GET /searches/{id}/run-status/{run_id}`.  The run itself executes in
    the Celery worker and survives client disconnects.
    """
    import uuid
    from app.db.models.agent_run import AgentRun
    from app.tasks.social_listening_tasks import run_social_search

    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    if watcher.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="search is paused — resume it before running",
        )

    run = AgentRun(
        id=uuid.uuid4(),
        user_id=current_user.id,
        agent_type="social-listening",
        flow_id=None,
        input=watcher.criteria or {},
        status="queued",
    )
    db.add(run)
    db.commit()

    task = run_social_search.delay(str(watcher.id), str(current_user.id), str(run.id))

    return RunNowResponse(
        run_id=str(run.id),
        task_id=task.id,
        status="queued",
        watcher_id=str(watcher.id),
    )


@router.get("/searches/{search_id}/run-status/{run_id}", response_model=RunStatusResponse)
def get_run_status(
    search_id: str,
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunStatusResponse:
    """Poll the status of a background run dispatched via /run-now."""
    from app.db.models.agent_run import AgentRun

    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    run = (
        db.query(AgentRun)
        .filter(AgentRun.id == run_id, AgentRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    leads_count = len(run.leads or []) if run.leads else 0
    search_payload = _serialize_search(watcher, db) if run.status == "success" else None

    return RunStatusResponse(
        run_id=str(run.id),
        status=run.status,
        leads_count=leads_count,
        error_message=run.error_message,
        started_at=run.created_at.isoformat() if run.created_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
        search=search_payload,
    )


# ============================================================================
# Signals feed
# ============================================================================


@router.get("/signals", response_model=List[SignalResponse])
def list_signals(
    search_id: Optional[str] = Query(None),
    signal_type: Optional[str] = Query(None),
    signal_category: Optional[str] = Query(None),
    min_intent: Optional[int] = Query(None, ge=0, le=100),
    sort: str = Query("intent", pattern=r"^(intent|recent|engagement)$"),
    since: Optional[str] = Query(None, pattern=r"^(hour|today|week|month|all)$"),
    limit: int = Query(50, ge=1, le=200),
    enriched_only: Optional[bool] = Query(None),
    hot_only: Optional[bool] = Query(None),
    strength: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SignalResponse]:
    """Paged + filtered + sorted signal feed for the current user.

    Joins through `signal_watcher_matches` for tenant isolation; all filters
    apply on the SignalEvent side.
    """
    q = (
        db.query(SignalEvent, SignalWatcherMatch)
        .join(SignalWatcherMatch, SignalWatcherMatch.signal_id == SignalEvent.id)
        .filter(SignalWatcherMatch.user_id == current_user.id)
        .filter(SignalEvent.is_archived == False)  # noqa: E712
        .filter(SignalEvent.source == SOCIAL_LISTENING_SOURCE)
    )

    if search_id:
        # Validate the search belongs to the user before trusting the filter.
        _get_user_search_or_404(db, current_user.id, search_id)
        q = q.filter(SignalWatcherMatch.watcher_id == search_id)

    if signal_type and signal_type != "all":
        q = q.filter(SignalEvent.signal_type == signal_type)
    if signal_category and signal_category != "all":
        # Filter by taxonomy.category inside the raw_data JSONB column.
        # PostgreSQL: raw_data->'taxonomy'->>'category' = 'Sales-Led'
        q = q.filter(
            SignalEvent.raw_data["taxonomy"]["category"].astext == signal_category
        )
    if min_intent is not None:
        q = q.filter(SignalEvent.icp_score >= min_intent)
    if enriched_only:
        q = q.filter(SignalEvent.prospect_email.isnot(None))
    if hot_only:
        q = q.filter(SignalEvent.icp_score >= 80)
    if strength:
        # Filter by taxonomy.strength inside the raw_data JSONB column.
        # PostgreSQL: raw_data->'taxonomy'->>'strength' = 'High'
        q = q.filter(
            SignalEvent.raw_data["taxonomy"]["strength"].astext == strength
        )

    if since and since != "all":
        cutoff = _since_cutoff(since)
        if cutoff:
            q = q.filter(SignalEvent.discovered_at >= cutoff)

    if sort == "intent":
        q = q.order_by(desc(SignalEvent.icp_score), desc(SignalEvent.discovered_at))
    elif sort == "recent":
        q = q.order_by(desc(SignalEvent.discovered_at))
    else:  # engagement — fall back to recency for now
        q = q.order_by(desc(SignalEvent.discovered_at))

    rows = q.limit(limit).all()
    # Group matches per signal so we can show every saved-search badge.
    by_signal: Dict[UUID, Dict[str, Any]] = {}
    for signal, match in rows:
        bucket = by_signal.setdefault(signal.id, {"signal": signal, "watcher_ids": []})
        bucket["watcher_ids"].append(match.watcher_id)

    # Pull the watcher names in one query.
    all_watcher_ids = {wid for b in by_signal.values() for wid in b["watcher_ids"]}
    watcher_name_map: Dict[str, str] = {}
    if all_watcher_ids:
        for w in (
            db.query(Watcher.id, Watcher.name)
            .filter(Watcher.id.in_(all_watcher_ids))
            .all()
        ):
            watcher_name_map[w.id] = w.name

    return [
        _serialize_signal(b["signal"], b["watcher_ids"], watcher_name_map)
        for b in by_signal.values()
    ]


@router.get("/signals/{signal_id}", response_model=SignalResponse)
def get_signal(
    signal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SignalResponse:
    signal, watcher_ids, name_map = _get_user_signal_or_404(db, current_user.id, signal_id)
    return _serialize_signal(signal, watcher_ids, name_map)


# ============================================================================
# Per-signal actions
# ============================================================================


@router.post("/signals/{signal_id}/enrich")
async def enrich_signal(
    signal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Enrich a signal with email, phone, and profile data.

    Uses CrustData person enrichment as primary source, falls back to
    BetterContact when CrustData misses.  Returns immediately if the
    signal already has an email on file (no credits charged).
    """
    from app.services.social_listening.enrichment import enrich_signal as do_enrich

    signal, _wids, _names = _get_user_signal_or_404(db, current_user.id, signal_id)

    # Check if already enriched
    if signal.prospect_email:
        return {
            "signal_id": str(signal.id),
            "status": "already_enriched",
            "email": signal.prospect_email,
            "credits_charged": 0,
        }

    # Check credits before enriching
    ENRICH_COST = 2
    if current_user.credits_balance < ENRICH_COST:
        return {
            "signal_id": str(signal.id),
            "status": "insufficient_credits",
            "email": None,
            "credits_charged": 0,
            "error": f"Need {ENRICH_COST} credits, have {current_user.credits_balance}",
        }

    result = await do_enrich(signal, db)

    # Deduct credits and record transaction
    credits_charged = 0
    if result.get("email") or result.get("phone"):
        credits_charged = ENRICH_COST
        current_user.credits_balance -= ENRICH_COST
        db.add(current_user)
        try:
            from app.db.models.credit import CreditTransaction
            tx = CreditTransaction(
                user_id=current_user.id,
                amount=-ENRICH_COST,
                description=f"Signal reveal: {signal.prospect_name or signal.id}",
                transaction_type="signal_reveal",
            )
            db.add(tx)
        except Exception:
            pass  # CreditTransaction model may not exist — non-fatal

    db.commit()

    return {
        "signal_id": str(signal.id),
        "status": result.get("status", "unknown"),
        "email": result.get("email"),
        "phone": result.get("phone"),
        "credits_charged": credits_charged,
        "credits_remaining": current_user.credits_balance,
    }


@router.post("/signals/{signal_id}/outreach")
async def signal_outreach(
    signal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generate an AI outreach draft for this signal.

    Returns a cached draft if one already exists in ``raw_data.message``.
    Otherwise calls the LLM via OpenRouter to produce a short, personalized
    LinkedIn connection request.
    """
    signal, _wids, _names = _get_user_signal_or_404(db, current_user.id, signal_id)
    raw = signal.raw_data or {}

    # Return cached draft if it exists
    if raw.get("message"):
        return {
            "signal_id": str(signal.id),
            "message": raw["message"],
            "char_count": len(raw["message"]),
        }

    # Generate new draft via OpenRouter
    from app.services.openrouter_service import OpenRouterService

    post_snippet = raw.get("post_snippet", "")[:300]
    person_name = signal.prospect_name or "there"
    person_title = signal.prospect_title or ""
    company = signal.company_name or ""

    prompt = (
        f"Write a short, personalized LinkedIn connection request "
        f"(under 300 characters) to {person_name}.\n\n"
        f"Context about them:\n"
        f"- Title: {person_title}\n"
        f"- Company: {company}\n"
        f'- They recently posted: "{post_snippet}"\n\n'
        f"Requirements:\n"
        f"- Reference their specific post content\n"
        f"- Be casual and friendly, not salesy\n"
        f"- Show genuine interest in their perspective\n"
        f"- Under 300 characters\n"
        f'- No hashtags, no emojis, no "I\'d love to connect" cliches\n\n'
        f"Write ONLY the message, nothing else."
    )

    try:
        llm = OpenRouterService()
        draft = await llm.chat_completion_text(
            system_prompt=(
                "You are an expert B2B networking copywriter. "
                "Write concise, personalized LinkedIn connection requests "
                "that feel genuine and reference the prospect's recent activity."
            ),
            user_prompt=prompt,
            temperature=0.7,
            max_tokens=150,
            agent_type="sdr",
        )
        draft = draft.strip().strip('"').strip("'")

        # Cache the draft
        updated_raw = dict(raw)
        updated_raw["message"] = draft
        updated_raw["char_count"] = len(draft)
        signal.raw_data = updated_raw
        db.add(signal)
        db.commit()

        return {
            "signal_id": str(signal.id),
            "message": draft,
            "char_count": len(draft),
        }
    except Exception as exc:
        logger.warning("Outreach draft generation failed: %s", exc)
        return {
            "signal_id": str(signal.id),
            "message": "",
            "char_count": 0,
            "error": str(exc),
        }


@router.post("/signals/{signal_id}/crm-push")
async def signal_crm_push(
    signal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Push a signal to HubSpot as a contact."""
    signal, _wids, _names = _get_user_signal_or_404(db, current_user.id, signal_id)
    raw = signal.raw_data or {}

    hs = HubSpotService(db)
    hs_status = hs.is_connected(current_user)

    if not hs_status["connected"]:
        return {
            "signal_id": str(signal.id),
            "crm": "hubspot",
            "status": "not_connected",
            "note": "Connect HubSpot first via Settings -> Integrations",
            "auth_url": HubSpotService.get_auth_url(state=str(current_user.id)) if hs.is_available() else None,
        }

    properties = {
        "firstname": (signal.prospect_name or "").split(" ", 1)[0],
        "lastname": " ".join((signal.prospect_name or "").split(" ", 1)[1:]),
        "email": signal.prospect_email or "",
        "jobtitle": signal.prospect_title or "",
        "company": signal.company_name or "",
        "hs_lead_status": "NEW",
        "lifecyclestage": "lead",
    }
    linkedin = raw.get("linkedin", "")
    if linkedin:
        properties["linkedin_url"] = linkedin

    # Check if email exists — skip if no email
    if not properties["email"]:
        return {
            "signal_id": str(signal.id),
            "crm": "hubspot",
            "status": "skipped",
            "note": "No email found — enrich the contact first",
        }

    try:
        # Check for existing contact
        existing = await hs.search_contact(current_user.id, properties["email"])
        if existing:
            return {
                "signal_id": str(signal.id),
                "crm": "hubspot",
                "status": "already_exists",
                "contact_id": existing.get("id"),
                "note": f"Contact already exists in HubSpot (ID: {existing.get('id')})",
            }

        result = await hs.create_contact(current_user.id, properties)
        return {
            "signal_id": str(signal.id),
            "crm": "hubspot",
            "status": "created",
            "contact_id": result.get("id"),
            "note": f"Contact created in HubSpot (ID: {result.get('id')})",
        }
    except Exception as exc:
        return {
            "signal_id": str(signal.id),
            "crm": "hubspot",
            "status": "error",
            "note": str(exc),
        }


# ============================================================================
# KPI stats
# ============================================================================


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatsResponse:
    """4 KPI cards for the dashboard header.

    Day-over-day: compares the last 24h to the prior 24h.
    Hot intent: signals with icp_score >= 80.
    """
    now = datetime.now(timezone.utc)
    today_cutoff = now - timedelta(hours=24)
    yesterday_cutoff = now - timedelta(hours=48)

    base = (
        db.query(SignalEvent)
        .join(SignalWatcherMatch, SignalWatcherMatch.signal_id == SignalEvent.id)
        .filter(
            SignalWatcherMatch.user_id == current_user.id,
            SignalEvent.source == SOCIAL_LISTENING_SOURCE,
        )
    )

    total = base.count()
    total_today = base.filter(SignalEvent.discovered_at >= today_cutoff).count()
    total_yesterday = (
        base.filter(SignalEvent.discovered_at >= yesterday_cutoff)
        .filter(SignalEvent.discovered_at < today_cutoff)
        .count()
    )

    enriched = base.filter(SignalEvent.prospect_email.isnot(None)).count()
    enriched_today = base.filter(
        SignalEvent.prospect_email.isnot(None),
        SignalEvent.discovered_at >= today_cutoff,
    ).count()
    enriched_yesterday = (
        base.filter(SignalEvent.prospect_email.isnot(None))
        .filter(SignalEvent.discovered_at >= yesterday_cutoff)
        .filter(SignalEvent.discovered_at < today_cutoff)
        .count()
    )

    hot = base.filter(SignalEvent.icp_score >= 80).count()
    hot_today = base.filter(
        SignalEvent.icp_score >= 80,
        SignalEvent.discovered_at >= today_cutoff,
    ).count()

    active_searches = (
        db.query(func.count(Watcher.id))
        .filter(
            Watcher.user_id == current_user.id,
            Watcher.type == "social_listening",
            Watcher.status == "active",
        )
        .scalar()
    ) or 0
    # In v1 every active search is "running" by definition (no async queue
    # yet).  Once Celery beat is wired this becomes a separate count of
    # currently-executing tasks.
    running_searches = active_searches

    return StatsResponse(
        total_signals=total,
        total_signals_delta_pct=_pct_delta(total_today, total_yesterday),
        enriched_contacts=enriched,
        enriched_contacts_delta_pct=_pct_delta(enriched_today, enriched_yesterday),
        hot_intent_leads=hot,
        hot_intent_leads_delta=hot_today,
        active_searches=active_searches,
        running_searches=running_searches,
    )


# ============================================================================
# Helpers
# ============================================================================


def _validate_signal_types(types: List[str]) -> None:
    bad = [t for t in types if t not in ALL_SOCIAL_SIGNAL_TYPES]
    if bad:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"unknown signal_type(s): {bad}",
        )


def _get_user_search_or_404(db: Session, user_id: UUID, search_id: str) -> Watcher:
    w = (
        db.query(Watcher)
        .filter(
            Watcher.id == search_id,
            Watcher.user_id == user_id,
            Watcher.type == "social_listening",
        )
        .first()
    )
    if not w:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="search not found")
    return w


def _get_user_signal_or_404(
    db: Session,
    user_id: UUID,
    signal_id: UUID,
) -> tuple[SignalEvent, List[str], Dict[str, str]]:
    rows = (
        db.query(SignalEvent, SignalWatcherMatch)
        .join(SignalWatcherMatch, SignalWatcherMatch.signal_id == SignalEvent.id)
        .filter(
            SignalEvent.id == signal_id,
            SignalWatcherMatch.user_id == user_id,
        )
        .all()
    )
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="signal not found")
    signal = rows[0][0]
    watcher_ids = [m.watcher_id for _, m in rows]
    name_map: Dict[str, str] = {}
    if watcher_ids:
        for w in (
            db.query(Watcher.id, Watcher.name).filter(Watcher.id.in_(watcher_ids)).all()
        ):
            name_map[w.id] = w.name
    return signal, watcher_ids, name_map


def _serialize_search(watcher: Watcher, db: Session) -> SearchResponse:
    criteria: Dict[str, Any] = dict(watcher.criteria or {})

    # Per-search signal counts (cheap aggregate).
    total_signals = (
        db.query(func.count(SignalWatcherMatch.signal_id))
        .filter(SignalWatcherMatch.watcher_id == watcher.id)
        .scalar()
    ) or 0
    enriched_signals = (
        db.query(func.count(SignalWatcherMatch.signal_id))
        .join(SignalEvent, SignalEvent.id == SignalWatcherMatch.signal_id)
        .filter(
            SignalWatcherMatch.watcher_id == watcher.id,
            SignalEvent.prospect_email.isnot(None),
        )
        .scalar()
    ) or 0

    return SearchResponse(
        id=watcher.id,
        name=watcher.name,
        description=watcher.description,
        keywords=list(criteria.get("keywords") or []),
        signal_types=list(criteria.get("signal_types") or [SIGNAL_TYPE_POST]),
        schedule=criteria.get("schedule") or "daily",
        max_leads=int(criteria.get("max_leads", 5)),
        status=watcher.status or "active",
        total_signals=total_signals,
        enriched_signals=enriched_signals,
        last_synced_at=watcher.last_synced_at,
        created_at=watcher.created_at,
        client_company=criteria.get("client_company") or None,
        client_description=criteria.get("client_description") or None,
        sender_name=criteria.get("sender_name") or None,
        message_type=criteria.get("message_type") or None,
        tone=criteria.get("tone") or None,
    )


def _serialize_signal(
    signal: SignalEvent,
    matched_watcher_ids: List[str],
    watcher_name_map: Dict[str, str],
) -> SignalResponse:
    raw = signal.raw_data or {}
    score = signal.icp_score or 0
    if score >= 80:
        tier = "hot"
    elif score >= 50:
        tier = "warm"
    else:
        tier = "cold"

    taxonomy = raw.get("taxonomy") or {}

    return SignalResponse(
        id=signal.id,
        signal_type=signal.signal_type,
        person_name=signal.prospect_name,
        person_title=signal.prospect_title,
        person_company=signal.company_name,
        person_email=signal.prospect_email,
        person_email_verified=bool(signal.prospect_email and not raw.get("email_unverified")),
        person_linkedin=raw.get("linkedin"),
        post_url=raw.get("post_url"),
        post_snippet=raw.get("post_snippet"),
        best_hook=raw.get("best_hook"),
        intent_score=signal.icp_score,
        intent_tier=tier,
        match_factors=list(signal.icp_match_factors or []),
        matched_search_ids=matched_watcher_ids,
        matched_search_names=[watcher_name_map.get(wid, "") for wid in matched_watcher_ids],
        discovered_at=signal.discovered_at,
        outreach_message=raw.get("message"),
        outreach_char_count=raw.get("char_count"),
        signal_category=taxonomy.get("category"),
        signal_strength=taxonomy.get("strength"),
        funnel_stage=taxonomy.get("funnel_stage"),
        trigger_type=taxonomy.get("trigger_type"),
        # Media — empty list/None when the scraper didn't provide them.
        # Tolerates both new-style keys and older scrapes that only
        # stored singular `image`/`profile_picture`.
        post_images=list(raw.get("post_images") or ([raw["image"]] if raw.get("image") else [])),
        profile_picture_url=raw.get("profile_picture_url") or raw.get("profile_picture") or None,
    )


def _since_cutoff(since: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc)
    if since == "hour":
        return now - timedelta(hours=1)
    if since == "today":
        return now - timedelta(hours=24)
    if since == "week":
        return now - timedelta(days=7)
    if since == "month":
        return now - timedelta(days=30)
    return None


def _pct_delta(today: int, yesterday: int) -> int:
    if yesterday <= 0:
        return 100 if today > 0 else 0
    return int(((today - yesterday) / yesterday) * 100)


# ============================================================================
# HubSpot OAuth
# ============================================================================


@router.get("/hubspot/auth-url")
def hubspot_auth_url(
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """Return the HubSpot OAuth authorization URL."""
    if not HubSpotService.is_available():
        raise HTTPException(
            status_code=503,
            detail="HubSpot OAuth not configured — set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET",
        )
    return {"url": HubSpotService.get_auth_url(state=str(current_user.id))}


@router.get("/hubspot/callback")
async def hubspot_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Handle HubSpot OAuth callback — exchange code for tokens."""
    service = HubSpotService(db)
    token_data = await service.exchange_code(code, state=state)

    user = db.query(User).filter(User.id == state).first() if state else None
    if not user:
        raise HTTPException(status_code=400, detail="Invalid state — user not found")

    service.store_tokens(user.id, token_data)
    portal_id = str(token_data.get("hub_id") or token_data.get("hub-id") or "")
    return {"status": "connected", "portal_id": portal_id}


@router.get("/hubspot/status")
def hubspot_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Check HubSpot connection status."""
    hs = HubSpotService(db)
    return {
        "available": hs.is_available(),
        **hs.is_connected(current_user),
    }


@router.post("/hubspot/disconnect")
def hubspot_disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """Disconnect HubSpot integration."""
    hs = HubSpotService(db)
    hs.disconnect(current_user.id)
    return {"status": "disconnected"}


# ============================================================================
# Integration status
# ============================================================================


@router.get("/integrations")
def get_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return connection status of email, LinkedIn, and CRM integrations."""
    from app.services.gmail_service import GmailService
    from app.services.unipile_service import UnipileService

    gmail = GmailService()
    unipile = UnipileService()

    # GmailService.is_connected(user) returns {"connected": bool, "email": str|None}
    gmail_status = gmail.is_connected(current_user)

    # UnipileService.is_connected() returns {"connected": bool, "dsn": str|None}
    unipile_status = unipile.is_connected()

    # HubSpot CRM status
    hs = HubSpotService(db)
    hs_status = hs.is_connected(current_user)

    return {
        "email": {
            "provider": "gmail",
            "connected": gmail_status["connected"],
            "email": gmail_status["email"],
        },
        "linkedin": {
            "provider": "unipile",
            "connected": unipile_status["connected"],
        },
        "crm": {
            "provider": "hubspot",
            "connected": hs_status["connected"],
            "portal_id": hs_status.get("portal_id"),
            "available": hs.is_available(),
        },
    }
