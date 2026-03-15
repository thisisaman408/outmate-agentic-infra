"""Apollo.io Organization Enrichment Tool.

Enriches company/organization data using the Apollo.io API.
Provide a domain, company name, or LinkedIn URL to get company details.

API Reference: https://docs.apollo.io/reference/organization-enrichment
Endpoint: GET https://api.apollo.io/api/v1/organizations/enrich
Auth: x-api-key header
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class ApolloOrgEnrichmentComponent(LCToolComponent):
    """Enrich company data using Apollo.io — get industry, size, funding, tech stack, and more.

    Provide a domain, company name, or LinkedIn URL to look up detailed
    organization information. Connect this tool to any GTM agent.
    """

    display_name = "Apollo Organization Enrichment"
    description = (
        "Enrich company data via Apollo.io API. Returns industry, employee count, "
        "funding, technologies, location, and more."
    )
    icon = "Apollo"
    name = "ApolloOrgEnrichment"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Apollo API Key",
            info="Your Apollo.io API key from Settings > Integrations > API Keys.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Company Lookup",
            info=(
                "Company domain (e.g., 'stripe.com'), company name, or LinkedIn company URL. "
                "When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
        MessageTextInput(
            name="domain",
            display_name="Company Domain",
            info="Company domain (e.g., 'stripe.com'). Do not include 'www.' or '@'.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="organization_name",
            display_name="Organization Name",
            info="Company name to look up.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="linkedin_url",
            display_name="LinkedIn Company URL",
            info="Company LinkedIn profile URL.",
            required=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.apollo.io/api/v1/organizations/enrich"

    def _build_request_params(self) -> dict[str, str]:
        """Build request parameters from component inputs."""
        params: dict[str, str] = {}

        if getattr(self, "domain", None):
            params["domain"] = self.domain
        if getattr(self, "organization_name", None):
            params["organization_name"] = self.organization_name
        if getattr(self, "linkedin_url", None):
            params["linkedin_url"] = self.linkedin_url

        return params

    def _parse_query_string(self, query: str) -> dict[str, str]:
        """Parse a query into API parameters."""
        query = query.strip()

        if "linkedin.com" in query:
            return {"linkedin_url": query}

        # If it looks like a domain (contains a dot, no spaces)
        if "." in query and " " not in query:
            return {"domain": query.replace("www.", "").replace("https://", "").replace("http://", "").split("/")[0]}

        return {"organization_name": query}

    def _enrich_org(self, api_key: str, params: dict[str, str]) -> dict[str, Any]:
        """Call Apollo Organization Enrichment API."""
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": api_key.strip(),
        }

        try:
            response = requests.get(self.API_URL, headers=headers, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your Apollo API key.", "status": 401}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_org_result(self, data: dict[str, Any]) -> str:
        """Format organization enrichment result into readable text."""
        org = data.get("organization")
        if not org:
            return "No organization data found for the given query."

        lines = []
        lines.append(f"**Company:** {org.get('name', 'N/A')}")
        lines.append(f"**Website:** {org.get('website_url', 'N/A')}")
        lines.append(f"**Industry:** {org.get('industry', 'N/A')}")
        lines.append(f"**Employees:** {org.get('estimated_num_employees', 'N/A')}")
        lines.append(f"**Founded:** {org.get('founded_year', 'N/A')}")
        lines.append(f"**Annual Revenue:** {org.get('annual_revenue', 'N/A')}")
        lines.append(f"**Total Funding:** {org.get('total_funding', 'N/A')}")
        lines.append(f"**Latest Funding Stage:** {org.get('latest_funding_stage', 'N/A')}")
        lines.append(f"**LinkedIn:** {org.get('linkedin_url', 'N/A')}")
        lines.append(
            f"**Location:** {org.get('city', '')}, {org.get('state', '')}, {org.get('country', '')}"
        )
        lines.append(f"**Phone:** {org.get('phone', 'N/A')}")

        technologies = org.get("technologies", [])
        if technologies:
            lines.append(f"\n**Technologies:** {', '.join(technologies[:20])}")
            if len(technologies) > 20:
                lines.append(f"  ... and {len(technologies) - 20} more")

        funding_events = org.get("funding_events", [])
        if funding_events:
            lines.append("\n**Funding Events:**")
            for event in funding_events[:5]:
                if isinstance(event, dict):
                    lines.append(
                        f"  - {event.get('type', 'N/A')}: ${event.get('amount', 'N/A')} "
                        f"({event.get('date', 'N/A')})"
                    )

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run organization enrichment with the configured inputs."""
        params = self._build_request_params()

        if not params and getattr(self, "input_value", None):
            params = self._parse_query_string(self.input_value)

        if not params:
            return [Data(text="No lookup parameters provided. Provide a domain, company name, or LinkedIn URL.")]

        result = self._enrich_org(self.api_key, params)

        if "error" in result:
            return [Data(text=f"Apollo API Error: {result['error']}", data=result)]

        formatted = self._format_org_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def enrich_organization(
            query: str = "",
            domain: str = "",
            organization_name: str = "",
            linkedin_url: str = "",
        ) -> str:
            """Enrich company data using Apollo.io. Provide domain, company name, or LinkedIn URL.

            Args:
                query: Company domain like 'stripe.com', company name, or LinkedIn URL
                domain: Company domain (e.g., 'stripe.com')
                organization_name: Company name
                linkedin_url: Company LinkedIn URL
            """
            params: dict[str, str] = {}

            if domain:
                params["domain"] = domain
            if organization_name:
                params["organization_name"] = organization_name
            if linkedin_url:
                params["linkedin_url"] = linkedin_url

            if not params and query:
                params = self._parse_query_string(query)

            if not params:
                return "No parameters provided. Provide a domain, company name, or LinkedIn URL."

            result = self._enrich_org(api_key, params)

            if "error" in result:
                return f"Apollo API Error: {result['error']}"

            return self._format_org_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=enrich_organization,
                name="apollo_org_enrichment",
                description=(
                    "Look up detailed company information using Apollo.io. "
                    "Returns industry, employee count, funding, technologies, location. "
                    "Best for: Company Firmographics, Funding Events, Company Growth Stage, Market Category Fit."
                ),
            ),
        )
