"""
Pydantic schemas for prospect search requests and responses
Production-grade with validation, documentation, and examples

These schemas provide:
- Input validation and sanitization
- Type safety
- Auto-generated API documentation
- Clear error messages for invalid inputs
- Future-ready structure for additional filters
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any


class ProspectSearchRequest(BaseModel):
    """
    Request model for prospect search endpoint
    
    Supports multiple filters that can be combined with AND logic.
    All filters are optional - if none provided, returns all prospects.
    
    Attributes:
        current_title: List of job titles to filter (current position)
        past_title: List of previous job titles (future use)
        location: Geographic locations to filter (future use)  
        industry: Industry categories to filter (future use)
        limit: Number of results per page (1-1000)
        cursor: Pagination cursor for next page
    """
    
    # Current filters (actively used)
    current_title: Optional[List[str]] = Field(
        None,
        description="List of current job titles to search. Supports exact match and partial matching.",
        example=["Chief Executive Officer", "CTO"],
        max_items=50,
        alias="current_title"  # Keep consistent naming with frontend
    )

    past_title: Optional[List[str]] = Field(
        None,
        description="List of previous job titles. Searches through employment history.",
        example=["Software Engineer", "VP of Engineering"],
        max_items=50,
        alias="past_title"
    )

    functions: Optional[List[str]] = Field(
        None,
        description="List of job functions/departments (e.g. Engineering, Sales)",
        example=["Engineering", "Product"],
        alias="functions"
    )

    seniority_level: Optional[List[str]] = Field(
        None,
        description="List of seniority levels (e.g. CXO, Vice President, Director)",
        example=["CXO", "Vice President"],
        alias="seniority_level"
    )

    seniority_level_operator: Optional[str] = Field(
        "in",
        description="Operator for seniority_level filter: 'in' (include) or 'not_in' (exclude)",
        example="in",
        alias="seniority_level_operator"
    )

    
    # Future filters (schema ready, implementation pending)
    
    location: Optional[List[str]] = Field(
        None,
        description="Geographic locations (city, state, country). Supports fuzzy matching.",
        example=["San Francisco", "India"],
        max_items=20,
        alias="location"
    )
    
    industry: Optional[List[str]] = Field(
        None,
        description="Industry categories from LinkedIn taxonomy.",
        example=["Technology", "Financial Services"],
        max_items=20,
        alias="industry"
    )
    
    keyword: Optional[str] = Field(
        None,
        description="Keyword to search in company-related fields (skills, job roles, company descriptions). Searches across multiple fields automatically.",
        example="artificial intelligence",
        alias="keyword"
    )
    
    # Company filter
    company: Optional[str] = Field(
        None,
        description="Name of the company to filter by (current employer)",
        example="Microsoft",
        alias="company"
    )

    # Name filters
    name: Optional[str] = Field(
        None,
        description="Full name or partial name to search. Will be split into first_name/last_name automatically.",
        example="John Smith",
        alias="name"
    )
    
    first_name: Optional[str] = Field(
        None,
        description="First name to search (exact match). Takes precedence over 'name' field if both provided.",
        example="John",
        alias="first_name"
    )
    
    last_name: Optional[str] = Field(
        None,
        description="Last name to search (exact match). Takes precedence over 'name' field if both provided.",
        example="Smith",
        alias="last_name"
    )

    # Employees filter (Company Criteria)
    employees: Optional[List[str]] = Field(
        None,
        description="List of company headcount ranges (e.g. '1-10', '501-1000', '1000_plus')",
        example=["1-10", "1000_plus"],
        alias="employees"
    )

    # Signal filters
    recently_changed_jobs: Optional[bool] = Field(
        None,
        description="Filter for people who recently changed jobs (last 90 days). Maps to CrustData RECENTLY_CHANGED_JOBS signal.",
        example=True,
        alias="recently_changed_jobs"
    )

    # Experience range
    years_of_experience_min: Optional[int] = Field(
        None,
        description="Minimum years of experience",
        example=5,
        alias="years_of_experience_min"
    )

    years_of_experience_max: Optional[int] = Field(
        None,
        description="Maximum years of experience",
        example=15,
        alias="years_of_experience_max"
    )

    # Profile Language filter (Location & Demographics)
    profile_languages: Optional[List[str]] = Field(
        None,
        description="List of LinkedIn profile languages to filter. Supports multiple languages.",
        example=["English", "Spanish"],
        alias="profile_languages"
    )
    
    # Pagination parameters
    limit: int = Field(
        100,
        ge=1,
        le=1000,
        description="Maximum number of results to return per page. Affects credit usage."
    )
    
    cursor: Optional[str] = Field(
        None,
        description="Pagination cursor obtained from previous response's next_cursor field."
    )
    
    @validator('current_title', 'past_title', check_fields=False)
    def validate_and_clean_titles(cls, v):
        """
        Validate and clean title lists
        
        - Removes empty strings
        - Strips whitespace
        - Removes duplicates
        - Returns None if no valid values remain
        """
        if v is not None:
            # Remove empty and whitespace-only strings
            cleaned = [s.strip() for s in v if s and s.strip()]
            # Remove duplicates while preserving order
            seen = set()
            unique = []
            for item in cleaned:
                if item not in seen:
                    seen.add(item)
                    unique.append(item)
            
            # Return None if all values were invalid
            return unique if unique else None
        return v
    
    @validator('location', 'industry', check_fields=False)
    def validate_and_clean_lists(cls, v):
        """
        Validate and clean generic string lists
        
        - Removes empty values
        - Strips whitespace  
        - Removes duplicates
        """
        if v is not None:
            cleaned = [s.strip() for s in v if s and s.strip()]
            # Remove duplicates
            return list(set(cleaned)) if cleaned else None
        return v
    
    @validator('limit', check_fields=False)
    def validate_limit(cls, v):
        """
        Validate limit is reasonable
        
        Note: Higher limits consume more credits.
        Credit usage = ~(limit / 100) * 3 credits per request
        """
        if v > 500:
            # Log warning for high limits (costs more credits)
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"High limit requested: {v}. This will consume approximately {(v/100)*3:.1f} credits.")
        return v
    
    @validator('keyword', check_fields=False)
    def validate_keyword(cls, v):
        """
        Validate and clean keyword
        
        - Removes leading/trailing whitespace
        - Ensures minimum 2 characters
        - Ensures maximum 100 characters
        - Returns None if empty after cleaning
        """
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 2:
                raise ValueError("Keyword must be at least 2 characters long")
            if len(cleaned) > 100:
                raise ValueError("Keyword cannot exceed 100 characters")
            return cleaned if cleaned else None
        return v
    
    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "current_title": ["CEO", "Chief Technology Officer"],
                "limit": 100
            }
        }
        # Allow both snake_case and camelCase from frontend
        populate_by_name = True


class ProspectProfile(BaseModel):
    """
    Simplified prospect profile model
    
    This is a simplified version - actual API returns much more data.
    Using 'extra = allow' permits additional fields to pass through.
    """
    person_id: int = Field(description="Unique identifier for this person")
    name: str = Field(description="Full name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    headline: Optional[str] = Field(None, description="LinkedIn headline")
    region: Optional[str] = Field(None, description="Geographic location")
    
    class Config:
        extra = "allow"  # Allow all additional fields from API response


class ProspectSearchResponse(BaseModel):
    """
    Response model for prospect search
    
    Contains search results and pagination information.
    
    Attributes:
        profiles: List of prospect profiles matching filters
        total_count: Total number of results available (not just returned)
        next_cursor: Cursor for fetching next page (None if last page)
        query: Echo of original query (optional, for debugging)
    """
    
    profiles: List[Dict[str, Any]] = Field(
        description="List of matching prospect profiles with full details"
    )
    
    total_count: int = Field(
        description="Total number of prospects matching the filters (across all pages)"
    )
    
    next_cursor: Optional[str] = Field(
        None,
        description="Cursor token for fetching the next page. Null/None if this is the last page."
    )
    
    query: Optional[Dict[str, Any]] = Field(
        None,
        description="Echo of the query that was executed (for debugging)"
    )
    
    class Config:
        """Pydantic model configuration"""
        json_schema_extra = {
            "example": {
                "profiles": [
                    {
                        "person_id": 957,
                        "name": "John Doe",
                        "headline": "CEO at Tech Corp",
                        "region": "United States",
                        "current_employers": [
                            {
                                "title": "Chief Executive Officer",
                                "name": "Tech Corp"
                            }
                        ]
                    }
                ],
                "total_count": 539020,
                "next_cursor": "abc123xyz...",
                "query": None
            }
        }


class ProspectSearchErrorResponse(BaseModel):
    """
    Error response model
    
    Returned when search fails due to validation or API errors.
    """
    
    detail: str = Field(
        description="Human-readable error message explaining what went wrong"
    )
    
    status_code: Optional[int] = Field(
        None,
        description="HTTP status code"
    )
    
    error_type: Optional[str] = Field(
        None,
        description="Error category (validation, api_error, network_error, etc.)"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "detail": "Invalid filter parameters: current_title must be a list",
                "status_code": 400,
                "error_type": "validation_error"
            }
        }
