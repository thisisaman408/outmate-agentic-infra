"""Voice Campaign API — create / list / get / pause / resume / cancel.

Create kicks off the background Celery task `run_voice_campaign`.  The
endpoint returns immediately with the campaign ID so the UI can start
polling `/voice-campaigns/{id}` for live progress.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.redis import RedisManager
from app.db.deps import get_db
from app.db.models.user import User
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect
from app.services.hubspot_service import HubSpotService
from app.services.voice_campaign.hubspot_list_resolver import resolve_hubspot_list
from app.services.voice_campaign.segment_resolver import resolve_hot_signals
from app.tasks.voice_campaign_tasks import run_voice_campaign

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/voice-campaigns", tags=["voice-campaigns"])


# ────────── Schemas ──────────

class ManualProspect(BaseModel):
    prospect_name: str
    prospect_phone: str
    prospect_company: str = ""
    prospect_role: str = ""
    prospect_city: str = ""
    prospect_industry: str = ""
    context: str = ""


class CreateCampaignRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    call_objective: str = "discovery"
    source_type: Literal["manual", "csv", "hubspot", "hot_signals"]
    source_params: Dict[str, Any] = {}
    max_calls_per_day: int = Field(50, ge=1, le=500)
    manual_prospects: Optional[List[ManualProspect]] = None


class CampaignProspectOut(BaseModel):
    id: str
    prospect_name: str
    prospect_phone: str
    prospect_company: str
    prospect_role: str
    status: str
    error_message: Optional[str]
    attempted_at: Optional[str]
    finished_at: Optional[str]
    agent_run_id: Optional[str]


class CampaignOut(BaseModel):
    id: str
    name: str
    call_objective: str
    source_type: str
    source_params: Dict[str, Any]
    max_calls_per_day: int
    status: str
    error_message: Optional[str]
    total_prospects: int
    calls_made: int
    calls_booked: int
    calls_failed: int
    created_at: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]


class CampaignDetail(CampaignOut):
    prospects: List[CampaignProspectOut]


class PreviewRequest(BaseModel):
    source_type: Literal["hubspot", "hot_signals"]
    source_params: Dict[str, Any] = {}


class HubSpotListOut(BaseModel):
    list_id: str
    name: str
    size: Optional[int] = None


# ────────── Helpers ──────────

def _serialize(c: VoiceCampaign) -> CampaignOut:
    return CampaignOut(
        id=str(c.id),
        name=c.name,
        call_objective=c.call_objective,
        source_type=c.source_type,
        source_params=c.source_params or {},
        max_calls_per_day=c.max_calls_per_day,
        status=c.status,
        error_message=c.error_message,
        total_prospects=c.total_prospects,
        calls_made=c.calls_made,
        calls_booked=c.calls_booked,
        calls_failed=c.calls_failed,
        created_at=c.created_at.isoformat() if c.created_at else None,
        started_at=c.started_at.isoformat() if c.started_at else None,
        finished_at=c.finished_at.isoformat() if c.finished_at else None,
    )


def _serialize_prospect(p: VoiceCampaignProspect) -> CampaignProspectOut:
    return CampaignProspectOut(
        id=str(p.id),
        prospect_name=p.prospect_name,
        prospect_phone=p.prospect_phone,
        prospect_company=p.prospect_company,
        prospect_role=p.prospect_role,
        status=p.status,
        error_message=p.error_message,
        attempted_at=p.attempted_at.isoformat() if p.attempted_at else None,
        finished_at=p.finished_at.isoformat() if p.finished_at else None,
        agent_run_id=str(p.agent_run_id) if p.agent_run_id else None,
    )


async def _resolve_source(
    db: Session, user_id: UUID, source_type: str, params: Dict[str, Any],
    manual: Optional[List[ManualProspect]],
) -> List[Dict[str, str]]:
    if source_type == "manual":
        return [p.model_dump() for p in (manual or [])]
    if source_type == "csv":
        redis = RedisManager.get_client()
        raw = await redis.get(f"voice_agent:contact_list:{user_id}")
        if not raw:
            return []
        rows = json.loads(raw)
        return [{
            "prospect_name": r.get("name", ""),
            "prospect_phone": r.get("phone", ""),
            "prospect_company": r.get("company", ""),
            "prospect_role": r.get("role", ""),
            "prospect_city": "",
            "prospect_industry": "",
            "context": "Imported from CSV upload.",
        } for r in rows if r.get("name") and r.get("phone")]
    if source_type == "hot_signals":
        return resolve_hot_signals(db, user_id, params)
    if source_type == "hubspot":
        return await resolve_hubspot_list(db, user_id, params)
    return []


# ────────── Endpoints ──────────

@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.user_id == user.id)
        .order_by(VoiceCampaign.created_at.desc())
        .limit(100)
        .all()
    )
    return [_serialize(r) for r in rows]


@router.post("/preview")
async def preview_source(
    req: PreviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dry-run a source to show how many prospects a campaign would include."""
    if req.source_type == "hot_signals":
        rows = resolve_hot_signals(db, user.id, req.source_params)
    elif req.source_type == "hubspot":
        rows = await resolve_hubspot_list(db, user.id, req.source_params)
    else:
        rows = []
    return {"total": len(rows), "preview": rows[:10]}


