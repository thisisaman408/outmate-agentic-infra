"""
Per-destination delivery for visitor alerts.

`_enqueue_webhooks` in app/tasks/visitors.py is the orchestrator. This module
holds the delivery code for each non-Slack/non-email destination so that file
doesn't keep growing:

  • _deliver_hubspot       — push the visitor as a HubSpot contact (uses HubSpotService)
  • _deliver_instantly     — add the visitor as a lead in an Instantly campaign
  • _deliver_make_n8n      — POST a generic JSON payload to a Make/n8n webhook
  • build_intent_signals   — assemble the human-readable signals row for Slack
  • fetch_tavily_context   — best-effort Tavily lookup for "why now" context

All delivery functions are best-effort: they log on failure and never raise.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.db.models.visitor import Alert, Visit, VisitorSession

logger = logging.getLogger(__name__)


# ── Helpers shared across destinations ──────────────────────────────────────

def _extract_contact(visit: Visit) -> dict[str, Any]:
    """Flatten the most useful fields from visit.resolution into a dict."""
    res = visit.resolution or {}
    person = res.get("person") or {}
    exp = res.get("explorium") or {}
    geo = res.get("geo") or {}

    full_name = (
        res.get("full_name")
        or person.get("full_name")
        or person.get("name")
        or " ".join(x for x in [res.get("first_name"), res.get("last_name")] if x).strip()
    )
    first, _, last = (full_name or "").partition(" ")

    return {
        "full_name": full_name,
        "first_name": res.get("first_name") or person.get("first_name") or first,
        "last_name": res.get("last_name") or person.get("last_name") or last,
        "email": res.get("email") or person.get("email") or "",
        "phone": res.get("phone") or person.get("phone") or "",
        "title": res.get("job_title") or res.get("title") or person.get("job_title") or "",
        "linkedin": res.get("linkedin_url") or person.get("linkedin_url") or "",
        "company": exp.get("company_name") or res.get("company_name") or res.get("company") or "",
        "domain": res.get("domain") or exp.get("domain") or "",
        "website": exp.get("website") or res.get("website") or "",
        "industry": exp.get("industry") or res.get("industry") or "",
        "city": geo.get("city") or "",
        "country": geo.get("country") or "",
    }


# ── Intent signals (used by Slack payload builder) ──────────────────────────

_PAGE_KEYWORDS = [
    ("pricing", "💲 Pricing"),
    ("demo", "🎯 Demo"),
    ("trial", "✨ Trial"),
    ("signup", "📝 Signup"),
    ("sign-up", "📝 Signup"),
    ("contact", "📞 Contact"),
    ("docs", "📚 Docs"),
    ("documentation", "📚 Docs"),
    ("blog", "📰 Blog"),
    ("case-stud", "🏆 Case study"),
    ("integrations", "🔌 Integrations"),
    ("compare", "⚖️ Comparison"),
]


def _format_dwell(ms: int | None) -> Optional[str]:
    if not ms or ms <= 0:
        return None
    sec = ms // 1000
    if sec < 60:
        return f"⏱ {sec}s"
    return f"⏱ {sec // 60}m {sec % 60:02d}s"


def build_intent_signals(visit: Visit, db) -> list[str]:
    """Collect short, human-readable intent signals for the Slack message."""
    signals: list[str] = []
    res = visit.resolution or {}
    behavioral = res.get("behavioral") or {}

    # Top-page keyword
    url = (visit.url or "").lower()
    for needle, label in _PAGE_KEYWORDS:
        if needle in url:
            signals.append(f"📍 {label.split(' ', 1)[1]}")
            break

    # Pull session-level metrics if a VisitorSession exists for this visitor
    session: VisitorSession | None = None
    visitor_id = res.get("visitor_id") or behavioral.get("visitor_id")
    if visitor_id:
        try:
            session = (
                db.query(VisitorSession)
                .filter(
                    VisitorSession.org_id == visit.org_id,
                    VisitorSession.visitor_id == visitor_id,
                )
                .order_by(VisitorSession.session_start.desc())
                .first()
            )
        except Exception as e:
            logger.warning("VisitorSession lookup failed: %s", e)

    # Dwell time (resolution overrides session)
    dwell_ms = behavioral.get("dwell_ms") or (session.total_dwell_ms if session else None)
    dwell_str = _format_dwell(dwell_ms)
    if dwell_str:
        signals.append(dwell_str)

    # Scroll depth
    scroll = behavioral.get("scroll_depth")
    if scroll is None and session and session.avg_scroll_depth:
        scroll = session.avg_scroll_depth
    if scroll:
        try:
            pct = int(round(float(scroll) * 100)) if float(scroll) <= 1 else int(scroll)
            signals.append(f"📜 {pct}% scroll")
        except Exception:
            pass

    # Page count this session
    if session and session.page_count and session.page_count > 1:
        signals.append(f"📄 {session.page_count} pages")

    # Return-visitor flag — count past sessions for this visitor_id
    if visitor_id:
        try:
            past = (
                db.query(VisitorSession)
                .filter(
                    VisitorSession.org_id == visit.org_id,
                    VisitorSession.visitor_id == visitor_id,
                )
                .count()
            )
            if past > 1:
                signals.append("🔁 Return visitor")
        except Exception:
            pass

    return signals


# ── Tavily "why now" context ────────────────────────────────────────────────

async def fetch_tavily_context(visit: Visit) -> Optional[dict]:
    """
    Best-effort Tavily lookup for the visitor's company. Returns
    {title, url} of the top result, or None. Cached on visit.resolution["tavily"].
    """
    res = visit.resolution or {}
    if res.get("tavily"):
        return res["tavily"]

    company = (
        (res.get("explorium") or {}).get("company_name")
        or res.get("company_name")
        or res.get("company")
    )
    if not company:
        return None

    try:
        from app.services.copilot.enrichment import _tavily_search
    except Exception as e:
        logger.warning("Tavily helper not available: %s", e)
        return None

    try:
        results = await _tavily_search(
            f"{company} recent news funding hiring", max_results=3
        )
    except Exception as e:
        logger.warning("Tavily search failed for %s: %s", company, e)
        return None

    if not results:
        return None
    top = results[0]
    return {"title": top.get("title", "")[:140], "url": top.get("url", "")}


# ── HubSpot delivery ────────────────────────────────────────────────────────

async def deliver_hubspot(db, user_id, visit: Visit) -> str:
    """
    Push the visitor as a HubSpot contact via the existing HubSpotService.
    Returns "success" / "skipped" / "error".
    """
    contact = _extract_contact(visit)
    if not contact["email"]:
        return "skipped"

    try:
        from app.services.hubspot_service import HubSpotService
    except Exception as e:
        logger.error("HubSpot service unavailable: %s", e)
        return "error"

    intent_score = visit.intent_score or 0
    try:
        intent_pct = int(round(float(intent_score) * 100)) if float(intent_score) <= 1 else int(intent_score)
    except Exception:
        intent_pct = 0

    properties: dict[str, str] = {
        "email": contact["email"],
        "firstname": contact["first_name"] or "",
        "lastname": contact["last_name"] or "",
        "jobtitle": contact["title"] or "",
        "company": contact["company"] or "",
        "website": contact["website"] or contact["domain"] or "",
        "phone": contact["phone"] or "",
        "city": contact["city"] or "",
        "country": contact["country"] or "",
        "hs_lead_status": "NEW",
        "outmate_intent_score": str(intent_pct),
        "outmate_visit_url": visit.url or "",
    }
    properties = {k: v for k, v in properties.items() if v}

    try:
        svc = HubSpotService(db)
        await svc.create_contact(user_id, properties)
        return "success"
    except Exception as e:
        msg = str(e)
        if "Contact already exists" in msg or "already exists" in msg.lower() or "409" in msg:
            return "success"  # treat dedup as success — contact is in HubSpot
        logger.error("HubSpot delivery failed for %s: %s", contact["email"], e)
        return "error"


# ── Instantly delivery ──────────────────────────────────────────────────────

INSTANTLY_API_URL = "https://api.instantly.ai/api/v1/lead/add"


async def deliver_instantly(db, user_id, visit: Visit, campaign_id: str) -> str:
    """Add the visitor as a lead to an Instantly campaign."""
    contact = _extract_contact(visit)
    if not contact["email"] or not campaign_id:
        return "skipped"

    try:
        from app.db.models.integration import Integration, UserIntegration
        from app.services.integration_engine.credential_vault import decrypt_credentials
    except Exception as e:
        logger.error("Instantly imports unavailable: %s", e)
        return "error"

    try:
        integration = (
            db.query(Integration).filter(Integration.slug == "instantly").first()
        )
        if not integration:
            return "skipped"
        ui = (
            db.query(UserIntegration)
            .filter(
                UserIntegration.user_id == user_id,
                UserIntegration.integration_id == integration.id,
            )
            .first()
        )
        if not ui or not ui.credentials_encrypted:
            return "skipped"

        creds: dict = {}
        try:
            creds = decrypt_credentials(ui.credentials_encrypted) or {}
        except Exception:
            try:
                creds = json.loads(ui.credentials_encrypted)
            except Exception:
                creds = {}

        api_key = creds.get("api_key") or creds.get("instantly_api_key")
        if not api_key:
            logger.warning("Instantly API key missing for user %s", user_id)
            return "error"

        body = {
            "api_key": api_key,
            "campaign_id": campaign_id,
            "email": contact["email"],
            "first_name": contact["first_name"] or "",
            "last_name": contact["last_name"] or "",
            "company_name": contact["company"] or "",
            "personalization": "",
            "custom_variables": {
                "title": contact["title"],
                "linkedin": contact["linkedin"],
                "domain": contact["domain"],
                "industry": contact["industry"],
                "visit_url": visit.url or "",
                "intent_score": str(visit.intent_score or 0),
            },
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(INSTANTLY_API_URL, json=body)
        if resp.status_code < 300:
            return "success"
        logger.warning(
            "Instantly returned %d for %s: %s",
            resp.status_code,
            contact["email"],
            resp.text[:200],
        )
        return "failed"
    except Exception as e:
        logger.error("Instantly delivery failed: %s", e)
        return "error"


# ── Make / n8n generic webhook ──────────────────────────────────────────────

def classify_webhook(url: str) -> str:
    """Tag a webhook URL by destination platform."""
    u = (url or "").lower()
    if "hooks.slack.com" in u:
        return "slack"
    if "hook." in u and "make.com" in u:
        return "make"
    if "integromat.com" in u:
        return "make"
    if ".n8n.cloud" in u or "/webhook/" in u and "n8n" in u:
        return "n8n"
    if "n8n" in u:
        return "n8n"
    return "general"


def build_make_n8n_payload(visit: Visit, kind: str) -> dict:
    """Compact, automation-friendly JSON for Make and n8n scenarios."""
    contact = _extract_contact(visit)
    intent_score = visit.intent_score or 0
    try:
        intent_val = float(intent_score)
        intent_pct = int(round(intent_val * 100)) if intent_val <= 1 else int(intent_val)
    except Exception:
        intent_pct = 0
    if intent_pct >= 70:
        intent_label = "hot"
    elif intent_pct >= 40:
        intent_label = "warm"
    else:
        intent_label = "cold"

    return {
        "event": "visitor_identified",
        "destination": kind,
        "kind": kind,
        "visit_id": str(visit.id),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "contact": contact,
        "intent": {
            "score": intent_pct,
            "label": intent_label,
        },
        "page": {
            "url": visit.url,
            "referrer": getattr(visit, "referrer", None),
            "ip": str(visit.ip),
        },
        "resolution": visit.resolution or {},
    }


async def deliver_generic_webhook(
    webhook_url: str,
    payload: dict,
    webhook_secret: str = "",
    sign: bool = True,
) -> str:
    """POST generic JSON to a webhook URL, optionally HMAC-signed."""
    try:
        body_bytes = json.dumps(payload, separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json"}
        if sign and webhook_secret:
            sig = hmac.new(
                webhook_secret.encode(), body_bytes, hashlib.sha256
            ).hexdigest()
            headers["X-Outmate-Signature"] = f"sha256={sig}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, content=body_bytes, headers=headers)
        if resp.status_code < 300:
            return "success"
        logger.warning(
            "Webhook %s returned %d: %s", webhook_url, resp.status_code, resp.text[:200]
        )
        return "failed"
    except Exception as e:
        logger.error("Webhook delivery failed (%s): %s", webhook_url, e)
        return "error"


def write_alert(db, visit: Visit, webhook_type: str, status: str, payload: dict) -> None:
    """Persist a delivery attempt as an Alert row."""
    import uuid

    try:
        alert = Alert(
            id=uuid.uuid4(),
            visit_id=visit.id,
            webhook_type=webhook_type,
            status=status,
            payload=payload,
        )
        db.add(alert)
        db.commit()
    except Exception as e:
        logger.warning("Could not record alert row (%s): %s", webhook_type, e)
