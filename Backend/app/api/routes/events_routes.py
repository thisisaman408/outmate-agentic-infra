"""
Explorium Events API Routes

Surfaces Business Events and Prospect Events from Explorium as structured
signal cards, with full enrollment management (subscribe, update, delete, list).
Enrollments are persisted to PostgreSQL (event_enrollments table).
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timezone, timedelta

from app.services.explorium_service import ExploriumService
from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.event_enrollment import EventEnrollment
from app.db.models.event_cache import EventCache

logger = logging.getLogger(__name__)

router = APIRouter(tags=["events"])

# ---------------------------------------------------------------------------
# Event metadata maps  (keys validated against live Explorium API)
# ---------------------------------------------------------------------------

BUSINESS_EVENT_METADATA: Dict[str, Dict[str, str]] = {
    "ipo_announcement":                          {"label": "IPO Announcement",       "impact": "high",   "category": "Growth"},
    "new_funding_round":                         {"label": "New Funding Round",      "impact": "high",   "category": "Growth"},
    "new_investment":                            {"label": "New Investment",         "impact": "medium", "category": "Growth"},
    "merger_and_acquisitions":                   {"label": "M&A Activity",           "impact": "high",   "category": "Corporate"},
    "cost_cutting":                              {"label": "Cost Cutting",           "impact": "high",   "category": "Risk"},
    "new_partnership":                           {"label": "New Partnership",        "impact": "medium", "category": "Corporate"},
    "new_product":                               {"label": "Product Launch",         "impact": "medium", "category": "Growth"},
    "new_office":                                {"label": "Office Opening",         "impact": "low",    "category": "Growth"},
    "closing_office":                            {"label": "Office Closing",         "impact": "medium", "category": "Risk"},
    "company_award":                             {"label": "Award / Recognition",    "impact": "low",    "category": "Growth"},
    "outages_and_security_breaches":             {"label": "Security Breach",        "impact": "high",   "category": "Risk"},
    "lawsuits_and_legal_issues":                 {"label": "Legal / Lawsuit",        "impact": "high",   "category": "Risk"},
    # Workforce signals (from Signals PDF: "New ICP GTM leader hired", "New CRO/CCO hired")
    "employee_joined_company":                   {"label": "New Executive Hire",     "impact": "high",   "category": "Growth"},
    # Department workforce changes
    "increase_in_all_departments":               {"label": "Workforce Expansion",    "impact": "medium", "category": "Growth"},
    "decrease_in_all_departments":               {"label": "Workforce Reduction",    "impact": "high",   "category": "Risk"},
    "increase_in_engineering_department":        {"label": "Eng Hiring Up",          "impact": "medium", "category": "Growth"},
    "increase_in_sales_department":              {"label": "Sales Hiring Up",        "impact": "medium", "category": "Growth"},
    "increase_in_marketing_department":          {"label": "Marketing Hiring Up",    "impact": "medium", "category": "Growth"},
    "increase_in_operations_department":         {"label": "Ops Hiring Up",          "impact": "low",    "category": "Growth"},
    "increase_in_customer_service_department":   {"label": "CS Hiring Up",           "impact": "low",    "category": "Growth"},
    "decrease_in_engineering_department":        {"label": "Eng Layoffs",            "impact": "high",   "category": "Risk"},
    "decrease_in_sales_department":              {"label": "Sales Layoffs",          "impact": "high",   "category": "Risk"},
    "decrease_in_marketing_department":          {"label": "Marketing Layoffs",      "impact": "medium", "category": "Risk"},
    "decrease_in_operations_department":         {"label": "Ops Layoffs",            "impact": "medium", "category": "Risk"},
    "decrease_in_customer_service_department":   {"label": "CS Layoffs",             "impact": "medium", "category": "Risk"},
    # Hiring per department
    "hiring_in_engineering_department":          {"label": "Hiring Engineers",       "impact": "low",    "category": "Growth"},
    "hiring_in_sales_department":                {"label": "Hiring Sales",           "impact": "low",    "category": "Growth"},
    "hiring_in_marketing_department":            {"label": "Hiring Marketing",       "impact": "low",    "category": "Growth"},
    "hiring_in_finance_department":              {"label": "Hiring Finance",         "impact": "low",    "category": "Corporate"},
    "hiring_in_human_resources_department":      {"label": "Hiring HR",              "impact": "low",    "category": "Corporate"},
    "hiring_in_operations_department":           {"label": "Hiring Operations",      "impact": "low",    "category": "Growth"},
    "hiring_in_legal_department":                {"label": "Hiring Legal",           "impact": "low",    "category": "Corporate"},
    "hiring_in_support_department":              {"label": "Hiring Support",         "impact": "low",    "category": "Corporate"},
    "hiring_in_health_department":               {"label": "Hiring Health",          "impact": "low",    "category": "Growth"},
    "hiring_in_education_department":            {"label": "Hiring Education",       "impact": "low",    "category": "Growth"},
    "hiring_in_professional_service_department": {"label": "Hiring Prof. Services",  "impact": "low",    "category": "Corporate"},
    "hiring_in_creative_department":             {"label": "Hiring Creative",        "impact": "low",    "category": "Growth"},
    "hiring_in_trade_department":                {"label": "Hiring Trade",           "impact": "low",    "category": "Corporate"},
    "hiring_in_unknown_department":              {"label": "Hiring (Other)",         "impact": "low",    "category": "Corporate"},
}

PROSPECT_EVENT_METADATA: Dict[str, Dict[str, str]] = {
    "prospect_changed_company":       {"label": "Company Switch",   "impact": "high"},
    "prospect_changed_role":          {"label": "Role Change",      "impact": "medium"},
    "prospect_job_start_anniversary": {"label": "Work Anniversary", "impact": "low"},
}

ALL_BUSINESS_EVENT_TYPES = list(BUSINESS_EVENT_METADATA.keys())
ALL_PROSPECT_EVENT_TYPES = list(PROSPECT_EVENT_METADATA.keys())

# Validated against live Explorium API — any key not in this set causes a 422
VALID_EXPLORIUM_BUSINESS_TYPES: set = set(ALL_BUSINESS_EVENT_TYPES)
VALID_EXPLORIUM_PROSPECT_TYPES: set = set(ALL_PROSPECT_EVENT_TYPES)


def _sanitize_business_types(event_types: List[str]) -> List[str]:
    """Strip any keys not accepted by Explorium to prevent 422 errors."""
    return [t for t in event_types if t in VALID_EXPLORIUM_BUSINESS_TYPES]


def _sanitize_prospect_types(event_types: List[str]) -> List[str]:
    return [t for t in event_types if t in VALID_EXPLORIUM_PROSPECT_TYPES]

# ---------------------------------------------------------------------------
# Description builders  (field names from Explorium Data Point PDF)
# ---------------------------------------------------------------------------

def _build_business_description(event_name: str, raw: Dict[str, Any]) -> str:
    label = BUSINESS_EVENT_METADATA.get(event_name, {}).get("label", event_name)
    parts: List[str] = [label]

    if event_name in ("new_funding_round", "new_investment", "ipo_announcement"):
        # Data Point PDF: amount_raised, funding_stage, investors (array), lead_investor
        amount = raw.get("amount_raised") or raw.get("investment_amount") or raw.get("offer_amount")
        amount_str = raw.get("investment_amount_string")
        round_name = raw.get("funding_stage") or raw.get("founding_stage")
        lead_inv = raw.get("lead_investor")
        investors = raw.get("investors")
        if amount_str:
            parts.append(f"Amount: {amount_str}")
        elif amount:
            parts.append(f"Amount: {amount}")
        if round_name:
            parts.append(f"Stage: {round_name}")
        if lead_inv:
            parts.append(f"Lead: {lead_inv}")
        elif investors and isinstance(investors, list):
            parts.append(f"Investors: {', '.join(str(i) for i in investors[:3])}")

    elif event_name == "merger_and_acquisitions":
        # Data Point PDF: companies_involved (array), strategic_objective, acquisition_price_amount
        involved = raw.get("companies_involved")
        objective = raw.get("strategic_objective")
        price = raw.get("acquisition_price_amount")
        if involved and isinstance(involved, list):
            parts.append(f"Companies: {', '.join(str(c) for c in involved[:3])}")
        if price:
            currency = raw.get("acquisition_price_currency", "")
            parts.append(f"Price: {price} {currency}".strip())
        if objective:
            parts.append(str(objective)[:150])

    elif event_name in ("increase_in_all_departments", "decrease_in_all_departments",
                        "increase_in_engineering_department", "increase_in_sales_department",
                        "increase_in_marketing_department", "increase_in_operations_department",
                        "increase_in_customer_service_department", "increase_in_finance_department",
                        "decrease_in_engineering_department", "decrease_in_sales_department",
                        "decrease_in_marketing_department", "decrease_in_operations_department",
                        "decrease_in_customer_service_department", "decrease_in_finance_department"):
        # Data Point PDF: department_change (QoQ integer), change_type
        dept = raw.get("department")
        change = raw.get("department_change")
        change_type = raw.get("change_type")
        if dept:
            parts.append(f"Dept: {dept}")
        if change is not None:
            parts.append(f"QoQ: {change:+d}")
        elif change_type:
            parts.append(f"Trend: {change_type}")

    elif event_name.startswith("hiring_in_"):
        # Data Point PDF: department, job_count, job_titles (array), location
        dept = raw.get("department")
        job_count = raw.get("job_count")
        job_titles = raw.get("job_titles")
        location = raw.get("location")
        if dept:
            parts.append(f"Dept: {dept}")
        if job_count:
            parts.append(f"Openings: {job_count}")
        if job_titles and isinstance(job_titles, list):
            parts.append(f"Roles: {', '.join(str(t) for t in job_titles[:3])}")
        if location:
            parts.append(f"Location: {location}")

    elif event_name == "new_partnership":
        # Data Point PDF: partner_company, purpose_of_partnership
        partner = raw.get("partner_company") or raw.get("partner_name")
        purpose = raw.get("purpose_of_partnership")
        if partner:
            parts.append(f"Partner: {partner}")
        if purpose:
            parts.append(str(purpose)[:150])

    elif event_name == "new_product":
        # Data Point PDF: product_name, product_description
        product = raw.get("product_name")
        desc = raw.get("product_description")
        if product:
            parts.append(f"Product: {product}")
        if desc:
            parts.append(str(desc)[:150])

    elif event_name in ("new_office", "closing_office"):
        # Data Point PDF: office_location, purpose_of_new_office / reason_for_closure, number_of_employees
        location = raw.get("office_location")
        purpose = raw.get("purpose_of_new_office") or raw.get("reason_for_closure")
        headcount = raw.get("number_of_employees") or raw.get("number_of_employees_affected")
        if location:
            parts.append(f"Location: {location}")
        if headcount:
            parts.append(f"Employees: {headcount}")
        if purpose:
            parts.append(str(purpose)[:150])

    elif event_name == "company_award":
        # Data Point PDF: award_name, awarding_body, award_reason
        award = raw.get("award_name")
        body_name = raw.get("awarding_body")
        reason = raw.get("award_reason")
        if award:
            parts.append(f"Award: {award}")
        if body_name:
            parts.append(f"From: {body_name}")
        if reason:
            parts.append(str(reason)[:150])

    elif event_name == "lawsuits_and_legal_issues":
        # Data Point PDF: case_type, court
        case_type = raw.get("case_type")
        court = raw.get("court")
        if case_type:
            parts.append(f"Type: {case_type}")
        if court:
            parts.append(f"Court: {court}")

    elif event_name == "outages_and_security_breaches":
        # Data Point PDF: incident_type, impacted_systems (array), number_of_affected_customers
        incident = raw.get("incident_type")
        systems = raw.get("impacted_systems")
        affected = raw.get("number_of_affected_customers")
        if incident:
            parts.append(f"Type: {incident}")
        if systems and isinstance(systems, list):
            parts.append(f"Systems: {', '.join(str(s) for s in systems[:3])}")
        if affected:
            parts.append(f"Affected: {affected:,} customers")

    elif event_name == "cost_cutting":
        # Data Point PDF: action_taken, departments_affected (array), expected_savings_amount
        action = raw.get("action_taken")
        depts = raw.get("departments_affected")
        savings = raw.get("expected_savings_amount")
        savings_str = raw.get("expected_savings_currency", "")
        if action:
            parts.append(str(action)[:150])
        if depts and isinstance(depts, list):
            parts.append(f"Depts: {', '.join(str(d) for d in depts[:3])}")
        if savings:
            parts.append(f"Savings: {savings} {savings_str}".strip())

    elif event_name == "employee_joined_company":
        # Data Point PDF (New executive level hires): full_name, job_role_title, job_department, change_type
        name = raw.get("full_name")
        title = raw.get("job_role_title")
        dept = raw.get("job_department")
        change_type = raw.get("change_type")
        if name:
            parts.append(name)
        if title:
            parts.append(f"Title: {title}")
        if dept:
            parts.append(f"Dept: {dept}")
        if change_type:
            parts.append(change_type)

    # Always append snippet/title as final context
    snippet = raw.get("snippet") or raw.get("description") or raw.get("title")
    if snippet and str(snippet) not in " | ".join(parts):
        parts.append(str(snippet)[:200])

    return " | ".join(parts)


def _build_prospect_description(event_name: str, raw: Dict[str, Any]) -> str:
    label = PROSPECT_EVENT_METADATA.get(event_name, {}).get("label", event_name)
    parts: List[str] = [label]

    if event_name == "prospect_changed_company":
        # Data Point PDF: previous_company_name, current_company_name, previous_job_title, current_job_title
        prev_co = raw.get("previous_company_name")
        new_co = raw.get("current_company_name")
        prev_title = raw.get("previous_job_title")
        new_title = raw.get("current_job_title")
        if prev_co and new_co:
            parts.append(f"{prev_co} → {new_co}")
        elif new_co:
            parts.append(f"Now at: {new_co}")
        if prev_title and new_title:
            parts.append(f"{prev_title} → {new_title}")
        elif new_title:
            parts.append(f"New title: {new_title}")

    elif event_name == "prospect_changed_role":
        # Data Point PDF: previous_job_title, current_job_title, current_company_name
        prev_title = raw.get("previous_job_title")
        new_title = raw.get("current_job_title")
        company = raw.get("current_company_name") or raw.get("company_name")
        if prev_title and new_title:
            parts.append(f"{prev_title} → {new_title}")
        elif new_title:
            parts.append(f"New role: {new_title}")
        if company:
            parts.append(f"at {company}")

    elif event_name == "prospect_job_start_anniversary":
        # Data Point PDF: years_at_company, job_title, company_name
        years = raw.get("years_at_company")
        company = raw.get("company_name")
        job_title = raw.get("job_title")
        if years:
            parts.append(f"{years} year(s)")
        if job_title:
            parts.append(f"as {job_title}")
        if company:
            parts.append(f"at {company}")

    return " | ".join(parts)


# ---------------------------------------------------------------------------
# Normalizers
# ---------------------------------------------------------------------------

def normalize_business_event(raw: Dict[str, Any], business_name: str) -> Dict[str, Any]:
    event_name = raw.get("event_name", "unknown")
    meta = BUSINESS_EVENT_METADATA.get(
        event_name,
        {"label": event_name.replace("_", " ").title(), "impact": "medium", "category": "Corporate"},
    )
    ts = raw.get("event_time") or raw.get("timestamp") or ""
    entity_id = raw.get("business_id") or raw.get("id") or ""
    return {
        "id": f"{entity_id}-{event_name}-{ts}",
        "entityId": entity_id,
        "entityName": business_name,
        "entityType": "business",
        "eventType": event_name,
        "eventLabel": meta["label"],
        "category": meta["category"],
        "timestamp": ts,
        "description": _build_business_description(event_name, raw),
        "sourceUrl": raw.get("source_url") or raw.get("link") or raw.get("url"),
        "impact": meta["impact"],
        "metadata": raw,
    }


def normalize_prospect_event(raw: Dict[str, Any], prospect_name: str) -> Dict[str, Any]:
    event_name = raw.get("event_name", "unknown")
    meta = PROSPECT_EVENT_METADATA.get(
        event_name,
        {"label": event_name.replace("_", " ").title(), "impact": "medium"},
    )
    ts = raw.get("event_time") or raw.get("timestamp") or ""
    entity_id = raw.get("prospect_id") or raw.get("id") or ""
    return {
        "id": f"{entity_id}-{event_name}-{ts}",
        "entityId": entity_id,
        "entityName": prospect_name,
        "entityType": "prospect",
        "eventType": event_name,
        "eventLabel": meta["label"],
        "category": "Prospect",
        "timestamp": ts,
        "description": _build_prospect_description(event_name, raw),
        "sourceUrl": raw.get("linkedin_url"),
        "impact": meta["impact"],
        "metadata": raw,
    }


def _extract_events_list(response: Dict[str, Any]) -> List[Dict[str, Any]]:
    if isinstance(response, list):
        return response
    for key in ("output_events", "events", "data", "results", "items"):
        val = response.get(key)
        if isinstance(val, list):
            return val
    return []


def _flatten_event(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Merge top-level fields with nested 'data' sub-object so normalizers have one flat dict."""
    flat = dict(raw)
    nested = raw.get("data")
    if isinstance(nested, dict):
        for k, v in nested.items():
            if k not in flat or flat[k] is None:
                flat[k] = v
        if not flat.get("source_url"):
            flat["source_url"] = nested.get("link") or nested.get("url") or nested.get("source_url")
    return flat


# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------

class FetchBusinessEventsRequest(BaseModel):
    business_ids: List[str]
    event_types: List[str] = Field(default_factory=list)
    timestamp_from: Optional[str] = None
    force_refresh: bool = False


class EnrollBusinessRequest(BaseModel):
    business_ids: List[str]
    event_types: List[str]
    business_name: Optional[str] = None


class UpdateBusinessEnrollmentRequest(BaseModel):
    business_id: str
    event_types: List[str]


class DeleteBusinessEnrollmentRequest(BaseModel):
    business_id: str


class FetchProspectEventsRequest(BaseModel):
    prospect_ids: List[str]
    event_types: List[str] = Field(default_factory=list)
    timestamp_from: Optional[str] = None
    force_refresh: bool = False


class EnrollProspectRequest(BaseModel):
    prospect_ids: List[str]
    event_types: List[str]


class UpdateProspectEnrollmentRequest(BaseModel):
    prospect_id: str
    event_types: List[str]


class DeleteProspectEnrollmentRequest(BaseModel):
    prospect_id: str


class MatchBusinessRequest(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None


class MatchProspectRequest(BaseModel):
    full_name: Optional[str] = None   # "First Last"
    email: Optional[str] = None
    linkedin: Optional[str] = None    # LinkedIn URL
    company_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _default_timestamp_from(days: int = 30) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.isoformat().replace("+00:00", "Z")


def _get_explorium() -> ExploriumService:
    return ExploriumService()


def _enrollment_to_dict(e: EventEnrollment) -> Dict[str, Any]:
    key = "business_id" if e.entity_type == "business" else "prospect_id"
    name_key = "business_name" if e.entity_type == "business" else "prospect_name"
    return {
        key: e.entity_id,
        name_key: e.entity_name or e.entity_id,
        "entity_type": e.entity_type,
        "event_types": e.event_types or [],
        "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else "",
    }


# ---------------------------------------------------------------------------
# DB event cache helpers
# ---------------------------------------------------------------------------

def _card_to_cache_row(card: Dict[str, Any], entity_type: str) -> Dict[str, Any]:
    return {
        "event_uid":      card["id"],
        "entity_id":      card["entityId"],
        "entity_name":    card.get("entityName"),
        "entity_type":    entity_type,
        "event_type":     card.get("eventType", ""),
        "event_label":    card.get("eventLabel"),
        "category":       card.get("category"),
        "timestamp":      card.get("timestamp"),
        "description":    card.get("description"),
        "source_url":     card.get("sourceUrl"),
        "impact":         card.get("impact"),
        "event_metadata": card.get("metadata"),
    }


def _cache_row_to_card(row: EventCache) -> Dict[str, Any]:
    return {
        "id":          row.event_uid,
        "entityId":    row.entity_id,
        "entityName":  row.entity_name or row.entity_id,
        "entityType":  row.entity_type,
        "eventType":   row.event_type,
        "eventLabel":  row.event_label or row.event_type,
        "category":    row.category or "Corporate",
        "timestamp":   row.timestamp or "",
        "description": row.description or "",
        "sourceUrl":   row.source_url,
        "impact":      row.impact or "medium",
        "metadata":    row.event_metadata or {},
    }


def _upsert_cards_to_cache(db: Session, cards: List[Dict[str, Any]], entity_type: str) -> None:
    """Insert or update event cards in event_cache (upsert by event_uid)."""
    now = datetime.now(timezone.utc)
    for card in cards:
        uid = card.get("id")
        if not uid:
            continue
        existing = db.query(EventCache).filter_by(event_uid=uid).first()
        if existing:
            existing.entity_name    = card.get("entityName")
            existing.event_label    = card.get("eventLabel")
            existing.description    = card.get("description")
            existing.source_url     = card.get("sourceUrl")
            existing.event_metadata = card.get("metadata")
            existing.fetched_at     = now
        else:
            row = EventCache(**_card_to_cache_row(card, entity_type))
            row.fetched_at = now
            db.add(row)
    db.commit()


def _load_from_db_cache(db: Session, entity_ids: List[str], entity_type: str) -> Optional[List[Dict[str, Any]]]:
    """
    Return cached cards for entity_ids if ALL of them have been fetched today.
    Returns None if any entity is missing today's cache (caller must hit Explorium).
    """
    if not entity_ids:
        return []
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    cached_ids_q = (
        db.query(EventCache.entity_id)
        .filter(
            EventCache.entity_id.in_(entity_ids),
            EventCache.entity_type == entity_type,
            EventCache.fetched_at >= today_start,
        )
        .distinct()
        .all()
    )
    cached_ids = {r[0] for r in cached_ids_q}
    if not all(eid in cached_ids for eid in entity_ids):
        return None   # cache miss — caller must fetch from Explorium
    rows = (
        db.query(EventCache)
        .filter(
            EventCache.entity_id.in_(entity_ids),
            EventCache.entity_type == entity_type,
        )
        .all()
    )
    return [_cache_row_to_card(r) for r in rows]


# ---------------------------------------------------------------------------
# Business Events endpoints
# ---------------------------------------------------------------------------

@router.post("/businesses/events")
async def fetch_business_events(
    body: FetchBusinessEventsRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Fetch business events — returns from DB cache if fetched today, otherwise hits Explorium."""
    # --- DB cache check ---
    if not body.force_refresh and body.business_ids:
        cached = _load_from_db_cache(db, body.business_ids, "business")
        if cached is not None:
            logger.info("[events] business cache hit for %d entities (%d cards)", len(body.business_ids), len(cached))
            return {"events": cached, "count": len(cached), "error": None, "from_cache": True}

    # --- Cache miss or force refresh: hit Explorium ---
    svc = _get_explorium()
    ts_from = body.timestamp_from or _default_timestamp_from(180)

    enrollments = db.query(EventEnrollment).filter(
        EventEnrollment.entity_id.in_(body.business_ids),
        EventEnrollment.entity_type == "business",
    ).all()
    name_map = {e.entity_id: e.entity_name or e.entity_id for e in enrollments}

    if not body.event_types and enrollments:
        enrolled_types = list({et for e in enrollments for et in (e.event_types or [])})
        event_types = enrolled_types or ALL_BUSINESS_EVENT_TYPES
    else:
        event_types = body.event_types or ALL_BUSINESS_EVENT_TYPES

    fetch_error: Optional[str] = None
    cards: List[Dict[str, Any]] = []
    try:
        raw = await svc.fetch_business_events(
            business_ids=body.business_ids,
            event_types=event_types,
            timestamp_from=ts_from,
        )
        events_list = _extract_events_list(raw)
        seen_ids: Dict[str, int] = {}
        for ev in events_list:
            flat = _flatten_event(ev)
            bid = flat.get("business_id", "")
            bname = flat.get("business_name") or name_map.get(bid, bid)
            card = normalize_business_event(flat, bname)
            base_id = card["id"]
            if base_id in seen_ids:
                seen_ids[base_id] += 1
                card["id"] = f"{base_id}-{seen_ids[base_id]}"
            else:
                seen_ids[base_id] = 0
            cards.append(card)
        # Persist to DB cache
        _upsert_cards_to_cache(db, cards, "business")
        logger.info("[events] business fetch+cache: %d cards for %d entities", len(cards), len(body.business_ids))
    except Exception as exc:
        logger.error("[events] fetch_business_events error: %s", exc, exc_info=True)
        fetch_error = str(exc)
    return {"events": cards, "count": len(cards), "error": fetch_error, "from_cache": False}


@router.post("/businesses/enrollments")
async def add_business_enrollment(
    body: EnrollBusinessRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Subscribe business IDs to event monitoring (persisted to DB)."""
    clean_types = _sanitize_business_types(body.event_types)
    enrolled = []
    for bid in body.business_ids:
        existing = db.query(EventEnrollment).filter_by(entity_id=bid, entity_type="business").first()
        if existing:
            existing.event_types = clean_types
            if body.business_name:
                existing.entity_name = body.business_name
        else:
            db.add(EventEnrollment(
                entity_id=bid,
                entity_name=body.business_name or bid,
                entity_type="business",
                event_types=clean_types,
            ))
        enrolled.append(bid)
    db.commit()
    # Best-effort Explorium sync
    try:
        svc = _get_explorium()
        await svc.enroll_business_events(business_ids=body.business_ids, event_types=clean_types)
    except Exception as exc:
        logger.warning("[events] Explorium enroll skipped: %s", exc)
    return {"enrolled": enrolled, "event_types": clean_types}


@router.patch("/businesses/enrollments")
async def update_business_enrollment(
    body: UpdateBusinessEnrollmentRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Update event types for an existing business enrollment."""
    row = db.query(EventEnrollment).filter_by(entity_id=body.business_id, entity_type="business").first()
    if not row:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    clean_types = _sanitize_business_types(body.event_types)
    row.event_types = clean_types
    # Invalidate DB cache so next fetch gets fresh data with new event types
    db.query(EventCache).filter_by(entity_id=body.business_id, entity_type="business").delete()
    db.commit()
    try:
        svc = _get_explorium()
        await svc.update_business_enrollment(business_id=body.business_id, event_types=clean_types)
    except Exception as exc:
        logger.warning("[events] Explorium update skipped: %s", exc)
    return _enrollment_to_dict(row)


@router.delete("/businesses/enrollments")
async def delete_business_enrollment(
    body: DeleteBusinessEnrollmentRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Remove a business from event monitoring."""
    db.query(EventEnrollment).filter_by(entity_id=body.business_id, entity_type="business").delete()
    db.query(EventCache).filter_by(entity_id=body.business_id, entity_type="business").delete()
    db.commit()
    try:
        svc = _get_explorium()
        await svc.delete_business_enrollment(business_id=body.business_id)
    except Exception as exc:
        logger.warning("[events] Explorium delete skipped: %s", exc)
    return {"deleted": body.business_id}


@router.get("/businesses/enrollments")
async def get_business_enrollments(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List all active business event enrollments."""
    rows = db.query(EventEnrollment).filter_by(entity_type="business").all()
    return {"enrollments": [_enrollment_to_dict(r) for r in rows], "count": len(rows)}


# ---------------------------------------------------------------------------
# Prospect Events endpoints
# ---------------------------------------------------------------------------

@router.post("/prospects/events")
async def fetch_prospect_events(
    body: FetchProspectEventsRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Fetch prospect events — returns from DB cache if fetched today, otherwise hits Explorium."""
    # --- DB cache check ---
    if not body.force_refresh and body.prospect_ids:
        cached = _load_from_db_cache(db, body.prospect_ids, "prospect")
        if cached is not None:
            logger.info("[events] prospect cache hit for %d entities (%d cards)", len(body.prospect_ids), len(cached))
            return {"events": cached, "count": len(cached), "error": None, "from_cache": True}

    # --- Cache miss or force refresh: hit Explorium ---
    svc = _get_explorium()
    ts_from = body.timestamp_from or _default_timestamp_from(180)

    enrollments = db.query(EventEnrollment).filter(
        EventEnrollment.entity_id.in_(body.prospect_ids),
        EventEnrollment.entity_type == "prospect",
    ).all()
    name_map = {e.entity_id: e.entity_name or e.entity_id for e in enrollments}

    if not body.event_types and enrollments:
        enrolled_types = list({et for e in enrollments for et in (e.event_types or [])})
        event_types = enrolled_types or ALL_PROSPECT_EVENT_TYPES
    else:
        event_types = body.event_types or ALL_PROSPECT_EVENT_TYPES

    fetch_error: Optional[str] = None
    cards: List[Dict[str, Any]] = []
    try:
        raw = await svc.fetch_prospect_events(
            prospect_ids=body.prospect_ids,
            event_types=event_types,
            timestamp_from=ts_from,
        )
        events_list = _extract_events_list(raw)
        seen_ids: Dict[str, int] = {}
        for ev in events_list:
            flat = _flatten_event(ev)
            pid = flat.get("prospect_id", "")
            pname = flat.get("prospect_name") or flat.get("full_name") or name_map.get(pid, pid)
            card = normalize_prospect_event(flat, pname)
            base_id = card["id"]
            if base_id in seen_ids:
                seen_ids[base_id] += 1
                card["id"] = f"{base_id}-{seen_ids[base_id]}"
            else:
                seen_ids[base_id] = 0
            cards.append(card)
        _upsert_cards_to_cache(db, cards, "prospect")
        logger.info("[events] prospect fetch+cache: %d cards for %d entities", len(cards), len(body.prospect_ids))
    except Exception as exc:
        logger.error("[events] fetch_prospect_events error: %s", exc, exc_info=True)
        fetch_error = str(exc)
    return {"events": cards, "count": len(cards), "error": fetch_error, "from_cache": False}


@router.post("/prospects/enrollments")
async def add_prospect_enrollment(
    body: EnrollProspectRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Subscribe prospect IDs to event monitoring (persisted to DB)."""
    clean_types = _sanitize_prospect_types(body.event_types)
    enrolled = []
    for pid in body.prospect_ids:
        existing = db.query(EventEnrollment).filter_by(entity_id=pid, entity_type="prospect").first()
        if existing:
            existing.event_types = clean_types
        else:
            db.add(EventEnrollment(
                entity_id=pid,
                entity_name=pid,
                entity_type="prospect",
                event_types=clean_types,
            ))
        enrolled.append(pid)
    db.commit()
    try:
        svc = _get_explorium()
        await svc.enroll_prospect_events(prospect_ids=body.prospect_ids, event_types=clean_types)
    except Exception as exc:
        logger.warning("[events] Explorium prospect enroll skipped: %s", exc)
    return {"enrolled": enrolled, "event_types": clean_types}


@router.patch("/prospects/enrollments")
async def update_prospect_enrollment(
    body: UpdateProspectEnrollmentRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Update event types for an existing prospect enrollment."""
    row = db.query(EventEnrollment).filter_by(entity_id=body.prospect_id, entity_type="prospect").first()
    if not row:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    clean_types = _sanitize_prospect_types(body.event_types)
    row.event_types = clean_types
    db.query(EventCache).filter_by(entity_id=body.prospect_id, entity_type="prospect").delete()
    db.commit()
    try:
        svc = _get_explorium()
        await svc.update_prospect_enrollment(prospect_id=body.prospect_id, event_types=clean_types)
    except Exception as exc:
        logger.warning("[events] Explorium prospect update skipped: %s", exc)
    return _enrollment_to_dict(row)


@router.delete("/prospects/enrollments")
async def delete_prospect_enrollment(
    body: DeleteProspectEnrollmentRequest,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """Remove a prospect from event monitoring."""
    db.query(EventEnrollment).filter_by(entity_id=body.prospect_id, entity_type="prospect").delete()
    db.query(EventCache).filter_by(entity_id=body.prospect_id, entity_type="prospect").delete()
    db.commit()
    try:
        svc = _get_explorium()
        await svc.delete_prospect_enrollment(prospect_id=body.prospect_id)
    except Exception as exc:
        logger.warning("[events] Explorium prospect delete skipped: %s", exc)
    return {"deleted": body.prospect_id}


@router.get("/prospects/enrollments")
async def get_prospect_enrollments(
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """List all active prospect event enrollments."""
    rows = db.query(EventEnrollment).filter_by(entity_type="prospect").all()
    return {"enrollments": [_enrollment_to_dict(r) for r in rows], "count": len(rows)}


# ---------------------------------------------------------------------------
# Business lookup (match by name / domain → returns business_id)
# ---------------------------------------------------------------------------

@router.post("/businesses/match")
async def match_business(
    body: MatchBusinessRequest,
    _user=Depends(get_current_user),
):
    """Resolve a company name or domain to an Explorium business_id."""
    if not body.name and not body.domain:
        raise HTTPException(status_code=400, detail="Provide name or domain")
    svc = _get_explorium()
    try:
        inp = {}
        if body.domain:
            inp["domain"] = body.domain
        if body.name:
            inp["name"] = body.name
        result = await svc.match_businesses([inp])
        matched = result.get("matched_businesses") or result.get("matches") or []
        hits = []
        for m in matched[:5]:
            biz = m.get("business") if isinstance(m, dict) and m.get("business") else m
            bid = biz.get("business_id") or biz.get("id")
            # Explorium match API doesn't return a name — fall back to the input query
            input_data = m.get("input", {}) if isinstance(m, dict) else {}
            input_name = input_data.get("name") or input_data.get("domain")
            bname = biz.get("name") or biz.get("company_name") or input_name or bid
            bdomain = biz.get("domain") or biz.get("website") or input_data.get("domain")
            if bid:
                hits.append({"business_id": bid, "name": bname, "domain": bdomain})
        return {"matches": hits}
    except Exception as exc:
        logger.warning("[events] match_business error: %s", exc)
        return {"matches": [], "error": str(exc)}


# ---------------------------------------------------------------------------
# Prospect lookup (match by name / email / LinkedIn → returns prospect_id)
# ---------------------------------------------------------------------------

@router.post("/prospects/match")
async def match_prospect(
    body: MatchProspectRequest,
    _user=Depends(get_current_user),
):
    """Resolve a person's name/email/LinkedIn to an Explorium prospect_id."""
    if not any([body.full_name, body.email, body.linkedin]):
        raise HTTPException(status_code=400, detail="Provide at least one of: full_name, email, linkedin")
    svc = _get_explorium()
    try:
        inp: Dict[str, Any] = {}
        if body.full_name:
            inp["full_name"] = body.full_name
        if body.email:
            inp["email"] = body.email
        if body.linkedin:
            inp["linkedin"] = body.linkedin
        if body.company_name:
            inp["company_name"] = body.company_name
        result = await svc.match_prospects([inp])
        matched = result.get("matched_prospects") or result.get("prospects") or result.get("matches") or []
        hits = []
        for m in matched[:5]:
            pid = m.get("prospect_id") or (m.get("prospect") or {}).get("prospect_id")
            if m.get("error") or not pid:
                continue
            input_data = m.get("input", {})
            display_name = input_data.get("full_name") or input_data.get("email") or pid
            company = input_data.get("company_name") or ""
            hits.append({"prospect_id": pid, "name": display_name, "company": company,
                         "email": input_data.get("email") or body.email})
        return {"matches": hits}
    except Exception as exc:
        logger.warning("[events] match_prospect error: %s", exc)
        return {"matches": [], "error": str(exc)}


# ---------------------------------------------------------------------------
# Metadata endpoint
# ---------------------------------------------------------------------------

@router.get("/metadata")
async def get_event_metadata(_user=Depends(get_current_user)):
    """Return all known event types and their display metadata."""
    return {
        "business_event_types": [
            {"key": k, **v} for k, v in BUSINESS_EVENT_METADATA.items()
        ],
        "prospect_event_types": [
            {"key": k, **v} for k, v in PROSPECT_EVENT_METADATA.items()
        ],
    }
