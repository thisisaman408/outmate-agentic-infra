import uuid
from sqlalchemy import Column, String, DateTime, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func
from app.db.base import Base


class IdentityNode(Base):
    __tablename__ = "identity_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visitor_id = Column(String(64), unique=True, index=True)
    ip = Column(INET, index=True)
    email = Column(String(255), index=True)
    full_name = Column(String(255))
    phone = Column(String(50))
    linkedin_url = Column(String(512))
    job_title = Column(String(255))
    company_name = Column(String(255))
    company_domain = Column(String(255))
    raw_data = Column(JSONB, server_default="{}")
    sources = Column(JSONB, server_default="[]")
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    pixel_key = Column(String(255))
