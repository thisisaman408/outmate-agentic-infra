"""
Daily Brief Service — generates a prioritized action list for the sales rep.
Enriches with real signal data from Explorium/Tavily before calling the LLM.
"""

import os
import uuid
import logging
import asyncio
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import DAILY_BRIEF_SYSTEM_PROMPT
from app.services.copilot.enrichment import (
    fetch_recent_news,
    format_news_context,
)

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

    async def get_or_generate(self, user_id: str) -> tuple[dict, bool]:
        """Return today's brief from DB if it exists, otherwise generate a new one.
        
        Returns:
            Tuple of (brief_dict, was_generated) — was_generated is True if a new
            LLM call was made (and credits should be deducted).
        """
        from app.db.models.copilot_brief import CopilotBrief
        today = date.today()
        existing = (
            self.db.query(CopilotBrief)
            .filter(CopilotBrief.user_id == user_id, CopilotBrief.brief_date == today)
            .first()
        )
        if existing:
            return self._format(existing), False
        result = await self.generate(user_id)
        return result, True

    async def generate(self, user_id: str) -> dict:
        """Force-generate a new daily brief for today."""
        from app.db.models.copilot_brief import CopilotBrief

        if self.mock:
            content = MOCK_RESPONSE
        else:
            # --- Gather real context: DB data + recent news ---
            db_context_lines = []
            news_block = ""

            # 1. Pull real campaigns from DB (if table exists)
            try:
                from app.db.models.campaign import Campaign
                campaigns = (
                    self.db.query(Campaign)
                    .filter(Campaign.user_id == user_id)
                    .order_by(Campaign.created_at.desc())
                    .limit(5)
                    .all()
                )
                if campaigns:
                    db_context_lines.append("=== YOUR ACTIVE CAMPAIGNS ===")
                    for c in campaigns:
                        line = f"- {c.name}: status={c.status}"
                        if hasattr(c, "open_rate") and c.open_rate is not None:
                            line += f", open_rate={c.open_rate}%"
                        if hasattr(c, "reply_rate") and c.reply_rate is not None:
                            line += f", reply_rate={c.reply_rate}%"
                        db_context_lines.append(line)
                    db_context_lines.append("=== END CAMPAIGNS ===")
            except Exception as exc:
                logger.debug("Could not fetch campaigns for daily brief: %s", exc)

            # 2. Pull recent pipeline alerts from DB
            try:
                from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert
                alerts = (
                    self.db.query(CopilotPipelineAlert)
                    .filter(CopilotPipelineAlert.user_id == user_id, CopilotPipelineAlert.is_resolved == False)
                    .order_by(CopilotPipelineAlert.created_at.desc())
                    .limit(5)
                    .all()
                )
                if alerts:
                    db_context_lines.append("=== UNRESOLVED PIPELINE ALERTS ===")
                    for a in alerts:
                        db_context_lines.append(f"- [{a.severity}] {a.title}: {a.description}")
                    db_context_lines.append("=== END ALERTS ===")
            except Exception as exc:
                logger.debug("Could not fetch pipeline alerts for daily brief: %s", exc)

            # 3. Fetch trending B2B/sales news via Tavily
            try:
                news = await fetch_recent_news("B2B sales technology trends", max_results=3)
                news_block = format_news_context(news)
            except Exception as exc:
                logger.debug("News fetch failed for daily brief: %s", exc)

            db_context = "\n".join(db_context_lines) if db_context_lines else ""
            enrichment_block = "\n\n".join(filter(None, [db_context, news_block]))

            if enrichment_block:
                user_prompt = (
                    "Generate a daily brief for a B2B sales rep. "
                    "Below is REAL data from their account. Use it as the primary source — "
                    "do NOT invent companies or metrics that are not listed below.\n\n"
                    f"{enrichment_block}\n\n"
                    "Based on this data, generate a prioritized daily brief."
                )
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
