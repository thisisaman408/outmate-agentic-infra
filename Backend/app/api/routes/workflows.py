"""Workflow CRUD routes.

All endpoints enforce tenant isolation by filtering on ``user_id``.
Prefix: ``/api/v1/workflows``
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from app.db.models.workflow import Workflow, WorkflowExecution
from app.db.utils import deduct_credits, check_sufficient_credits

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class WorkflowCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    trigger_type: str = Field(..., pattern="^(event_triggered|time_triggered|manual)$")
    target_object: str = Field(..., pattern="^(People|Companies)$")
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)
    owner_name: Optional[str] = None
    folder: Optional[str] = None


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    trigger_type: Optional[str] = Field(None, pattern="^(event_triggered|time_triggered|manual)$")
    target_object: Optional[str] = Field(None, pattern="^(People|Companies)$")
    nodes: Optional[List[Dict[str, Any]]] = None
    settings: Optional[Dict[str, Any]] = None
    owner_name: Optional[str] = None
    folder: Optional[str] = None


class WorkflowRunInput(BaseModel):
    input_data: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Hardcoded workflow templates
# ---------------------------------------------------------------------------

WORKFLOW_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "ai-outbound",
        "name": "AI-Powered Outbound Prospecting",
        "description": "Find and engage AI-ready companies with intelligent multi-step outreach",
        "tags": ["AI", "Outbound", "Enrichment"],
        "nodes": ["Signal Engine", "Waterfall Enrich", "AI Score", "Email Sequence"],
        "stats": {"leads_per_month": "120–300", "conv_rate": "8–14%", "use_case": "Outbound SDR"},
        "category": "Outbound",
    },
    {
        "id": "inbound-enrich",
        "name": "Inbound Lead Auto-Enrichment",
        "description": "Auto-enrich inbound leads and push scored contacts to CRM instantly",
        "tags": ["Inbound", "Enrichment", "CRM"],
        "nodes": ["Form Trigger", "Enrich Data", "ICP Match", "CRM Sync"],
        "stats": {"leads_per_month": "50–150", "conv_rate": "18–25%", "use_case": "Inbound Ops"},
        "category": "Inbound",
    },
    {
        "id": "visitor-intent",
        "name": "Website Visitor Intent Capture",
        "description": "Identify anonymous website visitors and trigger real-time outreach sequences",
        "tags": ["Signal", "Enrichment", "Outbound"],
        "nodes": ["Visitor ID", "De-anonymize", "Enrich", "Score", "Sequence"],
        "stats": {"leads_per_month": "200–500", "conv_rate": "5–10%", "use_case": "Demand Gen"},
        "category": "Signal-Based",
    },
    {
        "id": "multi-channel",
        "name": "Multi-Channel Engagement Engine",
        "description": "Orchestrate email, LinkedIn, and voice across a single unified workflow",
        "tags": ["Multi-Channel", "AI", "Email", "LinkedIn", "Voice"],
        "nodes": ["Trigger", "Email", "Wait", "LinkedIn", "Voice AI"],
        "stats": {"leads_per_month": "80–200", "conv_rate": "12–20%", "use_case": "Full-Cycle AE"},
        "category": "Multi-Channel",
    },
    {
        "id": "lead-scoring",
        "name": "AI Lead Scoring Pipeline",
        "description": "Score every lead with AI-powered ICP matching and route to the right rep",
        "tags": ["AI", "Scoring", "CRM"],
        "nodes": ["Data Intake", "AI Score", "Route", "CRM Push"],
        "stats": {"leads_per_month": "500–2000", "conv_rate": "15–22%", "use_case": "RevOps"},
        "category": "Scoring & Routing",
    },
    {
        "id": "hiring-signal",
        "name": "Hiring Signal Outreach",
        "description": "Detect hiring signals and auto-trigger personalized outbound to growing teams",
        "tags": ["Signal", "AI", "Outbound"],
        "nodes": ["Hiring Monitor", "Enrich", "AI Research", "Personalize", "Sequence"],
        "stats": {"leads_per_month": "50–150", "conv_rate": "10–18%", "use_case": "Signal SDR"},
        "category": "Signal-Based",
    },
    {
        "id": "funding-alert",
        "name": "Funding Round Alert Pipeline",
        "description": "Catch funding rounds and auto-qualify companies for immediate outreach",
        "tags": ["Signal", "Enrichment", "Outbound"],
        "nodes": ["Funding Monitor", "Company Enrich", "ICP Filter", "Assign AE", "Alert"],
        "stats": {"leads_per_month": "30–80", "conv_rate": "12–20%", "use_case": "Enterprise SDR"},
        "category": "Signal-Based",
    },
    {
        "id": "tech-stack-monitor",
        "name": "Tech Stack Change Monitor",
        "description": "Monitor target accounts for technology changes and trigger competitive displacement plays",
        "tags": ["Technographic", "Signal", "Outbound"],
        "nodes": ["Tech Monitor", "Competitor Check", "Research", "Personalize", "Outreach"],
        "stats": {"leads_per_month": "20–60", "conv_rate": "15–25%", "use_case": "Competitive Intel"},
        "category": "AI-Powered",
    },
]

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _workflow_to_dict(wf: Workflow) -> Dict[str, Any]:
    """Serialise a Workflow ORM instance to a JSON-safe dict."""
    return {
        "id": str(wf.id),
        "user_id": str(wf.user_id),
        "name": wf.name,
        "description": wf.description,
        "status": wf.status,
        "trigger_type": wf.trigger_type,
        "target_object": wf.target_object,
        "nodes": wf.nodes or [],
        "settings": wf.settings or {},
        "owner_name": wf.owner_name,
        "folder": wf.folder,
        "created_at": wf.created_at.isoformat() if wf.created_at else None,
        "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
        "last_run_at": wf.last_run_at.isoformat() if wf.last_run_at else None,
        "next_run_at": wf.next_run_at.isoformat() if wf.next_run_at else None,
        "runs_total": wf.runs_total,
        "runs_completed": wf.runs_completed,
        "runs_in_progress": wf.runs_in_progress,
        "runs_failed": wf.runs_failed,
        "credit_usage": wf.credit_usage,
    }


def _execution_to_dict(ex: WorkflowExecution) -> Dict[str, Any]:
    """Serialise a WorkflowExecution ORM instance to a JSON-safe dict."""
    return {
        "id": str(ex.id),
        "workflow_id": str(ex.workflow_id),
        "user_id": str(ex.user_id),
        "status": ex.status,
        "input_data": ex.input_data or {},
        "output_data": ex.output_data,
        "error_message": ex.error_message,
        "credits_used": ex.credits_used,
        "duration_ms": ex.duration_ms,
        "created_at": ex.created_at.isoformat() if ex.created_at else None,
        "finished_at": ex.finished_at.isoformat() if ex.finished_at else None,
    }


# ---------------------------------------------------------------------------
# Templates endpoint (placed BEFORE /{workflow_id} to avoid route shadowing)
# ---------------------------------------------------------------------------


@router.get("/templates")
def list_templates(user: User = Depends(get_current_user)):
    """Return the hardcoded list of workflow templates."""
    return {"templates": WORKFLOW_TEMPLATES}


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.get("")
def list_workflows(
    status_filter: Optional[str] = Query(None, alias="status"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all workflows belonging to the current user."""
    q = db.query(Workflow).filter(Workflow.user_id == user.id)
    if status_filter:
        q = q.filter(Workflow.status == status_filter)
    q = q.order_by(Workflow.updated_at.desc())
    workflows = q.all()
    return {"workflows": [_workflow_to_dict(wf) for wf in workflows]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_workflow(
    body: WorkflowCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new workflow."""
    wf = Workflow(
        user_id=user.id,
        name=body.name,
        description=body.description,
        trigger_type=body.trigger_type,
        target_object=body.target_object,
        nodes=body.nodes,
        settings=body.settings,
        owner_name=body.owner_name or user.full_name,
        folder=body.folder,
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)
    logger.info("Workflow created: %s for user %s", wf.id, user.id)
    return _workflow_to_dict(wf)


@router.get("/{workflow_id}")
def get_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single workflow by ID (must belong to current user)."""
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _workflow_to_dict(wf)


@router.put("/{workflow_id}")
def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing workflow."""
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(wf, field, value)

    db.commit()
    db.refresh(wf)
    logger.info("Workflow updated: %s", wf.id)
    return _workflow_to_dict(wf)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a workflow and all its executions (CASCADE)."""
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    db.delete(wf)
    db.commit()
    logger.info("Workflow deleted: %s", workflow_id)
    return None


# ---------------------------------------------------------------------------
# Lifecycle actions
# ---------------------------------------------------------------------------


@router.post("/{workflow_id}/activate")
def activate_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set a workflow to active status."""
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    wf.status = "active"
    db.commit()
    db.refresh(wf)
    logger.info("Workflow activated: %s", wf.id)
    return _workflow_to_dict(wf)


@router.post("/{workflow_id}/pause")
def pause_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pause an active workflow."""
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    wf.status = "paused"
    db.commit()
    db.refresh(wf)
    logger.info("Workflow paused: %s", wf.id)
    return _workflow_to_dict(wf)


# ---------------------------------------------------------------------------
# Manual run
# ---------------------------------------------------------------------------

WORKFLOW_RUN_CREDIT_COST = 1


@router.post("/{workflow_id}/run")
def run_workflow(
    workflow_id: str,
    body: WorkflowRunInput = WorkflowRunInput(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually trigger a workflow run (creates a WorkflowExecution)."""
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Credit check
    if not check_sufficient_credits(db, user.id, WORKFLOW_RUN_CREDIT_COST):
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits. Need {WORKFLOW_RUN_CREDIT_COST}, "
            f"have {user.credits_balance}.",
        )

    start_ms = int(time.time() * 1000)

    # Create execution record
    execution = WorkflowExecution(
        workflow_id=wf.id,
        user_id=user.id,
        status="running",
        input_data=body.input_data,
    )
    db.add(execution)

    # Update workflow counters
    wf.runs_total = (wf.runs_total or 0) + 1
    wf.runs_in_progress = (wf.runs_in_progress or 0) + 1
    wf.last_run_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(execution)

    # Deduct credits
    deduct_credits(
        db,
        user_id=user.id,
        amount=WORKFLOW_RUN_CREDIT_COST,
        reference_id=execution.id,
        description=f"Workflow run: {wf.name}",
    )

    # Update credit usage on workflow
    wf.credit_usage = (wf.credit_usage or 0) + WORKFLOW_RUN_CREDIT_COST
    db.commit()

    logger.info(
        "Workflow run started: execution=%s workflow=%s user=%s",
        execution.id, wf.id, user.id,
    )
    return _execution_to_dict(execution)


# ---------------------------------------------------------------------------
# Execution history
# ---------------------------------------------------------------------------


@router.get("/{workflow_id}/runs")
def list_runs(
    workflow_id: str,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List execution history for a workflow."""
    # Verify ownership
    wf = (
        db.query(Workflow)
        .filter(Workflow.id == workflow_id, Workflow.user_id == user.id)
        .first()
    )
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    executions = (
        db.query(WorkflowExecution)
        .filter(
            WorkflowExecution.workflow_id == workflow_id,
            WorkflowExecution.user_id == user.id,
        )
        .order_by(WorkflowExecution.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"runs": [_execution_to_dict(ex) for ex in executions]}
