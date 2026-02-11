"""
Company Filter Builder for CrustData CompanyDB API
Follows the same pattern as ProspectFilterBuilder for consistency
"""

from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class CompanyFilterBuilder:
    """
    Builds CrustData filter structures for company (CompanyDB) search
    
    Supports:
    - Multiple filter types (industry, location, market_segments, etc.)
    - Smart operator selection
    - Combined filters with AND logic
    - Easy extension for new filters
    
    Example:
        builder = CompanyFilterBuilder()
        
        # Single filter
        filters = builder.build(market_segments=["NASDAQ"])
        # Returns: {"filter_type": "markets", "type": "in", "value": ["NASDAQ"]}
        
        # Combined filters
        filters = builder.build(
            market_segments=["NASDAQ", "NYSE"],
            industries=["Software Development"]
        )
        # Returns: {"op": "and", "conditions": [...]}
    """
    
    def build(
        self,
        # Company Criteria (Firmographics)
        company_name: Optional[str] = None,
        website_domain: Optional[str] = None,
        industries: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        market_segments: Optional[List[str]] = None,  # NEW: Stock exchanges
        company_types: Optional[List[str]] = None,
        founded_year: Optional[Dict[str, int]] = None,  # {min: 2020, max: 2024}
        acquisition_status: Optional[str] = None,
        locations: Optional[List[str]] = None,
        largest_headcount_country: Optional[str] = None,
        
        # Financials & Funding
        revenue: Optional[Dict[str, float]] = None,  # {min: 1000000, max: 10000000}
        total_investment: Optional[float] = None,
        funding_rounds: Optional[List[str]] = None,
        last_funding_date: Optional[Dict[str, str]] = None,  # {operator: "=>", value: "2023-01-01"}
        investors: Optional[List[str]] = None,
        
        # Headcount & Growth
        employees: Optional[List[str]] = None,  # ["201-500", "501-1000"]
        employee_count_exact: Optional[Dict[str, int]] = None,  # {min: 100, max: 500}
        headcount_growth: Optional[Dict[str, float]] = None,  # {min: 10, max: 50} (percentage)
        growth_6m: Optional[Dict[str, int]] = None,  # Employee growth in 6 months
        growth_12m: Optional[Dict[str, int]] = None,  # Employee growth in 12 months
        
        # Signals & Activity
        job_opportunities: Optional[List[str]] = None,
        account_activities: Optional[List[str]] = None,
        news_keywords: Optional[str] = None,
        num_of_followers: Optional[str] = None,
        follower_growth_6m: Optional[Dict[str, int]] = None,
        
        # Social Content
        linkedin_topic: Optional[str] = None,
        mentioning_company: Optional[str] = None,
        mentioning_member: Optional[str] = None,
        content_type: Optional[str] = None,
        date_posted: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Build combined filter structure for CrustData CompanyDB API
        
        Returns:
            Filter structure for CrustData API:
            - Empty dict {} if no filters
            - Single filter dict for one filter
            - Combined dict {"op": "and", "conditions": [...]} for multiple
        """
        conditions = []
        
        # Build market_segments filter (PRIORITY FOR THIS TASK)
        if market_segments and len(market_segments) > 0:
            market_filter = self._build_market_segments_filter(market_segments)
            if market_filter:
                conditions.append(market_filter)
                logger.debug(f"Added market_segments filter: {len(market_segments)} segment(s)")
        
        # Build industry filter
        if industries and len(industries) > 0:
            industry_filter = self._build_industry_filter(industries)
            if industry_filter:
                conditions.append(industry_filter)
                logger.debug(f"Added industry filter: {len(industries)} industry(ies)")
        
        # Build location filter
        if locations and len(locations) > 0:
            location_filter = self._build_location_filter(locations)
            if location_filter:
                conditions.append(location_filter)
                logger.debug(f"Added location filter: {len(locations)} location(s)")
        
        # Build categories filter
        if categories and len(categories) > 0:
            category_filter = self._build_category_filter(categories)
            if category_filter:
                conditions.append(category_filter)
                logger.debug(f"Added category filter: {len(categories)} category(ies)")
        
        # Build company_types filter
        if company_types and len(company_types) > 0:
            type_filter = self._build_company_type_filter(company_types)
            if type_filter:
                conditions.append(type_filter)
                logger.debug(f"Added company_type filter: {len(company_types)} type(s)")
        
        # Build employees filter
        if employees and len(employees) > 0:
            emp_filter = self._build_employees_filter(employees)
            if emp_filter:
                conditions.append(emp_filter)
                logger.debug(f"Added employees filter: {employees}")
        
        # Add more filters as needed...
        # (Following the same pattern)
        
        # Return appropriate structure
        if len(conditions) == 0:
            logger.debug("No filters applied")
            return {}
        elif len(conditions) == 1:
            logger.debug("Single filter applied")
            return conditions[0]
        else:
            logger.debug(f"Multiple filters: {len(conditions)} conditions (AND logic)")
            return {
                "op": "and",
                "conditions": conditions
            }
    
    def _build_market_segments_filter(self, market_segments: List[str]) -> Dict[str, Any]:
        """
        Build market segments (stock exchange) filter
        
        Maps frontend 'market_segments' to CrustData 'markets' field.
        Supports stock exchange codes like NASDAQ, NYSE, PRIVATE, etc.
        
        Args:
            market_segments: List of stock exchange codes
                            e.g. ["NASDAQ", "NYSE", "PRIVATE"]
        
        Returns:
            Filter dictionary for CrustData API
            
        Example:
            >>> _build_market_segments_filter(["NASDAQ", "PRIVATE"])
            {
                "filter_type": "markets",
                "type": "in",
                "value": ["NASDAQ", "PRIVATE"]
            }
        """
        # Clean values (remove empty strings, ensure uppercase)
        cleaned_values = [v.strip().upper() for v in market_segments if v and v.strip()]
        
        if len(cleaned_values) == 0:
            logger.warning("Market segments filter values were empty")
            return {}
        
        if len(cleaned_values) == 1:
            # Single value: use exact match
            return {
                "filter_type": "markets",
                "type": "=",
                "value": cleaned_values[0]
            }
        else:
            # Multiple values: use IN operator
            return {
                "filter_type": "markets",
                "type": "in",
                "value": cleaned_values
            }
    
    def _build_industry_filter(self, industries: List[str]) -> Dict[str, Any]:
        """Build industry filter - uses linkedin_industries field"""
        if not industries:
            return {}
        
        return {
            "filter_type": "linkedin_industries",
            "type": "in",
            "value": industries
        }
    
    def _build_location_filter(self, locations: List[str]) -> Dict[str, Any]:
        """Build location filter - uses hq_location field"""
        if not locations:
            return {}
        
        # For multiple locations, use OR logic (any location matches)
        if len(locations) == 1:
            return {
                "filter_type": "hq_location",
                "type": "(.)",  # Fuzzy match
                "value": locations[0]
            }
        else:
            # Multiple locations - OR them together
            return {
                "op": "or",
                "conditions": [
                    {
                        "filter_type": "hq_location",
                        "type": "(.)",
                        "value": loc
                    }
                    for loc in locations
                ]
            }
    
    def _build_category_filter(self, categories: List[str]) -> Dict[str, Any]:
        """Build category filter - uses crunchbase_categories field"""
        if not categories:
            return {}
        
        return {
            "filter_type": "crunchbase_categories",
            "type": "in",
            "value": categories
        }
    
    def _build_company_type_filter(self, company_types: List[str]) -> Dict[str, Any]:
        """Build company type filter - uses company_type field"""
        if not company_types:
            return {}
        
        if len(company_types) == 1:
            return {
                "filter_type": "company_type",
                "type": "=",
                "value": company_types[0]
            }
        else:
            return {
                "filter_type": "company_type",
                "type": "in",
                "value": company_types
            }
    
    def _build_employees_filter(self, employees: List[str]) -> Dict[str, Any]:
        """Build employee count range filter"""
        if not employees:
            return {}
        
        return {
            "filter_type": "employee_count_range",
            "type": "in",
            "value": employees
        }
    
    # Add more filter builders as needed following the same pattern...
