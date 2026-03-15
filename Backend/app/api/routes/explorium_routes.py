from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, HTTPException, Request, Depends
from app.services.explorium_service import ExploriumService
from app.services.contactout_service import ContactOutService
from app.services.crustdata_service import CrustdataService
from app.services.nlp_service import NLPService
from app.services.advanced_nlp_service import AdvancedNLPService
from app.services.crustdata.prospect_search_service import ProspectSearchService
from app.db.deps import get_db
from app.db.repositories.company_repository import CompanyRepository
from sqlalchemy.orm import Session

router = APIRouter(tags=["explorium"])
_advanced_nlp_service: AdvancedNLPService | None = None


def get_advanced_nlp_service() -> AdvancedNLPService:
    global _advanced_nlp_service
    if _advanced_nlp_service is None:
        _advanced_nlp_service = AdvancedNLPService()
    return _advanced_nlp_service

@router.post("/search")
async def natural_language_search(payload: Dict[str, Any], request: Request):
    """
    Natural language search endpoint with NLP categorization and filter extraction.
    Uses OpenRouter for intelligent query processing.
    """
    try:
        query = payload.get("query", "")
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")

        print(f">>> [NLP Search] Processing query: '{query}'", flush=True)

        # Extract auth token from the incoming request to forward to internal service calls
        auth_token: Optional[str] = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            auth_token = auth_header[7:]

        # Reuse one NLP service instance to avoid repeated model loads
        advanced_nlp_service = get_advanced_nlp_service()

        print(f">>> [Advanced NLP] Processing query: '{query}'", flush=True)
        print(f">>> [Advanced NLP] API Key present: {bool(advanced_nlp_service.openrouter_api_key)}", flush=True)

        # Process query using LangGraph workflow
        nlp_result = await advanced_nlp_service.process_query(query, auth_token=auth_token)
        
        intent = nlp_result.get("intent", "company")
        filters = nlp_result.get("filters", {})
        confidence = nlp_result.get("confidence", 0)
        
        print(f">>> [NLP] Intent: {intent}, Filters: {filters}, Confidence: {confidence}%", flush=True)

        # Use results already fetched by AdvancedNLPService to avoid duplicate provider calls.
        service_results = nlp_result.get("service_results") or {}
        results = service_results.get("results", []) if isinstance(service_results, dict) else []
        total_count = service_results.get("total_count", len(results)) if isinstance(service_results, dict) else len(results)
        credit_usage = service_results.get("credit_usage") if isinstance(service_results, dict) else None
        
        print(f">>> [NLP] Found {len(results)} results using {intent} search", flush=True)
        
        return {
            "success": True,
            "results": {
                "data": results,
                "total_results": total_count,
                "credit_usage": credit_usage,
            },
            "service_results": service_results,
            "credit_usage": credit_usage,
            "intent": intent,
            "nlp_analysis": {
                "categorized_intent": intent,
                "extracted_filters": filters,
                "confidence": confidence
            }
        }
        
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        print(f">>> [NLP Search] Error: {str(e)}", flush=True)
        return {"success": False, "error": {"message": f"NLP search failed: {str(e)}"}}


@router.get("/autocomplete")
async def autocomplete(field: str, query: str, limit: int | None = None):
    svc = ExploriumService()
    result = await svc.autocomplete_businesses(field, query)
    suggestions = []
    if isinstance(result, dict):
        suggestions = result.get("data") or result.get("suggestions") or []
    elif isinstance(result, list):
        suggestions = result
    if limit and isinstance(limit, int):
        suggestions = suggestions[:limit]
    return {"field": field, "query": query, "suggestions": suggestions}

