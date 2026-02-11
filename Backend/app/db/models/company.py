import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Integer, BigInteger, Date, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Basic Info
    name = Column(String(500), index=True)
    domain = Column(String(255), unique=True, index=True)
    website = Column(String(500))
    description = Column(Text)
    
    # Firmographic Data
    industry = Column(String(255), index=True)
    sub_industry = Column(String(255), nullable=True)
    employee_count_range = Column(String(50), index=True)  # '1-10', '11-50', etc.
    employee_count_exact = Column(Integer, nullable=True)
    revenue_range = Column(String(50), nullable=True)
    revenue_exact = Column(BigInteger, nullable=True)
    
    # Location
    headquarters_country = Column(String(100), index=True, nullable=True)
    headquarters_state = Column(String(100), nullable=True)
    headquarters_city = Column(String(100), nullable=True)
    headquarters_address = Column(Text, nullable=True)
    location_data = Column(JSONB, default={}, nullable=True)  # Full location details
    
    # Company Details
    founded_year = Column(Integer, nullable=True)
    company_type = Column(String(100), nullable=True)  # 'private', 'public', 'non-profit'
    stock_symbol = Column(String(20), nullable=True)
    
    # Contact
    phone = Column(String(50), nullable=True)
    
    # Technographic
    technologies = Column(JSONB, default=[], nullable=True)  # ["Salesforce", "AWS", "React"]
    
    # Additional Firmographic
    categories = Column(JSONB, default=[], nullable=True)  # Company categories
    market_segments = Column(JSONB, default=[], nullable=True)  # Target market segments
    acquisition_status = Column(String(50), nullable=True)  # 'acquired' or None
    
    # Funding (if available)
    funding_stage = Column(String(100), nullable=True)  # 'seed', 'series_a', etc.
    funding_total = Column(BigInteger, nullable=True)
    last_funding_date = Column(Date, nullable=True)
    
    # Headcount Growth Metrics
    employee_growth_6m = Column(Integer, nullable=True)  # 6-month growth absolute
    employee_growth_12m = Column(Integer, nullable=True)  # 12-month growth absolute
    employee_growth_6m_percent = Column(Integer, nullable=True)  # 6-month growth percentage
    employee_growth_12m_percent = Column(Integer, nullable=True)  # 12-month growth percentage
    
    # Department headcount (stored as JSONB)
    department_headcount = Column(JSONB, default={}, nullable=True)  
    # Example: {"engineering": 50, "sales": 20, "marketing": 10}
    
    # Social
    linkedin_url = Column(String(500), nullable=True)
    twitter_url = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)
    
    # Social Metrics
    follower_count = Column(Integer, nullable=True)  # LinkedIn followers
    follower_growth_6m = Column(Integer, nullable=True)  # 6-month follower growth
    
    # Metadata
    provider_source = Column(String(50), index=True, nullable=True)  # Which provider gave us this data
    external_id = Column(String(255), nullable=True)  # Provider's ID for this company
    raw_data = Column(JSONB, default={}, nullable=True)  # Full original response from provider
    enriched = Column(Boolean, default=False, index=True)
    data_quality_score = Column(Integer, default=0)  # 0-100
    last_enriched_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
