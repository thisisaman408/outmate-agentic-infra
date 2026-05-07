"""FlowSchedule — per-flow recurring trigger.

Drives the in-process APScheduler. Each enabled row schedules a job that
POSTs to the flow's own /api/v1/run/{endpoint_name} endpoint internally.
"""

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlmodel import Field, SQLModel


class ScheduleType(str, Enum):
    MANUAL = "manual"
    INTERVAL = "interval"
    CRON = "cron"


class FlowScheduleBase(SQLModel):
    flow_id: UUID = Field(index=True, foreign_key="flow.id")
    schedule_type: ScheduleType = Field(
        default=ScheduleType.MANUAL,
        sa_column=Column(
            SQLEnum(
                ScheduleType,
                name="flow_schedule_type",
                values_callable=lambda enum: [m.value for m in enum],
            ),
            nullable=False,
        ),
    )
    # For INTERVAL: an integer number of seconds (e.g. 3600 = hourly).
    # For CRON: a 5-field cron expression (e.g. "0 9 * * 1-5").
    # For MANUAL: ignored.
    expression: str | None = Field(default=None, nullable=True)
    enabled: bool = Field(default=True, nullable=False)
    next_run_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    last_run_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class FlowSchedule(FlowScheduleBase, table=True):  # type: ignore[call-arg]
    __tablename__ = "flow_schedule"
    id: UUID = Field(default_factory=uuid4, primary_key=True, unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FlowScheduleCreate(FlowScheduleBase):
    pass


class FlowScheduleUpdate(SQLModel):
    schedule_type: ScheduleType | None = None
    expression: str | None = None
    enabled: bool | None = None


class FlowScheduleRead(FlowScheduleBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
