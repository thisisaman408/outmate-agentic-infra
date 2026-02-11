"""
Pydantic schemas for company search API
Provides request validation and response documentation
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Any


class CompanySearchRequest(BaseModel):
    """Request schema for company search endpoint"""
    
    # Company Criteria (Firmographics)
    company_name: Optional[str] = Field(
        None,
        description="Company name to search",
        example="Google"
    )
    
    industries: Optional[List[str]] = Field(
        None,
        description="LinkedIn industry categories",
        example=["Software Development", "Information Technology"]
    )
    
    categories: Optional[List[str]] = Field(
        None,
        description="Crunchbase categories",
        example=["SaaS", "Enterprise Software"]
    )
    
    market_segments: Optional[List[str]] = Field(
        None,
        description="Stock exchange codes (NASDAQ, NYSE, PRIVATE, etc.)",
        example=["NASDAQ", "NYSE"]
    )
    
    company_types: Optional[List[str]] = Field(
        None,
        description="Company type (Private, Public, Non-Profit)",
        example=["Private", "Public"]
    )
    
    locations: Optional[List[str]] = Field(
        None,
        description="Geographic locations",
        example=["San Francisco", "New York"]
    )
    
    employees: Optional[List[str]] = Field(
        None,
        description="Employee count ranges",
        example=["51-200", "201-500"]
    )
    
    # Pagination
    limit: int = Field(
        100,
        ge=1,
        le=1000,
        description="Number of results to return (max 1000)"
    )
    
    cursor: Optional[str] = Field(
        None,
        description="Pagination cursor from previous response"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "market_segments": ["NASDAQ", "NYSE"],
                "industries": ["Software Development"],
                "employees": ["201-500", "501-1000"],
                "limit": 50
            }
        }


class CompanySearchResponse(BaseModel):
    """Response schema for company search endpoint"""
    
    companies: List[Any] = Field(
        ...,
        description="List of company profiles matching the search criteria"
    )
    
    total_count: int = Field(
        ...,
        description="Total number of companies matching the filter criteria"
    )
    
    next_cursor: Optional[str] = Field(
        None,
        description="Cursor for fetching the next page of results (None if last page)"
    )
    
    query: Optional[Any] = Field(
        None,
        description="Echo of the search query (optional)"
    )


class CompanySearchErrorResponse(BaseModel):
    """Error response schema"""
    
    detail: str = Field(
        ...,
        description="Error message describing what went wrong"
    )
