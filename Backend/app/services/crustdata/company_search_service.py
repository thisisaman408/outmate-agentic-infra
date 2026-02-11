"""
Company search service using CrustData CompanyDB Search API
Similar pattern to ProspectSearchService for consistency
"""

import logging
from typing import List, Dict, Any, Optional

from app.services.crustdata.base_crustdata_client import (
    BaseCrustDataClient,
    CrustDataAPIError
)
from app.utils.company_filter_builder import CompanyFilterBuilder

logger = logging.getLogger(__name__)


class CompanySearchService:
    """
    High-level service for searching companies
    
    Features:
    - Combines multiple filters (market_segments, industry, location, etc.)
    - Handles pagination seamlessly
    - Validates input data
    - Provides detailed logging
    - Clear error messages
    
    Example:
        service = CompanySearchService(api_key="your_key")
        results = await service.search(
            market_segments=["NASDAQ", "NYSE"],
            industries=["Software Development"],
            limit=100
        )
    """
    
    # API endpoint for company search
    COMPANY_SEARCH_ENDPOINT = "/screener/companydb/search"
    
    # Validation limits
    MAX_ITEMS_PER_REQUEST = 50
    MIN_LIMIT = 1
    MAX_LIMIT = 1000
    
    def __init__(self, api_key: str):
        """Initialize the company search service"""
        self.client = BaseCrustDataClient(api_key)
        self.filter_builder = CompanyFilterBuilder()
        logger.info("CompanySearchService initialized")
    
    async def search(
        self,
        # Company Criteria
        company_name: Optional[str] = None,
        industries: Optional[List[str]] = None,
        categories: Optional[List[str]] = None,
        market_segments: Optional[List[str]] = None,  # NEW: Stock exchanges
        company_types: Optional[List[str]] = None,
        locations: Optional[List[str]] = None,
        
        # Financials
        employees: Optional[List[str]] = None,
        
        # ... add more as needed
        
        # Pagination
        limit: int = 100,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for companies with multiple filter support
        
        Args:
            market_segments: Stock exchange codes (e.g. ["NASDAQ", "NYSE", "PRIVATE"])
            industries: LinkedIn industry categories
            categories: Crunchbase categories
            company_types: Company type (Private, Public, Non-Profit)
            locations: Geographic locations
            employees: Employee count ranges
            limit: Results per page (1-1000)
            cursor: Pagination token
            
        Returns:
            Dictionary containing:
            - companies: List of matching company profiles
            - total_count: Total results available
            - next_cursor: Token for next page
            
        Raises:
            ValueError: Invalid input parameters
            CrustDataAPIError: API-related errors
        """
        # Validate inputs
        self._validate_inputs(
            market_segments=market_segments,
            industries=industries,
            categories=categories,
            company_types=company_types,
            locations=locations,
            employees=employees,
            limit=limit
        )
        
        # Build filters
        filters = self.filter_builder.build(
            company_name=company_name,
            industries=industries,
            categories=categories,
            market_segments=market_segments,
            company_types=company_types,
            locations=locations,
            employees=employees
        )
        
        # Validate at least one filter
        if not filters or len(filters) == 0:
            raise ValueError(
                "At least one filter is required to perform a search. "
                "Please provide market_segments, industry, location, or other filters."
            )
        
        # Prepare API request payload
        payload = {
            "filters": filters,
            "limit": limit
        }
        
        if cursor:
            payload["cursor"] = cursor
        
        # Log search initiation
        active_filters = [
            f"market_segments({len(market_segments)})" if market_segments else None,
            f"industries({len(industries)})" if industries else None,
            f"categories({len(categories)})" if categories else None,
            f"company_types({len(company_types)})" if company_types else None,
            f"locations({len(locations)})" if locations else None,
            f"employees({len(employees)})" if employees else None,
        ]
        active_filters = [f for f in active_filters if f]
        
        logger.info(
            "Initiating company search",
            extra={
                "filters": ", ".join(active_filters) if active_filters else "none",
                "limit": limit,
                "has_cursor": bool(cursor)
            }
        )
        
        # Make API call
        try:
            result = await self.client._make_request(
                endpoint=self.COMPANY_SEARCH_ENDPOINT,
                payload=payload
            )
        except CrustDataAPIError as e:
            logger.error(
                f"Company search failed: {e.message}",
                extra={"status_code": e.status_code}
            )
            raise
        
        # Log success
        companies_count = len(result.get("companies", []))
        total_available = result.get("total_count", 0)
        has_more = bool(result.get("next_cursor"))
        
        logger.info(
            "Company search completed successfully",
            extra={
                "companies_returned": companies_count,
                "total_available": total_available,
                "has_more_pages": has_more
            }
        )
        
        return result
    
    def _validate_inputs(
        self,
        market_segments: Optional[List[str]],
        industries: Optional[List[str]],
        categories: Optional[List[str]],
        company_types: Optional[List[str]],
        locations: Optional[List[str]],
        employees: Optional[List[str]],
        limit: int
    ):
        """Validate all search inputs"""
        
        # Validate market_segments
        if market_segments is not None:
            if not isinstance(market_segments, list):
                raise ValueError("market_segments must be a list")
            
            if len(market_segments) > self.MAX_ITEMS_PER_REQUEST:
                raise ValueError(
                    f"Maximum {self.MAX_ITEMS_PER_REQUEST} market segments allowed per search. "
                    f"Received {len(market_segments)} segments."
                )
            
            # Check for empty strings
            if any(not isinstance(s, str) or not s.strip() for s in market_segments):
                raise ValueError("All market segment values must be non-empty strings")
        
        # Validate industries
        if industries is not None:
            if not isinstance(industries, list):
                raise ValueError("industries must be a list")
            
            if len(industries) > self.MAX_ITEMS_PER_REQUEST:
                raise ValueError(f"Maximum {self.MAX_ITEMS_PER_REQUEST} industries allowed per search")
        
        # Validate limit
        if not isinstance(limit, int):
            raise ValueError("limit must be an integer")
        
        if not self.MIN_LIMIT <= limit <= self.MAX_LIMIT:
            raise ValueError(
                f"limit must be between {self.MIN_LIMIT} and {self.MAX_LIMIT}. "
                f"Received {limit}."
            )
        
        logger.debug("Input validation passed")
