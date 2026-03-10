"""
Campaign Optimizer Service — scores and suggests improvements for email campaigns.
Enriches with real target audience data from Explorium/Tavily before calling the LLM.

When lead context (lead_name + lead_company) is provided, activates the full
Email Optimizer pipeline: lead enrichment → personalized rewrite → follow-up
sequence → reply probability scoring.
"""

import os
import uuid
import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import (
    CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT,
    EMAIL_OPTIMIZER_SYSTEM_PROMPT,
)
from app.services.copilot.enrichment import (
    fetch_recent_news,
    format_news_context,
)
from app.services.copilot.lead_enrichment import LeadEnrichmentService

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

MOCK_EMAIL_OPTIMIZER_RESPONSE = {
    **MOCK_RESPONSE,
    "optimized_email": {
        "subject_line": "Saw {{companyName}}'s Series B — congrats, {{firstName}}",
        "body": (
            "Hey {{firstName}},\n\n"
            "Noticed {{companyName}} just closed your Series B — congrats. "
            "With the team scaling fast, outbound is probably top of mind.\n\n"
            "We help sales teams like yours 3x reply rates by replacing generic "
            "outreach with hyper-personalized emails powered by real-time signals "
            "(funding, hiring, tech stack changes).\n\n"
            "Worth a 15-min call Thursday to see if it fits?"
        ),
        "personalization_hooks_used": [
            "Referenced Series B funding round",
            "Mentioned team scaling (headcount growth signal)",
            "Connected value prop to their outbound scaling needs",
        ],
    },
    "follow_up_sequence": [
        {
            "delay_days": 3,
            "subject_line": "Re: {{companyName}}'s outbound scaling",
            "body": (
                "{{firstName}}, quick follow-up — I looked at how {{companyName}} "
                "is positioning and had a few specific ideas on improving your SDR "
                "reply rates. Happy to share over a quick call this week?"
            ),
            "strategy": "Add value by showing you did deeper research",
        },
        {
            "delay_days": 7,
            "subject_line": "{{firstName}}, one data point",
            "body": (
                "Teams at {{companyName}}'s stage typically see 40-60% of cold emails "
                "ignored. We've helped similar companies cut that to under 20%. "
                "Would a case study be useful?"
            ),
            "strategy": "Lead with a compelling stat and social proof",
        },
        {
            "delay_days": 14,
            "subject_line": "Closing the loop, {{firstName}}",
            "body": (
                "Hey {{firstName}}, I'll keep this short — if outbound isn't a "
                "priority right now, totally understand. If it ever is, I'm here. "
                "Either way, wishing {{companyName}} a great Q2."
            ),
            "strategy": "Breakup email — graceful, leaves door open",
        },
    ],
    "reply_probability": {
        "score": 34,
        "reasoning": (
            "The original email lacks personalization and uses a generic subject line. "
            "With enrichment data applied, the optimized version scores higher but the "
            "cold outreach context limits the ceiling."
        ),
        "boost_suggestions": [
            "Reference a specific LinkedIn post or talk by the lead",
            "Mention a mutual connection if one exists",
            "Time the send after a company announcement for relevance",
        ],
    },
    "enrichment_sources_used": ["google", "youtube", "linkedin", "explorium", "tavily_news"],
}


class CampaignOptimizerService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    def _has_lead_context(
        self,
        lead_name: Optional[str],
        lead_company: Optional[str],
    ) -> bool:
        return bool(lead_name and lead_company)

    async def analyze(
        self,
        user_id: str,
        subject_line: str,
        email_body: str,
        target_audience: str | None,
        campaign_id: str | None,
        metrics: dict | None,
        # Email optimizer lead fields
        lead_name: str | None = None,
        lead_company: str | None = None,
        lead_role: str | None = None,
        lead_domain: str | None = None,
    ) -> dict:
        from app.db.models.copilot_campaign_analysis import CopilotCampaignAnalysis

        use_optimizer = self._has_lead_context(lead_name, lead_company)

        input_data = {
            "subject_line": subject_line,
            "email_body": email_body,
            "target_audience": target_audience,
            "metrics": metrics,
        }
        if use_optimizer:
            input_data.update({
                "lead_name": lead_name,
                "lead_company": lead_company,
                "lead_role": lead_role,
                "lead_domain": lead_domain,
            })

        if self.mock:
            analysis = MOCK_EMAIL_OPTIMIZER_RESPONSE if use_optimizer else MOCK_RESPONSE
        else:
            if use_optimizer:
                analysis = await self._analyze_with_enrichment(
                    subject_line, email_body, target_audience, metrics,
                    lead_name, lead_company, lead_role, lead_domain,
                )
            else:
                analysis = await self._analyze_score_only(
                    subject_line, email_body, target_audience, metrics,
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

    # ------------------------------------------------------------------
    # Score-only path (existing behaviour — no lead context)
    # ------------------------------------------------------------------

    async def _analyze_score_only(
        self,
        subject_line: str,
        email_body: str,
        target_audience: str | None,
        metrics: dict | None,
    ) -> dict:
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

        return await self.openrouter.chat_completion_structured(
            system_prompt=CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.2,
            max_tokens=1500,
        )

    # ------------------------------------------------------------------
    # Full email optimizer path (lead context provided)
    # ------------------------------------------------------------------

    async def _analyze_with_enrichment(
        self,
        subject_line: str,
        email_body: str,
        target_audience: str | None,
        metrics: dict | None,
        lead_name: str,
        lead_company: str,
        lead_role: str | None,
        lead_domain: str | None,
    ) -> dict:
        # Run lead enrichment pipeline
        try:
            lead_ctx = await LeadEnrichmentService.enrich(
                name=lead_name,
                company=lead_company,
                role=lead_role or "",
                domain=lead_domain,
            )
        except Exception as exc:
            logger.warning("Lead enrichment failed, falling back to score-only: %s", exc)
            return await self._analyze_score_only(
                subject_line, email_body, target_audience, metrics,
            )

        enrichment_block = lead_ctx.to_prompt_context()

        metrics_text = ""
        if metrics:
            metrics_text = f"\nPerformance metrics: {metrics}"

        user_prompt = (
            f"ORIGINAL EMAIL TO OPTIMIZE:\n"
            f"Subject line: {subject_line}\n"
            f"Email body:\n{email_body}\n"
            f"Target audience: {target_audience or 'B2B sales prospects'}"
            f"{metrics_text}\n\n"
            f"LEAD INFORMATION:\n"
            f"Name: {lead_name}\n"
            f"Company: {lead_company}\n"
            f"Role: {lead_role or 'Unknown'}\n\n"
        )

        if enrichment_block:
            user_prompt += (
                "Below is REAL intelligence gathered about this lead and their company. "
                "Use this data to personalize the email — reference specific things "
                "they've said, done, or that their company has achieved recently.\n\n"
                f"{enrichment_block}\n\n"
            )

        user_prompt += (
            "Rewrite this email to be hyper-personalized using the lead intelligence above. "
            "Also generate a 3-email follow-up sequence and score the reply probability."
        )

        result = await self.openrouter.chat_completion_structured(
            system_prompt=EMAIL_OPTIMIZER_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=3000,
        )

        # Flatten nested analysis if the LLM wrapped scores inside "analysis"
        if "analysis" in result and isinstance(result["analysis"], dict):
            analysis_inner = result.pop("analysis")
            for key in ("overall_score", "category_scores", "weaknesses", "improvements"):
                if key in analysis_inner and key not in result:
                    result[key] = analysis_inner[key]

        result["enrichment_sources_used"] = lead_ctx.sources_used
        return result
