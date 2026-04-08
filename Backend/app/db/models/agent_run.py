"""Persistent record of every agent run executed by the outmate-agentic
backend on behalf of an Outmate user.

This is the **only** place tenant isolation lives for agentic-infra-backed
agents.  Every read MUST hard-filter `WHERE user_id = current_user.id`.
The agentic infra itself runs as a single service account and has no notion
of which Outmate user is calling it — Backend/ owns the user → run mapping
and enforces it at the SQL layer.
"""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AgentRun(Base):
    """One execution of an agentic-infra-backed agent for one Outmate user."""

    __tablename__ = "outmate_agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tenant key — every read MUST filter by this column.
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Which agent.  Free-form string keyed off the route, e.g. "social-listening".
    # Future agents (TAM discovery, intent signals, etc.) reuse this table.
    agent_type = Column(String(64), nullable=False, index=True)

    # The flow ID on the agentic infra that was actually executed (audit trail —
    # if you ever change which flow ID a route uses, history still tells you
    # which flow handled which run).
    flow_id = Column(String(128), nullable=True)

    # Inputs the user supplied (topic, max_leads, client_company, tone, etc.)
    # plus any server-side enrichment (resolved API keys are NEVER stored here).
    input = Column(JSONB, nullable=False)

    # Raw markdown returned by the agent — kept for re-parsing if the parser
    # is ever improved without needing to re-run the agent.
    output_text = Column(Text, nullable=True)

    # Structured output produced by the Backend's markdown parser.
    # For social-listening this is a list of Lead objects.
    leads = Column(JSONB, nullable=True)

    # User-visible upgrade tips emitted by the agent (e.g. "add a Tavily key").
    upgrade_tips = Column(JSONB, nullable=True)

    # Lifecycle: running | success | error
    status = Column(String(32), nullable=False, default="running", index=True)
    error_message = Column(Text, nullable=True)

    # Timing
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    # ORM convenience
    user = relationship("User", lazy="joined")

    __table_args__ = (
        # Hot path: list a user's most recent runs of one agent type.
        Index("ix_outmate_agent_runs_user_agent_created", "user_id", "agent_type", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debug only
        return (
            f"<AgentRun id={self.id} user_id={self.user_id} "
            f"agent_type={self.agent_type} status={self.status}>"
        )
