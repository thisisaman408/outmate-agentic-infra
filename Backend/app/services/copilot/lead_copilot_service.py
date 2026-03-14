"""
Lead Copilot Service — orchestrates AI actions for the lead-activated copilot panel.
Routes action types to appropriate sub-services with prospect context injected.
"""

import json
import logging
import os
import re
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.lead_enrichment import LeadContext, LeadEnrichmentService
from app.services.copilot.prompts import (
    ANNOTATED_EMAIL_SYSTEM_PROMPT,
    LEAD_RESEARCH_SYSTEM_PROMPT,
    OBJECTION_HANDLER_SYSTEM_PROMPT,
    LEAD_CUSTOM_COMMAND_SYSTEM_PROMPT,
    LEAD_SUGGESTIONS_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)

# ── Mock responses for MOCK_LLM=true ─────────────────────────

MOCK_ANNOTATED_EMAIL = {
    "subject_line": "Re: your talk on scaling outbound",
    "segments": [
        {
            "text": "Loved your point about automation being the key to scaling outbound without scaling headcount.",
            "tag": "PERSONALIZATION",
            "source": "YouTube keynote — SaaS Summit 2025",
            "source_url": None,
            "why": "References prospect's own words from a public talk",
        },
        {
            "text": "That's exactly what we're seeing with founders drowning in manual prospecting.",
            "tag": "RELEVANCE",
            "source": "LinkedIn post about prospecting challenges",
            "source_url": None,
            "why": "Connects their stated pain point to your value",
        },
        {
            "text": "Outmate automates the entire lead research and outreach pipeline so your team can focus on closing.",
            "tag": "VALUE_PROP",
            "source": None,
            "source_url": None,
            "why": "Clear product positioning tied to their specific problem",
        },
        {
            "text": "Given your Series B last month, scaling outbound without scaling headcount is probably top of mind.",
            "tag": "TIMING",
            "source": "Explorium — Series B funding detected",
            "source_url": None,
            "why": "Funding event creates urgency and budget availability",
        },
        {
            "text": "Worth a quick look? Happy to send a 1-page breakdown.",
            "tag": "CTA",
            "source": None,
            "source_url": None,
            "why": "Low-friction ask with single option",
        },
    ],
    "full_text": (
        "Loved your point about automation being the key to scaling outbound "
        "without scaling headcount. That's exactly what we're seeing with founders "
        "drowning in manual prospecting. Outmate automates the entire lead research "
        "and outreach pipeline so your team can focus on closing. Given your Series B "
        "last month, scaling outbound without scaling headcount is probably top of mind. "
        "Worth a quick look? Happy to send a 1-page breakdown."
    ),
    "enrichment_sources_used": ["YouTube (Serper)", "LinkedIn (Tavily)", "Explorium"],
}

MOCK_RESEARCH = {
    "executive_summary": "Senior executive with 15+ years in B2B SaaS. Active thought leader on LinkedIn and conference circuit.",
    "professional_profile": {
        "current_role": "CEO at TechCorp",
        "background": "Previously VP Sales at BigCo, started career in consulting",
        "expertise_areas": ["B2B SaaS", "Sales automation", "GTM strategy"],
        "communication_style": "Direct, data-driven, prefers concise communication",
    },
    "company_intelligence": {
        "overview": "B2B SaaS platform for sales teams",
        "recent_developments": ["Raised Series B", "Expanded to EMEA"],
        "tech_stack": ["React", "Python", "AWS"],
        "growth_indicators": ["20% headcount growth in 6 months"],
    },
    "engagement_opportunities": [
        {
            "type": "content",
            "detail": "Referenced automation in recent LinkedIn post",
            "source": "LinkedIn",
            "source_url": None,
        }
    ],
    "talking_points": [
        "Their recent expansion to EMEA creates outbound needs",
        "They use Python + React — technical alignment",
        "CEO is vocal about automation — warm topic",
    ],
    "risk_factors": ["May already have similar tooling"],
    "recommended_approach": "Lead with their EMEA expansion and how Outmate can help scale outbound in new markets.",
}

MOCK_OBJECTION = {
    "objection_analysis": "The prospect is concerned about switching costs and integration effort.",
    "rebuttals": [
        {
            "approach": "empathize",
            "response": "Totally get it — switching tools mid-quarter is painful. Most of our customers kept their existing stack running in parallel for the first 2 weeks.",
            "reasoning": "Acknowledges the concern without dismissing it",
        },
        {
            "approach": "evidence",
            "response": "Companies like yours in the SaaS space typically see ROI within 3 weeks. One similar company cut their prospecting time by 60%.",
            "reasoning": "Uses industry-specific evidence relevant to their company type",
        },
    ],
    "follow_up_question": "What would a successful first 30 days look like for you?",
    "recommended_rebuttal": 0,
}

