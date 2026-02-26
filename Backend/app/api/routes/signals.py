"""
Signal Detection API Routes
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
from uuid import uuid4
from datetime import datetime

from app.services.signal_detection_service import SignalDetectionService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signals"])


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
            "timestamp": datetime.utcnow().strftime("%H:%M UTC"),
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


@router.post("/detect", response_model=SignalDetectionResponse)
async def detect_signals(request: SignalDetectionRequest):
    """
    Detect relevant signals for companies/prospects for outreach personalization.
    
    This endpoint analyzes company data and identifies signals like:
    - Recent funding
    - Hiring trends
    - Technology adoption
    - Growth indicators
    - Expansion signals
    """
    try:
        service = SignalDetectionService()
        
        signals = await service.detect_signals(
            companies=request.companies,
            prospect_query=request.prospect_query or "",
            data_source=request.data_source or "explorium"
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
    Summary data for the Signals page. This API drives the UI so we can describe
    what customers can build without hardcoding these cards on the frontend.
    """
    data = {
        "hero": {
            "eyebrow": "Signals · Powered by signal detection",
            "title": "Signals you can define, tune, and act on in real time",
            "description": (
                "Build hiring, funding, tech, and growth signals across 4,000+ live sourcesâ€”signal detection, decay logic, and enrichment keep the stories ready for you."
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
    sample_companies = [
        {"name": "Catalyst Security", "domain": "catalystsecurity.com"},
        {"name": "Northwind Analytics", "domain": "northwindanalytics.com"},
        {"name": "Streamline DevOps", "domain": "streamlinedevops.com"},
    ]

    service = SignalDetectionService()
    try:
        signals = await service.detect_signals(sample_companies, data_source="explorium")
        if signals:
            normalized = _normalize_signals_to_feed(signals)
            return {"feeds": normalized, "count": len(normalized)}
    except Exception as error:
        logger.error(f"[Signals API] Explorium feed failed: {error}")

    fallback = [
        {
            "id": "sig-001",
            "companyId": "c1",
            "companyName": "Catalyst Security",
            "type": "job_posting",
            "confidence": 91,
            "title": "Hiring Director of Sales",
            "description": "Director of Sales role posted as part of a European expansion, matching target ICP.",
            "source": "Glassdoor",
            "impact": "high",
            "timestamp": "10 minutes ago",
            "metadata": {"position": "Director of Sales", "location": "London"},
        }
    ]
    return {"feeds": fallback, "count": len(fallback)}


class BuildSignalRequest(BaseModel):
    action: str
    details: Optional[str] = ""


@router.post("/build")
async def build_signal(request: BuildSignalRequest):
    """
    Simulate queueing a signal workflow for later processing. Returns a placeholder signal ID.
    """
    logger.info(f"Queued signal creation: {request.action} ({request.details})")
    signal_id = f"signal-{uuid4().hex[:8]}"
    return {"status": "queued", "signalId": signal_id, "action": request.action}


class RunSignalRequest(BaseModel):
    action: str
    filters: Optional[Dict[str, Any]] = None


@router.post("/run")
async def run_signal(request: RunSignalRequest):
    """
    Run signal detection immediately for CI and return the detected signals.
    """
    sample_companies = [
        {"name": "Catalyst Security", "domain": "catalystsecurity.com"},
        {"name": "Northwind Analytics", "domain": "northwindanalytics.com"},
        {"name": "Streamline DevOps", "domain": "streamlinedevops.com"},
    ]

    # allow overriding sample companies via filters
    if request.filters:
        sample_companies = request.filters.get("companies", sample_companies)

    service = SignalDetectionService()
    try:
        signals = await service.detect_signals(sample_companies, data_source="explorium")
        normalized = _normalize_signals_to_feed(signals)
        return {"count": len(normalized), "signals": normalized}
    except Exception as error:
        logger.error(f"[Signals API] run signal failed: {error}")
        raise HTTPException(status_code=500, detail="Signal run failed")
