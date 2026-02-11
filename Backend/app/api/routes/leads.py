"""
Leads API Routes - FIXED & OPTIMIZED VERSION
- Returns up to 25 companies
- Charges credits based on actual results returned
- Skips user/credit check if no user_id
"""
import logging
from typing import Dict, Any, Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.services.search_service import SearchService
from app.services.filter_mapping_service import FilterMappingService
from app.services.post_filter_service import PostFilterService
from app.services.crustdata_service import CrustdataService
from enum import Enum
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/test-endpoint")
async def test_endpoint():
    """Test endpoint to verify routing is working."""
    print("=== DEBUG: Test endpoint called ===")
    return {"message": "Router is working"}

@router.post("/linkedin-post-keyword")
async def linkedin_post_keyword(request: Dict[str, Any], db: Session = Depends(get_db)):
    """New endpoint for LinkedIn Post Keyword API."""
    print("=== DEBUG: linkedin_post_keyword called ===")
    print("=== DEBUG: Request object:", request)
    print("=== DEBUG: Request method:", getattr(request, 'method', 'UNKNOWN'))
    try:
        print("=== DEBUG: Creating CrustdataService ===")
        crustdata = CrustdataService()
        print("=== DEBUG: CrustdataService created ===")
        
        # Backwards compatible: accept either `keyword` (string) or `keywords` (list).
        keyword = request.get("keyword")
        print(f"=== DEBUG: keyword extracted: {keyword} ===")
        if not keyword:
            keywords = request.get("keywords") or []
            if isinstance(keywords, list) and keywords:
                keyword = keywords[0]
            print(f"=== DEBUG: final keyword: {keyword} ===")

        if not keyword:
            print("=== DEBUG: Missing keyword, returning error ===")
            return LeadSearchResponse(success=False, error={"code": "INVALID_REQUEST", "message": "Missing keyword"})

        print(f">>> Crustdata keyword search request: keyword={keyword}, page={request.get('page')}, limit={request.get('limit')}")
        print("=== DEBUG: About to call crustdata.realtime_linkedin_posts_keyword_search ===")
        result = await crustdata.realtime_linkedin_posts_keyword_search(
            keyword=str(keyword),
            page=int(request.get("page") or 1),
            limit=int(request.get("limit") or 5),
            sort_by=str(request.get("sort_by") or "relevance"),
        )
        print(f">>> Crustdata keyword search response: {result}")
        print(f">>> Crustdata response type: {type(result)}")
        if hasattr(result, 'posts'):
            print(f">>> Crustdata posts count: {len(result.posts) if result.posts else 0}")
        print("=== DEBUG: About to return result ===")
        return result
    except Exception as e:
        print(f"=== DEBUG: Exception occurred: {e} ===")
        return LeadSearchResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})

# Request/Response Models (unchanged)
class LeadSearchRequest(BaseModel):
    filters: Dict[str, Any] = Field(..., description="Filter criteria for search")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Search options (limit, page, etc.)")
    user_id: Optional[str] = Field(default=None, description="User ID for credit tracking")


class LeadSearchResponse(BaseModel):
    success: bool
    source: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    search_id: Optional[str] = None
    error: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None


class FilterMetadataResponse(BaseModel):
    api_filters: List[str]
    post_filters: List[str]
    unsupported: List[str]
    total_api_filters: int
    total_post_filters: int

class SearchMode(Enum):
    REALTIME = "realtime"  # Current /company/search
    DATABASE = "database"   # New /screen/
    ENRICHMENT = "enrichment"

class AutocompleteRequest(BaseModel):
    field: str
    query: str = ""
    limit: int = 5

@router.post("/identify-company")
async def identify_company(request: Dict[str, Any], db: Session = Depends(get_db)):
    """New endpoint for Company Identification API."""
    try:
        crustdata = CrustdataService()
        result = await crustdata.identify_company(
            name=request.get("name"),
            website=request.get("domain") or request.get("website"),
            linkedin_url=request.get("linkedin_url"),
            crunchbase_url=request.get("crunchbase_url"),
            company_id=request.get("company_id")
        )
        return LeadSearchResponse(success=True, data=result)
    except Exception as e:
        return LeadSearchResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})
    
