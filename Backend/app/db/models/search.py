import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class SearchQuery(Base):
    __tablename__ = "search_queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Query Details
    query_name = Column(String(255))  # User-given name for saved searches
    search_type = Column(String(50), nullable=False, index=True)  # 'companies', 'prospects', 'combined'
    query_params = Column(JSONB, nullable=False)  # Full filter parameters
    
    # Results
    result_count = Column(Integer, default=0)
    credits_used = Column(Integer, default=0)
    
    # Providers Used
    providers_used = Column(JSONB, default=[])  # ["crustdata", "exellius"]
    primary_provider = Column(String(50))
    
    # Performance
    execution_time_ms = Column(Integer)
    
    # Status
    status = Column(String(50), default='completed')  # 'pending', 'processing', 'completed', 'failed'
    error_message = Column(Text)
    
    # Saved Search
    is_saved = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
