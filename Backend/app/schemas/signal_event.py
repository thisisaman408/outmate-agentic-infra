from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional


class SignalEvent(BaseModel):
    type: Literal[
        "job_change", "funding", "intent", "interested_reply",
        "champion_move", "icp_update", "hiring", "news", "other"
    ]
    company: str
    contact: str
    icp_score: float = Field(ge=0, le=100)
    signal_context: str
    timestamp: datetime
    user_id: str
    prospect_id: Optional[str] = None
    company_id: Optional[str] = None