@router.post("/enrich-company")
async def enrich_company(request: Dict[str, Any], db: Session = Depends(get_db)):
    """Enhanced endpoint for Company Enrichment API."""
    try:
        crustdata = CrustdataService()
        result = await crustdata.enrich_company(
            domain=request.get("domain"),
            name=request.get("name"),
            company_id=request.get("company_id")
        )
        return LeadSearchResponse(success=True, data=result)
    except Exception as e:
        return LeadSearchResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})

@router.post("/in-db-search")
async def in_db_search(request: LeadSearchRequest, db: Session = Depends(get_db)):
    """Enhanced endpoint for In-DB Company Search API with comprehensive data."""
    try:
        crustdata = CrustdataService()
        
        filters = FilterMappingService.transform_to_crustdata_format(request.filters)
        result = await crustdata.comprehensive_company_search(filters=filters)
        return LeadSearchResponse(success=True, data=result)
    except Exception as e:
        return LeadSearchResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})
    
@router.post("/realtime-search")
async def realtime_search(request: LeadSearchRequest, db: Session = Depends(get_db)):
    """New endpoint for Realtime Company Search API."""
    try:
        crustdata = CrustdataService()
        filters = FilterMappingService.transform_to_crustdata_format(request.filters)
        result = await crustdata.realtime_company_search(filters=filters)
        return LeadSearchResponse(success=True, data=result)
    except Exception as e:
        return LeadSearchResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})
    
@router.post("/realtime-linkedin-post")
async def realtime_linkedin_post(request: Dict[str, Any], db: Session = Depends(get_db)):
    """New endpoint for Realtime LinkedIn Post API."""
    try:
        crustdata = CrustdataService()
        result = await crustdata.realtime_linkedin_posts_by_company(
            company_id=request.get("company_id"),
            company_domain=request.get("company_domain") or request.get("domain"),
            company_name=request.get("company_name") or request.get("name"),
            company_linkedin_url=request.get("company_linkedin_url") or request.get("linkedin_url"),
            page=int(request.get("page") or 1),
            limit=int(request.get("limit") or 5),
        )
        return LeadSearchResponse(success=True, data=result)
    except Exception as e:
        return LeadSearchResponse(success=False, error={"code": "INTERNAL_ERROR", "message": str(e)})