@router.get("/hubspot-lists", response_model=List[HubSpotListOut])
async def get_hubspot_lists(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List available HubSpot contact lists.

    If HubSpot isn't connected, return 400 with a pointer to the OAuth flow.
    """
    svc = HubSpotService(db)
    conn = svc.is_connected(user)
    if not conn.get("connected"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "hubspot_not_connected",
                "message": "Connect HubSpot in Settings → Integrations to use this source.",
                "connect_url": svc.get_auth_url(state=str(user.id)),
            },
        )
    raw = await svc.list_contact_lists(user.id)
    out: List[HubSpotListOut] = []
    for item in raw:
        lid = str(item.get("listId") or item.get("id") or "")
        if not lid:
            continue
        out.append(HubSpotListOut(
            list_id=lid,
            name=item.get("name", "Unnamed list"),
            size=item.get("size") or (item.get("additionalProperties", {}) or {}).get("hs_list_size"),
        ))
    return out


@router.post("", response_model=CampaignOut, status_code=201)
async def create_campaign(
    req: CreateCampaignRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create + launch a campaign.  Dispatches Celery task; returns immediately."""
    if req.source_type == "manual" and not req.manual_prospects:
        raise HTTPException(status_code=400, detail="manual_prospects required for source_type=manual")

    prospect_dicts = await _resolve_source(
        db, user.id, req.source_type, req.source_params, req.manual_prospects,
    )
    if not prospect_dicts:
        raise HTTPException(status_code=400, detail="Source resolved to zero callable prospects")

    campaign = VoiceCampaign(
        user_id=user.id,
        name=req.name,
        call_objective=req.call_objective,
        source_type=req.source_type,
        source_params=req.source_params,
        max_calls_per_day=req.max_calls_per_day,
        total_prospects=len(prospect_dicts),
        status="queued",
    )
    db.add(campaign)
    db.flush()

    for p in prospect_dicts:
        db.add(VoiceCampaignProspect(
            campaign_id=campaign.id,
            user_id=user.id,
            prospect_name=p.get("prospect_name", ""),
            prospect_phone=p.get("prospect_phone", ""),
            prospect_company=p.get("prospect_company", ""),
            prospect_role=p.get("prospect_role", ""),
            prospect_city=p.get("prospect_city", ""),
            prospect_industry=p.get("prospect_industry", ""),
            context=p.get("context", ""),
        ))
    db.commit()
    db.refresh(campaign)

    run_voice_campaign.delay(str(campaign.id))

    return _serialize(campaign)


@router.get("/{campaign_id}", response_model=CampaignDetail)
def get_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    prospects = (
        db.query(VoiceCampaignProspect)
        .filter(VoiceCampaignProspect.campaign_id == c.id)
        .order_by(VoiceCampaignProspect.id)
        .all()
    )
    base = _serialize(c)
    return CampaignDetail(
        **base.model_dump(),
        prospects=[_serialize_prospect(p) for p in prospects],
    )


@router.post("/{campaign_id}/pause", response_model=CampaignOut)
def pause_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status not in ("queued", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot pause — status is {c.status}")
    c.status = "paused"
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.post("/{campaign_id}/resume", response_model=CampaignOut)
def resume_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume — status is {c.status}")
    c.status = "queued"
    db.commit()
    run_voice_campaign.delay(str(c.id))
    db.refresh(c)
    return _serialize(c)


@router.post("/{campaign_id}/cancel", response_model=CampaignOut)
def cancel_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status in ("completed", "cancelled"):
        return _serialize(c)
    c.status = "cancelled"
    db.commit()
    db.refresh(c)
    return _serialize(c)
