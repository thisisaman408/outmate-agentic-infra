import os
import httpx
import logging
from typing import Dict, Any, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

class ExploriumService:
    def __init__(self):
        self.api_key = settings.EXPLORIUM_API_KEY
        self.base_url = settings.EXPLORIUM_BASE_URL
        self.timeout = settings.EXPLORIUM_TIMEOUT
        self.tenant = settings.EXPLORIUM_TENANT

        # Debug: Print configured status
        print(f">>> ExploriumService: API key configured: {bool(self.api_key)}", flush=True)
        print(f">> ExploriumService: Base URL: {self.base_url}", flush=True)
        try:
            print(f">>> Explorium: base={self.base_url}, key_prefix={str(self.api_key)[:6]}****", flush=True)
        except Exception:
            pass

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "api_key": self.api_key,
        }
        if self.tenant:
            headers["tenant"] = self.tenant
        return headers

    @staticmethod
    def _map_filters(frontend_filters: Dict[str, Any]) -> Dict[str, Any]:
        mapped: Dict[str, Any] = {}

        def values_of(key: str) -> Optional[List[str]]:
            v = frontend_filters.get(key)
            if v is None:
                return None
            if isinstance(v, list):
                arr = [str(x).strip() for x in v if str(x).strip()]
                if key == "country_code":
                    arr = [s.lower() for s in arr]
                return arr or None
            s = str(v).strip()
            if not s:
                return None
            if key == "country_code":
                s = s.lower()
            return [s]

        # Whitelist only filters allowed by the Fetch Businesses endpoint
        # Other identifiers (name/domain) are supported via the Match endpoint
        mapping = {
            "business_id": "business_id",
            "country_code": "country_code",
            "company_size": "company_size",
            "google_category": "google_category",
            "naics_category": "naics_category",
            "name": "name",
            "company_name": "name",
            "website": "domain",
            "domain": "domain",
        }

        # Enforce single category filter (Explorium requirement)
        category_keys = ["google_category", "naics_category", "categories"]
        chosen_category: Optional[str] = None
        for ck in category_keys:
            if values_of(ck):
                chosen_category = ck
                break

        for src, dst in mapping.items():
            if src in category_keys and chosen_category and src != chosen_category:
                continue
            vals = values_of(src)
            if vals:
                mapped[dst] = {"values": vals}

        return mapped

    async def fetch_businesses(
        self,
        frontend_filters: Dict[str, Any],
        size: int = 3,
        page_size: int = 3,
        page: int = 1,
        mode: str = "full",
    ) -> Dict[str, Any]:
        payload = {
            "request_context": {},
            "mode": mode,
            "size": size,
            "page_size": page_size,
            "page": page,
            "exclude": [],
            "filters": self._map_filters(frontend_filters),
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                # bubble up API error details
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def search_companies(self, filters: Dict[str, Any], limit: int = 25) -> Dict[str, Any]:
        """
        Unified search method for companies using Explorium.
        Handles both high-precision match (if domain/name present) and broad fetch.
        """
        domain = filters.get("domain") or filters.get("website")
        name = filters.get("name") or filters.get("company_name")
        companies = []

        if domain or name:
            try:
                inputs = [{"name": name, "domain": domain}]
                logger.info(f"Attempting Explorium match with: {inputs}")
                match_res = await self.match_businesses(inputs)
                logger.info(f"Explorium match response status: {match_res.keys() if isinstance(match_res, dict) else type(match_res)}")
                
                # Handle both 'matched_businesses' and 'matches' response formats
                matched = match_res.get("matched_businesses") or []
                if not matched and "matches" in match_res:
                    # In some versions/endpoints, it's 'matches'
                    matches_list = match_res.get("matches") or []
                    for m in matches_list:
                        if isinstance(m, dict) and m.get("match") and m.get("business"):
                            matched.append(m["business"])
                        elif isinstance(m, dict) and m.get("business_id"):
                            matched.append(m)
                
                logger.info(f"Resolved {len(matched)} candidate matches")
                for item in matched[:limit]:
                    bid = item.get("business_id")
                    if not bid: 
                        logger.warning(f"No business_id found in matched item: {item.keys()}")
                        continue
                    try:
                        # Fetch full profile for matched ID
                        logger.info(f"Fetching full profile for business_id: {bid}")
                        raw = await self.fetch_businesses({"business_id": bid}, size=1, page_size=1, page=1, mode="full")
                        data_list = raw.get("data") or []
                        logger.info(f"Fetched {len(data_list)} records for bid: {bid}")
                        companies.extend([self.normalize_company(x) for x in data_list])
                    except Exception as e:
                        logger.error(f"Error fetching profile for bid {bid}: {e}")
            except Exception as e:
                logger.error(f"Explorium match failed: {e}")
        
        # If no companies from match or no domain/name, fallback to broad fetch
        if not companies:
            logger.info("No companies found via match, falling back to fetch_businesses")
            try:
                raw = await self.fetch_businesses(filters, size=limit, page_size=limit, page=1, mode="full")
                data_list = raw.get("data") or []
                logger.info(f"Explorium fetch returned {len(data_list)} records")
                companies = [self.normalize_company(item) for item in data_list]
            except Exception as e:
                logger.error(f"Explorium fetch failed: {e}")
        return {
            "companies": companies[:limit],
            "total": len(companies)
        }

    async def enrich_company_fully(self, company: Dict[str, Any]) -> Dict[str, Any]:
        """
        Robustly enrich a company object using all available Explorium modules.
        Used by both routes and SearchService for consistency.
        """
        def take(existing, incoming):
            if existing in (None, "", [], {}, 0, 0.0, "N/A"):
                return incoming
            return existing

        merged = dict(company)
        
        # Check if we have a valid BID; if not, try to match it using domain/name
        bid = merged.get("business_id") or merged.get("id")
        # Relaxed check: as long as it doesn't look like our temp ID, try it
        is_valid_bid = bool(bid) and not str(bid).startswith("temp_")
        
        if not is_valid_bid:
            domain_to_match = merged.get("domain")
            name_to_match = merged.get("name")
            print(f">>> [Enrich] No BID found, attempting match for {domain_to_match or name_to_match}", flush=True)
            if domain_to_match or name_to_match:
                try:
                    match_res = await self.match_businesses([{"domain": domain_to_match, "name": name_to_match}])
                    matched = match_res.get("matched_businesses") or match_res.get("matches") or []
                    if matched:
                        bid = matched[0].get("business_id")
                        if bid:
                            is_valid_bid = True
                            merged["business_id"] = bid
                            print(f">>> [Enrich] Match succeeded. Resolved BID: {bid}", flush=True)
                except Exception as e:
                    print(f">>> [Enrich] Match failed: {e}", flush=True)

        if not is_valid_bid:
            logger.warning(f"[Enrich] Skipping modules - No valid BID resolved for domain={merged.get('domain')}, name={merged.get('name')}")
            print(f">>> [Enrich] Skipping modules - No valid BID resolved for {merged.get('domain') or merged.get('name')}", flush=True)
            return self.normalize_company(merged)

        # 1. Firmographics
        try:
            fg = await self.enrich_firmographics(bid)
            data = (fg or {}).get("data") or {}
            if data:
                print(f">>> [Enrich] Got Firmographics for {bid}. Revenue: {data.get('yearly_revenue_exact')}, Zip: {data.get('zip_code')}", flush=True)
            merged["naics"] = take(merged.get("naics"), data.get("naics"))
            merged["sic_code_description"] = take(merged.get("sic_code_description"), data.get("sic_code_description"))
            merged["industry"] = take(merged.get("industry"), data.get("naics_description") or data.get("linkedin_industry_category") or data.get("primary_industry") or data.get("industry"))
            merged["employee_count_range"] = take(merged.get("employee_count_range"), data.get("number_of_employees_range"))
            merged["revenue_range"] = take(merged.get("revenue_range"), data.get("yearly_revenue_range"))
            merged["revenue_exact"] = take(merged.get("revenue_exact"), data.get("yearly_revenue_exact") or data.get("yearly_revenue") or data.get("revenue_usd"))
            merged["logo_url"] = take(merged.get("logo_url"), data.get("business_logo") or data.get("logo_url"))
            merged["company_type"] = take(merged.get("company_type"), data.get("company_type") or data.get("business_type") or data.get("type"))
            merged["headquarters_country"] = take(merged.get("headquarters_country"), data.get("country_name"))
            merged["headquarters_state"] = take(merged.get("headquarters_state"), data.get("region_name"))
            merged["headquarters_city"] = take(merged.get("headquarters_city"), data.get("city_name"))
            merged["street"] = take(merged.get("street"), data.get("street"))
            merged["zip_code"] = take(merged.get("zip_code"), data.get("zip_code") or data.get("zip") or data.get("headquarters_zip"))
            
            if not merged.get("location_display"):
                merged["location_display"] = ", ".join([p for p in [data.get("city_name"), data.get("region_name"), data.get("country_name")] if p])
        except Exception as e:
            logger.error(f"[Enrich] Firmographics enrichment failed for BID={bid}, domain={merged.get('domain')}: {type(e).__name__}: {str(e)}")
            print(f">>> [Enrich] Firmographics error for {bid}: {str(e)}", flush=True)

        # 2. Funding & Acquisition
        try:
            fa = await self.enrich_funding_and_acquisition(bid)
            fa_data = (fa or {}).get("data") or {}
            if fa_data:
                print(f">>> [Enrich] Got Funding for {bid}. Investors: {len(fa_data.get('investors') or [])}", flush=True)
            investors = fa_data.get("investors") or fa_data.get("investor_list") or []
            if isinstance(investors, list) and investors:
                merged["investors"] = investors
                merged["investors_count"] = len(investors)
            merged["funding_total"] = take(merged.get("funding_total"), fa_data.get("known_funding_total_value"))
            merged["last_funding_date"] = take(merged.get("last_funding_date"), fa_data.get("last_funding_round_date") or fa_data.get("first_funding_round_date"))
            merged["funding_stage"] = take(merged.get("funding_stage"), fa_data.get("last_funding_round_type") or fa_data.get("first_funding_round_type"))
        except Exception as e:
            logger.error(f"[Enrich] Funding enrichment failed for BID={bid}, domain={merged.get('domain')}: {type(e).__name__}: {str(e)}")
            print(f">>> [Enrich] Funding error for {bid}: {str(e)}", flush=True)

        # 3. Financial Indicators (Revenue Exact)
        try:
            fi = await self.enrich_financial_indicators(bid)
            fi_data = (fi or {}).get("data") or {}
            if fi_data:
                print(f">>> [Enrich] Got Financials/Revenue for {bid}", flush=True)
            merged["revenue_exact"] = take(merged.get("revenue_exact"), fi_data.get("revenue_yearly") or fi_data.get("revenue") or fi_data.get("revenue_usd") or fi_data.get("annual_revenue"))
            peers = fi_data.get("peer_companies")
            if peers:
                comp_list = [str(k) for k in peers.keys()] if isinstance(peers, dict) else [str(x) for x in peers]
                merged["competitors"] = take(merged.get("competitors"), comp_list)
        except Exception as e:
            logger.error(f"[Enrich] Financial indicators enrichment failed for BID={bid}, domain={merged.get('domain')}: {type(e).__name__}: {str(e)}")
            print(f">>> [Enrich] Financials error for {bid}: {str(e)}", flush=True)

        # 4. Technographics
        try:
            tg = await self.enrich_technographics(bid)
            tg_data = (tg or {}).get("data") or {}
            if tg_data:
                print(f">>> [Enrich] Got Technographics for {bid}", flush=True)
            techs = tg_data.get("full_tech_stack") or tg_data.get("technologies") or []
            if techs:
                print(f">>> [Enrich] Got Tech for {bid}: {len(techs)} items", flush=True)
                merged["technologies"] = list({str(x).strip() for x in techs if x})
        except Exception as e:
            logger.error(f"[Enrich] Technographics enrichment failed for BID={bid}, domain={merged.get('domain')}: {type(e).__name__}: {str(e)}")
            print(f">>> [Enrich] Technographics error for {bid}: {str(e)}", flush=True)

        result = self.normalize_company(merged)
        # Ensure ID from enrichment is prioritized
        if bid and not str(result.get("id", "")).startswith("temp_"):
            result["id"] = bid
        
        print(f">>> [Enrich] Final normalized result for {merged.get('domain')}: Logo={bool(result.get('logo_url'))}, Rev={result.get('revenue_exact')}, Tech={len(result.get('technologies') or [])}", flush=True)
        return result

    async def match_businesses(self, inputs: List[Dict[str, Any]]) -> Dict[str, Any]:
        payload = {
            "request_context": {},
            "businesses_to_match": inputs,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/match",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_technographics(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "parameters": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/technographics/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_linkedin_posts(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "parameters": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/linkedin_posts/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_bombora_intent(self, business_id: str, min_score: Optional[int] = None, topic_parameters: Optional[str] = None) -> Dict[str, Any]:
        params: Dict[str, Any] = {}
        if min_score is not None:
            params["min_score"] = min_score
        if topic_parameters:
            params["topic_parameters"] = topic_parameters
        payload = {
            "business_id": business_id,
            "parameters": params or {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/bombora_intent/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_firmographics(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "parameters": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/firmographics/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_funding_and_acquisition(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "parameters": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/funding_and_acquisition/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_financial_indicators(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "parameters": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/financial_indicators/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def enrich_business_challenges(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "parameters": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/pc_business_challenges_10k/enrich",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {data.get('message') or data}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()
    @staticmethod
    def normalize_company(raw: Dict[str, Any]) -> Dict[str, Any]:
        def clean(s: Any) -> Optional[str]:
            if s is None:
                return None
            try:
                t = str(s).strip().strip("`").strip()
                return t or None
            except Exception:
                return None

        # Accept both API keys and our already-normalized keys as inputs
        name = raw.get("name") or raw.get("business_name") or raw.get("company_name") or ""
        domain = raw.get("domain") or raw.get("website_domain") or ""
        website = raw.get("website") or (f"https://{domain}" if domain else "")
        description = raw.get("business_description") or raw.get("description") or ""

        industry = (
            raw.get("naics_description")
            or raw.get("sic_code_description")
            or raw.get("primary_industry")
            or raw.get("industry")
        )
        
        employee_range = (
            raw.get("employee_count_range") 
            or raw.get("number_of_employees_range") 
            or raw.get("company_size")
        )

        revenue_range = (
            raw.get("revenue_range")
            or raw.get("yearly_revenue_range") 
            or raw.get("estimated_revenue_range")
        )

        def parse_currency(val):
            if val is None: return None
            if isinstance(val, (int, float)): return float(val)
            if not isinstance(val, str): return None
            # Handle strings like "$830.0M", "1.2B", etc.
            try:
                s = val.upper().replace('$', '').replace(',', '').strip()
                mul = 1.0
                if s.endswith('K'): mul = 1_000.0; s = s[:-1]
                elif s.endswith('M'): mul = 1_000_000.0; s = s[:-1]
                elif s.endswith('B'): mul = 1_000_000_000.0; s = s[:-1]
                elif s.endswith('T'): mul = 1_000_000_000_000.0; s = s[:-1]
                return float(s) * mul
            except Exception:
                return None

        revenue_exact = parse_currency(
            raw.get("revenue_exact") 
            or raw.get("yearly_revenue_exact") 
            or raw.get("yearly_revenue") 
            or raw.get("yearly_revenue_usd") 
            or raw.get("revenue_usd") 
            or raw.get("annual_revenue_usd") 
            or raw.get("revenue")
        )

        city = raw.get("headquarters_city") or raw.get("city_name") or raw.get("city")
        state = raw.get("headquarters_state") or raw.get("region") or raw.get("state")
        country = raw.get("headquarters_country") or raw.get("country_name") or raw.get("country_code") or raw.get("country")
        location = raw.get("location") or ", ".join([p for p in [city, state, country] if p])

        normalized = {
            "id": raw.get("business_id") or raw.get("id") or domain or name,
            "name": name,
            "domain": domain,
            "website": website,
            "logo_url": raw.get("logo_url") or raw.get("business_logo") or raw.get("logo") or raw.get("linkedin_logo_url") or raw.get("logo_url_200x200"),
            "description": description,
            "industry": industry,
            "ticker": raw.get("ticker"),
            "company_type": raw.get("company_type") or raw.get("business_type") or raw.get("type") or raw.get("category"),
            "founded_year": (raw.get("founded_year") or raw.get("year_founded") or raw.get("founded_at")) or None,
            "employee_count_exact": raw.get("employee_count_exact") or raw.get("number_of_employees") or (raw.get("employee_count_exact") if isinstance(raw.get("employee_count_exact"), (int, float)) and raw.get("employee_count_exact") > 9 else None),
            "employee_count_range": employee_range,
            "revenue_exact": revenue_exact,
            "revenue_range": revenue_range,
            "headquarters_country": country,
            "headquarters_state": state,
            "headquarters_city": city,
            "street": raw.get("street") or raw.get("headquarters_address"), # fallback
            "zip_code": raw.get("zip_code") or raw.get("zip") or raw.get("headquarters_zip") or raw.get("postal_code"),
            "location": location,
            "location_display": raw.get("location_display") or location,
            "linkedin_industry_category": raw.get("linkedin_industry_category"),
            "linkedin_url": raw.get("linkedin_url") or raw.get("linkedin_profile") or raw.get("company_linkedin_url") or raw.get("li_vanity"),
            "twitter_url": raw.get("twitter_url") or raw.get("company_twitter_url"),
            "facebook_url": raw.get("facebook_url") or raw.get("company_facebook_url"),
            "instagram_url": raw.get("instagram_url") or raw.get("company_instagram_url"),
            "phone": raw.get("phone"),
            "email": raw.get("email"),
            "follower_count": raw.get("follower_count") or (raw.get("linkedin_followers") or {}).get("follower_count"),
            "technologies": raw.get("technologies") or raw.get("full_tech_stack") or raw.get("technologies_used") or [],
            "specialties": raw.get("specialties") or raw.get("google_category") or raw.get("linkedin_category") or [],
            "funding_stage": raw.get("funding_stage") or raw.get("last_funding_round_type") or raw.get("last_funding_stage"),
            "funding_total": raw.get("funding_total") or raw.get("known_funding_total_value") or raw.get("total_funding_usd") or raw.get("crunchbase_total_investment_usd"),
            "last_funding_date": raw.get("last_funding_date") or raw.get("last_funding_round_date") or (raw.get("funding") or {}).get("last_funding_date"),
            "investors": raw.get("investors") or (raw.get("funding") or {}).get("investors") or [],
            "investors_count": raw.get("investors_count") or (len(raw.get("investors")) if isinstance(raw.get("investors"), list) else None),
            "locations": raw.get("locations") or [],
            "headquarters_address": raw.get("headquarters_address") or raw.get("hq_address") or raw.get("headquarters_address") or raw.get("location_display"),
            "competitors": raw.get("competitors") or raw.get("competition") or [],
            "taxonomy": str(raw.get("taxonomy") or raw.get("sic_code", "") or "").strip(),
            "naics": str(raw.get("naics", "") or "").strip(),
            "sic_code_description": clean(raw.get("sic_code_description")),
            "job_openings_count": raw.get("job_openings_count") or (raw.get("jobs") or {}).get("openings"),
            "web_traffic": raw.get("web_traffic") or (raw.get("website_traffic") or {}).get("monthly_visits"),
            "seo_score": raw.get("seo_score"),
            "decision_makers_count": raw.get("decision_makers_count") or 0,
            "quality_score": raw.get("match_score") or raw.get("quality_score") or 50,
            "provider_source": raw.get("provider_source") or "explorium",
        }
        try:
            normalized["website"] = clean(normalized.get("website")) or normalized.get("website")
            normalized["logo_url"] = clean(normalized.get("logo_url")) or normalized.get("logo_url")
            normalized["linkedin_url"] = clean(normalized.get("linkedin_url")) or normalized.get("linkedin_url")
            normalized["twitter_url"] = clean(normalized.get("twitter_url")) or normalized.get("twitter_url")
            normalized["facebook_url"] = clean(normalized.get("facebook_url")) or normalized.get("facebook_url")
            normalized["instagram_url"] = clean(normalized.get("instagram_url")) or normalized.get("instagram_url")
            normalized["naics"] = clean(normalized.get("naics")) or normalized.get("naics")
        except Exception:
            pass
        try:
            if isinstance(normalized.get("investors"), list):
                if not normalized.get("investors_count"):
                    normalized["investors_count"] = len(normalized["investors"])
        except Exception:
            pass

        # Derived fields
        try:
            growth12 = raw.get("employee_growth_12m_percent") or raw.get("growth_12m_percent") or (raw.get("employee_metrics") or {}).get("growth_12m_percent") or (raw.get("headcount") or {}).get("growth_12m_percent")
            growth6 = raw.get("employee_growth_6m_percent") or raw.get("growth_6m_percent") or (raw.get("employee_metrics") or {}).get("growth_6m_percent") or (raw.get("headcount") or {}).get("growth_6m_percent")
            g = growth12 if isinstance(growth12, (int, float)) else (growth6 if isinstance(growth6, (int, float)) else None)
            if g is not None:
                if g >= 30:
                    normalized["growth_category"] = "High Growth"
                elif g >= 10:
                    normalized["growth_category"] = "Moderate Growth"
                elif g >= 0:
                    normalized["growth_category"] = "Stable"
                else:
                    normalized["growth_category"] = "Declining"
            else:
                normalized["growth_category"] = "N/A"
            if isinstance(growth6, (int, float)):
                normalized["employee_growth_6m_percent"] = growth6
            if isinstance(growth12, (int, float)):
                normalized["employee_growth_12m_percent"] = growth12
        except Exception:
            normalized["growth_category"] = "N/A"

        techs = normalized.get("technologies") or []
        if isinstance(techs, list):
            tl = [str(t).strip().lower() for t in techs if t]
            kw = {
                "aws", "amazon web services", "azure", "gcp", "google cloud",
                "kubernetes", "docker", "terraform", "ansible",
                "react", "angular", "vue", "node", "node.js",
                "python", "java", "go", "rust", "php", "ruby",
                "postgres", "mysql", "mongodb", "redis", "kafka",
                "graphql", "rest", "microservices", "serverless"
            }
            hits = sum(1 for t in tl if t in kw)
            normalized["is_tech_heavy"] = len(tl) > 5 or hits >= 3
        else:
            normalized["is_tech_heavy"] = False

        last_fd = normalized.get("last_funding_date")
        has_recent = False
        if isinstance(last_fd, str) and last_fd:
            try:
                from datetime import datetime, timezone
                d = datetime.fromisoformat(last_fd.replace("Z", "+00:00"))
                diff_days = (datetime.now(timezone.utc) - d).days
                has_recent = diff_days <= 365
            except Exception:
                has_recent = False
        normalized["has_recent_funding"] = has_recent

        # Enriched heuristic
        enriched = any([
            bool(normalized.get("phone")),
            bool(normalized.get("funding_stage")),
            bool(normalized.get("twitter_url")),
            bool(normalized.get("linkedin_url")),
            bool(normalized.get("description")),
        ])
        normalized["enriched"] = enriched
        try:
            score = 0
            if normalized.get("website"):
                score += 5
            if normalized.get("logo_url"):
                score += 5
            desc = normalized.get("description") or ""
            if isinstance(desc, str) and desc:
                score += 2
                if len(desc) > 50:
                    score += 3
            if normalized.get("linkedin_url"):
                score += 5
            fc = normalized.get("follower_count")
            if isinstance(fc, (int, float)):
                if fc >= 10000:
                    score += 10
                elif fc >= 1000:
                    score += 5
            rt = normalized.get("revenue_exact") or normalized.get("revenue_range")
            if rt:
                score += 5
            ft = normalized.get("funding_total")
            if isinstance(ft, (int, float)) and ft > 0:
                score += 10
            elif isinstance(ft, str) and ft.strip():
                score += 7
            if normalized.get("has_recent_funding"):
                score += 10
            ecx = normalized.get("employee_count_exact")
            ecr = normalized.get("employee_count_range")
            if isinstance(ecx, (int, float)) and ecx > 0:
                score += 5
            elif ecr:
                score += 3
            g6 = normalized.get("employee_growth_6m_percent")
            g12 = normalized.get("employee_growth_12m_percent")
            gv = g12 if isinstance(g12, (int, float)) else (g6 if isinstance(g6, (int, float)) else None)
            if isinstance(gv, (int, float)):
                if gv >= 30:
                    score += 15
                elif gv >= 10:
                    score += 10
                elif gv >= 0:
                    score += 5
            techs_count = len([t for t in normalized.get("technologies") or [] if t])
            specs_count = len([s for s in normalized.get("specialties") or [] if s])
            if techs_count > 5:
                score += 10
            elif techs_count > 0:
                score += 5
            if specs_count > 3:
                score += 5
            dm = normalized.get("decision_makers_count")
            if isinstance(dm, (int, float)) and dm > 0:
                score += 10
            if enriched:
                score += 5
            score = max(0, min(100, score))
            normalized["quality_score"] = score
        except Exception:
            pass
        # Ensure collections are JSON-serializable lists of strings
        for key in ["technologies", "specialties", "investors", "competitors", "taxonomy"]:
            val = normalized.get(key)
            if isinstance(val, set):
                val = list(val)
            if isinstance(val, list):
                normalized[key] = [str(x) for x in val if x is not None]
            else:
                normalized[key] = [str(val)] if val not in (None, "", "N/A") else []
        try:
            ld = raw.get("locations_distribution") or []
            if isinstance(ld, list):
                normalized["locations_distribution_count"] = len(ld)
        except Exception:
            normalized["locations_distribution_count"] = None

        # Count/normalize investors_count
        try:
            invs = normalized.get("investors") or []
            normalized["investors_count"] = len(invs) if isinstance(invs, list) else None
        except Exception:
            normalized["investors_count"] = None
        # Ensure founders_profiles and cxos are lists (stringify entries if needed)
        for key in ["founders_profiles", "cxos"]:
            val = normalized.get(key)
            if val is None:
                normalized[key] = []
            elif isinstance(val, list):
                # if list of dicts, keep dicts; otherwise stringify
                if all(isinstance(x, (str, int, float)) for x in val):
                    normalized[key] = [str(x) for x in val if x is not None]
                else:
                    normalized[key] = val
            else:
                normalized[key] = [val]
        return normalized