MOCK_CUSTOM = {
    "response": "Based on the prospect's profile and recent activity, here's my analysis...",
    "action_items": ["Follow up within 48 hours", "Reference their recent LinkedIn post"],
    "data_used": ["LinkedIn activity", "Company funding data"],
}

MOCK_SUGGESTIONS = {
    "suggestions": [
        {
            "icon": "💰",
            "title": "Funding event — reach out now",
            "description": "Company raised a new round recently. Budget is available and scaling is top priority.",
            "action_type": "draft_email",
            "priority": "high",
        },
        {
            "icon": "💡",
            "title": "Active on LinkedIn — personalize",
            "description": "Prospect posted about sales automation challenges last week. Reference their post in outreach.",
            "action_type": "draft_email",
            "priority": "medium",
        },
    ],
    "signals_detected": 2,
}


class LeadCopilotService:
    """Orchestrates AI actions for the lead-activated copilot panel."""

    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    # ── Lead Context ──────────────────────────────────────────

    def get_lead_context(self, prospect_id: str) -> dict:
        """Aggregate prospect + company data from DB into a LeadContextResponse shape."""
        from app.db.models.prospect import Prospect
        from app.db.models.company import Company

        prospect = None
        # Try UUID lookup first, then fall back to external_id (provider person_id)
        try:
            import uuid as _uuid
            _uuid.UUID(str(prospect_id))
            prospect = self.db.query(Prospect).filter(Prospect.id == prospect_id).first()
        except Exception:
            prospect = self.db.query(Prospect).filter(Prospect.external_id == str(prospect_id)).first()
        if not prospect:
            raise ValueError(f"Prospect not found: {prospect_id}")

        # Build prospect dict
        location_parts = [p for p in [prospect.city, prospect.state, prospect.country] if p]
        prospect_data = {
            "id": str(prospect.id),
            "name": prospect.full_name or f"{prospect.first_name or ''} {prospect.last_name or ''}".strip(),
            "title": prospect.job_title,
            "email": prospect.email,
            "phone": prospect.phone,
            "linkedin_url": prospect.linkedin_url,
            "location": ", ".join(location_parts) if location_parts else None,
            "seniority": prospect.seniority_level,
            "department": prospect.department,
            "data_quality_score": prospect.data_quality_score,
        }

        # Build company dict if linked
        company_data = None
        if prospect.company_id:
            company = self.db.query(Company).filter(Company.id == prospect.company_id).first()
            if company:
                hq_parts = [p for p in [company.headquarters_city, company.headquarters_state, company.headquarters_country] if p]
                company_data = {
                    "id": str(company.id),
                    "name": company.name,
                    "domain": company.domain,
                    "industry": company.industry,
                    "employee_count": company.employee_count_exact,
                    "revenue_range": company.revenue_range,
                    "funding_stage": company.funding_stage,
                    "funding_total": company.funding_total,
                    "technologies": company.technologies or [],
                    "headquarters": ", ".join(hq_parts) if hq_parts else None,
                    "employee_growth_6m_percent": company.employee_growth_6m_percent,
                }

        # Enrichment status
        enrichment_status = {
            "emails_revealed": bool(prospect.email),
            "phones_revealed": bool(prospect.phone),
            "company_enriched": bool(prospect.company_id and company_data),
            "last_enriched_at": prospect.last_enriched_at.isoformat() if prospect.last_enriched_at else None,
        }

        return {
            "prospect": prospect_data,
            "company": company_data,
            "signals": [],
            "enrichment_status": enrichment_status,
        }

    # ── Execute Action ────────────────────────────────────────

    async def execute_action(self, user_id: str, prospect_id: str, action_type: str, prompt: Optional[str] = None, context_overrides: Optional[Dict[str, Any]] = None) -> dict:
        """Route action to the appropriate handler with prospect context."""
        # Get prospect context from DB; fall back to overrides when history results aren't persisted.
        try:
            context = self.get_lead_context(prospect_id)
            prospect = context["prospect"]
            company = context.get("company") or {}
        except ValueError:
            if not context_overrides:
                raise
            override_prospect = context_overrides.get("prospect") or {}
            override_company = context_overrides.get("company") or {}
            prospect = {
                "id": override_prospect.get("id") or prospect_id,
                "name": override_prospect.get("name"),
                "title": override_prospect.get("title"),
                "email": override_prospect.get("email"),
                "phone": override_prospect.get("phone"),
                "linkedin_url": override_prospect.get("linkedin_url"),
                "location": override_prospect.get("location"),
                "seniority": override_prospect.get("seniority"),
                "department": override_prospect.get("department"),
                "data_quality_score": override_prospect.get("data_quality_score"),
                "company": override_company.get("name") or override_prospect.get("company"),
            }
            company = {
                "name": override_company.get("name"),
                "domain": override_company.get("domain"),
                "industry": override_company.get("industry"),
                "employee_count": override_company.get("employee_count"),
                "revenue_range": override_company.get("revenue_range"),
                "funding_stage": override_company.get("funding_stage"),
                "funding_total": override_company.get("funding_total"),
                "technologies": override_company.get("technologies") or [],
                "headquarters": override_company.get("headquarters"),
                "employee_growth_6m_percent": override_company.get("employee_growth_6m_percent"),
            }

        # Prepare enrichment context
        name = prospect.get("name", "")
        company_name = company.get("name") or prospect.get("company", "")
        role = prospect.get("title", "")
        domain = company.get("domain")

        # Route to handler
        handler_map = {
            "draft_email": self._handle_draft_email,
            "meeting_prep": self._handle_meeting_prep,
            "research": self._handle_research,
            "find_similar": self._handle_find_similar,
            "objection_handler": self._handle_objection,
            "custom": self._handle_custom,
        }

        handler = handler_map.get(action_type)
        if not handler:
            raise ValueError(f"Unknown action type: {action_type}")

        result = await handler(
            user_id=user_id,
            name=name,
            company_name=company_name,
            role=role,
            domain=domain,
            prospect=prospect,
            company=company,
            prompt=prompt,
            context_overrides=context_overrides,
        )

        return result

    # ── Action Handlers ───────────────────────────────────────

    async def _handle_draft_email(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, prompt: Optional[str], **kwargs) -> dict:
        """Generate an annotated email draft using enrichment data."""
        if self.mock:
            return MOCK_ANNOTATED_EMAIL

        # Enrich the lead
        lead_context = await LeadEnrichmentService.enrich(
            name,
            company_name,
            role,
            domain,
            include_company_data=False,
        )

        user_prompt = self._build_user_prompt(
            prospect, company, lead_context,
            extra=f"USER INSTRUCTION: {prompt}" if prompt else "Write a cold outreach email."
        )

        result = await self.openrouter.chat_completion_structured(
            system_prompt=ANNOTATED_EMAIL_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.4,
            max_tokens=2000,
        )
        return result

    async def _handle_meeting_prep(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Delegate to the existing MeetingPrepService with auto-filled data."""
        from app.services.copilot.meeting_prep_service import MeetingPrepService
        user_id = kwargs.get("user_id")

        service = MeetingPrepService(self.db)
        result = await service.generate(
            user_id=user_id,
            company_name=company_name,
            company_domain=domain,
            prospect_name=name,
            prospect_title=role,
            meeting_type="discovery",
            additional_context=None,
        )
        return result

    async def _handle_research(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Deep research on the prospect using enrichment + LLM summary."""
        if self.mock:
            return MOCK_RESEARCH

        lead_context = await LeadEnrichmentService.enrich(name, company_name, role, domain)

        user_prompt = self._build_user_prompt(prospect, company, lead_context)

        result = await self.openrouter.chat_completion_structured(
            system_prompt=LEAD_RESEARCH_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=2500,
        )
        return result

    async def _handle_find_similar(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Extract ICP attributes from prospect and search for similar companies."""
        from app.services.explorium_service import ExploriumService

        # Build filters using keys that _map_filters understands
        filters: Dict[str, Any] = {}
        if company.get("industry"):
            filters["industry"] = company["industry"]
        # Use company_size (mapped by _map_filters to Explorium's company_size)
        emp = company.get("employee_count") or company.get("employee_count_range")
        if emp:
            if isinstance(emp, str):
                filters["company_size"] = emp
            elif isinstance(emp, (int, float)):
                filters["company_size"] = str(int(emp))
        if company.get("technologies"):
            techs = company["technologies"]
            if isinstance(techs, list) and techs:
                filters["keywords"] = techs[:3]

        try:
            explorium = ExploriumService()
            result = await explorium.search_companies(filters, limit=5)
            return {
                "similar_companies": result.get("companies", []),
                "filters_used": filters,
                "total_found": result.get("total", 0),
            }
        except Exception as e:
            logger.warning("Find similar failed: %s", e)
            return {
                "similar_companies": [],
                "filters_used": filters,
                "total_found": 0,
                "error": "Search service unavailable",
            }

    async def _handle_objection(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, prompt: Optional[str], **kwargs) -> dict:
        """Generate tailored objection rebuttals."""
        if self.mock:
            return MOCK_OBJECTION

        lead_context = await LeadEnrichmentService.enrich(
            name,
            company_name,
            role,
            domain,
            include_company_data=False,
        )

        objection_text = prompt or "Not interested right now"
        user_prompt = self._build_user_prompt(
            prospect, company, lead_context,
            extra=f"OBJECTION FROM PROSPECT: <user_command>{objection_text}</user_command>"
        )

        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=OBJECTION_HANDLER_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=1500,
            )
            return result
        except Exception as exc:
            logger.error("Objection handler LLM failed: %s", exc)
            return {
                "objection_analysis": "Prospect is expressing hesitation or concern about moving forward.",
                "rebuttals": [
                    {
                        "approach": "empathize",
                        "response": "Totally fair — most teams want to be sure this won’t create extra work. We can start with a lightweight pilot so you can see impact quickly without disruption.",
                        "reasoning": "Acknowledges the concern and reduces perceived risk."
                    },
                    {
                        "approach": "question",
                        "response": "What would need to be true for this to be worth revisiting in the next few weeks?",
                        "reasoning": "Keeps the conversation open and uncovers the real blocker."
                    }
                ],
                "follow_up_question": "Is timing the main concern, or is there something specific you’d want to see first?",
                "recommended_rebuttal": 0,
            }

    async def _handle_custom(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, prompt: Optional[str], **kwargs) -> dict:
        """Handle free-form user commands with prospect context."""
        if self.mock:
            return MOCK_CUSTOM

        if not prompt:
            raise ValueError("Custom action requires a prompt")

        lead_context = await LeadEnrichmentService.enrich(name, company_name, role, domain)

        user_prompt = self._build_user_prompt(
            prospect, company, lead_context,
            extra=f"USER COMMAND: <user_command>{prompt}</user_command>"
        )

        result = await self.openrouter.chat_completion_structured(
            system_prompt=LEAD_CUSTOM_COMMAND_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.4,
            max_tokens=2000,
        )
        return result

    # ── Suggestions (Phase 2) ─────────────────────────────────

    async def get_suggestions(self, prospect_id: str) -> dict:
        """Generate proactive AI suggestions for a prospect."""
        context = self.get_lead_context(prospect_id)
        prospect = context["prospect"]
        company = context.get("company") or {}

        name = prospect.get("name", "")
        company_name = company.get("name") or ""
        role = prospect.get("title", "")
        domain = company.get("domain")

        if self.mock:
            return MOCK_SUGGESTIONS

        lead_context = await LeadEnrichmentService.enrich(name, company_name, role, domain)

        user_prompt = self._build_user_prompt(prospect, company, lead_context)

        result = await self.openrouter.chat_completion_structured(
            system_prompt=LEAD_SUGGESTIONS_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=1500,
        )
        return result

    # ── Helpers ────────────────────────────────────────────────

    def _build_user_prompt(self, prospect: dict, company: dict, lead_context: Optional[LeadContext] = None, extra: Optional[str] = None) -> str:
        """Build a structured user prompt with prospect + company + enrichment data."""
        sections = []

        sections.append(f"=== PROSPECT PROFILE ===\n"
                        f"Name: {prospect.get('name', 'Unknown')}\n"
                        f"Title: {prospect.get('title', 'Unknown')}\n"
                        f"Seniority: {prospect.get('seniority', 'Unknown')}\n"
                        f"Department: {prospect.get('department', 'Unknown')}\n"
                        f"Location: {prospect.get('location', 'Unknown')}\n"
                        f"LinkedIn: {prospect.get('linkedin_url', 'N/A')}\n"
                        f"=== END PROSPECT ===")

        if company:
            sections.append(f"=== COMPANY DATA ===\n"
                            f"Company: {company.get('name', 'Unknown')}\n"
                            f"Industry: {company.get('industry', 'Unknown')}\n"
                            f"Domain: {company.get('domain', 'N/A')}\n"
                            f"Employees: {company.get('employee_count', 'Unknown')}\n"
                            f"Revenue: {company.get('revenue_range', 'Unknown')}\n"
                            f"Funding: {company.get('funding_stage', 'Unknown')} (${company.get('funding_total', 'N/A')})\n"
                            f"Tech Stack: {', '.join(company.get('technologies', []))}\n"
                            f"HQ: {company.get('headquarters', 'Unknown')}\n"
                            f"Growth: {company.get('employee_growth_6m_percent', 'N/A')}% (6mo)\n"
                            f"=== END COMPANY ===")

        if lead_context:
            enrichment = lead_context.to_prompt_context()
            if enrichment:
                sections.append(enrichment)

        if extra:
            sections.append(extra)

        return "\n\n".join(sections)
