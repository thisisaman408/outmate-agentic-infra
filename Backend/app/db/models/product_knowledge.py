from sqlalchemy import Column, String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSVECTOR
from pgvector.sqlalchemy import Vector
import uuid
from app.db.base import Base

class ProductKnowledge(Base):
    """
    Stores documentation chunks and their vector embeddings for RAG (Retrieval-Augmented Generation).
    """
    __tablename__ = "product_knowledge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))  # all-MiniLM-L6-v2 dimension
    content_tsvector = Column(TSVECTOR)
    doc_metadata = Column(JSONB, default={})
    source_file = Column(String(255))
    created_at = Column(DateTime, server_default=func.now())
