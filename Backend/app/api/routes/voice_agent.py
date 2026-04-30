"""Voice AI Agent routes — config, stats, calls, and AI script rewrite.

Stores agent configuration in Redis. Triggers outbound calls via Retell AI.
Falls back to agentic infra VoiceOutreachAgent flow when Retell is not
configured. Persists every call attempt in `agent_runs` for audit trail.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.config import settings
from app.core.redis import RedisManager
from app.db.deps import get_db
from app.db.models.agent_run import AgentRun
from app.db.models.user import User
from app.db.utils import deduct_credits, check_sufficient_credits

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/voice-agent", tags=["voice-agent"])

RETELL_API_BASE = "https://api.retellai.com/v2"

# ---------------------------------------------------------------------------
# Redis key helpers
# ---------------------------------------------------------------------------

def _config_key(user_id: str) -> str:
    return f"voice_agent:config:{user_id}"

def _calls_key(user_id: str) -> str:
    return f"voice_agent:calls:{user_id}"

def _stats_key(user_id: str) -> str:
    return f"voice_agent:stats:{user_id}"

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SignalTrigger(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool = False

class CrmSettings(BaseModel):
    auto_create_hubspot: bool = True
    log_transcript: bool = True
    send_followup_email: bool = True
    slack_booked_alert: bool = False

class CallScript(BaseModel):
    opening: str = "Hi {{first_name}}, this is Alex calling from Outmate.\n\nI saw that {{company_name}} recently {{signal_event}} — congratulations on that. We work with GTM teams at companies like yours who are scaling outbound..."
    objection_handling: str = "I understand your concern. Many of our customers felt the same way before seeing how..."
    closing: str = "Would it make sense to schedule a quick 15-minute call with our team to explore this further?"

class VoiceAgentConfig(BaseModel):
    status: str = "active"  # active | paused
    voice_persona: str = "Alex (Neutral EN-US)"
    call_objective: str = "Book discovery call"
    max_calls_per_day: int = 50
    fallback_action: str = "Leave voicemail + send follow-up email"
    call_list_source: str = "Outmate Database — live segment"
    icp_filter: str = "Series A–C · SaaS · 20–200 employees · EU + US"
    signal_triggers: List[SignalTrigger] = []
    call_script: CallScript = CallScript()
    crm_settings: CrmSettings = CrmSettings()

class VoiceAgentStats(BaseModel):
    calls_made: int = 0
    calls_today: int = 0
    meetings_booked: int = 0
    booking_rate: float = 0.0
    avg_call_duration: str = "0:00"
    signal_triggered: int = 0
    signal_triggered_pct: float = 0.0
    connected_rate: float = 0.0
    voicemail_rate: float = 0.0
    no_answer_rate: float = 0.0
    in_queue: int = 0

class RecentCall(BaseModel):
    id: str
    initials: str
    name: str
    company: str
    signal_type: str
    status: str  # Booked | Call back | Voicemail | No answer
    duration: str
    timestamp: Optional[str] = None

class TriggerCallRequest(BaseModel):
    prospect_name: str
    prospect_phone: str
    prospect_company: str = ""
    prospect_role: str = ""
    prospect_city: str = ""
    prospect_industry: str = ""
    call_objective: str = "discovery"
    context: str = ""

class ScriptRewriteRequest(BaseModel):
    section: str  # opening | objection_handling | closing
    current_text: str
    tone: str = "professional"

# ---------------------------------------------------------------------------
# Default data
# ---------------------------------------------------------------------------

DEFAULT_SIGNAL_TRIGGERS = [
    SignalTrigger(id="funding", name="Funding round detected", description="Call within 24h of Series A–C announced", enabled=True),
    SignalTrigger(id="vp_hired", name="New VP / C-suite hired", description="GTM leader joins ICP company — call within 48h", enabled=True),
    SignalTrigger(id="hiring_spike", name="Hiring spike — Sales / GTM", description="Company posts 3+ GTM roles in 30 days", enabled=True),
    SignalTrigger(id="website_visitor", name="Website visitor — pricing page", description="ICP company visits pricing page, no demo booked", enabled=False),
    SignalTrigger(id="tech_stack", name="Tech stack change", description="Competitor tool removed or replaced", enabled=False),
]

DEFAULT_RECENT_CALLS: List[Dict[str, Any]] = [
    {"id": "c1", "initials": "SR", "name": "Sarah R.", "company": "Stripe competitor", "signal_type": "Funding signal", "status": "Booked", "duration": "3:42"},
    {"id": "c2", "initials": "MK", "name": "Marcus K.", "company": "Series B SaaS", "signal_type": "New VP Sales hired", "status": "Call back", "duration": "1:18"},
    {"id": "c3", "initials": "AL", "name": "Anita L.", "company": "Fintech", "signal_type": "GTM hiring spike", "status": "Booked", "duration": "4:07"},
    {"id": "c4", "initials": "DJ", "name": "David J.", "company": "HR Tech", "signal_type": "Funding round", "status": "Voicemail", "duration": "0:28"},
    {"id": "c5", "initials": "PW", "name": "Priya W.", "company": "Dev tools", "signal_type": "Pricing page visit", "status": "No answer", "duration": "0:00"},
    {"id": "c6", "initials": "TC", "name": "Tom C.", "company": "E-commerce", "signal_type": "Tech stack change", "status": "Booked", "duration": "2:55"},
]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/config", response_model=VoiceAgentConfig)
async def get_voice_agent_config(user: User = Depends(get_current_user)):
    """Get voice agent configuration for the current user."""
    redis = RedisManager.get_client()
    raw = await redis.get(_config_key(str(user.id)))
    if raw:
        return VoiceAgentConfig(**json.loads(raw))
    # Return defaults
    config = VoiceAgentConfig(signal_triggers=DEFAULT_SIGNAL_TRIGGERS)
    return config


@router.put("/config", response_model=VoiceAgentConfig)
async def update_voice_agent_config(
    config: VoiceAgentConfig,
    user: User = Depends(get_current_user),
):
    """Update voice agent configuration."""
    redis = RedisManager.get_client()
    await redis.set(
        _config_key(str(user.id)),
        config.model_dump_json(),
        ex=60 * 60 * 24 * 30,  # 30 day TTL
    )
    return config


@router.get("/stats", response_model=VoiceAgentStats)
async def get_voice_agent_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get real voice agent statistics from agent_runs table."""
    from sqlalchemy import func as sqlfunc
    from datetime import date

    # Total calls
    total = db.query(sqlfunc.count(AgentRun.id)).filter(
        AgentRun.user_id == user.id, AgentRun.agent_type == "voice-agent"
    ).scalar() or 0

    # Calls today
    today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
    today = db.query(sqlfunc.count(AgentRun.id)).filter(
        AgentRun.user_id == user.id,
        AgentRun.agent_type == "voice-agent",
        AgentRun.created_at >= today_start,
    ).scalar() or 0

    # Successful calls (booked)
    success = db.query(sqlfunc.count(AgentRun.id)).filter(
        AgentRun.user_id == user.id,
        AgentRun.agent_type == "voice-agent",
        AgentRun.status == "success",
    ).scalar() or 0

    # Avg duration
    avg_ms = db.query(sqlfunc.avg(AgentRun.duration_ms)).filter(
        AgentRun.user_id == user.id,
        AgentRun.agent_type == "voice-agent",
        AgentRun.duration_ms.isnot(None),
    ).scalar()
    if avg_ms:
        mins = int(avg_ms / 60000)
        secs = int((avg_ms % 60000) / 1000)
        avg_dur = f"{mins}:{secs:02d}"
    else:
        avg_dur = "0:00"

    # Total credits used
    credits = db.query(sqlfunc.sum(AgentRun.cost_credits)).filter(
        AgentRun.user_id == user.id, AgentRun.agent_type == "voice-agent"
    ).scalar() or 0

    booking_rate = round((success / total * 100), 1) if total > 0 else 0.0

    return VoiceAgentStats(
        calls_made=total,
        calls_today=today,
        meetings_booked=success,
        booking_rate=booking_rate,
        avg_call_duration=avg_dur,
        signal_triggered=0,
        signal_triggered_pct=0.0,
        connected_rate=round((success / total * 100), 1) if total > 0 else 0.0,
        voicemail_rate=0.0,
        no_answer_rate=0.0,
        in_queue=0,
    )


