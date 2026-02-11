import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func
from app.db.base import Base

class ApiUsageLog(Base):
    """
    Logs all API usage for monitoring, analytics, and debugging.
    Helps track performance, errors, and usage patterns.
    """
    __tablename__ = "api_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    endpoint = Column(String(255), nullable=False, index=True)
    method = Column(String(10), nullable=False)  # GET, POST, etc.
    status_code = Column(Integer)
    response_time_ms = Column(Integer)
    request_params = Column(JSONB, default={})
    ip_address = Column(INET)
    user_agent = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
