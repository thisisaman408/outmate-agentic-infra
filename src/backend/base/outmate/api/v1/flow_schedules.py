"""Flow schedule routes.

Per-flow scheduler config used by the in-process FlowSchedulerService.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select

from outmate.api.utils import CurrentActiveUser, DbSession
from outmate.services.database.models.flow.model import Flow
from outmate.services.database.models.flow_schedule.model import (
    FlowSchedule,
    FlowScheduleRead,
    FlowScheduleUpdate,
    ScheduleType,
)
from outmate.services.flow_scheduler import FlowSchedulerService

router = APIRouter(prefix="/flows", tags=["Flow Schedule"])


async def _get_owned_flow(
    flow_id: UUID, user: CurrentActiveUser, db: DbSession
) -> Flow:
    flow = await db.get(Flow, flow_id)
    if flow is None or (flow.user_id and flow.user_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flow not found"
        )
    return flow


@router.get(
    "/{flow_id}/schedule",
    response_model=FlowScheduleRead | None,
    summary="Get the schedule for a flow",
)
async def get_schedule(
    flow_id: UUID,
    user: CurrentActiveUser,
    db: DbSession,
):
    await _get_owned_flow(flow_id, user, db)
    stmt = select(FlowSchedule).where(FlowSchedule.flow_id == flow_id)
    schedule = (await db.exec(stmt)).first()
    return schedule


@router.put(
    "/{flow_id}/schedule",
    response_model=FlowScheduleRead,
    summary="Create or update a flow's schedule",
)
async def upsert_schedule(
    flow_id: UUID,
    payload: FlowScheduleUpdate,
    user: CurrentActiveUser,
    db: DbSession,
):
    await _get_owned_flow(flow_id, user, db)
    stmt = select(FlowSchedule).where(FlowSchedule.flow_id == flow_id)
    existing = (await db.exec(stmt)).first()

    kind = payload.schedule_type or (
        existing.schedule_type if existing else ScheduleType.MANUAL
    )
    expression = (
        payload.expression
        if payload.expression is not None
        else (existing.expression if existing else None)
    )
    enabled = (
        payload.enabled
        if payload.enabled is not None
        else (existing.enabled if existing else True)
    )

    next_run_at = FlowSchedulerService.compute_next(kind, expression)

    if existing is None:
        existing = FlowSchedule(
            flow_id=flow_id,
            schedule_type=kind,
            expression=expression,
            enabled=enabled,
            next_run_at=next_run_at,
        )
        db.add(existing)
    else:
        existing.schedule_type = kind
        existing.expression = expression
        existing.enabled = enabled
        existing.next_run_at = next_run_at
        existing.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(existing)
    return existing


@router.delete(
    "/{flow_id}/schedule",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a flow's schedule",
)
async def delete_schedule(
    flow_id: UUID,
    user: CurrentActiveUser,
    db: DbSession,
):
    await _get_owned_flow(flow_id, user, db)
    stmt = select(FlowSchedule).where(FlowSchedule.flow_id == flow_id)
    existing = (await db.exec(stmt)).first()
    if existing is not None:
        await db.delete(existing)
        await db.commit()
