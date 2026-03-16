import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base

class SearchResult(Base):
    """
    Links search queries to their results (companies or prospects).
    Stores position ordering and relevance scores.
    """
    __tablename__ = "search_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # search_queries is a SERIAL (integer) vector-store table; store id without FK
    search_query_id = Column(Integer, nullable=True, index=True)
    result_type = Column(String(50), nullable=False)  # 'company' or 'prospect'
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    prospect_id = Column(UUID(as_uuid=True), ForeignKey("prospects.id", ondelete="CASCADE"), index=True)
    result_position = Column(Integer)  # Order in results (1, 2, 3...)
    relevance_score = Column(Numeric(5, 2))  # 0-100
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            """
            (result_type = 'company' AND company_id IS NOT NULL AND prospect_id IS NULL) OR
            (result_type = 'prospect' AND prospect_id IS NOT NULL)
            """,
            name='check_result_type_consistency'
        ),
    )
