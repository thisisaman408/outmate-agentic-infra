import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class CopilotPipelineAlert(Base):
    __tablename__ = "copilot_pipeline_alerts"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = Column(UUID(as_uuid=True), nullable=False, index=True)
    alert_type     = Column(String(50), nullable=False)
    severity       = Column(String(20), default="medium")
    title          = Column(String(500), nullable=False)
    description    = Column(Text, nullable=False)
    entity_type    = Column(String(50), nullable=True)
    entity_id      = Column(String(255), nullable=True)
    entity_name    = Column(String(500), nullable=True)
    recommendation = Column(Text, nullable=True)
    is_resolved    = Column(Boolean, default=False)
    resolved_at    = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
