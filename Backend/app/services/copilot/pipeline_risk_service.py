"""
Pipeline Risk Service — detects stuck deals and pipeline health issues.
Enriches deal companies with real data from Explorium before calling the LLM.
"""

import os
import uuid
import logging
import asyncio
from datetime import date, datetime
from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.prompts import PIPELINE_RISK_SYSTEM_PROMPT
from app.services.copilot.enrichment import (
    enrich_company,
    format_company_context,
)

logger = logging.getLogger(__name__)

MOCK_RESPONSE = {
    "health_score": 58,
    "risk_summary": "2 of 4 deals are stale. $20,000 at risk of slipping this quarter.",
    "at_risk_deals": [
        {
            "company": "Acme Corp",
            "stage": "Proposal",
            "days_stale": 17,
            "risk_level": "red",
            "recommended_action": "Send a breakup email or schedule a check-in call immediately",
        },
        {
            "company": "DataFlow Inc",
            "stage": "Discovery",
            "days_stale": 10,
            "risk_level": "yellow",
            "recommended_action": "Send a value-add follow-up with a relevant case study",
        },
    ],
    "alert_type": "stuck_deal",
    "total_value_at_risk": 20000,
}


def _days_since(last_activity_str: str) -> int:
    try:
        last = datetime.strptime(last_activity_str, "%Y-%m-%d").date()
        return (date.today() - last).days
    except Exception:
        return 0


def _risk_level(days: int) -> str:
    if days >= 15:
        return "red"
    if days >= 7:
        return "yellow"
    return "green"


class PipelineRiskService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def scan(self, user_id: str, deals: list) -> dict:
        from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert

        # Rule-based pre-processing
        enriched_deals = []
        for deal in deals:
            days = _days_since(deal["last_activity"])
            enriched_deals.append({
                **deal,
                "days_stale": days,
                "risk_level": _risk_level(days),
            })

        at_risk = [d for d in enriched_deals if d["risk_level"] in ("red", "yellow")]
        total_at_risk_value = sum(d.get("value", 0) for d in at_risk)

        if self.mock:
            result = MOCK_RESPONSE
        else:
            # --- Enrich at-risk companies with real data ---
            company_context_lines = []
            try:
                # Limit to top 3 at-risk to avoid too many API calls
                enrich_tasks = [
                    enrich_company(d["company"], d.get("domain"))
                    for d in at_risk[:3]
                ]
                if enrich_tasks:
                    enrich_results = await asyncio.gather(*enrich_tasks, return_exceptions=True)
                    for d, res in zip(at_risk[:3], enrich_results):
                        if isinstance(res, dict) and res:
                            ctx = format_company_context(res)
                            if ctx:
                                company_context_lines.append(f"--- {d['company']} ---\n{ctx}")
            except Exception as exc:
                logger.warning("Pipeline enrichment failed, falling back to LLM-only: %s", exc)

            enrichment_block = "\n\n".join(company_context_lines) if company_context_lines else ""

            deals_text = "\n".join(
                f"- {d['company']} | Stage: {d['stage']} | Days stale: {d['days_stale']} | Value: ${d.get('value', 0):,} | Risk: {d['risk_level']}"
                for d in enriched_deals
            )
            user_prompt = (
                f"Pipeline deals:\n{deals_text}\n\n"
                f"Total deals: {len(deals)}\n"
                f"At-risk deals: {len(at_risk)}\n"
                f"Total value at risk: ${total_at_risk_value:,}\n\n"
            )
            if enrichment_block:
                user_prompt += (
                    "Below is VERIFIED real-time data about the at-risk companies. "
                    "Use it to provide more specific recommended actions.\n\n"
                    f"{enrichment_block}\n\n"
                )
            user_prompt += "Analyze this pipeline and generate risk alerts with recommended actions."

            result = await self.openrouter.chat_completion_structured(
                system_prompt=PIPELINE_RISK_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.3,
                max_tokens=1500,
            )

        # Save alerts for at-risk deals
        for deal in at_risk:
            alert = CopilotPipelineAlert(
                id=uuid.uuid4(),
                user_id=user_id,
                alert_type="stuck_deal",
                severity="high" if deal["risk_level"] == "red" else "medium",
                title=f"Stale deal: {deal['company']}",
                description=f"{deal['company']} in {deal['stage']} stage — no activity for {deal['days_stale']} days.",
                entity_type="company",
                entity_name=deal["company"],
                recommendation=next(
                    (d.get("recommended_action") for d in result.get("at_risk_deals", []) if d.get("company") == deal["company"]),
                    "Follow up immediately to re-engage this deal.",
                ),
                is_resolved=False,
            )
            self.db.add(alert)

        self.db.commit()
        return result

    def get_alerts(self, user_id: str, resolved: bool = False) -> list:
        from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert
        alerts = (
            self.db.query(CopilotPipelineAlert)
            .filter(
                CopilotPipelineAlert.user_id == user_id,
                CopilotPipelineAlert.is_resolved == resolved,
            )
            .order_by(CopilotPipelineAlert.created_at.desc())
            .all()
        )
        return [
            {
                "id": str(a.id),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "title": a.title,
                "description": a.description,
                "entity_type": a.entity_type,
                "entity_name": a.entity_name,
                "recommendation": a.recommendation,
                "is_resolved": a.is_resolved,
                "created_at": str(a.created_at),
            }
            for a in alerts
        ]

    def resolve_alert(self, user_id: str, alert_id: str) -> bool:
        from app.db.models.copilot_pipeline_alert import CopilotPipelineAlert
        from datetime import timezone
        alert = (
            self.db.query(CopilotPipelineAlert)
            .filter(CopilotPipelineAlert.id == alert_id, CopilotPipelineAlert.user_id == user_id)
            .first()
        )
        if not alert:
            return False
        alert.is_resolved = True
        alert.resolved_at = datetime.now(timezone.utc)
        self.db.commit()
        return True
