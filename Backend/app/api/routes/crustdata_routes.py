"""Crustdata API Routes - Company Profile Enrichment

These endpoints expose Crustdata REST APIs for frontend usage.
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query, Path

from app.services.crustdata_service import CrustdataService

logger = logging.getLogger(__name__)

router = APIRouter()


def _pick_best_identification_match(matches: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(matches, list) or not matches:
        return None

    # Prefer exact domain match if available
    for m in matches:
        if isinstance(m, dict) and m.get("is_full_domain_match") is True:
            return m

    # Otherwise, take the first match
    first = matches[0]
    return first if isinstance(first, dict) else None


@router.post("/identify")
async def identify_company(payload: Dict[str, Any]):
    """Proxy Crustdata Company Identification API.

    Frontend sends the upstream payload keys (query_company_*). We map them to
    CrustdataService.identify_company args and return the raw matches list.
    """
    try:
        crustdata = CrustdataService()

        exact_match = bool(payload.get("exact_match") or False)
        count = payload.get("count")
        try:
            count_i = int(count) if count is not None else 10
        except Exception:
            count_i = 10

        name = payload.get("query_company_name")
        website = payload.get("query_company_website")
        linkedin_url = payload.get("query_company_linkedin_url")
        crunchbase_url = payload.get("query_company_crunchbase_url")
        company_id = payload.get("query_company_id")

        matches = await crustdata.identify_company(
            name=name,
            website=website,
            linkedin_url=linkedin_url,
            crunchbase_url=crunchbase_url,
            company_id=str(company_id) if company_id is not None else None,
            exact_match=exact_match,
            count=count_i,
        )

        # identify_company returns the upstream JSON (typically a list of matches)
        return matches

    except Exception as e:
        logger.error("Crustdata identify error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Crustdata identify failed: {str(e)}")


@router.get("/enrich")
async def enrich_company(
    company_domain: Optional[str] = Query(default=None),
    company_name: Optional[str] = Query(default=None),
    company_id: Optional[str] = Query(default=None),
    company_linkedin_url: Optional[str] = Query(default=None),
    fields: Optional[str] = Query(default=None),
    exact_match: bool = Query(default=False),
    enrich_realtime: bool = Query(default=False),
):
    """Proxy Crustdata Company Enrichment API.

    Matches the frontend enrichment page which calls:
    GET /api/crustdata/enrich?company_domain=a.com,b.com&fields=...
    """
    try:
        crustdata = CrustdataService()

        # Bulk enrichment when multiple domains are provided
        if company_domain and "," in company_domain:
            domains = [d.strip() for d in company_domain.split(",") if d.strip()]
            result = await crustdata.enrich_companies_by_domain(
                domains=domains,
                fields=fields,
                enrich_realtime=enrich_realtime,
                exact_match=exact_match,
            )
            return result.get("companies") if isinstance(result, dict) and "companies" in result else result

        # Single enrichment
        result = await crustdata.enrich_company(
            domain=company_domain,
            name=company_name,
            linkedin_url=company_linkedin_url,
            company_id=company_id,
            fields=fields,
            enrich_realtime=enrich_realtime,
            exact_match=exact_match,
        )
        return result.get("companies") if isinstance(result, dict) and "companies" in result else result

    except Exception as e:
        logger.error("Crustdata enrich error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Crustdata enrich failed: {str(e)}")


@router.post("/company/search")
async def search_company_realtime(payload: Dict[str, Any]):
    """Proxy Crustdata Realtime Company Search API.
    
    Frontend sends search filters and pagination, returns paginated results.
    """
    try:
        crustdata = CrustdataService()
        
        # Extract search parameters from payload
        filters = payload.get("filters", {})
        page = payload.get("page", 1)
        limit = payload.get("limit", 20)
        
        # Convert page to 1-based index for API
        page = max(1, int(page))
        limit = max(1, min(100, int(limit)))  # Limit between 1-100
        
        # If no filters provided, pass empty object to let API return default results
        if not filters or (isinstance(filters, dict) and not filters):
            filters = {}  # Empty filters for default results
        elif isinstance(filters, dict) and "conditions" in filters:
            # Handle nested filter structure
            if not filters["conditions"]:
                filters = {}
        
        # Call the Crustdata search API
        # Realtime API expects filters as an array and page parameter
        crustdata_payload = {"filters": filters, "page": page, "limit": limit}
        result = await crustdata.search_companies(
            crustdata_filters=crustdata_payload,
            limit=limit
        )
        
        return result
        
    except Exception as e:
        logger.error("Crustdata company search error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Company search failed: {str(e)}")


    try:
        crustdata = CrustdataService()
        
        # Extract search parameters from payload
        filters = payload.get("filters", {})
        page = payload.get("page", 1)
        limit = payload.get("limit", 20)
        
        # Convert page to 1-based index for API
        page = max(1, int(page))
        limit = max(1, min(100, int(limit)))  # Limit between 1-100
        
        # If no filters provided, pass empty object to let API return default results
        if not filters or (isinstance(filters, dict) and not filters):
            filters = {}  # Empty filters for default results
        elif isinstance(filters, dict) and "conditions" in filters:
            # Handle nested filter structure
            if not filters["conditions"]:
                filters = {}
        
        # Call the Crustdata search API
        # Realtime API expects filters as an array and page parameter
        crustdata_payload = {"filters": filters, "page": page, "limit": limit}
        result = await crustdata.search_companies(
            crustdata_filters=crustdata_payload,
            limit=limit
        )
        
        return result
        
    except Exception as e:
        logger.error("Crustdata company database search error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Company database search failed: {str(e)}")


@router.post("/screener/linkedin_posts/keyword_search/")
@router.get("/screener/linkedin_posts/keyword_search/")
async def realtime_linkedin_posts_keyword_search(
    company_domain: str = Path(..., regex=r"[^/]+"),
    page: int = Query(default=1),
    limit: int = Query(default=5, ge=1, le=25),
    post_types: str = Query(default="repost, original"),
    max_reactors: int = Query(default=100),
):
    """Proxy Crustdata Realtime LinkedIn Posts Keyword Search API.
    """
    try:
        crustdata = CrustdataService()
        
        result = await crustdata.realtime_linkedin_posts_keyword_search(
            company_domain=company_domain,
            page=page,
            limit=limit,
            post_types=post_types,
            max_reactors=max_reactors
        )
        
        return result
        
    except Exception as e:
        logger.error("Crustdata LinkedIn posts keyword search error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"LinkedIn posts keyword search failed: {str(e)}")


@router.post("/linkedin_posts/keyword_search")
async def linkedin_posts_keyword_search_post(payload: Dict[str, Any]):
    """Proxy Crustdata LinkedIn Posts Keyword Search API (POST with JSON body).
    Frontend calls POST /api/crustdata/linkedin_posts/keyword_search with body:
    { keyword, page?, limit?, sort_by?, date_posted?, exact_keyword_match?, fields?, max_reactors?, max_comments?, filters? }
    """
    try:
        keyword = payload.get("keyword")
        if not keyword or not str(keyword).strip():
            raise HTTPException(status_code=400, detail="Missing or empty 'keyword' in request body")

        def _int_or_none(key: str):
            v = payload.get(key)
            if v is None:
                return None
            try:
                return int(v)
            except (TypeError, ValueError):
                return None

        crustdata = CrustdataService()
        result = await crustdata.realtime_linkedin_posts_keyword_search(
            keyword=str(keyword).strip(),
            page=_int_or_none("page"),
            limit=_int_or_none("limit"),
            sort_by=str(payload.get("sort_by", "relevance")),
            date_posted=str(payload.get("date_posted", "past-month")),
            exact_keyword_match=bool(payload.get("exact_keyword_match", False)),
            content_type=payload.get("content_type"),
            filters=payload.get("filters"),
            fields=payload.get("fields"),
            max_reactors=_int_or_none("max_reactors"),
            max_comments=_int_or_none("max_comments"),
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Crustdata LinkedIn posts keyword search error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"LinkedIn posts keyword search failed: {str(e)}")


@router.get("/linkedin_posts")
async def linkedin_posts_by_company_query(
    company_domain: Optional[str] = Query(default=None),
    company_name: Optional[str] = Query(default=None),
    company_id: Optional[str] = Query(default=None),
    company_linkedin_url: Optional[str] = Query(default=None),
    linkedin_post_url: Optional[str] = Query(default=None),
    page: int = Query(default=1),
    limit: int = Query(default=5, ge=1, le=100),
    post_types: str = Query(default="repost, original"),
    fields: Optional[str] = Query(default=None),
    max_reactors: int = Query(default=100),
    max_comments: int = Query(default=100),
):
    """Proxy Crustdata GET /screener/linkedin_posts/ - company identifier via query params.
    Per docs: provide exactly one of company_domain, company_name, company_id,
    company_linkedin_url, or linkedin_post_url.
    """
    if not any([company_domain, company_name, company_id, company_linkedin_url, linkedin_post_url]):
        raise HTTPException(
            status_code=400,
            detail="Provide exactly one: company_domain, company_name, company_id, company_linkedin_url, or linkedin_post_url",
        )
    try:
        crustdata = CrustdataService()
        # Crustdata API: "page" and "limit" cannot be sent together. Use only page for pagination.
        result = await crustdata.realtime_linkedin_posts_by_company(
            company_domain=company_domain,
            company_name=company_name,
            company_id=company_id,
            company_linkedin_url=company_linkedin_url,
            linkedin_post_url=linkedin_post_url,
            page=page,
            limit=None,  # do not send limit when using page (API rejects both)
            post_types=post_types,
            fields=fields,
            max_reactors=max_reactors,
            max_comments=max_comments,
        )
        return result
    except Exception as e:
        logger.error("Crustdata LinkedIn posts error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"LinkedIn posts failed: {str(e)}")


@router.get("/linkedin_posts/{company_domain}")
async def linkedin_posts_by_company(
    company_domain: str = Path(..., regex=r"[^/]+"),
    page: int = Query(default=1),
    limit: int = Query(default=5, ge=1, le=25),
    post_types: str = Query(default="repost, original"),
    max_reactors: int = Query(default=100),
    max_comments: int = Query(default=100),
):
    """Proxy Crustdata Realtime LinkedIn Posts by Company API (company_domain in path).
    """
    try:
        crustdata = CrustdataService()
        result = await crustdata.realtime_linkedin_posts_by_company(
            company_domain=company_domain,
            page=page,
            limit=limit,
            post_types=post_types,
            max_reactors=max_reactors,
            max_comments=max_comments
        )
        return result
    except Exception as e:
        logger.error("Crustdata LinkedIn posts error: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"LinkedIn posts failed: {str(e)}")


@router.get("/company/{domain}")
async def get_company_profile(
    domain: str,
    include_posts: bool = Query(default=True),
    posts_limit: int = Query(default=5, ge=1, le=25),
    enrich_realtime: bool = Query(default=False),
):
    """Return a full company profile using Crustdata endpoints (no in-db search).

    Flow:
    1) Identify company (free)
    2) Enrich company with full fields
    3) Optionally fetch recent LinkedIn posts
    """

    try:
        crustdata = CrustdataService()

        identification_matches = await crustdata.identify_company(website=domain, count=5)
        best_match = _pick_best_identification_match(identification_matches)

        company_id = best_match.get("company_id") if best_match else None
        company_name = best_match.get("company_name") if best_match else None
        company_linkedin_url = best_match.get("linkedin_profile_url") if best_match else None

        enrichment = await crustdata.enrich_company(
            domain=domain,
            name=company_name,
            linkedin_url=company_linkedin_url,
            company_id=str(company_id) if company_id else None,
            enrich_realtime=enrich_realtime,
            exact_match=True,
        )

        enrichment_company: Optional[Dict[str, Any]] = None
        if isinstance(enrichment, dict) and isinstance(enrichment.get("companies"), list) and enrichment["companies"]:
            # bulk format
            enrichment_company = enrichment["companies"][0]
        elif isinstance(enrichment, dict):
            # single-company dict format
            enrichment_company = enrichment

        if not enrichment_company:
            raise HTTPException(status_code=404, detail=f"No enrichment data found for domain '{domain}'")

        normalized_company = CrustdataService.normalize_company(enrichment_company)

        posts: Optional[Dict[str, Any]] = None
        if include_posts:
            try:
                posts = await crustdata.realtime_linkedin_posts_by_company(
                    company_domain=domain,
                    limit=posts_limit,
                    page=1,
                )
            except Exception as e:
                # Non-fatal: still return company profile
                logger.warning("LinkedIn posts fetch failed for %s: %s", domain, str(e))
                posts = None

        return {
            "success": True,
            "data": {
                "company": normalized_company,
                "identification": best_match,
                "enrichment": enrichment_company,
                "linkedin_posts": posts,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Crustdata company profile error for %s: %s", domain, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Crustdata company profile failed: {str(e)}")
