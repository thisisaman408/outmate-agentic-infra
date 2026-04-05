import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class VisitorJourneySequence(Base):
    __tablename__ = "visitor_journey_sequences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"), index=True, nullable=False)
    visitor_id = Column(String(128), index=True, nullable=True)
    fingerprint = Column(String(128), index=True, nullable=True)
    session_id = Column(String(128), index=True, nullable=True)
    company_domain = Column(String(255), index=True, nullable=True)
    sequence_type = Column(String(64), index=True, nullable=True)
    page_sequence = Column(JSONB, server_default="[]")
    transition_summary = Column(JSONB, server_default="{}")
    metrics = Column(JSONB, server_default="{}")
    event_count = Column(Integer, default=0)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
