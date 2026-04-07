import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class SignalSequenceDraft(Base):
    __tablename__ = "signal_sequence_drafts"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id            = Column(UUID(as_uuid=True), nullable=False, index=True)
    signal_id          = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Contact fetched from ContactOut
    lead_name          = Column(String(500), nullable=True)
    lead_email         = Column(String(255), nullable=True)
    lead_role          = Column(String(255), nullable=True)
    lead_domain        = Column(String(255), nullable=True)
    lead_linkedin_url  = Column(String(500), nullable=True)

    # Generated email (top-level for quick display)
    draft_email_subject = Column(Text, nullable=True)
    draft_email_body    = Column(Text, nullable=True)

    # Full optimizer output — follow-up sequence, reply probability, scores, etc.
    optimizer_output   = Column(JSONB, nullable=True)

    # Signal metadata
    signal_score       = Column(Integer, nullable=True)
    signal_type        = Column(String(100), nullable=False)
    company_name       = Column(String(500), nullable=True)
    company_domain     = Column(String(255), nullable=True)

    # Lifecycle: pending → shown → used | dismissed
    status             = Column(String(20), nullable=False, default="pending")
    campaign_id        = Column(UUID(as_uuid=True), nullable=True)

    created_at         = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at         = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
