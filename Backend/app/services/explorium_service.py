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
        print(f">>> [ExploriumService] _map_filters called with: {frontend_filters}", flush=True)
        mapped: Dict[str, Any] = {}

        country_name_to_code = {
            "united states": "us",
            "usa": "us",
            "us": "us",
            "canada": "ca",
            "mexico": "mx",
            "united kingdom": "gb",
            "uk": "gb",
            "germany": "de",
            "france": "fr",
            "spain": "es",
            "italy": "it",
            "netherlands": "nl",
            "australia": "au",
            "new zealand": "nz",
            "india": "in",
            "singapore": "sg",
            "japan": "jp",
        }
        region_to_codes = {
            "north america": ["us", "ca", "mx"],
            "europe": ["gb", "de", "fr", "es", "it", "nl"],
            "apac": ["au", "nz", "in", "sg", "jp"],
        }

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

        def normalize_linkedin_categories(vals: List[str]) -> List[str]:
            # Explorium business filters generally align better with LinkedIn category strings.
            # Map single user terms to multiple relevant LinkedIn categories to broaden search.
            alias = {
                "software": ["software development", "technology, information and internet", "computer software"],
                "saas": ["software development", "technology, information and internet"],
                "technology": ["technology, information and internet", "information technology"],
                "tech": ["technology, information and internet"],
                "fintech": ["financial services", "banking"],
                "healthcare": ["healthcare", "biotechnology", "pharmaceuticals"],
                "consulting": ["management consulting", "professional services"],
            }
            normalized = []
            for v in vals:
                k = str(v).strip().lower()
                if not k:
                    continue
                # Get the mapping or use the original value as a single-element list
                mapped_vals = alias.get(k, [k])
                normalized.extend(mapped_vals)

            # If we have a specific software signal, drop generic technology bucket.
            has_software = any(x in {"software development", "computer software"} for x in normalized)
            if has_software:
                normalized = [x for x in normalized if x not in {"technology, information and internet"}]
            
            # Dedup preserving order
            seen = set()
            out = []
            for n in normalized:
                if n in seen:
                    continue
                seen.add(n)
                out.append(n)
            return out

        def normalize_website_keywords(vals: List[str]) -> List[str]:
            # Keep only compact high-signal terms for strict query mode.
            terms = []
            for raw in vals:
                s = str(raw).strip().lower()
                if not s:
                    continue
                if "saas" in s:
                    terms.append("saas")
                if "b2b" in s or "business to business" in s:
                    terms.append("b2b")
                # keep single-token keywords too
                if " " not in s and len(s) >= 3:
                    terms.append(s)
            # Prefer saas first
            ordered = []
            for t in ["saas", "b2b"]:
                if t in terms and t not in ordered:
                    ordered.append(t)
            for t in terms:
                if t not in ordered:
                    ordered.append(t)
            return ordered[:3]

        def normalize_company_size_values(vals: List[str]) -> List[str]:
            """
            Convert free-form numeric ranges to Explorium enum buckets.
            Supported buckets:
            1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+
            """
            allowed = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"]
            bounds = [
                (1, 10, "1-10"),
                (11, 50, "11-50"),
                (51, 200, "51-200"),
                (201, 500, "201-500"),
                (501, 1000, "501-1000"),
                (1001, 5000, "1001-5000"),
                (5001, 10000, "5001-10000"),
                (10001, 10**12, "10001+"),
            ]

            def parse_min_max(raw: str) -> Optional[tuple[int, int]]:
                s = str(raw).strip().lower()
                if not s:
                    return None
                if s in [a.lower() for a in allowed]:
                    if s == "10001+":
                        return (10001, 10**12)
                    if "-" in s:
                        lo, hi = s.split("-", 1)
                        return (int(lo), int(hi))
                # Handle "200-1000", "200 to 1000", "200 – 1000", etc.
                s = s.replace("–", "-").replace("—", "-")
                s = s.replace(" to ", "-")
                if s.endswith("+"):
                    num = "".join(ch for ch in s if ch.isdigit())
                    if num:
                        n = int(num)
                        return (n, 10**12)
                if "-" in s:
                    left, right = s.split("-", 1)
                    lnum = "".join(ch for ch in left if ch.isdigit())
                    rnum = "".join(ch for ch in right if ch.isdigit())
                    if lnum and rnum:
                        lo, hi = int(lnum), int(rnum)
                        if lo > hi:
                            lo, hi = hi, lo
                        return (lo, hi)
                # Single number
                digits = "".join(ch for ch in s if ch.isdigit())
                if digits:
                    n = int(digits)
                    return (n, n)
                return None

            out: List[str] = []
            for raw in vals:
                mm = parse_min_max(raw)
                if mm is None:
                    continue
                req_lo, req_hi = mm
                for lo, hi, label in bounds:
                    # overlap
                    if not (req_hi < lo or req_lo > hi):
                        if label not in out:
                            out.append(label)
            return out

        # Whitelist only filters allowed by Fetch Businesses endpoint
        # Other identifiers (name/domain) are supported via Match endpoint
        mapping = {
            "business_id": "business_id",
            "country_code": "country_code",
            "company_size": "company_size",
            "google_category": "google_category",
            "linkedin_category": "linkedin_category",
            "naics_category": "naics_category",
            "website": "domain",
            "domain": "domain",
            "employee_count": "company_size",  # Map frontend employee_count to company_size
            "industry": "google_category",
            "keywords": "website_keywords",
        }

        # Enforce single category filter (Explorium requirement)
        category_keys = ["google_category", "linkedin_category", "naics_category"]
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
                if dst == "linkedin_category":
                    vals = normalize_linkedin_categories(vals)
                    if not vals:
                        continue
                if dst == "website_keywords":
                    vals = normalize_website_keywords(vals)
                    if not vals:
                        continue
                # Normalize employee/company size ranges to valid Explorium enum values.
                if dst == "company_size":
                    norm_sizes = normalize_company_size_values(vals)
                    if not norm_sizes:
                        continue
                    mapped[dst] = {"values": norm_sizes}
                elif dst in ["domain", "website", "country_code"]:
                    # These filters often do not accept the {"values": [...]} wrap in some Explorium endpoints
                    mapped[dst] = vals
                else:
                    mapped[dst] = {"values": vals}

        # Map generic location filters to country_code when possible.
        loc_vals = values_of("location")
        if loc_vals and "country_code" not in mapped:
            codes: List[str] = []
            for raw in loc_vals:
                v = str(raw).strip().lower()
                if not v:
                    continue
                if v in region_to_codes:
                    codes.extend(region_to_codes[v])
                elif v in country_name_to_code:
                    codes.append(country_name_to_code[v])
                elif len(v) in (2, 3) and v.isalpha():
                    codes.append(v[:2])
            dedup_codes = sorted(list({c.lower() for c in codes if c}))
            if dedup_codes:
                mapped["country_code"] = {"values": dedup_codes}

        print(f">>> [ExploriumService] _map_filters returning: {mapped}", flush=True)
        return mapped

    async def fetch_businesses(
        self,
        frontend_filters: Dict[str, Any],
        size: int = 3,
        page_size: int = 3,
        page: int = 1,
        mode: str = "full",
    ) -> Dict[str, Any]:
        mapped_filters = self._map_filters(frontend_filters)
        payload = {
            "request_context": {},
            "mode": mode,
            "size": size,
            "page_size": page_size,
            "page": page,
            "exclude": [],
            "filters": mapped_filters,
        }
        print(f">>> [ExploriumService] fetch_businesses payload: {payload}", flush=True)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                
                # Robustly extract error message
                error_msg = data
                if isinstance(data, dict):
                    error_msg = data.get("message") or data.get("detail") or data
                elif isinstance(data, list):
                    error_msg = data
                
                print(f">>> [ExploriumService] API Error {resp.status_code}: {error_msg}", flush=True)
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {error_msg}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def search_companies(self, filters: Dict[str, Any], limit: int = 3, strict_filters: bool = False) -> Dict[str, Any]:
        """
        Unified search method for companies using Explorium.
        Handles both high-precision match (if domain/name present) and broad fetch.
        Implements taxonomy-aware fallbacks for industry filters based on Explorium docs.
        """
        domain = filters.get("domain") or filters.get("website")
        name = filters.get("name") or filters.get("company_name")
        companies = []

        print(f">>> [ExploriumService] search_companies called with filters: {filters}", flush=True)
        print(f">>> [ExploriumService] Extracted domain: {domain}, name: {name}", flush=True)

        if domain or name:
            try:
                # Ensure values are strings, not lists
                d_val = domain[0] if isinstance(domain, list) and domain else domain
                n_val = name[0] if isinstance(name, list) and name else name
                inputs = [{"name": n_val, "domain": d_val}]
                print(f">>> [ExploriumService] Attempting Explorium match with: {inputs}", flush=True)
                match_res = await self.match_businesses(inputs)
                print(f">>> [ExploriumService] Explorium match response status: {match_res.keys() if isinstance(match_res, dict) else type(match_res)}", flush=True)
                
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
                
                print(f">>> [ExploriumService] Resolved {len(matched)} candidate matches", flush=True)
                # Rank/filter by query name similarity to avoid noisy mega-brands on name-only queries
                try:
                    qname = (name or "").strip()
                    import re
                    def _norm(s: str) -> str:
                        return re.sub(r"[^a-z0-9]", "", (s or "").lower())
                    ranked: list[tuple[float, dict, str]] = []
                    for m in (matched or []):
                        cand = m
                        if isinstance(m, dict) and m.get("business") and isinstance(m.get("business"), dict):
                            cand = m.get("business")
                        cand_name = str((cand or {}).get("name") or (cand or {}).get("business_name") or "").strip()
                        cand_domain = str((cand or {}).get("domain") or (cand or {}).get("website_domain") or "").strip()
                        an = _norm(qname)
                        bn = _norm(cand_name)
                        dn = _norm(cand_domain.split(".")[0]) if cand_domain else ""
                        score = 0.0
                        if an and bn:
                            if an == bn:
                                score = 1.0
                            elif an in bn or bn in an:
                                score = 0.85
                        if an and dn:
                            if an == dn:
                                score = max(score, 0.95)
                            elif an in dn or dn in an:
                                score = max(score, 0.8)
                        ranked.append((score, m, cand_domain))
                    ranked.sort(key=lambda x: x[0], reverse=True)
                    THRESH = 0.8 if qname else 0.0
                    filtered = [m for (sc, m, d) in ranked if sc >= THRESH]
                    if filtered:
                        matched = filtered
                    elif qname:
                        # As a safety, drop obvious mega-brands when only a name was provided and similarity is low
                        MEGA = {"google.com","amazon.com","linkedin.com","facebook.com","meta.com","microsoft.com","apple.com","youtube.com","instagram.com","twitter.com","x.com"}
                        matched = [m for (sc, m, d) in ranked if str(d).lower() not in MEGA]
                except Exception as _e:
                    print(f">>> [ExploriumService] Name ranking skipped due to error: {_e}", flush=True)
                for item in matched[:limit]:
                    # Handle different match response structures
                    bid = None
                    if isinstance(item, dict):
                        # Direct business_id
                        bid = item.get("business_id")
                        # Nested structure: {'input': {...}, 'business_id': '...'}
                        if not bid and 'business_id' in item:
                            bid = item['business_id']
                    
                    if not bid: 
                        print(f">>> [ExploriumService] No business_id found in matched item: {item.keys()}", flush=True)
                        continue
                    try:
                        # Fetch full profile for matched ID
                        print(f">>> [ExploriumService] Fetching full profile for business_id: {bid}", flush=True)
                        raw = await self.fetch_businesses({"business_id": bid}, size=1, page_size=1, page=1, mode="full")
                        data_list = raw.get("data") or []
                        print(f">>> [ExploriumService] Fetched {len(data_list)} records for bid: {bid}", flush=True)
                        normed = [self.normalize_company(x) for x in data_list]
                        if name:
                            for c in normed:
                                c["__query_name"] = name
                        companies.extend(normed)
                    except Exception as e:
                        print(f">>> [ExploriumService] Error fetching profile for bid {bid}: {e}", flush=True)
            except Exception as e:
                print(f">>> [ExploriumService] Explorium match failed: {e}", flush=True)
        
        # If no companies from match or fewer than limit, also fetch a broad batch to fill up
        if len(companies) < limit:
            remaining = limit - len(companies)
            print(f">>> [ExploriumService] Have {len(companies)}/{limit} companies, fetching {remaining} more via broad search", flush=True)
            try:
                # Build filters without domain/name to get broader results
                broad_filters = {k: v for k, v in filters.items() if k not in ("domain", "website", "name", "company_name")}
                # Use original filters if no broad filters remain
                fetch_filters = broad_filters if broad_filters else filters
                raw = await self.fetch_businesses(fetch_filters, size=remaining + 5, page_size=remaining + 5, page=1, mode="full")
                data_list = raw.get("data") or []
                print(f">>> [ExploriumService] Explorium broad fetch returned {len(data_list)} records", flush=True)
                existing_domains = {str(c.get("domain", "")).lower() for c in companies}
                existing_names = {str(c.get("name", "")).lower() for c in companies}
                for item in data_list:
                    if len(companies) >= limit:
                        break
                    normed = self.normalize_company(item)
                    # Deduplicate by domain and name
                    item_domain = str(normed.get("domain", "")).lower()
                    item_name = str(normed.get("name", "")).lower()
                    if item_domain and item_domain in existing_domains:
                        continue
                    if item_name and item_name in existing_names:
                        continue
                    if name:
                        normed["__query_name"] = name
                    companies.append(normed)
                    if item_domain:
                        existing_domains.add(item_domain)
                    if item_name:
                        existing_names.add(item_name)
            except Exception as e:
                print(f">>> [ExploriumService] Explorium broad fetch failed: {e}", flush=True)

        if strict_filters and not companies:
            print(">>> [ExploriumService] strict_filters enabled; returning zero without broadening.", flush=True)
        # Final guard: for name-only queries (no domain), filter normalized companies by similarity and exclude mega-brands
        try:
            if name and not domain and companies:
                import re
                def _norm(s: str) -> str:
                    return re.sub(r"[^a-z0-9]", "", (s or "").lower())
                an = _norm(name)
                MEGA = {"google.com","amazon.com","linkedin.com","facebook.com","meta.com","microsoft.com","apple.com","youtube.com","instagram.com","twitter.com","x.com"}
                scored = []
                for c in companies:
                    cname = str(c.get("name") or "")
                    cdomain = str(c.get("domain") or "")
                    bn = _norm(cname)
                    dn = _norm(cdomain.split(".")[0]) if cdomain else ""
                    sc = 0.0
                    if an and bn:
                        if an == bn: sc = 1.0
                        elif an in bn or bn in an: sc = 0.85
                    if an and dn:
                        if an == dn: sc = max(sc, 0.95)
                        elif an in dn or dn in an: sc = max(sc, 0.8)
                    scored.append((sc, c))
                # keep only high similarity
                filtered = [c for (sc,c) in scored if sc >= 0.8]
                if filtered:
                    companies = filtered
                else:
                    # exclude mega-brands if no similar match
                    companies = [c for c in companies if str(c.get("domain","")) not in MEGA]
        except Exception as _e:
            print(f">>> [ExploriumService] Final name-only filtering skipped due to error: {_e}", flush=True)

        return {
            "companies": companies[:limit],
            "total": len(companies)
        }

    def _broaden_industries(self, values: Any) -> List[str]:
        """
        Based on Explorium docs (firmographics expose linkedin_industry_category and naics),
        broaden LinkedIn-like labels to generic categories that are more likely to match provider taxonomies.
        Heuristics:
        - Normalize separators (and/&)
        - If term contains 'manufacturing', include 'Manufacturing'
        - If contains 'food' and 'beverage', include 'Food', 'Beverage', 'Food & Beverage'
        - Always include the original cleaned value variants
        """
        def norm(s: str) -> str:
            return " ".join(s.replace("&", "and").split()).strip()
        arr = values if isinstance(values, list) else [values]
        out: List[str] = []
        for v in arr:
            if not v:
                continue
            s = str(v)
            low = s.lower()
            # base variants
            base = {s.strip()}
            if "&" in s or " and " in low:
                base.add(s.replace("&", "and"))
                base.add(s.replace("and", "&"))
            # specific expansions
            if "software" in low or "saas" in low:
                base.update({"software development", "technology, information and internet", "computer software"})
            if "tech" in low:
                base.update({"technology, information and internet", "information technology"})
            if "manufacturing" in low:
                base.add("Manufacturing")
            if "food" in low and "beverage" in low:
                base.update({"Food", "Beverage", "Food & Beverage", "Food and Beverage"})
            out.extend(list(base))
        # de-duplicate while preserving order
        seen = set()
        uniq = []
        for x in out:
            if x not in seen:
                uniq.append(x)
                seen.add(x)
        return uniq

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
            if isinstance(data, dict):
                message = data.get("message") or data.get("detail") or data
            elif isinstance(data, list):
                message = data or resp.text
            else:
                message = data
            raise httpx.HTTPStatusError(
                f"{resp.status_code} {resp.reason_phrase}: {message}",
                request=resp.request,
                response=resp,
            )
        return resp.json()

    async def enrich_lookalikes(self, business_id: str) -> Dict[str, Any]:
        payload = {
            "business_id": business_id,
            "request_context": {},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/lookalikes/enrich",
                headers=self._headers(),
                json=payload,
            )
        if resp.status_code >= 400:
            try:
                data = resp.json()
            except Exception:
                data = {"message": resp.text}
            message = data.get("message") if isinstance(data, dict) else data
            raise httpx.HTTPStatusError(
                f"{resp.status_code} {resp.reason_phrase}: {message}",
                request=resp.request,
                response=resp,
            )
        return resp.json()

    async def match_prospects(self, prospects_to_match: List[Dict[str, Any]]) -> Dict[str, Any]:
        payload = {
            "request_context": {},
            "prospects_to_match": prospects_to_match,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/prospects/match",
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

    async def bulk_enrich_bombora_intent(self, business_ids: List[str], topics: str, min_score: int = 60) -> Dict[str, Any]:
        payload = {
            "business_ids": business_ids,
            "parameters": {
                "topics": topics.split(";") if isinstance(topics, str) else topics,
                "min_score": min_score
            }
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/bombora_intent/bulk_enrich",
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
        from datetime import datetime
        payload = {
            "business_id": business_id,
            "parameters": {
                # Try ISO format for Explorium Pydantic validation
                "date": datetime.now().isoformat()
            },
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
            raw.get("linkedin_category")
            or raw.get("linkedin_industry_category")
            or raw.get("naics_description")
            or raw.get("sic_code_description")
            or raw.get("primary_industry")
            or raw.get("industry")
        )
        # Canonical industry normalization for user-friendly display and reliable filtering
        if industry:
            ind_low = str(industry).lower()
            if any(x in ind_low for x in ["software", "computer programming", "computer systems design", "computer related services", "saas"]):
                industry = "Software"
            elif any(x in ind_low for x in ["finance", "banking", "fintech", "investment"]):
                industry = "Financial Services"
            elif any(x in ind_low for x in ["healthcare", "medical", "hospital", "pharma", "biotechnology"]):
                industry = "Healthcare"
            elif any(x in ind_low for x in ["marketing", "advertising", "martech", "public relations"]):
                industry = "Marketing and Advertising"
            elif any(x in ind_low for x in ["ecommerce", "e-commerce", "retail", "online shop"]):
                industry = "E-commerce"
            elif any(x in ind_low for x in ["consulting", "professional services", "business consulting"]):
                industry = "Consulting"
            elif any(x in ind_low for x in ["information technology", "it services", "it consulting"]):
                industry = "Information Technology"
        
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

    async def bulk_enrich_firmographics(self, business_ids: List[str]) -> Dict[str, Any]:
        payload = {
            "business_ids": business_ids,
            "parameters": {}
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/firmographics/bulk_enrich",
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

    async def bulk_enrich_website_traffic(self, business_ids: List[str], month_period: Optional[str] = None) -> Dict[str, Any]:
        from datetime import datetime as _dt
        if not month_period:
            month_period = _dt.utcnow().strftime("%Y-%m")
        payload = {
            "business_ids": business_ids,
            "parameters": {"month_period": month_period}
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/website_traffic/bulk_enrich",
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

    async def bulk_enrich_business_challenges(self, business_ids: List[str]) -> Dict[str, Any]:
        payload = {
            "business_ids": business_ids,
            "parameters": {}
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/pc_business_challenges_10k/bulk_enrich",
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

    async def bulk_enrich_financial_indicators(self, business_ids: List[str]) -> Dict[str, Any]:
        from datetime import datetime
        payload = {
            "business_ids": business_ids,
            "parameters": {
                "date": datetime.now().isoformat()
            }
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/financial_indicators/bulk_enrich",
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

    async def fetch_prospects(
        self,
        frontend_filters: Dict[str, Any],
        size: int = 3,
        page_size: int = 3,
        page: int = 1,
        mode: str = "full",
    ) -> Dict[str, Any]:
        # Note: Prospects may not have the same filter mapping, adjust as needed
        mapped_filters = {}  # For now, no filters mapping, as prospects filters may differ
        payload = {
            "request_context": {},
            "mode": mode,
            "size": size,
            "page_size": page_size,
            "page": page,
            "exclude": [],
            "filters": mapped_filters,
        }
        print(f">>> [ExploriumService] fetch_prospects payload: {payload}", flush=True)
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/prospects",
                headers=self._headers(),
                json=payload,
            )
            if resp.status_code >= 400:
                try:
                    data = resp.json()
                except Exception:
                    data = {"message": resp.text}
                
                # Robustly extract error message
                error_msg = data
                if isinstance(data, dict):
                    error_msg = data.get("message") or data.get("detail") or data
                elif isinstance(data, list):
                    error_msg = data
                
                print(f">>> [ExploriumService] API Error {resp.status_code}: {error_msg}", flush=True)
                raise httpx.HTTPStatusError(
                    f"{resp.status_code} {resp.reason_phrase}: {error_msg}",
                    request=resp.request,
                    response=resp,
                )
            return resp.json()

    async def bulk_enrich_contacts_information(self, prospect_ids: List[str]) -> Dict[str, Any]:
        payload = {
            "prospect_ids": prospect_ids,
            "parameters": {}
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/prospects/contacts_information/bulk_enrich",
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

    async def autocomplete_businesses(self, field: str, query: str, semantic_search: bool = False) -> Dict[str, Any]:
        params = {"field": field, "query": query}
        if semantic_search:
            params["semantic_search"] = "true"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(
                f"{self.base_url}/businesses/autocomplete",
                headers=self._headers(),
                params=params,
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

    async def fetch_business_events(
        self,
        business_ids: List[str],
        event_types: List[str],
        timestamp_from: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "business_ids": business_ids,
            "event_types": event_types,
        }
        if timestamp_from:
            payload["timestamp_from"] = timestamp_from
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/events",
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

    async def fetch_prospect_events(
        self,
        prospect_ids: List[str],
        event_types: List[str],
        timestamp_from: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "prospect_ids": prospect_ids,
            "event_types": event_types,
        }
        if timestamp_from:
            payload["timestamp_from"] = timestamp_from
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/prospects/events",
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

    async def enroll_business_events(self, business_ids: List[str], event_types: List[str]) -> Dict[str, Any]:
        payload = {
            "business_ids": business_ids,
            "event_types": event_types
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/businesses/events/enrollments",
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
