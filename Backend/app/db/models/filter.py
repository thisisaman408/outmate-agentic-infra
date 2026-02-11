import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class AvailableFilter(Base):
    """
    Defines all available filters that can be used in searches.
    Provider-agnostic filter definitions.
    """
    __tablename__ = "available_filters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filter_key = Column(String(100), unique=True, nullable=False, index=True)  # 'industry', 'employee_count', etc.
    filter_name = Column(String(255), nullable=False)
    filter_category = Column(String(100), index=True)  # 'company', 'prospect', 'technographic', 'firmographic'
    filter_type = Column(String(50), nullable=False, index=True)  # 'basic', 'advanced', 'premium'
    data_type = Column(String(50), nullable=False)  # 'string', 'array', 'range', 'number', 'boolean', 'object'
    input_type = Column(String(50))  # 'select', 'multiselect', 'range', 'text', 'number'
    is_locked = Column(Boolean, default=False)
    credits_required = Column(Integer, default=0)
    display_order = Column(Integer, default=0)
    options = Column(JSONB, default=[])  # For dropdowns: ["Option 1", "Option 2"]
    validation_rules = Column(JSONB, default={})
    help_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProviderFilterMapping(Base):
    """
    Maps provider-agnostic filters to provider-specific filter keys.
    Allows different providers to support the same logical filter with different implementations.
    """
    __tablename__ = "provider_filter_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("data_providers.id", ondelete="CASCADE"), nullable=False)
    filter_id = Column(UUID(as_uuid=True), ForeignKey("available_filters.id", ondelete="CASCADE"), nullable=False)
    provider_filter_key = Column(String(200))  # How this provider calls this filter
    is_supported = Column(Boolean, default=True)
    mapping_config = Column(JSONB, default={})  # Transformation rules
    created_at = Column(DateTime(timezone=True), server_default=func.now())
