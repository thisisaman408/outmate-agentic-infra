"""
Prospect search API endpoints
RESTful, well-documented, with comprehensive error handling

This module defines the FastAPI routes for prospect search operations.
It provides a clean REST API interface with proper:
- Request validation
- Error handling
- Status codes
- Documentation
- Health checks
"""

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
import logging
import asyncio

from app.schemas.prospect_filters import (
    ProspectSearchRequest,
    ProspectSearchResponse,
    ProspectSearchErrorResponse
)
from app.services.crustdata.prospect_search_service import ProspectSearchService
from app.services.crustdata.enrichment_service import PersonEnrichmentService
from app.services.crustdata.base_crustdata_client import CrustDataAPIError
from app.services.contactout_service import ContactOutService
from app.core.config import settings
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Create API router with configuration
router = APIRouter(
    prefix="/api/prospects",
    tags=["prospects"],
    responses={
        400: {
            "model": ProspectSearchErrorResponse,
            "description": "Bad Request - Invalid parameters"
        },
        429: {
            "model": ProspectSearchErrorResponse,  
            "description": "Too Many Requests - Rate limit exceeded"
        },
        405: {
            "model": ProspectSearchErrorResponse,
            "description": "Method Not Allowed"
        },
        500: {
            "model": ProspectSearchErrorResponse,
            "description": "Internal Server Error"
        },
        503: {
            "model": ProspectSearchErrorResponse,
            "description": "Service Unavailable - CrustData API is down"
        },
    }
)


@router.post("/test-keyword-validation", tags=["debug"])
async def test_keyword_validation(request: ProspectSearchRequest):
    """
    DEBUG ENDPOINT: Test keyword filter schema validation
    This bypasses the service layer to isolate schema validation
    """
    return {
        "success": True,
        "message": "Schema validation passed!",
        "keyword_received": request.keyword,
        "keyword_length": len(request.keyword) if request.keyword else 0,
        "all_fields": request.model_dump(exclude_none=True)
    }


