"""
Celery tasks for signal pipeline.

Scheduled tasks (via Celery Beat):
  - process_signal_events_task      — runs every minute to consume and process signals
  - archive_stale_signals_task      — runs daily at 02:00 UTC

On-demand tasks:
  - ingest_signal_task              — ingest a single signal
"""

import asyncio
import logging

from celery.schedules import crontab

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.services.signal_pipeline import (
    SignalEventBus,
    SignalIngester,
    SignalEnricher,
    SignalDeduplicator,
    ICPSignalScorer,
    SignalCreditManager,
)
from app.services.signal_pipeline.signal_archiver import SignalArchiver

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Celery Beat Schedule
# ─────────────────────────────────────────────────────────────

celery_app.conf.beat_schedule.update({
    "process-signals": {
        "task": "app.tasks.signal_tasks.process_signal_events_task",
        "schedule": crontab(minute="*/1"),  # Every minute
    },
    "archive-stale-signals": {
        "task": "app.tasks.signal_tasks.archive_stale_signals_task",
        "schedule": crontab(hour=2, minute=0),  # 02:00 UTC daily
    },
})


# ─────────────────────────────────────────────────────────────
# Scheduled: Process signals from event bus
# ─────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.signal_tasks.process_signal_events_task", bind=True)
def process_signal_events_task(self):
    """
    Consume signals from event bus, enrich, deduplicate, score, and route to Co-Pilot.

    This runs every minute and processes up to 100 signals per run.
    """
    logger.info("→ Starting signal processing task")
    return asyncio.run(_process_signal_events())


async def _process_signal_events():
    """Inner async function for signal processing."""
    db = SessionLocal()
    event_bus = SignalEventBus()
    ingester = SignalIngester(db)
    enricher = SignalEnricher(db)
    deduplicator = SignalDeduplicator()
    scorer = ICPSignalScorer(db)
    credit_mgr = SignalCreditManager(db)
    archiver = SignalArchiver(db)

    try:
        # Consume signals from event bus
        signals = await event_bus.consume_signals(count=100)

        if not signals:
            logger.debug("No signals to process")
            return {"processed": 0, "suppressed": 0, "errors": 0}

        logger.info(f"Processing {len(signals)} signals from event bus")

        processed = 0
        suppressed = 0
        errors = 0

        for signal_msg in signals:
            stream_id = signal_msg.get("stream_id")
            raw_data = signal_msg.get("data", {})

            try:
                # Parse raw signal
                signal_type = raw_data.get("signal_type", "unknown")
                source = raw_data.get("source", "unknown")
                company_domain = raw_data.get("company_domain")
                company_name = raw_data.get("company_name")
                prospect_email = raw_data.get("prospect_email")
                prospect_name = raw_data.get("prospect_name")

                logger.debug(f"Processing signal: type={signal_type}, source={source}")

                # Check 24hr dedup window
                # First, try to get fingerprint from ingested signal or generate one
                from app.services.signal_pipeline.signal_ingester import generate_signal_fingerprint
                fingerprint = generate_signal_fingerprint(
                    source=source,
                    signal_type=signal_type,
                    company_domain=company_domain,
                    prospect_email=prospect_email,
                )

                should_suppress = await deduplicator.should_suppress(
                    fingerprint=fingerprint,
                    company_domain=company_domain,
                    signal_type=signal_type,
                )

                if should_suppress:
                    logger.info(f"Suppressing duplicate signal: {signal_type} / {company_domain}")
                    suppressed += 1
                    await event_bus.acknowledge_signal(stream_id)
                    continue

                # Ingest signal into database
                signal_event = await ingester.ingest_signal(
                    signal_type=signal_type,
                    source=source,
                    company_domain=company_domain,
                    company_name=company_name,
                    prospect_email=prospect_email,
                    prospect_name=prospect_name,
                    raw_data=raw_data,
                )

                if not signal_event:
                    logger.warning(f"Failed to ingest signal: {signal_type}")
                    errors += 1
                    await event_bus.acknowledge_signal(stream_id)
                    continue

                # Enrich signal
                signal_event = await enricher.enrich_signal(signal_event)

                # TODO: Score signal for ICP (requires user context)
                # For now, leave icp_score as NULL
                logger.debug(f"Enriched signal: {signal_event.id}")

                # Mark as processed in dedup window
                await deduplicator.mark_processed(
                    fingerprint=fingerprint,
                    company_domain=company_domain,
                    signal_type=signal_type,
                )

                # Signal-to-Sequence: check ICP score against each watching user's threshold
                # and dispatch sequence generation for those who qualify.
                await _maybe_dispatch_sequences(db, signal_event)

                # Acknowledge signal in stream
                await event_bus.acknowledge_signal(stream_id)

                processed += 1
            except Exception as e:
                logger.error(f"Error processing signal: {e}", exc_info=True)
                errors += 1
                try:
                    await event_bus.acknowledge_signal(stream_id)
                except Exception as ack_err:
                    logger.error(f"Failed to acknowledge signal: {ack_err}")

        logger.info(
            f"Signal processing complete: processed={processed}, suppressed={suppressed}, errors={errors}"
        )
        return {
            "processed": processed,
            "suppressed": suppressed,
            "errors": errors,
        }
    except Exception as e:
        logger.error(f"Signal processing task failed: {e}", exc_info=True)
        return {"processed": 0, "suppressed": 0, "errors": 1}
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Scheduled: Archive stale signals
# ─────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.signal_tasks.archive_stale_signals_task", bind=True)
def archive_stale_signals_task(self):
    """Archive signals older than 7 days."""
    logger.info("→ Starting signal archival task")
    return asyncio.run(_archive_stale_signals())


