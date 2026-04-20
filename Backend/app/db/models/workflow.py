"""Workflow and WorkflowExecution models.

Workflows are user-defined automation pipelines (e.g. "AI-Powered Outbound
Prospecting"). Each manual or scheduled run creates a WorkflowExecution row.
Tenant isolation: every query MUST filter by ``user_id``.
"""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Workflow(Base):
    """A reusable automation workflow owned by a single user."""

    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tenant key — every read MUST filter by this column.
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # draft | active | paused
    status = Column(String(32), nullable=False, default="draft", index=True)

    # event_triggered | time_triggered | manual
    trigger_type = Column(String(64), nullable=False)

    # People | Companies
    target_object = Column(String(64), nullable=False)

    # Ordered list of node definitions (each is a dict with type, config, etc.)
    nodes = Column(JSONB, nullable=False, default=list)

    # Execution rules, notification prefs, etc.
    settings = Column(JSONB, nullable=False, default=dict)

    owner_name = Column(String(128), nullable=True)
    folder = Column(String(128), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)

    # Aggregate counters (denormalised for fast dashboard reads)
    runs_total = Column(Integer, nullable=False, default=0)
    runs_completed = Column(Integer, nullable=False, default=0)
    runs_in_progress = Column(Integer, nullable=False, default=0)
    runs_failed = Column(Integer, nullable=False, default=0)
    credit_usage = Column(Integer, nullable=False, default=0)

    # ORM convenience
    user = relationship("User", lazy="joined")
    executions = relationship(
        "WorkflowExecution",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    __table_args__ = (
        Index("ix_workflows_user_status", "user_id", "status"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<Workflow id={self.id} name={self.name!r} "
            f"user_id={self.user_id} status={self.status}>"
        )


class WorkflowExecution(Base):
    """One execution (run) of a Workflow."""

    __tablename__ = "workflow_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    workflow_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Denormalised for fast tenant-filtered queries without joining workflows.
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # running | completed | failed
    status = Column(String(32), nullable=False, default="running")

    input_data = Column(JSONB, nullable=False, default=dict)
    output_data = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    credits_used = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    # ORM convenience
    workflow = relationship("Workflow", back_populates="executions")
    user = relationship("User", lazy="joined")

    __table_args__ = (
        Index("ix_workflow_executions_workflow_created", "workflow_id", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<WorkflowExecution id={self.id} workflow_id={self.workflow_id} "
            f"status={self.status}>"
        )
