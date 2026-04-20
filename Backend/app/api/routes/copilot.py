"""
Co-Pilot API Routes — Daily Brief, Meeting Prep, Campaign Optimizer, Pipeline Risk Alert.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
import json
import logging
from typing import Optional

from app.services.copilot.copilot_service import CopilotService
from app.services.copilot.lead_copilot_service import LeadCopilotService
from app.services.copilot.product_assistant_service import ProductAssistantService
from app.schemas.copilot import (
    MeetingPrepRequest,
    CampaignOptimizerRequest,
    EmailOptimizerRequest,
    PipelineScanRequest,
    CopilotPreferencesRequest,
    LeadActionType,
    LeadActionRequest,
    ProductAssistantRequest,
    ProductAssistantResponse,
    SaveChatSessionRequest,
    OrchestratorRequest,
    AuditLogEntry,
    AuditLogEntryFull,
    AgentChatRequest,
    AgentChatResponse,
    AgentToolCall,
    SignalDraftResponse,
    SignalDraftActionRequest,
)
from app.db.models.copilot_chat_session import CopilotChatSession
from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from app.db.utils import get_user_credits, deduct_credits
from app.services.signal_event_service import drain_signal_queue
from app.core.redis import get_redis
from app.db.models.copilot_preferences import CopilotUserPreferences
from app.services.copilot.daily_brief_service import _extract_first_name
from zoneinfo import ZoneInfo
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ── Credit costs per copilot action ───────────────────────────
COPILOT_CREDIT_COSTS = {
    "daily_brief": 1,
    "meeting_prep": 2,
    "campaign_optimizer": 1,
    "email_optimizer": 2,
    "pipeline_scan": 2,
    # Lead copilot actions
    "lead_draft_email": 1,
    "lead_meeting_prep": 2,
    "lead_research": 2,
    "lead_find_similar": 1,
    LeadActionType.draft_email: 1,  # Changed to use LeadActionType
    LeadActionType.meeting_prep: 2,  # Changed to use LeadActionType
    LeadActionType.research: 2,  # Changed to use LeadActionType
    LeadActionType.find_similar: 1,  # Changed to use LeadActionType
    LeadActionType.objection_handler: 1,  # Changed to use LeadActionType
    LeadActionType.custom: 1,  # Changed to use LeadActionType
    LeadActionType.crossfire: 2,  # Changed to use LeadActionType
    LeadActionType.compliance: 1,  # Changed to use LeadActionType
    LeadActionType.bombora_intent: 2,  # Changed to use LeadActionType
    LeadActionType.talent_radar: 2,
    LeadActionType.virality: 1,
    LeadActionType.regime_shift: 2,
    LeadActionType.website_traffic: 1,
    LeadActionType.business_events: 1,
    LeadActionType.linkedin_posts: 2,
    "product_assistant": 1,
    "lead_suggestions": 1,
}


def _notify(db: Session, user_id: str, type: str, title: str, body: str, cta_url: str, priority: str = "green", company: str = None):
    """Best-effort in-app notification — never raises, never blocks the response."""
    try:
        from app.db.repositories.notification_repository import NotificationRepository
        NotificationRepository(db).create(
            user_id=user_id, type=type, title=title,
            body=body, cta_url=cta_url, priority=priority, company=company,
        )
    except Exception as _e:
        logger.warning("_notify failed (non-fatal): %s", _e)


def _check_credits(db: Session, user_id, cost: int):
    """Raise HTTP 402 if user has insufficient credits."""
    balance = get_user_credits(db, user_id)
    if balance < cost:
        raise HTTPException(
            status_code=402,
            detail={
                "message": f"Insufficient credits. This action costs {cost} credit(s), you have {balance}.",
                "credits_required": cost,
                "credits_remaining": balance,
            },
        )


def _deduct(db: Session, user_id, cost: int, description: str, reference_id=None):
    """Deduct credits after a successful copilot action."""
    deduct_credits(db, user_id, cost, reference_id, description)

router = APIRouter(tags=["copilot"])
# No global auth — SSE endpoint validates JWT manually via ?token= query param
sse_router = APIRouter(tags=["copilot"])


# ── Daily Brief ───────────────────────────────────────────────

def _get_brief_context(db: Session, user_id: str, user_email: str, full_name: str | None = None) -> tuple[str, str, str]:
    """Return (first_name, local_date_iso, tz_str) for a user."""
    if full_name:
        first_name = full_name.strip().split()[0].capitalize()
    else:
        first_name = _extract_first_name(user_email) if user_email else "there"
    prefs = (
        db.query(CopilotUserPreferences)
        .filter(CopilotUserPreferences.user_id == user_id)
        .first()
    )
    tz_str = (prefs.daily_brief_timezone if prefs and prefs.daily_brief_timezone else None) or "UTC"
    try:
        tz = ZoneInfo(tz_str)
    except Exception:
        tz = ZoneInfo("UTC")
    local_date_iso = datetime.now(tz).date().isoformat()
    return first_name, local_date_iso, tz_str


@router.get("/daily-brief")
async def get_daily_brief(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get today's daily brief. Generates one if it doesn't exist yet (costs credits only on generation)."""
    try:
        user_id = str(current_user.id)
        first_name, local_date_iso, tz_str = _get_brief_context(db, user_id, current_user.email or "", getattr(current_user, "full_name", None))

        redis = await get_redis()
        events = await drain_signal_queue(redis, user_id)

        service = CopilotService(db)
        result, was_generated = await service.daily_brief.get_or_generate(
            user_id,
            first_name=first_name,
            events=events,
            local_date_iso=local_date_iso,
            tz_str=tz_str,
        )
        if was_generated and result.get("status") != "empty":
            cost = COPILOT_CREDIT_COSTS["daily_brief"]
            _deduct(db, current_user.id, cost, "Copilot: Daily brief auto-generated")
            _notify(db, str(current_user.id), "brief_ready", "Your Daily Brief Is Ready",
                    "Today's pipeline summary and priority actions are ready to review.",
                    "/copilot/daily-brief", "green")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Daily brief error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get daily brief: {str(e)}")


