import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class SignalEvent(Base):
    """
    Persistent signal event storage.

    Signals are events detected from various sources (CrustData, Explorium, RSS, webhooks).
    Each signal is enriched, deduplicated, scored for ICP match, and routed to Co-Pilot.

    Signal types:
    - job_change: Prospect changed job or company
    - funding: Company raised funding round
    - hiring: Company has open job positions / hiring activity
    - g2_intent: Prospect/company mentioned in reviews or switching context
    - website_visit: Anonymous visitor enriched to person+company
    - email_open: Campaign email opened by prospect
    - linkedin_activity: New LinkedIn post or activity detected
    """

    __tablename__ = "signal_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ─────────────────────────────────────────────────────────────
    # Core Signal Data
    # ─────────────────────────────────────────────────────────────
    signal_type = Column(String(50), nullable=False, index=True)
    # job_change | funding | hiring | g2_intent | website_visit | email_open | linkedin_activity

    # Company context
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True)
    company_domain = Column(String(255), nullable=True, index=True)
    company_name = Column(String(500), nullable=True)

    # Prospect context (optional)
    prospect_id = Column(UUID(as_uuid=True), ForeignKey("prospects.id", ondelete="SET NULL"), nullable=True, index=True)
    prospect_email = Column(String(255), nullable=True)
    prospect_name = Column(String(500), nullable=True)
    prospect_title = Column(String(500), nullable=True)

    # ─────────────────────────────────────────────────────────────
    # Source & Raw Data
    # ─────────────────────────────────────────────────────────────
    source = Column(String(100), nullable=False)  # crustdata | explorium | rss | webhook | g2 | visitor | campaign
    raw_data = Column(JSONB, default={})  # Complete original API response or event

    # ─────────────────────────────────────────────────────────────
    # Enrichment
    # ─────────────────────────────────────────────────────────────
    icp_score = Column(Integer, nullable=True)  # 0-100 match to user's ICP
    icp_match_factors = Column(JSONB, default=[])  # ["hiring", "target_industry", ...]

    # ─────────────────────────────────────────────────────────────
    # Deduplication & Freshness
    # ─────────────────────────────────────────────────────────────
    fingerprint = Column(String(32), nullable=True, index=True)  # MD5(source+company+type+key_data)
    is_archived = Column(Boolean, default=False, index=True)  # Signals >7 days old
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # ─────────────────────────────────────────────────────────────
    # Credit Tracking
    # ─────────────────────────────────────────────────────────────
    credits_consumed = Column(Integer, default=0)

    # ─────────────────────────────────────────────────────────────
    # Co-Pilot Routing
    # ─────────────────────────────────────────────────────────────
    sent_to_copilot = Column(Boolean, default=False)
    copilot_queue_id = Column(String(255), nullable=True)  # Reference to item in Redis queue

    # ─────────────────────────────────────────────────────────────
    # Timestamps
    # ─────────────────────────────────────────────────────────────
    discovered_at = Column(DateTime(timezone=True), nullable=False)  # When signal actually occurred
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)  # When we received it
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("fingerprint", "company_domain", "signal_type", name="uq_signal_fingerprint_dedup"),
    )