@router.post("/company/search")
async def search_company(payload: Dict[str, Any], db: Session = Depends(get_db)):
    try:
        filters = payload.get("filters") or {}
        options = payload.get("options") or {}
        limit = int(options.get("limit") or 3)
        page = int(options.get("page") or 1)

        size = max(1, min(3, limit))
        page_size = size

        svc = ExploriumService()
        async def fetch_with_relax(base_filters: Dict[str, Any]) -> list[dict]:
            # Progressive relax: drop keywords -> industry -> company_size
            candidates: list[Dict[str, Any]] = []
            def _drop(keys: list[str]) -> Dict[str, Any]:
                return {k: v for k, v in base_filters.items() if k not in keys}

            candidates.append(base_filters)
            if "keywords" in base_filters:
                candidates.append(_drop(["keywords"]))
            if "industry" in base_filters:
                candidates.append(_drop(["industry"]))
            if "company_size" in base_filters:
                candidates.append(_drop(["company_size"]))
            if "keywords" in base_filters and "industry" in base_filters:
                candidates.append(_drop(["keywords", "industry"]))
            if "keywords" in base_filters and "company_size" in base_filters:
                candidates.append(_drop(["keywords", "company_size"]))
            if "industry" in base_filters and "company_size" in base_filters:
                candidates.append(_drop(["industry", "company_size"]))
            if "keywords" in base_filters and "industry" in base_filters and "company_size" in base_filters:
                candidates.append(_drop(["keywords", "industry", "company_size"]))

            seen = set()
            for f in candidates:
                key = tuple(sorted((k, str(v)) for k, v in f.items()))
                if key in seen:
                    continue
                seen.add(key)
                try:
                    raw = await svc.fetch_businesses(f, size=size, page_size=page_size, page=page, mode="full")
                    data_list = raw.get("data") or []
                    companies = [svc.normalize_company(item) for item in data_list][:size]
                    if companies:
                        return companies
                except Exception:
                    continue
            return []
        # If searching by a specific domain or name, use match endpoint for high precision
        domain = filters.get("domain")
        name = filters.get("name")
        if (domain or name):
            inputs = [{"name": name, "domain": domain}]
            match_res = await svc.match_businesses(inputs)
            matched = match_res.get("matched_businesses") or []
            companies = []
            if matched:
                for item in matched[:size]:
                    bid = item.get("business_id")
                    if not bid:
                        continue
                    # Fetch full business profile using filters with business_id
                    try:
                        raw = await svc.fetch_businesses({"business_id": bid}, size=1, page_size=1, page=1, mode="full")
                        data_list = raw.get("data") or []
                        companies.extend([svc.normalize_company(x) for x in data_list])
                    except httpx.HTTPStatusError as e:
                        msg = ""
                        try:
                            msg = e.response.text or str(e)
                        except Exception:
                            msg = str(e)
                        if e.response is not None and e.response.status_code == 403 and ("insufficient credits" in msg.lower()):
                            if domain:
                                try:
                                    co = ContactOutService()
                                    enr = await co.enrich_companies_by_domain([domain])
                                    co_companies = enr.get("companies", {})
                                    normalized = {}
                                    if isinstance(co_companies, dict) and domain in co_companies:
                                        normalized = ContactOutService.normalize_company_enrichment({domain: co_companies[domain]})
                                    elif isinstance(co_companies, list) and len(co_companies) > 0:
                                        normalized = ContactOutService.normalize_company_enrichment(co_companies[0] if isinstance(co_companies[0], dict) else {})
                                    if normalized:
                                        companies.append(normalized)
                                        # short-circuit return since we have at least one company
                                        return {
                                            "success": True,
                                            "data": {
                                                "companies": companies[:size],
                                                "total_count": len(companies[:size]),
                                                "page": page,
                                                "total_pages": 1,
                                            }
                                        }
                                except Exception:
                                    pass
                        # re-raise if not a credit error or fallback failed
                        raise
            else:
                # No matches from the match endpoint; fallback to a broader fetch using provided filters
                try:
                    raw = await svc.fetch_businesses(filters, size=size, page_size=page_size, page=page, mode="full")
                    data_list = raw.get("data") or []
                    companies = [svc.normalize_company(item) for item in data_list][:size]
                    if not companies:
                        companies = await fetch_with_relax(filters)
                except Exception:
                    # preserve behavior: raise to outer handler
                    raise
        else:
            try:
                raw = await svc.fetch_businesses(filters, size=size, page_size=page_size, page=page, mode="full")
                data_list = raw.get("data") or []
                companies = [svc.normalize_company(item) for item in data_list][:size]
                if not companies:
                    companies = await fetch_with_relax(filters)
            except httpx.HTTPStatusError as e:
                msg = ""
                try:
                    msg = e.response.text or str(e)
                except Exception:
                    msg = str(e)
                # Fallback: if insufficient credits, try ContactOut enrichment when domain provided
                if e.response is not None and e.response.status_code == 403 and ("insufficient credits" in msg.lower()):
                    domain_fallback = filters.get("domain")
                    if domain_fallback:
                        try:
                            co = ContactOutService()
                            enr = await co.enrich_companies_by_domain([domain_fallback])
                            co_companies = enr.get("companies", {})
                            normalized = {}
                            if isinstance(co_companies, dict) and domain_fallback in co_companies:
                                normalized = ContactOutService.normalize_company_enrichment({domain_fallback: co_companies[domain_fallback]})
                            elif isinstance(co_companies, list) and len(co_companies) > 0:
                                # Take first available
                                normalized = ContactOutService.normalize_company_enrichment(co_companies[0] if isinstance(co_companies[0], dict) else {})
                            companies = [normalized] if normalized else []
                            if companies:
                                return {
                                    "success": True,
                                    "data": {
                                        "companies": companies,
                                        "total_count": len(companies),
                                        "page": page,
                                        "total_pages": 1,
                                    }
                                }
                        except Exception:
                            pass
                    # If no domain, bubble to generic error handling below
                raise

        # Optional enrichment using ContactOut to increase field coverage
        try:
            # Build domain list
            domains = [c.get("domain") for c in companies if c.get("domain")]
            if domains:
                co = ContactOutService()
                enrich_res = await co.enrich_companies_by_domain(domains)
                co_companies = enrich_res.get("companies", {})
                enriched_by_domain: Dict[str, Dict[str, Any]] = {}
                if isinstance(co_companies, dict):
                    for d, obj in co_companies.items():
                        enriched_by_domain[d] = ContactOutService.normalize_company_enrichment({d: obj})
                elif isinstance(co_companies, list):
                    for item in co_companies:
                        if isinstance(item, dict):
                            for d, obj in item.items():
                                enriched_by_domain[d] = ContactOutService.normalize_company_enrichment({d: obj})
                # Merge enriched fields into explorium company objects
                def merge_company(base: Dict[str, Any], enrich: Dict[str, Any]) -> Dict[str, Any]:
                    if not enrich: return base
                    merged = dict(base)
                    
                    # Direct mapping for specific enrichment keys
                    # We use normalization now, so keys like 'revenue_exact' should align
                    for k, v in enrich.items():
                        if k in ("provider_source", "raw_data", "id"):
                            continue
                        if v in (None, "", [], {}):
                            continue
                        
                        # Only take if base is missing or empty
                        bv = merged.get(k)
                        if bv in (None, "", [], {}, 0):
                            merged[k] = v
                            
                    # Explicit fallbacks for non-aligned keys
                    if enrich.get("revenue") and (merged.get("revenue_exact") in (None, 0)):
                        merged["revenue_exact"] = enrich.get("revenue")
                    if enrich.get("type") and not merged.get("company_type"):
                        merged["company_type"] = enrich.get("type")

                    # If revenue_exact is a string, let the ExploriumService normalize it later
                    # (but search_companies actually just returns 'companies' at the end)
                    # To be safe, run normalize on the merged object
                    return svc.normalize_company(merged)
                companies = [merge_company(c, enriched_by_domain.get(c.get("domain", ""), {})) for c in companies]
        except Exception:
            # Ignore enrichment errors to avoid failing the search
            pass
        # Optional firmographics enrichment for top results to increase NAICS/size/revenue coverage
        try:
            import logging
            logger = logging.getLogger(__name__)
            
            svc_f = ExploriumService()
            enriched_companies = []
            logger.info(f"[Search] Starting enrichment for {len(companies[:size])} companies")
            print(f">>> [Search] Starting enrichment for {len(companies[:size])} companies", flush=True)
            
            for idx, base in enumerate(companies[:size]):
                domain = base.get('domain', 'unknown')
                logger.info(f"[Search] Enriching company {idx+1}/{len(companies[:size])}: domain={domain}")
                try:
                    enriched = await svc_f.enrich_company_fully(base)
                    enriched_companies.append(enriched)
                    logger.info(f"[Search] Successfully enriched {domain}: logo={bool(enriched.get('logo_url'))}, revenue={bool(enriched.get('revenue_exact'))}, investors={len(enriched.get('investors', []))}, tech={len(enriched.get('technologies', []))}")
                    print(f">>> [Search] Enriched {domain}: Logo={bool(enriched.get('logo_url'))}, Rev={enriched.get('revenue_exact')}, Inv={len(enriched.get('investors', []))}, Tech={len(enriched.get('technologies', []))}", flush=True)
                except Exception as enrich_err:
                    logger.error(f"[Search] Enrichment failed for {domain}: {type(enrich_err).__name__}: {str(enrich_err)}")
                    print(f">>> [Search] Enrichment FAILED for {domain}: {str(enrich_err)}", flush=True)
                    enriched_companies.append(base)  # Use base data if enrichment fails

            companies = enriched_companies
            logger.info(f"[Search] Completed enrichment for {len(enriched_companies)} companies")
            print(f">>> [Search] Completed enrichment for {len(enriched_companies)} companies", flush=True)
        except Exception as e:
            logger.error(f"[Search] Enrichment loop failed: {type(e).__name__}: {str(e)}")
            print(f">>> [Search] Enrichment loop FAILED: {str(e)}", flush=True)
            pass
        # Crustdata enrichment disabled for this route - using only Explorium + ContactOut
        # This avoids 401 authentication errors with Crustdata API
        pass

        # Prefer companies with more filled fields
        def filled_count(obj: Dict[str, Any]) -> int:
            count = 0
            for k, v in obj.items():
                if k in ("id", "domain", "provider_source"):
                    continue
                if v is None:
                    continue
                if isinstance(v, str) and v.strip() == "":
                    continue
                if isinstance(v, list) and len(v) == 0:
                    continue
                count += 1
            return count
        companies = sorted(companies, key=lambda x: filled_count(x), reverse=True)[:size]
        # Sanitize for JSON: convert any sets to lists
        for i in range(len(companies)):
            for k, v in list(companies[i].items()):
                if isinstance(v, set):
                    companies[i][k] = list(v)

        # Persist top results into DB for future enrichment/restore
        try:
            for company in companies[:size]:
                domain = (company.get("domain") or "").strip().lower()
                if not domain:
                    continue
                CompanyRepository.create_or_update(
                    db=db,
                    domain=domain,
                    raw_data=company,
                    provider_source=company.get("provider_source") or "explorium",
                    name=company.get("name"),
                    website=company.get("website"),
                    description=company.get("description"),
                    industry=company.get("industry"),
                    sub_industry=company.get("sub_industry"),
                    employee_count_range=company.get("employee_count_range"),
                    employee_count_exact=company.get("employee_count_exact"),
                    revenue_range=company.get("revenue_range"),
                    revenue_exact=company.get("revenue_exact"),
                    headquarters_country=company.get("headquarters_country"),
                    headquarters_state=company.get("headquarters_state"),
                    headquarters_city=company.get("headquarters_city"),
                    headquarters_address=company.get("headquarters_address"),
                    founded_year=company.get("founded_year"),
                    company_type=company.get("company_type"),
                    stock_symbol=company.get("stock_symbol"),
                    phone=company.get("phone"),
                    technologies=company.get("technologies"),
                    categories=company.get("categories") or company.get("specialties"),
                    funding_stage=company.get("funding_stage"),
                    funding_total=company.get("funding_total"),
                    last_funding_date=company.get("last_funding_date"),
                    employee_growth_6m=company.get("employee_growth_6m"),
                    employee_growth_12m=company.get("employee_growth_12m"),
                    employee_growth_6m_percent=company.get("employee_growth_6m_percent"),
                    employee_growth_12m_percent=company.get("employee_growth_12m_percent"),
                    linkedin_url=company.get("linkedin_url"),
                    twitter_url=company.get("twitter_url"),
                    facebook_url=company.get("facebook_url"),
                    follower_count=company.get("follower_count"),
                    external_id=company.get("id"),
                    enriched=bool(company.get("enriched")),
                    data_quality_score=company.get("quality_score") or company.get("data_quality_score"),
                    last_enriched_at=company.get("last_enriched_at"),
                )
        except Exception:
            pass

        return {
            "success": True,
            "data": {
                "companies": companies,
                "total_count": len(companies),
                "page": page,
                "total_pages": 1,
            }
        }
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"Explorium search failed: {str(e)}"}}

