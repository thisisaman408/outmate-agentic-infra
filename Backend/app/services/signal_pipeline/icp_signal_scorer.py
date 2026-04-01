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
        """Get user's ICP criteria from copilot_user_preferences (if exists)."""
        try:
            # Try to import and query copilot preferences
            # This is optional - if copilot not set up yet, return None
            from app.db.models.copilot_preferences import CopilotUserPreferences

            prefs = (
                self.db.query(CopilotUserPreferences)
                .filter_by(user_id=user_id)
                .first()
            )

            if prefs:
                return {
                    # Add ICP fields as stored in preferences
                    # For now, return a simple structure
                    "exists": True,
                }
            return None
        except Exception:
            # Copilot model may not exist yet
            return None

    async def _score_company(
        self,
        company_data: Dict[str, Any],
        icp_criteria: Dict[str, Any],
    ) -> Tuple[int, List[str]]:
        """Score company data (0-100)."""
        score = 50  # Base score
        factors = []

        try:
            # Industry match (bonus)
            if "industry" in company_data:
                score += 10
                factors.append("has_industry")

            # Employee count (hiring signal)
            if company_data.get("employee_growth_6m", 0) > 0:
                score += 15
                factors.append("hiring_activity")

            # Revenue (buying power)
            if company_data.get("revenue_exact", 0) > 10_000_000:
                score += 10
                factors.append("high_revenue")

            # Technology stack (technical fit)
            if company_data.get("technologies"):
                score += 5
                factors.append("has_technologies")

            # Funding (growth signal)
            funding = company_data.get("funding_total")
            if funding and funding > 0:
                score += 10
                factors.append("has_funding")

            return min(100, score), factors
        except Exception as e:
            logger.debug(f"Failed to score company: {e}")
            return 50, []

    async def _score_prospect(
        self,
        prospect_data: Dict[str, Any],
        icp_criteria: Dict[str, Any],
    ) -> Tuple[int, List[str]]:
        """Score prospect data (0-100)."""
        score = 50  # Base score
        factors = []

        try:
            # Seniority (decision-maker)
            seniority = prospect_data.get("seniority")
            if seniority in ["C-Level", "VP", "Director"]:
                score += 20
                factors.append("high_seniority")
            elif seniority in ["Manager"]:
                score += 10
                factors.append("mid_level")

            # Department (functional fit)
            department = prospect_data.get("department")
            if department in ["Sales", "Marketing", "Operations", "Executive"]:
                score += 10
                factors.append("sales_aligned_department")

            # LinkedIn presence (engagement signal)
            if prospect_data.get("linkedin_url"):
                score += 5
                factors.append("has_linkedin")

            return min(100, score), factors
        except Exception as e:
            logger.debug(f"Failed to score prospect: {e}")
            return 50, []

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
