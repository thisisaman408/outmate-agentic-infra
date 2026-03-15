"""People Data Labs Company Enrichment Tool.

Enriches company data using the PDL API. Provide a domain, company name,
ticker, or LinkedIn URL to get detailed company information.

API Reference: https://docs.peopledatalabs.com/docs/reference-company-enrichment-api
Endpoint: GET https://api.peopledatalabs.com/v5/company/enrich
Auth: X-Api-Key header
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class PDLCompanyEnrichmentComponent(LCToolComponent):
    """Enrich company data using People Data Labs — employee trends, funding, industry, and growth signals.

    Provide a domain, company name, ticker symbol, or LinkedIn URL to get detailed
    company information including size, funding, employee growth, and hiring trends.
    """

    display_name = "PDL Company Enrichment"
    description = (
        "Enrich company data via People Data Labs API. Returns industry, employee count, "
        "funding, growth rate, employee churn, recent exec hires/departures, and more."
    )
    icon = "PDL"
    name = "PDLCompanyEnrichment"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="PDL API Key",
            info="Your People Data Labs API key.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Company Lookup",
            info=(
                "Company domain (e.g., 'stripe.com'), company name, ticker symbol, or LinkedIn URL. "
                "When used as a tool, the agent passes this automatically."
            ),
            tool_mode=True,
        ),
        MessageTextInput(
            name="website",
            display_name="Website / Domain",
            info="Company website or domain (e.g., 'stripe.com').",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="name",
            display_name="Company Name",
            info="Company name to look up.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="ticker",
            display_name="Ticker Symbol",
            info="Stock ticker symbol (e.g., 'AAPL').",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="profile",
            display_name="LinkedIn Company URL",
            info="Company LinkedIn profile URL.",
            required=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.peopledatalabs.com/v5/company/enrich"

    def _build_request_params(self) -> dict[str, str]:
        """Build request parameters from component inputs."""
        params: dict[str, str] = {}

        if getattr(self, "website", None):
            params["website"] = self.website
        if getattr(self, "name", None):
            params["name"] = self.name
        if getattr(self, "ticker", None):
            params["ticker"] = self.ticker
        if getattr(self, "profile", None):
            params["profile"] = self.profile

        return params

    def _parse_query_string(self, query: str) -> dict[str, str]:
        """Parse a query into API parameters."""
        query = query.strip()

        if "linkedin.com" in query:
            return {"profile": query}

        # If it looks like a ticker (all caps, 1-5 chars)
        if query.isupper() and 1 <= len(query) <= 5 and query.isalpha():
            return {"ticker": query}

        # If it looks like a domain (contains a dot, no spaces)
        if "." in query and " " not in query:
            clean = query.replace("www.", "").replace("https://", "").replace("http://", "").split("/")[0]
            return {"website": clean}

        return {"name": query}

    def _enrich_company(self, api_key: str, params: dict[str, str]) -> dict[str, Any]:
        """Call PDL Company Enrichment API."""
        headers = {
            "X-Api-Key": api_key.strip(),
            "Content-Type": "application/json",
        }

        try:
            response = requests.get(self.API_URL, headers=headers, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 404:
            return {"error": "No matching company found.", "status": 404}
        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your PDL API key.", "status": 401}
        if response.status_code == 402:
            return {"error": "Credit limit reached. Check your PDL account usage.", "status": 402}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_company_result(self, data: dict[str, Any]) -> str:
        """Format company enrichment result.

        Note: PDL Company Enrichment returns fields at the ROOT level, not nested under 'data'.
        """
        # PDL returns company fields at the root level
        company = data
        likelihood = data.get("likelihood", "N/A")

        lines = []
        lines.append(f"**Confidence:** {likelihood}/10")
        lines.append(f"**Company:** {company.get('display_name', company.get('name', 'N/A'))}")
        lines.append(f"**Website:** {company.get('website', 'N/A')}")
        lines.append(f"**Industry:** {company.get('industry', 'N/A')}")
        lines.append(f"**Type:** {company.get('type', 'N/A')}")
        lines.append(f"**Employees:** {company.get('employee_count', 'N/A')}")
        lines.append(f"**Size Range:** {company.get('size', 'N/A')}")
        lines.append(f"**Founded:** {company.get('founded', 'N/A')}")
        lines.append(f"**Total Funding:** {company.get('total_funding_raised', 'N/A')}")
        lines.append(f"**Latest Funding Stage:** {company.get('latest_funding_stage', 'N/A')}")
        lines.append(f"**Inferred Revenue:** {company.get('inferred_revenue', 'N/A')}")

        location = company.get("location", {})
        if isinstance(location, dict):
            lines.append(f"**Location:** {location.get('name', 'N/A')}")

        lines.append(f"**LinkedIn:** {company.get('linkedin_url', 'N/A')}")
        lines.append(f"**Headline:** {company.get('headline', 'N/A')}")

        # Employee growth
        growth = company.get("employee_growth_rate", {})
        if isinstance(growth, dict) and any(growth.values()):
            lines.append("\n**Employee Growth Rate:**")
            for period in ["3_month", "6_month", "12_month", "24_month"]:
                val = growth.get(period)
                if val is not None:
                    lines.append(f"  - {period.replace('_', ' ')}: {val:.1%}" if isinstance(val, float) else f"  - {period.replace('_', ' ')}: {val}")

        # Recent exec hires
        exec_hires = company.get("recent_exec_hires", [])
        if exec_hires:
            lines.append("\n**Recent Executive Hires:**")
            for hire in exec_hires[:5]:
                if isinstance(hire, dict):
                    lines.append(f"  - {hire.get('job_title', 'N/A')} (joined {hire.get('joined_date', 'N/A')})")

        # Recent exec departures
        exec_departures = company.get("recent_exec_departures", [])
        if exec_departures:
            lines.append("\n**Recent Executive Departures:**")
            for dep in exec_departures[:5]:
                if isinstance(dep, dict):
                    lines.append(f"  - {dep.get('job_title', 'N/A')} (departed {dep.get('departed_date', 'N/A')})")

        # Tags
        tags = company.get("tags", [])
        if tags:
            lines.append(f"\n**Tags:** {', '.join(tags[:15])}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run company enrichment with the configured inputs."""
        params = self._build_request_params()

        if not params and getattr(self, "input_value", None):
            params = self._parse_query_string(self.input_value)

        if not params:
            return [Data(text="No lookup parameters provided. Provide a domain, company name, ticker, or LinkedIn URL.")]

        result = self._enrich_company(self.api_key, params)

        if "error" in result:
            return [Data(text=f"PDL API Error: {result['error']}", data=result)]

        formatted = self._format_company_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def enrich_company(
            query: str = "",
            website: str = "",
            name: str = "",
            ticker: str = "",
            linkedin_url: str = "",
        ) -> str:
            """Enrich company data using People Data Labs. Returns industry, size, funding, growth, exec hires.

            Args:
                query: Company domain like 'stripe.com', name, ticker symbol, or LinkedIn URL
                website: Company domain (e.g., 'stripe.com')
                name: Company name
                ticker: Stock ticker symbol (e.g., 'AAPL')
                linkedin_url: Company LinkedIn URL
            """
            params: dict[str, str] = {}

            if website:
                params["website"] = website
            if name:
                params["name"] = name
            if ticker:
                params["ticker"] = ticker
            if linkedin_url:
                params["profile"] = linkedin_url

            if not params and query:
                params = self._parse_query_string(query)

            if not params:
                return "No parameters provided. Provide a domain, company name, ticker, or LinkedIn URL."

            result = self._enrich_company(api_key, params)

            if "error" in result:
                return f"PDL API Error: {result['error']}"

            return self._format_company_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=enrich_company,
                name="pdl_company_enrichment",
                description=(
                    "Look up detailed company information using People Data Labs. "
                    "Returns industry, employee count, funding, growth rate, exec hires/departures. "
                    "Best for: Company Growth Stage, Hiring Activity, Company Firmographics, Industry Momentum."
                ),
            ),
        )
