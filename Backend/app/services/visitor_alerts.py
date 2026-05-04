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
    """Flatten the most useful fields from visit.resolution into a dict.

    Fields are pulled from many possible locations because different
    enrichment providers (Explorium, ContactOut, Hunter, Apollo) write to
    different keys.
    """
    res = visit.resolution or {}
    person = res.get("person") or {}
    exp = res.get("explorium") or {}
    contactout = res.get("contactout") or {}
    apollo = res.get("apollo") or {}
    hunter = res.get("hunter") or {}
    enrichment = res.get("enrichment") or {}
    company_obj = res.get("company") if isinstance(res.get("company"), dict) else {}
    geo = res.get("geo") or {}

    def _first(*vals: Any) -> str:
        for v in vals:
            if v:
                return str(v)
        return ""

    full_name = _first(
        res.get("full_name"),
        person.get("full_name"), person.get("name"),
        contactout.get("full_name"), apollo.get("name"),
        " ".join(x for x in [res.get("first_name"), res.get("last_name")] if x).strip(),
    )
    first, _, last = (full_name or "").partition(" ")

    email = _first(
        res.get("email"),
        person.get("email"), person.get("work_email"), person.get("personal_email"),
        contactout.get("email"), apollo.get("email"), hunter.get("email"),
        enrichment.get("email"),
        # ContactOut/Hunter sometimes return a list of emails
        (contactout.get("emails") or [None])[0] if isinstance(contactout.get("emails"), list) else None,
        (hunter.get("emails") or [None])[0] if isinstance(hunter.get("emails"), list) else None,
    )

    company_name = _first(
        # Top-level
        res.get("company_name"), res.get("company") if isinstance(res.get("company"), str) else None,
        # Explorium / Apollo / ContactOut
        exp.get("company_name"), exp.get("name"),
        apollo.get("organization", {}).get("name") if isinstance(apollo.get("organization"), dict) else None,
        contactout.get("company"), contactout.get("company_name"),
        # Person sub-object
        person.get("company"), person.get("company_name"),
        person.get("current_company"),
        (person.get("organization") or {}).get("name") if isinstance(person.get("organization"), dict) else None,
        # Nested company object
        company_obj.get("name"),
    )

    domain = _first(
        res.get("domain"),
        exp.get("domain"), exp.get("website_domain"),
        apollo.get("organization", {}).get("primary_domain") if isinstance(apollo.get("organization"), dict) else None,
        contactout.get("domain"),
        company_obj.get("domain"),
        person.get("company_domain"),
    )

    website = _first(
        exp.get("website"), exp.get("company_website"),
        res.get("website"),
        company_obj.get("website"),
        f"https://{domain}" if domain else "",
    )

    industry = _first(
        exp.get("industry"), exp.get("linkedin_industry_category"),
        res.get("industry"),
        apollo.get("organization", {}).get("industry") if isinstance(apollo.get("organization"), dict) else None,
        company_obj.get("industry"),
    )

    return {
        "full_name": full_name,
        "first_name": _first(res.get("first_name"), person.get("first_name"), first),
        "last_name": _first(res.get("last_name"), person.get("last_name"), last),
        "email": email,
        "phone": _first(res.get("phone"), person.get("phone"), contactout.get("phone")),
        "title": _first(
            res.get("job_title"), res.get("title"),
            person.get("job_title"), person.get("title"),
            contactout.get("title"), apollo.get("title"),
        ),
        "linkedin": _first(
            res.get("linkedin_url"),
            person.get("linkedin_url"), person.get("linkedin"),
            contactout.get("linkedin_url"),
        ),
        "company": company_name,
        "domain": domain,
        "website": website,
        "industry": industry,
        "city": _first(geo.get("city"), exp.get("city")),
        "country": _first(geo.get("country"), exp.get("country")),
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

INSTANTLY_API_URL = "https://api.instantly.ai/api/v2/leads"


async def deliver_instantly(db, user_id, visit: Visit, campaign_id: str) -> str:
    """Add the visitor as a lead to an Instantly campaign."""
    contact = _extract_contact(visit)
    if not campaign_id:
        logger.info("Instantly skipped: no campaign_id configured")
        return "skipped"
    if not contact["email"]:
        logger.info(
            "Instantly skipped for visit %s: no email resolved (Instantly /v2/leads "
            "requires an email — anonymous visits cannot be pushed)",
            visit.id,
        )
        return "skipped"

    try:
        from app.db.models.integration import Integration, UserIntegration
        from app.services.integration_engine.credential_vault import decrypt_credentials
    except Exception as e:
        logger.error("Instantly imports unavailable: %s", e)
        return "error"

    api_key = ""
    try:
        integration = (
            db.query(Integration).filter(Integration.slug == "instantly").first()
        )
        if integration:
            ui = (
                db.query(UserIntegration)
                .filter(
                    UserIntegration.user_id == user_id,
                    UserIntegration.integration_id == integration.id,
                )
                .first()
            )
            if ui and ui.credentials_encrypted:
                creds: dict = {}
                try:
                    creds = decrypt_credentials(ui.credentials_encrypted) or {}
                except Exception:
                    try:
                        creds = json.loads(ui.credentials_encrypted)
                    except Exception:
                        creds = {}
                api_key = creds.get("api_key") or creds.get("instantly_api_key") or ""

        # Legacy fallback — older flow stored the key on User.integrations
        if not api_key:
            try:
                from app.db.models.user import User as _User
                u = db.query(_User).filter(_User.id == user_id).first()
                legacy = (u.integrations if u else {}) or {}
                if (legacy.get("outreach") or {}).get("service") == "instantly":
                    api_key = legacy.get("outreach_api_key") or ""
            except Exception:
                pass

        if not api_key:
            logger.warning("Instantly API key missing for user %s", user_id)
            return "skipped"

        # Instantly V2 schema — bearer auth, single lead-create endpoint.
        body = {
            "campaign": campaign_id,
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
        headers = {"Authorization": f"Bearer {api_key}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(INSTANTLY_API_URL, json=body, headers=headers)
        if resp.status_code < 300:
            logger.info(
                "Instantly: lead added — campaign=%s email=%s status=%d",
                campaign_id, contact["email"], resp.status_code,
            )
            return "success"
        logger.warning(
            "Instantly returned %d for %s (campaign=%s): %s",
            resp.status_code,
            contact["email"],
            campaign_id,
            resp.text[:300],
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
