"""
Lead Copilot Service — orchestrates AI actions for the lead-activated copilot panel.
Routes action types to appropriate sub-services with prospect context injected.
"""

import json
import logging
import os
import re
from typing import Any, AsyncGenerator, Dict, Optional

from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.lead_enrichment import LeadContext, LeadEnrichmentService
from app.services.gtm_agents_service import gtm_agents_service
from app.services.signal_detection_service import SignalDetectionService
from app.core.redis import RedisManager
from app.services.copilot.prompts import (
    ANNOTATED_EMAIL_SYSTEM_PROMPT,
    LEAD_RESEARCH_SYSTEM_PROMPT,
    OBJECTION_HANDLER_SYSTEM_PROMPT,
    LEAD_CUSTOM_COMMAND_SYSTEM_PROMPT,
    LEAD_SUGGESTIONS_SYSTEM_PROMPT,
    WEBSITE_TRAFFIC_SYSTEM_PROMPT,
    BUSINESS_EVENTS_SYSTEM_PROMPT,
    LINKEDIN_POSTS_SYSTEM_PROMPT,
    CROSSFIRE_SYSTEM_PROMPT,
    COMPLIANCE_SYSTEM_PROMPT,
    TALENT_RADAR_SYSTEM_PROMPT,
    VIRALITY_SYSTEM_PROMPT,
    REGIME_SHIFT_SYSTEM_PROMPT,
    BOMBORA_INTENT_SYSTEM_PROMPT,
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
            "crossfire": self._handle_crossfire,
            "compliance": self._handle_compliance,
            "bombora_intent": self._handle_bombora_intent,
            "talent_radar": self._handle_talent_radar,
            "virality": self._handle_virality,
            "regime_shift": self._handle_regime_shift,
            "website_traffic": self._handle_website_traffic,
            "business_events": self._handle_business_events,
            "linkedin_posts": self._handle_linkedin_posts,
        }

        # Prepare caching key — include prompt hash for actions that vary by user input
        import hashlib
        prompt_suffix = f":{hashlib.md5((prompt or '').encode()).hexdigest()[:8]}" if prompt and action_type in ("crossfire", "compliance", "objection_handler") else ""
        cache_key = f"copilot:action:{action_type}:{prospect_id}{prompt_suffix}"
        redis = RedisManager.get_client()
        
        # Check cache if not explicitly refreshing (skip for find_similar to avoid stale zero results)
        refresh_requested = (context_overrides or {}).get("refresh")
        bypass_cache = action_type == "find_similar"
        if redis and RedisManager.ready and not refresh_requested and not bypass_cache:
            try:
                cached_data = await redis.get(cache_key)
                if cached_data:
                    logger.info("Cache hit for action=%s, prospect=%s", action_type, prospect_id)
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning("Failed to read from cache: %s", e)

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

        # Store in cache (24h TTL)
        if redis and RedisManager.ready and result and not result.get("error"):
            try:
                await redis.setex(cache_key, 86400, json.dumps(result))
                logger.info("Cached result for action=%s, prospect=%s", action_type, prospect_id)
            except Exception as e:
                logger.warning("Failed to write to cache: %s", e)

        return result

    # ── Streaming Execute ────────────────────────────────────

    # Actions that use LeadEnrichmentService + LLM (support token streaming)
    _LLM_ACTIONS = {"draft_email", "research", "objection_handler", "custom"}

    async def execute_action_stream(
        self,
        user_id: str,
        prospect_id: str,
        action_type: str,
        prompt: Optional[str] = None,
        context_overrides: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream progress events + LLM tokens for a lead action.

        Yields SSE-ready dicts:
          {"stage": "enriching",  "message": "Researching lead..."}
          {"stage": "generating", "message": "Generating response..."}
          {"stage": "token",      "content": "<partial text>"}
          {"stage": "complete",   "result": {<final JSON>}}
          {"stage": "error",      "message": "..."}
        """
        # ── Resolve prospect context (same as execute_action) ──
        try:
            context = self.get_lead_context(prospect_id)
            prospect = context["prospect"]
            company = context.get("company") or {}
        except ValueError:
            if not context_overrides:
                yield {"stage": "error", "message": f"Prospect not found: {prospect_id}"}
                return
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

        name = prospect.get("name", "")
        company_name = company.get("name") or prospect.get("company", "")
        role = prospect.get("title", "")
        domain = company.get("domain")

        # ── For non-LLM actions, delegate to execute_action directly ──
        if action_type not in self._LLM_ACTIONS:
            yield {"stage": "enriching", "message": "Processing..."}
            try:
                result = await self.execute_action(
                    user_id=user_id,
                    prospect_id=prospect_id,
                    action_type=action_type,
                    prompt=prompt,
                    context_overrides=context_overrides,
                )
                yield {"stage": "complete", "result": result}
            except Exception as e:
                yield {"stage": "error", "message": str(e)}
            return

        # ── Mock path ──
        if self.mock:
            yield {"stage": "enriching", "message": "Researching lead..."}
            yield {"stage": "generating", "message": "Generating response..."}
            mock_map = {
                "draft_email": MOCK_ANNOTATED_EMAIL,
                "research": MOCK_RESEARCH,
                "objection_handler": MOCK_OBJECTION,
                "custom": MOCK_CUSTOM,
            }
            yield {"stage": "complete", "result": mock_map.get(action_type, {})}
            return

        # ── Phase 1: Enrichment ──
        yield {"stage": "enriching", "message": "Researching lead..."}
        try:
            include_company = action_type in ("research", "custom")
            lead_context = await LeadEnrichmentService.enrich(
                name, company_name, role, domain,
                include_company_data=include_company,
                include_company_news=include_company,
            )
        except Exception as e:
            logger.warning("Enrichment failed during stream: %s", e)
            lead_context = LeadContext(name=name, company=company_name, role=role, domain=domain)

        # ── Phase 2: Build prompt + stream LLM ──
        yield {"stage": "generating", "message": "Generating response..."}

        prompt_map = {
            "draft_email": (ANNOTATED_EMAIL_SYSTEM_PROMPT, "Write a cold outreach email."),
            "research": (LEAD_RESEARCH_SYSTEM_PROMPT, None),
            "objection_handler": (OBJECTION_HANDLER_SYSTEM_PROMPT, None),
            "custom": (LEAD_CUSTOM_COMMAND_SYSTEM_PROMPT, None),
        }

        system_prompt, default_extra = prompt_map[action_type]

        if action_type == "draft_email":
            extra = f"USER INSTRUCTION: {prompt}" if prompt else default_extra
        elif action_type == "objection_handler":
            objection_text = prompt or "Not interested right now"
            extra = f"OBJECTION FROM PROSPECT: <user_command>{objection_text}</user_command>"
        elif action_type == "custom":
            extra = f"USER COMMAND: <user_command>{prompt}</user_command>" if prompt else None
        else:
            extra = None

        user_prompt_text = self._build_user_prompt(prospect, company, lead_context, extra=extra)

        max_tokens_map = {"draft_email": 800, "research": 700, "objection_handler": 700, "custom": 700}
        temp_map = {"draft_email": 0.4, "research": 0.3, "objection_handler": 0.3, "custom": 0.4}

        try:
            final_result = None
            async for chunk in self.openrouter.chat_completion_structured_stream(
                system_prompt=system_prompt,
                user_prompt=user_prompt_text,
                temperature=temp_map.get(action_type, 0.3),
                max_tokens=max_tokens_map.get(action_type, 500),
            ):
                if chunk["type"] == "token":
                    yield {"stage": "token", "content": chunk["content"]}
                elif chunk["type"] == "done":
                    final_result = chunk["result"]

            if final_result:
                # Add enrichment sources for draft_email
                if action_type == "draft_email" and lead_context:
                    final_result.setdefault("enrichment_sources_used", lead_context.sources_used)
                yield {"stage": "complete", "result": final_result}
            else:
                yield {"stage": "error", "message": "No response from LLM"}
        except Exception as e:
            logger.error("Streaming LLM failed for %s: %s", action_type, e)
            yield {"stage": "error", "message": f"Generation failed: {str(e)}"}

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
            max_tokens=700,
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
            max_tokens=700,
        )
        return result

    async def _handle_find_similar(self, name: str, company_name: str, role: str, domain: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Find 3 similar companies using cascading Explorium searches."""
        from app.services.explorium_service import ExploriumService

        LIMIT = 3
        explorium = ExploriumService()
        source_domain = (domain or company.get("domain") or "").strip()
        source_name = (company_name or company.get("name") or "").strip()
        industry = company.get("industry") or ""
        emp = company.get("employee_count") or company.get("employee_count_range") or ""
        techs = company.get("technologies") or []
        if isinstance(techs, str):
            techs = [t.strip() for t in techs.split(",") if t.strip()]

        print(f">>> [FindSimilar] source={source_name}|{source_domain} industry={industry} emp={emp} techs={techs}", flush=True)

        def normalize_lookalike(entry: Dict[str, Any]) -> Dict[str, Any]:
            lname = (
                entry.get("lookalike_business_name")
                or entry.get("name")
                or entry.get("business_name")
                or entry.get("companyName")
                or "Lookalike"
            )
            ldomain = (
                entry.get("lookalike_website")
                or entry.get("lookalike_domain")
                or entry.get("website")
                or entry.get("domain")
            )
            lindustry = (
                entry.get("lookalike_naics_description")
                or entry.get("industry")
                or entry.get("primary_industry")
            )
            lemployees = (
                entry.get("lookalike_number_of_employees_range")
                or entry.get("employee_count_range")
                or entry.get("company_size")
                or entry.get("employees")
            )
            return {
                "name": lname,
                "domain": ldomain,
                "industry": lindustry,
                "employee_count_range": lemployees,
            }

        # Step 0: Try Explorium lookalikes (best signal if we can resolve a business_id)
        try:
            seed_result = await explorium.search_companies(
                {"domain": source_domain, "name": source_name}, limit=1
            )
            seed_list = seed_result.get("companies", []) if isinstance(seed_result, dict) else []
            seed = seed_list[0] if seed_list else None
            seed_bid = seed.get("business_id") or seed.get("id") if seed else None
            if seed_bid:
                lookalikes = await explorium.enrich_lookalikes(seed_bid)
                data = lookalikes.get("data") or []
                if isinstance(data, list) and data:
                    normalized = [normalize_lookalike(x) for x in data][:LIMIT]
                    return {
                        "similar_companies": normalized,
                        "filters_used": {"lookalikes": True},
                        "total_found": len(normalized),
                    }
        except Exception as e:
            print(f">>> [FindSimilar] Lookalikes failed: {e}", flush=True)

        # Step 1: Look up source company via domain to get Explorium's own category
        if source_domain:
            try:
                src_result = await explorium.search_companies({"domain": source_domain}, limit=1)
                src_list = src_result.get("companies", [])
                if src_list:
                    src = src_list[0]
                    # Use Explorium's own category — guaranteed valid
                    industry = src.get("linkedin_industry_category") or src.get("industry") or industry
                    if not emp:
                        emp = src.get("employee_count_range") or src.get("employee_count_exact") or ""
                    if not techs:
                        techs = src.get("technologies") or []
                    print(f">>> [FindSimilar] Derived ICP from domain lookup: industry={industry} emp={emp}", flush=True)
            except Exception as e:
                print(f">>> [FindSimilar] Source lookup failed: {e}", flush=True)

        # Build cascading search attempts (most specific → broadest)
        attempts: list = []
        size_filter = {}
        if emp:
            size_filter["company_size"] = str(emp) if not isinstance(emp, str) else emp
        tech_filter = {}
        if techs and isinstance(techs, list):
            tech_filter["company_tech_stack_tech"] = techs[:5]
        cat_filter = {}
        if industry:
            try:
                cat_filter["linkedin_category"] = explorium._broaden_industries(industry)
            except Exception:
                cat_filter["linkedin_category"] = industry

        # 1: industry + size + tech
        combo = {**cat_filter, **size_filter, **tech_filter}
        if combo:
            attempts.append(("full", dict(combo)))
        # 2: industry + size
        if cat_filter and size_filter:
            attempts.append(("industry+size", {**cat_filter, **size_filter}))
        # 3: size + tech (skip industry — it may be invalid in Explorium)
        if size_filter and tech_filter:
            attempts.append(("size+tech", {**size_filter, **tech_filter}))
        # 4: size only
        if size_filter:
            attempts.append(("size_only", dict(size_filter)))
        # 5: industry only
        if cat_filter:
            attempts.append(("industry_only", dict(cat_filter)))
        # 6: tech only
        if tech_filter:
            attempts.append(("tech_only", dict(tech_filter)))

        companies: list = []
        used_filters: Dict[str, Any] = {}
        seen_domains: set = set()
        if source_domain:
            seen_domains.add(source_domain.lower().replace("www.", ""))

        for label, filt in attempts:
            if len(companies) >= LIMIT:
                break
            try:
                print(f">>> [FindSimilar] Trying '{label}': {filt}", flush=True)
                result = await explorium.search_companies(filt, limit=LIMIT + 3)
                batch = result.get("companies", [])
                print(f">>> [FindSimilar] '{label}' returned {len(batch)}", flush=True)
                if not used_filters and batch:
                    used_filters = filt
                for c in batch:
                    if len(companies) >= LIMIT:
                        break
                    cd = str(c.get("domain", "")).lower().replace("www.", "")
                    if cd and cd in seen_domains:
                        continue
                    companies.append(c)
                    if cd:
                        seen_domains.add(cd)
            except Exception as e:
                print(f">>> [FindSimilar] '{label}' failed: {e}", flush=True)

        return {
            "similar_companies": companies[:LIMIT],
            "filters_used": used_filters,
            "total_found": len(companies),
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
                max_tokens=700,
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
            max_tokens=700,
        )
        return result

    async def _handle_crossfire(self, company_name: str, domain: Optional[str], prospect: dict, company: dict, prompt: Optional[str] = None, **kwargs) -> dict:
        """Competitive Intelligence — battle card comparing Outmate vs a named competitor."""
        competitor = prompt.strip() if prompt and prompt.strip() else "the incumbent tool"
        user_prompt = (
            f"Competitor they currently use: {competitor}\n"
            f"Lead's company: {company_name}\n"
            f"Lead: {prospect.get('name')} ({prospect.get('title')})\n"
            f"Industry: {company.get('industry', 'Unknown')}\n"
            f"Company size: {company.get('employee_count', 'Unknown')} employees\n"
            f"Tech Stack: {', '.join(company.get('technologies', [])) or 'Unknown'}\n\n"
            f"Generate a battle card: {competitor} vs Outmate AI, specifically for {company_name}. "
            f"Help the sales rep replace {competitor} at {company_name} with Outmate."
        )
        try:
            result = await self.openrouter.chat_completion_text(
                system_prompt=CROSSFIRE_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=700,
            )
            return {"result": result}
        except Exception as e:
            logger.error("Crossfire failed: %s", e)
            return {"result": f"Could not generate battle card: {e}"}

    async def _handle_compliance(self, prompt: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Compliance audit — checks email draft for legal risks."""
        email_draft = prompt or (
            f"Hi {prospect.get('name', 'there')},\n\n"
            f"I wanted to reach out about how we help companies like {company.get('name', 'yours')} "
            f"in the {company.get('industry', 'B2B')} space. Would you be open to a quick call?\n\n"
            "Best regards"
        )
        user_prompt = (
            f"Jurisdiction context: Company is based in {company.get('headquarters', 'Unknown')}. "
            f"Prospect location: {prospect.get('location', 'Unknown')}.\n\n"
            f"Email to audit:\n{email_draft}"
        )
        try:
            result = await self.openrouter.chat_completion_text(
                system_prompt=COMPLIANCE_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=700,
            )
            return {"result": result}
        except Exception as e:
            logger.error("Compliance oracle failed: %s", e)
            return {"result": f"Could not run compliance audit: {e}"}

    async def _handle_bombora_intent(self, company: dict, prospect: dict, **kwargs) -> dict:
        """Fetch Bombora intent data — falls back to LLM when Explorium credits exhausted."""
        from app.services.explorium_service import ExploriumService
        try:
            explorium = ExploriumService()
            match_result = await explorium.match_businesses([{"name": company.get("name"), "domain": company.get("domain")}])
            matched = match_result if isinstance(match_result, list) else match_result.get("matched_businesses") or []
            if matched:
                business_id = matched[0].get("business_id")
                if business_id:
                    intent_result = await explorium.bulk_enrich_bombora_intent(
                        [business_id],
                        "training & development;information technology;marketing;sales;finance"
                    )
                    data_list = intent_result.get("data", []) if isinstance(intent_result, dict) else []
                    intent_data = data_list[0].get("data", {}) if data_list else {}
                    topics = intent_data.get("intent_topics", [])
                    if topics:
                        return {
                            "intent_topics": topics,
                            "level_of_intent": intent_data.get("level_of_intent", "Unknown"),
                            "business_id": business_id,
                        }
        except Exception as e:
            logger.warning("Explorium Bombora failed, using LLM fallback: %s", e)

        # LLM fallback
        user_prompt = self._build_user_prompt(prospect, company)
        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=BOMBORA_INTENT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=700,
            )
            return result
        except Exception as e:
            logger.error("Bombora LLM fallback failed: %s", e)
            return {"intent_topics": [], "level_of_intent": "Unknown"}

    async def _handle_talent_radar(self, company_name: str, prospect: dict, company: dict, **kwargs) -> dict:
        """Talent Churn Radar — leadership churn and hiring signals."""
        user_prompt = (
            f"Company: {company_name}\n"
            f"Industry: {company.get('industry', 'Unknown')}\n"
            f"Size: {company.get('employee_count', 'Unknown')} employees\n"
            f"Growth (6mo): {company.get('employee_growth_6m_percent', 'Unknown')}%\n"
            f"Funding: {company.get('funding_stage', 'Unknown')}\n"
            f"Key contact: {prospect.get('name')} ({prospect.get('title')})\n\n"
            "Analyze talent and leadership signals for this account."
        )
        try:
            result = await self.openrouter.chat_completion_text(
                system_prompt=TALENT_RADAR_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=700,
            )
            return {"result": result}
        except Exception as e:
            logger.error("Talent radar failed: %s", e)
            return {"result": f"Could not run talent analysis: {e}"}

    async def _handle_virality(self, name: str, company_name: str, role: str, prospect: dict, company: dict, **kwargs) -> dict:
        """Virality Engine — referral loop design."""
        user_prompt = (
            f"Prospect: {name}, {role} at {company_name}\n"
            f"Industry: {company.get('industry', 'Unknown')}\n"
            f"Company size: {company.get('employee_count', 'Unknown')} employees\n"
            f"Funding: {company.get('funding_stage', 'Unknown')}\n\n"
            "Design a viral referral strategy targeting this champion."
        )
        try:
            result = await self.openrouter.chat_completion_text(
                system_prompt=VIRALITY_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5,
                max_tokens=700,
            )
            return {"result": result}
        except Exception as e:
            logger.error("Virality engine failed: %s", e)
            return {"result": f"Could not generate virality plan: {e}"}

    async def _handle_regime_shift(self, company_name: str, prospect: dict, company: dict, **kwargs) -> dict:
        """Regime Shifter — adapt pitch to macro market changes."""
        user_prompt = (
            f"Company: {company_name}\n"
            f"Industry: {company.get('industry', 'Unknown')}\n"
            f"Prospect role: {prospect.get('title', 'Unknown')}\n"
            f"Funding stage: {company.get('funding_stage', 'Unknown')}\n"
            f"HQ: {company.get('headquarters', 'Unknown')}\n\n"
            "Analyze macro-economic shifts affecting this company and recommend messaging pivots."
        )
        try:
            result = await self.openrouter.chat_completion_text(
                system_prompt=REGIME_SHIFT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=700,
            )
            return {"result": result}
        except Exception as e:
            logger.error("Regime shift failed: %s", e)
            return {"result": f"Could not run regime analysis: {e}"}

    @staticmethod
    def _has_valid_signal_structure(signals: list) -> bool:
        """Check that signals have the expected top-level type/description fields."""
        return bool(signals) and all(s.get("type") and s.get("description") for s in signals)

    async def _handle_website_traffic(self, domain: Optional[str], company_name: str, prospect: dict, company: dict, **kwargs) -> dict:
        """Fetch Website Traffic signals, with LLM fallback when APIs return empty or malformed."""
        real_signals = []
        if domain:
            try:
                signal_service = SignalDetectionService()
                signals = await signal_service.detect_signals(
                    companies=[{"domain": domain}],
                    data_source="explorium",
                    action="traffic"
                )
                traffic_signals = [s for s in signals if s.get("type") in ("growth_signal", "size_signal")]
                real_signals = traffic_signals or signals
            except Exception as e:
                logger.warning("Website traffic API failed: %s", e)

        if self._has_valid_signal_structure(real_signals):
            return {"signals": real_signals}

        # LLM fallback — generate signal from prospect/company context
        user_prompt = self._build_user_prompt(prospect, company)
        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=WEBSITE_TRAFFIC_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5,
                max_tokens=700,
            )
            return result
        except Exception as e:
            logger.error("Website traffic LLM fallback failed: %s", e)
            return {"signals": []}

    async def _handle_business_events(self, company_name: str, domain: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Fetch Business Events (Funding, M&A, launches), with LLM fallback when APIs return empty or malformed."""
        real_signals = []
        try:
            signal_service = SignalDetectionService()
            signals = await signal_service.detect_signals(
                companies=[{"name": company_name, "domain": domain}],
                data_source="explorium",
                action="events"
            )
            event_signals = [s for s in signals if s.get("type") in ("funding_signal", "startup_signal", "product_launch")]
            real_signals = event_signals or signals
        except Exception as e:
            logger.warning("Business events API failed: %s", e)

        if self._has_valid_signal_structure(real_signals):
            return {"signals": real_signals}

        # LLM fallback
        user_prompt = self._build_user_prompt(prospect, company)
        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=BUSINESS_EVENTS_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5,
                max_tokens=700,
            )
            return result
        except Exception as e:
            logger.error("Business events LLM fallback failed: %s", e)
            return {"signals": []}

    async def _handle_linkedin_posts(self, name: str, company_name: str, domain: Optional[str], prospect: dict, company: dict, **kwargs) -> dict:
        """Research LinkedIn posts, with LLM fallback when APIs return empty or malformed."""
        real_signals = []
        try:
            signal_service = SignalDetectionService()
            signals = await signal_service.detect_signals(
                companies=[{"name": name, "company_name": company_name, "domain": domain}],
                data_source=["crustdata", "explorium"],
                action="posts"
            )
            real_signals = signals
        except Exception as e:
            logger.warning("LinkedIn posts API failed: %s", e)

        if self._has_valid_signal_structure(real_signals):
            return {"signals": real_signals}

        # LLM fallback — use lead enrichment context for better output
        try:
            lead_context = await LeadEnrichmentService.enrich(
                name, company_name, prospect.get("title", ""), domain,
                include_company_data=False,
            )
        except Exception:
            lead_context = None

        user_prompt = self._build_user_prompt(prospect, company, lead_context)
        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=LINKEDIN_POSTS_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.5,
                max_tokens=700,
            )
            return result
        except Exception as e:
            logger.error("LinkedIn posts LLM fallback failed: %s", e)
            return {"signals": []}

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
            max_tokens=700,
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
