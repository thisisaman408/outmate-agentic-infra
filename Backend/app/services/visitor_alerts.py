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
    Returns "success" / "skipped" / "error". Also stores the most recent
    HubSpot HTTP response on `visit.resolution["_hubspot_debug"]` so prod
    failures can be diagnosed without server logs.
    """
    def _stash(payload: dict) -> None:
        try:
            res = visit.resolution or {}
            res["_hubspot_debug"] = payload
            visit.resolution = res
            db.commit()
        except Exception:
            pass

    contact = _extract_contact(visit)
    if not contact["email"]:
        _stash({"stage": "skipped", "reason": "no email resolved"})
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

    # Only standard HubSpot contact properties — custom props like
    # outmate_intent_score must exist on the portal or HubSpot rejects the
    # entire create with a 400 ("Property does not exist"). We stash extras
    # into the standard `notes` via a separate engagement instead, but keep
    # the create itself bullet-proof.
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
    }
    properties = {k: v for k, v in properties.items() if v}

    async def _try_create(props: dict[str, str]):
        svc = HubSpotService(db)
        return await svc.create_contact(user_id, props)

    try:
        await _try_create(properties)
        logger.info(
            "HubSpot: contact created — email=%s company=%s",
            contact["email"], contact["company"] or "-",
        )
        _stash({"stage": "created", "email": contact["email"]})
        return "success"
    except Exception as e:
        msg = str(e)
        if "Contact already exists" in msg or "already exists" in msg.lower() or "409" in msg:
            logger.info(
                "HubSpot: contact already exists — email=%s (treated as success)",
                contact["email"],
            )
            _stash({"stage": "already_exists", "email": contact["email"]})
            return "success"

        # Surface the HTTP response body so the actual HubSpot error reaches the log.
        status_code = None
        body = ""
        resp = getattr(e, "response", None)
        if resp is not None:
            try:
                status_code = resp.status_code
                body = (resp.text or "")[:600]
            except Exception:
                pass

        # Auto-recover: HubSpot 400 with "Property X does not exist" → strip
        # the unknown property and retry once with email-only as last resort.
        if status_code == 400 and body:
            bad_props: list[str] = []
            for prop_name in list(properties.keys()):
                # HubSpot error body lists "Property \"<name>\" does not exist"
                if f'"{prop_name}"' in body and "does not exist" in body:
                    bad_props.append(prop_name)
            if bad_props:
                cleaned = {k: v for k, v in properties.items() if k not in bad_props}
                logger.warning(
                    "HubSpot rejected props %s — retrying without them (email=%s)",
                    bad_props, contact["email"],
                )
                try:
                    await _try_create(cleaned)
                    logger.info(
                        "HubSpot: contact created on retry — email=%s",
                        contact["email"],
                    )
                    return "success"
                except Exception as e2:
                    msg2 = str(e2)
                    if "already exists" in msg2.lower() or "409" in msg2:
                        return "success"
                    # Last-ditch: email-only payload
                    try:
                        await _try_create({"email": contact["email"], "hs_lead_status": "NEW"})
                        logger.info(
                            "HubSpot: contact created on minimal retry — email=%s",
                            contact["email"],
                        )
                        return "success"
                    except Exception as e3:
                        msg3 = str(e3)
                        if "already exists" in msg3.lower() or "409" in msg3:
                            return "success"
                        logger.error(
                            "HubSpot minimal retry also failed for %s: %s",
                            contact["email"], e3,
                        )
                        return "error"

        logger.error(
            "HubSpot delivery failed for %s: status=%s body=%s err=%s props=%s",
            contact["email"], status_code, body, e, list(properties.keys()),
        )
        _stash({
            "stage": "failed",
            "email": contact["email"],
            "status_code": status_code,
            "body": body,
            "error": str(e)[:300],
            "props_sent": list(properties.keys()),
        })
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
    if ".n8n.cloud" in u or ("/webhook/" in u and "n8n" in u):
        return "n8n"
    if "n8n" in u:
        return "n8n"
    if "hooks.zapier.com" in u or "zapier.com/hooks" in u:
        return "zapier"
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


# ── Salesforce delivery ─────────────────────────────────────────────────────

async def deliver_salesforce(db, user_id, visit: Visit) -> str:
    """
    Create (or update) a Salesforce Lead from the visitor.  Requires the user
    to have connected Salesforce via OAuth or API key on the Integrations page.
    Returns "success" / "skipped" / "error".
    """
    contact = _extract_contact(visit)
    if not contact["email"]:
        logger.info("Salesforce skipped: no email resolved for visit %s", visit.id)
        return "skipped"

    try:
        from app.services.salesforce_service import SalesforceService
    except Exception as e:
        logger.error("SalesforceService unavailable: %s", e)
        return "error"

    intent_score = visit.intent_score or 0
    try:
        intent_pct = int(round(float(intent_score) * 100)) if float(intent_score) <= 1 else int(intent_score)
    except Exception:
        intent_pct = 0

    # Salesforce Lead object fields
    lead_data: dict[str, str] = {
        "LastName": contact["last_name"] or contact["full_name"] or "Unknown",
        "FirstName": contact["first_name"] or "",
        "Email": contact["email"],
        "Title": contact["title"] or "",
        "Company": contact["company"] or contact["domain"] or "Unknown",
        "Website": contact["website"] or "",
        "Phone": contact["phone"] or "",
        "City": contact["city"] or "",
        "Country": contact["country"] or "",
        "Industry": contact["industry"] or "",
        "Description": f"Visitor identified by Outmate.ai. Intent: {intent_pct}%. Page: {visit.url or ''}",
        "LeadSource": "Web Site",
        "Status": "Open - Not Contacted",
    }
    # Strip empty strings Salesforce would reject
    lead_data = {k: v for k, v in lead_data.items() if v}

    try:
        svc = SalesforceService(db)
        # Re-use create_contact — the Salesforce service sends to /sobjects/Contact.
        # A Lead endpoint would be /sobjects/Lead. We adapt the URL via a thin
        # wrapper that posts to Lead instead.
        instance_url, access_token = _sf_get_creds(svc, user_id)
        if not access_token:
            logger.warning("Salesforce: no access token for user %s", user_id)
            return "skipped"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{instance_url}/services/data/v59.0/sobjects/Lead",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=lead_data,
            )
        if resp.status_code in (200, 201):
            logger.info("Salesforce: Lead created — email=%s", contact["email"])
            return "success"
        if resp.status_code == 400 and "duplicate" in resp.text.lower():
            logger.info("Salesforce: Lead already exists — email=%s", contact["email"])
            return "success"
        logger.warning("Salesforce Lead create returned %d: %s", resp.status_code, resp.text[:300])
        return "failed"
    except Exception as e:
        logger.error("Salesforce delivery error: %s", e)
        return "error"


def _sf_get_creds(svc, user_id):
    """Return (instance_url, access_token) from the SalesforceService row."""
    row = svc._get_integration_row(user_id)
    if not row:
        return "https://login.salesforce.com", None
    creds = row.get("credentials") or {}
    instance_url = creds.get("instance_url") or "https://login.salesforce.com"
    token = creds.get("access_token") or creds.get("api_key") or None
    return instance_url, token


# ── Salesloft delivery ──────────────────────────────────────────────────────

SALESLOFT_API_BASE = "https://api.salesloft.com/v2"


async def deliver_salesoft(db, user_id, visit: Visit, cadence_id: str = "") -> str:
    """
    Push the visitor as a Person (and optionally enroll them in a Cadence)
    via the Salesloft API.  API key is stored as credentials_encrypted on the
    user_integrations row with config->>'type' == 'salesloft'.
    Returns "success" / "skipped" / "error".
    """
    contact = _extract_contact(visit)
    if not contact["email"]:
        logger.info("Salesloft skipped: no email for visit %s", visit.id)
        return "skipped"

    api_key = _get_integration_api_key(db, user_id, "salesloft")
    if not api_key:
        logger.warning("Salesloft: API key not configured for user %s", user_id)
        return "skipped"

    try:
        person_body = {
            "email_address": contact["email"],
            "first_name": contact["first_name"] or "",
            "last_name": contact["last_name"] or contact["full_name"] or "",
            "title": contact["title"] or "",
            "phone": contact["phone"] or "",
            "linkedin_url": contact["linkedin"] or "",
            "account": {"domain": contact["domain"]} if contact["domain"] else None,
        }
        person_body = {k: v for k, v in person_body.items() if v not in ("", None)}

        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{SALESLOFT_API_BASE}/people.json",
                json=person_body,
                headers=headers,
            )

        if resp.status_code in (200, 201):
            person_data = resp.json().get("data", {})
            person_id = person_data.get("id")
            logger.info("Salesloft: Person created id=%s email=%s", person_id, contact["email"])

            # Optionally enroll in cadence
            if cadence_id and person_id:
                try:
                    enroll_body = {
                        "cadence_id": int(cadence_id),
                        "person_id": person_id,
                    }
                    async with httpx.AsyncClient(timeout=10) as client2:
                        await client2.post(
                            f"{SALESLOFT_API_BASE}/cadence_memberships.json",
                            json=enroll_body,
                            headers=headers,
                        )
                except Exception as enroll_err:
                    logger.warning("Salesloft cadence enroll failed: %s", enroll_err)
            return "success"

        if resp.status_code == 422 and "already" in resp.text.lower():
            logger.info("Salesloft: Person already exists — email=%s", contact["email"])
            return "success"

        logger.warning("Salesloft returned %d: %s", resp.status_code, resp.text[:300])
        return "failed"
    except Exception as e:
        logger.error("Salesloft delivery error: %s", e)
        return "error"


# ── Smartlead delivery ──────────────────────────────────────────────────────

SMARTLEAD_API_BASE = "https://server.smartlead.ai/api/v1"


async def deliver_smartlead(db, user_id, visit: Visit, campaign_id: str = "") -> str:
    """
    Add the visitor as a lead to a Smartlead campaign.
    API key stored in user_integrations with config->>'type' == 'smartlead',
    OR in User.integrations["outreach"]["service"]=="smartlead" legacy path.
    Returns "success" / "skipped" / "error".
    """
    contact = _extract_contact(visit)
    if not contact["email"]:
        logger.info("Smartlead skipped: no email for visit %s", visit.id)
        return "skipped"
    if not campaign_id:
        logger.info("Smartlead skipped: no campaign_id configured")
        return "skipped"

    api_key = _get_integration_api_key(db, user_id, "smartlead")
    # Legacy fallback — old outreach flow stored key on User.integrations
    if not api_key:
        try:
            from app.db.models.user import User as _User
            u = db.query(_User).filter(_User.id == user_id).first()
            legacy = (u.integrations if u else {}) or {}
            outreach = legacy.get("outreach") or {}
            if outreach.get("service") == "smartlead":
                api_key = legacy.get("outreach_api_key") or ""
            if not api_key and legacy.get("smartlead", {}).get("connected"):
                api_key = legacy.get("smartlead", {}).get("api_key") or ""
        except Exception:
            pass

    if not api_key:
        logger.warning("Smartlead: API key not configured for user %s", user_id)
        return "skipped"

    try:
        intent_score = visit.intent_score or 0
        intent_pct = int(round(float(intent_score) * 100)) if float(intent_score) <= 1 else int(intent_score)

        lead_body = {
            "lead_list": [
                {
                    "email": contact["email"],
                    "first_name": contact["first_name"] or "",
                    "last_name": contact["last_name"] or "",
                    "company_name": contact["company"] or "",
                    "phone_number": contact["phone"] or "",
                    "linkedin_profile": contact["linkedin"] or "",
                    "website": contact["website"] or "",
                    "custom_fields": {
                        "title": contact["title"] or "",
                        "industry": contact["industry"] or "",
                        "intent_score": str(intent_pct),
                        "visit_url": visit.url or "",
                    },
                }
            ]
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{SMARTLEAD_API_BASE}/campaigns/{campaign_id}/leads",
                params={"api_key": api_key},
                json=lead_body,
            )

        if resp.status_code in (200, 201):
            logger.info("Smartlead: lead added to campaign=%s email=%s", campaign_id, contact["email"])
            return "success"
        if resp.status_code == 400 and ("already" in resp.text.lower() or "duplicate" in resp.text.lower()):
            return "success"
        logger.warning("Smartlead returned %d: %s", resp.status_code, resp.text[:300])
        return "failed"
    except Exception as e:
        logger.error("Smartlead delivery error: %s", e)
        return "error"


# ── Microsoft Teams webhook delivery ────────────────────────────────────────

async def deliver_teams_webhook(webhook_url: str, visit: Visit) -> str:
    """
    Send a rich Adaptive Card to a Microsoft Teams channel via an
    *Incoming Webhook* URL (no OAuth needed — just paste the URL).
    Returns "success" / "failed" / "error".
    """
    if not webhook_url:
        return "skipped"

    contact = _extract_contact(visit)
    intent_score = visit.intent_score or 0
    try:
        intent_pct = int(round(float(intent_score) * 100)) if float(intent_score) <= 1 else int(intent_score)
    except Exception:
        intent_pct = 0
    intent_label = "🔥 Hot" if intent_pct >= 70 else ("⚡ Warm" if intent_pct >= 40 else "👀 Cold")

    name_line = contact["full_name"] or "Anonymous visitor"
    company_line = contact["company"] or "Unknown company"

    # Microsoft Teams Adaptive Card payload
    card = {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": f"🔔 New Visitor: {name_line} from {company_line}",
                            "weight": "Bolder",
                            "size": "Medium",
                            "wrap": True,
                        },
                        {
                            "type": "FactSet",
                            "facts": [
                                f for f in [
                                    {"title": "Intent", "value": f"{intent_label} ({intent_pct}%)"},
                                    {"title": "Email", "value": contact["email"] or "—"} if contact["email"] else None,
                                    {"title": "Title", "value": contact["title"]} if contact["title"] else None,
                                    {"title": "Industry", "value": contact["industry"]} if contact["industry"] else None,
                                    {"title": "Page", "value": visit.url or "—"},
                                ] if f is not None
                            ],
                        },
                    ],
                    "actions": [
                        {
                            "type": "Action.OpenUrl",
                            "title": "View in Outmate",
                            "url": "https://app.outmate.ai/visitors",
                        }
                    ] if contact["linkedin"] else [],
                },
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                webhook_url,
                json=card,
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code < 300:
            logger.info("Teams webhook: delivered for visit %s", visit.id)
            return "success"
        logger.warning("Teams webhook returned %d: %s", resp.status_code, resp.text[:200])
        return "failed"
    except Exception as e:
        logger.error("Teams webhook delivery error: %s", e)
        return "error"


# ── Zapier delivery ─────────────────────────────────────────────────────────

async def deliver_zapier(webhook_url: str, visit: Visit) -> str:
    """
    POST a structured JSON payload to a Zapier Catch Hook.  The payload is
    identical to the generic webhook but tagged with destination="zapier"
    so Zapier users can set up "Visitor identified" triggers easily.
    Returns "success" / "failed" / "error".
    """
    if not webhook_url:
        return "skipped"
    payload = build_make_n8n_payload(visit, "zapier")
    return await deliver_generic_webhook(webhook_url, payload, sign=False)


# ── Shared credential helper ─────────────────────────────────────────────────

def _get_integration_api_key(db, user_id, integration_type: str) -> str:
    """
    Fetch API key from user_integrations for a given integration type.
    Returns empty string if not found.
    """
    try:
        from sqlalchemy import text as _text
        result = db.execute(
            _text(
                "SELECT credentials_encrypted FROM user_integrations "
                "WHERE user_id = :uid AND config->>'type' = :itype "
                "AND status = 'connected' LIMIT 1"
            ),
            {"uid": str(user_id), "itype": integration_type},
        )
        row = result.mappings().first()
        if not row:
            return ""
        creds_raw = row["credentials_encrypted"]
        if not creds_raw:
            return ""
        try:
            creds = json.loads(creds_raw) if isinstance(creds_raw, str) else creds_raw
        except Exception:
            return ""
        return creds.get("api_key") or creds.get("access_token") or ""
    except Exception as e:
        logger.warning("_get_integration_api_key(%s) failed: %s", integration_type, e)
        return ""

