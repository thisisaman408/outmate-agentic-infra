import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class CopilotUserPreferences(Base):
    __tablename__ = "copilot_user_preferences"

    id                       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                  = Column(UUID(as_uuid=True), unique=True, nullable=False)
    daily_brief_enabled      = Column(Boolean, default=True)
    daily_brief_time         = Column(String(5), default="08:00")
    daily_brief_timezone     = Column(String(50), default="UTC")
    notify_email             = Column(Boolean, default=True)
    notify_slack             = Column(Boolean, default=False)
    slack_webhook_url        = Column(String(500), nullable=True)
    pipeline_alerts_enabled  = Column(Boolean, default=True)
    alert_severity_threshold = Column(String(20), default="medium")
    created_at               = Column(DateTime(timezone=True), server_default=func.now())
    updated_at               = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
