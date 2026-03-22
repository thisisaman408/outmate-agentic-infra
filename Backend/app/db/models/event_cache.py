from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class EventCache(Base):
    """Stores fetched Explorium event cards in DB to avoid re-fetching same-day data."""
    __tablename__ = "event_cache"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    event_uid      = Column(String, unique=True, nullable=False, index=True)   # normalized card ID
    entity_id      = Column(String, nullable=False, index=True)
    entity_name    = Column(String, nullable=True)
    entity_type    = Column(String(20), nullable=False)   # "business" | "prospect"
    event_type     = Column(String, nullable=False)
    event_label    = Column(String, nullable=True)
    category       = Column(String, nullable=True)
    timestamp      = Column(String, nullable=True)         # ISO string from Explorium
    description    = Column(Text, nullable=True)
    source_url     = Column(String, nullable=True)
    impact         = Column(String, nullable=True)
    event_metadata = Column(JSONB, nullable=True)
    fetched_at     = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
