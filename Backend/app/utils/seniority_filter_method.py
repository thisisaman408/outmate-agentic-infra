    def _build_seniority_filter(self, seniority_levels: List[str]) -> Dict[str, Any]:
        """
        Build seniority level filter
        
        Uses exact string matching for seniority levels.
        Values must be exact strings as defined in CrustData documentation:
        "CXO", "Vice President", "Director", etc.
        
        Args:
            seniority_levels: List of seniority level strings
            
        Returns:
            Filter dictionary for seniority level
        """
        # Use IN operator for multiple values, = for single value
        operator = "in" if len(seniority_levels) > 1 else "="
        value = seniority_levels if len(seniority_levels) > 1 else seniority_levels[0]
        
        return {
            "column": "current_employers.seniority_level",
            "type": operator,
            "value": value
        }