@router.post(
    "/search",
    response_model=ProspectSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search for prospects",
    description="""
    Search for prospects using multiple filters.
    
    **Currently Supported Filters:**
    - `current_title`: Filter by current job title (supports multiple titles with IN operator)
    
    **Future Filters (Schema Ready):**
    - `past_title`: Filter by previous job title  
    - `location`: Filter by geographic location
    - `industry`: Filter by industry category
    
    **Filter Combining:**
    Multiple filters are combined using AND logic - prospects must match ALL active filters.
    
    **Pagination:**
    - Use `limit` to control results per page (max 1000)
    - Use `cursor` from response's `next_cursor` to get next page
    - Credit usage: ~3 credits per 100 results
    
    **Example Request:**
    ```json
    {
        "current_title": ["CEO", "Chief Technology Officer"],
        "limit": 100
    }
    ```
    
    **Example Response:**
    ```json
    {
        "profiles": [...],
        "total_count": 539020,
        "next_cursor": "abc123..."
    }
    ```
    """,
    response_description="Successful search with prospect profiles"
)
async def search_prospects(request: ProspectSearchRequest):
    """
    Search for prospects with comprehensive error handling
    
    This endpoint provides the main prospect search functionality.
    It validates inputs, executes the search, and returns results
    with proper error handling at every step.
    
    Args:
        request: ProspectSearchRequest with filters and pagination
        
    Returns:
        ProspectSearchResponse with profiles and pagination info
        
    Raises:
        HTTPException 400: Invalid input parameters
        HTTPException 429: Rate limit exceeded
        HTTPException 500: Internal server error
        HTTPException 503: CrustData API unavailable
    """
    try:
        # DEBUG: Log raw request data to see exactly what frontend sends
        logger.info(
            "RAW REQUEST DATA",
            extra={
                "keyword": request.keyword,
                "current_title": request.current_title,
                "past_title": request.past_title,
                "functions": request.functions,
                "seniority_level": request.seniority_level,
                "seniority_level_operator": request.seniority_level_operator,
                "location": request.location,
                "industry": request.industry,
                "person_name": request.name,  # Renamed from 'name' to avoid LogRecord conflict
                "first_name": request.first_name,
                "last_name": request.last_name,
                "profile_languages": request.profile_languages,
                "company": request.company,
                "employees": request.employees,
                "limit": request.limit,
                "cursor": request.cursor
            }
        )
        
        # Log search request (for monitoring/analytics)
        logger.info(
            "Prospect search request received",
            extra={
                "has_current_title": bool(request.current_title),
                "has_past_title": bool(request.past_title),
                "has_functions": bool(request.functions),
                "has_seniority_level": bool(request.seniority_level),
                "has_location": bool(request.location),
                "has_industry": bool(request.industry),
                "has_keyword": bool(request.keyword),
                "has_name": bool(request.name or request.first_name or request.last_name),
                "has_profile_languages": bool(request.profile_languages),
                "has_company": bool(request.company),
                "has_employees": bool(request.employees),
                "limit": request.limit,
                "has_cursor": bool(request.cursor)
            }
        )
        
        # Initialize service with API key from settings
        service = ProspectSearchService(api_key=settings.CRUSTDATA_API_KEY)
        
        # Perform search
        result = await service.search(
            current_titles=request.current_title,
            past_titles=request.past_title,
            functions=request.functions,
            seniority_levels=request.seniority_level,
            seniority_operator=request.seniority_level_operator or "in",
            locations=request.location,
            industries=request.industry,
            keyword=request.keyword,
            # Name filters
            name=request.name,
            first_name=request.first_name,
            last_name=request.last_name,
            # Profile Language filter
            profile_languages=request.profile_languages,
            company=request.company,
            # Employees filter
            employees=request.employees,
            limit=request.limit,
            cursor=request.cursor
        )

        profiles = result.get("profiles", [])
        
        # Add ContactOut enrichment for top profiles to meet "Crustdata + ContactOut" constraint
        # Enrich only top 3 results per request to balance richness vs latency
        if profiles and settings.CONTACTOUT_API_KEY:
            try:
                contactout = ContactOutService()
                enrichment_count = min(len(profiles), 3)
                print(f">>> [Prospects API] Enriching top {enrichment_count} profiles with ContactOut", flush=True)
                
                async def enrich_profile(profile):
                    li_url = profile.get("linkedin_url") or profile.get("linkedin_profile_url")
                    if not li_url:
                        return
                    
                    try:
                        # Use get_decision_makers for detailed person data
                        # This provides better headlines, seniority, job function etc.
                        co_data = await contactout.get_decision_makers(linkedin_url=li_url)
                        co_profiles = co_data.get("profiles", [])
                        
                        if isinstance(co_profiles, dict):
                            co_profiles = list(co_profiles.values())
                            
                        if co_profiles and isinstance(co_profiles, list):
                            co_p = co_profiles[0]
                            co_norm = contactout.normalize_decision_maker(co_p)
                            
                            # Surgical merge of useful fields
                            for k, v in co_norm.items():
                                if v and v not in (None, "", [], {}, 0, "N/A"):
                                    #headline, seniority, job_function, profile_picture_url provide better context
                                    if k in ["headline", "seniority", "job_function", "profile_picture_url"]:
                                        profile[k] = v
                            
                            profile["contactout_enriched"] = True
                            profile["contact_availability"] = co_norm.get("contact_availability", {})
                    except Exception as e:
                        logger.warning(f"ContactOut enrichment failed for {li_url}: {e}")

                await asyncio.gather(*[enrich_profile(p) for p in profiles[:enrichment_count]], return_exceptions=True)
                
            except Exception as e:
                logger.error(f"ContactOut service enrichment failed: {e}")
        
        # Log successful response
        logger.info(
            "Prospect search completed successfully",
            extra={
                "profiles_returned": len(profiles),
                "total_available": result.get("total_count", 0)
            }
        )
        
        # Return successful response
        return ProspectSearchResponse(
            profiles=profiles,
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
        
        # Map CrustData errors to appropriate HTTP status codes
        if e.status_code == 401:
            # API key invalid - report as service unavailable (don't expose key issue to client)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Search service configuration error. Please contact support."
            )
        
        elif e.status_code == 403:
            # Forbidden - permissions issue
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Search service permissions error. Please contact support."
            )
        
        elif e.status_code == 429:
            # Rate limit exceeded
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again in a few moments."
            )
        
        elif e.status_code >= 500:
            # Server errors from CrustData
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Search service temporarily unavailable. Please try again later."
            )
        
        else:
            # Other API errors  
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Search request failed: {e.message}"
            )
    
    except Exception as e:
        # Unexpected errors
        logger.exception(
            "Unexpected error in prospect search",
            extra={"error_type": "unexpected_error"}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request."
        )


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Check prospect service health",
    description="Verify that the prospect search service is operational",
    response_description="Service health status"
)
async def health_check():
    """
    Health check endpoint for monitoring
    
    Returns basic service status. Can be used by:
    - Load balancers for health checks
    - Monitoring tools for uptime tracking
    - Kubernetes liveness/readiness probes
    
    Returns:
        Dict with status and service name
    """
    return {
        "status": "healthy",
        "service": "prospects",
        "version": settings.APP_VERSION
    }


class EnrichEmailRequest(BaseModel):
    """Request schema for email enrichment"""
    linkedin_url: str = Field(
        ...,
        description="Full LinkedIn profile URL",
        example="https://www.linkedin.com/in/example-profile/"
    )
    enrich_realtime: bool = Field(
        default=False,
        description="Whether to fetch in real-time (5 credits) or from DB (5 credits)"
    )


class ContactRevealRequest(BaseModel):
    """Request schema for revealing contact info via ContactOut fallback"""
    linkedin_url: str = Field(
        ...,
        description="Full LinkedIn profile URL",
        example="https://www.linkedin.com/in/example-profile/"
    )