@router.post("/technographics")
async def get_technographics(payload: Dict[str, Any]):
    """
    Get technology stack information for a company using Explorium Technographics enrichment.
    Accepts either `business_id` or `domain` and resolves to business_id via Match API.
    """
    try:
        svc = ExploriumService()
        business_id = (payload or {}).get("business_id")
        domain = (payload or {}).get("domain")
        name = (payload or {}).get("name")
        if not business_id:
            if not domain and not name:
                raise HTTPException(status_code=400, detail="Provide business_id or domain/name")
            match = await svc.match_businesses([{"domain": domain, "name": name}])
            matched = match.get("matched_businesses") or []
            if not matched:
                return {"success": False, "error": {"message": "No match found"}}
            business_id = matched[0].get("business_id")
        data = await svc.enrich_technographics(business_id)
        return {"success": True, "data": data.get("data")}
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"Technographics failed: {str(e)}"}}

@router.post("/social-media-presence")
async def get_social_media_presence(payload: Dict[str, Any]):
    """
    Get LinkedIn posts for a company via Explorium LinkedIn Posts enrichment.
    Accepts either `business_id` or `domain` and resolves to business_id via Match API.
    """
    try:
        svc = ExploriumService()
        business_id = (payload or {}).get("business_id")
        domain = (payload or {}).get("domain")
        name = (payload or {}).get("name")
        if not business_id:
            if not domain and not name:
                raise HTTPException(status_code=400, detail="Provide business_id or domain/name")
            match = await svc.match_businesses([{"domain": domain, "name": name}])
            matched = match.get("matched_businesses") or []
            if not matched:
                return {"success": False, "error": {"message": "No match found"}}
            business_id = matched[0].get("business_id")
        data = await svc.enrich_linkedin_posts(business_id)
        return {"success": True, "data": data.get("data")}
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"LinkedIn posts failed: {str(e)}"}}

