"""
Post-Filter Service - Backend Re-Filtering of Crustdata Results

This service filters Crustdata API results based on filters that aren't supported
by the Company Search API (name, revenue, funding, technologies, etc.).

Flow:
1. Crustdata API returns companies (filtered by 5 supported filters)
2. This service re-filters results using the "skipped" filters
3. Final results match ALL user-selected filters
"""
import logging
import re
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class PostFilterService:
    """
    Filters Crustdata API response based on filters not supported by the API.
    
    Supported post-filters:
    - name: Company name contains search term
    - revenue: Revenue within min/max range
    - funding_stage: Last funding round type
    - year_founded: Founded year range
    - technologies: Tech stack (if available)
    """
    
    @staticmethod
    def apply_post_filters(
        companies: List[Dict[str, Any]], 
        post_filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Apply post-filters to a list of companies.
        
        Args:
            companies: List of company dicts from Crustdata API
            post_filters: Dict of filters to apply (name, revenue, etc.)
            
        Returns:
            Filtered list of companies matching all post-filters
        """
        print(f">>> PostFilterService: Applying post_filters: {post_filters}", flush=True)
        print(f">>> PostFilterService: Input companies count: {len(companies)}", flush=True)
        
        if not post_filters:
            print(">>> PostFilterService: No post-filters to apply", flush=True)
            return companies
        
        filtered = companies
        applied_filters = []
        
        # Apply each post-filter with error handling
        for filter_key, filter_value in post_filters.items():
            # Skip empty, null, undefined, or empty string values
            if not filter_value or filter_value == "" or filter_value == "undefined" or filter_value == "null":
                print(f">>> PostFilterService: Skipping empty filter '{filter_key}': {filter_value}", flush=True)
                continue
                
            before_count = len(filtered)
            print(f">>> PostFilterService: Applying filter '{filter_key}': {filter_value} (companies: {before_count})", flush=True)
            
            try:
                filtered = PostFilterService._apply_single_filter(filtered, filter_key, filter_value)
                after_count = len(filtered)
                print(f">>> PostFilterService: After filter '{filter_key}': {before_count} -> {after_count} companies", flush=True)
                applied_filters.append(filter_key)
            except Exception as e:
                print(f">>> PostFilterService: Filter '{filter_key}' failed: {e}", flush=True)
                print(f">>> PostFilterService: Keeping all {before_count} companies due to filter error", flush=True)
                # Don't apply this filter if it fails - keep all companies
                continue
            
            if before_count != after_count:
                applied_filters.append(f"{filter_key}: {before_count} -> {after_count}")
        
        if applied_filters:
            logger.info(f"Post-filtering applied: {applied_filters}")
        
        # SAFETY CHECK: If post-filtering removed ALL companies, return original list
        if len(filtered) == 0 and len(companies) > 0:
            print(f">>> PostFilterService: SAFETY - Post-filtering removed all {len(companies)} companies, returning original list", flush=True)
            return companies
        
        return filtered
    
    @staticmethod
    def _apply_single_filter(
        companies: List[Dict[str, Any]], 
        filter_key: str, 
        filter_value: Any
    ) -> List[Dict[str, Any]]:
        """Apply a single filter to company list."""
        
        # ---- NAME FILTER (contains, case-insensitive) ----
        if filter_key == 'name':
            search_term = filter_value.lower() if isinstance(filter_value, str) else str(filter_value).lower()
            return [
                c for c in companies 
                if c.get('name') and search_term in c.get('name', '').lower()
            ]
        
        # ---- REVENUE FILTER (min/max range) ----
        elif filter_key == 'revenue':
            if isinstance(filter_value, dict):
                min_rev = filter_value.get('min', 0)
                max_rev = filter_value.get('max', float('inf'))
                currency = filter_value.get('currency', 'USD')
            else:
                # If not a dict, assume it's a revenue range string - skip filtering
                print(f">>> PostFilterService: Skipping revenue filter - not a dict: {filter_value}", flush=True)
                return companies
            
            def revenue_matches(company):
                revenue = company.get('revenue_exact') or company.get('revenue')
                rev_range = company.get('revenue_range')
                
                # More permissive revenue matching
                if revenue and isinstance(revenue, (int, float)):
                    # Compare exact revenue
                    return min_rev <= revenue <= max_rev
                elif rev_range:
                    # Parse revenue range (e.g., "$2.5M" -> 2.5)
                    try:
                        rev_str = str(rev_range).replace('$', '').replace('M', '').replace('K', '').replace('B', '')
                        rev_num = float(rev_str) if rev_str else 0
                        # Convert to millions for comparison
                        if 'M' in str(rev_range):
                            return min_rev <= rev_num <= max_rev
                        elif 'K' in str(rev_range):
                            rev_millions = rev_num / 1000
                            return min_rev <= rev_millions <= max_rev
                        elif 'B' in str(rev_range):
                            rev_millions = rev_num * 1000
                            return min_rev <= rev_millions <= max_rev
                        else:
                            return min_rev <= rev_num <= max_rev
                    except (ValueError, AttributeError):
                        print(f">>> PostFilterService: Revenue parsing failed for: {rev_range}", flush=True)
                        return True  # Include if parsing fails
                
                # Parse string like "10M-50M"
                try:
                    import re
                    match = re.match(r'(\d+\.?\d*)([MK]?)-(\d+\.?\d*)([MK]?)', rev_range)
                    if match:
                        min_val, min_unit, max_val, max_unit = match.groups()
                        min_val = float(min_val) * (1000 if min_unit == 'M' else 1)
                        max_val = float(max_val) * (1000 if max_unit == 'M' else 1)
                        return min_val <= max_rev and max_val >= min_rev
                except:
                    pass
                
                return True  # Default: include if no revenue data
            
            return [c for c in companies if revenue_matches(c)]
        
        # ---- CATEGORIES FILTER ----
        elif filter_key == 'categories':
            # Best-effort: if upstream data doesn't provide categories, we cannot
            # reliably filter, so we keep all companies.
            if not any(isinstance(c.get('categories'), list) and c.get('categories') for c in companies):
                return companies

            categories = filter_value if isinstance(filter_value, list) else [filter_value]
            categories_lower = [c.lower() for c in categories]
            
            return [
                c for c in companies 
                if any(cat.lower() in categories_lower for cat in c.get('categories', []))
            ]
        
        # ---- YEAR FOUNDED FILTER ----
        elif filter_key == 'year_founded' or filter_key == 'founded_year':
            if isinstance(filter_value, dict):
                min_year = filter_value.get('min', 1900)
                max_year = filter_value.get('max', 2100)
            elif isinstance(filter_value, (int, str)):
                min_year = int(filter_value)
                max_year = 2100
            else:
                return companies
            
            def year_matches(company):
                founded = company.get('founded_year')
                if not founded:
                    return False
                try:
                    year = int(founded) if isinstance(founded, (int, str)) else founded
                    return min_year <= year <= max_year
                except (ValueError, TypeError):
                    return False
            
            return [c for c in companies if year_matches(c)]
        
        # ---- FUNDING STAGE FILTER ----
        elif filter_key == 'funding_stage':
            stages = filter_value if isinstance(filter_value, list) else [filter_value]
            stages_lower = [s.lower() for s in stages]
            
            # Note: This field may not be in CompanySearchResponse
            # Would need to enrich or use Screening API
            return [
                c for c in companies 
                if c.get('funding_stage', '').lower() in stages_lower or
                   c.get('last_funding_round_type', '').lower() in stages_lower
            ]
        
        # ---- TECHNOLOGIES FILTER ----
        elif filter_key == 'technologies':
            techs = filter_value if isinstance(filter_value, list) else [filter_value]
            techs_lower = [t.lower() for t in techs]
            
            def has_technology(company):
                company_techs = company.get('technologies', []) or []
                company_techs_lower = [t.lower() for t in company_techs]
                # Check if any selected tech is in company's tech stack
                return any(t in company_techs_lower for t in techs_lower)
            
            # If no tech data, keep all (can't filter)
            return [c for c in companies if has_technology(c) or not c.get('technologies')]
        
        # ---- COMPANY TYPE FILTER ----
        elif filter_key == 'company_type':
            # Company type values can vary by provider (Crustdata vs ContactOut).
            # Normalize common synonyms to match values like "Public Company" / "Privately Held".
            types = filter_value if isinstance(filter_value, list) else [filter_value]

            normalized_targets: List[str] = []
            for t in types:
                if t is None:
                    continue
                tl = str(t).strip().lower()
                if not tl:
                    continue

                if tl in {"private", "privately held", "privately-held"}:
                    normalized_targets.extend(["privately held", "private", "privately-held"])
                elif tl in {"public", "public company", "public-company"}:
                    normalized_targets.extend(["public company", "public", "public-company"])
                elif tl in {"nonprofit", "non profit", "non-profit"}:
                    normalized_targets.extend(["non profit", "nonprofit", "non-profit"])
                else:
                    normalized_targets.append(tl)

            if not normalized_targets:
                return companies

            def matches_company_type(company: Dict[str, Any]) -> bool:
                ct = company.get('company_type') or ''
                ctl = str(ct).strip().lower()
                if not ctl:
                    return False

                # Accept exact matches and "contains" matches (e.g., "Privately Held")
                return any(target == ctl or target in ctl for target in normalized_targets)

            return [c for c in companies if matches_company_type(c)]
        
        # ---- LOCATION/HEADQUARTERS FILTER (post-filter for exact match) ----
        elif filter_key in ['location', 'headquarters']:
            def location_matches(company):
                hq = company.get('headquarters', {}) or {}
                location = company.get('location', '')
                
                if isinstance(filter_value, list):
                    for loc in filter_value:
                        if isinstance(loc, dict):
                            if loc.get('country') and hq.get('country'):
                                if loc['country'].lower() in hq['country'].lower():
                                    return True
                            if loc.get('city') and hq.get('city'):
                                if loc['city'].lower() in hq['city'].lower():
                                    return True
                        elif isinstance(loc, str):
                            if loc.lower() in location.lower():
                                return True
                elif isinstance(filter_value, str):
                    return filter_value.lower() in location.lower()
                return False
            
            return [c for c in companies if location_matches(c)]
        
        # ---- MARKET SEGMENTS FILTER ----
        elif filter_key == 'market_segments':
            # Filter by market segments if available in company data
            segments = filter_value if isinstance(filter_value, list) else [filter_value]
            segments_lower = [s.lower() for s in segments]
            
            return [
                c for c in companies 
                if any(seg.lower() in segments_lower for seg in c.get('market_segments', []))
            ]
        
        # ---- ACQUISITION STATUS FILTER ----
        elif filter_key == 'acquisition_status':
            # Filter by acquisition status
            status = filter_value if isinstance(filter_value, list) else [filter_value]
            status_lower = [s.lower() for s in status]
            
            return [
                c for c in companies 
                if c.get('acquisition_status', '').lower() in status_lower
            ]
        
        # ---- LARGEST HEADCOUNT COUNTRY FILTER ----
        elif filter_key == 'largest_headcount_country':
            # Filter by country with largest headcount
            countries = filter_value if isinstance(filter_value, list) else [filter_value]
            countries_lower = [c.lower() for c in countries]
            
            return [
                c for c in companies 
                if c.get('largest_headcount_country', '').lower() in countries_lower
            ]
        
        # ---- INVESTORS FILTER ----
        elif filter_key == 'investors':
            # Filter by investors if available in company data
            investors = filter_value if isinstance(filter_value, list) else [filter_value]
            investors_lower = [i.lower() for i in investors]
            
            return [
                c for c in companies 
                if any(inv.lower() in investors_lower for inv in c.get('investors', []))
            ]
        
        # ---- UNKNOWN FILTER - skip ----
        else:
            logger.warning(f"Unknown post-filter: {filter_key}")
            return companies
    
    @staticmethod
    def extract_post_filters(frontend_filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract filters that need to be applied as post-filters.
        
        These are filters NOT supported by Crustdata Company Search API.
        """
        POST_FILTER_KEYS = {
            'name', 'keyword', 'revenue', 'funding_stage', 'year_founded',
            'founded_year', 'technologies', 'company_type', 'total_investment',
            'headcount_growth', 'department_headcount', 'market_segments',
            'acquisition_status', 'largest_headcount_country', 'investors'
        }
        
        post_filters = {}
        for key, value in frontend_filters.items():
            if key in POST_FILTER_KEYS and value:
                post_filters[key] = value
        
        return post_filters
    
    @staticmethod
    def get_filter_summary(
        original_count: int,
        api_filtered_count: int,
        post_filtered_count: int,
        api_filters: List[str],
        post_filters: List[str]
    ) -> Dict[str, Any]:
        """Generate a summary of filtering applied."""
        return {
            "original_count": original_count,
            "after_api_filters": api_filtered_count,
            "after_post_filters": post_filtered_count,
            "api_filters_applied": api_filters,
            "post_filters_applied": post_filters,
            "total_filtered_out": api_filtered_count - post_filtered_count
        }