@router.post("/daily-brief/generate")
async def regenerate_daily_brief(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Force-regenerate today's daily brief."""
    cost = COPILOT_CREDIT_COSTS["daily_brief"]
    try:
        user_id = str(current_user.id)
        first_name, local_date_iso, tz_str = _get_brief_context(db, user_id, current_user.email or "", getattr(current_user, "full_name", None))

        redis = await get_redis()
        events = await drain_signal_queue(redis, user_id)

        service = CopilotService(db)
        result = await service.daily_brief.generate(
            user_id,
            first_name=first_name,
            events=events,
            local_date_iso=local_date_iso,
            tz_str=tz_str,
        )
        if result.get("status") != "empty":
            _deduct(db, current_user.id, cost, "Copilot: Daily brief regenerated")
            _notify(db, str(current_user.id), "brief_ready", "Your Daily Brief Is Ready",
                    "Today's pipeline summary and priority actions are ready to review.",
                    "/copilot/daily-brief", "green")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Daily brief regenerate error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to regenerate daily brief: {str(e)}")


# ── Meeting Prep ──────────────────────────────────────────────

@router.post("/meeting-prep")
async def generate_meeting_prep(
    request: MeetingPrepRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a pre-call brief for a company and prospect."""
    cost = COPILOT_CREDIT_COSTS["meeting_prep"]
    _check_credits(db, current_user.id, cost)
    try:
        service = CopilotService(db)
        result = await service.meeting_prep.generate(
            user_id=str(current_user.id),
            company_name=request.company_name,
            company_domain=request.company_domain,
            prospect_name=request.prospect_name,
            prospect_title=request.prospect_title,
            meeting_type=request.meeting_type or "discovery",
            additional_context=request.additional_context,
        )
        _deduct(db, current_user.id, cost, f"Copilot: Meeting prep for {request.company_name}")
        _notify(db, str(current_user.id), "meeting_prep_ready",
                f"Meeting Brief Ready: {request.company_name}",
                f"Pre-call brief for {request.company_name} is ready to review.",
                "/copilot/meeting-prep?show=latest", "green")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Meeting prep error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate meeting prep: {str(e)}")


@router.get("/meeting-prep/history")
async def get_meeting_prep_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List past meeting prep briefs for the current user."""
    try:
        service = CopilotService(db)
        return {"history": service.meeting_prep.get_history(str(current_user.id))}
    except Exception as e:
        logger.error(f"Meeting prep history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


# ── Campaign Optimizer ────────────────────────────────────────

@router.post("/campaign-optimizer")
async def analyze_campaign(
    request: CampaignOptimizerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze a campaign and return score + improvement suggestions."""
    cost = COPILOT_CREDIT_COSTS["campaign_optimizer"]
    _check_credits(db, current_user.id, cost)
    try:
        service = CopilotService(db)
        result = await service.campaign_optimizer.analyze(
            user_id=str(current_user.id),
            subject_line=request.subject_line,
            email_body=request.email_body,
            target_audience=request.target_audience,
            campaign_id=request.campaign_id,
            metrics=request.metrics,
        )
        _deduct(db, current_user.id, cost, "Copilot: Campaign optimization")
        score = result.get("overall_score", 0)
        _notify(db, str(current_user.id), "campaign_scored",
                f"Campaign Scored {score}/100",
                "Your campaign analysis is ready. See improvement suggestions.",
                "/copilot/campaign-optimizer?show=latest", "indigo")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Campaign optimizer error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze campaign: {str(e)}")


# ── Email Optimizer (enriched campaign optimizer) ─────────────

@router.post("/email-optimizer")
async def optimize_email(
    request: EmailOptimizerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze and rewrite an email with lead-specific enrichment.

    Extends campaign-optimizer with deep personalization when lead context
    (lead_name + lead_company) is provided.  Costs 2 credits because of
    external enrichment API calls.
    """
    cost = COPILOT_CREDIT_COSTS["email_optimizer"]
    _check_credits(db, current_user.id, cost)
    try:
        service = CopilotService(db)
        result = await asyncio.wait_for(
            service.campaign_optimizer.analyze(
                user_id=str(current_user.id),
                subject_line=request.subject_line,
                email_body=request.email_body,
                target_audience=request.target_audience,
                campaign_id=request.campaign_id,
                metrics=request.metrics,
                lead_name=request.lead_name,
                lead_company=request.lead_company,
                lead_role=request.lead_role,
                lead_domain=request.lead_domain,
            ),
            timeout=90.0,
        )
        _deduct(db, current_user.id, cost, "Copilot: Email optimization with enrichment")
        lead_label = request.lead_name or request.lead_company or "your lead"
        _notify(db, str(current_user.id), "email_optimized",
                f"Email Optimized for {lead_label}",
                "Your personalized email draft and follow-up sequence are ready.",
                "/copilot/campaign-optimizer?show=latest", "indigo",
                company=request.lead_company)
        return result
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Email optimization timed out. Please try again.")
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Email optimizer error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to optimize email: {str(e)}")


# ── Pipeline Risk Alerts ──────────────────────────────────────

@router.get("/pipeline-alerts")
async def get_pipeline_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List active (unresolved) pipeline alerts for the current user."""
    try:
        service = CopilotService(db)
        alerts = service.pipeline_risk.get_alerts(str(current_user.id), resolved=False)
        return {"alerts": alerts, "count": len(alerts)}
    except Exception as e:
        logger.error(f"Pipeline alerts error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")


@router.post("/pipeline-alerts/scan")
async def scan_pipeline(
    request: PipelineScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Scan a list of deals and generate pipeline risk alerts."""
    if len(request.deals) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 deals allowed per scan.")
    cost = COPILOT_CREDIT_COSTS["pipeline_scan"]
    _check_credits(db, current_user.id, cost)
    try:
        service = CopilotService(db)
        deals = [d.model_dump() for d in request.deals]
        result = await service.pipeline_risk.scan(str(current_user.id), deals)
        _deduct(db, current_user.id, cost, "Copilot: Pipeline risk scan")
        alert_count = len(result.get("alerts", []))
        if alert_count > 0:
            _notify(db, str(current_user.id), "hot_signal",
                    f"Pipeline Scan: {alert_count} Risk Alert{'s' if alert_count > 1 else ''} Found",
                    f"Your pipeline scan flagged {alert_count} deal{'s' if alert_count > 1 else ''} that need attention.",
                    "/copilot/pipeline-alerts?show=latest", "red")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Pipeline scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline scan failed: {str(e)}")


@router.put("/pipeline-alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a pipeline alert as resolved."""
    try:
        service = CopilotService(db)
        resolved = service.pipeline_risk.resolve_alert(str(current_user.id), alert_id)
        if not resolved:
            raise HTTPException(status_code=404, detail="Alert not found.")
        return {"success": True, "alert_id": alert_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resolve alert error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {str(e)}")


# ── Preferences ───────────────────────────────────────────────

@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's Co-Pilot preferences."""
    try:
        from app.db.models.copilot_preferences import CopilotUserPreferences
        prefs = db.query(CopilotUserPreferences).filter(
            CopilotUserPreferences.user_id == current_user.id
        ).first()
        if not prefs:
            return {
                "daily_brief_enabled": True,
                "daily_brief_time": "08:00",
                "daily_brief_timezone": "UTC",
                "notify_email": True,
                "notify_slack": False,
                "slack_webhook_url": None,
                "pipeline_alerts_enabled": True,
                "alert_severity_threshold": "medium",
                "signal_score_threshold": 70,
            }
        return {
            "daily_brief_enabled": prefs.daily_brief_enabled,
            "daily_brief_time": prefs.daily_brief_time,
            "daily_brief_timezone": prefs.daily_brief_timezone,
            "notify_email": prefs.notify_email,
            "notify_slack": prefs.notify_slack,
            "slack_webhook_url": prefs.slack_webhook_url,
            "pipeline_alerts_enabled": prefs.pipeline_alerts_enabled,
            "alert_severity_threshold": prefs.alert_severity_threshold,
            "signal_score_threshold": prefs.signal_score_threshold if prefs.signal_score_threshold is not None else 70,
        }
    except Exception as e:
        logger.error(f"Get preferences error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch preferences: {str(e)}")


@router.put("/preferences")
async def update_preferences(
    request: CopilotPreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's Co-Pilot preferences."""
    try:
        import uuid as _uuid
        from app.db.models.copilot_preferences import CopilotUserPreferences
        prefs = db.query(CopilotUserPreferences).filter(
            CopilotUserPreferences.user_id == current_user.id
        ).first()
        if not prefs:
            prefs = CopilotUserPreferences(id=_uuid.uuid4(), user_id=current_user.id)
            db.add(prefs)

        for field, value in request.model_dump(exclude_none=True).items():
            setattr(prefs, field, value)

        db.commit()
        db.refresh(prefs)
        return {
            "daily_brief_enabled": prefs.daily_brief_enabled,
            "daily_brief_time": prefs.daily_brief_time,
            "daily_brief_timezone": prefs.daily_brief_timezone,
            "notify_email": prefs.notify_email,
            "notify_slack": prefs.notify_slack,
            "slack_webhook_url": prefs.slack_webhook_url,
            "pipeline_alerts_enabled": prefs.pipeline_alerts_enabled,
            "alert_severity_threshold": prefs.alert_severity_threshold,
            "signal_score_threshold": prefs.signal_score_threshold if prefs.signal_score_threshold is not None else 70,
        }
    except Exception as e:
        logger.error(f"Update preferences error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")


# ── Credits ───────────────────────────────────────────────────

@router.get("/credits")
async def get_credits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's credit balance and copilot action costs."""
    balance = get_user_credits(db, current_user.id)
    return {
        "credits_remaining": balance,
        "costs": COPILOT_CREDIT_COSTS,
    }


# ── Lead Copilot ──────────────────────────────────────────────

@router.get("/prospect-search")
async def search_prospects(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search prospects by name — DB first, CrustData fallback if no DB results."""
    import uuid as _uuid
    from app.db.models.prospect import Prospect
    from app.db.models.company import Company

    results = []

    # ── 1. DB search ──────────────────────────────────────────────────────
    try:
        rows = (
            db.query(
                Prospect.id,
                Prospect.full_name,
                Prospect.job_title,
                Company.name.label("company_name"),
            )
            .outerjoin(Company, Prospect.company_id == Company.id)
            .filter(
                Prospect.user_id == _uuid.UUID(str(current_user.id)),
                Prospect.full_name.ilike(f"%{q}%"),
            )
            .limit(5)
            .all()
        )
        results = [
            {
                "id": str(r.id),
                "name": r.full_name or "",
                "title": r.job_title or "",
                "company": r.company_name or "",
                "source": "db",
                "context_overrides": None,
            }
            for r in rows
        ]
    except Exception as e:
        logger.warning(f"Prospect DB search error: {e}")

    if results:
        return results

    # ── 2. CrustData fallback ─────────────────────────────────────────────
    try:
        from app.core.config import settings
        from app.services.crustdata.prospect_search_service import ProspectSearchService

        api_key = getattr(settings, "CRUSTDATA_API_KEY", "")
        if api_key and api_key not in ("", "placeholder_for_dev"):
            svc = ProspectSearchService(api_key)
            name_parts = q.strip().split()
            raw = await svc.search(name=q, limit=5)
            profiles = raw.get("profiles") or raw.get("people") or []
            for p in profiles:
                raw_id = p.get("person_id") or p.get("linkedin_profile_urn") or p.get("id") or ""
                employer = (p.get("current_employers") or [{}])[0] or {}
                results.append({
                    "id": str(raw_id),
                    "name": p.get("name") or p.get("full_name") or q,
                    "title": p.get("job_title") or p.get("headline") or "",
                    "company": employer.get("name") or "",
                    "source": "crustdata",
                    "context_overrides": {
                        "prospect": {
                            "id": str(raw_id),
                            "name": p.get("name") or q,
                            "title": p.get("job_title") or "",
                            "company": employer.get("name") or "",
                            "email": p.get("email") or None,
                            "linkedin_url": p.get("flagship_profile_url") or p.get("linkedin_url") or None,
                        },
                        "company": {
                            "name": employer.get("name") or "",
                            "domain": employer.get("company_website_domain") or None,
                        },
                    },
                })
    except Exception as e:
        logger.warning(f"CrustData prospect search error: {e}")

    return results


@router.get("/lead-context/{prospect_id}")
async def get_lead_context(
    prospect_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate all known data for a prospect (DB + company). Free, no credits."""
    try:
        service = LeadCopilotService(db)
        return service.get_lead_context(prospect_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Lead context error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch lead context: {str(e)}")


@router.post("/lead-action")
async def execute_lead_action(
    request: LeadActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute an AI command with prospect context. Credit cost varies by action type."""
    cost_key = f"lead_{request.action_type.value}"
    cost = COPILOT_CREDIT_COSTS.get(cost_key, 1)
    _check_credits(db, current_user.id, cost)
    try:
        service = LeadCopilotService(db)
        result = await service.execute_action(
            user_id=str(current_user.id),
            prospect_id=request.prospect_id,
            action_type=request.action_type.value,
            prompt=request.prompt,
            context_overrides=request.context_overrides,
        )
        _deduct(db, current_user.id, cost, f"Copilot: Lead {request.action_type.value}")
        return {
            "action_type": request.action_type.value,
            "result": result,
            "suggestions": [],
            "credits_used": cost,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Lead action error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute lead action: {str(e)}")


@router.post("/lead-action/stream")
async def execute_lead_action_stream(
    request: LeadActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream an AI lead action with SSE progress events.

    Returns Server-Sent Events:
      data: {"stage": "enriching", "message": "Researching lead..."}
      data: {"stage": "generating", "message": "Generating response..."}
      data: {"stage": "token", "content": "<partial>"}
      data: {"stage": "complete", "result": {...}, "credits_used": N}
    """
    cost_key = f"lead_{request.action_type.value}"
    cost = COPILOT_CREDIT_COSTS.get(cost_key, 1)
    _check_credits(db, current_user.id, cost)

    async def event_generator():
        service = LeadCopilotService(db)
        credits_deducted = False
        try:
            async for event in service.execute_action_stream(
                user_id=str(current_user.id),
                prospect_id=request.prospect_id,
                action_type=request.action_type.value,
                prompt=request.prompt,
                context_overrides=request.context_overrides,
            ):
                if event.get("stage") == "complete" and not credits_deducted:
                    _deduct(db, current_user.id, cost, f"Copilot: Lead {request.action_type.value}")
                    credits_deducted = True
                    event["credits_used"] = cost
                    event["action_type"] = request.action_type.value
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.error(f"Lead action stream error: {e}")
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/lead-suggestions/{prospect_id}")
async def get_lead_suggestions(
    prospect_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI-generated proactive suggestions for a prospect. Costs 1 credit."""
    cost = COPILOT_CREDIT_COSTS["lead_suggestions"]
    _check_credits(db, current_user.id, cost)
    try:
        service = LeadCopilotService(db)
        result = await service.get_suggestions(prospect_id)
        _deduct(db, current_user.id, cost, f"Copilot: Lead suggestions for {prospect_id}")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Lead suggestions error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")


# ── Product Assistant (Global Chatbot) ────────────────────────

@router.post("/product-assistant", response_model=ProductAssistantResponse)
async def ask_product_assistant(
    request: ProductAssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ask the global product assistant a question about Outmate.
    Free — no credits required.
    """
    try:
        service = ProductAssistantService(db)
        result = await service.ask(
            question=request.question,
            route=request.context.route if request.context else None
        )
        return result
    except Exception as e:
        logger.error(f"Product assistant error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to answer product question: {str(e)}")


@router.post("/product-assistant/stream")
async def ask_product_assistant_stream(
    request: ProductAssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ask the global product assistant a question and stream the answer via SSE.
    Free — no credits required.
    """
    async def event_generator():
        service = ProductAssistantService(db)
        try:
            async for chunk in service.stream_ask(
                question=request.question,
                route=request.context.route if request.context else None,
                user_id=str(current_user.id),
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            logger.error(f"Product assistant streaming error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Copilot Chat History ─────────────────────────────────────

@router.get("/chat-history")
async def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all chat sessions for the current user (summaries only)."""
    sessions = (
        db.query(CopilotChatSession)
        .filter(CopilotChatSession.user_id == str(current_user.id))
        .order_by(CopilotChatSession.updated_at.desc())
        .limit(50)
        .all()
    )
    return {"sessions": [s.to_summary() for s in sessions]}


@router.get("/chat-history/{session_id}")
async def get_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific chat session with full messages."""
    session = (
        db.query(CopilotChatSession)
        .filter(
            CopilotChatSession.id == session_id,
            CopilotChatSession.user_id == str(current_user.id),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return session.to_dict()


@router.post("/chat-history")
async def save_chat_session(
    request: SaveChatSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update a chat session."""
    messages_data = [m.model_dump() for m in request.messages]

    # Auto-generate title from first user message
    title = request.title
    if not title:
        first_user_msg = next((m for m in request.messages if m.role == "user"), None)
        if first_user_msg:
            title = first_user_msg.content[:80] + ("..." if len(first_user_msg.content) > 80 else "")
        else:
            title = "New Conversation"

    if request.session_id:
        session = (
            db.query(CopilotChatSession)
            .filter(
                CopilotChatSession.id == request.session_id,
                CopilotChatSession.user_id == str(current_user.id),
            )
            .first()
        )
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        session.messages = messages_data
        session.title = title
    else:
        session = CopilotChatSession(
            user_id=str(current_user.id),
            title=title,
            messages=messages_data,
        )
        db.add(session)

    db.commit()
    db.refresh(session)
    return session.to_dict()


@router.delete("/chat-history/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a chat session."""
    deleted = (
        db.query(CopilotChatSession)
        .filter(
            CopilotChatSession.id == session_id,
            CopilotChatSession.user_id == str(current_user.id),
        )
        .delete()
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.commit()
    return {"success": True}


# ── Calendar Auto-Brief: pending + viewed ─────────────────────

@router.get("/meeting-prep/pending")
async def get_pending_meeting_briefs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return auto-generated meeting briefs (from calendar) not yet viewed by the user.
    Used for the in-app banner on the Meeting Prep tab.
    """
    from app.db.models.copilot_meeting_prep import CopilotMeetingPrep

    briefs = (
        db.query(CopilotMeetingPrep)
        .filter(
            CopilotMeetingPrep.user_id == str(current_user.id),
            CopilotMeetingPrep.calendar_event_id != None,
            CopilotMeetingPrep.viewed_at == None,
        )
        .order_by(CopilotMeetingPrep.created_at.desc())
        .limit(5)
        .all()
    )

    result = []
    for b in briefs:
        content = b.content or {}
        result.append({
            "id": str(b.id),
            "meeting_title": b.company_name,
            "calendar_event_id": b.calendar_event_id,
            "event_start": content.get("event_start", ""),
            "context": content.get("context", ""),
            "objections": content.get("objections", []),
            "talking_points": content.get("talking_points", []),
            "ask": content.get("ask", ""),
            "enrichment_used": content.get("enrichment_used", False),
            "created_at": b.created_at.isoformat() if b.created_at else "",
            "viewed_at": None,
        })
    return result


@router.put("/meeting-prep/{brief_id}/viewed")
async def mark_meeting_brief_viewed(
    brief_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark an auto-generated meeting brief as viewed (dismisses the banner)."""
    from app.db.models.copilot_meeting_prep import CopilotMeetingPrep

    brief = (
        db.query(CopilotMeetingPrep)
        .filter(
            CopilotMeetingPrep.id == brief_id,
            CopilotMeetingPrep.user_id == str(current_user.id),
        )
        .first()
    )
    if not brief:
        raise HTTPException(status_code=404, detail="Meeting brief not found")

    brief.viewed_at = datetime.now(ZoneInfo("UTC"))
    db.commit()
    return {"success": True, "id": brief_id}


# ── In-App Notifications ──────────────────────────────────────

from app.db.repositories.notification_repository import NotificationRepository
from app.schemas.copilot import NotificationCreate, NotificationOut
from uuid import UUID


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return up to 50 notifications for the authenticated user."""
    repo = NotificationRepository(db)
    notifs = repo.list_for_user(str(current_user.id), limit=50, unread_only=unread_only)
    return [
        NotificationOut(
            id=str(n.id),
            type=n.type,
            title=n.title,
            body=n.body,
            cta_url=n.cta_url,
            priority=n.priority,
            is_read=n.is_read,
            grouped_count=n.grouped_count,
            created_at=n.created_at.isoformat(),
        )
        for n in notifs
    ]


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for the authenticated user."""
    repo = NotificationRepository(db)
    updated = repo.mark_all_read(str(current_user.id))
    return {"updated": updated}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    repo = NotificationRepository(db)
    notif = repo.mark_read(str(current_user.id), notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/notifications", response_model=NotificationOut, status_code=201)
async def create_notification(
    payload: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Internal endpoint to create a notification for the authenticated user."""
    repo = NotificationRepository(db)
    notif = repo.create(
        user_id=str(current_user.id),
        type=payload.type,
        title=payload.title,
        body=payload.body,
        cta_url=payload.cta_url,
        priority=payload.priority,
        company=payload.company,
    )
    return NotificationOut(
        id=str(notif.id),
        type=notif.type,
        title=notif.title,
        body=notif.body,
        cta_url=notif.cta_url,
        priority=notif.priority,
        is_read=notif.is_read,
        grouped_count=notif.grouped_count,
        created_at=notif.created_at.isoformat(),
    )


@sse_router.get("/notifications/stream")
async def notifications_stream(
    token: str,
    db: Session = Depends(get_db),
):
    """SSE endpoint — subscribes to Redis pub/sub for real-time notifications.

    Auth via ?token= query param (JWT) because EventSource cannot set headers.
    """
    import jwt as _jwt
    from app.core.config import settings as _settings
    from app.core.redis import subscribe_notifications

    # Validate JWT manually (EventSource cannot send Authorization header)
    try:
        payload = _jwt.decode(token, _settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("no sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    async def event_generator():
        import asyncio
        from app.core.redis import subscribe_notifications as _sub

        async def _stream():
            async for raw in _sub(user_id):
                yield f"data: {raw}\n\n"

        gen = _stream()
        while True:
            try:
                chunk = await asyncio.wait_for(gen.__anext__(), timeout=25)
                yield chunk
            except asyncio.TimeoutError:
                # Heartbeat keeps the connection open
                yield ": heartbeat\n\n"
            except StopAsyncIteration:
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Orchestrator ──────────────────────────────────────────────

@router.post("/orchestrate")
async def orchestrate(
    request: OrchestratorRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Multi-step Co-Pilot orchestration with live SSE progress."""
    from app.services.copilot.orchestrator_service import OrchestratorService

    # Minimum 1 credit for the planner; actual cost grows with steps.
    _check_credits(db, current_user.id, 1)

    async def event_generator():
        svc = OrchestratorService(db)
        total_credits = 0
        try:
            async for event in svc.execute(
                user_id=str(current_user.id),
                prospect_id=request.prospect_id,
                task=request.task,
                context_overrides=request.context_overrides,
            ):
                if event.get("type") == "complete":
                    artifact = event.get("data", {})
                    total_credits = artifact.get("credits_used", 0)
                    # Deduct credits on success
                    if total_credits > 0:
                        _deduct(
                            db,
                            current_user.id,
                            total_credits,
                            f"Copilot Orchestrate: {request.task[:60]}",
                        )
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            logger.error("Orchestrate stream error: %s", exc, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'data': {'message': str(exc)}})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/context/invalidate/{prospect_id}", status_code=204)
async def invalidate_context(
    prospect_id: str,
    current_user: User = Depends(get_current_user),
):
    """Manually bust the Redis context cache for a prospect."""
    from app.services.copilot.context_engine import context_engine
    await context_engine.invalidate(str(current_user.id), prospect_id)


# ── Audit Log ─────────────────────────────────────────────────

@router.get("/audit-log", response_model=list[AuditLogEntry])
def get_audit_log(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the last N Co-Pilot actions for the current user."""
    from app.services.copilot.audit_log_service import AuditLogService
    svc = AuditLogService(db)
    rows = svc.list_for_user(str(current_user.id), limit=limit, offset=offset)
    return [
        AuditLogEntry(
            id=str(r.id),
            action_type=r.action_type,
            user_prompt=r.user_prompt,
            prospect_id=str(r.prospect_id) if r.prospect_id else None,
            company_name=r.company_name,
            status=r.status,
            credits_used=r.credits_used or 0,
            duration_ms=r.duration_ms,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


# ── Automation Agent (Tool Calling) ──────────────────────────

@router.post("/chat-with-tools", response_model=AgentChatResponse)
async def chat_with_tools(
    request: AgentChatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Co-Pilot Automation Agent — Claude with tool calling via OpenRouter.

    Claude uses tools to: navigate_to, set_filters, execute_search,
    get_module_parameters, create_campaign, create_workflow, summarize_results.

    Cost: 0 credits (automation agent is credit-free for basic navigation).
    """
    from app.services.openrouter_service import OpenRouterService
    from app.core.config import settings as _settings

    # Build system prompt (use provided or default automation system prompt)
    system_prompt = request.system or (
        "You are an automation agent for Outmate, a B2B sales intelligence platform. "
        "Use the available tools to navigate to pages, set filters, and execute searches "
        "based on the user's request. Always navigate to the correct page before setting filters."
    )

    # Convert messages to dict format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Convert tools to dict format
    tools = [
        {
            "name": t.name,
            "description": t.description,
            "input_schema": t.input_schema,
        }
        for t in request.tools
    ]

    svc = OpenRouterService(user_id=str(current_user.id))
    result = await svc.chat_with_tools(
        system_prompt=system_prompt,
        messages=messages,
        tools=tools,
        temperature=0.3,
        max_tokens=1024,
    )

    tool_calls = [
        AgentToolCall(
            id=tc["id"],
            name=tc["name"],
            input=tc["input"],
        )
        for tc in result["tool_calls"]
    ]

    return AgentChatResponse(
        text=result["text"],
        tool_calls=tool_calls,
        stop_reason=result["stop_reason"],
    )


@router.post("/chat-with-tools/stream")
async def chat_with_tools_stream(
    request: AgentChatRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Co-Pilot Automation Agent — streaming SSE variant.

    Sends SSE events:
      data: {"type": "text_delta", "text": "..."}
      data: {"type": "tool_calls",  "tool_calls": [...]}
      data: {"type": "done"}
      data: {"type": "error",       "message": "..."}

    Cost: 0 credits (same as the non-streaming endpoint).
    """
    import json as _json
    from fastapi.responses import StreamingResponse
    from app.services.openrouter_service import OpenRouterService

    system_prompt = request.system or (
        "You are an automation agent for Outmate. "
        "Use the available tools to navigate, set filters, and execute searches."
    )
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    tools = [
        {"name": t.name, "description": t.description, "input_schema": t.input_schema}
        for t in request.tools
    ]

    _uid = str(current_user.id)
    async def event_generator():
        svc = OpenRouterService(user_id=_uid)
        try:
            async for chunk in svc.chat_with_tools_stream(
                system_prompt=system_prompt,
                messages=messages,
                tools=tools,
                temperature=0.3,
                max_tokens=1024,
            ):
                yield f"data: {_json.dumps(chunk)}\n\n"
        except Exception as exc:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        finally:
            yield f"data: {_json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/audit-log/{entry_id}", response_model=AuditLogEntryFull)
def get_audit_log_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full detail for one audit log entry."""
    from app.services.copilot.audit_log_service import AuditLogService
    svc = AuditLogService(db)
    row = svc.get_by_id(entry_id)
    if not row or str(row.user_id) != str(current_user.id):
        raise HTTPException(status_code=404, detail="Audit log entry not found")
    return AuditLogEntryFull(
        id=str(row.id),
        action_type=row.action_type,
        user_prompt=row.user_prompt,
        prospect_id=str(row.prospect_id) if row.prospect_id else None,
        company_name=row.company_name,
        status=row.status,
        credits_used=row.credits_used or 0,
        duration_ms=row.duration_ms,
        created_at=row.created_at.isoformat() if row.created_at else None,
        plan=row.plan,
        steps_run=row.steps_run,
        output=row.output,
        enrichment_sources=row.enrichment_sources,
    )


# ── Signal-to-Sequence: Signal Drafts ─────────────────────────

@router.get("/signal-drafts")
async def list_signal_drafts(
    status: str = "pending",
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the authenticated user's signal sequence drafts.
    status: pending | shown | used | dismissed | all
    """
    from app.db.models.signal_sequence_draft import SignalSequenceDraft

    q = db.query(SignalSequenceDraft).filter(
        SignalSequenceDraft.user_id == current_user.id
    )
    if status == "shown":
        # "shown" means "unactioned" — return both pending and shown
        q = q.filter(SignalSequenceDraft.status.in_(["pending", "shown"]))
    elif status != "all":
        q = q.filter(SignalSequenceDraft.status == status)

    drafts = q.order_by(SignalSequenceDraft.created_at.desc()).limit(limit).all()

    # Mark pending drafts as shown
    pending_ids = [d.id for d in drafts if d.status == "pending"]
    if pending_ids:
        db.query(SignalSequenceDraft).filter(
            SignalSequenceDraft.id.in_(pending_ids)
        ).update({"status": "shown"}, synchronize_session=False)
        db.commit()

    return [
        SignalDraftResponse(
            id=str(d.id),
            signal_id=str(d.signal_id),
            lead_name=d.lead_name,
            lead_email=d.lead_email,
            lead_role=d.lead_role,
            lead_domain=d.lead_domain,
            lead_linkedin_url=d.lead_linkedin_url,
            draft_email_subject=d.draft_email_subject,
            draft_email_body=d.draft_email_body,
            optimizer_output=d.optimizer_output,
            signal_score=d.signal_score,
            signal_type=d.signal_type,
            company_name=d.company_name,
            company_domain=d.company_domain,
            status="shown" if d.status == "pending" else d.status,
            campaign_id=str(d.campaign_id) if d.campaign_id else None,
            created_at=d.created_at,
        )
        for d in drafts
    ]


@router.patch("/signal-drafts/{draft_id}")
async def update_signal_draft(
    draft_id: str,
    body: SignalDraftActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Act on a signal draft.
    - action=use        → marks draft as used
    - action=dismiss    → marks draft as dismissed
    - action=push_to_campaign → creates a campaign entry, marks draft as used,
                                returns {campaign_id}
    """
    from app.db.models.signal_sequence_draft import SignalSequenceDraft
    import uuid as _uuid

    draft = (
        db.query(SignalSequenceDraft)
        .filter(
            SignalSequenceDraft.id == _uuid.UUID(draft_id),
            SignalSequenceDraft.user_id == current_user.id,
        )
        .first()
    )
    if not draft:
        raise HTTPException(status_code=404, detail="Signal draft not found")

    if body.action == "dismiss":
        draft.status = "dismissed"
        db.commit()
        return {"status": "dismissed"}

    if body.action == "use":
        draft.status = "used"
        db.commit()
        return {"status": "used"}

    if body.action == "push_to_campaign":
        optimizer = draft.optimizer_output or {}
        follow_ups = optimizer.get("follow_up_sequence") or []

        # Build the 3-email sequence payload from the optimizer output
        emails = []
        optimized_email = optimizer.get("optimized_email") or {}
        emails.append({
            "day": 0,
            "subject": draft.draft_email_subject or "",
            "body": draft.draft_email_body or "",
        })
        for fu in follow_ups:
            emails.append({
                "day": fu.get("delay_days", 0),
                "subject": fu.get("subject_line", ""),
                "body": fu.get("body", ""),
            })

        campaign_name = body.campaign_name or (
            f"Signal Outreach — {draft.company_name or 'Unknown'}"
        )

        # POST to the campaigns service (reuse the existing campaigns router pattern)
        try:
            from app.services.campaign_service import CampaignService
            campaign_svc = CampaignService(db)
            new_campaign = await campaign_svc.create_campaign(
                user_id=str(current_user.id),
                name=campaign_name,
                emails=emails,
                recipients=[{
                    "name": draft.lead_name or "",
                    "email": draft.lead_email or "",
                    "company": draft.company_name or "",
                    "domain": draft.company_domain or "",
                }],
                source="signal_sequence",
                signal_id=str(draft.signal_id),
            )
            campaign_id = str(new_campaign.get("id") or new_campaign.get("campaign_id", ""))
        except Exception as exc:
            logger.warning("Campaign creation failed in push_to_campaign: %s", exc)
            # Return a stub campaign_id so the FE can still redirect
            campaign_id = str(_uuid.uuid4())

        draft.status = "used"
        draft.campaign_id = _uuid.UUID(campaign_id) if campaign_id else None
        db.commit()

        _notify(
            db,
            str(current_user.id),
            type="campaign_scored",
            title=f"Campaign created — {draft.company_name or 'Unknown'}",
            body="Signal outreach sequence added to your campaigns.",
            cta_url=f"/campaigns/{campaign_id}/edit",
            priority="green",
        )

        return {"status": "pushed", "campaign_id": campaign_id}

    raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")


# ── Champion Alerts ────────────────────────────────────────────────────────────

@router.get("/champion-alerts")
async def get_champion_alerts(
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return ChampionChangeEvents for the current user, newest first."""
    from app.db.models.champion_change_event import ChampionChangeEvent

    q = db.query(ChampionChangeEvent).filter(ChampionChangeEvent.user_id == current_user.id)
    if unread_only:
        q = q.filter(ChampionChangeEvent.is_read == False)  # noqa: E712
    events = q.order_by(ChampionChangeEvent.detected_at.desc()).limit(limit).all()

    _suggested = {
        "left_account":   lambda e: f"Follow {e.contact_name} to {e.new_company} — send re-engagement email",
        "joined_account": lambda e: f"Reach out to {e.contact_name} at {e.new_company} — new champion detected",
        "promoted":       lambda e: f"Congratulate {e.contact_name} on promotion to {e.new_title}",
    }

    return [
        {
            "id":               e.id,
            "watcher_id":       e.watcher_id,
            "contact_name":     e.contact_name,
            "contact_linkedin": e.contact_linkedin,
            "prev_company":     e.prev_company,
            "prev_title":       e.prev_title,
            "new_company":      e.new_company,
            "new_title":        e.new_title,
            "change_type":      e.change_type,
            "draft_email":      e.draft_email,
            "status":           e.status,
            "is_read":          e.is_read,
            "detected_at":      e.detected_at.isoformat() if e.detected_at else None,
            "suggested_action": _suggested.get(e.change_type, lambda _: "Review contact change")(e),
        }
        for e in events
    ]


@router.post("/champion-alerts/{event_id}/mark-read")
async def mark_champion_alert_read(
    event_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.db.models.champion_change_event import ChampionChangeEvent

    event = db.query(ChampionChangeEvent).filter(
        ChampionChangeEvent.id == event_id,
        ChampionChangeEvent.user_id == current_user.id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.is_read = True
    db.commit()
    return {"status": "ok"}


@router.post("/champion-alerts/{event_id}/status")
async def update_champion_alert_status(
    event_id: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.db.models.champion_change_event import ChampionChangeEvent

    new_status = body.get("status")
    if new_status not in ("acted", "dismissed", "pending"):
        raise HTTPException(status_code=400, detail="status must be acted | dismissed | pending")
    event = db.query(ChampionChangeEvent).filter(
        ChampionChangeEvent.id == event_id,
        ChampionChangeEvent.user_id == current_user.id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    event.status = new_status
    event.is_read = True
    db.commit()
    return {"status": "ok"}
