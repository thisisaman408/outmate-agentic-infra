import uuid
from sqlalchemy import Column, String, Text, DateTime, Boolean, Float, Integer, ForeignKey
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
    # HMAC secret for webhook signature (auto-generated, shown once to customer)
    webhook_secret = Column(String(64))
    # Per-org ISP allowlist — keywords that override the global ISP block list
    # e.g. ["cloudflare", "google"] for employees on corp VPN
    isp_allowlist = Column(JSONB, server_default='[]')
    # GDPR: anonymize IPs stored in the visits table (mask last octet)
    anonymize_ips = Column(Boolean, default=False)
    # GDPR: respect visitor opt-out tokens stored in Redis
    gdpr_mode = Column(Boolean, default=False)
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
    # 'pending' | 'processing' | 'done' | 'failed' — visible on dashboard
    enrichment_status = Column(String(20), default="pending", nullable=False)
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


class VisitorSession(Base):
    """
    Groups individual page-view Visit records into logical sessions.
    A session = all visits from the same visitor_id within a 30-minute
    inactivity window.  Created/extended by the enrichment task.
    """
    __tablename__ = "visitor_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("site_configs.org_id", ondelete="CASCADE"))
    visitor_id = Column(String(64), index=True, nullable=False)
    session_start = Column(DateTime(timezone=True), nullable=False)
    session_end = Column(DateTime(timezone=True))
    page_count = Column(Integer, default=1)
    total_dwell_ms = Column(Integer, default=0)
    avg_scroll_depth = Column(Float, default=0.0)
    total_cta_clicks = Column(Integer, default=0)
    entry_url = Column(Text)
    exit_url = Column(Text)
    referrer = Column(Text)
    # Snapshot of behavioral scores at session close
    predicted_persona = Column(String(50))
    buying_stage = Column(String(20))
    engagement_score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
