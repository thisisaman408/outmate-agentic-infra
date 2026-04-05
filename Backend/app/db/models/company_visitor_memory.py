import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class CompanyVisitorMemory(Base):
    __tablename__ = "company_visitor_memories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"), index=True, nullable=False)
    company_domain = Column(String(255), index=True, nullable=False)
    company_name = Column(String(255), nullable=True)
    visitor_count = Column(Integer, default=0)
    anonymous_repeat_count = Column(Integer, default=0)
    buying_committee_size = Column(Integer, default=0)
    latest_personas = Column(JSONB, server_default="[]")
    role_coverage = Column(JSONB, server_default="[]")
    active_sequence_types = Column(JSONB, server_default="[]")
    unique_visitors = Column(JSONB, server_default="[]")
    top_candidate_people = Column(JSONB, server_default="[]")
    revealed_people = Column(JSONB, server_default="[]")
    suppressed_candidates = Column(JSONB, server_default="[]")
    evidence = Column(JSONB, server_default="{}")
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
