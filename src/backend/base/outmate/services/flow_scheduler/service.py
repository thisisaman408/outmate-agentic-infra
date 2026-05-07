"""In-process flow scheduler.

Runs an asyncio tick loop every 30 seconds. For each enabled FlowSchedule
whose `next_run_at` is in the past, the loop POSTs the flow's own
``/api/v1/run/{endpoint_name}`` endpoint locally, then advances
``next_run_at`` per the schedule type.

Supports:
  - INTERVAL: ``expression`` is a number of seconds (string).
  - CRON: ``expression`` is a 5-field cron string. Requires the optional
    ``croniter`` package; if unavailable, cron schedules are persisted but
    skipped at tick time with a warning.
  - MANUAL: ignored — published endpoints fire only on external trigger.

Single-instance only — if you scale to multiple replicas of the agentic
backend, fronted with a Redis lock or move to APScheduler with a job store.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
from sqlmodel import select

from outmate.services.database.models.flow.model import Flow
from outmate.services.database.models.flow_schedule.model import (
    FlowSchedule,
    ScheduleType,
)
from outmate.services.deps import session_scope

logger = logging.getLogger(__name__)

try:  # Optional cron support
    from croniter import croniter

    HAS_CRONITER = True
except ImportError:  # pragma: no cover
    HAS_CRONITER = False
    croniter = None  # type: ignore[assignment]


TICK_INTERVAL_SECONDS = 30


class FlowSchedulerService:
    """Owns the background tick task. One per process."""

    def __init__(self, base_url: str = "http://127.0.0.1:7860") -> None:
        self._base_url = base_url
        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self._client = httpx.AsyncClient(timeout=60)

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run(), name="flow-scheduler")
        logger.info("flow_scheduler started (tick=%ss)", TICK_INTERVAL_SECONDS)

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=5)
            except asyncio.TimeoutError:
                self._task.cancel()
        await self._client.aclose()
        logger.info("flow_scheduler stopped")

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._tick()
            except Exception:  # noqa: BLE001 — keep loop alive
                logger.exception("flow_scheduler tick failed")
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(), timeout=TICK_INTERVAL_SECONDS
                )
            except asyncio.TimeoutError:
                continue

    async def _tick(self) -> None:
        now = datetime.now(timezone.utc)
        # New session per tick — keeps connection turnover predictable.
        async with session_scope() as session:
            stmt = select(FlowSchedule).where(
                FlowSchedule.enabled == True,  # noqa: E712
                FlowSchedule.schedule_type != ScheduleType.MANUAL,
                FlowSchedule.next_run_at <= now,
            )
            due = (await session.exec(stmt)).all()
            if not due:
                return

            for schedule in due:
                await self._fire_one(session, schedule, now)
            # session_scope commits on exit if no exception

    async def _fire_one(
        self,
        session: Any,
        schedule: FlowSchedule,
        now: datetime,
    ) -> None:
        flow_stmt = select(Flow).where(Flow.id == schedule.flow_id)
        flow = (await session.exec(flow_stmt)).one_or_none()
        if flow is None:
            logger.warning(
                "flow_scheduler: schedule %s references missing flow %s — disabling",
                schedule.id,
                schedule.flow_id,
            )
            schedule.enabled = False
            return
        if not flow.endpoint_name:
            logger.info(
                "flow_scheduler: flow %s has no endpoint_name (paused) — skipping",
                flow.id,
            )
            # Don't disable — endpoint may come back. Push next_run_at forward.
            self._advance(schedule, now)
            return

        url = f"{self._base_url}/api/v1/run/{flow.endpoint_name}"
        try:
            resp = await self._client.post(url, json={"input_value": ""})
            if resp.status_code >= 400:
                logger.warning(
                    "flow_scheduler: %s returned %s",
                    url,
                    resp.status_code,
                )
        except Exception:  # noqa: BLE001
            logger.exception("flow_scheduler: POST %s failed", url)

        schedule.last_run_at = now
        self._advance(schedule, now)

    def _advance(self, schedule: FlowSchedule, now: datetime) -> None:
        next_at = self.compute_next(schedule.schedule_type, schedule.expression, now)
        schedule.next_run_at = next_at
        schedule.updated_at = now

    @staticmethod
    def compute_next(
        kind: ScheduleType,
        expression: str | None,
        from_dt: datetime | None = None,
    ) -> datetime | None:
        """Compute the next fire time. Returns None for manual or invalid."""
        if kind == ScheduleType.MANUAL:
            return None
        base = from_dt or datetime.now(timezone.utc)
        if kind == ScheduleType.INTERVAL:
            try:
                seconds = int(expression or "0")
            except (TypeError, ValueError):
                seconds = 0
            if seconds <= 0:
                return None
            return base + timedelta(seconds=seconds)
        if kind == ScheduleType.CRON:
            if not HAS_CRONITER or not expression:
                return None
            try:
                it = croniter(expression, base)
                return it.get_next(datetime)
            except Exception:  # noqa: BLE001
                logger.exception("flow_scheduler: bad cron expression %r", expression)
                return None
        return None


_singleton: FlowSchedulerService | None = None


def get_flow_scheduler() -> FlowSchedulerService:
    global _singleton
    if _singleton is None:
        _singleton = FlowSchedulerService()
    return _singleton


async def start_flow_scheduler() -> None:
    await get_flow_scheduler().start()


async def stop_flow_scheduler() -> None:
    if _singleton is not None:
        await _singleton.stop()
