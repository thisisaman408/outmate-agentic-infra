"""
Signal Source Integrations

Examples of how to ingest signals from various sources:
- CrustData (job changes, company enrichment)
- Explorium (funding, hiring, business signals)
- RSS feeds (news, company updates)
- Email opens & clicks (campaign activity)
- LinkedIn activity (post detection)
- G2 intent signals
- Website visitors
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.services.signal_pipeline import SignalEventBus, SignalIngester
from app.services.signal_pipeline.signal_event_bus import SignalEventPayload

logger = logging.getLogger(__name__)


class SignalSourceIntegrations:
    """
    Collection of signal source integrations.

    Each method represents a way to ingest signals from a specific data source.
    """

    def __init__(self):
        self.event_bus = SignalEventBus()

    # ─────────────────────────────────────────────────────────────
    # Job Change Signals (CrustData)
    # ─────────────────────────────────────────────────────────────

    async def ingest_job_change_from_crustdata(
        self,
        prospect_email: str,
        prospect_name: str,
        old_company: str,
        new_company: str,
        new_company_domain: Optional[str] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest job change signal from CrustData.

        Triggered when CrustData detects a prospect has changed jobs.
        """
        payload = SignalEventPayload(
            signal_type="job_change",
            source="crustdata",
            company_domain=new_company_domain or new_company.lower().replace(" ", ""),
            company_name=new_company,
            prospect_email=prospect_email,
            prospect_name=prospect_name,
            raw_data={
                "old_company": old_company,
                "new_company": new_company,
                "raw_crustdata": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"Job change signal published: {prospect_name} → {new_company}")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # Funding Signals (Explorium / Crunchbase RSS)
    # ─────────────────────────────────────────────────────────────

    async def ingest_funding_from_explorium(
        self,
        company_name: str,
        company_domain: Optional[str] = None,
        funding_amount: Optional[float] = None,
        funding_round: Optional[str] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest funding signal from Explorium.

        Triggered when company raises a funding round.
        """
        payload = SignalEventPayload(
            signal_type="funding",
            source="explorium",
            company_domain=company_domain,
            company_name=company_name,
            raw_data={
                "funding_amount": funding_amount,
                "funding_round": funding_round,
                "raw_explorium": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"Funding signal published: {company_name} ({funding_round})")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # Hiring Signals (LinkedIn / CrustData)
    # ─────────────────────────────────────────────────────────────

    async def ingest_hiring_from_linkedin(
        self,
        company_name: str,
        company_domain: Optional[str] = None,
        open_positions: int = 0,
        departments: Optional[List[str]] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest hiring signal from LinkedIn job posts.

        Triggered when company posts new job openings.
        """
        payload = SignalEventPayload(
            signal_type="hiring",
            source="linkedin",
            company_domain=company_domain,
            company_name=company_name,
            raw_data={
                "open_positions": open_positions,
                "departments": departments or [],
                "raw_linkedin": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"Hiring signal published: {company_name} ({open_positions} positions)")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # Email Open Signals (Campaign Tracking)
    # ─────────────────────────────────────────────────────────────

    async def ingest_email_open(
        self,
        prospect_email: str,
        prospect_name: Optional[str] = None,
        company_domain: Optional[str] = None,
        company_name: Optional[str] = None,
        campaign_id: Optional[str] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest email open signal from campaign tracking.

        Triggered when prospect opens a sent email.
        """
        payload = SignalEventPayload(
            signal_type="email_open",
            source="campaign",
            company_domain=company_domain,
            company_name=company_name,
            prospect_email=prospect_email,
            prospect_name=prospect_name,
            raw_data={
                "campaign_id": campaign_id,
                "raw_campaign_data": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"Email open signal: {prospect_email}")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # LinkedIn Activity Signals
    # ─────────────────────────────────────────────────────────────

    async def ingest_linkedin_activity(
        self,
        prospect_name: Optional[str] = None,
        prospect_email: Optional[str] = None,
        company_domain: Optional[str] = None,
        company_name: Optional[str] = None,
        activity_type: str = "post",  # post | engagement | connection
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest LinkedIn activity signal.

        Triggered when prospect posts, engages, or connects on LinkedIn.
        """
        payload = SignalEventPayload(
            signal_type="linkedin_activity",
            source="linkedin",
            company_domain=company_domain,
            company_name=company_name,
            prospect_email=prospect_email,
            prospect_name=prospect_name,
            raw_data={
                "activity_type": activity_type,
                "raw_linkedin": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"LinkedIn activity signal: {prospect_name} ({activity_type})")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # G2 Intent Signals
    # ─────────────────────────────────────────────────────────────

    async def ingest_g2_intent(
        self,
        company_name: str,
        company_domain: Optional[str] = None,
        product_category: Optional[str] = None,
        intent_indicators: Optional[List[str]] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest G2 intent signal.

        Triggered when company appears to be evaluating products in a category.
        """
        payload = SignalEventPayload(
            signal_type="g2_intent",
            source="g2",
            company_domain=company_domain,
            company_name=company_name,
            raw_data={
                "product_category": product_category,
                "intent_indicators": intent_indicators or [],
                "raw_g2": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"G2 intent signal: {company_name} ({product_category})")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # Website Visitor Signals
    # ─────────────────────────────────────────────────────────────

    async def ingest_website_visit(
        self,
        company_domain: str,
        company_name: Optional[str] = None,
        visitor_email: Optional[str] = None,
        visitor_name: Optional[str] = None,
        pages_visited: Optional[List[str]] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest website visitor signal.

        Triggered when anonymous visitor is enriched to known company/person.
        """
        payload = SignalEventPayload(
            signal_type="website_visit",
            source="visitor",
            company_domain=company_domain,
            company_name=company_name,
            prospect_email=visitor_email,
            prospect_name=visitor_name,
            raw_data={
                "pages_visited": pages_visited or [],
                "raw_visitor_data": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"Website visit signal: {company_domain}")
        return stream_id

    # ─────────────────────────────────────────────────────────────
    # RSS Feed Signals (News, announcements, etc.)
    # ─────────────────────────────────────────────────────────────

    async def ingest_rss_signal(
        self,
        company_name: str,
        company_domain: Optional[str] = None,
        signal_type: str = "funding",  # Can be funding, hiring, news, etc.
        title: Optional[str] = None,
        url: Optional[str] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Ingest RSS feed signal.

        Triggered when company news/announcements are detected via RSS.
        """
        payload = SignalEventPayload(
            signal_type=signal_type if signal_type in [
                "job_change", "funding", "hiring", "g2_intent", "website_visit", "email_open", "linkedin_activity"
            ] else "funding",
            source="rss",
            company_domain=company_domain,
            company_name=company_name,
            raw_data={
                "title": title,
                "url": url,
                "original_signal_type": signal_type,
                "raw_rss": raw_data or {},
            },
            discovered_at=datetime.utcnow(),
        )

        stream_id = await self.event_bus.publish_signal(payload)
        logger.info(f"RSS signal published: {company_name} - {title}")
        return stream_id


# ─────────────────────────────────────────────────────────────
# Example Usage
# ─────────────────────────────────────────────────────────────

async def example_ingest_multiple_signals():
    """Example of ingesting signals from multiple sources."""
    integrations = SignalSourceIntegrations()

    # Job change from CrustData
    await integrations.ingest_job_change_from_crustdata(
        prospect_email="jane@newcompany.com",
        prospect_name="Jane Doe",
        old_company="Old Corp Inc",
        new_company="New Corp Inc",
        new_company_domain="newcorp.com",
    )

    # Funding from Explorium
    await integrations.ingest_funding_from_explorium(
        company_name="TechStartup Inc",
        company_domain="techstartup.com",
        funding_amount=5_000_000,
        funding_round="Series A",
    )

    # Hiring from LinkedIn
    await integrations.ingest_hiring_from_linkedin(
        company_name="GrowthCo",
        company_domain="growthco.com",
        open_positions=12,
        departments=["Sales", "Engineering", "Product"],
    )

    # Email open from campaign
    await integrations.ingest_email_open(
        prospect_email="john@techcompany.com",
        prospect_name="John Smith",
        company_domain="techcompany.com",
        company_name="Tech Company",
        campaign_id="camp_123",
    )

    logger.info("Example signals ingested successfully")
