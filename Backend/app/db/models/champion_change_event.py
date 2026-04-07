import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class ChampionChangeEvent(Base):
    __tablename__ = "champion_change_events"

    id = Column(String(64), primary_key=True, default=lambda: f"cce-{uuid.uuid4().hex[:10]}")
    watcher_id = Column(String(64), ForeignKey("watchers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_name = Column(String(255), nullable=True)
    contact_linkedin = Column(String(512), nullable=True)
    prev_company = Column(String(255), nullable=True)
    prev_title = Column(String(255), nullable=True)
    new_company = Column(String(255), nullable=True)
    new_title = Column(String(255), nullable=True)
    change_type = Column(String(32), nullable=False)   # left_account | joined_account | promoted
    draft_email = Column(Text(), nullable=True)
    status = Column(String(32), nullable=False, default="pending")
    is_read = Column(Boolean(), nullable=False, default=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
