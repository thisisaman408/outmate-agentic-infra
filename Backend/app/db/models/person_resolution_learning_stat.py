import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class PersonResolutionLearningStat(Base):
    __tablename__ = "person_resolution_learning_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"), index=True, nullable=False)
    feature_type = Column(String(64), index=True, nullable=False)
    feature_value = Column(String(255), index=True, nullable=False)
    seen_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    metadata_json = Column(JSONB, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
