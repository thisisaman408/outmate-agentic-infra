"""
Celery tasks for Signal-to-Sequence generation.

On-demand task (dispatched by signal_tasks.py after threshold check):
  - generate_signal_sequence  — ContactOut → LeadEnrichment → EmailOptimizer → DB → notify
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

# Signal type → human-readable context string injected into the LLM prompt
_SIGNAL_CONTEXT_TEMPLATES = {
    "funding":         "This prospect's company just raised a funding round.",
    "job_change":      "This prospect recently changed jobs or was promoted.",
    "hiring":          "This prospect's company is actively hiring, indicating growth.",
    "g2_intent":       "This prospect's company is actively researching solutions like yours on G2.",
    "website_visit":   "Someone from this prospect's company just visited your website.",
    "email_open":      "This prospect recently opened one of your emails.",
    "linkedin_activity": "This prospect was recently active on LinkedIn.",
}

_DEFAULT_SIGNAL_CONTEXT = "This prospect's company was flagged by a buying intent signal."

# Fallback ICP scores when icp_score is NULL (signal_type → heuristic score 0-100)
_SIGNAL_TYPE_HEURISTIC_SCORES = {
    "funding": 85,
    "hiring": 75,
    "g2_intent": 90,
    "website_visit": 70,
    "email_open": 80,
    "job_change": 65,
    "linkedin_activity": 60,
}
_DEFAULT_HEURISTIC_SCORE = 65


# ─────────────────────────────────────────────────────────────
# On-Demand: Generate a signal-triggered outreach sequence
# ─────────────────────────────────────────────────────────────

@celery_app.task(
    name="app.tasks.sequence_tasks.generate_signal_sequence",
    bind=True,
    max_retries=2,
    default_retry_delay=60,
)
def generate_signal_sequence(self, signal_id: str, user_id: str):
    """
    For a qualifying signal + user pair:
    1. Fetch top decision-maker for the signal's company domain (ContactOut)
    2. Enrich that contact (LeadEnrichmentService)
    3. Generate personalised email + 3-email follow-up (CampaignOptimizerService)
    4. Write SignalSequenceDraft to DB
    5. Fire in-app notification
    """
    logger.info("→ generate_signal_sequence signal_id=%s user_id=%s", signal_id, user_id)
    try:
        asyncio.run(_generate_signal_sequence(signal_id, user_id))
    except Exception as exc:
        logger.error("generate_signal_sequence failed: %s", exc, exc_info=True)
        raise self.retry(exc=exc)


async def _generate_signal_sequence(signal_id: str, user_id: str) -> None:
    db = SessionLocal()
    try:
        from app.db.models.signal_event import SignalEvent
        from app.db.models.signal_sequence_draft import SignalSequenceDraft
        from app.db.models.copilot_notification import CopilotNotification

        # ── 0. Load signal ───────────────────────────────────────────────
        signal: SignalEvent | None = (
            db.query(SignalEvent)
            .filter(SignalEvent.id == uuid.UUID(signal_id))
            .first()
        )
        if not signal:
            logger.warning("Signal %s not found — skipping", signal_id)
            return

        company_domain = signal.company_domain or ""
        company_name   = signal.company_name or company_domain
        signal_type    = signal.signal_type

        # ── 1. Dedup guard — one active draft per (signal_id, user_id) ──
        existing = (
            db.query(SignalSequenceDraft)
            .filter(
                SignalSequenceDraft.signal_id == uuid.UUID(signal_id),
                SignalSequenceDraft.user_id   == uuid.UUID(user_id),
                SignalSequenceDraft.status.in_(["pending", "shown"]),
            )
            .first()
        )
        if existing:
            logger.info(
                "Draft already exists for signal=%s user=%s (status=%s) — skipping",
                signal_id, user_id, existing.status,
            )
            return

        # ── 2. Daily cap — max 3 signal-sequence notifications per user ─
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = (
            db.query(SignalSequenceDraft)
            .filter(
                SignalSequenceDraft.user_id   == uuid.UUID(user_id),
                SignalSequenceDraft.created_at >= today_start,
            )
            .count()
        )
        if today_count >= 3:
            logger.info(
                "Daily cap reached for user=%s (count=%d) — skipping signal=%s",
                user_id, today_count, signal_id,
            )
            return

        # ── 3. Fetch decision-maker from ContactOut ──────────────────────
        lead_name  = signal.prospect_name
        lead_email = signal.prospect_email
        lead_role  = signal.prospect_title
        lead_linkedin_url = None

        if not lead_name and company_domain:
            try:
                from app.services.contactout_service import ContactOutService
                co = ContactOutService()
                dm_data = await co.get_decision_makers(domain=company_domain, reveal_info=False)
                profiles = dm_data.get("profiles") or dm_data.get("data") or []
                if profiles:
                    top = profiles[0] if isinstance(profiles, list) else next(iter(profiles.values()), {})
                    normalized = ContactOutService.normalize_decision_maker(top)
                    lead_name         = normalized.get("full_name") or ""
                    lead_role         = normalized.get("title") or ""
                    lead_linkedin_url = normalized.get("linkedin_url") or ""
            except Exception as exc:
                logger.warning("ContactOut lookup failed for %s: %s — using signal prospect data", company_domain, exc)

        if not lead_name:
            lead_name = f"Decision Maker at {company_name}"

        # ── 4. Lead enrichment ───────────────────────────────────────────
        trigger_context = _SIGNAL_CONTEXT_TEMPLATES.get(signal_type, _DEFAULT_SIGNAL_CONTEXT)
        # If the signal has extra detail (e.g. funding amount) surface it
        raw = signal.raw_data or {}
        if signal_type == "funding" and raw.get("funding_amount"):
            trigger_context = (
                f"This prospect's company just raised {raw['funding_amount']} "
                f"({raw.get('funding_round', 'a new funding round')})."
            )
        elif signal_type == "job_change" and raw.get("new_title"):
            trigger_context = (
                f"This prospect just became {raw['new_title']} at {company_name}."
            )

        # Build a generic template email so the optimizer has something to rewrite
        placeholder_subject = f"Congrats on the news, {{{{firstName}}}}"
        placeholder_body = (
            f"Hi {{{{firstName}}}},\n\n"
            f"I came across some exciting news about {company_name} and wanted to reach out. "
            f"Would love to share how we've helped similar companies capitalise on this moment.\n\n"
            f"Worth a quick chat?"
        )

        # ── 5. Run Email Optimizer (with trigger context) ────────────────
        analysis: dict = {}
        try:
            from app.services.copilot.campaign_optimizer_service import CampaignOptimizerService
            svc = CampaignOptimizerService(db)
            analysis = await svc.analyze(
                user_id=user_id,
                subject_line=placeholder_subject,
                email_body=placeholder_body,
                target_audience=f"B2B decision-makers at {company_name}",
                campaign_id=None,
                metrics=None,
                lead_name=lead_name if lead_name else None,
                lead_company=company_name,
                lead_role=lead_role,
                lead_domain=company_domain,
                trigger_context=trigger_context,
            )
        except Exception as exc:
            logger.warning("Email optimizer failed for signal=%s: %s — storing empty draft", signal_id, exc)

        optimized = analysis.get("optimized_email") or {}
        draft_subject = optimized.get("subject_line") or analysis.get("suggested_subjects", [placeholder_subject])[0]
        draft_body    = optimized.get("body") or placeholder_body

        effective_score = signal.icp_score
        if effective_score is None:
            effective_score = _SIGNAL_TYPE_HEURISTIC_SCORES.get(signal_type, _DEFAULT_HEURISTIC_SCORE)

        # ── 6. Persist draft ─────────────────────────────────────────────
        draft = SignalSequenceDraft(
            id             = uuid.uuid4(),
            user_id        = uuid.UUID(user_id),
            signal_id      = uuid.UUID(signal_id),
            lead_name      = lead_name,
            lead_email     = lead_email,
            lead_role      = lead_role,
            lead_domain    = company_domain,
            lead_linkedin_url = lead_linkedin_url,
            draft_email_subject = draft_subject,
            draft_email_body    = draft_body,
            optimizer_output    = analysis,
            signal_score   = effective_score,
            signal_type    = signal_type,
            company_name   = company_name,
            company_domain = company_domain,
            status         = "pending",
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)

        logger.info(
            "Signal sequence draft created: draft_id=%s signal=%s user=%s",
            draft.id, signal_id, user_id,
        )

        # ── 7. Fire in-app notification ──────────────────────────────────
        _notify_signal_draft(db, user_id, draft)

    except Exception as exc:
        db.rollback()
        logger.error("_generate_signal_sequence error: %s", exc, exc_info=True)
        raise
    finally:
        db.close()


def _notify_signal_draft(db, user_id: str, draft) -> None:
    """Push a notification to the in-app notification centre (best-effort)."""
    try:
        from app.db.repositories.notification_repository import NotificationRepository
        NotificationRepository(db).create(
            user_id=user_id,
            type="signal_draft_ready",
            title=f"New outreach draft — {draft.company_name or 'Unknown'}",
            body=(
                f"{draft.signal_type.replace('_', ' ').title()} signal detected. "
                f"A personalised email draft is ready to review."
            ),
            cta_url=f"/copilot?tab=signal-drafts",
            priority="indigo",
            company=draft.company_name,
        )
    except Exception as exc:
        logger.warning("_notify_signal_draft failed (non-fatal): %s", exc)