@router.get("/calls", response_model=List[RecentCall])
async def get_recent_calls(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get recent calls from agent_runs table — real data only."""
    # Stale "running" cleanup — if a call has been in "running" for > 5min,
    # the Retell webhook either never fired (dead webhook URL) or the sync
    # flow crashed.  Mark as "error" so the UI stops lying.
    from datetime import timedelta
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    stale = (
        db.query(AgentRun)
        .filter(
            AgentRun.user_id == user.id,
            AgentRun.agent_type == "voice-agent",
            AgentRun.status == "running",
            AgentRun.created_at < stale_cutoff,
        )
        .all()
    )
    for s in stale:
        s.status = "error"
        s.error_message = s.error_message or "Call timed out — no Retell webhook received within 5min"
        s.finished_at = datetime.now(timezone.utc)
    if stale:
        db.commit()

    runs = (
        db.query(AgentRun)
        .filter(AgentRun.user_id == user.id, AgentRun.agent_type == "voice-agent")
        .order_by(AgentRun.created_at.desc())
        .limit(20)
        .all()
    )

    calls = []
    for run in runs:
        inp = run.input or {}
        name = inp.get("prospect_name", "Unknown")
        initials = "".join(w[0].upper() for w in name.split()[:2] if w) or "?"
        company = inp.get("prospect_company", "")
        objective = inp.get("call_objective", "")
        dur_ms = run.duration_ms or 0
        mins = dur_ms // 60000
        secs = (dur_ms % 60000) // 1000

        # Derive the user-facing label.  "success" alone just means Retell
        # accepted the call; we only show "Booked" if the Retell webhook
        # came back with an extracted `next_steps` mentioning a meeting.
        label = "No answer"
        if run.status == "running":
            label = "In progress"
        elif run.status == "error":
            label = "Failed"
        elif run.status == "no_answer":
            label = "No answer"
        elif run.status == "success":
            booked = False
            leads = run.leads or []
            if leads and isinstance(leads[0], dict):
                extracted = (leads[0].get("extracted") or {})
                next_steps = (extracted.get("next_steps") or "").lower()
                if next_steps and any(
                    kw in next_steps for kw in ["book", "schedule", "demo", "meeting", "follow up"]
                ):
                    booked = True
            if booked:
                label = "Booked"
            elif dur_ms > 0:
                label = "Completed"
            else:
                # Call dispatched but no webhook data yet — likely Retell
                # still mid-call OR webhook URL is misconfigured.
                label = "Call made"

        calls.append(RecentCall(
            id=str(run.id),
            initials=initials,
            name=name,
            company=company,
            signal_type=objective,
            status=label,
            duration=f"{mins}:{secs:02d}",
            timestamp=run.created_at.isoformat() if run.created_at else None,
        ))

    return calls


@router.post("/trigger-call")
async def trigger_voice_call(
    req: TriggerCallRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger an outbound voice call.

    Uses Retell AI when RETELL_API_KEY is configured. Falls back to the
    agentic infra VoiceOutreachAgent flow otherwise.

    Every attempt is persisted in `agent_runs` BEFORE the upstream call
    (same crash-resilience pattern as Social Agent).
    """
    # 0. Normalize phone to E.164 — Retell rejects anything else with a 400.
    req.prospect_phone = _normalize_phone_e164(req.prospect_phone)

    # 0. Check credits (5 credits per voice call)
    VOICE_CALL_COST = 5
    if not check_sufficient_credits(db, user.id, VOICE_CALL_COST):
        raise HTTPException(status_code=402, detail="Insufficient credits for voice call")

    # 1. Persist the run row up-front.
    run = AgentRun(
        user_id=user.id,
        agent_type="voice-agent",
        flow_id="retell" if settings.RETELL_API_KEY else "agentic-infra",
        input=req.model_dump(),
        status="running",
        cost_credits=VOICE_CALL_COST,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # 2. Load user's call script + voice config from Redis
    call_script = None
    voice_config = None
    try:
        redis = RedisManager.get_client()
        cfg_raw = await redis.get(_config_key(str(user.id)))
        if cfg_raw:
            cfg = json.loads(cfg_raw)
            voice_config = cfg  # pass full config so Retell gets voice_persona etc.
            script = cfg.get("call_script", {})
            # Replace template variables with actual prospect data
            replacements = {
                "{{first_name}}": req.prospect_name.split()[0] if req.prospect_name else "",
                "{{company_name}}": req.prospect_company,
                "{{signal_event}}": req.call_objective,
                "{{icp_pain}}": req.context,
            }
            opening = script.get("opening", "")
            objection = script.get("objection_handling", "")
            closing = script.get("closing", "")
            for key, val in replacements.items():
                opening = opening.replace(key, val)
                objection = objection.replace(key, val)
                closing = closing.replace(key, val)
            call_script = {
                "opening": opening,
                "objection_handling": objection,
                "closing": closing,
            }
    except Exception:
        pass

    # Load the user's company profile — this is how Retell knows what we sell,
    # what our pitch is, and how to handle objections.  Lazily created on
    # first read so the call never fails on a missing row.
    from app.api.routes.company_profile import get_or_create_profile as _get_profile
    profile_row = _get_profile(db, user.id)
    company_profile = {
        "company_name": profile_row.company_name,
        "website_url": profile_row.website_url,
        "one_liner": profile_row.one_liner,
        "product_description": profile_row.product_description,
        "pricing_summary": profile_row.pricing_summary,
        "icp_description": profile_row.icp_description,
        "objection_handling": profile_row.objection_handling,
        "key_differentiators": profile_row.key_differentiators,
        "additional_context": profile_row.additional_context,
        "agent_persona_name": profile_row.agent_persona_name,
        "agent_persona_role": profile_row.agent_persona_role,
        "calendar_booking_url": profile_row.calendar_booking_url,
    }

    result: Dict[str, Any] = {}
    error_message: Optional[str] = None

    try:
        if settings.RETELL_API_KEY:
            # run_id lets the Retell webhook do an O(1) PK match when the
            # call ends, instead of substring-scanning recent output_text.
            result = await _call_via_retell(
                req, call_script, voice_config, company_profile, run_id=str(run.id)
            )
        else:
            result = await _call_via_agentic_infra(req, call_script)
    except HTTPException:
        raise
    except Exception as exc:
        error_message = str(exc)

    if error_message:
        # Dispatch itself failed — Retell never accepted the call, so the
        # webhook will never fire to correct this row.  Terminal on our side.
        run.status = "error"
        run.error_message = error_message
        run.finished_at = datetime.now(timezone.utc)
        db.add(run)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=error_message)

    # Dispatch succeeded — the call is now live.  Keep status="running" and
    # leave duration_ms / finished_at unset; the Retell webhook will stamp
    # the real values when the call actually ends.  (Previously this block
    # set status="success" and duration=HTTP-request-time which is how the
    # UI ended up showing "success / 0:01" on calls that hadn't finished.)
    run.output_text = json.dumps(result)
    run.leads = [{"call_id": result.get("call_id"), "prospect": req.prospect_name}]
    db.add(run)
    db.commit()

    # 4. Deduct credits on success (using existing utility — row lock + CreditTransaction)
    deduct_credits(
        db=db,
        user_id=user.id,
        amount=VOICE_CALL_COST,
        reference_id=run.id,
        description=f"Voice call to {req.prospect_name} ({req.call_objective})",
    )

    # 4. Append to recent calls in Redis.
    initials = "".join(w[0].upper() for w in req.prospect_name.split()[:2] if w)
    new_call = {
        "id": result.get("call_id", str(run.id)),
        "initials": initials,
        "name": req.prospect_name,
        "company": req.prospect_company,
        "signal_type": req.call_objective,
        "status": "Booked" if result.get("call_status") == "registered" else "Call back",
        "duration": "0:00",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        redis = RedisManager.get_client()
        raw = await redis.get(_calls_key(str(user.id)))
        existing = json.loads(raw) if raw else list(DEFAULT_RECENT_CALLS)
        existing.insert(0, new_call)
        await redis.set(_calls_key(str(user.id)), json.dumps(existing[:20]), ex=60 * 60 * 24 * 30)
    except Exception:
        pass  # non-critical — call already succeeded

    # 6. Execute CRM + follow-up actions based on user config
    try:
        redis = RedisManager.get_client()
        cfg_raw = await redis.get(_config_key(str(user.id)))
        if cfg_raw:
            crm = json.loads(cfg_raw).get("crm_settings", {})
            await _run_crm_followup(user, req, result, crm, db)
    except Exception as crm_exc:
        logger.warning(f"CRM follow-up failed (non-blocking): {crm_exc}")

    return {
        "run_id": str(run.id),
        "call_id": result.get("call_id"),
        "call_status": result.get("call_status", "initiated"),
        "agent_id": result.get("agent_id"),
        "prospect": req.prospect_name,
    }


async def _run_crm_followup(
    user: User, req: TriggerCallRequest, call_result: Dict, crm: Dict, db: Session
):
    """Execute CRM + follow-up actions based on user's voice agent config."""
    # 1. Auto-create HubSpot contact
    if crm.get("auto_create_hubspot"):
        try:
            from app.services.hubspot_service import HubSpotService
            hs = HubSpotService(db, user)
            await hs.create_or_update_contact(
                email=None,
                properties={
                    "firstname": req.prospect_name.split()[0] if req.prospect_name else "",
                    "lastname": " ".join(req.prospect_name.split()[1:]) if req.prospect_name else "",
                    "company": req.prospect_company,
                    "jobtitle": req.prospect_role,
                    "phone": req.prospect_phone,
                    "outmate_call_id": call_result.get("call_id", ""),
                    "outmate_call_objective": req.call_objective,
                },
            )
            logger.info(f"HubSpot contact created for {req.prospect_name}")
        except Exception as e:
            logger.debug(f"HubSpot contact creation skipped: {e}")

    # 2. Log call transcript to CRM
    if crm.get("log_transcript") and call_result.get("call_id"):
        try:
            from app.services.hubspot_service import HubSpotService
            hs = HubSpotService(db, user)
            await hs.log_activity(
                contact_identifier=req.prospect_phone,
                activity_type="CALL",
                body=f"Voice AI call — Objective: {req.call_objective}. Context: {req.context}",
                metadata={"call_id": call_result.get("call_id")},
            )
            logger.info(f"Call logged to HubSpot for {req.prospect_name}")
        except Exception as e:
            logger.debug(f"HubSpot call log skipped: {e}")

    # 3. Send follow-up email after voicemail
    if crm.get("send_followup_email") and call_result.get("call_status") == "voicemail":
        try:
            from app.services.email import send_email
            await send_email(
                to=None,  # would need prospect email
                subject=f"Following up on our call attempt — {req.prospect_company}",
                body=f"Hi {req.prospect_name.split()[0] if req.prospect_name else 'there'},\n\nI tried reaching you today regarding {req.call_objective}. Would love to find a time to connect.\n\nBest,\nOutmate",
            )
        except Exception as e:
            logger.debug(f"Follow-up email skipped: {e}")

    # 4. Slack alert for booked contacts
    if crm.get("slack_booked_alert") and call_result.get("call_status") == "registered":
        try:
            from app.db.models.copilot_preferences import CopilotUserPreferences
            from app.services.copilot.notification_service import NotificationService

            prefs = (
                db.query(CopilotUserPreferences)
                .filter(CopilotUserPreferences.user_id == user.id)
                .first()
            )
            if not prefs or not prefs.notify_slack or not prefs.slack_webhook_url:
                logger.info("Slack booked-call alert skipped: Slack is not connected for user %s", user.id)
                return

            notifier = NotificationService()
            notifier.send_slack_blocks(
                webhook_url=prefs.slack_webhook_url,
                text=f"Voice Agent booked a meeting with {req.prospect_name}",
                blocks=[
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": (
                                f"*Voice Agent booked a meeting*\n"
                                f"*Prospect:* {req.prospect_name}\n"
                                f"*Company:* {req.prospect_company or 'Unknown'}\n"
                                f"*Objective:* {req.call_objective}"
                            ),
                        },
                    }
                ],
            )
            logger.info("Slack booked-call alert sent for %s", req.prospect_name)
        except Exception as e:
            logger.debug(f"Slack alert skipped: {e}")


