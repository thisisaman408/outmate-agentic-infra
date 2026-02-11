import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class Prospect(Base):
    __tablename__ = "prospects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), index=True)
    
    # Basic Info
    first_name = Column(String(255))
    last_name = Column(String(255))
    full_name = Column(String(500), index=True)
    email = Column(String(255), index=True)
    phone = Column(String(50))
    
    # Professional Info
    job_title = Column(String(500), index=True)
    seniority_level = Column(String(100), index=True)  # 'C-Level', 'VP', 'Director', 'Manager', 'Individual Contributor'
    department = Column(String(100), index=True)  # 'Sales', 'Engineering', 'Marketing', etc.
    job_function = Column(String(100))
    
    # Location
    country = Column(String(100))
    state = Column(String(100))
    city = Column(String(100))
    location_data = Column(JSONB, default={})
    
    # Social
    linkedin_url = Column(String(500))
    twitter_url = Column(String(500))
    
    # Metadata
    provider_source = Column(String(50), index=True)
    external_id = Column(String(255))
    raw_data = Column(JSONB, default={})
    enriched = Column(Boolean, default=False)
    data_quality_score = Column(Integer, default=0)
    email_verified = Column(Boolean, default=False)
    last_enriched_at = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
