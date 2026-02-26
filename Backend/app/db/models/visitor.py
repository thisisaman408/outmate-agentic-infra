import uuid
from sqlalchemy import Column, String, Text, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base

class SiteConfig(Base):
    __tablename__ = "site_configs"

    org_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pixel_key = Column(String(255), unique=True, nullable=False, index=True)
    domain = Column(String(255))
    icp_filters = Column(JSONB, server_default='{}')
    webhook_urls = Column(JSONB, server_default='[]')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    visits = relationship("Visit", back_populates="site_config", cascade="all, delete-orphan")

class Visit(Base):
    __tablename__ = "visits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"))
    ip = Column(INET, nullable=False)
    url = Column(Text, nullable=False)
    referrer = Column(Text)
    user_agent = Column(Text)
    intent_score = Column(Float, default=0.5)
    resolution = Column(JSONB)
    matched = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    site_config = relationship("SiteConfig", back_populates="visits")
    alerts = relationship("Alert", back_populates="visit", cascade="all, delete-orphan")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id = Column(UUID(as_uuid=True), ForeignKey("visits.id", ondelete="CASCADE"))
    webhook_type = Column(String(50))
    status = Column(String(20))
    payload = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    visit = relationship("Visit", back_populates="alerts")
