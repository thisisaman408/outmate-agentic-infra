import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class CopilotCampaignAnalysis(Base):
    __tablename__ = "copilot_campaign_analyses"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), nullable=False, index=True)
    campaign_id = Column(String(255), nullable=True)
    input_data  = Column(JSONB, nullable=False)
    analysis    = Column(JSONB, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
