"""ContextEngine — assembles ALL available signals for a prospect into one
UnifiedContext object before any LLM call.  Results are Redis-cached for 30
minutes so repeated actions within a session don't re-fetch.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.redis import RedisManager
from app.db.models.copilot_brief import CopilotBrief
from app.db.models.copilot_meeting_prep import CopilotMeetingPrep
from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert
from app.db.models.company import Company
from app.db.models.prospect import Prospect
from app.services.copilot.lead_enrichment import LeadContext, LeadEnrichmentService

logger = logging.getLogger(__name__)

CACHE_TTL = 1800  # 30 minutes


# ─────────────────────────────────────────────────────────────────────────── #
# UnifiedContext dataclass                                                    #
# ─────────────────────────────────────────────────────────────────────────── #


@dataclass
class UnifiedContext:
    # Identity
    prospect_id: Optional[str]
    prospect_name: str
    prospect_title: str
    prospect_company: str
    prospect_domain: Optional[str]
    linkedin_url: Optional[str] = None
    prospect_email: Optional[str] = None

    # Enrichment (from LeadEnrichmentService)
    google_mentions: List[Dict[str, Any]] = field(default_factory=list)
    youtube_appearances: List[Dict[str, Any]] = field(default_factory=list)
    linkedin_posts: List[Dict[str, Any]] = field(default_factory=list)
    company_data: Dict[str, Any] = field(default_factory=dict)
    recent_news: List[Dict[str, Any]] = field(default_factory=list)
    sources_used: List[str] = field(default_factory=list)

    # Platform signals
    pipeline_alerts: List[Dict[str, Any]] = field(default_factory=list)
    past_meeting_preps: List[Dict[str, Any]] = field(default_factory=list)
    daily_brief_signals: List[Dict[str, Any]] = field(default_factory=list)
    past_lead_actions: List[Dict[str, Any]] = field(default_factory=list)

    # Metadata
    assembled_at: datetime = field(default_factory=datetime.utcnow)
    cache_key: str = ""

    # ------------------------------------------------------------------ #
    # Formatting helpers                                                    #
    # ------------------------------------------------------------------ #

    def to_summary(self) -> str:
        """One-paragraph summary of available context (for planner LLM)."""
        parts: List[str] = [
            f"Prospect: {self.prospect_name} ({self.prospect_title}) at {self.prospect_company}."
        ]
        if self.google_mentions:
            parts.append(f"{len(self.google_mentions)} Google mention(s).")
        if self.youtube_appearances:
            parts.append(f"{len(self.youtube_appearances)} YouTube appearance(s).")
        if self.linkedin_posts:
            parts.append(f"{len(self.linkedin_posts)} LinkedIn post(s).")
        if self.company_data:
            funding = self.company_data.get("funding_stage") or self.company_data.get("fundingStage")
            industry = self.company_data.get("industry")
            employees = self.company_data.get("employee_count") or self.company_data.get("employeeCount")
            detail = ", ".join(filter(None, [industry, funding, f"{employees} employees" if employees else None]))
            if detail:
                parts.append(f"Company: {detail}.")
        if self.recent_news:
            parts.append(f"{len(self.recent_news)} recent news article(s).")
        if self.pipeline_alerts:
            parts.append(f"{len(self.pipeline_alerts)} open pipeline alert(s).")
        if self.past_meeting_preps:
            parts.append(f"{len(self.past_meeting_preps)} past meeting prep(s).")
        if self.past_lead_actions:
            actions = [a["action_type"] for a in self.past_lead_actions]
            parts.append(f"Past Co-Pilot actions: {', '.join(actions)}.")
        return " ".join(parts)

    def to_prompt_sections(self) -> str:
        """Format all context into LLM-ready section blocks."""
        sections: List[str] = []

        prospect_lines = [
            f"=== PROSPECT ===",
            f"Name: {self.prospect_name}",
            f"Title: {self.prospect_title}",
            f"Company: {self.prospect_company}",
            f"Domain: {self.prospect_domain or 'unknown'}",
        ]
        if self.linkedin_url:
            prospect_lines.append(f"LinkedIn: {self.linkedin_url}")
        if self.prospect_email:
            prospect_lines.append(f"Email: {self.prospect_email}")
        sections.append("\n".join(prospect_lines))

        if self.company_data:
            cd = self.company_data
            lines = [f"=== COMPANY DATA ({self.prospect_company}) ==="]
            for key in ("industry", "employee_count", "revenue_range", "funding_stage",
                        "funding_total", "technologies", "headquarters"):
                val = cd.get(key) or cd.get(key.replace("_", ""))
                if val:
                    lines.append(f"{key.replace('_', ' ').title()}: {val}")
            sections.append("\n".join(lines))

        if self.google_mentions:
            lines = ["=== RECENT GOOGLE MENTIONS ==="]
            for item in self.google_mentions[:5]:
                lines.append(f"- {item.get('title', '')}: {item.get('snippet', '')}")
            sections.append("\n".join(lines))

        if self.youtube_appearances:
            lines = ["=== YOUTUBE APPEARANCES ==="]
            for item in self.youtube_appearances[:3]:
                lines.append(f"- {item.get('title', '')} {item.get('link', '')}")
            sections.append("\n".join(lines))

        if self.linkedin_posts:
            lines = ["=== LINKEDIN ACTIVITY ==="]
            for item in self.linkedin_posts[:3]:
                lines.append(f"- {item.get('title', '')}: {item.get('content', item.get('snippet', ''))}")
            sections.append("\n".join(lines))

        if self.recent_news:
            lines = ["=== RECENT COMPANY NEWS ==="]
            for item in self.recent_news[:5]:
                lines.append(f"- {item.get('title', '')}: {item.get('content', item.get('snippet', ''))[:200]}")
            sections.append("\n".join(lines))

        if self.pipeline_alerts:
            lines = ["=== OPEN PIPELINE ALERTS ==="]
            for a in self.pipeline_alerts[:5]:
                lines.append(f"- [{a.get('severity', 'medium').upper()}] {a.get('title', '')}: {a.get('description', '')}")
            sections.append("\n".join(lines))

        if self.past_meeting_preps:
            lines = ["=== PAST MEETING PREPS ==="]
            for mp in self.past_meeting_preps[:3]:
                lines.append(f"- {mp.get('created_at', '')[:10]} — {mp.get('meeting_type', 'discovery')} meeting")
            sections.append("\n".join(lines))

        if self.daily_brief_signals:
            lines = ["=== DAILY BRIEF SIGNALS ==="]
            for sig in self.daily_brief_signals[:5]:
                lines.append(f"- {sig.get('title', sig.get('signal', ''))}")
            sections.append("\n".join(lines))

        if self.past_lead_actions:
            lines = ["=== PAST CO-PILOT ACTIONS ==="]
            for act in self.past_lead_actions[:5]:
                lines.append(f"- {act.get('created_at', '')[:10]} {act.get('action_type', '')} (status: {act.get('status', '')})")
            sections.append("\n".join(lines))

        return "\n\n".join(sections)

    def to_dict(self) -> Dict[str, Any]:
        """Serialise for Redis cache."""
        return {
            "prospect_id": self.prospect_id,
            "prospect_name": self.prospect_name,
            "prospect_title": self.prospect_title,
            "prospect_company": self.prospect_company,
            "prospect_domain": self.prospect_domain,
            "google_mentions": self.google_mentions,
            "youtube_appearances": self.youtube_appearances,
            "linkedin_posts": self.linkedin_posts,
            "company_data": self.company_data,
            "recent_news": self.recent_news,
            "sources_used": self.sources_used,
            "pipeline_alerts": self.pipeline_alerts,
            "past_meeting_preps": self.past_meeting_preps,
            "daily_brief_signals": self.daily_brief_signals,
            "past_lead_actions": self.past_lead_actions,
            "assembled_at": self.assembled_at.isoformat(),
            "cache_key": self.cache_key,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UnifiedContext":
        assembled_at = data.get("assembled_at")
        if isinstance(assembled_at, str):
            assembled_at = datetime.fromisoformat(assembled_at)
        elif not isinstance(assembled_at, datetime):
            assembled_at = datetime.utcnow()
        return cls(
            prospect_id=data.get("prospect_id"),
            prospect_name=data.get("prospect_name", ""),
            prospect_title=data.get("prospect_title", ""),
            prospect_company=data.get("prospect_company", ""),
            prospect_domain=data.get("prospect_domain"),
            linkedin_url=data.get("linkedin_url"),
            prospect_email=data.get("prospect_email"),
            google_mentions=data.get("google_mentions", []),
            youtube_appearances=data.get("youtube_appearances", []),
            linkedin_posts=data.get("linkedin_posts", []),
            company_data=data.get("company_data", {}),
            recent_news=data.get("recent_news", []),
            sources_used=data.get("sources_used", []),
            pipeline_alerts=data.get("pipeline_alerts", []),
            past_meeting_preps=data.get("past_meeting_preps", []),
            daily_brief_signals=data.get("daily_brief_signals", []),
            past_lead_actions=data.get("past_lead_actions", []),
            assembled_at=assembled_at,
            cache_key=data.get("cache_key", ""),
        )


# ─────────────────────────────────────────────────────────────────────────── #
# ContextEngine                                                               #
# ─────────────────────────────────────────────────────────────────────────── #


class ContextEngine:
    """Assembles UnifiedContext from all available signals for a prospect.

    Call order:
      1. assemble(user_id, prospect_id, db)  →  UnifiedContext

    Cached in Redis for 30 min using key: ctx:{user_id}:{prospect_id}:{date}
    """

    async def assemble(
        self,
        user_id: str,
        prospect_id: str,
        db: Session,
        force_refresh: bool = False,
    ) -> UnifiedContext:
        today = date.today().isoformat()
        cache_key = f"ctx:{user_id}:{prospect_id}:{today}"

        # Try cache first
        if not force_refresh:
            cached = await self._read_cache(cache_key)
            if cached:
                logger.debug("ContextEngine cache hit: %s", cache_key)
                return cached

        logger.debug("ContextEngine assembling fresh context: %s", cache_key)

        # ── 1. DB identity ────────────────────────────────────────────────
        prospect_row, company_row = self._fetch_db_rows(prospect_id, user_id, db)

        name = (getattr(prospect_row, "full_name", None) or "") if prospect_row else ""
        title = (getattr(prospect_row, "job_title", None) or "") if prospect_row else ""
        company_name = ""
        domain: Optional[str] = None

        if company_row:
            company_name = company_row.name or ""
            domain = company_row.domain
        elif prospect_row:
            raw = getattr(prospect_row, "raw_data", None) or {}
            employers = (raw.get("current_employers") or [{}])[0] or {}
            company_name = employers.get("name") or raw.get("company_name") or ""
            domain = employers.get("company_website_domain") or employers.get("company_domain")

        # ── 2. Concurrent external enrichment + platform data ─────────────
        lead_ctx, platform = await asyncio.gather(
            self._fetch_enrichment(name, company_name, title, domain),
            asyncio.to_thread(self._fetch_platform_data, user_id, company_name, prospect_id, db),
            return_exceptions=True,
        )

        if isinstance(lead_ctx, Exception):
            logger.warning("Enrichment failed: %s", lead_ctx)
            lead_ctx = None
        if isinstance(platform, Exception):
            logger.warning("Platform data fetch failed: %s", platform)
            platform = {}

        # ── 3. Assemble UnifiedContext ─────────────────────────────────────
        ctx = UnifiedContext(
            prospect_id=prospect_id,
            prospect_name=name,
            prospect_title=title,
            prospect_company=company_name,
            prospect_domain=domain,
            linkedin_url=(getattr(prospect_row, "linkedin_url", None) or None) if prospect_row else None,
            prospect_email=(getattr(prospect_row, "email", None) or None) if prospect_row else None,
            google_mentions=lead_ctx.google_mentions if lead_ctx else [],
            youtube_appearances=lead_ctx.youtube_appearances if lead_ctx else [],
            linkedin_posts=lead_ctx.linkedin_posts if lead_ctx else [],
            company_data=lead_ctx.company_data if lead_ctx else (self._company_row_to_dict(company_row) if company_row else {}),
            recent_news=lead_ctx.recent_news if lead_ctx else [],
            sources_used=lead_ctx.sources_used if lead_ctx else [],
            pipeline_alerts=platform.get("pipeline_alerts", []),
            past_meeting_preps=platform.get("past_meeting_preps", []),
            daily_brief_signals=platform.get("daily_brief_signals", []),
            past_lead_actions=platform.get("past_lead_actions", []),
            cache_key=cache_key,
        )

        # ── 4. Store in cache ─────────────────────────────────────────────
        await self._write_cache(cache_key, ctx)
        return ctx

    # ------------------------------------------------------------------ #
    # Private helpers                                                       #
    # ------------------------------------------------------------------ #

    def _fetch_db_rows(
        self, prospect_id: str, user_id: str, db: Session
    ):
        """Return (prospect_row, company_row) — both may be None."""
        prospect_row = None
        company_row = None
        try:
            uid = uuid.UUID(str(prospect_id))
            prospect_row = db.query(Prospect).filter(Prospect.id == uid).first()
            if prospect_row and prospect_row.company_id:
                company_row = db.query(Company).filter(Company.id == prospect_row.company_id).first()
        except Exception as exc:
            logger.warning("DB fetch error in ContextEngine: %s", exc)
        return prospect_row, company_row

    async def _fetch_enrichment(
        self, name: str, company: str, role: str, domain: Optional[str]
    ) -> Optional[LeadContext]:
        """Run LeadEnrichmentService concurrently."""
        if not name and not company:
            return None
        try:
            return await LeadEnrichmentService.enrich(
                name=name,
                company=company,
                role=role,
                domain=domain,
            )
        except Exception as exc:
            logger.warning("LeadEnrichmentService failed in ContextEngine: %s", exc)
            return None

    def _fetch_platform_data(
        self, user_id: str, company_name: str, prospect_id: str, db: Session
    ) -> Dict[str, Any]:
        """Fetch platform-side signals (always fresh, no cache)."""
        result: Dict[str, Any] = {
            "pipeline_alerts": [],
            "past_meeting_preps": [],
            "daily_brief_signals": [],
            "past_lead_actions": [],
        }
        uid = uuid.UUID(str(user_id))

        # Pipeline alerts for this company
        try:
            if company_name:
                alerts = (
                    db.query(CopilotPipelineAlert)
                    .filter(
                        CopilotPipelineAlert.user_id == uid,
                        CopilotPipelineAlert.is_resolved == False,
                        CopilotPipelineAlert.entity_name.ilike(f"%{company_name}%"),
                    )
                    .order_by(CopilotPipelineAlert.created_at.desc())
                    .limit(5)
                    .all()
                )
                result["pipeline_alerts"] = [
                    {
                        "title": a.title,
                        "description": a.description,
                        "severity": a.severity,
                        "recommendation": a.recommendation,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in alerts
                ]
        except Exception as exc:
            logger.warning("pipeline_alerts fetch failed: %s", exc)

        # Past meeting preps for this company
        try:
            if company_name:
                preps = (
                    db.query(CopilotMeetingPrep)
                    .filter(
                        CopilotMeetingPrep.user_id == uid,
                        CopilotMeetingPrep.company_name.ilike(f"%{company_name}%"),
                    )
                    .order_by(CopilotMeetingPrep.created_at.desc())
                    .limit(3)
                    .all()
                )
                result["past_meeting_preps"] = [
                    {
                        "company_name": p.company_name,
                        "meeting_type": p.meeting_type,
                        "created_at": p.created_at.isoformat() if p.created_at else None,
                    }
                    for p in preps
                ]
        except Exception as exc:
            logger.warning("past_meeting_preps fetch failed: %s", exc)

        # Today's daily brief signals
        try:
            today = date.today()
            brief = (
                db.query(CopilotBrief)
                .filter(
                    CopilotBrief.user_id == uid,
                    CopilotBrief.brief_date == today,
                )
                .first()
            )
            if brief and brief.content:
                content = brief.content if isinstance(brief.content, dict) else {}
                signals = content.get("signals") or content.get("priority_actions") or []
                result["daily_brief_signals"] = signals[:10]
        except Exception as exc:
            logger.warning("daily_brief_signals fetch failed: %s", exc)

        # Past copilot actions for this prospect (from audit log)
        try:
            from app.services.copilot.audit_log_service import AuditLogService
            svc = AuditLogService(db)
            result["past_lead_actions"] = svc.get_past_actions_for_prospect(
                user_id=str(user_id),
                prospect_id=str(prospect_id),
                limit=5,
            )
        except Exception as exc:
            logger.warning("past_lead_actions fetch failed: %s", exc)

        return result

    @staticmethod
    def _company_row_to_dict(company) -> Dict[str, Any]:
        if not company:
            return {}
        hq_parts = [
            p for p in [
                getattr(company, "headquarters_city", None),
                getattr(company, "headquarters_state", None),
                getattr(company, "headquarters_country", None),
            ] if p
        ]
        return {
            "name": company.name,
            "domain": company.domain,
            "industry": getattr(company, "industry", None),
            "employee_count": getattr(company, "employee_count_exact", None),
            "revenue_range": getattr(company, "revenue_range", None),
            "funding_stage": getattr(company, "funding_stage", None),
            "funding_total": getattr(company, "funding_total", None),
            "technologies": getattr(company, "technologies", []) or [],
            "headquarters": ", ".join(hq_parts) if hq_parts else None,
            "employee_growth_6m_percent": getattr(company, "employee_growth_6m_percent", None),
        }

    # ------------------------------------------------------------------ #
    # Cache helpers                                                         #
    # ------------------------------------------------------------------ #

    async def _read_cache(self, key: str) -> Optional[UnifiedContext]:
        redis = RedisManager.get_client()
        if not redis or not RedisManager.ready:
            return None
        try:
            raw = await redis.get(key)
            if raw:
                return UnifiedContext.from_dict(json.loads(raw))
        except Exception as exc:
            logger.debug("Cache read failed: %s", exc)
        return None

    async def _write_cache(self, key: str, ctx: UnifiedContext) -> None:
        redis = RedisManager.get_client()
        if not redis or not RedisManager.ready:
            return
        try:
            await redis.setex(key, CACHE_TTL, json.dumps(ctx.to_dict()))
        except Exception as exc:
            logger.debug("Cache write failed: %s", exc)

    async def invalidate(self, user_id: str, prospect_id: str) -> None:
        """Manually invalidate cached context for a prospect."""
        today = date.today().isoformat()
        key = f"ctx:{user_id}:{prospect_id}:{today}"
        redis = RedisManager.get_client()
        if redis and RedisManager.ready:
            try:
                await redis.delete(key)
            except Exception:
                pass


# Module-level singleton
context_engine = ContextEngine()