def _normalize_phone_e164(raw: str) -> str:
    """Normalize a user-entered phone to E.164 — what Retell (+ most SIP
    providers) require.  Handles the common cases:
      "+14155551234"        → "+14155551234"      (already E.164)
      "14155551234"         → "+14155551234"      (US, leading country code)
      "(415) 555-1234"      → "+14155551234"      (US, with formatting)
      "7428430119"          → "+917428430119"     (10-digit, assume India)
      "917428430119"        → "+917428430119"     (India, leading 91)
      "+91 7428 430 119"    → "+917428430119"     (spaces OK)
    Falls back to prepending "+" to whatever digits remain so Retell at
    least sees a syntactically valid string and returns its own clearer
    error for exotic cases.
    """
    if not raw:
        return raw
    s = raw.strip()
    has_plus = s.startswith("+")
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return raw  # let Retell reject it with its own message

    if has_plus:
        return "+" + digits

    # 10 digits → assume India (based on Retell From number +1 (219) 946-5998
    # being US, but user base is Delhi-based per current data).  This is a
    # sane default — for other countries, users just type the full + format.
    if len(digits) == 10:
        return "+91" + digits
    # 11 digits starting with "1" → US/Canada
    if len(digits) == 11 and digits.startswith("1"):
        return "+" + digits
    # 12 digits starting with "91" → India without +
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    # Anything else: prepend + and let Retell validate
    return "+" + digits


