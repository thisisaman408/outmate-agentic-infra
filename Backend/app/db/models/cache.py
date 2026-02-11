import uuid
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class CachedQuery(Base):
    """
    Caches query results for performance optimization.
    Reduces redundant API calls for identical searches.
    """
    __tablename__ = "cached_queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    query_hash = Column(String(64), unique=True, nullable=False, index=True)  # SHA-256 hash of query params
    search_type = Column(String(50), nullable=False)
    query_params = Column(JSONB, nullable=False)
    provider_source = Column(String(50))
    results = Column(JSONB, nullable=False)  # Cached results
    result_count = Column(Integer)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    hit_count = Column(Integer, default=0)  # Track cache usage
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
