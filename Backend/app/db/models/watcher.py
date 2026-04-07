import uuid
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey  # noqa: F401 (Boolean used for champion columns)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base


class Watcher(Base):
    __tablename__ = "watchers"

    id = Column(String(64), primary_key=True, default=lambda: f"w-{uuid.uuid4().hex[:8]}")
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=True)
    type = Column(String(32), nullable=False)   # 'event', 'account', 'lead'
    status = Column(String(32), default="active")

    # Watcher-specific data stored as JSON
    criteria = Column(JSON, nullable=True)           # event watcher filters
    account_name = Column(String(255), nullable=True)
    account_domain = Column(String(255), nullable=True)
    lead_name = Column(String(255), nullable=True)
    lead_title = Column(String(255), nullable=True)
    lead_company = Column(String(255), nullable=True)
    lead_email = Column(String(255), nullable=True)
    triggers = Column(JSON, nullable=True)           # list of trigger strings
    prospect_id = Column(String(64), nullable=True)  # cached after first match
    business_id = Column(String(64), nullable=True)  # cached after first match

    # Sync results (persisted across restarts)
    recent_updates = Column(JSON, nullable=True, default=list)
    matches = Column(JSON, nullable=True, default=list)
    match_count = Column(String(16), default="0")

    notification_settings = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_synced_at = Column(DateTime(timezone=True), nullable=True)

    # Champion / job-change tracking
    linkedin_url = Column(String(512), nullable=True)
    track_job_changes = Column(Boolean(), nullable=False, default=False)
    last_known_company = Column(String(255), nullable=True)
    last_known_title = Column(String(255), nullable=True)
    last_job_check_at = Column(DateTime(timezone=True), nullable=True)
