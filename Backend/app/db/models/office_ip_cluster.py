import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class OfficeIpCluster(Base):
    __tablename__ = "office_ip_clusters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"), index=True, nullable=False)
    company_domain = Column(String(255), index=True, nullable=False)
    company_name = Column(String(255), nullable=True)
    ip_prefix = Column(String(64), index=True, nullable=False)
    evidence_count = Column(Integer, default=0)
    verified_reveal_count = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    sample_ips = Column(JSONB, server_default="[]")
    evidence = Column(JSONB, server_default="{}")
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
