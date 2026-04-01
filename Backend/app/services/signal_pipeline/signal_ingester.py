"""
Signal Ingester — Converts raw signal events into database SignalEvent records.

Handles:
- Parsing raw signal data from various sources
- Creating SignalEvent model instances
- Persisting to database
"""

import hashlib
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.signal_event import SignalEvent
from app.db.models.company import Company
from app.db.models.prospect import Prospect

logger = logging.getLogger(__name__)

# Credit costs per signal type
SIGNAL_CREDIT_COSTS = {
    "job_change": 2,
    "funding": 3,
    "hiring": 2,
    "g2_intent": 4,
    "website_visit": 1,
    "email_open": 1,
    "linkedin_activity": 2,
}


def generate_signal_fingerprint(
    source: str,
    signal_type: str,
    company_domain: Optional[str],
    prospect_email: Optional[str],
    key_fields: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate MD5 fingerprint for deduplication.

    Prevents same signal from appearing multiple times within 24hr window.
    """
    parts = [source, signal_type, company_domain or "", prospect_email or ""]

    if key_fields:
        parts.append(json.dumps(key_fields, sort_keys=True))

    fingerprint_str = "|".join(parts)
    return hashlib.md5(fingerprint_str.encode()).hexdigest()


class SignalIngester:
    """Ingest raw signals into database."""

    def __init__(self, db: Session):
        self.db = db

    async def ingest_signal(
        self,
        signal_type: str,
        source: str,
        company_domain: Optional[str] = None,
        company_name: Optional[str] = None,
        prospect_email: Optional[str] = None,
        prospect_name: Optional[str] = None,
        prospect_title: Optional[str] = None,
        raw_data: Optional[Dict[str, Any]] = None,
        discovered_at: Optional[datetime] = None,
        key_fields_for_fingerprint: Optional[Dict[str, Any]] = None,
    ) -> Optional[SignalEvent]:
        """
        Ingest a raw signal and create database record.

        Args:
            signal_type: Type of signal
            source: Data source (crustdata, explorium, rss, etc.)
            company_domain: Resolved company domain (if available)
            company_name: Company name
            prospect_email: Prospect email
            prospect_name: Prospect name
            prospect_title: Prospect title
            raw_data: Original API response or event
            discovered_at: When signal actually occurred
            key_fields_for_fingerprint: Fields for unique fingerprint

        Returns:
            SignalEvent instance if created, None if failed
        """
        try:
            # Generate fingerprint for dedup
            fingerprint = generate_signal_fingerprint(
                source=source,
                signal_type=signal_type,
                company_domain=company_domain,
                prospect_email=prospect_email,
                key_fields=key_fields_for_fingerprint,
            )

            # Resolve company_id (if domain provided)
            company_id = None
            if company_domain:
                company = self.db.query(Company).filter_by(domain=company_domain).first()
                if company:
                    company_id = company.id

            # Resolve prospect_id (if email provided)
            prospect_id = None
            if prospect_email:
                prospect = self.db.query(Prospect).filter_by(email=prospect_email).first()
                if prospect:
                    prospect_id = prospect.id

            # Calculate credit cost
            credits_consumed = SIGNAL_CREDIT_COSTS.get(signal_type, 2)

            # Create signal event
            signal_event = SignalEvent(
                signal_type=signal_type,
                source=source,
                company_id=company_id,
                company_domain=company_domain,
                company_name=company_name,
                prospect_id=prospect_id,
                prospect_email=prospect_email,
                prospect_name=prospect_name,
                prospect_title=prospect_title,
                raw_data=raw_data or {},
                fingerprint=fingerprint,
                credits_consumed=credits_consumed,
                discovered_at=discovered_at or datetime.utcnow(),
            )

            self.db.add(signal_event)
            self.db.commit()

            logger.info(
                f"Ingested signal: type={signal_type}, source={source}, "
                f"domain={company_domain}, fingerprint={fingerprint}, id={signal_event.id}"
            )

            return signal_event
        except Exception as e:
            logger.error(f"Failed to ingest signal: {e}", exc_info=True)
            self.db.rollback()
            return None

    async def bulk_ingest_signals(self, signals: list[Dict[str, Any]]) -> list[SignalEvent]:
        """
        Ingest multiple signals (batch).

        Args:
            signals: List of signal dicts with ingestion parameters

        Returns:
            List of created SignalEvent instances
        """
        created_signals = []
        for signal_data in signals:
            signal = await self.ingest_signal(**signal_data)
            if signal:
                created_signals.append(signal)

        return created_signals
