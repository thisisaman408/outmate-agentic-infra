"""
Co-Pilot API Routes — Daily Brief, Meeting Prep, Campaign Optimizer, Pipeline Risk Alert.
"""

from fastapi import APIRouter, HTTPException, Depends
import logging

from app.services.copilot.copilot_service import CopilotService
from app.schemas.copilot import (
    MeetingPrepRequest,
    CampaignOptimizerRequest,
    PipelineScanRequest,
    CopilotPreferencesRequest,
)
from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["copilot"])


# ── Daily Brief ───────────────────────────────────────────────

@router.get("/daily-brief")
async def get_daily_brief(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get today's daily brief. Generates one if it doesn't exist yet."""
    try:
        service = CopilotService(db)
        return await service.daily_brief.get_or_generate(str(current_user.id))
    except Exception as e:
        logger.error(f"Daily brief error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get daily brief: {str(e)}")


@router.post("/daily-brief/generate")
async def regenerate_daily_brief(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Force-regenerate today's daily brief."""
    try:
        service = CopilotService(db)
        return await service.daily_brief.generate(str(current_user.id))
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
    try:
        service = CopilotService(db)
        return await service.meeting_prep.generate(
            user_id=str(current_user.id),
            company_name=request.company_name,
            company_domain=request.company_domain,
            prospect_name=request.prospect_name,
            prospect_title=request.prospect_title,
            meeting_type=request.meeting_type or "discovery",
            additional_context=request.additional_context,
        )
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
    try:
        service = CopilotService(db)
        return await service.campaign_optimizer.analyze(
            user_id=str(current_user.id),
            subject_line=request.subject_line,
            email_body=request.email_body,
            target_audience=request.target_audience,
            campaign_id=request.campaign_id,
            metrics=request.metrics,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Campaign optimizer error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze campaign: {str(e)}")


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
    try:
        service = CopilotService(db)
        deals = [d.model_dump() for d in request.deals]
        return await service.pipeline_risk.scan(str(current_user.id), deals)
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