@router.post(
    "/{person_id}/enrich/email",
    status_code=status.HTTP_200_OK,
    summary="Enrich prospect with business email",
    description="""
    Enriches a prospect profile with business email using CrustData API.
    
    **Credit Cost**: 5 credits per enrichment (3 for profile + 2 for email)
    
    **Note**: Results are returned immediately if cached, otherwise may take up to 10 seconds.
    """,
    responses={
        200: {"description": "Email successfully enriched"},
        404: {"description": "Profile not found or data not available"},
        400: {"description": "Invalid LinkedIn URL"},
        500: {"description": "Enrichment failed"}
    }
)
async def enrich_prospect_email(
    person_id: int,
    request: EnrichEmailRequest
):
    """
    Enrich a prospect profile with business email
    
    Args:
        person_id: The prospect's person ID
        request: Enrichment request containing LinkedIn URL
        
    Returns:
        Enrichment result with business email
    
    Example Response:
        ```json
        {
            "success": true,
            "business_email": ["john@company.com"],
            "enriched_at": "2024-02-01T10:00:00Z",
            "verification_status": "verified",
            "credits_used": 5
        }
        ```
    """
    logger.info(f"Email enrichment requested for person_id: {person_id}")
    logger.info(f"LinkedIn URL: {request.linkedin_url}")
    
    try:
        # Initialize enrichment service
        enrichment_service = PersonEnrichmentService()
        
        # Call enrichment API
        result = await enrichment_service.enrich_person_email(
            linkedin_profile_url=request.linkedin_url,
            enrich_realtime=request.enrich_realtime
        )
        
        # Check if enrichment was successful
        if result.get("success"):
            logger.info(f"✅ Email enriched successfully for person_id: {person_id}")
            logger.info(f"   Business email: {result.get('business_email')}")
            logger.info(f"   Credits used: {result.get('credits_used', 5)}")
            
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=result
            )
        else:
            # Handle different error codes
            error_code = result.get("error_code")
            error_message = result.get("error", "Enrichment failed")
            
            logger.warning(f"❌ Enrichment failed for person_id: {person_id}")
            logger.warning(f"   Error: {error_message} (Code: {error_code})")
            
            # Map error codes to HTTP status codes
            if error_code == "PE01":
                # Profile unavailable
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "error": error_message,
                        "error_code": error_code,
                        "message": "LinkedIn profile does not exist or is not available"
                    }
                )
            elif error_code == "PE03":
                # Not in database yet
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={
                        "error": error_message,
                        "error_code": error_code,
                        "message": "Profile not found in database. Please try again later or use real-time enrichment."
                    }
                )
            elif error_code == "INVALID_REQUEST":
                # Bad request
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": error_message,
                        "error_code": error_code,
                        "message": "Invalid LinkedIn URL format"
                    }
                )
            else:
                # Generic error
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={
                        "error": error_message,
                        "error_code": error_code,
                        "message": "Failed to enrich profile. Please try again later."
                    }
                )
                
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error during enrichment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": str(e),
                "error_code": "UNKNOWN_ERROR",
                "message": "An unexpected error occurred during enrichment"
            }
        )


@router.get(
    "/",
    summary="Get prospects endpoint information",
    description="Returns information about available prospect endpoints",
    status_code=status.HTTP_200_OK
)
async def get_prospects_info():
    """
    Get information about prospects API
    
    Provides basic info about the service and available endpoints.
    Useful for API discovery.
    
    Returns:
        Dict with service information
    """
    return {
        "service": "Prospect Search API",
        "version": settings.APP_VERSION,
        "endpoints": {
            "search": "/api/prospects/search (POST)",
            "health": "/api/prospects/health (GET)",
            "reveal_contact": "/api/prospects/reveal-contact (POST)"
        },
        "documentation": "/docs"
    }


@router.post(
    "/reveal-contact",
    status_code=status.HTTP_200_OK,
    summary="Reveal prospect contact info via ContactOut fallback",
    description="""
    Fetches phone/email for a prospect using ContactOut `people/linkedin` endpoint.
    Intended for click-to-reveal UX in prospect tables.
    """
)
async def reveal_contact_info(request: ContactRevealRequest):
    try:
        linkedin_url = (request.linkedin_url or "").strip()
        if not linkedin_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="linkedin_url is required"
            )

        service = ContactOutService()
        result = await service.reveal_contact_info(
            linkedin_url=linkedin_url,
            include_phone=True
        )

        sanitized_emails = result.get("sanitized_emails") or []
        sanitized_phones = result.get("sanitized_phones") or []

        reveal_success = bool(sanitized_emails or sanitized_phones)
        if reveal_success:
            logger.info(
                f"ContactOut reveal succeeded for {linkedin_url}",
                extra={"emails_returned": len(sanitized_emails), "phones_returned": len(sanitized_phones)}
            )
        else:
            logger.info(f"ContactOut reveal returned only placeholders for {linkedin_url}")

        return {
            "success": reveal_success,
            "linkedin_url": linkedin_url,
            "emails": sanitized_emails,
            "phones": sanitized_phones,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Contact reveal fallback failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contact info"
        )
