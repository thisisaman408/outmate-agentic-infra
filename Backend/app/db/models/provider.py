import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class DataProvider(Base):
    __tablename__ = "data_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_name = Column(String(100), unique=True, nullable=False)
    provider_slug = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Higher = preferred
    api_base_url = Column(String(500))
    rate_limit_per_minute = Column(Integer, default=60)
    configuration = Column(JSONB, default={})  # API keys, endpoints, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
