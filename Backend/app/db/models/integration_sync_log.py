import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class IntegrationSyncLog(Base):
    """Audit log for integration sync operations."""
    __tablename__ = "integration_sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_integration_id = Column(
        UUID(as_uuid=True),
        ForeignKey("user_integrations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sync_type = Column(String(20), nullable=False)  # push, pull, webhook, full_sync
    entity_type = Column(String(50), nullable=True)
    records_total = Column(Integer, default=0)
    records_succeeded = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    status = Column(String(20), nullable=False)  # running, completed, failed, partial
    error_details = Column(JSONB, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
