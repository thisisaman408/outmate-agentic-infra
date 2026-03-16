import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, BigInteger, Text
from sqlalchemy.dialects.postgresql import UUID  # still used by id and user_id
from sqlalchemy.sql import func
from app.db.base import Base

class ExportJob(Base):
    __tablename__ = "export_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # search_queries is a SERIAL (integer) vector-store table managed by vector_setup.py.
    # We store the integer id here without a FK constraint to avoid the UUID/integer type clash
    # that breaks Base.metadata.create_all().
    search_query_id = Column(Integer, nullable=True)
    
    export_format = Column(String(50), nullable=False)  # 'csv', 'xlsx', 'json'
    record_count = Column(Integer, default=0)
    file_size_bytes = Column(BigInteger)
    file_url = Column(Text)  # S3/Storage URL
    
    status = Column(String(50), default='pending', index=True)  # 'pending', 'processing', 'completed', 'failed'
    error_message = Column(Text)
    
    expires_at = Column(DateTime(timezone=True))  # Download link expiration
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
