"""
Integration catalog + per-user connection models.

Integration  — master catalog of all 107 integrations (seeded at startup)
UserIntegration — per-user connected integrations with encrypted credentials
"""

import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class Integration(Base):
    """Master catalog of all available integrations."""
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    category = Column(String(50), nullable=False, index=True)
    icon_url = Column(String(500), nullable=True)
    auth_type = Column(String(50), nullable=False, default="api_key")
    auth_config = Column(JSONB, default={})
    is_active = Column(Boolean, default=True)
    is_coming_soon = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    is_built_in = Column(Boolean, default=False)
    supported_actions = Column(JSONB, default=[])
    supported_triggers = Column(JSONB, default=[])
    default_field_mappings = Column(JSONB, default={})
    documentation_url = Column(String(500), nullable=True)
    rate_limit_per_minute = Column(Integer, default=60)
    credit_cost = Column(String(100), nullable=True)
    setup_steps = Column(JSONB, default=[])
    features = Column(JSONB, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserIntegration(Base):
    """Per-user connected integration."""
    __tablename__ = "user_integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"), nullable=False)
    status = Column(String(20), default="connected")  # connected, disconnected, error, expired
    credentials_encrypted = Column(Text, nullable=True)
    config = Column(JSONB, default={})
    extra_data = Column("metadata", JSONB, default={})  # instance_url, workspace_name, etc.
    connected_at = Column(DateTime(timezone=True), server_default=func.now())
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "integration_id", name="uq_user_integration"),
    )
