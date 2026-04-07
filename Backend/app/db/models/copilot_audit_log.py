import uuid
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class CopilotAuditLog(Base):
    __tablename__ = "copilot_audit_log"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id            = Column(UUID(as_uuid=True), nullable=False, index=True)
    prospect_id        = Column(UUID(as_uuid=True), nullable=True, index=True)
    company_name       = Column(String(500), nullable=True)

    # What was requested
    action_type        = Column(String(100), nullable=False)  # "orchestrate" or "draft_email" etc.
    user_prompt        = Column(Text, nullable=True)

    # What was planned + executed
    plan               = Column(JSONB, nullable=True)     # Orchestrator plan object
    steps_run          = Column(JSONB, nullable=True)     # List of step results
    output             = Column(JSONB, nullable=True)     # Final artifact or action result
    status             = Column(String(50), default="success") # success | error | partial

    # Metadata
    credits_used       = Column(Integer, default=0)
    duration_ms        = Column(Integer, nullable=True)
    enrichment_sources = Column(JSONB, nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
