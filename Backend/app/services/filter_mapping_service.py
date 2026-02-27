from typing import Dict, Any, Optional, Tuple, List

TOTAL_INVESTMENT = "TOTAL_INVESTMENT"
FOUNDED_YEAR = "FOUNDED_YEAR"


# VALUE MAPPINGS
EMPLOYEE_COUNT_MAP = {
    "1-10": "1-10",
    "11-50": "11-50",
    "51-200": "51-200",
    "201-500": "201-500",
    "501-1000": "501-1,000",
    "1001-5000": "1,001-5,000",
    "5001-10000": "5,001-10,000",
    "10001+": "10,001+",
}

COUNTRY_REGION_MAP = {
    "usa": "United States",
    "us": "United States",
    "united states": "United States",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
    "canada": "Canada",
    "australia": "Australia",
    "germany": "Germany",
    "france": "France",
    "india": "India",
    "china": "China",
    "japan": "Japan",
}

INDUSTRY_MAP = {
    # B2B SaaS specific mappings - Keep these specific to avoid broad matches
    "b2b": "B2B",
    "b2b saas": "B2B SaaS",
    "b2b software": "B2B Software",
    "business software": "Business Software",
    "saas": "SaaS",
    "software": "Software",
    "software development": "Software Development",
    "technology": "Technology",
    "banking": "Banking",
    "finance": "Financial Services",
    "financial services": "Financial Services",
    "healthcare": "Healthcare",
    "retail": "Retail",
    "ecommerce": "E-Commerce",
    "e-commerce": "E-Commerce",
    "marketing": "Marketing and Advertising",
    "advertising": "Marketing and Advertising",
    "martech": "Marketing and Advertising",
    "fintech": "Financial Services",
    "healthtech": "Healthcare",
    "edtech": "Education",
}


