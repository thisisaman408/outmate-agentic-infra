"""
ICP Signal Scorer — Score signals against user's Ideal Customer Profile.

Matches signal properties against user's ICP criteria to determine relevance.
"""

import logging
from typing import Dict, Any, Tuple, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class ICPSignalScorer:
    """Score signals against user's ICP criteria."""

    def __init__(self, db: Session):
        self.db = db

    async def score_signal(
        self,
        user_id: UUID,
        signal_type: str,
        company_data: Optional[Dict[str, Any]] = None,
        prospect_data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[int, List[str]]:
        """
        Score signal against user's ICP (0-100).

        Args:
            user_id: User ID (for ICP lookup)
            signal_type: Type of signal
            company_data: Company firmographic data
            prospect_data: Prospect profile data

        Returns:
            Tuple of (score: 0-100, matching_factors: ["factor1", ...])
        """
        score = 0
        factors = []

        try:
            # Get user's ICP preferences
            icp_criteria = await self._get_user_icp_criteria(user_id)

            if not icp_criteria:
                # Default: moderate score if no ICP set
                logger.debug(f"No ICP criteria found for user {user_id}")
                return 50, ["default_score"]

            # Score company data
            if company_data:
                company_score, company_factors = await self._score_company(
                    company_data, icp_criteria
                )
                score += company_score * 0.6  # 60% weight to company
                factors.extend(company_factors)

            # Score prospect data
            if prospect_data:
                prospect_score, prospect_factors = await self._score_prospect(
                    prospect_data, icp_criteria
                )
                score += prospect_score * 0.4  # 40% weight to prospect
                factors.extend(prospect_factors)

            # Boost score for high-value signal types
            signal_boost = self._get_signal_type_boost(signal_type)
            score = score + (signal_boost * 5)  # Add points based on signal type

            # Cap at 100
            score = min(100, max(0, int(score)))

            logger.debug(f"Scored signal: type={signal_type}, score={score}, factors={factors}")
            return score, factors
        except Exception as e:
            logger.error(f"Failed to score signal: {e}", exc_info=True)
            return 50, ["scoring_error"]

    async def _get_user_icp_criteria(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get user's ICP criteria from User.icp_config."""
        try:
            from app.db.models.user import User

            user = self.db.query(User).filter_by(id=user_id).first()
            if user and user.icp_config and user.icp_config.get("version"):
                return user.icp_config
            return None
        except Exception as e:
            logger.debug(f"Failed to load ICP criteria for user {user_id}: {e}")
            return None

    async def _score_company(
        self,
        company_data: Dict[str, Any],
        icp_criteria: Dict[str, Any],
    ) -> Tuple[int, List[str]]:
        """Score company data (0-100) against ICP criteria."""
        score = 30  # Base score
        factors = []

        try:
            # Industry match (20 pts)
            icp_industries = [i.lower() for i in icp_criteria.get("industries", [])]
            company_industry = (company_data.get("industry") or "").lower()
            if icp_industries and company_industry:
                if company_industry in icp_industries or any(
                    ind in company_industry for ind in icp_industries
                ):
                    score += 20
                    factors.append("industry_match")

            # Company size match (15 pts)
            icp_sizes = icp_criteria.get("company_sizes", [])
            employee_count = company_data.get("employee_count", 0)
            if icp_sizes and employee_count:
                size_bucket = self._employee_count_to_bucket(employee_count)
                if size_bucket in icp_sizes:
                    score += 15
                    factors.append("company_size_match")

            # Funding stage match (15 pts)
            icp_funding = [f.lower() for f in icp_criteria.get("funding_stages", [])]
            company_funding = (company_data.get("funding_stage") or "").lower()
            if icp_funding and company_funding:
                if company_funding in icp_funding or any(
                    f in company_funding for f in icp_funding
                ):
                    score += 15
                    factors.append("funding_stage_match")
            elif icp_funding and company_data.get("funding_total", 0) > 0:
                score += 5
                factors.append("has_funding")

            # Geography match (10 pts)
            icp_geos = [g.lower() for g in icp_criteria.get("geographies", [])]
            company_country = (company_data.get("country") or company_data.get("location", "")).lower()
            if icp_geos and company_country:
                if any(geo in company_country for geo in icp_geos):
                    score += 10
                    factors.append("geography_match")

            # Bonus: hiring activity
            if company_data.get("employee_growth_6m", 0) > 0:
                score += 5
                factors.append("hiring_activity")

            # Bonus: technology stack
            if company_data.get("technologies"):
                score += 5
                factors.append("has_technologies")

            return min(100, score), factors
        except Exception as e:
            logger.debug(f"Failed to score company: {e}")
            return 30, []

    @staticmethod
    def _employee_count_to_bucket(count: int) -> str:
        """Convert employee count to ICP size bucket string."""
        if count <= 10:
            return "1-10"
        elif count <= 50:
            return "11-50"
        elif count <= 200:
            return "51-200"
        elif count <= 500:
            return "201-500"
        elif count <= 1000:
            return "501-1000"
        elif count <= 5000:
            return "1001-5000"
        elif count <= 10000:
            return "5001-10000"
        else:
            return "10000+"

    async def _score_prospect(
        self,
        prospect_data: Dict[str, Any],
        icp_criteria: Dict[str, Any],
    ) -> Tuple[int, List[str]]:
        """Score prospect data (0-100) against ICP criteria."""
        score = 30  # Base score
        factors = []

        try:
            # Job title match (25 pts)
            icp_titles = [t.lower() for t in icp_criteria.get("job_titles", [])]
            prospect_title = (prospect_data.get("title") or "").lower()
            if icp_titles and prospect_title:
                if any(t in prospect_title for t in icp_titles):
                    score += 25
                    factors.append("title_match")
                elif any(prospect_title in t for t in icp_titles):
                    score += 15
                    factors.append("partial_title_match")

            # Geography match (15 pts)
            icp_geos = [g.lower() for g in icp_criteria.get("geographies", [])]
            prospect_location = (prospect_data.get("location") or prospect_data.get("country") or "").lower()
            if icp_geos and prospect_location:
                if any(geo in prospect_location for geo in icp_geos):
                    score += 15
                    factors.append("geography_match")

            # Seniority bonus (10 pts)
            seniority = prospect_data.get("seniority")
            if seniority in ["C-Level", "VP", "Director"]:
                score += 10
                factors.append("high_seniority")
            elif seniority in ["Manager"]:
                score += 5
                factors.append("mid_level")

            # LinkedIn presence (5 pts)
            if prospect_data.get("linkedin_url"):
                score += 5
                factors.append("has_linkedin")

            return min(100, score), factors
        except Exception as e:
            logger.debug(f"Failed to score prospect: {e}")
            return 30, []

    def _get_signal_type_boost(self, signal_type: str) -> int:
        """Get score boost based on signal type (higher = more valuable)."""
        boosts = {
            "funding": 5,        # Funding rounds are high-value
            "hiring": 3,         # Hiring is good indicator
            "job_change": 2,     # Job changes are relevant
            "g2_intent": 4,      # G2 intent is high-value
            "email_open": 1,     # Low value (controlled by us)
            "website_visit": 1,  # Low value (controlled by us)
            "linkedin_activity": 1,  # Low value
        }
        return boosts.get(signal_type, 0)
