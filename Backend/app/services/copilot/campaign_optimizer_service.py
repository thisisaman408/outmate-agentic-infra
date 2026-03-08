"""
Campaign Optimizer Service — scores and suggests improvements for email campaigns.
Enriches with real target audience data from Explorium/Tavily before calling the LLM.
"""

import os
import uuid
import logging
from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT
from app.services.copilot.enrichment import (
    fetch_recent_news,
    format_news_context,
)

logger = logging.getLogger(__name__)

MOCK_RESPONSE = {
    "overall_score": 42,
    "category_scores": {
        "subject_line": 35,
        "personalization": 30,
        "value_proposition": 50,
        "call_to_action": 55,
        "tone_and_length": 60,
        "spam_risk": 80,
    },
    "weaknesses": [
        "Subject line is too generic — no prospect context",
        "Opening line starts with 'I' — prospect-centric openers perform better",
        "No specific value proposition tied to their business situation",
    ],
    "improvements": [
        "Reference a specific signal in the subject line (e.g., hiring activity, funding round)",
        "Open with something about them, not about you",
        "Add a single, specific CTA — avoid vague asks like 'let me know if interested'",
    ],
    "suggested_subjects": [
        "Saw {{companyName}} is scaling outbound — quick idea",
        "{{firstName}}, your SDR team just grew — here's what helps",
        "How teams like {{companyName}} 3x reply rates",
    ],
    "suggested_openers": [
        "Hey {{firstName}}, noticed {{companyName}} just posted 3 SDR roles — congrats on the growth.",
        "{{firstName}} — saw {{companyName}} closed their Series B. Exciting time to be building out the sales team.",
    ],
    "predicted_lift": "Estimated 8-12% improvement in open rate and 3-5% improvement in reply rate if subject line and opener are updated.",
}


class CampaignOptimizerService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def analyze(
        self,
        user_id: str,
        subject_line: str,
        email_body: str,
        target_audience: str | None,
        campaign_id: str | None,
        metrics: dict | None,
    ) -> dict:
        from app.db.models.copilot_campaign_analysis import CopilotCampaignAnalysis

        input_data = {
            "subject_line": subject_line,
            "email_body": email_body,
            "target_audience": target_audience,
            "metrics": metrics,
        }

        if self.mock:
            analysis = MOCK_RESPONSE
        else:
            # --- Enrich: fetch industry news for the target audience ---
            news_block = ""
            if target_audience:
                try:
                    news = await fetch_recent_news(f"{target_audience} industry trends", max_results=3)
                    news_block = format_news_context(news)
                except Exception as exc:
                    logger.debug("Campaign optimizer news fetch failed: %s", exc)

            metrics_text = ""
            if metrics:
                metrics_text = f"\nPerformance metrics: {metrics}"
            user_prompt = (
                f"Subject line: {subject_line}\n"
                f"Email body:\n{email_body}\n"
                f"Target audience: {target_audience or 'B2B sales prospects'}"
                f"{metrics_text}\n\n"
            )
            if news_block:
                user_prompt += (
                    "Below is REAL industry news about the target audience. "
                    "Use it to suggest more relevant and timely subject lines and openers.\n\n"
                    f"{news_block}\n\n"
                )
            user_prompt += "Analyze this campaign and provide optimization recommendations."

            analysis = await self.openrouter.chat_completion_structured(
                system_prompt=CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1500,
            )

        record = CopilotCampaignAnalysis(
            id=uuid.uuid4(),
            user_id=user_id,
            campaign_id=campaign_id,
            input_data=input_data,
            analysis=analysis,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)

        return {"id": str(record.id), **analysis}