class FilterMappingService:
    """
    Maps frontend filters to Crustdata In-DB Search API format (/screener/companydb/search).
    Reference: crustdata endpoints.txt
    """
    
    # All supported filters for In-DB Search
    SUPPORTED_API_FILTERS = {
        'employee_count', 'employee_count_range', 'industry', 'location', 
        'headquarters_country', 'headquarters_region', 'revenue',
        'founded_year', 'technologies', 'keywords', 'company_name',
        'linkedin_url', 'website', 'year_founded', 'short_description',
        'long_description', 'seo_description', 'linkedin_title',
        'linkedin_geo', 'linkedin_industry', 'company_type',
        'department_headcount', 'department_growth', 'total_investment',
        'last_funding_date', 'last_funding_amount', 'last_funding_type',
        'funding_stage', 'investors', 'acquisition_status',
        'employee_growth_6m', 'employee_growth_12m',
        'employee_growth_6m_percent', 'employee_growth_12m_percent'
    }
    
    # Filters that must be handled client-side or post-fetch if API doesn't support them well
    POST_FILTER_KEYS = {
        'email_verified', 'phone_verified', 'custom_score_min'
    }

    @staticmethod
    def transform_to_crustdata_format(filters: Dict[str, Any], page: int = 1) -> Dict[str, Any]:
        """
        Transform to /screener/companydb/search format.
        Structure:
        {
            "filters": {
                "op": "and",
                "conditions": [ ... ]
            },
            "page": N,
            "limit": K
        }
        """
        conditions = []
        
        for key, value in filters.items():
            if not value and value != 0: # Allow 0 for numeric filters
                continue
            
            # Skip if explicitly a post-filter
            if key in FilterMappingService.POST_FILTER_KEYS:
                continue

            transformed = FilterMappingService._transform_single_filter(key, value)
            if transformed:
                if isinstance(transformed, list):
                    conditions.extend(transformed)
                else:
                    conditions.append(transformed)
        
        # Construct final payload
        crustdata_filters: Dict[str, Any] = {"page": page}
        
        if not conditions:
            crustdata_filters["filters"] = {}
        elif len(conditions) == 1:
            crustdata_filters["filters"] = conditions[0]
        else:
            crustdata_filters["filters"] = {
                "op": "and",
                "conditions": conditions
            }

        print(f">>> FilterMapping: Transformed to {len(conditions)} conditions", flush=True)
        return crustdata_filters
    
    @staticmethod
    def _transform_single_filter(filter_key: str, filter_value: Any) -> Optional[Any]:
        """Transform individual filter to one or more API conditions."""
        
        # --- COMPANY IDENTITY ---
        
        # Name (fuzzy search)
        if filter_key == 'name':
             return {"filter_type": "company_name", "type": "(.)", "value": str(filter_value)}

        # Domain/Website
        if filter_key == 'domain':
             return {"filter_type": "website_domain", "type": "=", "value": str(filter_value)}
        
        # Keywords (fuzzy search in description)
        if filter_key == 'keywords':
             return {"filter_type": "company_description", "type": "(.)", "value": str(filter_value)}

        # --- LOCATION ---
        
        # Location / Headquarters (Text search across all address fields)
        if filter_key in ('location', 'measure_location', 'headquarters'):
             locations = filter_value if isinstance(filter_value, list) else [filter_value]
             normalized = []
             for loc in locations:
                 if isinstance(loc, dict):
                     country = loc.get('country', '')
                     normalized.append(COUNTRY_REGION_MAP.get(country.lower(), country))
                 else:
                     normalized.append(COUNTRY_REGION_MAP.get(loc.lower(), loc))
            
             if len(normalized) == 1:
                 return {"filter_type": "hq_location", "type": "(.)", "value": normalized[0]}
             
             return {
                 "op": "or",
                 "conditions": [
                     {"filter_type": "hq_location", "type": "(.)", "value": v} for v in normalized
                 ]
             }

        # Region / Country (Specific fields)
        if filter_key in ('region', 'headquarters_country'):
            values = filter_value if isinstance(filter_value, list) else [filter_value]
            normalized = [COUNTRY_REGION_MAP.get(v.lower(), v) for v in values]
            return {"filter_type": "hq_country", "type": "in", "value": normalized}

        if filter_key == "country_code":
            values = filter_value if isinstance(filter_value, list) else [filter_value]
            normalized = [COUNTRY_REGION_MAP.get(str(v).lower(), str(v)) for v in values]
            return {"filter_type": "hq_country", "type": "in", "value": normalized}

        # --- INDUSTRIES & TECHNOLOGIES ---
        
        # Industry (LinkedIn Industries)
        if filter_key == 'industry':
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             normalized = [INDUSTRY_MAP.get(i.lower(), i) for i in values]
             return {"filter_type": "linkedin_industries", "type": "in", "value": normalized}

        if filter_key == "google_category":
            values = filter_value if isinstance(filter_value, list) else [filter_value]
            return {"filter_type": "google_category", "type": "in", "value": values}

        if filter_key == "linkedin_category":
            values = filter_value if isinstance(filter_value, list) else [filter_value]
            return {"filter_type": "linkedin_category", "type": "in", "value": values}
             
        # Technologies
        if filter_key == 'technologies':
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             return {"filter_type": "technologies", "type": "in", "value": values}
             
        # --- COMPANY SIZE & GROWTH ---
        
        # Employee Count Range
        if filter_key in ('employee_count', 'employee_count_range'):
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             # Map frontend ranges to API ranges if they differ, or just pass through if they match.
             # Doc example: "employee_count_range", "type": "in", "value": ["201-500", "501-1000"]
             return {"filter_type": "employee_count_range", "type": "in", "value": values}

        # Exact Employee Count
        if filter_key == 'employee_count_exact':
             if isinstance(filter_value, dict):
                 # Range: min/max
                 conds = []
                 if 'min' in filter_value:
                     conds.append({"filter_type": "employee_metrics.latest_count", "type": ">=", "value": filter_value['min']})
                 if 'max' in filter_value:
                     conds.append({"filter_type": "employee_metrics.latest_count", "type": "<=", "value": filter_value['max']})
                 return conds if len(conds) > 1 else (conds[0] if conds else None)
             return {"filter_type": "employee_metrics.latest_count", "type": "=", "value": filter_value}
             
        # Growth (Headcount)
        if filter_key in ('headcount_growth_6m', 'employee_growth_6m_percent'):
            val = filter_value
            if isinstance(val, dict):
                # Handle min/max range
                conds = []
                if 'min' in val: conds.append({"filter_type": "employee_metrics.growth_6m_percent", "type": "=>", "value": val['min']})
                if 'max' in val: conds.append({"filter_type": "employee_metrics.growth_6m_percent", "type": "=<", "value": val['max']})
                return conds
            # Single value assume minimum ??? Or exact? Usually filters implies "at least" or "equals"
            return {"filter_type": "employee_metrics.growth_6m_percent", "type": "=>", "value": val}

        if filter_key in ('headcount_growth_12m', 'employee_growth_12m_percent'):
             val = filter_value
             if isinstance(val, dict):
                 conds = []
                 if 'min' in val: conds.append({"filter_type": "employee_metrics.growth_12m_percent", "type": "=>", "value": val['min']})
                 if 'max' in val: conds.append({"filter_type": "employee_metrics.growth_12m_percent", "type": "=<", "value": val['max']})
                 return conds
             return {"filter_type": "employee_metrics.growth_12m_percent", "type": "=>", "value": val}

        # --- FINANCIALS ---

        # Revenue
        if filter_key == 'revenue':
            # e.g. {'min': 1000000, 'max': 5000000} OR {'min': 1, 'max': 10} for millions
            if isinstance(filter_value, dict):
                 conds = []
                 min_val = filter_value.get('min', 0)
                 max_val = filter_value.get('max')
                 
                 # Heuristic: If values are small (< 10000), assume millions
                 if min_val and min_val < 10000:
                     min_val = min_val * 1000000
                 if max_val and max_val < 10000:
                     max_val = max_val * 1000000

                 if 'min' in filter_value:
                     conds.append({"filter_type": "estimated_revenue_lower_bound_usd", "type": "=>", "value": min_val})
                 if 'max' in filter_value:
                     conds.append({"filter_type": "estimated_revenue_higher_bound_usd", "type": "=<", "value": max_val})
                 return conds
            return None # Unknown format

        # Funding
        if filter_key == 'funding_stage':
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             # Doc example: "filter_type": "last_funding_round_type", "type": "in", "value": ["series_a", ...]
             return {"filter_type": "last_funding_round_type", "type": "in", "value": values}
             
        if filter_key == 'total_investment':
             if isinstance(filter_value, dict):
                 conds = []
                 if 'min' in filter_value: conds.append({"filter_type": "crunchbase_total_investment_usd", "type": "=>", "value": filter_value['min']})
                 if 'max' in filter_value: conds.append({"filter_type": "crunchbase_total_investment_usd", "type": "=<", "value": filter_value['max']})
                 return conds
             return {"filter_type": "crunchbase_total_investment_usd", "type": "=>", "value": filter_value}

        # Founded Year
        if filter_key == 'founded_year':
             if isinstance(filter_value, dict):
                 conds = []
                 if 'min' in filter_value: conds.append({"filter_type": "year_founded", "type": "=>", "value": filter_value['min']})
                 if 'max' in filter_value: conds.append({"filter_type": "year_founded", "type": "=<", "value": filter_value['max']})
                 conds.append({"filter_type": "year_founded", "type": ">", "value": 0}) # Ensure not 0/null ?
                 return conds
             return {"filter_type": "year_founded", "type": "=", "value": int(filter_value)}

        # Company Type
        if filter_key == 'company_type':
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             # Doc example: "filter_type": "company_type", "type": "in", "value": ["public", "private"]
             return {"filter_type": "company_type", "type": "in", "value": values}

        # --- KEYWORDS / TITLE ---
        if filter_key == 'keywords':
            # "TITLE" or "KEYWORD"? 
            return {"filter_type": "company_description", "type": "(.)", "value": str(filter_value)}

        return None

    @staticmethod
    def transform_to_realtime_format(filters: Dict[str, Any], page: int = 1) -> Dict[str, Any]:
        """
        Transform to /screener/company/search format (Real-time).
        Structure:
        {
            "filters": [
                { "filter_type": "REGION", "type": "in", "value": ["United States"] },
                ...
            ],
            "page": N
        }
        """
        api_filters = []
        
        for key, value in filters.items():
            if not value and value != 0:
                continue
            
            if key in FilterMappingService.POST_FILTER_KEYS:
                continue

            transformed = FilterMappingService._transform_single_realtime_filter(key, value)
            if transformed:
                if isinstance(transformed, list):
                    api_filters.extend(transformed)
                else:
                    api_filters.append(transformed)
        
        return {
            "filters": api_filters,
            "page": page
        }

    @staticmethod
    def _transform_single_realtime_filter(filter_key: str, filter_value: Any) -> Optional[Any]:
        """Transform individual filter to Real-time API format."""
        
        # --- COMPANY IDENTITY ---
        
        # Name
        if filter_key == 'name':
             return {"filter_type": "COMPANY_NAME", "type": "contains", "value": str(filter_value)}

        # Domain
        if filter_key == 'domain':
             return {"filter_type": "WEBSITE", "type": "equals", "value": str(filter_value)}
        
        # --- LOCATION ---
        if filter_key in ('location', 'measure_location', 'headquarters', 'region', 'headquarters_country'):
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             normalized = []
             for v in values:
                 if isinstance(v, dict):
                     country = v.get('country', '')
                     normalized.append(COUNTRY_REGION_MAP.get(country.lower(), country))
                 else:
                     normalized.append(COUNTRY_REGION_MAP.get(v.lower(), v))
             
             # Filter empty
             normalized = [n for n in normalized if n]
             if not normalized:
                 return None
                 
             return {"filter_type": "REGION", "type": "in", "value": normalized}

        # --- INDUSTRIES ---
        if filter_key == 'industry':
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             normalized = [INDUSTRY_MAP.get(i.lower(), i) for i in values]
             return {"filter_type": "INDUSTRY", "type": "in", "value": normalized}

        # --- SIZE ---
        if filter_key in ('employee_count', 'employee_count_range', 'employee_count_exact'):
             values = filter_value if isinstance(filter_value, list) else [filter_value]
             if isinstance(filter_value, str):
                 values = [filter_value]
             return {"filter_type": "COMPANY_HEADCOUNT", "type": "in", "value": values}

        # --- FINANCIALS ---
        if filter_key == 'revenue':
             if isinstance(filter_value, dict):
                 min_val = filter_value.get('min', 0)
                 max_val = filter_value.get('max', 0)
                 
                 # Scaling heuristic
                 if min_val and min_val < 10000: min_val *= 1000000
                 if max_val and max_val < 10000: max_val *= 1000000
                 
                 return {
                     "filter_type": "ANNUAL_REVENUE", 
                     "type": "between", 
                     "value": {"min": min_val, "max": max_val}
                 }
             return None

        # --- KEYWORDS / TITLE ---
        if filter_key == 'keywords':
            return {"filter_type": "KEYWORD", "type": "contains", "value": str(filter_value)}

        return None

    @staticmethod
    def extract_post_filters(filters: Dict[str, Any]) -> List[str]:
        """Extract post-filters from filters dict."""
        return [key for key in filters.keys() if key in FilterMappingService.POST_FILTER_KEYS]

    @staticmethod
    def validate_filters(filters: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate filters."""
        # Loose validation to allow pass-through of known keys
        # We can just return True for now and rely on transformation to drop unknown ones 
        # or implement stricter checking if needed.
        return True, []

    @staticmethod
    def transform_to_explorium_format(filters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform frontend filters to Explorium-compatible format.
        ExploriumService performs internal mapping, so we just return the dict.
        """
        return filters
