import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # Positive for purchase, negative for usage
    transaction_type = Column(String(50), nullable=False, index=True)  # 'purchase', 'usage', 'refund', 'bonus'
    reference_id = Column(UUID(as_uuid=True))  # Link to search_query or other entities
    description = Column(Text)
    transaction_metadata = Column('metadata', JSONB, default={})  # Additional data (column name 'metadata' in DB)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
