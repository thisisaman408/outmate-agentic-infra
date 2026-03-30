"""
Daily Brief Service — generates a prioritized action list for the sales rep.
Enriches with signal events from Redis queue + real DB data before calling the LLM.
"""

import os
import uuid
import logging
import asyncio
from datetime import date, datetime, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import DAILY_BRIEF_SYSTEM_PROMPT
from app.services.copilot.enrichment import (
    fetch_recent_news,
    format_news_context,
)

logger = logging.getLogger(__name__)

EMPTY_STATE_RESPONSE_TEMPLATE = {
    "greeting": None,
    "summary": "No signals or account activity yet — connect your CRM or add prospects to start getting a personalised brief.",
    "priority_actions": [],
    "new_signals": [],
    "follow_ups": [],
    "key_metrics": {
        "active_campaigns": 0,
        "open_rate_trend": "stable",
        "new_leads_today": 0,
        "signals_detected": 0,
    },
}

MOCK_RESPONSE = {
    "greeting": "Good morning, there.",
    "summary": "You have 3 hot signals and 2 prospects going cold today. Focus on Acme Corp and TechCorp first.",
    "priority_actions": [
        {"priority": 1, "tier": "FUNDING", "action": "Call the CFO at TechCorp today — funding window is 48h", "reason": "Series B announced yesterday", "entity": "TechCorp", "entity_type": "company", "icp_score": 85},
        {"priority": 2, "tier": "OTHER", "action": "Follow up with John at Acme Corp via email", "reason": "No contact in 8 days — risk of going cold", "entity": "Acme Corp", "entity_type": "company", "icp_score": 70},
        {"priority": 3, "tier": "OTHER", "action": "LinkedIn connect with Sarah at DataFlow Inc", "reason": "Opened your email 3 times — switch channels", "entity": "DataFlow Inc", "entity_type": "prospect", "icp_score": 60},
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


def _extract_first_name(email: str) -> str:
    import re
    local = email.split("@")[0]
    for sep in (".", "_", "-"):
        if sep in local:
            local = local.split(sep)[0]
            break
    # Strip trailing digits (e.g. chinmaykarkamkar100 → chinmaykarkamkar)
    local = re.sub(r'\d+$', '', local)
    return local.capitalize() if local else "there"


def _compute_midnight(local_date_iso: str | None, tz_str: str) -> datetime:
    """Return the UTC datetime of end-of-day (midnight next day) in the user's timezone."""
    try:
        tz = ZoneInfo(tz_str)
    except (ZoneInfoNotFoundError, Exception):
        tz = ZoneInfo("UTC")
    if local_date_iso:
        try:
            d = date.fromisoformat(local_date_iso)
        except ValueError:
            d = datetime.now(tz).date()
    else:
        d = datetime.now(tz).date()
    # End-of-day = start of the next day in local tz
    next_day = datetime(d.year, d.month, d.day, tzinfo=tz) + timedelta(days=1)
    return next_day.astimezone(timezone.utc)


def _build_events_block(events: list) -> str:
    """Serialize signal events into a prompt block."""
    if not events:
        return ""
    lines = ["=== REAL-TIME SIGNAL EVENTS (from your pipeline) ==="]
    for e in events:
        ts = e.timestamp.strftime("%Y-%m-%d %H:%M UTC") if hasattr(e.timestamp, "strftime") else str(e.timestamp)
        lines.append(
            f"- [{e.type.upper()}] {e.company} / {e.contact} | icp_score={e.icp_score} | {ts}\n"
            f"  Context: {e.signal_context}"
        )
    lines.append("=== END SIGNAL EVENTS ===")
    return "\n".join(lines)


class DailyBriefService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def get_or_generate(
        self,
        user_id: str,
        first_name: str = "there",
        events: list | None = None,
        local_date_iso: str | None = None,
        tz_str: str = "UTC",
    ) -> tuple[dict, bool]:
        """Return today's brief from DB if fresh, otherwise generate a new one."""
        from app.db.models.copilot_brief import CopilotBrief

        local_date = date.fromisoformat(local_date_iso) if local_date_iso else date.today()
        existing = (
            self.db.query(CopilotBrief)
            .filter(
                CopilotBrief.user_id == user_id,
                CopilotBrief.brief_date == local_date,
            )
            .first()
        )
        if existing:
            return self._format(existing), False
        result = await self.generate(user_id, first_name=first_name, events=events, local_date_iso=local_date_iso, tz_str=tz_str)
        return result, True

    async def generate(
        self,
        user_id: str,
        first_name: str = "there",
        events: list | None = None,
        local_date_iso: str | None = None,
        tz_str: str = "UTC",
    ) -> dict:
        """Force-generate a new daily brief for today."""
        from app.db.models.copilot_brief import CopilotBrief

        local_date = date.fromisoformat(local_date_iso) if local_date_iso else date.today()
        expires_at = _compute_midnight(local_date_iso, tz_str)

        if self.mock:
            content = dict(MOCK_RESPONSE)
            content["greeting"] = f"Good morning, {first_name}."
        else:
            # 1. Check if there is any real data to work with
            db_context_lines = []
            has_real_data = bool(events)

            # 2. Pull active campaigns
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
                    has_real_data = True
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
                logger.debug("Could not fetch campaigns: %s", exc)

            # 3. Pull unresolved pipeline alerts
            try:
                from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert
                alerts = (
                    self.db.query(CopilotPipelineAlert)
                    .filter(
                        CopilotPipelineAlert.user_id == user_id,
                        CopilotPipelineAlert.is_resolved == False,
                    )
                    .order_by(CopilotPipelineAlert.created_at.desc())
                    .limit(5)
                    .all()
                )
                if alerts:
                    has_real_data = True
                    db_context_lines.append("=== UNRESOLVED PIPELINE ALERTS ===")
                    for a in alerts:
                        db_context_lines.append(f"- [{a.severity}] {a.title}: {a.description}")
                    db_context_lines.append("=== END ALERTS ===")
            except Exception as exc:
                logger.debug("Could not fetch pipeline alerts: %s", exc)

            # 4. Pull prospects
            try:
                from app.db.models.prospect import Prospect
                prospects = (
                    self.db.query(Prospect)
                    .filter(Prospect.user_id == user_id)
                    .limit(10)
                    .all()
                )
                if prospects:
                    has_real_data = True
                    db_context_lines.append("=== YOUR PROSPECTS ===")
                    for p in prospects:
                        name = getattr(p, "name", None) or getattr(p, "full_name", None) or "Unknown"
                        company = getattr(p, "company", None) or ""
                        db_context_lines.append(f"- {name} @ {company}")
                    db_context_lines.append("=== END PROSPECTS ===")
            except Exception as exc:
                logger.debug("Could not fetch prospects: %s", exc)

            # 5. Build events block from Redis queue
            events_block = _build_events_block(events or [])
            db_context = "\n".join(db_context_lines) if db_context_lines else ""
            has_pipeline_data = bool(events_block or db_context)

            # 6. Fetch B2B news only when there is real pipeline data to augment
            news_block = ""
            if has_pipeline_data:
                try:
                    news = await fetch_recent_news("B2B sales technology trends", max_results=3)
                    news_block = format_news_context(news)
                except Exception as exc:
                    logger.debug("News fetch failed: %s", exc)

            enrichment_block = "\n\n".join(filter(None, [events_block, db_context, news_block]))

            if enrichment_block:
                user_prompt = (
                    f"Generate a daily brief for {first_name}, a B2B sales rep. "
                    "Below is REAL data from their pipeline. Use it as the primary source — "
                    "do NOT invent companies or contacts not listed below.\n\n"
                    f"{enrichment_block}\n\n"
                    f"Today's date: {local_date.isoformat()}. "
                    "Generate a prioritized daily brief following the tier rules."
                )
            else:
                user_prompt = (
                    f"Generate a daily brief for {first_name}, a B2B sales rep. "
                    "They have no pipeline data connected yet. "
                    "Generate a realistic example brief with 3 priority actions, 2 signals, and 2 follow-ups "
                    "using plausible B2B company names and scenarios to show what the feature looks like in action. "
                    f"Today's date: {local_date.isoformat()}."
                )

            content = await self.openrouter.chat_completion_structured(
                system_prompt=DAILY_BRIEF_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.4,
                max_tokens=900,
            )

            # Ensure greeting is present
            if not content.get("greeting"):
                content["greeting"] = f"Good morning, {first_name}."

        self._upsert_brief(CopilotBrief, user_id, local_date, content, expires_at)

        # Fetch the saved record for its id
        from app.db.models.copilot_brief import CopilotBrief as _Brief
        saved = (
            self.db.query(_Brief)
            .filter(_Brief.user_id == user_id, _Brief.brief_date == local_date)
            .first()
        )
        if saved:
            return self._format(saved)
        return {"id": str(uuid.uuid4()), "brief_date": str(local_date), "status": "generated", **content}

    def _upsert_brief(self, model_cls, user_id: str, brief_date, content: dict, expires_at: datetime) -> None:
        """Insert or update today's brief using ON CONFLICT DO UPDATE."""
        stmt = (
            pg_insert(model_cls.__table__)
            .values(
                id=uuid.uuid4(),
                user_id=user_id,
                brief_date=brief_date,
                brief_type="daily",
                content=content,
                status="generated",
                expires_at=expires_at,
            )
            .on_conflict_do_update(
                constraint="uq_user_brief_date_type",
                set_={
                    "content": content,
                    "status": "generated",
                    "expires_at": expires_at,
                },
            )
        )
        self.db.execute(stmt)
        self.db.commit()

    def _format(self, brief) -> dict:
        return {
            "id": str(brief.id),
            "brief_date": str(brief.brief_date),
            "status": brief.status,
            **brief.content,
        }