async def _archive_stale_signals():
    """Inner async function for archival."""
    db = SessionLocal()
    archiver = SignalArchiver(db)

    try:
        archived, errors = await archiver.archive_stale_signals()
        logger.info(f"Archival task complete: archived={archived}, errors={errors}")
        return {"archived": archived, "errors": errors}
    except Exception as e:
        logger.error(f"Signal archival task failed: {e}", exc_info=True)
        return {"archived": 0, "errors": 1}
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# On-Demand: Ingest a single signal
# ─────────────────────────────────────────────────────────────

@celery_app.task(name="app.tasks.signal_tasks.ingest_signal_task")
def ingest_signal_task(
    signal_type: str,
    source: str,
    company_domain: str = None,
    company_name: str = None,
    prospect_email: str = None,
    prospect_name: str = None,
):
    """Ingest a single signal on-demand."""
    logger.info(f"Ingesting signal: type={signal_type}, source={source}")

    db = SessionLocal()
    ingester = SignalIngester(db)

    try:
        return asyncio.run(
            ingester.ingest_signal(
                signal_type=signal_type,
                source=source,
                company_domain=company_domain,
                company_name=company_name,
                prospect_email=prospect_email,
                prospect_name=prospect_name,
            )
        )
    except Exception as e:
        logger.error(f"Failed to ingest signal: {e}", exc_info=True)
        return None
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Signal-to-Sequence: threshold check helper
# ─────────────────────────────────────────────────────────────

# Heuristic scores used when icp_score is NULL (mirrors sequence_tasks.py)
_SIGNAL_HEURISTIC_SCORES = {
    "funding": 85,
    "hiring": 75,
    "g2_intent": 90,
    "website_visit": 70,
    "email_open": 80,
    "job_change": 65,
    "linkedin_activity": 60,
}
_DEFAULT_HEURISTIC = 65


async def _maybe_dispatch_sequences(db, signal_event) -> None:
    """
    Find all users who have an account-type watcher matching signal_event.company_domain
    (or company_name), check each user's signal_score_threshold preference, and dispatch
    generate_signal_sequence for those whose threshold is met.

    Does NOT raise — failures are logged and swallowed so the main pipeline continues.
    """
    try:
        from app.db.models.watcher import Watcher
        from app.db.models.copilot_preferences import CopilotUserPreferences

        company_domain = (signal_event.company_domain or "").lower().strip()
        company_name   = (signal_event.company_name or "").lower().strip()

        if not company_domain and not company_name:
            return  # nothing to match against

        # Effective ICP score for this signal
        effective_score = signal_event.icp_score
        if effective_score is None:
            effective_score = _SIGNAL_HEURISTIC_SCORES.get(
                signal_event.signal_type, _DEFAULT_HEURISTIC
            )

        # Find active account watchers that match this domain or company name
        watchers_q = db.query(Watcher).filter(Watcher.status == "active")
        matching_watchers = [
            w for w in watchers_q
            if (
                (company_domain and w.account_domain and
                 company_domain in w.account_domain.lower())
                or
                (company_name and w.account_name and
                 company_name in w.account_name.lower())
            )
        ]

        if not matching_watchers:
            logger.debug(
                "No account watchers match signal=%s domain=%s — skipping sequence dispatch",
                signal_event.id, company_domain,
            )
            return

        dispatched_users: set[str] = set()
        signal_id_str = str(signal_event.id)

        for watcher in matching_watchers:
            user_id_str = str(watcher.user_id)
            if user_id_str in dispatched_users:
                continue  # already dispatched for this user

            # Look up user's threshold preference (default 70)
            prefs = (
                db.query(CopilotUserPreferences)
                .filter(CopilotUserPreferences.user_id == watcher.user_id)
                .first()
            )
            threshold = getattr(prefs, "signal_score_threshold", 70) if prefs else 70

            if effective_score < threshold:
                logger.debug(
                    "Signal score %d < threshold %d for user=%s signal=%s — skipping",
                    effective_score, threshold, user_id_str, signal_id_str,
                )
                continue

            # Dispatch the sequence generation task
            from app.tasks.sequence_tasks import generate_signal_sequence
            generate_signal_sequence.delay(
                signal_id=signal_id_str,
                user_id=user_id_str,
            )
            dispatched_users.add(user_id_str)
            logger.info(
                "Dispatched generate_signal_sequence: signal=%s user=%s score=%d threshold=%d",
                signal_id_str, user_id_str, effective_score, threshold,
            )

    except Exception as exc:
        logger.warning(
            "_maybe_dispatch_sequences failed (non-fatal): %s", exc, exc_info=True
        )
