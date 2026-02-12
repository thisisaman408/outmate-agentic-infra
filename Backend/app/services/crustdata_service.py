"crustdata_service.py"
import httpx
import os
import json
import logging
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse
from datetime import datetime
import re
from app.core.config import settings

logger = logging.getLogger(__name__)
def _extract_domain(website: str) -> str:
    """
    Pull a clean domain out of a website URL.
    Examples:
        "http://www.mashreq.com/rise"  →  "mashreq.com"
        "https://google.com"           →  "google.com"
        "mashreq.com"                  →  "mashreq.com"
        ""                             →  ""
    """
    if not website:
        return ""
    # urlparse needs a scheme to work correctly
    if not website.startswith(("http://", "https://")):
        website = "https://" + website
    try:
        hostname = urlparse(website).hostname or ""
        # strip leading "www."
        return hostname.replace("www.", "").lower()
    except Exception:
        return ""

class CrustdataService:
    """
    Service for interacting with Crustdata API.
    Updated with all endpoints from documentation.
    """

    def __init__(self):
        self.api_key = settings.CRUSTDATA_API_KEY
        self.base_url = settings.CRUSTDATA_BASE_URL
        self.timeout = settings.CRUSTDATA_TIMEOUT
        
        # Debug: Print environment variables
        print(f">>> CrustdataService: API key configured: {bool(self.api_key and self.api_key != 'your_crustdata_api_key_here')}", flush=True)
        print(f">> CrustdataService: Base URL: {self.base_url}", flush=True)
        
        if not self.api_key or self.api_key == "your_crustdata_api_key_here":
            logger.warning("Crustdata API key not configured or using placeholder value")

    def _get_headers(self) -> Dict[str, str]:
        """Generate headers for API requests."""
        return {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def _masked_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        try:
            masked = {}
            for k, v in headers.items():
                if not isinstance(v, str):
                    masked[k] = v
                elif 'token' in k.lower() or 'authorization' in k.lower() or 'api' in k.lower():
                    masked[k] = (v[:8] + '...') if v else ''
                else:
                    masked[k] = v
            return masked
        except Exception:
            return {k: '***' for k in headers.keys()}

    @staticmethod
    def _sanitize_enrichment_fields(fields: Optional[str]) -> Optional[str]:
        """Sanitize `fields` for GET /screener/company.

        Crustdata returns 400 when requesting fields that are:
        - Unknown
        - Nested beyond allowed depth
        - Not permitted for the current token

        We only allow a conservative set that is explicitly referenced in the docs.
        """
        if not fields or not isinstance(fields, str):
            return None

        allowed_top_level = {
            "headcount",
            "competitors",
            "funding_and_investment",
            "g2",
            "gartner",
            "glassdoor",
            "job_openings",
            "linkedin_followers",
            "news_articles",
            "producthunt",
            "seo",
            "taxonomy",
            "web_traffic",
            "founders",
            "decision_makers",
            "cxos",
            "all_office_addresses",
        }

        allowed_prefixes = (
            "founders.",
            "gartner.",
        )

        cleaned: List[str] = []
        for raw in fields.split(","):
            f = (raw or "").strip()
            if not f:
                continue
            if f in allowed_top_level or f.startswith(allowed_prefixes):
                cleaned.append(f)

        # De-dupe while preserving order
        cleaned = list(dict.fromkeys(cleaned))
        return ",".join(cleaned) if cleaned else None

    # 1. Identification API - POST /screener/identify
    async def identify_company(
        self,
        name: Optional[str] = None,
        website: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        crunchbase_url: Optional[str] = None,
        company_id: Optional[str] = None,
        exact_match: bool = False,
        count: int = 10
    ) -> Dict[str, Any]:
        """Company Identification API - Lookup/Identify."""
        try:
            payload = {
                "exact_match": exact_match,
                "count": count
            }
            if name:
                payload["query_company_name"] = name
            if website:
                payload["query_company_website"] = website
            if linkedin_url:
                payload["query_company_linkedin_url"] = linkedin_url
            if crunchbase_url:
                payload["query_company_crunchbase_url"] = crunchbase_url
            if company_id:
                payload["query_company_id"] = company_id

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/screener/identify",
                    headers=self._get_headers(),
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            raise Exception(f"Company identification failed: {str(e)}")

    # 2. Enrichment API - GET /screener/company
    async def enrich_company(
        self,
        domain: Optional[str] = None,
        name: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        company_id: Optional[str] = None,
        fields: Optional[str] = None,
        enrich_realtime: bool = False,
        exact_match: bool = True  # Changed from False to True
    ) -> Dict[str, Any]:
        """Company Enrichment API - Retrieve detailed profile."""
        print(f">>> CRUSTDATA ENRICH_COMPANY CALLED: domain={domain}, name={name}, fields={fields}", flush=True)
        try:
            # Replicates doc's "previous default behavior" fields, but sanitized.
            if not fields:
                fields = (
                    "headcount,competitors,funding_and_investment,g2,gartner,glassdoor,"
                    "job_openings,linkedin_followers,news_articles,producthunt,seo,taxonomy,"
                    "web_traffic,decision_makers,founders,cxos,all_office_addresses,location"
                )

            safe_fields = self._sanitize_enrichment_fields(fields)
            print(f">>> CRUSTDATA SAFE_FIELDS: {safe_fields}", flush=True)
            params = {
                "enrich_realtime": str(enrich_realtime).lower(),
                "exact_match": str(exact_match).lower(),
            }
            if safe_fields:
                params["fields"] = safe_fields
            if domain:
                # Pass company_domain as-is - let httpx handle the encoding properly
                params["company_domain"] = domain

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = self._get_headers()
                print(f">>> Crustdata request headers: {json.dumps(self._masked_headers(headers))} params: {params}", flush=True)
                try:
                    response = await client.get(
                        f"{self.base_url}/screener/company",
                        headers=headers,
                        params=params
                    )
                    response.raise_for_status()
                    data = response.json()
                except httpx.HTTPStatusError as e:
                    # If we received 401, try an alternative Authorization header format
                    if e.response is not None and e.response.status_code == 401 and self.api_key:
                        alt_headers = headers.copy()
                        alt_headers["Authorization"] = f"Bearer {self.api_key}"
                        print(
                            f">>> Crustdata 401 received, retrying with alt headers: {json.dumps(self._masked_headers(alt_headers))}",
                            flush=True,
                        )
                        retry = await client.get(
                            f"{self.base_url}/screener/company",
                            headers=alt_headers,
                            params=params,
                        )
                        print(f">>> Crustdata retry status: {retry.status_code}", flush=True)
                        retry.raise_for_status()
                        data = retry.json()
                    else:
                        raise

                # Handle bulk response format (array of companies)
                if isinstance(data, list):
                    return {"companies": data}
                return data
        except Exception as e:
            raise Exception(f"Company enrichment failed: {str(e)}")

    async def enrich_companies_by_domain(
        self,
        domains: List[str],
        fields: Optional[str] = None,
        enrich_realtime: bool = False,
        exact_match: bool = False,
    ) -> Dict[str, Any]:
        """Bulk enrichment by domain using GET /screener/company.

        Crustdata supports passing multiple domains as a comma-separated string.
        """
        def _is_valid_domain(d: str) -> bool:
            if not d:
                return False
            dl = d.strip().lower()
            if any(x in dl for x in ["linkedin.com", "lnkd.in"]):
                return False
            # Basic domain shape; allow short domains like goo.gle
            return re.match(r"^[a-z0-9.-]+\.[a-z]{2,}$", dl) is not None

        def _default_fields() -> str:
            # Keep this conservative and aligned with docs to avoid 400s.
            return "headcount,web_traffic,funding_and_investment,linkedin_followers,job_openings,news_articles,taxonomy"

        def _fallback_field_sets() -> List[str]:
            # Progressive degradation to reduce probability of 400 due to permissions/unknown fields.
            return [
                _default_fields(),
                "headcount,web_traffic,funding_and_investment",
                "headcount,web_traffic",
                "headcount",
            ]

        try:
            raw_domains = [d.strip().lower() for d in (domains or []) if isinstance(d, str) and d.strip()]
            domains = [d for d in raw_domains if _is_valid_domain(d)]
            domains = list(dict.fromkeys(domains))
            domains = domains[:25]

            if not domains:
                return {"companies": []}

            # First attempt: bulk enrichment
            attempt_fields = self._sanitize_enrichment_fields(fields) or _default_fields()

            params = {
                "enrich_realtime": str(enrich_realtime).lower(),
                "exact_match": str(exact_match).lower(),
                "company_domain": ",".join(domains),
                "fields": attempt_fields,
            }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    response = await client.get(
                        f"{self.base_url}/screener/company",
                        headers=self._get_headers(),
                        params=params,
                    )
                    response.raise_for_status()
                    data = response.json()
                    if isinstance(data, list):
                        return {"companies": data}
                    return data
                except httpx.HTTPStatusError as e:
                    # Retry with progressively smaller field sets on 400.
                    if e.response is not None and e.response.status_code == 400:
                        for fs in _fallback_field_sets():
                            params["fields"] = fs
                            retry = await client.get(
                                f"{self.base_url}/screener/company",
                                headers=self._get_headers(),
                                params=params,
                            )
                            if retry.status_code == 400:
                                continue
                            retry.raise_for_status()
                            data = retry.json()
                            if isinstance(data, list):
                                return {"companies": data}
                            return data
                    raise

        except Exception as bulk_error:
            # Fallback: per-domain enrichment so one bad identifier doesn't break all
            companies: List[Dict[str, Any]] = []
            for d in domains[:25]:
                try:
                    one = await self.enrich_company(
                        domain=d,
                        fields=self._sanitize_enrichment_fields(fields) or _default_fields(),
                        exact_match=exact_match,
                        enrich_realtime=enrich_realtime,
                    )
                    if isinstance(one, dict) and isinstance(one.get("companies"), list) and one["companies"]:
                        companies.append(one["companies"][0])
                    elif isinstance(one, dict) and one:
                        companies.append(one)
                except Exception as e:
                    logger.warning("Per-domain enrichment failed for %s: %s", d, str(e))

            if companies:
                return {"companies": companies}
            raise Exception(f"Bulk company enrichment failed: {str(bulk_error)}")

    # 3. In-DB: Company Search API - POST /screener/companydb/search
    async def in_db_company_search(
        self,
        filters: Dict[str, Any],
        cursor: Optional[str] = None,
        limit: int = 20,
        sorts: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """In-DB Company Search API - Search with stored database filters."""
        try:
            # Comprehensive fields to get rich data from Crustdata
            comprehensive_fields = (
                "company_name,website,company_website_url,domain,year_founded,company_type,"
                "description,short_description,long_description,seo_description,"
                "headquarters_city,headquarters_state,headquarters_country,headquarters_region,location,"
                "linkedin_url,twitter_url,facebook_url,instagram_url,crunchbase_url,"
                "employee_count,employee_count_range,"
                "estimated_revenue_lower_bound_usd,estimated_revenue_higher_bound_usd,"
                "linkedin_industries,technologies,categories,"
                "headcount_growth,web_traffic,funding_and_investment,competitors,glassdoor,"
                "job_openings,linkedin_followers,news_articles,producthunt,seo,"
                "founders,decision_makers,cxos,g2,gartner"
            )
            
            payload = {
                "filters": filters.get("filters", {}),
                "limit": limit,
                "fields": comprehensive_fields
            }
            if "page" in filters:
                payload["page"] = filters["page"]

            print(">>> Final payload to Crustdata:", json.dumps(payload, indent=2), flush=True)
            if cursor:
                payload["cursor"] = cursor
            if sorts:
                payload["sorts"] = sorts

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                print(f">>> Sending request to: {self.base_url}/screener/companydb/search", flush=True)
                response = await client.post(
                    f"{self.base_url}/screener/companydb/search",
                    headers=self._get_headers(),
                    json=payload
                )
                print(f">>> Crustdata Response Status: {response.status_code}", flush=True)
                if response.status_code != 200:
                    print(f">>> Crustdata Error Response: {response.text}", flush=True)
                
                response.raise_for_status()
                return response.json()
        except Exception as e:
            if isinstance(e, httpx.HTTPStatusError):
                try:
                    error_body = e.response.json()
                    print(">>> CRUSTDATA ERROR BODY:", json.dumps(error_body, indent=2), flush=True)
                except:
                    print(">>> CRUSTDATA RAW ERROR:", e.response.text, flush=True)
            print(f">>> Exception in in_db_company_search: {str(e)}")
            raise

    # 4. Realtime: Company Search API - POST /screener/company/search
    async def realtime_company_search(
        self,
        filters: List[Dict[str, Any]],
        page: int = 1
    ) -> Dict[str, Any]:
        """Realtime Company Search API - Dynamic search."""
        try:
            # Comprehensive fields to get rich data from Crustdata
            comprehensive_fields = (
                "headcount,web_traffic,funding_and_investment,competitors,glassdoor,"
                "job_openings,linkedin_followers,news_articles,producthunt,seo,"
                "taxonomy,founders,decision_makers,cxos,g2,gartner"
            )
            
            payload = {
                "filters": filters,
                "page": page,
                "fields": comprehensive_fields
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/screener/company/search",
                    headers=self._get_headers(),
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            raise Exception(f"Realtime company search failed: {str(e)}")

    # 5. Realtime: LinkedIn Posts by Company API - GET /screener/linkedin_posts/
    async def realtime_linkedin_posts_by_company(
        self,
        company_name: Optional[str] = None,
        company_domain: Optional[str] = None,
        company_id: Optional[str] = None,
        company_linkedin_url: Optional[str] = None,
        linkedin_post_url: Optional[str] = None,
        fields: Optional[str] = None,
        page: Optional[int] = 1,
        limit: Optional[int] = 5,
        post_types: str = "repost, original",
        max_reactors: int = 100,
        max_comments: int = 100
    ) -> Dict[str, Any]:
        """Realtime LinkedIn Posts by Company API - Fetch recent posts."""
        try:
            # If no API key or it's the placeholder, return mock data for testing
            if not self.api_key or self.api_key == "your_crustdata_api_key_here":
                print(">>> CrustdataService: Using mock LinkedIn posts data (no API key configured)", flush=True)
                return {
                    "posts": [
                        {
                            "backend_urn": "urn:li:activity:mock_1",
                            "text": "Excited to announce our latest product launch! #innovation #tech",
                            "created_at": "2024-01-15T10:30:00Z",
                            "num_likes": 150,
                            "num_comments": 25,
                            "num_shares": 12,
                            "is_repost_without_thoughts": False,
                            "reactors": [
                                {
                                    "name": "John Doe",
                                    "linkedin_profile_url": "https://linkedin.com/in/johndoe",
                                    "reaction_type": "LIKE",
                                    "profile_image_url": "https://example.com/avatar1.jpg",
                                    "title": "CEO at TechCorp",
                                    "location": "San Francisco, CA"
                                }
                            ],
                            "comments": [
                                {
                                    "author_name": "Jane Smith",
                                    "text": "Congratulations! This looks amazing!",
                                    "created_at": "2024-01-15T11:00:00Z"
                                }
                            ]
                        },
                        {
                            "backend_urn": "urn:li:activity:mock_2",
                            "text": "We're hiring! Join our amazing team. #hiring #careers",
                            "created_at": "2024-01-10T14:20:00Z",
                            "num_likes": 89,
                            "num_comments": 15,
                            "num_shares": 8,
                            "is_repost_without_thoughts": False
                        }
                    ],
                    "total_count": 2,
                    "page": page if page is not None else 1,
                    "limit": limit if limit is not None else 5
                }
            
            # Crustdata requires at least one company identifier (company_domain, company_id, etc.)
            # Docs: GET /screener/linkedin_posts/?company_domain=...
            company_domain_param = company_domain
            if company_domain and not company_domain.startswith(("http://", "https://")):
                company_domain_param = "https://" + company_domain.strip()

            # Crustdata: "page" and "limit" cannot be provided together. Send exactly one.
            params = {"post_types": post_types}
            if page is not None:
                params["page"] = page
            elif limit is not None:
                params["limit"] = limit
            else:
                params["page"] = 1

            # Add exactly one company identifier per API requirement
            if company_domain_param:
                params["company_domain"] = company_domain_param
            elif company_name:
                params["company_name"] = company_name
            elif company_id:
                params["company_id"] = company_id
            elif company_linkedin_url:
                params["company_linkedin_url"] = company_linkedin_url
            elif linkedin_post_url:
                params["linkedin_post_url"] = linkedin_post_url
            else:
                raise ValueError("At least one company identifier or linkedin_post_url is required")

            if fields and str(fields).strip():
                params["fields"] = str(fields).strip()
            # API: 'reactors' is required in fields when 'max_reactors' is provided (same for comments)
            fields_lower = (fields or "").lower()
            if "reactors" in fields_lower:
                params["max_reactors"] = max_reactors
            if "comments" in fields_lower:
                params["max_comments"] = max_comments

            # Docs: latency 30-60 seconds for this endpoint
            timeout_sec = max(self.timeout, 90)
            async with httpx.AsyncClient(timeout=timeout_sec) as client:
                response = await client.get(
                    f"{self.base_url}/screener/linkedin_posts/",
                    headers=self._get_headers(),
                    params=params
                )
                if response.status_code >= 400:
                    try:
                        err_body = response.json()
                        if isinstance(err_body.get("non_field_errors"), list) and err_body["non_field_errors"]:
                            msg = "; ".join(err_body["non_field_errors"])
                        else:
                            msg = err_body.get("detail") or err_body.get("message") or response.text
                    except Exception:
                        msg = response.text
                    raise Exception(f"LinkedIn posts by company failed: {response.status_code} - {msg}")
                return response.json()
        except Exception as e:
            raise Exception(f"LinkedIn posts by company failed: {str(e)}")

    async def realtime_linkedin_posts_keyword_search(
        self,
        keyword: str,
        page: Optional[int] = None,
        limit: Optional[int] = None,
        sort_by: str = "relevance",
        date_posted: str = "past-month",
        exact_keyword_match: bool = False,
        content_type: Optional[List[str]] = None,
        filters: Optional[List[Dict[str, Any]]] = None,
        fields: Optional[str] = None,
        max_reactors: Optional[int] = None,
        max_comments: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Realtime LinkedIn Posts Keyword Search - Posts with keywords.

        Crustdata API rule: 'limit' and 'page' cannot be provided together.
        Send exactly one: use limit for exact_keyword_match or bulk; use page for pagination.
        """
        try:
            # API forbids sending both page and limit; send exactly one
            if exact_keyword_match:
                use_page, use_limit = None, limit if limit is not None else 5
            else:
                # Normal search: prefer page for pagination; if client sent only limit, use that
                if page is not None:
                    use_page, use_limit = page, None
                elif limit is not None:
                    use_page, use_limit = None, limit
                else:
                    use_page, use_limit = 1, None  # default first page

            payload = {
                "keyword": keyword,
                "sort_by": sort_by,
                "date_posted": date_posted,
                "exact_keyword_match": exact_keyword_match,
            }
            if use_page is not None:
                payload["page"] = use_page
            if use_limit is not None:
                payload["limit"] = use_limit
            if content_type:
                payload["content_type"] = content_type
            if filters:
                payload["filters"] = filters
            if fields and str(fields).strip():
                payload["fields"] = str(fields).strip()
            if max_reactors is not None and max_reactors >= 0:
                payload["max_reactors"] = max_reactors
            if max_comments is not None and max_comments >= 0:
                payload["max_comments"] = max_comments

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/screener/linkedin_posts/keyword_search/",
                    headers=self._get_headers(),
                    json=payload
                )
                if response.status_code >= 400:
                    try:
                        err_body = response.json()
                        if isinstance(err_body.get("non_field_errors"), list) and err_body["non_field_errors"]:
                            msg = "; ".join(err_body["non_field_errors"])
                        else:
                            msg = err_body.get("detail") or err_body.get("message") or response.text
                    except Exception:
                        msg = response.text
                    raise Exception(f"LinkedIn posts keyword search failed: {response.status_code} - {msg}")
                else:
                    # SUCCESS: Return the response data
                    return response.json()
                    
        except Exception as e:
            raise Exception(f"LinkedIn posts keyword search failed: {str(e)}")

    async def search_and_enrich_companies(
        self,
        crustdata_filters: Dict[str, Any],
        limit: int = 3
    ) -> Dict[str, Any]:
        """Search using In-DB API with comprehensive fields."""
        if "limit" not in crustdata_filters:
            crustdata_filters["limit"] = limit
        # 1) search using In-DB API with comprehensive fields
        search_result = await self.in_db_company_search(crustdata_filters, limit=limit)
        companies = search_result.get("companies", [])
        companies = companies[:limit]
        if not companies:
            return search_result

        # 2) collect domains (extract from website if missing)
        domains = []
        for c in companies:
            domain = _extract_domain(c.get("website") or "")
            if domain:
                domains.append(domain)

        print(f">>> search_and_enrich: {len(domains)} domains to enrich out of {len(companies)} companies (limit={limit})", flush=True)

        # 3) enrich (best-effort — fall back to search-only on any error)
        if domains:
            try:
                enriched_data = await self.enrich_companies_by_domain(domains)

                # index enriched companies by domain for O(1) lookup
                enriched_map: Dict[str, Dict] = {}
                for ec in enriched_data.get("companies", []):
                    d = ec.get("company_website_domain") or _extract_domain(ec.get("company_website_url") or "")
                    if d:
                        enriched_map[d] = ec

                print(f">>> search_and_enrich: enriched_map has {len(enriched_map)} entries", flush=True)

                # merge
                merged = []
                for sc in companies:
                    d = _extract_domain(sc.get("website") or "")
                    if d and d in enriched_map:
                        # keep search data as base, overlay enriched fields
                        combined = {**sc, **self._map_enriched_fields(enriched_map[d])}
                        merged.append(combined)
                    else:
                        merged.append(sc)

                search_result["companies"] = merged

            except Exception as e:
                print(f">>> Enrichment failed — returning search-only data: {e}", flush=True)

        return search_result

    async def comprehensive_company_search(
        self,
        filters: Dict[str, Any],
        limit: int = 3
    ) -> Dict[str, Any]:
        """
        Comprehensive search using Real-time API + ContactOut Enrichment.
        """
        # "filters" here is expected to be the raw frontend filters? 
        # No, SearchService usually maps them. 
        # But wait, search_service.py calls this with `filters` which are arguably raw or mapped?
        # Let's check search_service.py interaction.
        # If SearchService calls this, it expects a result dict.
        
        # We will assume SearchService will pass the TRANSFORMED filters if we change SearchService,
        # OR we handle transformation here. 
        # Best approach: SearchService calls FilterMappingService.transform_to_realtime_format, 
        # then passes that to us.
        
        # But for now, let's make this method smart.
        # If filters look like Real-time payload (list), pass to realtime search.
        # If dict, maybe transform?
        # Actually `realtime_company_search` takes `filters: List[Dict]`.
        
        # Let's just forward to realtime_company_search, assuming caller handles format, 
        # OR we can assume `filters` argument is the `{"filters": [...], "page": 1}` dict from the mapper.
         
        # Make sure realtime_company_search handles the "limit" argument if needed 
        # (Realtime API uses page/limit but our wrapper takes limit).
        
        # We'll rely on the `realtime_company_search` implementation we saw earlier 
        # or update it if it's missing features.
        
        # The existing `realtime_company_search` (lines 365-393 in read file) expects `filters: List[Dict]`.
        # We'll update this method to unpack the payload.
        
        # Logic:
        # 1. Caller (SearchService) gets `{"filters": [...], "page": 1}` from mapper.
        # 2. Passes that `filters` dict to here.
        # 3. We extract `filters["filters"]` list and pass to `realtime_company_search`.
        
        realtime_filters = filters.get("filters", [])
        page = filters.get("page", 1)
        
        # Call Real-time API
        return await self.realtime_company_search(realtime_filters, page=page)
    
    @staticmethod
    def _map_enriched_fields(ec: Dict) -> Dict:
        """
        Map enrichment-API response keys → our internal schema.
        Only includes keys that actually have values so we don't overwrite
        good search data with None.
        """
        raw = {
            "phone":                  ec.get("phone_numbers", [None])[0] if ec.get("phone_numbers") else None,
            "twitter_url":            ec.get("twitter_url"),
            "facebook_url":           ec.get("facebook_url"),
            "linkedin_url":           ec.get("linkedin_url"),
            "instagram_url":          ec.get("instagram_url"),
            "follower_count":         ec.get("follower_count") or (ec.get("linkedin_followers", {}) or {}).get("latest_count"),
            "funding_stage":          ec.get("funding_stage") or ec.get("last_funding_type"),
            "total_funding":          ec.get("total_funding_raised_usd") or ec.get("total_investment_usd"),
            "last_funding_date":      ec.get("last_funding_date"),
            "technologies":           ec.get("technologies") or ec.get("tech_stack"),
            "description":            ec.get("company_description") or ec.get("short_description"),
            "year_founded":          ec.get("year_founded") or ec.get("founded_year"),
            "headquarters_country":   ec.get("country") or ec.get("headquarters_country"),
            "headquarters_city":      ec.get("city") or ec.get("headquarters_city"),
            "headquarters_state":     ec.get("state") or ec.get("headquarters_state"),
            # Additional comprehensive fields
            "decision_makers":       ec.get("decision_makers"),
            "cxos":                  ec.get("cxos"),
            "all_office_addresses":    ec.get("all_office_addresses"),
            "investors":             ec.get("investors"),
            "acquisitions":          ec.get("acquisitions"),
            "competitors":          ec.get("competitors"),
            "glassdoor":            ec.get("glassdoor"),
            "job_openings":         ec.get("job_openings"),
            "linkedin_followers":    ec.get("linkedin_followers"),
            "news_articles":         ec.get("news_articles"),
            "producthunt":          ec.get("producthunt"),
            "seo":                  ec.get("seo"),
            "g2":                  ec.get("g2"),
            "gartner":              ec.get("gartner"),
            "web_traffic":          ec.get("web_traffic"),
            "headcount_growth":     ec.get("headcount_growth"),
        }
        # strip Nones so we never overwrite good data with None
        return {k: v for k, v in raw.items() if v is not None}
    
    def _extract_first(self, items: List) -> Optional[Any]:
        """Extract first item from list if exists."""
        return items[0] if items else None

    async def search_companies(
        self, 
        crustdata_filters: Dict[str, Any],
        limit: int = 3
    ) -> Dict[str, Any]:
        """
        Search for companies using Crustdata Realtime API.
        """
        try:
            
            # If no API key or it's the placeholder, return mock data for testing
            if not self.api_key or self.api_key == "your_crustdata_api_key_here":
                print(">>> CrustdataService: Using mock data (no API key configured)", flush=True)
                
                # Generate mock companies based on requested limit
                mock_companies = []
                company_types = [
                    {"name": "Mock Software Inc.", "website": "mocksoftware.com", "industry": "Software Development", "size": "51-100", "location": "San Francisco, CA"},
                    {"name": "Test Tech LLC", "website": "testtech.com", "industry": "Information Technology", "size": "11-50", "location": "New York, NY"},
                    {"name": "AI Solutions Inc", "website": "aisolutions.com", "industry": "Artificial Intelligence", "size": "101-250", "location": "Austin, TX"},
                    {"name": "Data Analytics Co", "website": "dataanalytics.com", "industry": "Data Analytics", "size": "251-500", "location": "Boston, MA"},
                    {"name": "Cloud Systems Ltd", "website": "cloudsystems.com", "industry": "Cloud Computing", "size": "501-1000", "location": "Seattle, WA"},
                    {"name": "Cyber Security Pro", "website": "cybersecpro.com", "industry": "Cybersecurity", "size": "51-100", "location": "Washington, DC"},
                    {"name": "Mobile Dev Studio", "website": "mobiledev.com", "industry": "Mobile Development", "size": "11-50", "location": "Los Angeles, CA"},
                    {"name": "Web Design Agency", "website": "webdesign.com", "industry": "Web Design", "size": "251-500", "location": "Chicago, IL"},
                    {"name": "E-Commerce Platform", "website": "ecommerce.com", "industry": "E-Commerce", "size": "1001-5000", "location": "Miami, FL"},
                    {"name": "Fintech Solutions", "website": "fintech.com", "industry": "Financial Technology", "size": "501-1000", "location": "New York, NY"},
                ]
                
                # Generate enough mock companies to meet the limit
                for i in range(min(limit, 25)):  # Cap at 25 for performance
                    template = company_types[i % len(company_types)]
                    mock_companies.append({
                        "company_id": f"mock_{i+1}",
                        "company_name": f"{template['name']} {i+1}" if i >= len(company_types) else template['name'],
                        "website": f"https://{template['website']}",
                        "linkedin_industries": template['industry'],
                        "employee_count_range": template['size'],
                        "hq_location": template['location']
                    })
                
                return {
                    "companies": mock_companies,
                    "total_count": len(mock_companies),
                    "page": 1,
                    "limit": limit
                }
            
            # Add limit to the payload for the API
            api_payload = crustdata_filters.copy()
            api_payload["limit"] = limit
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                print(f">> CrustdataService: POST /screener/company/search  payload={api_payload}", flush=True)
                
                # Realtime API expects filters array and optional limit/page
                api_response = await client.post(
                    f"{self.base_url}/screener/company/search",
                    headers=self._get_headers(),
                    json=api_payload
                )
                
                # Check for HTTP errors
                api_response.raise_for_status()
                data = api_response.json()
                
                print(f">> CrustdataService: got {len(data.get('companies', []))} companies", flush=True)
                return data

        except httpx.HTTPStatusError as e:
            print(f">>> CrustdataService HTTP error: {e.response.status_code} — {e.response.text}", flush=True)
            raise Exception(f"Crustdata API error {e.response.status_code}")
        except httpx.RequestError as e:
            print(f">>> CrustdataService request error: {e}", flush=True)
            raise Exception(f"Failed to connect to Crustdata API: {e}")
        
    async def autocomplete(self, field: str, query: str, limit: int = 5) -> Dict:
        try:
            payload = {"field": field, "query": query, "limit": limit}
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/screener/companydb/autocomplete",
                    headers=self._get_headers(),
                    json=payload
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            raise Exception(f"Autocomplete failed: {str(e)}")
    
    async def search_prospects(
        self,
        filters: Dict[str, Any],
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Search for prospects/people using Crustdata API.
        """
        try:
            # If no API key, return mock data
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                payload = {
                    "filters": filters,
                    "limit": limit
                }
                
                api_response = await client.post(
                    f"{self.base_url}/data_lab/people/search",
                    headers=self._get_headers(),
                    json=payload
                )
                
                api_response.raise_for_status()
                
                return api_response.json()
                
        except httpx.HTTPStatusError as e:
            raise Exception(f"Crustdata Prospect API error: {e.response.status_code}")
        except Exception as e:
            raise
    
    @staticmethod
    def normalize_company(raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles the ACTUAL fields that /screener/company/search returns
        (confirmed from live debug dump) plus any extras that enrichment adds.
        """
        def _get(obj: Any, path: str, default=None):
            try:
                cur = obj
                for part in path.split("."):
                    if cur is None:
                        return default
                    if isinstance(cur, dict):
                        cur = cur.get(part)
                    else:
                        return default
                return default if cur is None else cur
            except Exception:
                return default

        def _first_defined(*vals):
            for v in vals:
                if v is None:
                    continue
                if v == "":
                    continue
                if v == "N/A":
                    continue
                return v
            return None

        def _as_list(v: Any) -> List[str]:
            if not isinstance(v, list):
                return []
            out: List[str] = []
            for item in v:
                if isinstance(item, str):
                    s = item.strip()
                    if s and s != "N/A":
                        out.append(s)
            return out

        def _format_revenue_range(lower: Any, upper: Any) -> str:
            try:
                lo = float(lower)
                hi = float(upper)
            except Exception:
                return ""
            if lo <= 0 or hi <= 0:
                return ""

            def fmt(n: float) -> str:
                if n >= 1_000_000_000:
                    return f"{n / 1_000_000_000:.1f} BILLION"
                if n >= 1_000_000:
                    return f"{n / 1_000_000:.1f} MILLION"
                if n >= 1_000:
                    return f"{n / 1_000:.1f} THOUSAND"
                return str(int(round(n)))

            return f"{fmt(lo)} - {fmt(hi)}"

        # Detect enrichment payload shape (GET /screener/company)
        is_enrichment = any(
            k in raw
            for k in [
                "company_name",
                "company_website_domain",
                "company_website_url",
                "company_linkedin_url",
                "funding_and_investment",
                "linkedin_followers",
                "headcount",
            ]
        )

        if is_enrichment:
            name = _first_defined(raw.get("company_name"), raw.get("name"), "") or ""
            domain = _first_defined(raw.get("company_website_domain"), raw.get("company_domain"), "") or ""
            website = _first_defined(raw.get("company_website_url"), raw.get("company_website"), raw.get("website"), "") or ""

            # best-effort derive domain from website if missing
            if not domain:
                domain = _extract_domain(website)
            if not website and domain:
                website = f"https://{domain}"

            # logo
            logo_url = _first_defined(raw.get("logo_url"), raw.get("linkedin_logo_url"), raw.get("logo"), "") or ""

            # HQ
            hq_country = _first_defined(raw.get("hq_country"), raw.get("headquarters_country"), _get(raw, "headquarters.country"), "") or ""
            hq_state = _first_defined(raw.get("hq_state"), raw.get("headquarters_state"), _get(raw, "headquarters.geographicArea"), "") or ""
            hq_city = _first_defined(raw.get("hq_city"), raw.get("headquarters_city"), _get(raw, "headquarters.city"), "") or ""

            # Growth
            growth_6m_pct = _first_defined(
                _get(raw, "headcount.growth_6m_percent"),
                _get(raw, "headcount.growth_6m"),
                raw.get("employee_growth_6m_percent"),
                _get(raw, "employee_metrics.growth_6m_percent"),
            )
            growth_12m_pct = _first_defined(
                _get(raw, "headcount.growth_12m_percent"),
                _get(raw, "headcount.growth_12m"),
                raw.get("employee_growth_12m_percent"),
                _get(raw, "employee_metrics.growth_12m_percent"),
            )

            # Followers
            follower_count = _first_defined(
                _get(raw, "linkedin_followers.follower_count"),
                _get(raw, "linkedin_followers.followers"),
                raw.get("follower_count"),
            )

            # Technologies
            technologies = _as_list(
                _first_defined(
                    raw.get("technologies"),
                    raw.get("specialties"),
                    raw.get("tech_stack"),
                    _get(raw, "taxonomy.technologies"),
                    _get(raw, "seo.technologies"),
                )
            )

            # Revenue
            revenue_str = ""
            lower_rev = _first_defined(
                raw.get("estimated_revenue_lower_bound_usd"),
                raw.get("estimated_revenue_lower_bound"),
                _get(raw, "funding_and_investment.estimated_revenue_lower_bound_usd"),
            )
            upper_rev = _first_defined(
                raw.get("estimated_revenue_upper_bound_usd"),
                raw.get("estimated_revenue_upper_bound"),
                _get(raw, "funding_and_investment.estimated_revenue_upper_bound_usd"),
            )
            if lower_rev is not None and upper_rev is not None:
                revenue_str = _format_revenue_range(lower_rev, upper_rev)

            if not revenue_str:
                revenue_str = _first_defined(raw.get("revenue_range"), raw.get("estimated_revenue_range"), "") or ""

            # Funding
            funding_stage = _first_defined(
                _get(raw, "funding_and_investment.last_funding_round_type"),
                raw.get("funding_stage"),
                raw.get("last_funding_round_type"),
                "",
            ) or ""
            funding_total = _first_defined(
                _get(raw, "funding_and_investment.crunchbase_total_investment_usd"),
                raw.get("crunchbase_total_investment_usd"),
                raw.get("funding_total"),
                _get(raw, "funding_and_investment.total_funding_raised_usd"),
                _get(raw, "funding_and_investment.total_investment_usd"),
            )
            last_funding_date = _first_defined(
                _get(raw, "funding_and_investment.last_funding_date"),
                raw.get("last_funding_date"),
            )

            # Assemble normalized
            return {
                "domain": domain,
                "name": name,
                "website": website,
                "logo_url": logo_url,
                "industry": _first_defined(raw.get("industry"), raw.get("linkedin_industry"), "") or "",
                "description": _first_defined(raw.get("description"), raw.get("company_description"), "") or "",
                "company_type": _first_defined(raw.get("company_type"), raw.get("type"), "") or "",
                "founded_year": _first_defined(raw.get("year_founded"), raw.get("founded_year"), raw.get("founded_at")),
                "employee_count_exact": _first_defined(raw.get("linkedin_headcount"), _get(raw, "headcount.linkedin_headcount"), _get(raw, "headcount.employee_count"), raw.get("employee_count_exact"), raw.get("employee_count")),
                "employee_count_range": _first_defined(raw.get("employee_count_range"), raw.get("employee_range"), "") or "",
                "revenue_exact": None,
                "revenue_range": revenue_str,
                "headquarters_country": hq_country,
                "headquarters_state": hq_state,
                "headquarters_city": hq_city,
                "location": _first_defined(raw.get("headquarters"), raw.get("hq_location"), "") or "",
                "linkedin_url": _first_defined(raw.get("linkedin_profile_url"), raw.get("company_linkedin_url"), raw.get("linkedin_url"), "") or "",
                "twitter_url": raw.get("twitter_url") or "",
                "facebook_url": raw.get("facebook_url") or "",
                "phone": _first_defined(raw.get("phone"), _get(raw, "phone_numbers.0"), "") or "",
                "follower_count": follower_count,
                "employee_growth_6m_percent": growth_6m_pct,
                "employee_growth_12m_percent": growth_12m_pct,
                "technologies": technologies,
                "specialties": _as_list(raw.get("specialties")),
                "funding_stage": funding_stage,
                "funding_total": funding_total,
                "last_funding_date": last_funding_date,
                "decision_makers_count": raw.get("decision_makers_count"),
                "quality_score": raw.get("quality_score", 50),
                "provider_source": "crustdata",
                "raw_data": raw,
            }

        # ── identity ─────────────────────────────────────────────────────────
        name    = raw.get("name", "")
        website = raw.get("website") or ""          # can be null in the API!
        domain  = _extract_domain(website)
        if not domain and name:
            domain = name.lower().replace(" ", "-").replace("|", "-") + ".com"

        # ── headquarters ─────────────────────────────────────────────────────
        hq = raw.get("headquarters") or {}
        if isinstance(hq, str):
            hq = {"line1": hq}

        # ── employee growth  (array of {timespan, percentage}) ──────────────
        growth_6m_pct  = None
        growth_12m_pct = None
        for g in raw.get("employee_growth_percentages", []):
            if g.get("timespan") == "SIX_MONTHS":
                growth_6m_pct = g.get("percentage")
            elif g.get("timespan") == "YEAR":
                growth_12m_pct = g.get("percentage")

        # ── revenue ──────────────────────────────────────────────────────────
        rev_range_obj = raw.get("revenue_range") or {}
        revenue_str = ""
        if isinstance(rev_range_obj, dict):
            mn = rev_range_obj.get("estimatedMinRevenue") or {}
            mx = rev_range_obj.get("estimatedMaxRevenue") or {}
            if mn and mx:
                revenue_str = f"{mn.get('amount', '')} {mn.get('unit', '')} - {mx.get('amount', '')} {mx.get('unit', '')}"

        # ── logo ─────────────────────────────────────────────────────────────
        logos = raw.get("logo_urls") or {}
        logo_url = logos.get("200x200") or logos.get("100x100") or logos.get("400x400") or ""

        # ── technologies  ────────────────────────────────────────────────────
        # The search endpoint returns "specialties" not "technologies".
        # Enrichment may add a real "technologies" list — prefer that if present.
        technologies = raw.get("technologies") or raw.get("specialties") or []

        # ── assemble ─────────────────────────────────────────────────────────
        return {
            # identity
            "domain":   domain,
            "name":     name,
            "website":  website or f"https://{domain}",
            "logo_url": logo_url,

            # firmographics
            "industry":      raw.get("industry", ""),
            "description":   raw.get("description", ""),
            "company_type":  raw.get("company_type", ""),
            "founded_year":  raw.get("founded_year"),

            # headcount
            "employee_count_exact":  raw.get("employee_count"),
            "employee_count_range":  raw.get("employee_count_range", ""),

            # revenue
            "revenue_exact":  None,
            "revenue_range":  revenue_str,

            # location
            "headquarters_country": hq.get("country", ""),
            "headquarters_state":   hq.get("geographicArea", ""),
            "headquarters_city":    hq.get("city", ""),
            "location":             raw.get("location", ""),   # flat string from search

            # social / contact  (mostly from enrichment)
            "linkedin_url":   raw.get("linkedin_company_url", ""),
            "twitter_url":    raw.get("twitter_url", ""),
            "facebook_url":   raw.get("facebook_url", ""),
            "phone":          raw.get("phone", ""),
            "follower_count": raw.get("follower_count"),

            # growth
            "employee_growth_6m_percent":  growth_6m_pct,
            "employee_growth_12m_percent": growth_12m_pct,

            # tech / specialties
            "technologies": technologies,
            "specialties":  raw.get("specialties", []),

            # funding  (from enrichment)
            "funding_stage":      raw.get("funding_stage", ""),
            "funding_total":      raw.get("total_funding"),
            "last_funding_date":  raw.get("last_funding_date"),

            # misc
            "decision_makers_count": raw.get("decision_makers_count"),
            "data_quality_score":    raw.get("quality_score", 50),
            "provider_source":       "crustdata",
            "raw_data":              raw,
        }
    
    @staticmethod
    def normalize_prospect(raw_prospect: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize Crustdata prospect response to our database schema.
        """
        first_name = raw_prospect.get("first_name", "")
        last_name = raw_prospect.get("last_name", "")
        
        return {
            "first_name": first_name,
            "last_name": last_name,
            "full_name": f"{first_name} {last_name}".strip(),
            "email": raw_prospect.get("email", ""),
            "email_verified": raw_prospect.get("email_verified", False),
            "phone": raw_prospect.get("phone", ""),
            "job_title": raw_prospect.get("job_title", ""),
            "seniority_level": raw_prospect.get("seniority_level", ""),
            "department": raw_prospect.get("department", ""),
            "linkedin_url": raw_prospect.get("linkedin_url", ""),
            "twitter_url": raw_prospect.get("twitter_url", ""),
            "company_domain": raw_prospect.get("company_domain", ""),
            "location_country": raw_prospect.get("location", {}).get("country", ""),
            "location_state": raw_prospect.get("location", {}).get("state", ""),
            "location_city": raw_prospect.get("location", {}).get("city", ""),
            "data_quality_score": raw_prospect.get("quality_score", 50),
            "provider_source": "crustdata",
            "external_id": raw_prospect.get("id", ""),
            "raw_data": raw_prospect,
        }