@router.post("/business-intent")
async def get_business_intent(payload: Dict[str, Any]):
    """
    Get business intent topics via Bombora Intent enrichment.
    Accepts either `business_id` or `domain` and resolves to business_id via Match API.
    """
    try:
        svc = ExploriumService()
        business_id = (payload or {}).get("business_id")
        domain = (payload or {}).get("domain")
        name = (payload or {}).get("name")
        min_score = (payload or {}).get("min_score")
        topic_parameters = (payload or {}).get("topic_parameters")
        if not business_id:
            if not domain and not name:
                raise HTTPException(status_code=400, detail="Provide business_id or domain/name")
            match = await svc.match_businesses([{"domain": domain, "name": name}])
            matched = match.get("matched_businesses") or []
            if not matched:
                return {"success": False, "error": {"message": "No match found"}}
            business_id = matched[0].get("business_id")
        data = await svc.enrich_bombora_intent(business_id, min_score=min_score, topic_parameters=topic_parameters)
        return {"success": True, "data": data.get("data")}
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"Business intent failed: {str(e)}"}}

@router.post("/firmographics")
async def get_firmographics(payload: Dict[str, Any]):
    """
    Get firmographics enrichment for a company.
    Accepts either `business_id` or `domain`/`name` and resolves to business_id via Match API.
    """
    try:
        svc = ExploriumService()
        business_id = (payload or {}).get("business_id")
        domain = (payload or {}).get("domain")
        name = (payload or {}).get("name")
        if not business_id:
            if not domain and not name:
                raise HTTPException(status_code=400, detail="Provide business_id or domain/name")
            match = await svc.match_businesses([{"domain": domain, "name": name}])
            matched = match.get("matched_businesses") or []
            if not matched:
                return {"success": False, "error": {"message": "No match found"}}
            business_id = matched[0].get("business_id")
        data = await svc.enrich_firmographics(business_id)
        return {"success": True, "data": data.get("data")}
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"Firmographics failed: {str(e)}"}}

