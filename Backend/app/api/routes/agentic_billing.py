"""Billing hook for agentic-stack runs.

The agentic backend (`:7860`) calls `POST /api/v1/billing/agentic-run` after
every flow build completes. This route:

  1. Validates the request via a "system" JWT signed with the shared
     `OUTMATE_BRIDGE_SECRET`. (Same secret as the user-facing bridge JWTs,
     but with `type: "outmate_system"` to keep the two clearly separated.)
  2. Looks up the user the run belongs to.
  3. Writes one row to `outmate_agent_runs` (audit trail).
  4. Records a `CreditTransaction` and decrements `user.credits_balance`.

Pricing model (v1):
  - Successful run         → 1 credit
  - Failed run             → 0 credits (we don't bill for crashes)

Tokens-aware pricing comes in v2 once the agent components reliably report
input/output token counts. The endpoint already accepts `tokens_input` /
`tokens_output` fields; once we trust them we just adjust the `_cost_credits`
function and existing rows continue to work.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.deps import get_db
from app.db.models.agent_run import AgentRun
from app.db.models.credit import CreditTransaction
from app.db.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


_SYSTEM_TOKEN_TYPE = "outmate_system"
_DEFAULT_RUN_COST = 1  # credits per successful agentic run (v1 flat rate)


def _verify_system_token(request: Request) -> dict:
    """Validate the agentic process is the caller, not a random client.

    Returns the decoded JWT payload on success. Raises 401 otherwise.
    """
    if not settings.OUTMATE_BRIDGE_SECRET:
        # Bridge isn't configured at all → reject everything to fail closed.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OUTMATE_BRIDGE_SECRET is not configured.",
        )
    token = request.headers.get("X-Outmate-System")
    if not token:
        raise HTTPException(status_code=401, detail="Missing X-Outmate-System header")
    try:
        payload = jwt.decode(
            token, settings.OUTMATE_BRIDGE_SECRET, algorithms=["HS256"]
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="System token expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid system token: {exc!s}") from exc
    if payload.get("type") != _SYSTEM_TOKEN_TYPE:
        raise HTTPException(status_code=401, detail="Wrong system token type")
    return payload


def _cost_credits(success: bool, tokens_in: Optional[int], tokens_out: Optional[int]) -> int:
    """Compute credit cost for a single run.

    Today: flat rate, with a knob for future token-based pricing. Failed
    runs are free so we don't charge users for our crashes.
    """
    _ = tokens_in, tokens_out  # reserved for v2 token-aware pricing
    if not success:
        return 0
    return _DEFAULT_RUN_COST


class AgenticRunRecord(BaseModel):
    """Body posted from the agentic stack on each completed build."""

    user_id: UUID = Field(..., description="The Outmate user this run belongs to.")
    flow_id: Optional[UUID] = Field(default=None, description="Flow that ran.")
    run_id: Optional[str] = Field(default=None, description="Agentic-side run UUID.")
    agent_type: Optional[str] = Field(default=None, description="Component name of the primary agent, if known.")
    success: bool = Field(..., description="Did the run complete without errors?")
    duration_ms: Optional[int] = Field(default=None, ge=0)
    tokens_input: Optional[int] = Field(default=None, ge=0)
    tokens_output: Optional[int] = Field(default=None, ge=0)
    model: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)


class AgenticRunRecordResponse(BaseModel):
    ok: bool
    cost_credits: int
    remaining_credits: int
    run_record_id: UUID


@router.post("/agentic-run", response_model=AgenticRunRecordResponse)
def record_agentic_run(
    body: AgenticRunRecord,
    request: Request,
    db: Session = Depends(get_db),
):
    """Idempotency: if `run_id` is supplied and we've already recorded that
    run, we return the existing record's cost and the user's current balance
    without double-charging. (The agentic side may retry on transient failure.)
    """
    _verify_system_token(request)

    user = db.query(User).filter_by(id=body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {body.user_id} not found")

    # Idempotency check on run_id (agentic-side UUID stamped per build).
    if body.run_id:
        try:
            existing_id = UUID(body.run_id)
        except (ValueError, TypeError):
            existing_id = None
        if existing_id is not None:
            existing = db.query(AgentRun).filter_by(id=existing_id).first()
            if existing is not None:
                return AgenticRunRecordResponse(
                    ok=True,
                    cost_credits=existing.cost_credits or 0,
                    remaining_credits=user.credits_balance or 0,
                    run_record_id=existing.id,
                )

    cost = _cost_credits(body.success, body.tokens_input, body.tokens_output)

    run = AgentRun(
        id=UUID(body.run_id) if body.run_id else uuid.uuid4(),
        user_id=user.id,
        agent_type=(body.agent_type or "agentic").lower()[:64],
        flow_id=str(body.flow_id) if body.flow_id else None,
        input={},  # the agentic side doesn't ship input payload here
        output_text=None,
        status="success" if body.success else "error",
        error_message=body.error_message,
        duration_ms=body.duration_ms,
        finished_at=datetime.utcnow(),
        tokens_input=body.tokens_input,
        tokens_output=body.tokens_output,
        cost_credits=cost,
        model_used=body.model,
    )
    db.add(run)

    if cost > 0:
        # Don't bounce the run on insufficient credits — the work has already
        # been done. Allow `credits_balance` to go negative; payment-recovery
        # is a separate ops flow. (Future: enforce pre-flight credit check
        # at run-start time, agentic-side, before we incur cost.)
        user.credits_balance = (user.credits_balance or 0) - cost
        db.add(
            CreditTransaction(
                user_id=user.id,
                amount=-cost,
                transaction_type="usage",
                reference_id=run.id,
                description=f"agentic run: {body.agent_type or 'unknown'}",
                transaction_metadata={
                    "flow_id": str(body.flow_id) if body.flow_id else None,
                    "model": body.model,
                    "duration_ms": body.duration_ms,
                    "tokens_input": body.tokens_input,
                    "tokens_output": body.tokens_output,
                },
            )
        )

    db.commit()
    db.refresh(run)
    return AgenticRunRecordResponse(
        ok=True,
        cost_credits=cost,
        remaining_credits=user.credits_balance or 0,
        run_record_id=run.id,
    )
