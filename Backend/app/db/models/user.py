import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
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
    # BYOK (Bring Your Own Key) for AI services
    anthropic_api_key = Column(Text, nullable=True)  # User's own Anthropic API key (encrypted in practice)
    use_byok = Column(Boolean, default=False)  # Flag to use BYOK instead of system credits
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))
