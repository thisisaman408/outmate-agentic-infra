"""Voice campaign header + per-prospect row.

A campaign is a batch of outbound voice calls the background Celery worker
(`run_voice_campaign`) dispatches one-by-one, respecting `max_calls_per_day`
and the user's pause state.  Each prospect row mirrors one call attempt and
stores the `agent_run_id` so we can join into transcripts + extracted vars
via the existing `/voice-agent/call-details/{run_id}` endpoint.

Tenant isolation: every read MUST filter by `user_id`.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class VoiceCampaign(Base):
    """One voice-call campaign header row."""

    __tablename__ = "voice_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)
    call_objective = Column(String(128), nullable=False, default="discovery")
    # manual | csv | hubspot | hot_signals
    source_type = Column(String(32), nullable=False)
    # Opaque, source-specific selector (e.g. {"list_id": "42"} or
    # {"min_intent": 70, "days": 7, "signal_types": ["funding"]})
    source_params = Column(JSONB, nullable=False, default=dict)

    max_calls_per_day = Column(Integer, nullable=False, default=50)

    # queued | running | paused | completed | cancelled | error
    status = Column(String(32), nullable=False, default="queued", index=True)
    error_message = Column(Text, nullable=True)

    total_prospects = Column(Integer, nullable=False, default=0)
    calls_made = Column(Integer, nullable=False, default=0)
    calls_booked = Column(Integer, nullable=False, default=0)
    calls_failed = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", lazy="joined")
    prospects = relationship(
        "VoiceCampaignProspect",
        back_populates="campaign",
        cascade="all, delete-orphan",
        lazy="select",
    )

    __table_args__ = (
        Index("ix_voice_campaigns_user_created", "user_id", "created_at"),
    )


class VoiceCampaignProspect(Base):
    """One prospect in a campaign — mirrors one outbound call attempt."""

    __tablename__ = "voice_campaign_prospects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(
        UUID(as_uuid=True),
        ForeignKey("voice_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Prospect payload used to call Retell.  Mirrors TriggerCallRequest fields.
    prospect_name = Column(String(255), nullable=False)
    prospect_phone = Column(String(50), nullable=False)
    prospect_company = Column(String(255), nullable=False, default="")
    prospect_role = Column(String(255), nullable=False, default="")
    prospect_city = Column(String(128), nullable=False, default="")
    prospect_industry = Column(String(128), nullable=False, default="")
    context = Column(Text, nullable=False, default="")

    # queued | calling | success | error | skipped
    status = Column(String(32), nullable=False, default="queued", index=True)
    error_message = Column(Text, nullable=True)

    # When the Celery worker picks this row up.
    attempted_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    # FK into outmate_agent_runs — the real transcript + extracted vars live
    # there, already populated by the existing Retell webhook.
    agent_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("outmate_agent_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    campaign = relationship("VoiceCampaign", back_populates="prospects")

    __table_args__ = (
        Index("ix_vcp_campaign_status", "campaign_id", "status"),
    )
