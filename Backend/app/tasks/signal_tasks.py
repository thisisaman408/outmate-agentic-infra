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

                # TODO: Route to Co-Pilot queue
                # This requires knowing which user owns this signal
                logger.debug(f"Signal ready for Co-Pilot: {signal_event.id}")

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
