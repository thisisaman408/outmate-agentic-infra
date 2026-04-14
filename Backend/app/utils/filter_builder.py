"""
Filter builder utility for CrustData API queries
Designed to combine multiple filters with proper logic (AND/OR operations)

This module provides a reusable, extensible way to build filter structures
for CrustData API. It follows the Open/Closed Principle - open for extension,
closed for modification.

Adding a new filter only requires:
1. Add parameter to build() method
2. Add condition check and builder call
3. Implement specific _build_*_filter method

No changes to existing code required!
"""

from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class ProspectFilterBuilder:
    """
    Builds CrustData filter structures for prospect search
    
    Supports:
    - Single filter conditions
    - Multiple filter combinations with AND logic
    - Smart operator selection based on input
    - Easy extension for new filters
    
    Design Pattern:
    - Builder pattern for complex object construction
    - Template method for filter building
    - Strategy pattern for operator selection
    
    Example:
        builder = ProspectFilterBuilder()
        
        # Single filter
        filters = builder.build(current_titles=["CEO"])
        # Returns: {"column": "current_employers.title", "type": "=", "value": "CEO"}
        
        # Multiple values
        filters = builder.build(current_titles=["CEO", "CTO"])
        # Returns: {"column": "current_employers.title", "type": "in", "value": ["CEO", "CTO"]}
        
        # Combined filters
        filters = builder.build(current_titles=["CEO"], locations=["India"])
        # Returns: {"op": "and", "conditions": [...]}
    """
    
    FILTER_TYPE_MAP = {
        "current_employers.title": "CURRENT_TITLE",
        "past_employers.title": "PAST_TITLE",
        "current_employers.function_category": None,  # Not supported in Realtime API
        "current_employers.seniority_level": None,    # Not supported in Realtime API
        "region": "REGION",
        "current_employers.company_linkedin_industry": "INDUSTRY",
        "current_employers.name": "CURRENT_COMPANY",
        "current_employers.website": "COMPANY_HEADQUARTERS",
        "current_employers.company_headcount_range": "COMPANY_HEADCOUNT",
        "first_name": None,                           # Not supported in Realtime API
        "last_name": None,                            # Not supported in Realtime API
        "profile_language": None,                     # Not supported in Realtime API
    }
    
    def build(
        self,
        api_type: str = "in_db",
        current_titles: Optional[List[str]] = None,
        past_titles: Optional[List[str]] = None,
        functions: Optional[List[str]] = None,
        seniority_levels: Optional[List[str]] = None,
        seniority_operator: str = "in",
        locations: Optional[List[str]] = None,
        industries: Optional[List[str]] = None,
        keyword: Optional[str] = None,
        # Name filters
        name: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        # Profile Language filter
        profile_languages: Optional[List[str]] = None,
        company: Optional[str] = None,
        domain: Optional[str] = None,
        employees: Optional[List[str]] = None,
        # Signal filters
        recently_changed_jobs: Optional[bool] = None,
        # Experience range
        years_of_experience_min: Optional[int] = None,
        years_of_experience_max: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Build combined filter structure for CrustData API
        
        This method collects all active filters and combines them
        using AND logic. Future filters can be added without modifying
        existing code.
        
        Args:
            current_titles: List of current job titles to filter
            past_titles: List of previous job titles (future use)
            functions: List of job functions/departments
            seniority_levels: List of seniority levels (e.g. CXO, Vice President)
            seniority_operator: 'in' (include) or 'not_in' (exclude) for seniority filter
            locations: List of geographic locations (future use)
            industries: List of industry categories (future use)
            keyword: Single keyword to search in company-related fields (skills, titles, descriptions)
            company: Name of the company to filter by
            employees: List of company headcount ranges (e.g. '1-10', '1000_plus')
            
        Returns:
            Filter structure for CrustData API:
            - Empty dict {} if no filters
            - Single filter dict {column, type, value} for one filter
            - Combined dict {op: "and", conditions: [...]} for multiple filters
        """
        conditions = []
        
        # Build current_title filter
        if current_titles and len(current_titles) > 0:
            title_filter = self._build_title_filter(
                field="current_employers.title",
                values=current_titles,
                api_type=api_type
            )
            if title_filter:
                conditions.append(title_filter)
                logger.debug(f"Added current_title filter: {len(current_titles)} title(s)")
        
        # Build past_title filter
        if past_titles and len(past_titles) > 0:
            title_filter = self._build_title_filter(
                field="past_employers.title",
                values=past_titles,
                api_type=api_type
            )
            if title_filter:
                conditions.append(title_filter)
                logger.debug(f"Added past_title filter: {len(past_titles)} title(s)")
        
        # Build location filter (placeholder for future implementation)
        if locations and len(locations) > 0:
            location_filter = self._build_location_filter(locations, api_type)
            if location_filter:
                conditions.append(location_filter)
                logger.debug(f"Added location filter: {len(locations)} location(s)")
        
        # Build industry filter (placeholder for future implementation)
        if industries and len(industries) > 0:
            industry_filter = self._build_industry_filter(industries, api_type)
            if industry_filter:
                conditions.append(industry_filter)
                logger.debug(f"Added industry filter: {len(industries)} industry(ies)")
        
        # Build function/department filter - only supported in In-DB API
        if api_type == "in_db" and functions and len(functions) > 0:
            function_filter = self._build_function_filter(functions)
            conditions.append(function_filter)
            logger.debug(f"Added function filter: {len(functions)} function(s)")
        
        # Build seniority level filter - only supported in In-DB API
        if api_type == "in_db" and seniority_levels and len(seniority_levels) > 0:
            seniority_filter = self._build_seniority_filter(seniority_levels, seniority_operator)
            conditions.append(seniority_filter)
            logger.debug(f"Added seniority_level filter ({seniority_operator}): {len(seniority_levels)} level(s)")
        
        # Build keyword filter (company-related search) - only supported in Realtime API
        if api_type == "realtime" and keyword and keyword.strip():
            keyword_filter = self._build_keyword_filter(keyword.strip())
            conditions.append(keyword_filter)
            logger.debug(f"Added keyword filter: '{keyword.strip()}'")
        
        # Build company filter
        if company and company.strip():
            company_filter = self._build_company_filter(company.strip(), api_type)
            if company_filter:
                conditions.append(company_filter)
                logger.debug(f"Added company filter: '{company.strip()}'")
                
        # Build domain filter
        if domain and domain.strip():
            domain_filter = self._build_domain_filter(domain.strip(), api_type)
            if domain_filter:
                conditions.append(domain_filter)
                logger.debug(f"Added domain filter: '{domain.strip()}'")
                
        # Build employees filter — COMPANY_HEADCOUNT is NOT supported in Realtime
        # person search API, only in In-DB and company search APIs.
        if employees and len(employees) > 0 and api_type != "realtime":
            employees_filter = self._build_employees_filter(employees, api_type)
            if employees_filter:
                conditions.append(employees_filter)
                logger.debug(f"Added employees filter: {employees}")
        elif employees and len(employees) > 0 and api_type == "realtime":
            logger.debug(f"Skipping employees filter (COMPANY_HEADCOUNT not supported in Realtime person search API)")
        
        # Build name filters (first_name and/or last_name) - only supported in In-DB API
        if api_type == "in_db" and (name or first_name or last_name):
            name_filters = self._build_name_filters(name, first_name, last_name)
            conditions.extend(name_filters)  # Add all name filters (0-2 filters)
            logger.debug(f"Added name filter(s): {len(name_filters)} filter(s)")
        
        # Build profile language filter - only supported in In-DB API
        if api_type == "in_db" and profile_languages and len(profile_languages) > 0:
            language_filter = self._build_profile_language_filter(profile_languages)
            if language_filter:  # Only add if not empty dict
                conditions.append(language_filter)
                logger.debug(f"Added profile_language filter: {len(profile_languages)} language(s)")

        # Build recently_changed_jobs signal filter
        if recently_changed_jobs is True:
            signal_filter = self._build_recently_changed_jobs_filter(api_type)
            if signal_filter:
                conditions.append(signal_filter)
                logger.debug("Added recently_changed_jobs signal filter")

        # Build years_of_experience range filters (In-DB only)
        if api_type == "in_db":
            if years_of_experience_min is not None:
                conditions.append({
                    "column": "years_of_experience_raw",
                    "type": "=>",
                    "value": years_of_experience_min
                })
                logger.debug(f"Added years_of_experience_min filter: {years_of_experience_min}")
            if years_of_experience_max is not None:
                conditions.append({
                    "column": "years_of_experience_raw",
                    "type": "=<",
                    "value": years_of_experience_max
                })
                logger.debug(f"Added years_of_experience_max filter: {years_of_experience_max}")

        # Return appropriate structure based on number of conditions
        if len(conditions) == 0:
            # No filters - return all results
            logger.debug("No filters applied")
            return {}
        elif len(conditions) == 1:
            # Single filter - For Realtime API compatibility, always return array if it's a filter_type filter
            # For In-DB API (column-based), return single object
            single_filter = conditions[0]
            if "filter_type" in single_filter:
                # Realtime API format (KEYWORD, etc.)
                logger.debug("Single Realtime API filter applied (array format)")
                return single_filter  # Return as-is, service layer will wrap in array
            else:
                # In-DB API format
                logger.debug("Single In-DB API filter applied")
                return single_filter
        else:
            # Multiple filters - Need to determine format based on filter types
            has_filter_type = any("filter_type" in cond for cond in conditions)
            has_column_type = any("column" in cond for cond in conditions)
            
            if has_filter_type and not has_column_type:
                # Pure Realtime API filters - return as array
                logger.debug(f"Multiple Realtime API filters: {len(conditions)} conditions (array format)")
                return conditions  # Return array directly for Realtime API
            elif has_column_type and not has_filter_type:
                # Pure In-DB API filters - use AND structure
                logger.debug(f"Multiple In-DB API filters: {len(conditions)} conditions (AND logic)")
                return {
                    "op": "and",
                    "conditions": conditions
                }
            else:
                # Mixed format - this shouldn't happen, but log warning
                logger.warning(f"Mixed filter formats detected! This may cause API errors.")
                # Default to array format for Realtime API compatibility
                return conditions
    
    def _build_title_filter(self, field: str, values: List[str], api_type: str = "in_db") -> Dict[str, Any]:
        """
        Build title filter with smart operator selection
        
        Operator selection logic:
        - 1 value: Use exact match (=) operator for precision
        - Multiple values: Use IN operator for efficiency
        
        Both operators are case-insensitive in CrustData API.
        
        Args:
            field: Field name (e.g., "current_employers.title")
            values: List of title values to match
            api_type: "in_db" or "realtime" to determine format
            
        Returns:
            Filter dictionary with appropriate operator and format
        """
        # Clean values (remove empty strings, strip whitespace)
        cleaned_values = [v.strip() for v in values if v and v.strip()]
        
        if len(cleaned_values) == 0:
            # Edge case: no valid values after cleaning
            logger.warning("Title filter values were all empty after cleaning")
            return {}
        
        # Get filter_type for Realtime API
        filter_type = self.FILTER_TYPE_MAP.get(field)
        
        if api_type == "realtime":
            if filter_type is None:
                # Filter not supported in Realtime API
                return {}
            # Realtime API format — always use "in" with a list value
            return {
                "filter_type": filter_type,
                "type": "in",
                "value": cleaned_values
            }
        else:
            # In-DB API format
            if len(cleaned_values) == 1:
                # Single value: use exact match
                return {
                    "column": field,
                    "type": "=",
                    "value": cleaned_values[0]
                }
            else:
                # Multiple values: use IN operator
                return {
                    "column": field,
                    "type": "in",
                    "value": cleaned_values
                }
            
    def _build_function_filter(self, functions: List[str]) -> Dict[str, Any]:
        """
        Build function/department filter with Case Normalization
        
        CRITICAL: The API treats 'IN' operator as case-sensitive.
        We must convert 'engineering' -> 'Engineering'.
        
        Args:
            functions: List of function names (e.g. ['engineering', 'sales'])
            
        Returns:
            Filter dictionary with Title Case values
        """
        # 1. Clean and Title Case (Engineering, Sales, etc.)
        cleaned_values = [v.strip().title() for v in functions if v and v.strip()]
        
        if not cleaned_values:
            return {}
            
        # 2. Build Filter
        if len(cleaned_values) == 1:
            return {
                "column": "current_employers.function_category",
                "type": "=",
                "value": cleaned_values[0]
            }
        else:
            return {
                "column": "current_employers.function_category",
                "type": "in",
                "value": cleaned_values
            }
            
    SENIORITY_ALIASES: Dict[str, str] = {
        "c-suite": "CXO",
        "cxo": "CXO",
        "vp": "Vice President",
        "vice president": "Vice President",
        "director": "Director",
        "senior ic": "Senior",
        "senior": "Senior",
        "manager": "Manager",
        "ic": "Entry",
        "entry": "Entry",
        "founder": "Owner/Partner",
        "owner": "Owner/Partner",
        "partner": "Owner/Partner",
        "unpaid": "Unpaid",
        "training": "Training"
    }

    def _normalize_seniority(self, levels: List[str]) -> List[str]:
        """Normalize UI seniority names to canonical CrustData values."""
        normalized: List[str] = []
        for level in levels:
            canonical = self.SENIORITY_ALIASES.get(level.lower().strip())
            if canonical:
                if canonical not in normalized:
                    normalized.append(canonical)
            else:
                if level not in normalized:
                    normalized.append(level)
        return normalized

    def _build_seniority_filter(self, seniority_levels: List[str], operator: str = "in") -> Dict[str, Any]:
        """
        Build seniority level filter with configurable operator
        
        Uses exact string matching for seniority levels.
        Values must be exact strings as defined in CrustData documentation:
        "CXO", "Vice President", "Director", etc.
        
        Supports both include (in) and exclude (not_in) operators.
        
        Args:
            seniority_levels: List of seniority level strings
            operator: 'in' for include, 'not_in' for exclude
            
        Returns:
            Filter dictionary for seniority level
        """
        seniority_levels = self._normalize_seniority(seniority_levels)
        
        # Map to CrustData API operator format
        # For multiple values: use 'in' or 'not_in'
        # For single value: use '=' or '!='
        if len(seniority_levels) == 1:
            api_operator = "!=" if operator == "not_in" else "="
            value = seniority_levels[0]
        else:
            api_operator = "not_in" if operator == "not_in" else "in"
            value = seniority_levels
        
        return {
            "column": "current_employers.seniority_level",
            "type": api_operator,
            "value": value
        }
    
    # Macro-region aliases → canonical CrustData REGION values
    # CrustData requires specific country/area names, not macro-regions.
    REGION_ALIASES: Dict[str, List[str]] = {
        "european union": ["Germany", "France", "Netherlands", "Spain", "Italy", "Ireland", "Sweden", "Belgium", "Austria", "Poland"],
        "europe": ["United Kingdom", "Germany", "France", "Netherlands", "Spain", "Italy", "Ireland", "Sweden", "Belgium", "Austria", "Switzerland", "Poland", "Norway", "Denmark", "Finland"],
        "eu": ["Germany", "France", "Netherlands", "Spain", "Italy", "Ireland", "Sweden", "Belgium", "Austria", "Poland"],
        "north america": ["United States", "Canada", "Mexico"],
        "na": ["United States", "Canada"],
        "latin america": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile"],
        "latam": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile"],
        "asia pacific": ["India", "China", "Singapore", "Japan", "Australia", "South Korea", "Indonesia"],
        "apac": ["India", "China", "Singapore", "Japan", "Australia", "South Korea"],
        "asia": ["India", "China", "Singapore", "Japan", "South Korea", "Indonesia"],
        "middle east": ["United Arab Emirates", "Saudi Arabia", "Israel"],
        "mena": ["United Arab Emirates", "Saudi Arabia", "Israel", "Egypt"],
        "nordics": ["Sweden", "Norway", "Denmark", "Finland", "Iceland"],
        "dach": ["Germany", "Austria", "Switzerland"],
        "benelux": ["Belgium", "Netherlands", "Luxembourg"],
        "uk": ["United Kingdom"],
        "usa": ["United States"],
        "us": ["United States"],
        # US states → CrustData canonical format "State, United States"
        "texas": ["Texas, United States"],
        "tx": ["Texas, United States"],
        "california": ["California, United States"],
        "ca": ["California, United States"],
        "new york": ["New York, United States"],
        "ny": ["New York, United States"],
        "florida": ["Florida, United States"],
        "fl": ["Florida, United States"],
        "illinois": ["Illinois, United States"],
        "il": ["Illinois, United States"],
        "ohio": ["Ohio, United States"],
        "michigan": ["Michigan, United States"],
        "massachusetts": ["Massachusetts, United States"],
        "washington": ["Washington, United States"],
        "georgia": ["Georgia, United States"],
        "pennsylvania": ["Pennsylvania, United States"],
        "colorado": ["Colorado, United States"],
        "virginia": ["Virginia, United States"],
        "north carolina": ["North Carolina, United States"],
        "arizona": ["Arizona, United States"],
        "new jersey": ["New Jersey, United States"],
        "oregon": ["Oregon, United States"],
        "minnesota": ["Minnesota, United States"],
        "maryland": ["Maryland, United States"],
        "tennessee": ["Tennessee, United States"],
        "indiana": ["Indiana, United States"],
        "utah": ["Utah, United States"],
        "connecticut": ["Connecticut, United States"],
    }

    def _normalize_regions(self, locations: List[str]) -> List[str]:
        """Expand macro-region aliases into canonical CrustData REGION values."""
        expanded: List[str] = []
        for loc in locations:
            alias_match = self.REGION_ALIASES.get(loc.lower().strip())
            if alias_match:
                for region in alias_match:
                    if region not in expanded:
                        expanded.append(region)
            else:
                if loc not in expanded:
                    expanded.append(loc)
        return expanded

    def _build_location_filter(self, locations: List[str], api_type: str = "in_db") -> Dict[str, Any]:
        """
        Build location filter.

        Location filtering strategy:
        - Expands macro-region aliases (EU, Europe, APAC, etc.) into individual countries
        - Single location: Fuzzy match with (..) operator (in_db) or "in" list (realtime)
        - Multiple locations: OR logic (match ANY location)

        Args:
            locations: List of location strings
            api_type: "in_db" or "realtime" to determine format

        Returns:
            Filter dictionary for location matching
        """
        # Expand macro-region aliases to canonical CrustData values
        locations = self._normalize_regions(locations)

        if len(locations) == 1:
            if api_type == "realtime":
                # Realtime API REGION only supports "in"/"not in" with a list value
                return {
                    "filter_type": "REGION",
                    "type": "in",
                    "value": [locations[0]]
                }
            else:  # in_db
                # Single location: fuzzy match
                return {
                    "column": "region",
                    "type": "(.)",
                    "value": locations[0]
                }
        else:
            if api_type == "realtime":
                # Multiple locations: OR logic in Realtime API format
                return {
                    "filter_type": "REGION",
                    "type": "in",
                    "value": locations
                }
            else:  # in_db
                # Multiple locations: OR logic
                # Each location gets fuzzy match, combined with OR
                return {
                    "op": "or",
                    "conditions": [
                        {
                            "column": "region",
                            "type": "(.)",
                            "value": loc
                        }
                        for loc in locations
                    ]
                }
    
    # Common industry aliases → canonical LinkedIn industry names accepted by CrustData.
    INDUSTRY_ALIASES: Dict[str, str] = {
        "advertising": "Advertising Services",
        "marketing": "Marketing Services",
        "software": "Software Development",
        "saas": "Software Development",
        "fintech": "Financial Services",
        "financial technology": "Financial Services",
        "healthcare": "Hospitals and Health Care",
        "health care": "Hospitals and Health Care",
        "e-commerce": "Retail",
        "ecommerce": "Retail",
        "ai": "Technology, Information and Internet",
        "artificial intelligence": "Technology, Information and Internet",
        "consulting": "Business Consulting and Services",
        "manufacturing": "Manufacturing",
        "real estate": "Real Estate",
        "technology": "Technology, Information and Internet",
        "tech": "Technology, Information and Internet",
        "education": "Education",
        "insurance": "Insurance",
        "banking": "Banking",
        "retail": "Retail",
        "media": "Online Audio and Video Media",
        "telecommunications": "Telecommunications",
        "telecom": "Telecommunications",
        "construction": "Construction",
        "hospitality": "Hospitality",
        "automotive": "Motor Vehicle Manufacturing",
        "pharma": "Pharmaceutical Manufacturing",
        "pharmaceutical": "Pharmaceutical Manufacturing",
        "logistics": "Transportation, Logistics, Supply Chain and Storage",
        "staffing": "Staffing and Recruiting",
        "recruiting": "Staffing and Recruiting",
        "legal": "Legal Services",
        "accounting": "Accounting",
        "venture capital": "Venture Capital and Private Equity Principals",
        "vc": "Venture Capital and Private Equity Principals",
        "private equity": "Venture Capital and Private Equity Principals",
    }

    def _normalize_industries(self, industries: List[str]) -> List[str]:
        """Normalize industry names to canonical LinkedIn/CrustData values."""
        normalized: List[str] = []
        for ind in industries:
            canonical = self.INDUSTRY_ALIASES.get(ind.lower().strip())
            if canonical:
                if canonical not in normalized:
                    normalized.append(canonical)
            else:
                # Already a canonical value (or unknown) — pass through
                if ind not in normalized:
                    normalized.append(ind)
        return normalized

    def _build_industry_filter(self, industries: List[str], api_type: str = "in_db") -> Dict[str, Any]:
        """
        Build industry filter.

        Industry filtering uses the company's LinkedIn industry category.
        Normalizes common aliases to canonical LinkedIn names before building.

        Args:
            industries: List of industry names/categories
            api_type: "in_db" or "realtime" to determine format

        Returns:
            Filter dictionary for industry matching
        """
        industries = self._normalize_industries(industries)

        if api_type == "realtime":
            return {
                "filter_type": "INDUSTRY",
                "type": "in",
                "value": industries
            }
        else:  # in_db
            return {
                "column": "current_employers.company_linkedin_industry",
                "type": "in",
                "value": industries
            }
    
    def _build_keyword_filter(self, keyword: str) -> Dict[str, Any]:
        """
        Build keyword filter for company-related search
        
        The KEYWORD filter uses the Realtime API format (different from In-DB API).
        It searches across multiple company-related fields automatically:
        - Employee skills
        - Job titles and descriptions
        - Company descriptions and specialties
        - Technology stack mentions
        
        IMPORTANT: 
        - Uses filter_type format (not column/type/value)
        - Only supports 'in' operator (no 'not_in')
        - Value must be array with max 1 element
        - Searches multiple fields automatically
        
        Args:
            keyword: Single keyword string to search
            
        Returns:
            Filter dictionary in Realtime API format
            
        Example:
            >>> builder._build_keyword_filter("artificial intelligence")
            {
                "filter_type": "KEYWORD",
                "type": "in",
                "value": ["artificial intelligence"]
            }
        """
        # CrustData KEYWORD works best with short phrases. If the keyword
        # string is very long (e.g. multiple keywords joined), take only the
        # first meaningful phrase (up to ~50 chars / 5 words).
        words = keyword.split()
        if len(words) > 5:
            keyword = " ".join(words[:5])
            logger.debug(f"Truncated keyword to first 5 words: '{keyword}'")

        return {
            "filter_type": "KEYWORD",
            "type": "in",
            "value": [keyword]  # Must be array with single element
        }
    
    def _build_name_filters(
        self,
        name: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Build first_name and last_name filters with smart name parsing
        
        Logic:
        1. If first_name/last_name directly provided: use them (takes precedence)
        2. If only 'name' provided: split on space into first/last
        3. Single word name: assigned to first_name only
        4. Returns list of filter conditions (0, 1, or 2 filters)
        
        Args:
            name: Full name string (e.g. "John Smith")
            first_name: First name (takes precedence over 'name')
            last_name: Last name (takes precedence over 'name')
            
        Returns:
            List of filter dictionaries (empty if no name provided)
            
        Examples:
            >>> _build_name_filters(name="John Smith")
            [
                {"column": "first_name", "type": "=", "value": "John"},
                {"column": "last_name", "type": "=", "value": "Smith"}
            ]
            
            >>> _build_name_filters(first_name="John")
            [{"column": "first_name", "type": "=", "value": "John"}]
            
            >>> _build_name_filters(name="Madonna")  # Single name
            [{"column": "first_name", "type": "=", "value": "Madonna"}]
        """
        filters = []
        
        # Parse 'name' field if no explicit first/last provided
        if name and not first_name and not last_name:
            parts = name.strip().split(maxsplit=1)  # Split on first space only
            if len(parts) == 1:
                # Single word name (e.g. "Madonna", "Prince")
                first_name = parts[0]
            elif len(parts) == 2:
                # Standard "FirstName LastName" format
                first_name, last_name = parts
        
        # Build filters for first_name
        if first_name and first_name.strip():
            filters.append({
                "column": "first_name",
                "type": "=",
                "value": first_name.strip()
            })
        
        # Build filters for last_name
        if last_name and last_name.strip():
            filters.append({
                "column": "last_name",
                "type": "=",
                "value": last_name.strip()
            })
        
        return filters
    
    def _build_profile_language_filter(self, languages: List[str]) -> Dict[str, Any]:
        """
        Build profile_language filter with IN operator
        
        Filters profiles by LinkedIn profile language. Supports multiple languages.
        
        Supported languages (22 total):
        - English, Spanish, Portuguese, Chinese, French
        - Italian, Russian, German, Dutch, Turkish
        - Tagalog, Polish, Korean, Japanese, Malay
        - Norwegian, Danish, Romanian, Swedish
        - Bahasa Indonesia, Czech, Arabic
        
        Args:
            languages: List of language names (e.g. ["English", "Spanish"])
            
        Returns:
            Filter dictionary with IN operator
            
        Example:
            >>> _build_profile_language_filter(["English", "Spanish"])
            {
                "column": "profile_language",
                "type": "in",
                "value": ["English", "Spanish"]
            }
        """
        # Clean and validate language values
        cleaned = [lang.strip() for lang in languages if lang and lang.strip()]
        
        if not cleaned:
            return {}
        
        if len(cleaned) == 1:
            # Single language: use exact match
            return {
                "column": "profile_language",
                "type": "=",
                "value": cleaned[0]
            }
        else:
            # Multiple languages: use IN operator
            return {
                "column": "profile_language",
                "type": "in",
                "value": cleaned
            }
            
    def _build_company_filter(self, company: str, api_type: str = "in_db") -> Dict[str, Any]:
        """
        Build company name filter using current_employers.name column.
        """
        if not company:
            return {}
            
        if api_type == "realtime":
            return {
                "filter_type": "CURRENT_COMPANY",
                "type": "(.)",
                "value": company
            }
        else:  # in_db
            # Use 'in' operator with single value list as this is the standard
            # pattern for exact/strict matching in Person DB
            return {
                "column": "current_employers.name",
                "type": "(.)",
                "value": company
            }

    def _build_recently_changed_jobs_filter(self, api_type: str = "in_db") -> Dict[str, Any]:
        """
        Build recently_changed_jobs signal filter.

        - In-DB API: uses boolean field `recently_changed_jobs = true`
        - Realtime API: uses the special RECENTLY_CHANGED_JOBS filter_type (no value required)

        Per CrustData docs example:
            {"filter_type": "RECENTLY_CHANGED_JOBS"}
        """
        if api_type == "realtime":
            return {"filter_type": "RECENTLY_CHANGED_JOBS"}
        else:
            return {
                "column": "recently_changed_jobs",
                "type": "=",
                "value": True
            }

    
    # Valid CrustData headcount ranges with their numeric boundaries
    CRUSTDATA_RANGES = [
        (1, 10, "1-10"),
        (11, 50, "11-50"),
        (51, 200, "51-200"),
        (201, 500, "201-500"),
        (501, 1000, "501-1,000"),
        (1001, 5000, "1,001-5,000"),
        (5001, 10000, "5,001-10,000"),
        (10001, float('inf'), "10,001+"),
    ]

    # Direct string mappings for known tokens
    EMPLOYEE_RANGE_MAP = {
        "1-10": "1-10",
        "11-50": "11-50",
        "51-200": "51-200",
        "201-500": "201-500",
        "501-1000": "501-1,000",
        "501-1,000": "501-1,000",
        "1001-5000": "1,001-5,000",
        "1,001-5,000": "1,001-5,000",
        "5001-10000": "5,001-10,000",
        "5,001-10,000": "5,001-10,000",
        "10001+": "10,001+",
        "10,001+": "10,001+",
        "1000_plus": "1,001-5,000",
        "5000_plus": "5,001-10,000",
        "10000_plus": "10,001+",
    }

    def _normalize_employee_range(self, val: str) -> List[str]:
        """
        Normalize any employee range string to valid CrustData range(s).
        Handles formats like: "51-200", "101-200", "100", "1000+", "1000_plus", etc.
        """
        val = val.strip().replace(",", "").replace(" ", "")

        # Direct lookup (with commas stripped for matching)
        for key, mapped in self.EMPLOYEE_RANGE_MAP.items():
            if val == key.replace(",", ""):
                return [mapped]

        # Handle "X+" format
        plus_match = None
        if val.endswith("+"):
            try:
                plus_match = int(val[:-1])
            except ValueError:
                pass
        if plus_match is not None:
            return [r[2] for r in self.CRUSTDATA_RANGES if r[1] >= plus_match or r[0] >= plus_match]

        # Handle range "X-Y" format
        import re
        range_match = re.match(r"^(\d+)\s*[-–to]+\s*(\d+)$", val)
        if range_match:
            low, high = int(range_match.group(1)), int(range_match.group(2))
            # Return all CrustData ranges that overlap with [low, high]
            return [r[2] for r in self.CRUSTDATA_RANGES if r[1] >= low and r[0] <= high]

        # Handle single number — find the range containing it
        try:
            num = int(val)
            for r in self.CRUSTDATA_RANGES:
                if r[0] <= num <= r[1]:
                    return [r[2]]
        except ValueError:
            pass

        # Fallback: return as-is (let API handle it)
        logger.warning(f"Could not normalize employee range: {val}")
        return [val]

    def _build_employees_filter(self, employees: List[str], api_type: str = "in_db") -> Dict[str, Any]:
        """
        Builds the employees/headcount filter.
        Normalizes any range format to valid CrustData API values.
        """
        if not employees:
            return {}

        mapped_values = []
        for val in employees:
            mapped_values.extend(self._normalize_employee_range(val))

        # Deduplicate while preserving order
        seen = set()
        unique_values = []
        for v in mapped_values:
            if v not in seen:
                seen.add(v)
                unique_values.append(v)

        if not unique_values:
            return {}

        if api_type == "realtime":
            return {
                "filter_type": "COMPANY_HEADCOUNT",
                "type": "in",
                "value": unique_values
            }
        else:  # in_db
            return {
                "column": "current_employers.company_headcount_range",
                "type": "in",
                "value": unique_values
            }

    def _build_domain_filter(self, domain: str) -> Dict[str, Any]:
        """
        Build domain filter using current_employers.website column.
        """
        if not domain:
            return {}
        return {
            "column": "current_employers.website",
            "type": "(.)",
            "value": domain
        }

    # Future filter methods can be added here following the same pattern:
    # def _build_skills_filter(self, skills: List[str]) -> Dict[str, Any]:
    # def _build_education_filter(self, schools: List[str]) -> Dict[str, Any]:
    # def _build_experience_filter(self, min_years: int, max_years: int) -> Dict[str, Any]:
