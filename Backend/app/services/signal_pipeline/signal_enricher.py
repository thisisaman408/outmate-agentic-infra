"""
Signal Enricher — Enrich raw signals with company domain, prospect context, and ICP scoring.

Handles:
- Company domain resolution from prospect companies
- Prospect enrichment lookup
- Company firmographic data retrieval
"""

import logging
from typing import Dict, Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.company import Company
from app.db.models.prospect import Prospect
from app.db.models.signal_event import SignalEvent

logger = logging.getLogger(__name__)


class SignalEnricher:
    """Enrich signals with company and contact context."""

    def __init__(self, db: Session):
        self.db = db

    async def resolve_company_domain(
        self,
        company_domain: Optional[str] = None,
        company_name: Optional[str] = None,
        prospect_email: Optional[str] = None,
    ) -> Optional[str]:
        """
        Resolve company domain by various means.

        Priority:
        1. Provided domain (if valid)
        2. Prospect's current company domain (if prospect found by email)
        3. Company lookup by name

        Args:
            company_domain: Provided domain (may be empty)
            company_name: Company name (may be empty)
            prospect_email: Prospect email (try to resolve their company)

        Returns:
            Resolved domain or None
        """
        # Use provided domain if valid
        if company_domain and company_domain.strip():
            return company_domain

        # Try to resolve via prospect's company
        if prospect_email:
            try:
                prospect = self.db.query(Prospect).filter_by(email=prospect_email).first()
                if prospect and prospect.company_id:
                    company = self.db.query(Company).filter_by(id=prospect.company_id).first()
                    if company and company.domain:
                        logger.debug(
                            f"Resolved domain via prospect {prospect_email}: {company.domain}"
                        )
                        return company.domain
            except Exception as e:
                logger.debug(f"Failed to resolve domain via prospect: {e}")

        # Try to resolve by company name
        if company_name:
            try:
                company = (
                    self.db.query(Company)
                    .filter(Company.name.ilike(f"%{company_name}%"))
                    .first()
                )
                if company and company.domain:
                    logger.debug(f"Resolved domain by company name '{company_name}': {company.domain}")
                    return company.domain
            except Exception as e:
                logger.debug(f"Failed to resolve domain by company name: {e}")

        logger.debug("Could not resolve company domain")
        return None

    async def enrich_signal(
        self, signal: SignalEvent
    ) -> SignalEvent:
        """
        Enrich signal with additional data.

        Currently enriches:
        - Company domain resolution (if missing)
        - Company name lookup
        - Prospect context lookup

        Args:
            signal: SignalEvent to enrich (in-place modification)

        Returns:
            Enriched signal
        """
        try:
            # Resolve company domain if missing
            if not signal.company_domain:
                resolved_domain = await self.resolve_company_domain(
                    company_domain=signal.company_domain,
                    company_name=signal.company_name,
                    prospect_email=signal.prospect_email,
                )
                if resolved_domain:
                    signal.company_domain = resolved_domain
                    # Try to get company_id again if we resolved domain
                    company = self.db.query(Company).filter_by(domain=resolved_domain).first()
                    if company:
                        signal.company_id = company.id
                        if not signal.company_name:
                            signal.company_name = company.name

            # Load prospect context if prospect_id set
            if signal.prospect_id:
                try:
                    prospect = self.db.query(Prospect).filter_by(id=signal.prospect_id).first()
                    if prospect:
                        if not signal.prospect_name:
                            signal.prospect_name = prospect.full_name
                        if not signal.prospect_title:
                            signal.prospect_title = prospect.job_title
                except Exception as e:
                    logger.debug(f"Failed to load prospect context: {e}")

            # Load company context if company_id set
            if signal.company_id:
                try:
                    company = self.db.query(Company).filter_by(id=signal.company_id).first()
                    if company:
                        if not signal.company_name:
                            signal.company_name = company.name
                        if not signal.company_domain:
                            signal.company_domain = company.domain
                except Exception as e:
                    logger.debug(f"Failed to load company context: {e}")

            logger.debug(f"Enriched signal: {signal.id}")
            return signal
        except Exception as e:
            logger.error(f"Signal enrichment failed: {e}", exc_info=True)
            return signal

    async def get_company_data(self, company_id: UUID) -> Optional[Dict[str, Any]]:
        """Get company firmographic data for ICP scoring."""
        try:
            company = self.db.query(Company).filter_by(id=company_id).first()
            if not company:
                return None

            return {
                "id": str(company.id),
                "name": company.name,
                "domain": company.domain,
                "industry": company.industry,
                "employee_count_exact": company.employee_count_exact,
                "revenue_exact": company.revenue_exact,
                "founding_year": company.founded_year,
                "employee_growth_6m": company.employee_growth_6m,
                "employee_growth_12m": company.employee_growth_12m,
                "technologies": company.technologies or [],
                "categories": company.categories or [],
            }
        except Exception as e:
            logger.error(f"Failed to get company data: {e}")
            return None

    async def get_prospect_data(self, prospect_id: UUID) -> Optional[Dict[str, Any]]:
        """Get prospect profile data for ICP scoring."""
        try:
            prospect = self.db.query(Prospect).filter_by(id=prospect_id).first()
            if not prospect:
                return None

            return {
                "id": str(prospect.id),
                "name": prospect.full_name,
                "email": prospect.email,
                "job_title": prospect.job_title,
                "seniority": prospect.seniority_level,
                "department": prospect.department,
                "country": prospect.country,
                "state": prospect.state,
                "linkedin_url": prospect.linkedin_url,
            }
        except Exception as e:
            logger.error(f"Failed to get prospect data: {e}")
            return None