# Endpoints
@router.post("/search/companies", response_model=LeadSearchResponse)
async def search_companies(
    request: LeadSearchRequest,
    db: Session = Depends(get_db),
):
    """
    Main company search endpoint
    - Uses In-DB search with transformed filters
    - Returns up to 25 companies
    - Safe page handling & filter logging
    """
    try:
        print("=" * 50, flush=True)
        print(">>> ENDPOINT HIT: search_companies", flush=True)

        # STEP 1: Validate
        print(">>> STEP 1: validate", flush=True)
        filters_dict = request.filters if isinstance(request.filters, dict) else {}
        is_valid, errors = FilterMappingService.validate_filters(filters_dict)
        # Construct options for SearchService
        options = {
            "limit": request.options.get("limit", 25) if request.options else 25,
            "prefetch_limit": max(request.options.get("limit", 25) if request.options else 25, 10), # Prefetch more for post-filtering
            "enrich": True, # FORCE ENRICHMENT for Real-time + ContactOut
            "post_filters": FilterMappingService.extract_post_filters(filters_dict)
        }
        print(f">>> STEP 1 RESULT: is_valid={is_valid} errors={errors}", flush=True)

        if not is_valid:
            print(f">>> Validation failed: {errors}", flush=True)
            return LeadSearchResponse(
                success=False,
                error={
                    "code": "INVALID_FILTERS",
                    "message": "Invalid or unsupported filters",
                    "details": {
                        "unsupported_filters": errors,
                        "hint": "Use supported filters like industry, employee_count, founded_year, etc."
                    }
                }
            )

        # STEP 2: Transform filters + safe page
        print(">>> STEP 2: transform", flush=True)

        # Get page safely
        page = 1
        if request.options and isinstance(request.options, dict):
            page = request.options.get('page', 1)
            if not isinstance(page, int) or page < 1:
                page = 1

        crustdata_payload = FilterMappingService.transform_to_crustdata_format(filters_dict, page=page)
        print(f">>> STEP 2 RESULT: {crustdata_payload}", flush=True)

        # Safe filter type extraction for logging
        api_filters_used = []
        filters_part = crustdata_payload.get("filters", {})
        if isinstance(filters_part, list):
            api_filters_used = [f.get("filter_type") for f in filters_part if isinstance(f, dict)]
        elif isinstance(filters_part, dict):
            if "conditions" in filters_part:
                conditions = filters_part.get("conditions", [])
                api_filters_used = [c.get("filter_type") for c in conditions if isinstance(c, dict)]
            elif "filter_type" in filters_part:
                api_filters_used = [filters_part["filter_type"]]

        print(f">>> API Filters sent to CrustData: {api_filters_used}", flush=True)

        if not crustdata_payload.get("filters"):
            print(">>> WARNING: No supported API filters after transform - search may return all results", flush=True)

        # STEP 3: User & Credit
        print(">>> STEP 3: user_id", flush=True)
        user_id = None
        if request.user_id:
            try:
                user_id = UUID(request.user_id)
            except ValueError:
                return LeadSearchResponse(
                    success=False,
                    error={"code": "INVALID_USER_ID", "message": f"Invalid user ID: {request.user_id}"}
                )

        required_credits = 25  # Allow up to 25 results
        if user_id is None:
            print(">>> No user_id - skipping credit check (unauthenticated)", flush=True)
            has_credits = True
        else:
            has_credits, credit_error = SearchService(db)._validate_credits(user_id, required_credits)
            if not has_credits:
                print(f">>> Insufficient credits: {credit_error}", flush=True)
                return LeadSearchResponse(
                    success=False,
                    error={"code": "INSUFFICIENT_CREDITS", "message": credit_error}
                )

        # STEP 4: Execute search using Explorium API (instead of Crustdata)
        print(f">>> STEP 4: calling Explorium search (limit={required_credits})", flush=True)
        # Use Explorium API instead of Crustdata to avoid 401 errors
        post_filters_for_prefetch = FilterMappingService.extract_post_filters(filters_dict)
        print(f">>> DEBUG: post_filters extracted: {post_filters_for_prefetch}", flush=True)
        
        # Transform to Explorium format
        explorium_filters = FilterMappingService.transform_to_explorium_format(filters_dict)
        print(f">>> Explorium filters: {explorium_filters}", flush=True)
        
        # Use SearchService which handles Explorium + ContactOut
        search_service = SearchService(db)
        result = await search_service.search_companies_explorium(filters=explorium_filters, limit=required_credits)

        print(f">>> DEBUG: Comprehensive search returned: {result}", flush=True)
        print(f">>> DEBUG: result keys: {list(result.keys()) if result else 'None'}", flush=True)

        if not result or not result.get("companies"):
            print(">>> No companies found in result.", flush=True)
            return LeadSearchResponse(
                success=True, # Return success=True with empty list for UI to handle 
                data={"companies": [], "total": 0, "page": 1, "total_pages": 0}
            )

        # STEP 5: Process comprehensive search results
        # Result is already flattened by comprehensive_company_search wrapper
        companies = result.get("companies", [])
        sources_used = result.get("sources_used", [])
        
        if companies:
            print(f">>> DEBUG: companies count: {len(companies)}", flush=True)
        else:
            print(">>> WARNING: companies list is empty", flush=True)

        if not companies:
            return LeadSearchResponse(
                success=False,
                error={"code": "NO_RESULTS", "message": "No companies found matching your filters"}
            )

        # Construct response with comprehensive data
        response_data = {
            "companies": companies,
            "sources_used": sources_used,
            "total_count": len(companies)
        }
        
        return LeadSearchResponse(
            success=True,
            data=response_data,
            search_id=result.get("search_id"),
            meta=result.get("meta")
        )

    except Exception as e:
        print(f">>> EXCEPTION in search_companies: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return LeadSearchResponse(
            success=False,
            error={"code": "INTERNAL_ERROR", "message": str(e)}
        )


# Autocomplete Proxy (for frontend validation)
@router.post("/crustdata/autocomplete")
async def crustdata_autocomplete(req: AutocompleteRequest):
    try:
        crustdata = CrustdataService()
        result = await crustdata.autocomplete(
            field=req.field,
            query=req.query,
            limit=req.limit
        )
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
