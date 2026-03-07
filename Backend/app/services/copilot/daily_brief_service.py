"""
Daily Brief Service — generates a prioritized action list for the sales rep.
"""

import os
import uuid
import logging
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import DAILY_BRIEF_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

MOCK_RESPONSE = {
    "summary": "You have 3 hot signals and 2 prospects going cold today. Focus on Acme Corp and TechCorp first.",
    "priority_actions": [
        {"priority": 1, "action": "Follow up with John at Acme Corp", "reason": "No contact in 8 days", "entity": "Acme Corp", "entity_type": "company"},
        {"priority": 2, "action": "Review TechCorp Series B signal", "reason": "Funding announced yesterday — high intent window", "entity": "TechCorp", "entity_type": "company"},
        {"priority": 3, "action": "Re-engage Sarah at DataFlow Inc", "reason": "Opened your email 3 times but never replied", "entity": "DataFlow Inc", "entity_type": "prospect"},
    ],
    "new_signals": [
        {"signal_type": "funding", "entity": "TechCorp", "description": "Raised $15M Series B", "urgency": "high"},
        {"signal_type": "hiring", "entity": "Acme Corp", "description": "Posted 3 new SDR roles", "urgency": "medium"},
    ],
    "follow_ups": [
        {"prospect": "John Smith", "company": "Acme Corp", "last_contact": "8 days ago", "suggested_action": "Send a value-add follow-up referencing their SDR hiring push"},
        {"prospect": "Sarah Lee", "company": "DataFlow Inc", "last_contact": "5 days ago", "suggested_action": "Try a different channel — connect on LinkedIn"},
    ],
    "key_metrics": {
        "active_campaigns": 2,
        "open_rate_trend": "up",
        "new_leads_today": 4,
        "signals_detected": 2,
    },
}


class DailyBriefService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def get_or_generate(self, user_id: str) -> dict:
        """Return today's brief from DB if it exists, otherwise generate a new one."""
        from app.db.models.copilot_brief import CopilotBrief
        today = date.today()
        existing = (
            self.db.query(CopilotBrief)
            .filter(CopilotBrief.user_id == user_id, CopilotBrief.brief_date == today)
            .first()
        )
        if existing:
            return self._format(existing)
        return await self.generate(user_id)

    async def generate(self, user_id: str) -> dict:
        """Force-generate a new daily brief for today."""
        from app.db.models.copilot_brief import CopilotBrief

        if self.mock:
            content = MOCK_RESPONSE
        else:
            user_prompt = (
                "Generate a daily brief for a B2B sales rep. "
                "They have no specific data connected yet — generate a realistic example brief "
                "with sample company names and signals to show what the feature looks like."
            )
            content = await self.openrouter.chat_completion_structured(
                system_prompt=DAILY_BRIEF_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=1500,
            )

        today = date.today()
        # Upsert: delete existing brief for today if present, then insert new
        self.db.query(CopilotBrief).filter(
            CopilotBrief.user_id == user_id,
            CopilotBrief.brief_date == today,
        ).delete()

        brief = CopilotBrief(
            id=uuid.uuid4(),
            user_id=user_id,
            brief_date=today,
            brief_type="daily",
            content=content,
            status="generated",
        )
        self.db.add(brief)
        self.db.commit()
        self.db.refresh(brief)
        return self._format(brief)

    def _format(self, brief) -> dict:
        return {
            "id": str(brief.id),
            "brief_date": str(brief.brief_date),
            "status": brief.status,
            **brief.content,
        }
