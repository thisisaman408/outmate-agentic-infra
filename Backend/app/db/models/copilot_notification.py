"""SQLAlchemy model for Co-Pilot in-app notifications."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CopilotNotification(Base):
    __tablename__ = "copilot_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    type = Column(String(64), nullable=False)          # e.g. "brief_ready"
    title = Column(String(256), nullable=False)
    body = Column(Text, nullable=False)
    cta_url = Column(String(512), nullable=False, default="")
    priority = Column(String(16), nullable=False, default="green")  # red/indigo/green
    is_read = Column(Boolean, nullable=False, default=False)
    grouped_count = Column(Integer, nullable=False, default=1)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
