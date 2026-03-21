from app.db.models.user import User
from app.db.models.provider import DataProvider
from app.db.models.company import Company
from app.db.models.prospect import Prospect
from app.db.models.search import SearchQuery
from app.db.models.credit import CreditTransaction
from app.db.models.export import ExportJob
from app.db.models.filter import AvailableFilter, ProviderFilterMapping
from app.db.models.search_result import SearchResult
from app.db.models.cache import CachedQuery
from app.db.models.api_log import ApiUsageLog
# Keep both lines below
from app.db.models.chat_session import NLPChatSession
from app.db.models.visitor import SiteConfig, Visit, Alert
# Copilot models
from app.db.models.copilot_brief import CopilotBrief
from app.db.models.copilot_meeting_prep import CopilotMeetingPrep
from app.db.models.copilot_campaign_analysis import CopilotCampaignAnalysis
from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert
from app.db.models.copilot_preferences import CopilotUserPreferences
from app.db.models.product_knowledge import ProductKnowledge
from app.db.models.copilot_chat_session import CopilotChatSession

__all__ = [
    "User",
    "DataProvider",
    "Company",
    "Prospect",
    "SearchQuery",
    "CreditTransaction",
    "ExportJob",
    "AvailableFilter",
    "ProviderFilterMapping",
    "SearchResult",
    "CachedQuery",
    "ApiUsageLog",
    # Keep both blocks below
    "NLPChatSession",
    "SiteConfig",
    "Visit",
    "Alert",
    # Copilot models
    "CopilotBrief",
    "CopilotMeetingPrep",
    "CopilotCampaignAnalysis",
    "CopilotPipelineAlert",
    "CopilotUserPreferences",
    "ProductKnowledge",
    "CopilotChatSession",
]