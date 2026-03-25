"""
Co-Pilot API Routes — Daily Brief, Meeting Prep, Campaign Optimizer, Pipeline Risk Alert.
"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json
import logging

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
)
from app.db.models.copilot_chat_session import CopilotChatSession
from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from app.db.utils import get_user_credits, deduct_credits
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


# ── Daily Brief ───────────────────────────────────────────────

@router.get("/daily-brief")
async def get_daily_brief(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get today's daily brief. Generates one if it doesn't exist yet (costs credits only on generation)."""
    try:
        service = CopilotService(db)
        result, was_generated = await service.daily_brief.get_or_generate(str(current_user.id))
        if was_generated:
            cost = COPILOT_CREDIT_COSTS["daily_brief"]
            _deduct(db, current_user.id, cost, "Copilot: Daily brief auto-generated")
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
    _check_credits(db, current_user.id, cost)
    try:
        service = CopilotService(db)
        result = await service.daily_brief.generate(str(current_user.id))
        _deduct(db, current_user.id, cost, "Copilot: Daily brief regenerated")
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
        return {"success": True}
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
                route=request.context.route if request.context else None
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
