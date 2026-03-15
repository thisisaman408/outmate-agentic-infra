"""Hunter.io Email Finder Tool.

Find the email address of a specific person by providing their name and company domain.

API Reference: https://hunter.io/api-documentation/v2
Endpoint: GET https://api.hunter.io/v2/email-finder
Auth: api_key query parameter or X-API-KEY header
Rate Limit: 15 req/sec, 500 req/min
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class HunterEmailFinderComponent(LCToolComponent):
    """Find a person's email using Hunter.io — provide name + domain to get their email.

    Uses Hunter.io's Email Finder API to discover the most likely email address
    for a specific person at a company.
    """

    display_name = "Hunter Email Finder"
    description = (
        "Find a person's email address using Hunter.io. Provide first name, "
        "last name, and company domain to get their email with confidence score."
    )
    icon = "Hunter"
    name = "HunterEmailFinder"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Hunter API Key",
            info="Your Hunter.io API key.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Lookup Query",
            info=(
                "Person lookup: 'First Last at domain.com' or 'First Last @ company.com'. "
                "When used as a tool, the agent passes this automatically."
            ),
            tool_mode=True,
        ),
        MessageTextInput(
            name="first_name",
            display_name="First Name",
            info="Person's first name.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="last_name",
            display_name="Last Name",
            info="Person's last name.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="domain",
            display_name="Company Domain",
            info="Company domain (e.g., 'stripe.com').",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="company",
            display_name="Company Name",
            info="Company name (alternative to domain).",
            required=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.hunter.io/v2/email-finder"

    def _parse_query_string(self, query: str) -> dict[str, str]:
        """Parse a natural-language query into API parameters."""
        query = query.strip()
        parts = query.replace(" at ", " @ ").split("@")

        if len(parts) == 2:
            name_part = parts[0].strip()
            domain_part = parts[1].strip()
            name_parts = name_part.split()

            result: dict[str, str] = {}
            if len(name_parts) >= 2:
                result["first_name"] = name_parts[0]
                result["last_name"] = " ".join(name_parts[1:])
            elif len(name_parts) == 1:
                result["full_name"] = name_parts[0]

            # Determine if domain_part is a domain or company name
            clean = domain_part.replace("www.", "").replace("https://", "").replace("http://", "")
            if "." in clean and " " not in clean:
                result["domain"] = clean
            else:
                result["company"] = domain_part

            return result

        return {"full_name": query}

    def _find_email(self, api_key: str, params: dict[str, str]) -> dict[str, Any]:
        """Call Hunter.io Email Finder API."""
        params["api_key"] = api_key.strip()

        try:
            response = requests.get(self.API_URL, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 429:
            return {"error": "Monthly quota exceeded. Upgrade your Hunter.io plan.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your Hunter.io API key.", "status": 401}
        if response.status_code == 403:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 403}
        if response.status_code == 451:
            return {"error": "This person has requested their data not be processed (GDPR).", "status": 451}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_result(self, data: dict[str, Any]) -> str:
        """Format email finder result into readable text."""
        result = data.get("data", {})
        if not result or not result.get("email"):
            return "No email found for the given person and domain."

        lines = []
        lines.append(f"**Email Found:** {result.get('email', 'N/A')}")
        lines.append(f"**Confidence Score:** {result.get('score', 'N/A')}%")
        lines.append(f"**Name:** {result.get('first_name', '')} {result.get('last_name', '')}")
        lines.append(f"**Position:** {result.get('position', 'N/A')}")
        lines.append(f"**Company:** {result.get('company', 'N/A')}")
        lines.append(f"**Domain:** {result.get('domain', 'N/A')}")
        lines.append(f"**Accept All:** {result.get('accept_all', 'N/A')}")

        verification = result.get("verification", {})
        if isinstance(verification, dict):
            lines.append(f"**Verification Status:** {verification.get('status', 'N/A')}")
            lines.append(f"**Verification Date:** {verification.get('date', 'N/A')}")

        sources = result.get("sources", [])
        if sources:
            lines.append(f"\n**Sources ({len(sources)}):**")
            for source in sources[:5]:
                if isinstance(source, dict):
                    lines.append(f"  - {source.get('uri', source.get('domain', 'N/A'))}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run email finder with the configured inputs."""
        params: dict[str, str] = {}

        if getattr(self, "first_name", None):
            params["first_name"] = self.first_name
        if getattr(self, "last_name", None):
            params["last_name"] = self.last_name
        if getattr(self, "domain", None):
            params["domain"] = self.domain
        if getattr(self, "company", None):
            params["company"] = self.company

        if not params and getattr(self, "input_value", None):
            params = self._parse_query_string(self.input_value)

        if not params:
            return [Data(text="No parameters provided. Provide name + domain or company.")]

        result = self._find_email(self.api_key, params)

        if "error" in result:
            return [Data(text=f"Hunter API Error: {result['error']}", data=result)]

        formatted = self._format_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def find_email(
            query: str = "",
            first_name: str = "",
            last_name: str = "",
            domain: str = "",
            company: str = "",
        ) -> str:
            """Find a person's email address using Hunter.io. Provide name + company domain.

            Args:
                query: Natural language like 'John Doe at stripe.com'
                first_name: Person's first name
                last_name: Person's last name
                domain: Company domain (e.g., 'stripe.com')
                company: Company name (alternative to domain)
            """
            params: dict[str, str] = {}

            if first_name:
                params["first_name"] = first_name
            if last_name:
                params["last_name"] = last_name
            if domain:
                params["domain"] = domain
            if company:
                params["company"] = company

            if not params and query:
                params = self._parse_query_string(query)

            if not params:
                return "No parameters provided. Provide name + domain or company."

            result = self._find_email(api_key, params)

            if "error" in result:
                return f"Hunter API Error: {result['error']}"

            return self._format_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=find_email,
                name="hunter_email_finder",
                description=(
                    "Find a specific person's email address using Hunter.io. "
                    "Provide first name + last name + company domain to discover their email. "
                    "Best for: Contact Availability, Email Quality Signals."
                ),
            ),
        )
