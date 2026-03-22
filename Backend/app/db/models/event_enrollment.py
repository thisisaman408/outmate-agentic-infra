import uuid
from sqlalchemy import Column, String, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class EventEnrollment(Base):
    __tablename__ = "event_enrollments"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id   = Column(String, nullable=False, index=True)
    entity_name = Column(String, nullable=True)
    entity_type = Column(String(20), nullable=False)   # "business" | "prospect"
    event_types = Column(JSONB, nullable=False, default=list)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("entity_id", "entity_type", name="uq_event_enrollment_entity"),
    )
