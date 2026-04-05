import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class CompanyResolutionAlias(Base):
    __tablename__ = "company_resolution_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_type = Column(String(50), nullable=False, index=True)
    match_value = Column(String(255), nullable=False, index=True)
    canonical_company = Column(String(255), nullable=True)
    canonical_domain = Column(String(255), nullable=True)
    confidence_boost = Column(Integer, default=10)
    is_active = Column(Boolean, default=True, index=True)
    notes = Column(Text, nullable=True)
    metadata_json = Column(JSONB, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
