"""
CopilotService — orchestrator that composes all Co-Pilot sub-services.
"""

from sqlalchemy.orm import Session

from app.services.copilot.daily_brief_service import DailyBriefService
from app.services.copilot.meeting_prep_service import MeetingPrepService
from app.services.copilot.campaign_optimizer_service import CampaignOptimizerService
from app.services.copilot.pipeline_risk_service import PipelineRiskService


class CopilotService:
    def __init__(self, db: Session):
        self.db = db
        self.daily_brief = DailyBriefService(db)
        self.meeting_prep = MeetingPrepService(db)
        self.campaign_optimizer = CampaignOptimizerService(db)
        self.pipeline_risk = PipelineRiskService(db)