@router.post("/funding")
async def get_funding(payload: Dict[str, Any]):
    """
    Get funding and acquisition enrichment for a company.
    Accepts either `business_id` or `domain`/`name` and resolves to business_id via Match API.
    """
    try:
        svc = ExploriumService()
        business_id = (payload or {}).get("business_id")
        domain = (payload or {}).get("domain")
        name = (payload or {}).get("name")
        if not business_id:
            if not domain and not name:
                raise HTTPException(status_code=400, detail="Provide business_id or domain/name")
            match = await svc.match_businesses([{"domain": domain, "name": name}])
            matched = match.get("matched_businesses") or []
            if not matched:
                return {"success": False, "error": {"message": "No match found"}}
            business_id = matched[0].get("business_id")
        data = await svc.enrich_funding_and_acquisition(business_id)
        return {"success": True, "data": data.get("data")}
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"Funding enrichment failed: {str(e)}"}}
@router.post("/linkedin-insights")
async def get_linkedin_insights(payload: Dict[str, Any]):
    """
    Get LinkedIn posts/insights via Explorium LinkedIn Posts enrichment.
    Accepts either `business_id` or `domain` and resolves to business_id via Match API.
    """
    try:
        svc = ExploriumService()
        business_id = (payload or {}).get("business_id")
        domain = (payload or {}).get("domain")
        name = (payload or {}).get("name")
        if not business_id:
            if not domain and not name:
                raise HTTPException(status_code=400, detail="Provide business_id or domain/name")
            match = await svc.match_businesses([{"domain": domain, "name": name}])
            matched = match.get("matched_businesses") or []
            if not matched:
                return {"success": False, "error": {"message": "No match found"}}
            business_id = matched[0].get("business_id")
        data = await svc.enrich_linkedin_posts(business_id)
        return {"success": True, "data": data.get("data")}
    except HTTPException as e:
        return {"success": False, "error": {"message": str(e.detail)}}
    except Exception as e:
        return {"success": False, "error": {"message": f"LinkedIn insights failed: {str(e)}"}}
