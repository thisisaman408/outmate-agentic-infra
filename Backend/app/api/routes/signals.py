"""
Signal Detection API Routes
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Set
import logging
from uuid import uuid4
from datetime import datetime, timezone, timedelta

from httpx import HTTPStatusError
from urllib.parse import quote_plus

from app.services.explorium_service import ExploriumService
from app.services.signal_detection_service import SignalDetectionService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signals"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _generate_result(signal_id: str, title: str, description: str, source: str = "Signal Feed") -> Dict[str, Any]:
    return {
        "_id": f"result-{uuid4().hex[:8]}",
        "signal_id": signal_id,
        "title": title,
        "description": description,
        "source_url": f"https://news.google.com/rss/search?q={quote_plus(title)}",
        "metadata": {"source": source},
        "found_at": _now_iso(),
    }


def _seed_result_for_signal(signal_id: str, text: str) -> Dict[str, Any]:
    return _generate_result(signal_id, text, f"{text} detected in live feed")


SIGNAL_STORE: List[Dict[str, Any]] = [
    {
        "_id": f"signal-{uuid4().hex[:8]}",
        "name": "Realtime X Mentions",
        "type": "x_mentions",
        "configuration": {
            "target": "outmate ai",
            "maxResults": 12,
            "timeFrame": "1d",
        },
        "status": "active",
        "created_at": _now_iso(),
        "last_run_at": _now_iso(),
    },
    {
        "_id": f"signal-{uuid4().hex[:8]}",
        "name": "LinkedIn Hiring Signals",
        "type": "monitor_professional_posts",
        "configuration": {
            "target": "growth marketing",
            "maxResults": 10,
            "platform": "linkedin",
        },
        "status": "active",
        "created_at": _now_iso(),
        "last_run_at": None,
    },
    {
        "_id": f"signal-{uuid4().hex[:8]}",
        "name": "RSS Funding Tracker",
        "type": "monitor_rss_feed",
        "configuration": {
            "target": "Series B funding",
            "maxResults": 6,
            "timeFrame": "7d",
        },
        "status": "paused",
        "created_at": _now_iso(),
        "last_run_at": None,
    },
]


SIGNAL_RESULTS_STORE: Dict[str, List[Dict[str, Any]]] = {
    SIGNAL_STORE[0]["_id"]: [
        _seed_result_for_signal(SIGNAL_STORE[0]["_id"], "Outmate AI spotted in a new X thread"),
        _seed_result_for_signal(SIGNAL_STORE[0]["_id"], "New mention of Outmate on Google News"),
    ],
    SIGNAL_STORE[1]["_id"]: [
        _seed_result_for_signal(SIGNAL_STORE[1]["_id"], "Hiring notice posted for Senior Sales Lead"),
    ],
}


class ExploriumCreditError(Exception):
    """Indicates that Explorium rejected the query for lack of credits."""


BUSINESS_EVENT_TYPES = [
    "ipo_announcement", "new_funding_round", "new_investment",
    "merger_and_acquisitions", "cost_cutting",
    "increase_in_all_departments", "decrease_in_all_departments",
]

PROSPECT_EVENT_TYPES = [
    "prospect_changed_role",
    "prospect_changed_company",
    "prospect_job_start_anniversary",
]


def _normalize_signals_to_feed(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    feed = []
    for idx, signal in enumerate(signals):
        company = signal.get("company_name") or signal.get("domain") or f"company-{idx}"
        domain = signal.get("domain") or f"company-{idx}.com"
        main_signal = signal.get("signals", [{}])[0]
        description = main_signal.get("description") or signal.get("description") or "Signal detected"
        severity = main_signal.get("urgency", "medium")
        impact = "high" if severity == "high" else "medium"
        raw_source = main_signal.get("source") or signal.get("source") or ""
        friendly_source = raw_source.strip()
        if not friendly_source or "explorium" in friendly_source.lower():
            friendly_source = "Live signal"
        feed.append({
            "id": f"{domain}-{idx}",
            "companyId": domain,
            "companyName": company,
            "type": main_signal.get("type", "signal"),
            "confidence": max(60, min(95, main_signal.get("confidence", 85))),
            "title": description,
            "description": description,
            "source": friendly_source,
            "impact": impact,
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M UTC"),
            "metadata": {"notes": signal.get("personalization_tips", "")}
        })
    return feed


class SignalDetectionRequest(BaseModel):
    companies: List[Dict[str, Any]]
    prospect_query: Optional[str] = ""
    # Accept either a string or a list of strings
    # For prospects: ["crustdata", "contactout"]
    # For companies: ["explorium", "contactout"]
    data_source: Optional[str | List[str]] = "explorium"


class SignalDetectionResponse(BaseModel):
    signals: List[Dict[str, Any]]
    count: int
    message: str


class SignalPreviewRequest(BaseModel):
    type: str
    configuration: Dict[str, Any] = Field(default_factory=dict)


class CreateSignalRequest(BaseModel):
    name: str
    type: str
    configuration: Dict[str, Any] = Field(default_factory=dict)
    status: str = "active"


@router.get("/")
async def list_signals():
    return SIGNAL_STORE


@router.post("/")
async def create_signal(request: CreateSignalRequest):
    new_signal = {
        "_id": f"signal-{uuid4().hex[:8]}",
        "name": request.name,
        "type": request.type,
        "configuration": request.configuration or {},
        "status": request.status or "active",
        "created_at": _now_iso(),
        "last_run_at": None,
    }
    SIGNAL_STORE.append(new_signal)
    return new_signal


@router.post("/preview")
async def preview_signal(request: SignalPreviewRequest):
    target = request.configuration.get("target") or request.type
    preview_results = [
        _generate_result("preview", f"{target} signal preview", "Mock preview of signal"),
        _generate_result("preview", f"{target} alert", "Simulated alert to preview layout"),
    ]
    return preview_results


@router.post("/{signal_id}/run")
async def run_signal(signal_id: str):
    signal = next((s for s in SIGNAL_STORE if s["_id"] == signal_id), None)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    target = signal["configuration"].get("target") or signal["name"]
    run_results = [
        _generate_result(signal_id, f"Live mention of {target}", f"{target} was just detected in news"),
        _generate_result(signal_id, f"Signal matched for {target}", f"New context matched {target} on X"),
    ]
    stored = SIGNAL_RESULTS_STORE.setdefault(signal_id, [])
    stored.extend(run_results)
    signal["last_run_at"] = _now_iso()
    return {"message": "Signal run completed", "newResultsCount": len(run_results)}


@router.get("/{signal_id}/results")
async def get_signal_results(signal_id: str):
    return SIGNAL_RESULTS_STORE.get(signal_id, [])


@router.post("/detect", response_model=SignalDetectionResponse)
async def detect_signals(request: SignalDetectionRequest):
    """
    Detect relevant signals for companies/prospects for outreach personalization.
    """
    try:
        service = SignalDetectionService()

        signals = await service.detect_signals(
            companies=request.companies,
            prospect_query=request.prospect_query or "",
            data_source=request.data_source or "explorium",
            action="custom detection"
        )

        return SignalDetectionResponse(
            signals=signals,
            count=len(signals),
            message=f"Successfully detected signals for {len(signals)} companies"
        )

    except Exception as e:
        logger.error(f"Signal detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Signal detection failed: {str(e)}")


@router.get("/health")
async def signals_health():
    """Health check for signals service"""
    return {"status": "healthy", "service": "signal_detection"}


@router.get("/overview")
async def signals_overview():
    """
    Summary data for the Signals page.
    """
    data = {
        "hero": {
            "eyebrow": "Signals · Powered by signal detection",
            "title": "Signals you can define, tune, and act on in real time",
            "description": (
                "Build hiring, funding, tech, and growth signals across 4,000+ live sources—signal detection, decay logic, and enrichment keep the stories ready for you."
            ),
        },
        "signalActions": [
            {
                "title": "Hiring Signals Explorer",
                "summary": "Track talent demand changes such as new openings, expanded teams, and remote hiring footprints with freshness scoring.",
                "badge": "Fresh · Confidence scored",
            },
            {
                "title": "Funding Alerts",
                "summary": "Detect announced rounds via filings, press, and investor feeds. Each event carries a decay score so you only act on live momentum.",
                "badge": "Decay window: 72h",
            },
            {
                "title": "Tech Adoption Tracking",
                "summary": "Monitor 20,000+ products from the technographics graph and act the moment a target account adopts or upgrades a key stack.",
                "badge": "20k+ tech signals",
            },
            {
                "title": "Signal Decay Logic",
                "summary": "Signals weaken automatically over time and refresh when new events arrive, letting you stay focused on the most relevant cues.",
                "badge": "Auto decay",
            },
        ],
        "jobSignals": [
            {
                "title": "Role-Based Job Alerts",
                "description": "Combine Google Jobs, LeadMagic, and multi-source feeds to notify you when an opening matches title, function, and location requirements.",
            },
            {
                "title": "Job Changes & Promotions",
                "description": "Spot key contact moves across companies so you can trigger immediate outreach and log the signal for your playbooks.",
            },
            {
                "title": "Filtered Opportunity Streams",
                "description": "Maintain streams that cross Glassdoor, ZipRecruiter, LinkedIn, and other job boards with the filters that mean the most to you.",
            },
        ],
        "enrichmentPillars": [
            {
                "title": "Signals Directory (4,000+)",
                "description": "Every signal surfaces from a catalog of thousands of sources covering hiring, funding, compliance, tech, and social momentum.",
            },
            {
                "title": "Custom Signal Builder",
                "description": "Describe the data you care about—industry, revenue, stack, geography—and the backend scripts run it continuously.",
            },
            {
                "title": "Webhook & CRM Sync",
                "description": "Stream events straight into HubSpot, Slack, or any webhook as soon as they appear, keeping your stack in sync with live intelligence.",
            },
        ],
        "signalBuilder": {
            "focus": [
                "Hiring for sales leadership in Series B SaaS",
                "Tech adoption: observability + FinOps tools",
                "Funding: seed to Series B rounds across North America",
            ],
            "delivery": [
                "Push to Slack, HubSpot, or webhook",
                "Decay visualization per source",
                "Define alert cadence (live, daily digest, weekly review)",
            ],
        },
    }
    return data


@router.get("/feed")
async def signals_feed():
    """Return example signal feed items for the Signals page."""
    service = SignalDetectionService()
    try:
        companies = await _build_companies_for_action(service, "Live signal feed")
        if not companies:
            logger.warning("[Signals API] Explorium returned no companies for the live feed")
            return {"feeds": [], "count": 0}
        signals = await service.detect_signals(companies, data_source="explorium", action="Live signal feed")
        if signals:
            normalized = _normalize_signals_to_feed(signals)
            capped = normalized[:3]
            return {"feeds": capped, "count": len(capped)}
    except ExploriumCreditError as cre:
        logger.error(f"[Signals API] feed blocked by credits: {cre}")
        raise HTTPException(status_code=402, detail=str(cre))
    except Exception as error:
        logger.error(f"[Signals API] Explorium feed failed: {error}")

    return {"feeds": [], "count": 0}


class BuildSignalRequest(BaseModel):
    action: str
    details: Optional[str] = ""


@router.post("/build")
async def build_signal(request: BuildSignalRequest):
    """
    Simulate queueing a signal workflow for later processing.
    """
    logger.info(f"Queued signal creation: {request.action} ({request.details})")
    signal_id = f"signal-{uuid4().hex[:8]}"
    return {"status": "queued", "signalId": signal_id, "action": request.action}


class RunSignalRequest(BaseModel):
    action: str
    filters: Optional[Dict[str, Any]] = None


class EntitySignalRequest(BaseModel):
    type: str
    name: str = ""
    domain: str = ""
    signal_categories: Optional[str] = None  # comma-separated filter
    date_range: Optional[int] = None  # days
    min_score: Optional[int] = None  # 0-100


class EntityEventsRequest(BaseModel):
    type: str
    name: str = ""
    domain: str = ""
    event_types: List[str] = []
    timestamp_from: Optional[str] = None


class EnrollRequest(BaseModel):
    type: str
    name: str = ""
    domain: str = ""
    event_types: List[str] = []


def _extract_enrich_data(result: Any, business_id: str) -> Dict[str, Any]:
    """Extract data from Explorium bulk_enrich responses.
    Response shape: {"data": [{"business_id": "...", "data": {...}}]}
    """
    if isinstance(result, list):
        for item in result:
            if isinstance(item, dict):
                return item.get("data", item)
        return result[0] if result else {}
    if isinstance(result, dict):
        data_list = result.get("data", {})
        if isinstance(data_list, list):
            for item in data_list:
                if isinstance(item, dict) and item.get("business_id") == business_id:
                    return item.get("data", item)
            return data_list[0].get("data", data_list[0]) if data_list else {}
        if isinstance(data_list, dict):
            return data_list.get(business_id, data_list)
    return {}


def _make_signal_card(
    id: str,
    business_id: str,
    company_name: str,
    signal_type: str,
    confidence: int,
    title: str,
    description: str,
    impact: str = "medium",
    source: str = "Signal",
    timestamp: str = "Just now",
    metadata: Optional[Dict] = None,
) -> Dict[str, Any]:
    return {
        "id": id,
        "companyId": business_id,
        "companyName": company_name,
        "type": signal_type,
        "confidence": max(0, min(100, confidence)),
        "title": title,
        "description": description,
        "source": source,
        "impact": impact,
        "timestamp": timestamp,
        "metadata": metadata or {},
    }


def _normalize_business_events(events: List[Dict], business_id: str, company_name: str) -> List[Dict[str, Any]]:
    signals = []
    for i, evt in enumerate(events):
        evt_type = evt.get("event_type", "unknown")
        title_map = {
            "ipo_announcement": "IPO Announcement",
            "new_funding_round": "New Funding Round",
            "new_investment": "New Investment",
            "new_product": "New Product",
            "new_office": "New Office",
            "closing_office": "Closing Office",
            "new_partnership": "New Partnership",
            "merger_and_acquisitions": "Merger & Acquisition",
            "cost_cutting": "Cost Cutting",
            "increase_in_all_departments": "Workforce Growth",
            "decrease_in_all_departments": "Workforce Reduction",
            "company_award": "Company Award",
            "outages_and_security_breaches": "Outage / Security Breach",
            "lawsuits_and_legal_issues": "Lawsuit / Legal Issue",
        }
        title = title_map.get(evt_type, evt_type.replace("_", " ").title())
        desc = evt.get("description") or f"{title} event detected"
        event_time = evt.get("event_time", "")
        signals.append(_make_signal_card(
            id=f"biz-event-{business_id}-{i}",
            business_id=business_id,
            company_name=company_name,
            signal_type="business_event",
            confidence=80,
            title=title,
            description=desc,
            impact="high" if evt_type in ("new_funding_round", "ipo_announcement", "merger_and_acquisitions") else "medium",
            timestamp=event_time or "Just now",
            metadata=evt,
        ))
    return signals


def _normalize_prospect_events(events: List[Dict], prospect_id: str, prospect_name: str) -> List[Dict[str, Any]]:
    signals = []
    for i, evt in enumerate(events):
        evt_type = evt.get("event_type", "unknown")
        title_map = {
            "prospect_changed_company": "Changed Company",
            "prospect_changed_role": "Changed Role",
            "prospect_job_start_anniversary": "Job Anniversary",
        }
        title = title_map.get(evt_type, evt_type.replace("_", " ").title())
        desc = evt.get("description") or f"{title} event detected"
        event_time = evt.get("event_time", "")
        signals.append(_make_signal_card(
            id=f"prospect-event-{prospect_id}-{i}",
            business_id=prospect_id,
            company_name=prospect_name,
            signal_type="prospect_event",
            confidence=75,
            title=title,
            description=desc,
            impact="high" if evt_type == "prospect_changed_company" else "medium",
            timestamp=event_time or "Just now",
            metadata=evt,
        ))
    return signals


async def _fetch_prospect_events_with_retry(
    service: ExploriumService,
    prospect_id: str,
    event_types: List[str],
    timestamp_from: Optional[str],
) -> Dict[str, Any]:
    sanitized = [et.strip() for et in event_types if isinstance(et, str) and et.strip()]
    if not sanitized:
        sanitized = PROSPECT_EVENT_TYPES

    candidates = [sanitized]
    candidates.extend([[et] for et in sanitized if et])

    last_error: Optional[HTTPStatusError] = None
    for candidate in candidates:
        try:
            return await service.explorium.fetch_prospect_events(
                [prospect_id], candidate, timestamp_from
            )
        except HTTPStatusError as exc:
            last_error = exc
            if exc.response.status_code == 422:
                logger.warning("Prospect events fetch invalid event types %s, trying fallback candidates", candidate)
                continue
            raise

    if last_error:
        logger.warning("Prospect events fetch ultimately failed after retries: %s", last_error)
    return {}


@router.post("/entity")
async def get_entity_signals(request: EntitySignalRequest):
    """Get signals for a specific business or prospect entity"""
    service = SignalDetectionService()
    allowed_categories = None
    if request.signal_categories:
        allowed_categories = set(c.strip() for c in request.signal_categories.split(",") if c.strip())

    timestamp_from = None
    if request.date_range and request.date_range > 0:
        dt = datetime.now(timezone.utc) - timedelta(days=request.date_range)
        timestamp_from = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    min_score = request.min_score or 0

    def _should_include(signal_type: str) -> bool:
        if not allowed_categories:
            return True
        return signal_type in allowed_categories

    try:
        signals: List[Dict[str, Any]] = []
        if request.type == "business":
            # Match business
            match_payload = {"name": request.name}
            # Only include domain if it looks like a domain (contains a dot)
            if request.domain and "." in request.domain:
                match_payload["domain"] = request.domain
            match_result = await service.explorium.match_businesses([match_payload])
            logger.info(f"[Entity] match_businesses response keys: {list(match_result.keys()) if isinstance(match_result, dict) else type(match_result)}")
            logger.info(f"[Entity] match_businesses response (truncated): {str(match_result)[:500]}")
            # Handle both dict and list responses
            if isinstance(match_result, list):
                matched = match_result
            else:
                matched = match_result.get("matched_businesses") or match_result.get("matches") or match_result.get("data") or []
            if matched:
                first = matched[0]
                business_id = first.get("business_id") or first.get("id")
                company_name = request.name or request.domain
                logger.info(f"[Entity] matched business_id={business_id}, company={company_name}")
                if business_id:
                    # Intent signals
                    if _should_include("intent"):
                        try:
                            intent_result = await service.explorium.bulk_enrich_bombora_intent(
                                [business_id],
                                "training & development: corporate universities;training & development: career management;information technology: cloud computing;information technology: cybersecurity;marketing: content marketing;marketing: social media marketing;sales: sales automation;sales: crm software;finance: financial planning;finance: accounting software"
                            )
                            intent_data = _extract_enrich_data(intent_result, business_id)
                            intent_topics = intent_data.get("intent_topics", []) if isinstance(intent_data, dict) else []
                            overall_level = intent_data.get("level_of_intent", "Early Research") if isinstance(intent_data, dict) else "Early Research"
                            # intent_topics can be list of strings or list of dicts
                            for topic in intent_topics[:8]:
                                if isinstance(topic, str):
                                    topic_name = topic
                                    category = "General"
                                    conf = 75
                                    level = overall_level
                                elif isinstance(topic, dict):
                                    topic_name = topic.get("topic") or topic.get("name") or "Unknown"
                                    category = topic.get("category") or "General"
                                    raw_score = topic.get("composite_score") or topic.get("score") or 0
                                    conf = min(95, max(60, int(float(raw_score) * 100) if float(raw_score) <= 1 else int(float(raw_score))))
                                    level = topic.get("level_of_intent") or overall_level
                                else:
                                    continue
                                if conf >= min_score:
                                    signals.append(_make_signal_card(
                                        id=f"intent-{topic_name}",
                                        business_id=business_id,
                                        company_name=company_name,
                                        signal_type="intent",
                                        confidence=conf,
                                        title=f"Intent: {topic_name}",
                                        description=f"Researching {topic_name} ({category}) - {level}",
                                        impact="high" if level == "In-Depth Research" else "medium",
                                        metadata={"category": category},
                                    ))
                        except Exception as e:
                            logger.warning(f"Intent enrich failed: {e}")

                    # Firmographics signals
                    if _should_include("firmographics"):
                        try:
                            firmographics_result = await service.explorium.bulk_enrich_firmographics([business_id])
                            firmographics_data = _extract_enrich_data(firmographics_result, business_id)
                            logger.info(f"[Entity] firmographics keys={list(firmographics_data.keys()) if isinstance(firmographics_data, dict) else type(firmographics_data).__name__}")
                            revenue = firmographics_data.get("yearly_revenue_range") or firmographics_data.get("revenue_range") or firmographics_data.get("revenue")
                            if revenue:
                                signals.append(_make_signal_card(
                                    id=f"revenue-{business_id}",
                                    business_id=business_id,
                                    company_name=company_name,
                                    signal_type="firmographics",
                                    confidence=85,
                                    title=f"Revenue Range: {revenue}",
                                    description=f"Company's estimated revenue range is {revenue}, indicating growth potential.",
                                    impact="medium",
                                ))
                            employees = firmographics_data.get("number_of_employees_range") or firmographics_data.get("employee_count") or firmographics_data.get("number_of_employees")
                            if employees:
                                signals.append(_make_signal_card(
                                    id=f"employees-{business_id}",
                                    business_id=business_id,
                                    company_name=company_name,
                                    signal_type="firmographics",
                                    confidence=80,
                                    title=f"Employee Count: {employees}",
                                    description=f"Company has approximately {employees} employees.",
                                    impact="low",
                                ))
                            industry = firmographics_data.get("linkedin_industry_category") or firmographics_data.get("naics_description")
                            if industry:
                                signals.append(_make_signal_card(
                                    id=f"industry-{business_id}",
                                    business_id=business_id,
                                    company_name=company_name,
                                    signal_type="firmographics",
                                    confidence=90,
                                    title=f"Industry: {industry}",
                                    description=firmographics_data.get("business_description", f"Industry: {industry}"),
                                    impact="low",
                                ))
                            location = firmographics_data.get("country_name")
                            city = firmographics_data.get("city_name")
                            if location:
                                loc_str = f"{city}, {location}" if city else location
                                signals.append(_make_signal_card(
                                    id=f"location-{business_id}",
                                    business_id=business_id,
                                    company_name=company_name,
                                    signal_type="firmographics",
                                    confidence=90,
                                    title=f"Location: {loc_str}",
                                    description=f"Company headquartered in {loc_str}.",
                                    impact="low",
                                ))
                        except Exception as e:
                            logger.warning(f"Firmographics enrich failed: {e}")

                    # Business events
                    if _should_include("business_event"):
                        try:
                            events_result = await service.explorium.fetch_business_events(
                                [business_id], BUSINESS_EVENT_TYPES, timestamp_from
                            )
                            events = events_result.get("output_events") or events_result.get("events") or []
                            signals.extend(_normalize_business_events(events, business_id, company_name))
                        except Exception as e:
                            logger.warning(f"Business events fetch failed: {e}")

                    # Website traffic
                    if _should_include("website_traffic"):
                        try:
                            traffic_result = await service.explorium.bulk_enrich_website_traffic([business_id])
                            traffic_data = _extract_enrich_data(traffic_result, business_id)
                            monthly_visits = traffic_data.get("monthly_visits")
                            if monthly_visits:
                                signals.append(_make_signal_card(
                                    id=f"traffic-{business_id}",
                                    business_id=business_id,
                                    company_name=company_name,
                                    signal_type="website_traffic",
                                    confidence=75,
                                    title=f"Monthly Visits: {monthly_visits:,}" if isinstance(monthly_visits, (int, float)) else f"Monthly Visits: {monthly_visits}",
                                    description=f"Website receives approximately {monthly_visits:,} monthly visits." if isinstance(monthly_visits, (int, float)) else f"Website traffic data: {monthly_visits}",
                                    impact="medium",
                                    metadata=traffic_data,
                                ))
                        except Exception as e:
                            logger.warning(f"Website traffic enrich failed: {e}")

                    # Financial indicators
                    if _should_include("financial"):
                        try:
                            financial_result = await service.explorium.bulk_enrich_financial_indicators([business_id])
                            financial_data = _extract_enrich_data(financial_result, business_id)
                            if financial_data:
                                revenue_est = financial_data.get("estimated_revenue") or financial_data.get("revenue")
                                desc_parts = []
                                if revenue_est:
                                    desc_parts.append(f"Revenue: {revenue_est}")
                                growth = financial_data.get("growth_rate")
                                if growth:
                                    desc_parts.append(f"Growth: {growth}")
                                if desc_parts:
                                    signals.append(_make_signal_card(
                                        id=f"financial-{business_id}",
                                        business_id=business_id,
                                        company_name=company_name,
                                        signal_type="financial",
                                        confidence=70,
                                        title="Financial Indicators",
                                        description=". ".join(desc_parts),
                                        impact="medium",
                                        metadata=financial_data,
                                    ))
                        except Exception as e:
                            logger.warning(f"Financial indicators enrich failed: {e}")

                    # Business challenges
                    if _should_include("challenge"):
                        try:
                            challenges_result = await service.explorium.bulk_enrich_business_challenges([business_id])
                            challenges_data = _extract_enrich_data(challenges_result, business_id)
                            challenges = challenges_data.get("challenges", [])
                            for ci, challenge in enumerate(challenges[:3]):
                                ch_title = challenge if isinstance(challenge, str) else challenge.get("title", "Business Challenge")
                                ch_desc = challenge if isinstance(challenge, str) else challenge.get("description", ch_title)
                                signals.append(_make_signal_card(
                                    id=f"challenge-{business_id}-{ci}",
                                    business_id=business_id,
                                    company_name=company_name,
                                    signal_type="challenge",
                                    confidence=70,
                                    title=f"Challenge: {ch_title}" if isinstance(challenge, str) else ch_title,
                                    description=ch_desc,
                                    impact="medium",
                                    metadata={"challenge": challenge},
                                ))
                        except Exception as e:
                            logger.warning(f"Business challenges enrich failed: {e}")

        elif request.type == "prospect":
            seen_descriptions: Set[str] = set()

            def _record_description(desc: Optional[str]) -> bool:
                if not desc:
                    return False
                normalized = str(desc).strip()
                if not normalized or normalized in seen_descriptions:
                    return False
                seen_descriptions.add(normalized)
                return True

            try:
                # For prospects: name is the person's name, domain is the company
                # If domain doesn't look like a domain and equals name, don't send it as company
                prospect_match = {"full_name": request.name}
                if request.domain and request.domain != request.name:
                    prospect_match["company_name"] = request.domain
                logger.info(f"[Entity] matching prospect: {prospect_match}")
                match_result = await service.explorium.match_prospects([prospect_match])
                logger.info(f"[Entity] prospect match result: {str(match_result)[:500]}")
                # Handle both list and dict responses
                if isinstance(match_result, list):
                    matched = match_result
                else:
                    matched = match_result.get("matched_prospects") or match_result.get("data") or []
                if matched:
                    first = matched[0]
                    prospect_id = first.get("prospect_id") or first.get("id")
                    prospect_name = request.name or request.domain
                    logger.info(f"[Entity] matched prospect_id={prospect_id}, name={prospect_name}")
                    if prospect_id:
                        # Contact enrichment — extract ALL person-level signals
                        if _should_include("prospect"):
                            try:
                                contacts_result = await service.explorium.bulk_enrich_contacts_information([prospect_id])
                                cd = _extract_enrich_data(contacts_result, prospect_id)
                                logger.info(f"[Entity] prospect contacts keys={list(cd.keys()) if isinstance(cd, dict) else type(cd).__name__}")
                                logger.info(f"[Entity] prospect contacts data={str(cd)[:600]}")

                                # Emails
                                emails_raw = cd.get("emails") or cd.get("email_addresses") or []
                                if isinstance(emails_raw, str):
                                    emails_raw = [emails_raw]
                                # Normalize: items may be dicts {"address": ..., "type": ...} or strings
                                email_strs = []
                                for e in emails_raw:
                                    if isinstance(e, dict):
                                        email_strs.append(e.get("address") or e.get("email") or str(e))
                                    else:
                                        email_strs.append(str(e))
                                if email_strs:
                                    signals.append(_make_signal_card(
                                        id=f"emails-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="prospect", confidence=90,
                                        title="Contact Emails",
                                        description=f"{len(email_strs)} verified email(s): {', '.join(email_strs[:3])}",
                                        impact="high", metadata={"emails": email_strs},
                                    ))
                                # Professional email highlight
                                prof_email = cd.get("professions_email") or cd.get("professional_email")
                                if prof_email:
                                    signals.append(_make_signal_card(
                                        id=f"prof-email-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="prospect", confidence=95,
                                        title="Professional Email",
                                        description=f"Current professional email: {prof_email}",
                                        impact="high",
                                    ))

                                # Phones
                                phones_raw = cd.get("phones") or cd.get("phone_numbers") or cd.get("direct_phone_numbers") or []
                                if isinstance(phones_raw, str):
                                    phones_raw = [phones_raw]
                                phone_strs = []
                                for p in phones_raw:
                                    if isinstance(p, dict):
                                        phone_strs.append(p.get("number") or p.get("phone") or str(p))
                                    else:
                                        phone_strs.append(str(p))
                                # Also check mobile_phone
                                mobile = cd.get("mobile_phone")
                                if mobile and str(mobile) not in phone_strs:
                                    phone_strs.append(str(mobile) if not isinstance(mobile, dict) else mobile.get("number", str(mobile)))
                                if phone_strs:
                                    signals.append(_make_signal_card(
                                        id=f"phones-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="prospect", confidence=85,
                                        title="Contact Phones",
                                        description=f"{len(phone_strs)} phone number(s) available.",
                                        impact="high", metadata={"phones": phone_strs},
                                    ))

                                # Job title / role
                                job_title = cd.get("title") or cd.get("job_title") or cd.get("current_title")
                                company = cd.get("company_name") or cd.get("company") or cd.get("current_company") or request.domain
                                if job_title:
                                    signals.append(_make_signal_card(
                                        id=f"role-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="prospect_event", confidence=85,
                                        title=f"Role: {job_title}",
                                        description=f"{prospect_name} is {job_title}" + (f" at {company}" if company else ""),
                                        impact="medium",
                                    ))

                                # Department / function
                                dept = cd.get("department") or cd.get("job_function") or cd.get("function")
                                if dept:
                                    signals.append(_make_signal_card(
                                        id=f"dept-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="intent", confidence=80,
                                        title=f"Department: {dept}",
                                        description=f"{prospect_name} works in {dept}.",
                                        impact="low",
                                    ))

                                # Seniority / level
                                seniority = cd.get("seniority") or cd.get("job_level") or cd.get("management_level")
                                if seniority:
                                    signals.append(_make_signal_card(
                                        id=f"seniority-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="intent", confidence=80,
                                        title=f"Seniority: {seniority}",
                                        description=f"{prospect_name} is at {seniority} level.",
                                        impact="medium" if "c-" in str(seniority).lower() or "vp" in str(seniority).lower() or "director" in str(seniority).lower() else "low",
                                    ))

                                # LinkedIn
                                linkedin = cd.get("linkedin_url") or cd.get("linkedin") or cd.get("linkedin_profile")
                                if linkedin:
                                    signals.append(_make_signal_card(
                                        id=f"linkedin-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="intent", confidence=90,
                                        title="LinkedIn Profile",
                                        description=f"LinkedIn: {linkedin}",
                                        impact="medium", metadata={"linkedin": linkedin},
                                    ))

                                # Location
                                city = cd.get("city") or cd.get("city_name")
                                state = cd.get("state") or cd.get("region") or cd.get("region_name")
                                country = cd.get("country") or cd.get("country_name")
                                loc_parts = [p for p in [city, state, country] if p]
                                if loc_parts:
                                    loc_str = ", ".join(loc_parts)
                                    signals.append(_make_signal_card(
                                        id=f"location-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="prospect", confidence=80,
                                        title=f"Location: {loc_str}",
                                        description=f"{prospect_name} is based in {loc_str}.",
                                        impact="low",
                                    ))

                                # Education
                                education = cd.get("education") or cd.get("schools") or cd.get("university")
                                if education:
                                    if isinstance(education, list):
                                        edu_str = ", ".join(str(e.get("school", e) if isinstance(e, dict) else e) for e in education[:3])
                                    else:
                                        edu_str = str(education)
                                    signals.append(_make_signal_card(
                                        id=f"education-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="intent", confidence=75,
                                        title="Education",
                                        description=edu_str,
                                        impact="low", metadata={"education": education},
                                    ))

                                # Skills
                                skills = cd.get("skills") or cd.get("expertise")
                                if skills:
                                    if isinstance(skills, list):
                                        skills_str = ", ".join(str(s) for s in skills[:8])
                                    else:
                                        skills_str = str(skills)
                                    signals.append(_make_signal_card(
                                        id=f"skills-{prospect_id}",
                                        business_id=prospect_id, company_name=prospect_name,
                                        signal_type="intent", confidence=75,
                                        title="Skills & Expertise",
                                        description=skills_str,
                                        impact="medium", metadata={"skills": skills},
                                    ))

                                # Work history / experience
                                experience = cd.get("experience") or cd.get("work_history") or cd.get("past_companies")
                                if experience and isinstance(experience, list):
                                    for xi, exp in enumerate(experience[:3]):
                                        if isinstance(exp, dict):
                                            exp_title = exp.get("title") or exp.get("role") or ""
                                            exp_co = exp.get("company") or exp.get("company_name") or ""
                                            exp_desc = f"{exp_title} at {exp_co}" if exp_title and exp_co else str(exp)
                                        else:
                                            exp_desc = str(exp)
                                        signals.append(_make_signal_card(
                                            id=f"exp-{prospect_id}-{xi}",
                                            business_id=prospect_id, company_name=prospect_name,
                                            signal_type="intent", confidence=70,
                                            title=f"Experience: {exp_desc[:60]}",
                                            description=exp_desc,
                                            impact="low",
                                        ))

                                # Catch-all: any remaining keys with simple values
                                shown_keys = {"emails", "email_addresses", "phones", "phone_numbers", "direct_phone_numbers",
                                              "professions_email", "professional_email", "professional_email_status", "mobile_phone",
                                              "title", "job_title", "current_title", "company_name", "company", "current_company",
                                              "department", "job_function", "function", "seniority", "job_level", "management_level",
                                              "linkedin_url", "linkedin", "linkedin_profile", "city", "city_name", "state", "region",
                                              "region_name", "country", "country_name", "education", "schools", "university",
                                              "skills", "expertise", "experience", "work_history", "past_companies",
                                              "prospect_id", "business_id", "id", "full_name", "first_name", "last_name", "name"}
                                if isinstance(cd, dict):
                                    for k, v in cd.items():
                                        if k in shown_keys or not v:
                                            continue
                                        if isinstance(v, (str, int, float, bool)):
                                            label = k.replace("_", " ").title()
                                            signals.append(_make_signal_card(
                                                id=f"misc-{prospect_id}-{k}",
                                                business_id=prospect_id, company_name=prospect_name,
                                                signal_type="prospect", confidence=70,
                                                title=label,
                                                description=f"{label}: {v}",
                                                impact="low",
                                            ))

                            except Exception as e:
                                logger.warning(f"Prospect contact enrich failed: {e}")

                        # Prospect events
                        if _should_include("prospect_event"):
                            try:
                                events_result = await _fetch_prospect_events_with_retry(
                                    service.explorium, prospect_id, PROSPECT_EVENT_TYPES, timestamp_from
                                )
                                logger.info(f"[Entity] prospect events result: {str(events_result)[:300]}")
                                events = events_result.get("output_events") or events_result.get("events") or [] if isinstance(events_result, dict) else []
                                signals.extend(_normalize_prospect_events(events, prospect_id, prospect_name))
                            except Exception as e:
                                logger.warning(f"Prospect events fetch failed: {e}")

                        if _should_include("prospect"):
                            try:
                                crust_signals = await service.detect_signals(
                                    companies=[{
                                        "full_name": prospect_name,
                                        "company_name": request.domain,
                                        "linkedin_url": first.get("linkedin") or first.get("linkedin_url"),
                                        "email": first.get("email"),
                                    }],
                                    prospect_query=request.name or prospect_name,
                                    data_source="crustdata",
                                )
                                for prev_signal in signals:
                                    _record_description(prev_signal.get("description"))
                                for idx, entry in enumerate(crust_signals[:3]):
                                    for sig_idx, sig in enumerate(entry.get("signals", [])):
                                        desc = sig.get("description") or sig.get("type")
                                        if not _record_description(desc):
                                            continue
                                        confidence = sig.get("confidence") if isinstance(sig.get("confidence"), (int, float)) else 70
                                        raw_type = (sig.get("type") or "").lower()
                                        mapped_type = "prospect"
                                        if raw_type in {"new_job", "career_update", "prospect_changed_company"}:
                                            mapped_type = "prospect_event"
                                        elif raw_type in {"hiring_signal", "ai_expertise", "cloud_expertise", "data_expertise", "product_update", "thought_leader"}:
                                            mapped_type = "intent"
                                        signals.append(_make_signal_card(
                                            id=f"crustdata-prospect-{prospect_id}-{idx}-{sig_idx}",
                                            business_id=prospect_id,
                                            company_name=prospect_name,
                                            signal_type=mapped_type,
                                            confidence=int(max(60, min(95, confidence))),
                                            title=sig.get("title") or desc,
                                            description=desc,
                                            impact="high" if sig.get("urgency") == "high" else "medium",
                                            source="Profile signal",
                                            metadata=sig,
                                        ))
                            except Exception as e:
                                logger.warning(f"Crustdata prospect signals failed: {e}")

                        # Additional profile context signals
                        job_title = first.get("job_title") or first.get("title") or first.get("current_title")
                        company_name_field = first.get("company_name") or first.get("company")
                        industry = first.get("industry") or first.get("company_industry")
                        location = first.get("location") or first.get("region")
                        linkedin_url = first.get("linkedin") or first.get("linkedin_url")

                        profile_context_signals = []
                        if job_title and company_name_field:
                            profile_context_signals.append({
                                "title": "Current Role",
                                "description": f"{job_title} at {company_name_field}",
                                "impact": "medium",
                                "signal_type": "prospect_event",
                            })
                        if company_name_field and industry:
                            profile_context_signals.append({
                                "title": "Industry",
                                "description": f"{company_name_field} · {industry}",
                                "impact": "low",
                                "signal_type": "intent",
                            })
                        if location:
                            profile_context_signals.append({
                                "title": "Location",
                                "description": f"Based in {location}",
                                "impact": "low",
                                "signal_type": "prospect",
                            })
                        if linkedin_url:
                            profile_context_signals.append({
                                "title": "LinkedIn Profile",
                                "description": f"LinkedIn: {linkedin_url}",
                                "impact": "low",
                            })

                        for ctx_idx, ctx in enumerate(profile_context_signals[:3]):
                            desc = ctx["description"]
                            if not _record_description(desc):
                                continue
                            signals.append(_make_signal_card(
                                id=f"context-{prospect_id}-{ctx_idx}",
                                business_id=prospect_id,
                                company_name=prospect_name,
                                signal_type=ctx.get("signal_type", "prospect"),
                                confidence=75,
                                title=ctx["title"],
                                description=desc,
                                impact=ctx["impact"],
                                source="Profile",
                            ))
            except Exception as e:
                logger.warning(f"Prospect match/enrich failed: {e}")

        # Apply min_score filter
        if min_score > 0:
            signals = [s for s in signals if s.get("confidence", 0) >= min_score]

        logger.info(f"[Entity] Returning {len(signals)} signals for {request.type}/{request.name}")
        return {"feeds": signals, "count": len(signals)}
    except Exception as e:
        logger.error(f"Entity signals error: {e}", exc_info=True)
        return {"feeds": [], "count": 0}


@router.post("/entity/events")
async def get_entity_events(request: EntityEventsRequest):
    """Get events for a specific business or prospect entity"""
    service = SignalDetectionService()
    try:
        signals: List[Dict[str, Any]] = []
        if request.type == "business":
            match_result = await service.explorium.match_businesses([{
                "name": request.name,
                "domain": request.domain
            }])
            matched = match_result.get("matched_businesses") or match_result.get("matches") or []
            if matched:
                business_id = matched[0].get("business_id")
                if business_id:
                    event_types = request.event_types or BUSINESS_EVENT_TYPES
                    events_result = await service.explorium.fetch_business_events(
                        [business_id], event_types, request.timestamp_from
                    )
                    events = events_result.get("output_events") or events_result.get("events") or []
                    signals = _normalize_business_events(events, business_id, request.name or request.domain)

        elif request.type == "prospect":
            match_result = await service.explorium.match_prospects([{
                "name": request.name,
                "company": request.domain
            }])
            matched = match_result.get("matched_prospects") or []
            if matched:
                prospect_id = matched[0].get("prospect_id")
                if prospect_id:
                    event_types = request.event_types or PROSPECT_EVENT_TYPES
                    events_result = await service.explorium.fetch_prospect_events(
                        [prospect_id], event_types, request.timestamp_from
                    )
                    events = events_result.get("output_events") or events_result.get("events") or []
                    signals = _normalize_prospect_events(events, prospect_id, request.name or request.domain)

        return {"feeds": signals, "count": len(signals)}
    except Exception as e:
        logger.error(f"Entity events error: {e}")
        return {"feeds": [], "count": 0}


@router.post("/enroll")
async def enroll_entity(request: EnrollRequest):
    """Enroll an entity for event monitoring"""
    service = SignalDetectionService()
    try:
        if request.type == "business":
            match_result = await service.explorium.match_businesses([{
                "name": request.name,
                "domain": request.domain
            }])
            matched = match_result.get("matched_businesses") or match_result.get("matches") or []
            if not matched:
                raise HTTPException(status_code=404, detail="Business not found")
            business_id = matched[0].get("business_id")
            if not business_id:
                raise HTTPException(status_code=404, detail="Business ID not resolved")
            event_types = request.event_types or BUSINESS_EVENT_TYPES
            result = await service.explorium.enroll_business_events([business_id], event_types)
            return {"status": "enrolled", "entity_id": business_id, "event_types": event_types, "result": result}

        elif request.type == "prospect":
            match_result = await service.explorium.match_prospects([{
                "name": request.name,
                "company": request.domain
            }])
            matched = match_result.get("matched_prospects") or []
            if not matched:
                raise HTTPException(status_code=404, detail="Prospect not found")
            prospect_id = matched[0].get("prospect_id")
            if not prospect_id:
                raise HTTPException(status_code=404, detail="Prospect ID not resolved")
            return {"status": "enrolled", "entity_id": prospect_id, "event_types": request.event_types or PROSPECT_EVENT_TYPES}

        raise HTTPException(status_code=400, detail="Invalid entity type")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enroll entity error: {e}")
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")


@router.get("/autocomplete")
async def autocomplete_business(query: str, limit: int = 5):
    if not query or len(query) < 2:
        return {"suggestions": []}
    service = SignalDetectionService()
    try:
        result = await service.explorium.autocomplete_businesses("company_name", query)
        # API may return a list directly or a dict with "suggestions" key
        items = result if isinstance(result, list) else result.get("suggestions", [])
        suggestions = []
        for item in items:
            if isinstance(item, str):
                suggestions.append(item)
            elif isinstance(item, dict):
                suggestions.append(item.get("name") or item.get("business_name") or item.get("value", ""))
            else:
                suggestions.append(str(item))
        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"Autocomplete error: {e}")
        return {"suggestions": []}


ACTION_FILTERS: Dict[str, Dict[str, Any]] = {
    "Hiring Signals Explorer": {
        "keywords": ["hiring", "job openings", "talent"],
        "company_size": ["201-500", "501-1000"],
        "location": ["United States", "United Kingdom"],
        "industry": ["software", "technology"],
    },
    "Funding Alerts": {
        "keywords": ["funding", "recent funding", "series b", "series a"],
        "revenue": ["100M-1B", "1B-10B"],
        "company_size": ["501-1000", "1001-5000"],
    },
    "Tech Adoption Tracking": {
        "keywords": ["ai", "cloud", "machine learning", "observability"],
        "linkedin_category": ["technology, information and internet", "computer software"],
        "company_size": ["201-500", "501-1000", "1001-5000"],
    },
    "Signal Decay Logic": {
        "keywords": ["momentum", "growth", "expansion"],
        "company_size": ["201-500", "501-1000"],
    },
    "Build a signal": {
        "keywords": ["saas", "enterprise", "growth"],
        "linkedin_category": ["technology, information and internet"],
        "company_size": ["201-500"],
    },
    "default": {
        "keywords": ["b2b", "saas"],
        "company_size": ["201-500"],
    },
}


async def _build_companies_for_action(service: SignalDetectionService, action: str) -> List[Dict[str, Any]]:
    filters = ACTION_FILTERS.get(action) or ACTION_FILTERS["default"]
    try:
        matches = await service.explorium.search_companies(filters, limit=3)
        companies = []
        if isinstance(matches, dict):
            companies = matches.get("companies") or []
        elif isinstance(matches, list):
            companies = matches
        if companies:
            return companies
        logger.warning(f"[Signals API] Explorium returned zero companies for action '{action}'")
    except HTTPStatusError as hse:
        if hse.response.status_code == 403:
            raise ExploriumCreditError("Explorium reported insufficient credits for this query.")
        logger.warning(f"[Signals API] Explorium returned {hse.response.status_code}: {hse.response.text}")
    except Exception as error:
        logger.warning(f"[Signals API] Failed to load companies for action '{action}': {error}")
    return []


@router.post("/run")
async def run_signal(request: RunSignalRequest):
    """
    Run signal detection immediately for CI and return the detected signals.
    """
    service = SignalDetectionService()
    companies = request.filters.get("companies") if request.filters else None
    if not companies:
        companies = await _build_companies_for_action(service, request.action)
    if not companies:
        logger.warning(f"[Signals API] run signal action '{request.action}' returned no companies")
        return {"count": 0, "signals": []}
    try:
        signals = await service.detect_signals(companies, data_source="explorium", action=request.action)
        normalized = _normalize_signals_to_feed(signals)
        capped = normalized[:3]
        return {"count": len(capped), "signals": capped}
    except ExploriumCreditError as cre:
        logger.error(f"[Signals API] run signal blocked by credits: {cre}")
        raise HTTPException(status_code=402, detail=str(cre))
    except Exception as error:
        logger.error(f"[Signals API] run signal failed: {error}")
        raise HTTPException(status_code=500, detail="Signal run failed")
