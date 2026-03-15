"""Apollo.io People Enrichment Tool.

Enriches person data using the Apollo.io API. Provide an email, name + domain,
or LinkedIn URL to get back detailed person + company information.

API Reference: https://docs.apollo.io/reference/people-enrichment
Endpoint: POST https://api.apollo.io/api/v1/people/match
Auth: x-api-key header
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import BoolInput, MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class ApolloPeopleEnrichmentComponent(LCToolComponent):
    """Enrich person data using Apollo.io — get job title, company, email, seniority, and more.

    Provide an email, name + company domain, or LinkedIn URL to look up detailed
    person and organization information. Connect this tool to any GTM agent.
    """

    display_name = "Apollo People Enrichment"
    description = (
        "Enrich person data via Apollo.io API. Returns job title, company, seniority, "
        "email status, employment history, and organization details."
    )
    icon = "Apollo"
    name = "ApolloPeopleEnrichment"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Apollo API Key",
            info="Your Apollo.io API key from Settings > Integrations > API Keys.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Lookup Query",
            info=(
                "Person lookup query. Provide email, or 'first_name last_name @ domain', "
                "or a LinkedIn URL. When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
        MessageTextInput(
            name="email",
            display_name="Email",
            info="Person's email address (strongest match signal).",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="first_name",
            display_name="First Name",
            info="Person's first name (use with last_name + domain).",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="last_name",
            display_name="Last Name",
            info="Person's last name (use with first_name + domain).",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="domain",
            display_name="Company Domain",
            info="Company domain (e.g., 'apollo.io'). Do not include 'www.' or '@'.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="linkedin_url",
            display_name="LinkedIn URL",
            info="Person's LinkedIn profile URL.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="organization_name",
            display_name="Organization Name",
            info="Current or previous employer name.",
            required=False,
            advanced=True,
        ),
        BoolInput(
            name="reveal_personal_emails",
            display_name="Reveal Personal Emails",
            info="Include personal emails in results (costs additional credits).",
            value=False,
            advanced=True,
        ),
        BoolInput(
            name="reveal_phone_number",
            display_name="Reveal Phone Number",
            info="Include phone numbers in results (costs additional credits).",
            value=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.apollo.io/api/v1/people/match"

    def _build_request_params(self) -> dict[str, Any]:
        """Build request parameters from component inputs."""
        params: dict[str, Any] = {}

        if getattr(self, "email", None):
            params["email"] = self.email
        if getattr(self, "first_name", None):
            params["first_name"] = self.first_name
        if getattr(self, "last_name", None):
            params["last_name"] = self.last_name
        if getattr(self, "domain", None):
            params["domain"] = self.domain
        if getattr(self, "linkedin_url", None):
            params["linkedin_url"] = self.linkedin_url
        if getattr(self, "organization_name", None):
            params["organization_name"] = self.organization_name
        if getattr(self, "reveal_personal_emails", False):
            params["reveal_personal_emails"] = True
        if getattr(self, "reveal_phone_number", False):
            params["reveal_phone_number"] = True

        return params

    def _parse_query_string(self, query: str) -> dict[str, Any]:
        """Parse a natural-language lookup query into API parameters."""
        params: dict[str, Any] = {}
        query = query.strip()

        # Check if it's a LinkedIn URL
        if "linkedin.com" in query:
            params["linkedin_url"] = query
            return params

        # Check if it's an email
        if "@" in query and " " not in query:
            params["email"] = query
            return params

        # Try to parse as "first last at domain" or "first last @ domain"
        parts = query.replace(" at ", " @ ").split("@")
        if len(parts) == 2:
            name_part = parts[0].strip()
            domain_part = parts[1].strip()
            name_parts = name_part.split()
            if len(name_parts) >= 2:
                params["first_name"] = name_parts[0]
                params["last_name"] = " ".join(name_parts[1:])
            elif len(name_parts) == 1:
                params["name"] = name_parts[0]
            params["domain"] = domain_part
            return params

        # Fallback: treat as a name
        name_parts = query.split()
        if len(name_parts) >= 2:
            params["first_name"] = name_parts[0]
            params["last_name"] = " ".join(name_parts[1:])
        else:
            params["name"] = query

        return params

    def _enrich_person(self, api_key: str, params: dict[str, Any]) -> dict[str, Any]:
        """Call Apollo People Enrichment API."""
        headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": api_key.strip(),
        }

        try:
            response = requests.post(self.API_URL, headers=headers, json=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your Apollo API key.", "status": 401}
        if response.status_code == 403:
            return {"error": "Forbidden. This endpoint may require a master API key.", "status": 403}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_person_result(self, data: dict[str, Any]) -> str:
        """Format person enrichment result into readable text."""
        person = data.get("person")
        if not person:
            return "No person data found for the given query."

        lines = []
        lines.append(f"**Name:** {person.get('name', 'N/A')}")
        lines.append(f"**Title:** {person.get('title', 'N/A')}")
        lines.append(f"**Email:** {person.get('email', 'N/A')}")
        lines.append(f"**Email Status:** {person.get('email_status', 'N/A')}")
        lines.append(f"**Seniority:** {person.get('seniority', 'N/A')}")
        lines.append(f"**LinkedIn:** {person.get('linkedin_url', 'N/A')}")
        lines.append(f"**Location:** {person.get('city', '')}, {person.get('state', '')}, {person.get('country', '')}")
        lines.append(f"**Departments:** {', '.join(person.get('departments', []))}")

        org = person.get("organization", {})
        if org:
            lines.append(f"\n**Company:** {org.get('name', 'N/A')}")
            lines.append(f"**Industry:** {org.get('industry', 'N/A')}")
            lines.append(f"**Website:** {org.get('website_url', 'N/A')}")

        history = person.get("employment_history", [])
        if history:
            lines.append("\n**Employment History:**")
            for job in history[:5]:
                current = " (Current)" if job.get("current") else ""
                lines.append(f"  - {job.get('title', 'N/A')} at {job.get('organization_name', 'N/A')}{current}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run person enrichment with the configured inputs."""
        params = self._build_request_params()

        # If no explicit params but input_value is set, parse the query
        if not params and getattr(self, "input_value", None):
            params = self._parse_query_string(self.input_value)

        if not params:
            return [Data(text="No lookup parameters provided. Provide an email, name + domain, or LinkedIn URL.")]

        result = self._enrich_person(self.api_key, params)

        if "error" in result:
            return [Data(text=f"Apollo API Error: {result['error']}", data=result)]

        formatted = self._format_person_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def enrich_person(
            query: str = "",
            email: str = "",
            first_name: str = "",
            last_name: str = "",
            domain: str = "",
            linkedin_url: str = "",
        ) -> str:
            """Enrich person data using Apollo.io. Provide email, name + domain, or LinkedIn URL.

            Args:
                query: Natural language query like 'john@example.com' or 'John Doe @ apollo.io'
                email: Person's email address (strongest match signal)
                first_name: Person's first name
                last_name: Person's last name
                domain: Company domain (e.g., 'apollo.io')
                linkedin_url: Person's LinkedIn profile URL
            """
            params: dict[str, Any] = {}

            if email:
                params["email"] = email
            if first_name:
                params["first_name"] = first_name
            if last_name:
                params["last_name"] = last_name
            if domain:
                params["domain"] = domain
            if linkedin_url:
                params["linkedin_url"] = linkedin_url

            if not params and query:
                params = self._parse_query_string(query)

            if not params:
                return "No parameters provided. Provide email, name + domain, or LinkedIn URL."

            result = self._enrich_person(api_key, params)

            if "error" in result:
                return f"Apollo API Error: {result['error']}"

            return self._format_person_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=enrich_person,
                name="apollo_people_enrichment",
                description=(
                    "Look up detailed person information using Apollo.io. "
                    "Returns job title, company, seniority, email, employment history. "
                    "Best used for: Company Firmographics, Decision-Maker Presence, Persona Seniority Signals."
                ),
            ),
        )