async def _call_via_retell(
    req: TriggerCallRequest,
    call_script: Optional[Dict] = None,
    voice_config: Optional[Dict] = None,
    company_profile: Optional[Dict] = None,
    run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create an outbound phone call via the Retell AI API.

    Sends ``retell_llm_dynamic_variables`` for the Retell Conversation Flow
    Agent's prompt template.  Variables split into three groups:

    About the user's own company (from UserCompanyProfile — filled in
    Settings → Company Profile so agents aren't hardcoded to "Outmate"):
      agent_name, agent_role, my_company_name, product_pitch,
      product_description, pricing_summary, icp_description,
      objection_handling, key_differentiators, booking_link,
      additional_context

    About the prospect (from TriggerCallRequest):
      lead_name, lead_company, lead_role, lead_city, lead_industry

    About this specific call:
      lead_context, call_objective
    """
    if not settings.RETELL_AGENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RETELL_AGENT_ID not configured",
        )

    # Agent persona precedence:
    #   1) company_profile.agent_persona_name/role  (set once in Settings)
    #   2) voice_config.voice_persona                (per-call override picker)
    #   3) "Alex" / "GTM Specialist" defaults
    profile = company_profile or {}
    persona_from_profile = (profile.get("agent_persona_name") or "").strip()
    if persona_from_profile:
        agent_display_name = persona_from_profile
    else:
        persona = (voice_config or {}).get("voice_persona", "Alex (Neutral EN-US)")
        agent_display_name = persona.split("(")[0].strip() if persona else "Alex"

    agent_role = (profile.get("agent_persona_role") or "").strip() or "GTM Specialist"
    my_company_name = (profile.get("company_name") or "").strip() or "our company"

    dynamic_vars: Dict[str, Any] = {
        # Tenant identity — embedded so Retell's custom-tool request body
        # templates can reference {{run_id}} to tell /knowledge-search which
        # user's profile to serve.  Retell ONLY templates variables that live
        # under retell_llm_dynamic_variables; the `metadata` field (below) is
        # echoed on webhooks but NOT exposed to the in-call prompt/tool layer.
        "run_id": str(run_id) if run_id else "",
        # About the user's own company (for "who am I selling for?")
        "agent_name": agent_display_name,
        "agent_role": agent_role,
        "company_name": my_company_name,       # back-compat name; some old Retell prompts still reference this
        "my_company_name": my_company_name,    # new canonical name
        "product_pitch": profile.get("one_liner", ""),
        "product_description": profile.get("product_description", ""),
        "pricing_summary": profile.get("pricing_summary", ""),
        "icp_description": profile.get("icp_description", ""),
        "objection_handling": profile.get("objection_handling", ""),
        "key_differentiators": profile.get("key_differentiators", ""),
        "booking_link": profile.get("calendar_booking_url", ""),
        "additional_context": profile.get("additional_context", ""),
        # About the prospect
        "lead_name": req.prospect_name,
        "lead_company": req.prospect_company,
        "lead_role": req.prospect_role,
        "lead_city": req.prospect_city or "",
        "lead_industry": req.prospect_industry or "",
        # Call context
        "lead_context": req.context or "",
        "call_objective": req.call_objective or "discovery",
    }

    # Also pass the user's custom call script as additional context
    if call_script:
        dynamic_vars["lead_context"] = (
            (req.context or "")
            + "\n\n--- CALL SCRIPT GUIDANCE ---\n"
            + f"OPENING: {call_script.get('opening', '')}\n\n"
            + f"OBJECTION HANDLING: {call_script.get('objection_handling', '')}\n\n"
            + f"CLOSING: {call_script.get('closing', '')}"
        ).strip()

    # Metadata is echoed verbatim in every webhook + custom-tool payload, so
    # put the AgentRun.id here to make webhook matching an O(1) PK lookup
    # instead of a substring scan over recent runs.
    call_metadata: Dict[str, Any] = {
        "prospect_name": req.prospect_name,
        "company": req.prospect_company,
        "objective": req.call_objective,
    }
    if run_id:
        call_metadata["run_id"] = str(run_id)

    payload: Dict[str, Any] = {
        "agent_id": settings.RETELL_AGENT_ID,
        "to_number": req.prospect_phone,
        "retell_llm_dynamic_variables": dynamic_vars,
        "metadata": call_metadata,
    }
    if settings.RETELL_FROM_NUMBER:
        payload["from_number"] = settings.RETELL_FROM_NUMBER

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RETELL_API_BASE}/create-phone-call",
                headers={
                    "Authorization": f"Bearer {settings.RETELL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code >= 400:
                body = resp.text
                logger.error("Retell API error %d: %s", resp.status_code, body[:500])
                raise HTTPException(status_code=resp.status_code, detail=f"Retell error: {body[:200]}")
            return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot reach Retell AI API")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Retell AI API timed out")


async def _call_via_agentic_infra(req: TriggerCallRequest, call_script: Optional[Dict] = None) -> Dict[str, Any]:
    """Fall back to the agentic infra VoiceOutreachAgent when Retell is not configured."""
    from app.core.agentic_flow_resolver import get_agentic_auth_headers, get_voice_agent_flow

    flow_id, node_id, _ = get_voice_agent_flow()
    if not flow_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice agent not configured — set RETELL_API_KEY or deploy the Voice Agent flow on the agentic infra.",
        )

    headers = get_agentic_auth_headers()
    upstream_url = f"{settings.AGENTIC_INFRA_URL.rstrip('/')}/api/v1/run/{flow_id}?stream=false"

    tweaks = {}
    if node_id:
        tweaks[node_id] = {
            "prospect_data": (
                f"Name: {req.prospect_name}\n"
                f"Phone: {req.prospect_phone}\n"
                f"Company: {req.prospect_company}\n"
                f"Role: {req.prospect_role}\n"
                f"Context: {req.context}"
            ),
            "call_objective": req.call_objective,
        }

    try:
        async with httpx.AsyncClient(timeout=settings.AGENTIC_INFRA_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                upstream_url,
                headers=headers,
                json={
                    "input_value": f"Trigger voice call to {req.prospect_name} at {req.prospect_phone}",
                    "input_type": "chat",
                    "output_type": "chat",
                    "tweaks": tweaks,
                },
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"Agentic infra returned {resp.status_code}: {resp.text[:300]}")
            body = resp.json()
            output = body.get("outputs", [{}])[0].get("outputs", [{}])[0].get("results", {}).get("message", {}).get("text", "")
            return {"call_id": "agentic-" + str(hash(output))[:8], "call_status": "initiated", "output": output}
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Agentic infra not reachable")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Agentic infra timed out")


@router.post("/make-call-direct")
async def make_call_direct(
    req: TriggerCallRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Direct call endpoint — same as trigger-call, provided for backward
    compatibility with the LangChain OutMateVoiceCallComponent tool."""
    return await trigger_voice_call(req, user, db)


@router.post("/pause")
async def pause_agent(user: User = Depends(get_current_user)):
    """Pause/resume the voice agent."""
    redis = RedisManager.get_client()
    raw = await redis.get(_config_key(str(user.id)))
    config = VoiceAgentConfig(**(json.loads(raw) if raw else {"signal_triggers": [t.model_dump() for t in DEFAULT_SIGNAL_TRIGGERS]}))
    config.status = "paused" if config.status == "active" else "active"
    await redis.set(_config_key(str(user.id)), config.model_dump_json(), ex=60 * 60 * 24 * 30)
    return {"status": config.status}


@router.post("/upload-list")
async def upload_contact_list(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Upload a CSV contact list for voice campaigns.

    Expects columns: name, phone, company (optional: role, email).
    Stores parsed contacts in Redis keyed by user for later use.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    try:
        decoded = contents.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = contents.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    contacts: List[Dict[str, str]] = []
    skipped = 0

    for row in reader:
        # Normalize column names (lowercase, strip whitespace)
        norm = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        name = norm.get("name", "") or norm.get("full_name", "") or norm.get("first_name", "")
        phone = norm.get("phone", "") or norm.get("phone_number", "") or norm.get("mobile", "")
        if not name or not phone:
            skipped += 1
            continue
        contacts.append({
            "name": name,
            "phone": phone,
            "company": norm.get("company", "") or norm.get("company_name", ""),
            "role": norm.get("role", "") or norm.get("title", "") or norm.get("job_title", ""),
            "email": norm.get("email", ""),
        })

    if not contacts:
        raise HTTPException(status_code=400, detail="No valid contacts found. Need at least 'name' and 'phone' columns.")

    # Store in Redis for the user
    redis = RedisManager.get_client()
    list_key = f"voice_agent:contact_list:{user.id}"
    await redis.set(list_key, json.dumps(contacts), ex=60 * 60 * 24 * 7)  # 7 day TTL

    return {
        "uploaded": len(contacts),
        "skipped": skipped,
        "filename": file.filename,
        "contacts_preview": contacts[:5],  # Return first 5 as preview
    }


@router.get("/contact-list")
async def get_contact_list(
    user: User = Depends(get_current_user),
):
    """Get the currently uploaded contact list."""
    redis = RedisManager.get_client()
    raw = await redis.get(f"voice_agent:contact_list:{user.id}")
    if not raw:
        return {"contacts": [], "total": 0}
    contacts = json.loads(raw)
    return {"contacts": contacts, "total": len(contacts)}


@router.get("/analytics")
async def get_voice_analytics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detailed voice-agent analytics.

    Backs the "Voice Agent Analytics" modal.  Goal: give a GTM user enough
    signal to answer three questions in one glance:
      (a) Is the dialer actually reaching people? → connect_rate + no_answer
      (b) Are calls productive?                   → booked + avg connected dur
      (c) What's blocking conversion?             → top objections/competitors

    All aggregates are per-user and scoped to agent_type='voice-agent'.
    Returned keys are stable; add-only — never rename existing keys without
    the frontend following in the same PR.
    """
    from collections import Counter
    from datetime import timedelta
    from sqlalchemy import Date, cast, func as sqlfunc

    uid = user.id

    base = db.query(AgentRun).filter(
        AgentRun.user_id == uid,
        AgentRun.agent_type == "voice-agent",
    )

    # ------------------------------------------------------------------
    # Headline counters
    # ------------------------------------------------------------------
    total = base.count()
    n_success = base.filter(AgentRun.status == "success").count()
    n_error = base.filter(AgentRun.status == "error").count()
    n_no_answer = base.filter(AgentRun.status == "no_answer").count()
    n_running = base.filter(AgentRun.status == "running").count()
    # "success" collapses completed + booked; we split it below using the
    # leads JSON so the UI can show "Booked" separately from "Completed".

    total_credits = db.query(sqlfunc.sum(AgentRun.cost_credits)).filter(
        AgentRun.user_id == uid, AgentRun.agent_type == "voice-agent"
    ).scalar() or 0

    # Average duration across *all* rows — legacy key, kept for back-compat.
    avg_ms_all = db.query(sqlfunc.avg(AgentRun.duration_ms)).filter(
        AgentRun.user_id == uid,
        AgentRun.agent_type == "voice-agent",
        AgentRun.duration_ms.isnot(None),
    ).scalar()
    avg_dur_secs = round((avg_ms_all or 0) / 1000, 1)

    # Average duration only across *connected* calls — much more useful for
    # conversation-quality tracking since no_answers drag the overall avg to 0.
    connected_durs = [
        r.duration_ms for r in base.filter(
            AgentRun.status == "success",
            AgentRun.duration_ms.isnot(None),
            AgentRun.duration_ms > 0,
        ).all()
    ]
    avg_connected_secs = round(sum(connected_durs) / len(connected_durs) / 1000, 1) if connected_durs else 0.0
    total_talk_secs = round(sum(connected_durs) / 1000, 1) if connected_durs else 0.0

    # ------------------------------------------------------------------
    # Per-row scan for things that can't be aggregated in SQL:
    #   - disconnection_reason breakdown   (stored inside output_text JSON)
    #   - booked vs completed split         (stored inside leads[0].extracted)
    #   - top pain points / objections / competitors
    # We cap at the most recent 500 runs so a giant tenant doesn't blow
    # the endpoint's latency budget.
    # ------------------------------------------------------------------
    recent = base.order_by(AgentRun.created_at.desc()).limit(500).all()

    disconnect_counter: Counter = Counter()
    pain_counter: Counter = Counter()
    objection_counter: Counter = Counter()
    competitor_counter: Counter = Counter()
    next_step_counter: Counter = Counter()
    booked = 0
    completed = 0
    hour_buckets: List[int] = [0] * 24

    booking_keywords = ("book", "schedule", "demo", "meeting", "follow up", "follow-up", "call back")

    for r in recent:
        # Hour-of-day histogram (UTC — the UI labels it as such)
        if r.created_at:
            hour_buckets[r.created_at.hour] += 1

        # Parse the webhook-written JSON; skip silently on malformed rows
        try:
            payload = json.loads(r.output_text) if r.output_text else {}
        except (TypeError, ValueError):
            payload = {}

        dr = (payload.get("disconnection_reason") or "").strip().lower()
        if dr:
            disconnect_counter[dr] += 1

        ev = payload.get("extracted_variables") or {}
        for field, counter in (
            ("pain_points", pain_counter),
            ("objections", objection_counter),
            ("competitor_mentioned", competitor_counter),
            ("next_steps", next_step_counter),
        ):
            v = (ev.get(field) or "").strip()
            if v:
                counter[v[:120]] += 1  # truncate long free-text so the top-N is stable

        # Booked vs completed split — only meaningful for already-successful
        # rows; mirrors the derivation in get_recent_calls to stay consistent.
        if r.status == "success":
            leads = r.leads or []
            next_steps_txt = ""
            if leads and isinstance(leads[0], dict):
                next_steps_txt = ((leads[0].get("extracted") or {}).get("next_steps") or "").lower()
            if next_steps_txt and any(k in next_steps_txt for k in booking_keywords):
                booked += 1
            else:
                completed += 1

    # ------------------------------------------------------------------
    # Calls-per-day (last 7 days) — kept from v1 because the chart uses it.
    # ------------------------------------------------------------------
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily_rows = (
        db.query(
            cast(AgentRun.created_at, Date).label("day"),
            sqlfunc.count(AgentRun.id).label("count"),
        )
        .filter(
            AgentRun.user_id == uid,
            AgentRun.agent_type == "voice-agent",
            AgentRun.created_at >= seven_days_ago,
        )
        .group_by(cast(AgentRun.created_at, Date))
        .order_by(cast(AgentRun.created_at, Date))
        .all()
    )
    daily = [{"date": str(r.day), "calls": r.count} for r in daily_rows]

    # ------------------------------------------------------------------
    # Top companies called — same as v1, based on prospect_company input.
    # ------------------------------------------------------------------
    company_counts: Dict[str, int] = {}
    for r in recent:
        co = ((r.input or {}).get("prospect_company") or "").strip()
        if co:
            company_counts[co] = company_counts.get(co, 0) + 1
    top_companies = [
        {"company": co, "calls": cnt}
        for co, cnt in sorted(company_counts.items(), key=lambda x: -x[1])[:10]
    ]

    # ------------------------------------------------------------------
    # Derived rates.  Guard against div-by-zero on brand-new tenants.
    # ------------------------------------------------------------------
    denom = total or 1
    connect_rate = round((n_success / denom) * 100, 1) if total else 0.0
    booking_rate = round((booked / denom) * 100, 1) if total else 0.0
    no_answer_rate = round((n_no_answer / denom) * 100, 1) if total else 0.0

    def _top(counter: Counter, n: int) -> List[Dict[str, Any]]:
        return [{"label": label, "count": count} for label, count in counter.most_common(n)]

    return {
        # Back-compat keys (old UI still reads these)
        "total_calls": total,
        "successful": n_success,
        "failed": n_error,
        "booking_rate": booking_rate,
        "total_credits_spent": total_credits,
        "avg_duration_seconds": avg_dur_secs,
        "daily_calls": daily,
        "top_companies": top_companies,

        # Richer breakdown — new UI surfaces these.
        "outcomes": {
            "booked": booked,
            "completed": completed,
            "no_answer": n_no_answer,
            "failed": n_error,
            "in_progress": n_running,
        },
        "connect_rate": connect_rate,          # % of dials that became conversations
        "no_answer_rate": no_answer_rate,      # % declined/unanswered by the other side
        "avg_connected_duration_seconds": avg_connected_secs,
        "total_talk_time_seconds": total_talk_secs,
        "disconnection_breakdown": [
            {"reason": reason, "count": cnt}
            for reason, cnt in disconnect_counter.most_common(8)
        ],
        "top_pain_points": _top(pain_counter, 5),
        "top_objections": _top(objection_counter, 5),
        "top_competitors": _top(competitor_counter, 5),
        "top_next_steps": _top(next_step_counter, 5),
        "hour_of_day_utc": hour_buckets,       # 24 ints — UTC, UI can convert
    }


@router.post("/ai-rewrite")
async def ai_rewrite_script(
    req: ScriptRewriteRequest,
    user: User = Depends(get_current_user),
):
    """AI-rewrite a call script section using OpenRouter."""
    from app.services.openrouter_service import OpenRouterService

    prompt = (
        f"Rewrite this {req.section.replace('_', ' ')} script for an outbound sales call. "
        f"Keep it {req.tone}, concise, and natural-sounding. "
        f"Preserve any template variables like {{{{first_name}}}}, {{{{company_name}}}}, {{{{signal_event}}}}, {{{{icp_pain}}}}.\n\n"
        f"Current script:\n{req.current_text}\n\n"
        f"Rewritten script:"
    )

    try:
        service = OpenRouterService(user_id=str(user.id))
        result = await service.chat_completion(prompt)
        return {"rewritten": result.strip()}
    except Exception as e:
        logger.error(f"AI rewrite failed: {e}")
        raise HTTPException(status_code=500, detail="AI rewrite failed")


# ---------------------------------------------------------------------------
# Retell Webhook has moved to app/api/routes/retell_public.py where it lives
# at the top-level /retell-webhook path (no /api/v1/voice-agent prefix).
# This keeps the URL Retell needs to POST to stable and easy to register on
# their dashboard, and removes the need for auth on a callback Retell has no
# way to sign.
# ---------------------------------------------------------------------------


def _derived_call_label(run: AgentRun) -> str:
    """Translate the raw DB status into what the UI should actually show.

    Why this function exists:
      - run.status="running" right after dispatch means "call is live",
        not "we are processing something" — UI should say "In progress".
      - run.status="success" can mean either "call completed + meeting
        booked" or "call completed, no booking".  Only the first deserves
        a green "Booked" badge; the second should read "Completed".
      - A stale "running" beyond 5 minutes is the Retell webhook never
        firing — we flag that explicitly so the user knows to check their
        webhook configuration instead of assuming the call is ongoing.
    """
    if run.status == "error":
        return "Failed"
    if run.status == "no_answer":
        # "No answer" covers: dial_no_answer, user_declined, dial_busy,
        # machine_detected, voicemail_reached, session_status=not_connected.
        # Retell's exact sub-reason is in run.error_message for the tooltip.
        return "No answer"
    if run.status == "running":
        # Mirror the 5-minute staleness rule from get_recent_calls().
        if run.created_at:
            age = datetime.now(timezone.utc) - run.created_at
            if age.total_seconds() > 5 * 60:
                return "Timed out (no webhook)"
        return "In progress"
    if run.status == "success":
        leads = run.leads or []
        if leads and isinstance(leads[0], dict):
            extracted = (leads[0].get("extracted") or {})
            next_steps = (extracted.get("next_steps") or "").lower()
            if next_steps and any(
                kw in next_steps for kw in ("book", "schedule", "demo", "meeting", "follow up", "follow-up")
            ):
                return "Booked"
        return "Completed"
    return run.status or "Unknown"


@router.get("/call-details/{run_id}")
async def get_call_details(
    run_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full details of a specific call — transcript + extracted variables."""
    run = (
        db.query(AgentRun)
        .filter(AgentRun.id == run_id, AgentRun.user_id == user.id, AgentRun.agent_type == "voice-agent")
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Call not found")

    result_data = json.loads(run.output_text) if run.output_text else {}
    inp = run.input or {}

    dur_ms = run.duration_ms or 0
    mins = dur_ms // 60000
    secs = (dur_ms % 60000) // 1000

    # Raw status is preserved on `raw_status` for debugging; the UI should
    # read `status` (the derived human label) so it stops surfacing "success"
    # for calls that are still mid-dial or that completed without booking.
    return {
        "id": str(run.id),
        "status": _derived_call_label(run),
        "raw_status": run.status,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "duration": f"{mins}:{secs:02d}",
        "duration_ms": dur_ms,
        "prospect": {
            "name": inp.get("prospect_name", ""),
            "phone": inp.get("prospect_phone", ""),
            "company": inp.get("prospect_company", ""),
            "role": inp.get("prospect_role", ""),
            "city": inp.get("prospect_city", ""),
            "industry": inp.get("prospect_industry", ""),
        },
        "call_objective": inp.get("call_objective", ""),
        "context": inp.get("context", ""),
        "transcript": result_data.get("transcript", ""),
        "extracted_variables": result_data.get("extracted_variables", {}),
        "call_analysis": result_data.get("call_analysis", {}),
        "disconnection_reason": result_data.get("disconnection_reason", ""),
        "error_message": run.error_message or "",
        "credits_used": run.cost_credits or 0,
    }
