import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class AnonymousVisitorProfile(Base):
    __tablename__ = "anonymous_visitor_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"), index=True, nullable=False)
    visitor_id = Column(String(128), index=True, nullable=True)
    fingerprint = Column(String(128), index=True, nullable=True)
    session_id = Column(String(128), index=True, nullable=True)
    user_agent_hash = Column(String(64), index=True, nullable=True)
    last_ip = Column(INET, nullable=True)
    company_name = Column(String(255), nullable=True)
    company_domain = Column(String(255), nullable=True, index=True)
    latest_persona = Column(String(64), nullable=True)
    latest_buying_stage = Column(String(32), nullable=True)
    visit_count = Column(Integer, default=0)
    total_active_ms = Column(Integer, default=0)
    profile_data = Column(JSONB, server_default="{}")
    resolution_summary = Column(JSONB, server_default="{}")
    candidate_people = Column(JSONB, server_default="[]")
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
