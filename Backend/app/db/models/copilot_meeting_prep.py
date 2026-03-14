import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class CopilotMeetingPrep(Base):
    __tablename__ = "copilot_meeting_preps"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_name   = Column(String(500), nullable=False)
    company_domain = Column(String(255), nullable=True)
    prospect_name  = Column(String(500), nullable=True)
    prospect_title = Column(String(500), nullable=True)
    meeting_type   = Column(String(50), default="discovery")
    content        = Column(JSONB, nullable=False)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
