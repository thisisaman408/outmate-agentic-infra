"""Public, auth-free routes that Retell AI calls directly.

Retell has no way to send an Authorization header from its dashboard, so
these endpoints live at the top of the URL tree and must self-defend:
  * /retell-webhook    — receives call_started / call_ended / call_analyzed
                         events and updates AgentRun + VoiceCampaignProspect.
  * /knowledge-search  — custom tool invoked by the Retell agent during the
                         conversation to answer questions about the caller's
                         own company (pricing, product, ICP, etc).

Why a separate router:
  Both routes need NO prefix and NO auth dependency.  Piggy-backing them on
  the /api/v1/voice-agent router pushed the webhook URL to
  /api/v1/voice-agent/retell-webhook, which is fragile to remember and easy
  to mis-register on Retell's side.  Mounting at root lets the user point
  Retell at <NGROK>/retell-webhook and <NGROK>/knowledge-search directly.

Matching webhook → AgentRun:
  We ask the caller (voice_agent._call_via_retell) to embed run_id in
  Retell's `metadata` object.  Retell echoes that back verbatim in every
  webhook payload and in custom tool invocations, so the webhook can do an
  O(1) primary-key lookup instead of scanning recent runs.  If a legacy
  call lacks metadata.run_id we fall back to a best-effort call_id
  substring scan of the last 50 runs.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.db.models.agent_run import AgentRun
from app.db.models.company_profile import UserCompanyProfile
from app.db.models.user import User
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect

logger = logging.getLogger(__name__)
router = APIRouter(tags=["retell-public"])


# ---------------------------------------------------------------------------
# /retell-webhook
# ---------------------------------------------------------------------------

def _safe_uuid(value: Any) -> Optional[uuid.UUID]:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def _booking_intent(next_steps: str) -> bool:
    if not next_steps:
        return False
    t = next_steps.lower()
    return any(kw in t for kw in ("book", "schedule", "demo", "meeting", "call back", "follow up", "follow-up"))


def _terminal_status_from_retell(
    call_status: str, disconnection_reason: str, next_steps: str
) -> str:
    """Map Retell's call_status + disconnection_reason to our AgentRun.status.

    AgentRun.status is a free String column — we stick to values the rest of
    the app already understands.  We USED to return only success/error, but
    "did Retell dial and get declined" vs "did the prospect have a real
    conversation" are different things the UI should surface distinctly.
    Current taxonomy (with frontend label mapping in _derived_call_label):
      success       — call connected + agent spoke with the human
      no_answer     — dialled, nobody picked up / spam-filter declined
                      (disconnection_reason = dial_no_answer, user_declined,
                       dial_busy, or session_status = not_connected)
      error         — Retell API error or dial failure (invalid number, etc.)
    Outcome detail is always preserved verbatim in
    output_text.call_status_final + output_text.disconnection_reason for
    audit / debug purposes.
    """
    cs = (call_status or "").lower()
    dr = (disconnection_reason or "").lower()

    if cs in ("error", "failed", "registered_call_timeout"):
        return "error"
    # Retell's "the other side never accepted the call" bucket.  We treat
    # these as no_answer because the prospect's phone never connected —
    # it's a rescheduling signal, not a failed dial (like a bad number).
    if dr in (
        "dial_no_answer", "user_declined", "dial_busy",
        "machine_detected", "voicemail_reached",
    ) or cs == "not_connected":
        return "no_answer"
    # Genuine dial failures — invalid destination, Twilio errors, etc.
    if "error" in dr or dr in ("dial_failed", "invalid_destination"):
        return "error"
    # Anything else that reaches 'ended' / 'transferred' is a connected call.
    # Booking vs just-hung-up is surfaced via extracted_variables.next_steps.
    return "success"


@router.post("/retell-webhook")
async def retell_webhook(payload: Dict[str, Any]):
    """Receive post-call data from Retell AI — public endpoint.

    Retell posts this for three events: `call_started`, `call_ended`,
    `call_analyzed`.  We only act on call_ended / call_analyzed — the
    call_started event has no useful delta (we already created the AgentRun
    before calling Retell).
    """
    from app.db.session import SessionLocal

    event = (payload.get("event") or "").lower()
    call_data = payload.get("call", payload)
    call_id = call_data.get("call_id", "") or ""
    call_status = call_data.get("call_status", "") or ""
    transcript = call_data.get("transcript", "") or ""
    call_analysis = call_data.get("call_analysis", {}) or {}
    disconnection_reason = call_data.get("disconnection_reason", "") or ""
    metadata = call_data.get("metadata", {}) or {}
    # Retell puts extracted variables here after the Conversation Flow runs
    extracted_vars = (
        call_data.get("retell_llm_dynamic_variables", {})
        or call_data.get("variables", {})
        or call_data.get("custom_analysis_data", {})
        or {}
    )

    logger.info(
        "Retell webhook: event=%s call_id=%s status=%s disconnect=%s metadata_run_id=%s",
        event, call_id, call_status, disconnection_reason, metadata.get("run_id"),
    )

    # Ignore call_started — nothing to update yet, and we don't want to
    # clobber the "running" status we set during dispatch.
    if event == "call_started":
        return {"ok": True, "ignored": "call_started"}

    if not call_id and not metadata.get("run_id"):
        return {"ok": True, "ignored": "no_identifier"}

    db = SessionLocal()
    try:
        matched_run = _find_matching_run(db, metadata, call_id)
        if not matched_run:
            logger.warning("Retell webhook: no matching AgentRun (call_id=%s run_id=%s)", call_id, metadata.get("run_id"))
            return {"ok": True, "matched": False}

        start_ts = call_data.get("start_timestamp") or 0
        end_ts = call_data.get("end_timestamp") or 0
        real_duration_ms = int(end_ts - start_ts) if (start_ts and end_ts) else 0

        final_status = _terminal_status_from_retell(
            call_status, disconnection_reason, extracted_vars.get("next_steps", "") or ""
        )
        matched_run.status = final_status
        if final_status == "error":
            matched_run.error_message = disconnection_reason or call_status or "Call failed"
        elif final_status == "no_answer":
            matched_run.error_message = disconnection_reason or "No answer"
        if real_duration_ms > 0:
            matched_run.duration_ms = real_duration_ms
        if not matched_run.finished_at:
            matched_run.finished_at = datetime.now(timezone.utc)

        # Merge into output_text — preserve previous dispatch payload.
        try:
            result_data = json.loads(matched_run.output_text) if matched_run.output_text else {}
        except (TypeError, ValueError):
            result_data = {}

        result_data["call_status_final"] = call_status
        result_data["disconnection_reason"] = disconnection_reason
        result_data["duration_ms"] = real_duration_ms
        result_data["transcript"] = transcript
        result_data["call_analysis"] = call_analysis
        result_data["extracted_variables"] = {
            k: extracted_vars.get(k, "")
            for k in (
                "name", "pain_points", "current_tools", "budget_mentioned",
                "decision_maker", "next_steps", "objections",
                "competitor_mentioned", "timeline", "key_quotes",
            )
        }
        matched_run.output_text = json.dumps(result_data)

        existing_leads = matched_run.leads or []
        if existing_leads and isinstance(existing_leads[0], dict):
            existing_leads[0]["extracted"] = result_data["extracted_variables"]
            existing_leads[0]["transcript_preview"] = transcript[:500]
            matched_run.leads = existing_leads

        # Sync the voice-campaign prospect + campaign counters.
        _sync_campaign_prospect(
            db,
            run_id=matched_run.id,
            final_status=final_status,
            booked=_booking_intent(result_data["extracted_variables"].get("next_steps", "")),
            error_message=matched_run.error_message,
        )

        db.commit()
        logger.info(
            "Retell webhook: updated AgentRun %s → status=%s duration=%dms booked=%s",
            matched_run.id, final_status, real_duration_ms,
            _booking_intent(result_data["extracted_variables"].get("next_steps", "")),
        )
        return {"ok": True, "matched": True, "run_id": str(matched_run.id)}
    except Exception as e:
        logger.error("Retell webhook processing error: %s", e, exc_info=True)
        db.rollback()
        return {"ok": False, "error": "internal"}
    finally:
        db.close()


def _find_matching_run(db, metadata: Dict[str, Any], call_id: str) -> Optional[AgentRun]:
    run_id = _safe_uuid(metadata.get("run_id"))
    if run_id:
        run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if run:
            return run
        logger.warning("Retell webhook: metadata.run_id=%s not found; falling back to call_id scan", run_id)

    # Fallback: old dispatches stored call_id inside output_text/leads.
    if not call_id:
        return None
    recent = (
        db.query(AgentRun)
        .filter(AgentRun.agent_type == "voice-agent")
        .order_by(AgentRun.created_at.desc())
        .limit(50)
        .all()
    )
    for r in recent:
        if r.output_text and call_id in r.output_text:
            return r
        leads = r.leads or []
        if leads and isinstance(leads[0], dict) and leads[0].get("call_id") == call_id:
            return r
    return None


def _sync_campaign_prospect(
    db,
    run_id: uuid.UUID,
    final_status: str,
    booked: bool,
    error_message: Optional[str],
) -> None:
    """Mirror the AgentRun outcome onto the matching VoiceCampaignProspect
    and campaign counters.

    Status collapsing: VoiceCampaignProspect.status sticks to the original
    enum (queued | calling | success | error | skipped) so the frontend's
    STATUS_COLORS map keeps working.  no_answer maps to "error" here
    because from the campaign's perspective the attempt didn't succeed —
    but we tag the error_message with the specific reason so the UI can
    differentiate "Not connected" from "Actual dial failure"."""
    prospect = (
        db.query(VoiceCampaignProspect)
        .filter(VoiceCampaignProspect.agent_run_id == run_id)
        .first()
    )
    if not prospect:
        return

    if final_status in ("error", "no_answer"):
        prospect.status = "error"
        prospect.error_message = error_message or ("No answer" if final_status == "no_answer" else "Call failed")
    else:
        prospect.status = "success"
    prospect.finished_at = datetime.now(timezone.utc)

    campaign = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == prospect.campaign_id)
        .first()
    )
    if not campaign:
        return
    # calls_made was bumped at dispatch time; only adjust booked/failed here.
    if final_status in ("error", "no_answer"):
        campaign.calls_failed += 1
    elif booked:
        campaign.calls_booked += 1


# ---------------------------------------------------------------------------
# /knowledge-search
# ---------------------------------------------------------------------------

class KnowledgeSearchRequest(BaseModel):
    # Retell templates vary between installations, so accept every name we've
    # ever seen for "which tenant is asking" + "what do they want to know".
    client_name: Optional[str] = None
    my_company_name: Optional[str] = None
    company_name: Optional[str] = None
    query: Optional[str] = None
    question: Optional[str] = None
    # Retell always echoes call metadata; we can use run_id as a tiebreaker.
    call_id: Optional[str] = None
    run_id: Optional[str] = None


def _pick_profile(db, req: KnowledgeSearchRequest) -> Optional[UserCompanyProfile]:
    """Resolve which tenant's profile to serve for this knowledge lookup.

    Tenant selection is driven EXCLUSIVELY by the run_id that voice_agent
    embeds in retell_llm_dynamic_variables on dispatch, which the Retell
    agent echoes back in its custom-tool request body as `{{run_id}}`.

    Why not fall back to matching on company_name:
      * Two tenants can share a company name ("Acme" is common) — a string
        fallback returns the wrong profile for one of them.
      * /knowledge-search is unauthenticated (Retell can't send an Authz
        header from its dashboard).  A string-matched fallback means
        anyone who curls this endpoint with a known company name gets
        that tenant's pitch/pricing back.  run_id acts as a soft
        capability token: you only get the profile if you also know a
        valid call's UUID (128-bit) that hasn't been reaped by the stale
        cleanup job, and which maps to a real AgentRun in our DB.

    If you need looser matching in the future, add an HMAC-signed
    short-lived token in dynamic_vars instead of opening the company_name
    hole.
    """
    run_uuid = _safe_uuid(req.run_id)
    if not run_uuid:
        return None
    run = db.query(AgentRun).filter(AgentRun.id == run_uuid).first()
    if not run:
        return None
    return (
        db.query(UserCompanyProfile)
        .filter(UserCompanyProfile.user_id == run.user_id)
        .first()
    )


def _score_section(section: str, query: str) -> int:
    if not section:
        return 0
    if not query:
        return 1  # any non-empty section is marginally relevant
    q = query.lower()
    s = section.lower()
    score = 0
    # Keyword hits weighted by token length (bigger tokens = more specific).
    for tok in {t for t in q.replace("?", " ").split() if len(t) >= 3}:
        if tok in s:
            score += len(tok)
    return score


@router.post("/knowledge-search")
async def knowledge_search(req: KnowledgeSearchRequest):
    """Custom tool endpoint invoked by the Retell agent during a call.

    Retell sends the dynamic variables of the active call as the request
    body.  We match the caller's company to a UserCompanyProfile row and
    return the most relevant pitch/pricing/ICP snippets for the question.

    Response shape is intentionally LLM-friendly — a single `result` string
    concatenating the top-scoring sections so the agent can read it back in
    one sentence.  The `sections` array is provided for debugging.
    """
    from app.db.session import SessionLocal

    query = (req.query or req.question or "").strip()
    logger.info(
        "knowledge-search: client_name=%r my_company_name=%r run_id=%r query=%r",
        req.client_name, req.my_company_name, req.run_id, query[:120],
    )

    db = SessionLocal()
    try:
        profile = _pick_profile(db, req)
        if not profile:
            # Either no run_id was templated in, or it didn't resolve.  We
            # deliberately refuse here rather than fall back to matching on
            # the publicly-templated client_name — that would let anyone
            # curl this endpoint and pull a tenant's pitch back by name.
            logger.warning(
                "knowledge-search refused: no run_id match (run_id=%r client_name=%r)",
                req.run_id, req.client_name,
            )
            return {
                "ok": False,
                "result": "I don't have product details loaded for this call.",
                "sections": [],
            }

        candidates: List[Dict[str, str]] = [
            {"label": "What we do", "text": profile.one_liner or ""},
            {"label": "Product", "text": profile.product_description or ""},
            {"label": "Pricing", "text": profile.pricing_summary or ""},
            {"label": "Ideal customer", "text": profile.icp_description or ""},
            {"label": "Differentiators", "text": profile.key_differentiators or ""},
            {"label": "Common objections", "text": profile.objection_handling or ""},
            {"label": "More context", "text": profile.additional_context or ""},
            {"label": "Booking link", "text": profile.calendar_booking_url or ""},
        ]
        ranked = sorted(
            (c for c in candidates if c["text"].strip()),
            key=lambda c: _score_section(c["text"], query),
            reverse=True,
        )
        top = ranked[:3] if ranked else []

        if not top:
            return {
                "ok": True,
                "result": f"I don't have details on that for {profile.company_name} yet.",
                "sections": [],
                "company": profile.company_name,
            }

        result_text = " ".join(f"{s['label']}: {s['text']}" for s in top)
        # Keep response concise — Retell's agent reads this back in a sentence.
        if len(result_text) > 900:
            result_text = result_text[:897] + "..."

        return {
            "ok": True,
            "result": result_text,
            "sections": top,
            "company": profile.company_name,
        }
    except Exception as e:
        logger.error("knowledge-search error: %s", e, exc_info=True)
        return {
            "ok": False,
            "result": "I'm having trouble looking that up right now.",
            "sections": [],
        }
    finally:
        db.close()
