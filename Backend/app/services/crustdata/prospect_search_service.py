"""
Prospect search service using CrustData People Search API
Supports multiple filters that can work together

This service layer:
- Orchestrates the CrustData client and filter builder
- Validates inputs before making API calls
- Handles pagination
- Provides logging and monitoring hooks
- Maintains separation of concerns
"""

import logging
from typing import List, Dict, Any, Optional

from app.services.crustdata.base_crustdata_client import (
    BaseCrustDataClient,
    CrustDataAPIError
)
from app.utils.filter_builder import ProspectFilterBuilder

logger = logging.getLogger(__name__)


class ProspectSearchService:
    """
    High-level service for searching prospects
    
    This service provides a clean interface for prospect search operations.
    It handles the complexity of filter building, API communication, and
    error handling, presenting a simple interface to the API layer.
    
    Features:
    - Combines multiple filters (current_title, past_title, location, industry)
    - Handles pagination seamlessly
    - Validates input data
    - Provides detailed logging
    - Clear error messages
    
    Example:
        service = ProspectSearchService(api_key="your_key")
        results = await service.search(
            current_titles=["CEO", "CTO"],
            limit=100
        )
        # Returns: {"profiles": [...], "total_count": ..., "next_cursor": ...}
    """
    
    # API endpoint for people search
    PEOPLE_SEARCH_ENDPOINT = "/screener/persondb/search"
    
    # Validation limits
    MAX_TITLES_PER_REQUEST = 50
    MAX_LOCATIONS_PER_REQUEST = 20
    MAX_INDUSTRIES_PER_REQUEST = 20
    MIN_LIMIT = 1
    MAX_LIMIT = 1000
    
    def __init__(self, api_key: str):
        """
        Initialize the prospect search service
        
        Args:
            api_key: CrustData API authentication key
            
        Raises:
            ValueError: If api_key is empty or invalid
        """
        self.client = BaseCrustDataClient(api_key)
        self.filter_builder = ProspectFilterBuilder()
        logger.info("ProspectSearchService initialized")
    
    async def search(
        self,
        # Current filters (actively used)
        current_titles: Optional[List[str]] = None,
        
        # Future filters (ready for implementation)
        past_titles: Optional[List[str]] = None,
        functions: Optional[List[str]] = None,
        seniority_levels: Optional[List[str]] = None,
        seniority_operator: str = "in",
        locations: Optional[List[str]] = None,
        industries: Optional[List[str]] = None,
        keyword: Optional[str] = None,
        
        # NEW: Name filters (Location & Demographics)
        name: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        
        # NEW: Profile Language filter
        profile_languages: Optional[List[str]] = None,

        # NEW: Company filter
        company: Optional[str] = None,
        domain: Optional[str] = None,
        
        # NEW: Employees filter
        employees: Optional[List[str]] = None,
        
        # Pagination
        limit: int = 100,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search for prospects with multiple filter support
        
        This method is the main entry point for prospect searches. It:
        1. Validates all inputs
        2. Builds appropriate filters
        3. Makes the API call
        4. Returns results with pagination info
        
        Args:
            current_titles: List of job titles to search (current position)
            past_titles: List of previous job titles (for future use)
            functions: List of job functions/departments (e.g. Engineering, Sales)
            seniority_levels: List of seniority levels (e.g. CXO, Vice President)
            seniority_operator: 'in' (include) or 'not_in' (exclude) for seniority filter
            locations: List of geographic locations (for future use)
            industries: List of industry categories (for future use)
            keyword: Single keyword to search in company-related fields (skills, titles, descriptions)
            limit: Number of results to return (1-1000)
            cursor: Pagination token from previous response
            
        Returns:
            Dictionary containing:
            - profiles: List of matching prospect profiles
            - total_count: Total number of results available
            - next_cursor: Token for next page (None if last page)
            - query: Echo of the query (optional)
            
        Raises:
            ValueError: For invalid input parameters
            CrustDataAPIError: For API-related errors
            
        Example:
            results = await service.search(
                current_titles=["CEO", "Chief Technology Officer"],
                limit=50
            )
            print(f"Found {results['total_count']} prospects")
            print(f"Returned {len(results['profiles'])} profiles")
        """
        # Step 1: Validate all inputs
        self._validate_inputs(
            current_titles=current_titles,
            past_titles=past_titles,
            functions=functions,
            seniority_levels=seniority_levels,
            seniority_operator=seniority_operator,
            locations=locations,
            industries=industries,
            keyword=keyword,
            limit=limit
        )
        
        # Step 2: Build filters using extensible filter builder
        filters = self.filter_builder.build(
            current_titles=current_titles,
            past_titles=past_titles,
            functions=functions,
            seniority_levels=seniority_levels,
            seniority_operator=seniority_operator,
            locations=locations,
            industries=industries,
            keyword=keyword,
            # NEW: Name filters
            name=name,
            first_name=first_name,
            last_name=last_name,
            # NEW: Profile Language filter
            profile_languages=profile_languages,
            # NEW: Company filter
            company=company,
            domain=domain,
            # NEW: Employees filter
            employees=employees
        )
        
        # Step 2.5: Validate that at least one filter is provided
        if not filters or len(filters) == 0:
            raise ValueError(
                "At least one filter is required to perform a search. "
                "Please provide current_title, past_title, function, seniority_level, location, industry, keyword, name, or profile_languages."
            )
        
        # Step 2.6: Determine which API endpoint to use
        # KEYWORD filter ONLY works with Realtime API, not In-DB API
        # Use Realtime API if keyword is present, otherwise use faster In-DB API
        if keyword and keyword.strip():
            api_endpoint = "/screener/person/search"  # Realtime API (supports KEYWORD)
            logger.info("Using Realtime API due to keyword filter")
        else:
            api_endpoint = self.PEOPLE_SEARCH_ENDPOINT  # In-DB API (faster, cheaper)
        
        # Step 3: Prepare API request payload
        payload = {
            "limit": limit
        }
        
        # Only add filters if they exist (empty dict means no filtering)
        if filters:
            # Realtime API expects filters as ARRAY, In-DB API expects object
            if keyword and keyword.strip():
                # Using Realtime API - filters must be array
                if isinstance(filters, list):
                    payload["filters"] = filters
                elif isinstance(filters, dict) and len(filters) > 0:
                    # Single filter object - wrap in array
                    payload["filters"] = [filters]
                logger.debug(f"Realtime API payload filters (array): {payload.get('filters')}")
            else:
                # Using In-DB API - filters can be object or array with op/conditions
                payload["filters"] = filters
                logger.debug(f"In-DB API payload filters (object): {payload.get('filters')}")
        
        # Add pagination cursor if provided
        if cursor:
            payload["cursor"] = cursor
        
        # Step 4: Log search initiation
        active_filters = [
            f"current_titles({len(current_titles)})" if current_titles else None,
            f"past_titles({len(past_titles)})" if past_titles else None,
            f"functions({len(functions)})" if functions else None,
            f"seniority_levels({len(seniority_levels)})" if seniority_levels else None,
            f"locations({len(locations)})" if locations else None,
            f"industries({len(industries)})" if industries else None,
            f"keyword('{keyword}')" if keyword else None,
        ]
        active_filters = [f for f in active_filters if f]
        
        logger.info(
            "Initiating prospect search",
            extra={
                "filters": ", ".join(active_filters) if active_filters else "none",
                "limit": limit,
                "has_cursor": bool(cursor),
                "api_endpoint": api_endpoint,
                "filter_structure": "combined" if isinstance(filters, dict) and "conditions" in filters else "single"
            }
        )
        
        # Step 5: Make API call via base client
        try:
            result = await self.client._make_request(
                endpoint=api_endpoint,
                payload=payload
            )
        except CrustDataAPIError as e:
            # Re-raise with additional context
            logger.error(
                f"Prospect search failed: {e.message}",
                extra={"status_code": e.status_code}
            )
            raise
        
        # Step 6: Log successful completion
        profiles_count = len(result.get("profiles", []))
        total_available = result.get("total_count", 0)
        has_more = bool(result.get("next_cursor"))
        
        logger.info(
            "Prospect search completed successfully",
            extra={
                "profiles_returned": profiles_count,
                "total_available": total_available,
                "has_more_pages": has_more,
                "completion_percentage": round((profiles_count / total_available * 100), 2) if total_available > 0 else 100
            }
        )
        
        return result
    
    def _validate_inputs(
        self,
        current_titles: Optional[List[str]],
        past_titles: Optional[List[str]],
        functions: Optional[List[str]],
        seniority_levels: Optional[List[str]],
        seniority_operator: str,
        locations: Optional[List[str]],
        industries: Optional[List[str]],
        keyword: Optional[str],
        limit: int
    ):
        """
        Validate all search inputs
        
        Performs comprehensive validation to catch errors early,
        before making expensive API calls.
        
        Args:
            current_titles: Title list to validate
            past_titles: Past title list to validate
            functions: Functions list to validate
            seniority_levels: Seniority levels list to validate
            seniority_operator: Operator for seniority filter
            locations: Location list to validate
            industries: Industry list to validate
            keyword: Keyword string to validate
            limit: Limit value to validate
            
        Raises:
            ValueError: For any validation failures with clear message
        """
        # Validate current_titles
        if current_titles is not None:
            if not isinstance(current_titles, list):
                raise ValueError("current_titles must be a list")
            
            if len(current_titles) > self.MAX_TITLES_PER_REQUEST:
                raise ValueError(
                    f"Maximum {self.MAX_TITLES_PER_REQUEST} titles allowed per search. "
                    f"Received {len(current_titles)} titles."
                )
            
            # Check for empty or invalid strings
            if any(not isinstance(t, str) or not t.strip() for t in current_titles):
                raise ValueError("All titles must be non-empty strings")
        
        # Validate past_titles
        if past_titles is not None:
            if not isinstance(past_titles, list):
                raise ValueError("past_titles must be a list")
            
            if len(past_titles) > self.MAX_TITLES_PER_REQUEST:
                raise ValueError(
                    f"Maximum {self.MAX_TITLES_PER_REQUEST} past titles allowed per search"
                )
        
        # Validate functions
        if functions is not None:
            if not isinstance(functions, list):
                raise ValueError("functions must be a list")
            
            if len(functions) > 20:  # Reasonable limit for functions
                raise ValueError(
                    f"Maximum 20 functions allowed per search"
                )
        
        # Validate seniority_levels
        if seniority_levels is not None:
            if not isinstance(seniority_levels, list):
                raise ValueError("seniority_levels must be a list")
            
            if len(seniority_levels) > 20:  # Reasonable limit
                raise ValueError(
                    f"Maximum 20 seniority levels allowed per search"
                )
        
        # Validate seniority_operator
        if seniority_operator not in ["in", "not_in"]:
            raise ValueError(
                "seniority_operator must be 'in' or 'not_in'"
            )
        
        # Validate locations
        if locations is not None:
            if not isinstance(locations, list):
                raise ValueError("locations must be a list")
            
            if len(locations) > self.MAX_LOCATIONS_PER_REQUEST:
                raise ValueError(
                    f"Maximum {self.MAX_LOCATIONS_PER_REQUEST} locations allowed per search"
                )
        
        # Validate industries
        if industries is not None:
            if not isinstance(industries, list):
                raise ValueError("industries must be a list")
            
            if len(industries) > self.MAX_INDUSTRIES_PER_REQUEST:
                raise ValueError(
                    f"Maximum {self.MAX_INDUSTRIES_PER_REQUEST} industries allowed per search"
                )
        
        # Validate keyword
        if keyword is not None:
            if not isinstance(keyword, str):
                raise ValueError("keyword must be a string")
            
            cleaned = keyword.strip()
            if len(cleaned) < 2:
                raise ValueError("Keyword must be at least 2 characters long")
            
            if len(cleaned) > 100:
                raise ValueError("Keyword cannot exceed 100 characters")
        
        # Validate limit
        if not isinstance(limit, int):
            raise ValueError("limit must be an integer")
        
        if not self.MIN_LIMIT <= limit <= self.MAX_LIMIT:
            raise ValueError(
                f"limit must be between {self.MIN_LIMIT} and {self.MAX_LIMIT}. "
                f"Received {limit}."
            )
        
        logger.debug("Input validation passed")
