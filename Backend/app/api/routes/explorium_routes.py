from typing import Any, Dict
import httpx
from fastapi import APIRouter, HTTPException
from app.services.explorium_service import ExploriumService
from app.services.contactout_service import ContactOutService
from app.services.crustdata_service import CrustdataService

router = APIRouter(tags=["explorium"])

@router.post("/company/search")
async def search_company(payload: Dict[str, Any]):
    try:
        filters = payload.get("filters") or {}
        options = payload.get("options") or {}
        limit = int(options.get("limit") or 3)
        page = int(options.get("page") or 1)

        size = max(1, min(3, limit))
        page_size = size

        svc = ExploriumService()
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
                except Exception:
                    # preserve behavior: raise to outer handler
                    raise
        else:
            try:
                raw = await svc.fetch_businesses(filters, size=size, page_size=page_size, page=page, mode="full")
                data_list = raw.get("data") or []
                companies = [svc.normalize_company(item) for item in data_list][:size]
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
