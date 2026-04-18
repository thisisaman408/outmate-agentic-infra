"""Celery task that drives a voice campaign to completion.

Picks up a `VoiceCampaign` row and iterates its `voice_campaign_prospects`
in queued order.  For each prospect:
  1. Check credits — skip if insufficient (don't fail the whole campaign)
  2. Create an AgentRun up-front (crash-safety pattern — matches
     voice_agent.trigger_voice_call)
  3. Call Retell via `_call_via_retell` (same helper the sync endpoint uses)
  4. Persist result, deduct credits on success, update campaign counters
  5. Respect `max_calls_per_day` — if hit, leave remaining rows queued and
     reschedule task for tomorrow 00:15 UTC via `apply_async(eta=...)`
  6. Poll for `status = paused | cancelled` between calls — bail immediately

Between calls we sleep 2s so we never flood HubSpot/Retell if someone
dumps 500 prospects at once.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from celery import shared_task
from sqlalchemy.orm import Session

from app.api.routes.voice_agent import (
    TriggerCallRequest,
    _call_via_agentic_infra,
    _call_via_retell,
    _config_key,
)
from app.core.config import settings
from app.core.redis import RedisManager
from app.db.deps import SessionLocal
from app.db.models.agent_run import AgentRun
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect
from app.db.utils import check_sufficient_credits, deduct_credits

logger = logging.getLogger(__name__)

VOICE_CALL_COST = 5
BETWEEN_CALLS_SECONDS = 2


@shared_task(name="app.tasks.voice_campaign_tasks.run_voice_campaign", bind=True)
def run_voice_campaign(self, campaign_id: str) -> Dict[str, Any]:
    """Drive one campaign to completion (or until daily cap / pause)."""
    db: Session = SessionLocal()
    try:
        return asyncio.run(_run_async(db, campaign_id))
    finally:
        db.close()


async def _run_async(db: Session, campaign_id: str) -> Dict[str, Any]:
    campaign = db.query(VoiceCampaign).filter(VoiceCampaign.id == campaign_id).first()
    if not campaign:
        logger.warning("run_voice_campaign: campaign %s not found", campaign_id)
        return {"ok": False, "reason": "not_found"}

    if campaign.status in ("completed", "cancelled"):
        return {"ok": True, "reason": f"campaign_{campaign.status}"}

    campaign.status = "running"
    if not campaign.started_at:
        campaign.started_at = datetime.now(timezone.utc)
    db.commit()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    calls_today = (
        db.query(VoiceCampaignProspect)
        .filter(
            VoiceCampaignProspect.campaign_id == campaign.id,
            VoiceCampaignProspect.attempted_at.isnot(None),
            VoiceCampaignProspect.attempted_at >= today_start,
        )
        .count()
    )

    call_script, voice_config = await _load_user_voice_config(campaign.user_id)

    while True:
        db.expire(campaign)
        db.refresh(campaign)
        if campaign.status in ("paused", "cancelled"):
            logger.info("run_voice_campaign: campaign %s %s — stopping", campaign.id, campaign.status)
            return {"ok": True, "reason": f"campaign_{campaign.status}"}

        if calls_today >= campaign.max_calls_per_day:
            tomorrow = datetime.now(timezone.utc).replace(
                hour=0, minute=15, second=0, microsecond=0
            ) + timedelta(days=1)
            run_voice_campaign.apply_async(args=[str(campaign.id)], eta=tomorrow)
            logger.info(
                "run_voice_campaign: hit daily cap %d — rescheduled campaign %s for %s",
                campaign.max_calls_per_day,
                campaign.id,
                tomorrow.isoformat(),
            )
            return {"ok": True, "reason": "daily_cap_hit"}

        prospect = (
            db.query(VoiceCampaignProspect)
            .filter(
                VoiceCampaignProspect.campaign_id == campaign.id,
                VoiceCampaignProspect.status == "queued",
            )
            .order_by(VoiceCampaignProspect.id)
            .first()
        )
        if not prospect:
            campaign.status = "completed"
            campaign.finished_at = datetime.now(timezone.utc)
            db.commit()
            logger.info("run_voice_campaign: campaign %s completed", campaign.id)
            return {"ok": True, "reason": "completed"}

        await _call_one(db, campaign, prospect, call_script, voice_config)
        calls_today += 1

        await asyncio.sleep(BETWEEN_CALLS_SECONDS)


async def _load_user_voice_config(user_id) -> Tuple[Optional[Dict], Optional[Dict]]:
    redis = RedisManager.get_client()
    raw = await redis.get(_config_key(str(user_id)))
    if not raw:
        return None, None
    cfg = json.loads(raw)
    return cfg.get("call_script"), cfg


async def _call_one(
    db: Session,
    campaign: VoiceCampaign,
    prospect: VoiceCampaignProspect,
    call_script: Optional[Dict],
    voice_config: Optional[Dict],
) -> None:
    """Execute one call.  Persists result on the prospect row + campaign counters."""
    if not check_sufficient_credits(db, campaign.user_id, VOICE_CALL_COST):
        prospect.status = "skipped"
        prospect.error_message = "Insufficient credits"
        prospect.finished_at = datetime.now(timezone.utc)
        campaign.calls_failed += 1
        db.commit()
        return

    req = TriggerCallRequest(
        prospect_name=prospect.prospect_name,
        prospect_phone=prospect.prospect_phone,
        prospect_company=prospect.prospect_company,
        prospect_role=prospect.prospect_role,
        prospect_city=prospect.prospect_city,
        prospect_industry=prospect.prospect_industry,
        call_objective=campaign.call_objective,
        context=prospect.context,
    )

    run = AgentRun(
        user_id=campaign.user_id,
        agent_type="voice-agent",
        flow_id="retell" if settings.RETELL_API_KEY else "agentic-infra",
        input=req.model_dump(),
        status="running",
        cost_credits=VOICE_CALL_COST,
    )
    db.add(run)
    db.flush()

    prospect.status = "calling"
    prospect.attempted_at = datetime.now(timezone.utc)
    prospect.agent_run_id = run.id
    db.commit()

    started = time.monotonic()
    result: Dict[str, Any] = {}
    err: Optional[str] = None
    try:
        if settings.RETELL_API_KEY:
            result = await _call_via_retell(req, call_script, voice_config)
        else:
            result = await _call_via_agentic_infra(req, call_script)
    except Exception as exc:
        err = str(exc)[:500]

    run.duration_ms = int((time.monotonic() - started) * 1000)
    run.finished_at = datetime.now(timezone.utc)

    if err:
        run.status = "error"
        run.error_message = err
        prospect.status = "error"
        prospect.error_message = err
        prospect.finished_at = run.finished_at
        campaign.calls_failed += 1
        campaign.calls_made += 1
        db.commit()
        return

    run.status = "success"
    run.output_text = json.dumps(result)
    run.leads = [{"call_id": result.get("call_id"), "prospect": req.prospect_name}]
    prospect.status = "success"
    prospect.finished_at = run.finished_at
    campaign.calls_made += 1
    campaign.calls_booked += 1
    db.commit()

    deduct_credits(
        db=db,
        user_id=campaign.user_id,
        amount=VOICE_CALL_COST,
        reference_id=run.id,
        description=f"Voice campaign {campaign.name} → {req.prospect_name}",
    )
