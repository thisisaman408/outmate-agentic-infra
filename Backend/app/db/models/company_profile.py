"""User's own company profile — the single source of truth for every
outbound agent on what this user sells, who they are, and how to pitch.

Every Outmate user fills this out ONCE (in Settings → Company Profile),
and every downstream agent — Voice Agent, Social Agent outreach drafter,
Co-Pilot — reads from this row to craft messages.  Without it, agents
fall back to generic "Outmate" pitch copy, which is only correct for
Outmate's own dogfood tenant.

Tenant isolation: one row per user_id (UNIQUE).  Every read MUST filter
by user_id.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class UserCompanyProfile(Base):
    """One row per user describing their company + how agents should pitch it."""

    __tablename__ = "user_company_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,
    )

    # Identity
    company_name = Column(String(255), nullable=False, default="")
    website_url = Column(String(500), nullable=False, default="")

    # Pitch
    one_liner = Column(Text, nullable=False, default="")             # "We help X do Y, resulting in Z"
    product_description = Column(Text, nullable=False, default="")   # longer paragraph for knowledge
    pricing_summary = Column(Text, nullable=False, default="")       # "Starts at $X/mo, 14-day trial"
    icp_description = Column(Text, nullable=False, default="")       # "Series A-C SaaS, 20-200 employees"

    # Conversation guidance
    objection_handling = Column(Text, nullable=False, default="")    # talking points for common objections
    key_differentiators = Column(Text, nullable=False, default="")   # why pick us over alternatives
    additional_context = Column(Text, nullable=False, default="")    # free-form extra

    # Agent persona
    agent_persona_name = Column(String(128), nullable=False, default="Alex")
    agent_persona_role = Column(String(128), nullable=False, default="GTM Specialist")

    # CTA / booking
    calendar_booking_url = Column(String(500), nullable=False, default="")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", lazy="joined")

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_company_profile_user_id"),
    )
