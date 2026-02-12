"""
Search Service - FIXED: Realtime Search → Crustdata Enrich → ContactOut + Insights
"""
import logging
import time
from typing import Dict, List, Optional, Any
from uuid import UUID
from sqlalchemy.orm import Session

from app.services.crustdata_service import CrustdataService
from app.services.contactout_service import ContactOutService
from app.services.post_filter_service import PostFilterService
from app.services.filter_mapping_service import FilterMappingService
from app.services.explorium_service import ExploriumService
from app.db.models.user import User
from app.db.models.credit import CreditTransaction

logger = logging.getLogger(__name__)


class SearchService:
    def __init__(self, db: Session):
        self.db = db
        self.crustdata = CrustdataService()

    def _validate_credits(self, user_id: Optional[UUID], required_credits: int) -> tuple[bool, str]:
        if user_id is None:
            return True, ""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False, "User not found"
        if user.credits_balance < required_credits:
            return False, f"Insufficient credits. Required: {required_credits}, Available: {user.credits_balance}"
        return True, ""

    def _deduct_credits(self, user_id: Optional[UUID], amount: int, search_query_id: Optional[UUID] = None):
        if user_id is None:
            return
        user = self.db.query(User).filter(User.id == user_id).with_for_update().first()
        if not user:
            raise Exception("User not found")
        user.credits_balance -= amount
        if search_query_id:
            self.db.add(CreditTransaction(
                user_id=user_id, amount=-amount, transaction_type="usage",
                reference_id=str(search_query_id), description=f"Search {search_query_id}"
            ))
        self.db.commit()

    async def execute_company_search(
        self, user_id: Optional[UUID], filters: Dict[str, Any], options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main search flow:
        1. Crustdata Realtime Search (/screener/company/search)
        2. Crustdata Enrichment (/screener/company)
        3. ContactOut enrichment
        4. Compute insights
        """
        options = options or {}
        limit = options.get("limit", 3)
        prefetch_limit = options.get("prefetch_limit", limit)
        if not isinstance(prefetch_limit, int) or prefetch_limit < limit:
            prefetch_limit = limit
        should_enrich = options.get("enrich", True)
        post_filters = options.get("post_filters")
        if not isinstance(post_filters, dict):
            post_filters = {}

        # Credits check
        has_credits, credit_error = self._validate_credits(user_id, limit)
        if not has_credits:
            return {"success": False, "error": {"code": "INSUFFICIENT_CREDITS", "message": credit_error}}

        # Step 1: Comprehensive Search using all Crustdata endpoints
        try:
            # Transform filters for Real-time Search
            # Uses the new list-based format (REGION, INDUSTRY, etc.)
            realtime_filters_payload = FilterMappingService.transform_to_realtime_format(filters)
            
            # Pass to comprehensive search (which now wraps realtime_company_search)
            api_response = await self.crustdata.comprehensive_company_search(realtime_filters_payload, prefetch_limit)
        except Exception as e:
            logger.error(f"Crustdata API error: {e}")
            return {"success": False, "error": {"code": "API_ERROR", "message": str(e)}}

        raw_companies = api_response.get("companies", [])[:prefetch_limit]
        print(f">>> SearchService: Got {len(raw_companies)} companies from Crustdata", flush=True)

        # Step 2: Normalize Crustdata data
        companies_list: List[Dict[str, Any]] = []
        for idx, raw in enumerate(raw_companies):
            try:
                n = self.crustdata.normalize_company(raw)
                company = self._build_base_company(idx, n)
                companies_list.append(company)
            except Exception as e:
                logger.warning(f"Failed to normalize company {idx}: {e}")

        if not companies_list:
            return {"success": True, "data": {"companies": [], "meta": {"credits_used": 0}}}

        # Step 3: Parallel Enrichment for Top Results
        if should_enrich:
            # We enrich up to the limit requested (to save latency/credits)
            # but prefetch_limit results were fetched from initial search.
            target_companies = companies_list[:limit]
            await self._comprehensive_enrichment(target_companies)

            # Re-compute insights after enrichment (multi-source data)
            for company in target_companies:
                company['insights'] = self._compute_insights(company)

        # Step 4: Post-filtering (must happen before final limit cap)
        before_post_filter = len(companies_list)
        if post_filters:
            companies_list = PostFilterService.apply_post_filters(companies_list, post_filters)
        after_post_filter = len(companies_list)

        # Deduct credits
        # Apply final cap after enrichment + insights
        companies_list = companies_list[:limit]

        companies_returned = len(companies_list)
        if companies_returned > 0 and user_id:
            self._deduct_credits(user_id, companies_returned)
            print(f">>> Deducted {companies_returned} credits", flush=True)

        return {
            "success": True,
            "source": "api",
            "data": {
                "companies": companies_list,
                "meta": {
                    "total_results": api_response.get("total_display_count", companies_returned),
                    "returned_results": companies_returned,
                    "enriched": should_enrich,
                    "credits_used": companies_returned,
                    "total_before_post_filter": before_post_filter,
                    "total_after_post_filter": after_post_filter,
                }
            }
        }

    async def _comprehensive_enrichment(self, companies: List[Dict[str, Any]]):
        """
        Parallel enrichment from:
        1. ContactOut (Company + DMs)
        2. Explorium (Firmographics + Phone/Email)
        3. Crustdata (LinkedIn Posts for Insights)
        """
        import asyncio
        from app.services.explorium_service import ExploriumService

        explorium = ExploriumService()
        contactout = ContactOutService()
        
        tasks = []
        for company in companies:
            domain = company.get("domain")
            name = company.get("name")
            
            # 1. ContactOut (Company + DMs)
            tasks.append(self._enrich_company_from_contactout(company, contactout))
            tasks.append(self._enrich_decision_makers(company, contactout))
            
            # 2. Explorium (Match)
            tasks.append(self._enrich_company_from_explorium(company, explorium))
            
            # 3. Crustdata (LinkedIn Posts)
            tasks.append(self._enrich_from_linkedin_posts(company))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _enrich_company_from_contactout(self, company: Dict[str, Any], service: ContactOutService):
        domain = company.get("domain")
        if not domain: return
        # Guard: if original query was a pure name and similarity to domain is low, skip mega-brand enrichment
        try:
            qname = (company.get("__query_name") or "").strip()
            if qname and domain:
                import re
                def _norm(s: str) -> str:
                    return re.sub(r"[^a-z0-9]", "", (s or "").lower())
                an = _norm(qname)
                dn = _norm(str(domain).split(".")[0])
                MEGA = {"google","amazon","linkedin","facebook","meta","microsoft","apple","youtube","instagram","twitter","x"}
                if dn in MEGA and an not in {dn} and an not in dn and dn not in an:
                    print(f">>> [SearchService] Skipping ContactOut enrichment for mega-brand domain {domain} (query={qname})", flush=True)
                    return
        except Exception:
            pass
        try:
            co_data = await service.enrich_companies_by_domain([domain])
            co_norm = service.normalize_company_enrichment(co_data.get("companies", {}))
                # Surgical merge: only update if value is present in enrichment
            merged_keys = []
            for k, v in co_norm.items():
                if v not in (None, "", [], {}, 0, "N/A"):
                    company[k] = v
                    merged_keys.append(k)
            company["contactout_enriched"] = True
            print(f">>> [SearchService] Merged {len(merged_keys)} fields from ContactOut: {merged_keys}", flush=True)
        except Exception as e:
            logger.warning(f"ContactOut enrichment failed for {domain}: {e}")

    async def _enrich_decision_makers(self, company: Dict[str, Any], service: ContactOutService):
        domain = company.get("domain")
        if not domain: return
        try:
            dm_data = await service.get_decision_makers(domain=domain)
            profiles = dm_data.get("profiles", [])
            company["decision_makers"] = [service.normalize_decision_maker(p) for p in profiles]
        except Exception as e:
            logger.warning(f"Decision makers fetch failed for {domain}: {e}")

    async def _enrich_company_from_explorium(self, company: Dict[str, Any], service: ExploriumService):
        try:
            # Shift to the robust full enrichment method
            enriched = await service.enrich_company_fully(company)
            if enriched:
                # Surgical merge: only update if value is present in enrichment
                merged_keys = []
                for k, v in enriched.items():
                    if v not in (None, "", [], {}, 0, "N/A"):
                        company[k] = v
                        merged_keys.append(k)
                print(f">>> [SearchService] Merged {len(merged_keys)} fields from Explorium for {company.get('domain')}: {merged_keys}", flush=True)
            
            # Ensure explorium_id is always set
            if enriched and enriched.get("id"):
                company["explorium_id"] = enriched.get("id")
        except Exception as e:
            logger.warning(f"Explorium full enrichment failed for {company.get('domain')}: {e}")

    async def _enrich_from_linkedin_posts(self, company: Dict[str, Any]):
        domain = company.get("domain")
        name = company.get("name")
        try:
            posts_data = await self.crustdata.realtime_linkedin_posts_by_company(
                company_domain=domain, company_name=name, limit=5
            )
            posts = posts_data.get("posts", [])
            company["recent_posts"] = posts
            
            # Analyze posts for insights
            social_insights = []
            post_texts = " ".join([p.get("text", "").lower() for p in posts])
            
            if "hiring" in post_texts or "join our team" in post_texts:
                social_insights.append("actively-hiring")
            if "funding" in post_texts or "series" in post_texts or "raised" in post_texts:
                social_insights.append("social-funding-buzz")
            if "partnership" in post_texts or "partnered" in post_texts:
                social_insights.append("partnership-active")
            if "launch" in post_texts or "introducing" in post_texts:
                social_insights.append("product-momentum")
                
            company["social_insights"] = social_insights
        except Exception as e:
            logger.warning(f"LinkedIn insights failed for {domain}: {e}")

    def _build_base_company(self, idx: int, n: Dict[str, Any]) -> Dict[str, Any]:
        """Build base company object from Crustdata search."""
        return {
            "id": f"temp_{idx}_{hash(n.get('domain', ''))}",
            "name": n.get("company_name") or n.get("name", ""),
            "domain": n.get("domain") or n.get("website_domain", ""),
            "website": n.get("website") or n.get("company_website_url", ""),
            "logo_url": n.get("logo_url") or n.get("logo", ""),
            "industry": n.get("industry") or (n.get("linkedin_industries", [])[0] if n.get("linkedin_industries") else ""),
            "description": n.get("description") or n.get("short_description") or n.get("company_description", ""),
            "company_type": n.get("company_type", ""),
            "founded_year": n.get("founded_year") or n.get("year_founded"),
            "employee_count": n.get("employee_count_exact") or n.get("employee_count_range", ""),
            "employee_count_exact": n.get("employee_count_exact") or n.get("employee_count"),
            "employee_count_range": n.get("employee_count_range", ""),
            "revenue": n.get("revenue_range", ""),
            "revenue_range": n.get("revenue_range", "") or n.get("estimated_revenue_lower_bound_usd", ""),
            "revenue_exact": n.get("revenue_exact"),
            "headquarters_country": n.get("headquarters_country") or n.get("country", ""),
            "headquarters_state": n.get("headquarters_state") or n.get("state", ""),
            "headquarters_city": n.get("headquarters_city") or n.get("city", ""),
            "location": n.get("location") or n.get("headquarters_region") or n.get("hq_location", ""),
            "phone": n.get("phone", "N/A"),
            "email": n.get("email", "N/A"),
            "linkedin_url": n.get("linkedin_url", ""),
            "twitter_url": n.get("twitter_url", ""),
            "facebook_url": n.get("facebook_url", ""),
            "instagram_url": n.get("instagram_url", ""),
            "follower_count": n.get("follower_count") or (n.get("linkedin_followers", {}) or {}).get("latest_count", 0),
            "technologies": n.get("technologies") or n.get("tech_stack", []),
            "specialties": n.get("specialties") or n.get("categories", []),
            "employee_growth_6m_percent": n.get("employee_growth_6m_percent"),
            "employee_growth_12m_percent": n.get("employee_growth_12m_percent"),
            "funding_stage": n.get("funding_stage") or n.get("last_funding_type", ""),
            "funding_total": n.get("funding_total") or n.get("total_funding_raised_usd"),
            "last_funding_date": n.get("last_funding_date"),
            "decision_makers_count": n.get("decision_makers_count"),
            "quality_score": n.get("data_quality_score", 50),
            "provider_source": "crustdata",
            "contactout_enriched": False,
            "employee_count_display": self._format_employee_count(n),
            "location_display": self._format_location(n),
            "revenue_display": n.get("revenue_range", "") or "N/A",
            "investors": n.get("investors", []),
            "investors_count": n.get("investors_count"),
            "locations": n.get("locations", []),
            "zip_code": n.get("zip_code") or n.get("zip", ""),
            "naics": n.get("naics", ""),
            "taxonomy": n.get("taxonomy", ""),
            "headquarters_address": n.get("headquarters_address") or n.get("hq_location", "")
        }

    async def _enrich_with_contactout(self, companies: List[Dict[str, Any]]):
        """Layer ContactOut enrichment on top of Crustdata."""
        domains = [c["domain"] for c in companies if c.get("domain")]
        if not domains:
            return

        try:
            contactout = ContactOutService()
            co_data = await contactout.enrich_companies_by_domain(domains)
            companies_data = co_data.get("companies", {})
            
            # Parse ContactOut response
            co_map = {}
            if isinstance(companies_data, dict):
                for domain, raw in companies_data.items():
                    if domain in domains:
                        co_map[domain] = ContactOutService.normalize_company_enrichment({domain: raw})
            elif isinstance(companies_data, list):
                for item in companies_data:
                    if isinstance(item, dict):
                        for domain, raw in item.items():
                            if domain in domains:
                                co_map[domain] = ContactOutService.normalize_company_enrichment({domain: raw})

            print(f">>> ContactOut enriched {len(co_map)}/{len(domains)} domains", flush=True)

            # Merge - fill gaps only
            for company in companies:
                domain = company.get("domain")
                if not domain or domain not in co_map:
                    continue
                
                co = co_map[domain]
                
                # Fill missing fields (don't overwrite)
                company["founded_year"] = company.get("founded_year") or co.get("founded_year") or co.get("founded_at")
                company["employee_count_exact"] = company.get("employee_count_exact") or co.get("size")
                company["revenue_exact"] = company.get("revenue_exact") or co.get("revenue")
                company["company_type"] = company.get("company_type") or co.get("type")
                company["linkedin_url"] = company.get("linkedin_url") or co.get("li_vanity")
                company["description"] = company.get("description") or co.get("description")
                company["logo_url"] = company.get("logo_url") or co.get("logo_url")
                company["headquarters_country"] = company.get("headquarters_country") or co.get("country")
                company["headquarters_city"] = company.get("headquarters_city") or (co.get("headquarter") or "").split(",")[0].strip()
                company["contactout_enriched"] = True
                
                print(f">>> Enriched {domain}: founded={company['founded_year']}, emp={company['employee_count_exact']}, type={company['company_type']}", flush=True)
                
        except Exception as e:
            print(f">>> ContactOut enrichment failed: {e}", flush=True)

    def _compute_insights(self, company: Dict[str, Any]) -> List[str]:
        """Compute multi-field insights."""
        insights = []
        growth_6m = company.get('employee_growth_6m_percent', 0) or 0
        has_funding = company.get('funding_stage') and company.get('funding_stage') != 'N/A'
        tech_count = len(company.get('technologies', []))
        emp_count = company.get('employee_count_exact', 0) or 0
        followers = company.get('follower_count', 0) or 0
        
        if growth_6m > 20 and has_funding:
            insights.append('high-growth-funded')
        if tech_count > 5 and emp_count > 50:
            insights.append('scaling-tech')
        if company.get('last_funding_date') and company.get('last_funding_date') != 'N/A':
            insights.append('recently-funded')
        if followers > 10000:
            insights.append('social-active')
        if growth_6m > 30 and not has_funding:
            insights.append('organic-growth')
        
        # Size category
        if emp_count > 1000:
            insights.append('enterprise')
        elif emp_count > 100:
            insights.append('mid-market')
        elif emp_count > 10:
            insights.append('smb')
        else:
            insights.append('startup')
        
        if tech_count > 10:
            insights.append('tech-forward')
        
        return insights

    @staticmethod
    def _format_employee_count(n: Dict) -> str:
        exact = n.get("employee_count_exact")
        return f"{exact:,}" if exact else (n.get("employee_count_range", "N/A") or "N/A")

    @staticmethod
    def _format_location(n: Dict) -> str:
        parts = [p for p in [n.get("headquarters_city"), n.get("headquarters_state"), n.get("headquarters_country")] if p]
        return ", ".join(parts) if parts else (n.get("location") or "N/A")

    async def search_companies_explorium(self, filters: Dict[str, Any], limit: int = 3) -> Dict[str, Any]:
        """
        Search companies using Explorium API + ContactOut enrichment.
        This replaces the Crustdata-based search to avoid 401 errors.
        """
        print("!!! SEARCH SERVICE SEARCH_COMPANIES_EXPLORIUM CALLED !!!", flush=True)
        print(f">>> [SearchService] search_companies_explorium called with filters: {filters}, limit: {limit}", flush=True)
        try:
            explorium = ExploriumService()
            
            # Call Explorium API
            result = await explorium.search_companies(filters, limit)
            print(f">>> [SearchService] Explorium returned {len(result.get('companies', []))} companies", flush=True)
            
            if not result or not result.get("companies"):
                return {"companies": [], "sources_used": ["explorium"]}
            
            companies = result.get("companies", [])
            
            # Enrich with ContactOut data
            await self._comprehensive_enrichment(companies)
            
            return {
                "companies": companies,
                "sources_used": ["explorium", "contactout"]
            }
            
        except Exception as e:
            logger.error(f"Explorium search failed: {e}")
            return {"companies": [], "sources_used": []}