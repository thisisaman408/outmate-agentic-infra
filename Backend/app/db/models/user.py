import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255))
    company_name = Column(String(255))
    credits_balance = Column(Integer, default=100)  # Give 100 free credits
    subscription_tier = Column(String(50), default='free')  # 'free', 'basic', 'pro', 'enterprise'
    is_active = Column(Boolean, default=True, index=True)
    # OAuth & verification
    google_id = Column(String(255), nullable=True, unique=True, index=True)
    is_email_verified = Column(Boolean, default=False)
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    gmail_access_token = Column(Text, nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    google_calendar_channel_id = Column(Text, nullable=True)
    google_calendar_resource_id = Column(Text, nullable=True)
    google_calendar_webhook_expiry = Column(DateTime(timezone=True), nullable=True)
    # Onboarding

    # Onboarding + settings state.  Restored 2026-04-18 after a merge accidentally
    # dropped these from the ORM — the columns still exist in the Supabase
    # schema (see alembic history) and the `/api/v1/auth/{me,onboarding,icp,
    # update-*}` endpoints in auth.py rely on them.  Removing the ORM fields
    # without removing the endpoints caused prod auth to 404 and kick users
    # into a logout loop.
    onboarding_completed = Column(Boolean, default=False)
    onboarding_step = Column(Integer, default=1)
    website_url = Column(String(500))
    user_role = Column(String(100))
    onboarding_data = Column(JSONB, default={}) # JSON for flexible extra data
    icp_config = Column(JSONB, default={})  # Versioned ICP configuration
    integrations = Column(JSONB, default={}) # Slack, HubSpot, Salesforce tokens & status
    onboarding_data = Column(JSONB, default={})   # flexible extra onboarding blob
    icp_config = Column(JSONB, default={})        # versioned ICP configuration
    integrations = Column(JSONB, default={})      # Slack / HubSpot / Salesforce status + tokens

    # HubSpot tokens stored in user_integrations table (not here)
    # to avoid Supabase ALTER TABLE timeout issues.
    # BYOK (Bring Your Own Key) for AI services
    anthropic_api_key = Column(Text, nullable=True)  # User's own Anthropic API key (encrypted in practice)
    use_byok = Column(Boolean, default=False)  # Flag to use BYOK instead of system credits
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))
