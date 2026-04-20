"""Backfill stale voice-agent AgentRuns from Retell's REST API.

Why this exists:
  Before the webhook-path fix in retell_public.py, every completed call
  sat in the DB with duration_ms set to ~1000 (the HTTP dispatch time)
  and no transcript, because the Retell webhook was POSTing to a dead
  ngrok URL and 404ing.  This script re-hydrates those rows by pulling
  the authoritative call record from Retell's `GET /v2/get-call/{id}`
  endpoint and writing the real values back.

Idempotent: safe to re-run.  We skip rows that already have a transcript
OR a duration_ms > 10 000 ms (anything over 10s can't be the dispatch
latency artifact, so we trust the value already in the DB).

Usage:
  cd Backend && python -m scripts.backfill_retell_calls
  cd Backend && python -m scripts.backfill_retell_calls --user-id <uuid>
  cd Backend && python -m scripts.backfill_retell_calls --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import httpx
from dotenv import load_dotenv

load_dotenv()

from app.core.config import settings  # noqa: E402
from app.db.models.agent_run import AgentRun  # noqa: E402
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
# Silence the SQLAlchemy engine INFO logs — they drown out our progress.
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger("backfill")

RETELL_API_BASE = "https://api.retellai.com/v2"
DISPATCH_LATENCY_CEILING_MS = 10_000  # anything ≤ this is likely the old bug


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _call_id_from_run(run: AgentRun) -> Optional[str]:
    """Pull the Retell call_id we stored at dispatch time."""
    # Path 1: run.leads[0].call_id (most recent dispatch code)
    leads = run.leads or []
    if leads and isinstance(leads[0], dict):
        cid = leads[0].get("call_id")
        if cid:
            return cid
    # Path 2: run.output_text JSON.call_id
    if run.output_text:
        try:
            data = json.loads(run.output_text)
            cid = data.get("call_id")
            if cid:
                return cid
        except (TypeError, ValueError):
            pass
    return None


def _should_backfill(run: AgentRun) -> bool:
    """True if this row looks like it has the 'dispatch-only' data shape."""
    # Already has a real transcript? Trust it.
    if run.output_text:
        try:
            data = json.loads(run.output_text)
            if (data.get("transcript") or "").strip():
                return False
        except (TypeError, ValueError):
            pass
    # Has a real duration? Trust it.
    if (run.duration_ms or 0) > DISPATCH_LATENCY_CEILING_MS:
        return False
    return True


# ---------------------------------------------------------------------------
# Retell API
# ---------------------------------------------------------------------------

async def _fetch_retell_call(client: httpx.AsyncClient, call_id: str) -> Optional[Dict[str, Any]]:
    url = f"{RETELL_API_BASE}/get-call/{call_id}"
    try:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {settings.RETELL_API_KEY}"},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        logger.warning("Retell GET %s failed: %s", call_id, exc)
        return None
    if resp.status_code == 404:
        logger.info("Retell has no record of call_id=%s (deleted or test call)", call_id)
        return None
    if resp.status_code >= 400:
        logger.warning("Retell %d on call_id=%s: %s", resp.status_code, call_id, resp.text[:300])
        return None
    return resp.json()


# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------

_BOOKING_KEYWORDS = ("book", "schedule", "demo", "meeting", "call back", "follow up", "follow-up")


def _is_booking(next_steps: str) -> bool:
    if not next_steps:
        return False
    low = next_steps.lower()
    return any(k in low for k in _BOOKING_KEYWORDS)


def _final_status(call_status: str, disconnection_reason: str) -> Tuple[str, Optional[str]]:
    """Kept in lock-step with retell_public._terminal_status_from_retell —
    see the comment there for why 'no_answer' is a distinct bucket."""
    cs = (call_status or "").lower()
    dr = (disconnection_reason or "").lower()
    if cs in ("error", "failed", "registered_call_timeout"):
        return "error", disconnection_reason or call_status or "Call failed"
    if dr in (
        "dial_no_answer", "user_declined", "dial_busy",
        "machine_detected", "voicemail_reached",
    ) or cs == "not_connected":
        return "no_answer", disconnection_reason or "No answer"
    if "error" in dr or dr in ("dial_failed", "invalid_destination"):
        return "error", disconnection_reason
    return "success", None


def _apply_call_data(run: AgentRun, call: Dict[str, Any], db) -> Dict[str, Any]:
    """Write Retell's authoritative call data onto the AgentRun row
    and the matching VoiceCampaignProspect (if any).  Returns a summary
    of what changed for the caller to print."""

    extracted = (
        call.get("retell_llm_dynamic_variables", {})
        or call.get("variables", {})
        or call.get("custom_analysis_data", {})
        or {}
    )
    start_ts = call.get("start_timestamp") or 0
    end_ts = call.get("end_timestamp") or 0
    duration_ms = int(end_ts - start_ts) if (start_ts and end_ts) else 0

    call_status = call.get("call_status", "") or ""
    disconnection_reason = call.get("disconnection_reason", "") or ""
    transcript = call.get("transcript", "") or ""
    call_analysis = call.get("call_analysis", {}) or {}

    final_status, error_msg = _final_status(call_status, disconnection_reason)

    run.status = final_status
    if error_msg:
        run.error_message = error_msg
    if duration_ms > 0:
        run.duration_ms = duration_ms
    if not run.finished_at:
        run.finished_at = datetime.now(timezone.utc)

    # Merge onto output_text
    try:
        result_data = json.loads(run.output_text) if run.output_text else {}
    except (TypeError, ValueError):
        result_data = {}
    result_data["call_status_final"] = call_status
    result_data["disconnection_reason"] = disconnection_reason
    result_data["duration_ms"] = duration_ms
    result_data["transcript"] = transcript
    result_data["call_analysis"] = call_analysis
    result_data["extracted_variables"] = {
        k: extracted.get(k, "")
        for k in (
            "name", "pain_points", "current_tools", "budget_mentioned",
            "decision_maker", "next_steps", "objections",
            "competitor_mentioned", "timeline", "key_quotes",
        )
    }
    run.output_text = json.dumps(result_data)

    existing_leads = run.leads or []
    if existing_leads and isinstance(existing_leads[0], dict):
        existing_leads[0]["extracted"] = result_data["extracted_variables"]
        existing_leads[0]["transcript_preview"] = transcript[:500]
        run.leads = existing_leads

    # Sync voice-campaign prospect counters
    prospect = (
        db.query(VoiceCampaignProspect)
        .filter(VoiceCampaignProspect.agent_run_id == run.id)
        .first()
    )
    if prospect:
        # Collapse to the enum VoiceCampaignProspect.status already supports
        # — detail (e.g. "No answer" vs "Dial failed") is preserved on
        # error_message so the UI can still show the real reason.
        if final_status in ("error", "no_answer"):
            prospect.status = "error"
            prospect.error_message = error_msg or ("No answer" if final_status == "no_answer" else "Call failed")
        else:
            prospect.status = "success"
        if not prospect.finished_at:
            prospect.finished_at = datetime.now(timezone.utc)

        campaign = (
            db.query(VoiceCampaign)
            .filter(VoiceCampaign.id == prospect.campaign_id)
            .first()
        )
        if campaign and final_status in ("error", "no_answer"):
            # calls_failed was NOT previously bumped (old bug inflated
            # calls_booked instead), so nudge the counters toward truth.
            campaign.calls_failed = (campaign.calls_failed or 0) + 1
            campaign.calls_booked = max(0, (campaign.calls_booked or 0) - 1)
        elif campaign and not _is_booking(result_data["extracted_variables"].get("next_steps", "")):
            # Completed but NOT booked — roll back the old inflated booked
            # counter once (guard with calls_booked > 0 to avoid going
            # negative on re-runs).
            campaign.calls_booked = max(0, (campaign.calls_booked or 0) - 1)

    return {
        "status": final_status,
        "duration_ms": duration_ms,
        "has_transcript": bool(transcript),
        "call_status": call_status,
        "disconnection_reason": disconnection_reason,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def backfill(user_id: Optional[str] = None, dry_run: bool = False) -> int:
    if not settings.RETELL_API_KEY:
        logger.error("RETELL_API_KEY is not set — nothing to reconcile against.")
        return 1

    db = SessionLocal()
    try:
        q = (
            db.query(AgentRun)
            .filter(AgentRun.agent_type == "voice-agent")
            .filter(AgentRun.flow_id == "retell")
        )
        if user_id:
            q = q.filter(AgentRun.user_id == user_id)
        q = q.order_by(AgentRun.created_at.desc())
        runs: List[AgentRun] = q.all()

        candidates = [r for r in runs if _should_backfill(r)]
        logger.info(
            "found %d voice-agent runs, %d look stale (need backfill)%s",
            len(runs), len(candidates), f" for user_id={user_id}" if user_id else "",
        )
        if not candidates:
            return 0

        updated = 0
        missing_call_id = 0
        retell_404 = 0

        async with httpx.AsyncClient() as client:
            for run in candidates:
                call_id = _call_id_from_run(run)
                if not call_id:
                    missing_call_id += 1
                    logger.debug("run %s has no call_id — skipping", run.id)
                    continue

                call = await _fetch_retell_call(client, call_id)
                if not call:
                    retell_404 += 1
                    continue

                summary = _apply_call_data(run, call, db)
                updated += 1
                logger.info(
                    "run %s (call %s) → status=%s duration=%dms transcript=%s",
                    run.id, call_id, summary["status"], summary["duration_ms"],
                    "yes" if summary["has_transcript"] else "no",
                )

                if not dry_run:
                    db.commit()
                else:
                    db.rollback()

        logger.info(
            "done. updated=%d skipped_no_call_id=%d retell_404=%d dry_run=%s",
            updated, missing_call_id, retell_404, dry_run,
        )
        return 0
    finally:
        db.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--user-id", help="Only reconcile runs for this user UUID")
    ap.add_argument("--dry-run", action="store_true", help="Fetch + report without writing")
    args = ap.parse_args()
    return asyncio.run(backfill(user_id=args.user_id, dry_run=args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
