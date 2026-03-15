"""
Company search API endpoints
RESTful, well-documented, with comprehensive error handling
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
import logging
from sqlalchemy.orm import Session

from app.schemas.company_filters import (
    CompanySearchRequest,
    CompanySearchResponse,
    CompanySearchErrorResponse
)
from app.services.crustdata.company_search_service import CompanySearchService
from app.services.crustdata.base_crustdata_client import CrustDataAPIError
from app.core.config import settings
from app.db.deps import get_db
from app.db.models.company import Company

logger = logging.getLogger(__name__)

# Create API router
router = APIRouter(
    prefix="/api/v1/companies",
    tags=["companies"],
    responses={
        400: {
            "model": CompanySearchErrorResponse,
            "description": "Bad Request - Invalid parameters"
        },
        429: {
            "model": CompanySearchErrorResponse,
            "description": "Too Many Requests - Rate limit exceeded"
        },
        500: {
            "model": CompanySearchErrorResponse,
            "description": "Internal Server Error"
        },
        503: {
            "model": CompanySearchErrorResponse,
            "description": "Service Unavailable - CrustData API is down"
        },
    }
)


@router.post(
    "/search",
    response_model=CompanySearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search for companies",
    description="""
    Search for companies using multiple filters.
    
    **Supported Filters:**
    - `market_segments`: Filter by stock exchange (NASDAQ, NYSE, PRIVATE, etc.)
    - `industries`: Filter by LinkedIn industry category
    - `categories`: Filter by Crunchbase category
    - `company_types`: Filter by company type (Private, Public, etc.)
    - `locations`: Filter by geographic location
    - `employees`: Filter by employee count range
    
    **Filter Combining:**
    Multiple filters are combined using AND logic - companies must match ALL active filters.
    
    **Pagination:**
    - Use `limit` to control results per page (max 1000)
    - Use `cursor` from response's `next_cursor` to get next page
    - Credit usage: 1 credit per 100 results
    
    **Example Request:**
    ```json
    {
        "market_segments": ["NASDAQ", "NYSE"],
        "industries": ["Software Development"],
        "employees": ["201-500", "501-1000"],
        "limit": 100
    }
    ```
    """,
    response_description="Successful search with company profiles"
)
async def search_companies(request: CompanySearchRequest):
    """
    Search for companies with comprehensive error handling
    """
    try:
        # Log request
        logger.info(
            "Company search request received",
            extra={
                "has_market_segments": bool(request.market_segments),
                "has_industries": bool(request.industries),
                "has_categories": bool(request.categories),
                "has_company_types": bool(request.company_types),
                "has_locations": bool(request.locations),
                "has_employees": bool(request.employees),
                "limit": request.limit,
                "has_cursor": bool(request.cursor)
            }
        )
        
        # Initialize service
        service = CompanySearchService(api_key=settings.CRUSTDATA_API_KEY)
        
        # Perform search
        result = await service.search(
            company_name=request.company_name,
            industries=request.industries,
            categories=request.categories,
            market_segments=request.market_segments,
            company_types=request.company_types,
            locations=request.locations,
            employees=request.employees,
            limit=request.limit,
            cursor=request.cursor
        )
        
        # Log success
        logger.info(
            "Company search completed successfully",
            extra={
                "companies_returned": len(result.get("companies", [])),
                "total_available": result.get("total_count", 0)
            }
        )
        
        # Return response
        return CompanySearchResponse(
            companies=result.get("companies", []),
            total_count=result.get("total_count", 0),
            next_cursor=result.get("next_cursor"),
            query=result.get("query")
        )
        
    except ValueError as e:
        # Input validation errors
        logger.warning(
            f"Invalid search request: {str(e)}",
            extra={"error_type": "validation_error"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except CrustDataAPIError as e:
        # CrustData API specific errors
        logger.error(
            f"CrustData API error: {e.message}",
            extra={
                "status_code": e.status_code,
                "response_data": e.response_data,
                "error_type": "api_error"
            }
        )
        
        # Map errors to appropriate HTTP status codes
        if e.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Search service configuration error. Please contact support."
            )
        elif e.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again in a few moments."
            )
        elif e.status_code >= 500:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Search service temporarily unavailable. Please try again later."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Search request failed: {e.message}"
            )
    
    except Exception as e:
        # Unexpected errors
        logger.exception(
            "Unexpected error in company search",
            extra={"error_type": "unexpected_error"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request."
        )


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Check company service health",
    description="Verify that the company search service is operational"
)
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "companies",
        "version": getattr(settings, "APP_VERSION", "1.0.0")
    }


@router.get(
    "/",
    summary="Get companies endpoint information",
    description="Returns information about available company endpoints"
)
async def get_companies_info():
    """Get information about companies API"""
    return {
        "service": "Company Search API",
        "version": getattr(settings, "APP_VERSION", "1.0.0"),
        "endpoints": {
            "search": "/api/companies/search (POST)",
            "db": "/api/companies/db (GET)",
            "health": "/api/companies/health (GET)"
        },
        "documentation": "/docs"
    }


@router.get(
    "/db",
    status_code=status.HTTP_200_OK,
    summary="Get companies from local DB",
    description="Returns companies stored in the database (enrichment cache)."
)
async def list_db_companies(
    limit: int = Query(3, ge=1, le=50, description="Number of companies to return"),
    db: Session = Depends(get_db),
):
    try:
        companies = (
            db.query(Company)
            .order_by(Company.updated_at.desc(), Company.created_at.desc())
            .limit(limit)
            .all()
        )

        payload = []
        for c in companies:
            payload.append(
                {
                    "id": str(c.id),
                    "name": c.name,
                    "domain": c.domain,
                    "website": c.website,
                    "industry": c.industry,
                    "employee_count": c.employee_count_exact or c.employee_count_range,
                    "revenue": c.revenue_exact or c.revenue_range,
                    "location": {
                        "country": c.headquarters_country,
                        "state": c.headquarters_state,
                        "city": c.headquarters_city,
                    },
                    "technologies": c.technologies or [],
                    "linkedin_url": c.linkedin_url,
                    "quality_score": c.data_quality_score or 50,
                }
            )

        return {"success": True, "data": {"companies": payload}}
    except Exception:
        logger.exception("Failed to load companies from DB")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load companies from database.",
        )
