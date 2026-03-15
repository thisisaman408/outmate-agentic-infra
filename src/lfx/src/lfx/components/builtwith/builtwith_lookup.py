"""BuiltWith Domain Technology Lookup Tool.

Look up the technology stack of any website using the BuiltWith API.

API Reference: https://api.builtwith.com/domain-api
Endpoint (paid): GET https://api.builtwith.com/v22/api.json
Endpoint (free): GET https://api.builtwith.com/free1/api.json
Auth: KEY query parameter
Rate Limits: Free: 1 req/sec | Paid: 10 req/sec, 8 concurrent
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import BoolInput, MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class BuiltWithLookupComponent(LCToolComponent):
    """Look up a website's technology stack using BuiltWith — detect CMS, analytics, frameworks, and more.

    Provide a domain to discover what technologies, tools, and platforms a company uses.
    Detects 112,000+ technologies across 68,000+ categories.
    """

    display_name = "BuiltWith Tech Stack Lookup"
    description = (
        "Look up a website's technology stack using BuiltWith. Detects CMS, analytics, "
        "JavaScript frameworks, CDN, hosting, payments, marketing tools, and more."
    )
    icon = "BuiltWith"
    name = "BuiltWithLookup"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="BuiltWith API Key",
            info="Your BuiltWith API key. Free tier available at api.builtwith.com/free-api.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Domain",
            info=(
                "Website domain to look up (e.g., 'stripe.com'). "
                "When used as a tool, the agent passes this automatically."
            ),
            tool_mode=True,
        ),
        BoolInput(
            name="use_free_api",
            display_name="Use Free API",
            info=(
                "Use the free API tier (returns technology group/category counts only, "
                "not individual technology names). Set to false for full paid API."
            ),
            value=False,
            advanced=True,
        ),
        BoolInput(
            name="live_only",
            display_name="Live Technologies Only",
            info="Only return currently-live technologies (exclude historical).",
            value=True,
            advanced=True,
        ),
    ]

    PAID_API_URL = "https://api.builtwith.com/v22/api.json"
    FREE_API_URL = "https://api.builtwith.com/free1/api.json"

    def _clean_domain(self, query: str) -> str:
        """Clean a domain string."""
        return query.strip().replace("www.", "").replace("https://", "").replace("http://", "").split("/")[0]

    def _lookup_domain(self, api_key: str, domain: str, use_free: bool = False, live_only: bool = True) -> dict[str, Any]:
        """Call BuiltWith API."""
        url = self.FREE_API_URL if use_free else self.PAID_API_URL
        params: dict[str, str] = {
            "KEY": api_key.strip(),
            "LOOKUP": domain,
        }

        if live_only and not use_free:
            params["LIVEONLY"] = "yes"

        try:
            response = requests.get(url, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        if response.status_code in (401, 403):
            return {"error": "Invalid API key or insufficient permissions.", "status": response.status_code}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_paid_result(self, data: dict[str, Any]) -> str:
        """Format paid API result (full technology details)."""
        results = data.get("Results", [])
        if not results:
            errors = data.get("Errors", [])
            if errors:
                return f"BuiltWith Error: {errors}"
            return "No technology data found for this domain."

        domain_result = results[0]
        lines = []
        lines.append(f"**Domain:** {domain_result.get('Lookup', 'N/A')}")

        # Meta info
        meta = domain_result.get("Meta", {})
        if isinstance(meta, dict):
            if meta.get("CompanyName"):
                lines.append(f"**Company:** {meta['CompanyName']}")
            if meta.get("Vertical"):
                lines.append(f"**Vertical:** {meta['Vertical']}")
            if meta.get("Country"):
                lines.append(f"**Country:** {meta['Country']}")
            social = meta.get("Social", [])
            if social:
                lines.append(f"**Social:** {', '.join(social[:5])}")

        # Technologies by category
        result_detail = domain_result.get("Result", {})
        paths = result_detail.get("Paths", []) if isinstance(result_detail, dict) else []

        tech_by_category: dict[str, list[str]] = {}
        for path in paths:
            technologies = path.get("Technologies", [])
            for tech in technologies:
                categories = tech.get("Categories", ["Uncategorized"])
                name = tech.get("Name", "Unknown")
                tag = tech.get("Tag", "")

                cat_key = categories[0] if categories else tag or "Other"
                if cat_key not in tech_by_category:
                    tech_by_category[cat_key] = []
                if name not in tech_by_category[cat_key]:
                    tech_by_category[cat_key].append(name)

        if tech_by_category:
            total_techs = sum(len(v) for v in tech_by_category.values())
            lines.append(f"\n**Technologies Found: {total_techs}**")
            for category, techs in sorted(tech_by_category.items()):
                lines.append(f"\n  **{category}:**")
                lines.append(f"  {', '.join(techs)}")

        # Estimated spend
        spend = result_detail.get("Spend", 0) if isinstance(result_detail, dict) else 0
        if spend:
            lines.append(f"\n**Estimated Tech Spend:** ${spend:,}")

        return "\n".join(lines)

    def _format_free_result(self, data: dict[str, Any]) -> str:
        """Format free API result (group/category counts only)."""
        domain = data.get("domain", "N/A")
        groups = data.get("groups", [])

        if not groups:
            return f"No technology data found for {domain}."

        lines = []
        lines.append(f"**Domain:** {domain}")

        total_live = sum(g.get("live", 0) for g in groups)
        total_dead = sum(g.get("dead", 0) for g in groups)
        lines.append(f"**Technologies:** {total_live} live, {total_dead} historical")

        lines.append("\n**Technology Groups:**")
        for group in groups:
            name = group.get("name", "Unknown")
            live = group.get("live", 0)
            dead = group.get("dead", 0)
            lines.append(f"  **{name}:** {live} live, {dead} historical")

            categories = group.get("categories", [])
            for cat in categories:
                cat_name = cat.get("name", "Unknown")
                cat_live = cat.get("live", 0)
                if cat_live > 0:
                    lines.append(f"    - {cat_name}: {cat_live}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run tech stack lookup with the configured inputs."""
        domain = getattr(self, "input_value", None)
        if not domain:
            return [Data(text="No domain provided.")]

        domain = self._clean_domain(domain)
        use_free = getattr(self, "use_free_api", False)
        live_only = getattr(self, "live_only", True)

        result = self._lookup_domain(self.api_key, domain, use_free=use_free, live_only=live_only)

        if "error" in result:
            return [Data(text=f"BuiltWith Error: {result['error']}", data=result)]

        if use_free:
            formatted = self._format_free_result(result)
        else:
            formatted = self._format_paid_result(result)

        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key
        use_free = getattr(self, "use_free_api", False)

        def lookup_tech_stack(domain: str) -> str:
            """Look up what technologies a website uses with BuiltWith.

            Returns CMS, analytics, JavaScript frameworks, CDN, hosting, payments, marketing tools.

            Args:
                domain: Website domain to look up (e.g., 'stripe.com')
            """
            if not domain:
                return "No domain provided."

            clean = self._clean_domain(domain)
            result = self._lookup_domain(api_key, clean, use_free=use_free, live_only=True)

            if "error" in result:
                return f"BuiltWith Error: {result['error']}"

            if use_free:
                return self._format_free_result(result)
            return self._format_paid_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=lookup_tech_stack,
                name="builtwith_tech_stack",
                description=(
                    "Look up what technologies a website uses with BuiltWith. "
                    "Detects 112,000+ technologies: CMS, analytics, frameworks, CDN, hosting, payments. "
                    "Best for: Tech Stack Presence, Tech Stack Changes, Technology Dependency, Competitive Usage."
                ),
            ),
        )
