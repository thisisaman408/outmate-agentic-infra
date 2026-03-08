"""
Meeting Prep Service — generates a pre-call brief for a company/prospect.
Enriches with real data from Explorium/Tavily before calling the LLM.
"""

import os
import uuid
import logging
import asyncio
from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import MEETING_PREP_SYSTEM_PROMPT
from app.services.copilot.enrichment import (
    enrich_company,
    fetch_recent_news,
    fetch_prospect_info,
    format_company_context,
    format_news_context,
    format_prospect_context,
)

logger = logging.getLogger(__name__)

MOCK_RESPONSE = {
    "company_snapshot": {
        "name": "Acme Corp",
        "industry": "HR Technology",
        "size": "500-1000 employees",
        "revenue": "$50M-$100M",
        "recent_news": ["Raised $20M Series B in January", "Expanding into European markets"],
        "tech_stack": ["Salesforce", "Slack", "Greenhouse"],
        "growth_indicators": ["Hiring 12 salespeople this quarter", "Opening 2 new offices"],
    },
    "prospect_profile": {
        "name": "Jane Doe",
        "title": "VP of Sales",
        "background": "10+ years in B2B SaaS sales, previously at HubSpot",
        "likely_priorities": ["Scaling outbound motion", "Improving SDR efficiency", "Pipeline visibility"],
        "communication_style_hint": "Data-driven — lead with metrics and ROI",
    },
    "talking_points": [
        "Acme is scaling fast — their hiring push means outreach volume will need to increase significantly",
        "Their Salesforce stack suggests they value structured data — Outmate integrates cleanly",
        "Series B funding means budget is likely available for new tools this quarter",
    ],
    "discovery_questions": [
        "What does your current outbound stack look like today?",
        "How are your SDRs currently identifying and prioritizing accounts?",
        "What's the biggest friction point in your prospecting workflow right now?",
        "How do you currently track buying signals from your target accounts?",
    ],
    "signals": [
        {"type": "hiring", "detail": "12 open sales roles on LinkedIn", "relevance": "High intent — scaling outbound team"},
        {"type": "funding", "detail": "Series B closed January 2026", "relevance": "Budget available for new tooling"},
    ],
    "risk_factors": [
        "May already be evaluating a competitor — Apollo or Outreach",
        "Large buying committee likely — VP alone may not be the decision maker",
    ],
    "competitors_mentioned": ["Apollo.io", "Outreach"],
    "recommended_approach": "Lead with their hiring signal — frame Outmate as the tool that helps their new SDRs ramp faster and hit quota sooner.",
}


class MeetingPrepService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def generate(
        self,
        user_id: str,
        company_name: str,
        company_domain: str | None,
        prospect_name: str | None,
        prospect_title: str | None,
        meeting_type: str,
        additional_context: str | None,
    ) -> dict:
        from app.db.models.copilot_meeting_prep import CopilotMeetingPrep

        if self.mock:
            content = MOCK_RESPONSE
        else:
            # --- Enrich with real data (fallback: empty strings) ---
            company_data, news, prospect_info = {}, [], []
            try:
                tasks = [
                    enrich_company(company_name, company_domain),
                    fetch_recent_news(company_name),
                ]
                if prospect_name:
                    tasks.append(fetch_prospect_info(prospect_name, company_name))

                results = await asyncio.gather(*tasks, return_exceptions=True)
                company_data = results[0] if not isinstance(results[0], Exception) else {}
                news = results[1] if not isinstance(results[1], Exception) else []
                if len(results) > 2:
                    prospect_info = results[2] if not isinstance(results[2], Exception) else []
            except Exception as exc:
                logger.warning("Enrichment failed, falling back to LLM-only: %s", exc)

            enrichment_block = "\n\n".join(filter(None, [
                format_company_context(company_data),
                format_news_context(news),
                format_prospect_context(prospect_info, prospect_name or "Unknown"),
            ]))

            user_prompt = (
                f"Company: {company_name}\n"
                f"Domain: {company_domain or 'Unknown'}\n"
                f"Prospect: {prospect_name or 'Unknown'}\n"
                f"Title: {prospect_title or 'Unknown'}\n"
                f"Meeting type: {meeting_type}\n"
                f"Additional context: {additional_context or 'None'}\n\n"
            )
            if enrichment_block:
                user_prompt += (
                    "Below is VERIFIED real-time data. Use it as the primary source — "
                    "do NOT contradict or fabricate data that conflicts with it.\n\n"
                    f"{enrichment_block}\n\n"
                )
            user_prompt += "Generate a comprehensive pre-call brief for this meeting."

            content = await self.openrouter.chat_completion_structured(
                system_prompt=MEETING_PREP_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=2000,
            )

        prep = CopilotMeetingPrep(
            id=uuid.uuid4(),
            user_id=user_id,
            company_name=company_name,
            company_domain=company_domain,
            prospect_name=prospect_name,
            prospect_title=prospect_title,
            meeting_type=meeting_type,
            content=content,
        )
        self.db.add(prep)
        self.db.commit()
        self.db.refresh(prep)

        return {"id": str(prep.id), **content}

    def get_history(self, user_id: str) -> list:
        from app.db.models.copilot_meeting_prep import CopilotMeetingPrep
        preps = (
            self.db.query(CopilotMeetingPrep)
            .filter(CopilotMeetingPrep.user_id == user_id)
            .order_by(CopilotMeetingPrep.created_at.desc())
            .limit(20)
            .all()
        )
        return [
            {
                "id": str(p.id),
                "company_name": p.company_name,
                "prospect_name": p.prospect_name,
                "meeting_type": p.meeting_type,
                "created_at": str(p.created_at),
            }
            for p in preps
        ]
