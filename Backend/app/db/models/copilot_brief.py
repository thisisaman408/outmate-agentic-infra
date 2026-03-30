import uuid
from sqlalchemy import Column, String, Date, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class CopilotBrief(Base):
    __tablename__ = "copilot_briefs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), nullable=False, index=True)
    brief_date = Column(Date, nullable=False, index=True)
    brief_type = Column(String(50), default="daily")
    content    = Column(JSONB, nullable=False)
    status     = Column(String(20), default="generated")
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "brief_date", "brief_type", name="uq_user_brief_date_type"),
    )
