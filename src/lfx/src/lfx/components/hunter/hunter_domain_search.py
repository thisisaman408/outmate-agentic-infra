"""Hunter.io Domain Search Tool.

Find all email addresses associated with a company domain or name.

API Reference: https://hunter.io/api-documentation/v2
Endpoint: GET https://api.hunter.io/v2/domain-search
Auth: api_key query parameter or X-API-KEY header
Rate Limit: 15 req/sec, 500 req/min
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, IntInput, MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class HunterDomainSearchComponent(LCToolComponent):
    """Find email addresses at a company using Hunter.io Domain Search.

    Provide a domain or company name to discover email addresses of employees,
    their job titles, departments, and seniority levels.
    """

    display_name = "Hunter Domain Search"
    description = (
        "Find email addresses at a company using Hunter.io. Returns emails with "
        "confidence scores, job titles, departments, seniority, and verification status."
    )
    icon = "Hunter"
    name = "HunterDomainSearch"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Hunter API Key",
            info="Your Hunter.io API key.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Domain or Company",
            info=(
                "Company domain (e.g., 'stripe.com') or company name. "
                "When used as a tool, the agent passes this automatically."
            ),
            tool_mode=True,
        ),
        IntInput(
            name="limit",
            display_name="Max Results",
            value=10,
            info="Number of email results to return (max 100).",
            required=False,
            advanced=True,
        ),
        DropdownInput(
            name="email_type",
            display_name="Email Type",
            options=["all", "personal", "generic"],
            value="all",
            info="Filter by email type: personal or generic (e.g., info@, support@).",
            required=False,
            advanced=True,
        ),
        DropdownInput(
            name="seniority",
            display_name="Seniority Filter",
            options=["all", "junior", "senior", "executive"],
            value="all",
            info="Filter contacts by seniority level.",
            required=False,
            advanced=True,
        ),
        DropdownInput(
            name="department",
            display_name="Department Filter",
            options=[
                "all", "executive", "it", "finance", "management", "sales",
                "legal", "support", "hr", "marketing", "communication",
                "education", "design", "health", "operations",
            ],
            value="all",
            info="Filter contacts by department.",
            required=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.hunter.io/v2/domain-search"

    def _parse_query(self, query: str) -> dict[str, str]:
        """Determine if query is a domain or company name."""
        query = query.strip()
        clean = query.replace("www.", "").replace("https://", "").replace("http://", "").split("/")[0]

        if "." in clean and " " not in clean:
            return {"domain": clean}
        return {"company": query}

    # Valid values for Hunter API parameters
    VALID_SENIORITIES = {"junior", "senior", "executive"}
    VALID_DEPARTMENTS = {
        "executive", "it", "finance", "management", "sales", "legal",
        "support", "hr", "marketing", "communication", "education",
        "design", "health", "operations",
    }

    def _search_domain(self, api_key: str, params: dict[str, Any]) -> dict[str, Any]:
        """Call Hunter.io Domain Search API."""
        params["api_key"] = api_key.strip()

        # Validate and fix seniority parameter — Hunter only accepts: junior, senior, executive
        if "seniority" in params:
            seniority = str(params["seniority"]).lower().strip()
            # Map common variations to valid values
            seniority_map = {
                "vp": "executive", "c_suite": "executive", "cxo": "executive",
                "director": "executive", "head": "executive", "chief": "executive",
                "vice president": "executive", "manager": "senior", "lead": "senior",
            }
            seniority = seniority_map.get(seniority, seniority)
            if seniority in self.VALID_SENIORITIES:
                params["seniority"] = seniority
            else:
                del params["seniority"]  # Remove invalid value

        # Validate department parameter
        if "department" in params:
            dept = str(params["department"]).lower().strip()
            if dept not in self.VALID_DEPARTMENTS:
                del params["department"]

        # Remove any unexpected params the agent might pass
        allowed_params = {"domain", "company", "limit", "offset", "type", "seniority", "department", "api_key"}
        params = {k: v for k, v in params.items() if k in allowed_params}

        try:
            response = requests.get(self.API_URL, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 400:
            return {"error": f"Bad request. Check parameters. Response: {response.text[:200]}", "status": 400}
        if response.status_code == 429:
            return {"error": "Monthly quota exceeded. Upgrade your Hunter.io plan.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your Hunter.io API key.", "status": 401}
        if response.status_code == 403:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 403}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_result(self, data: dict[str, Any]) -> str:
        """Format domain search result into readable text."""
        result = data.get("data", {})
        meta = data.get("meta", {})

        if not result:
            return "No results found."

        lines = []
        lines.append(f"**Domain:** {result.get('domain', 'N/A')}")
        lines.append(f"**Organization:** {result.get('organization', 'N/A')}")
        lines.append(f"**Email Pattern:** {result.get('pattern', 'N/A')}")
        lines.append(f"**Accept All:** {result.get('accept_all', 'N/A')}")
        lines.append(f"**Total Results:** {meta.get('results', 'N/A')}")

        emails = result.get("emails", [])
        if emails:
            lines.append(f"\n**Found {len(emails)} contacts:**")
            for contact in emails:
                name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Unknown"
                email = contact.get("value", "N/A")
                confidence = contact.get("confidence", "N/A")
                position = contact.get("position", "")
                seniority = contact.get("seniority", "")
                department = contact.get("department", "")
                verification = contact.get("verification", {})
                status = verification.get("status", "N/A") if isinstance(verification, dict) else "N/A"

                lines.append(f"\n  **{name}**")
                lines.append(f"  Email: {email} (confidence: {confidence}%)")
                if position:
                    lines.append(f"  Position: {position}")
                if seniority:
                    lines.append(f"  Seniority: {seniority}")
                if department:
                    lines.append(f"  Department: {department}")
                lines.append(f"  Verification: {status}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run domain search with the configured inputs."""
        params: dict[str, Any] = {}

        if getattr(self, "input_value", None):
            params.update(self._parse_query(self.input_value))

        if not params:
            return [Data(text="No domain or company name provided.")]

        limit = getattr(self, "limit", 10) or 10
        params["limit"] = min(limit, 100)

        email_type = getattr(self, "email_type", "all")
        if email_type and email_type != "all":
            params["type"] = email_type

        seniority = getattr(self, "seniority", "all")
        if seniority and seniority != "all":
            params["seniority"] = seniority

        department = getattr(self, "department", "all")
        if department and department != "all":
            params["department"] = department

        result = self._search_domain(self.api_key, params)

        if "error" in result:
            return [Data(text=f"Hunter API Error: {result['error']}", data=result)]

        formatted = self._format_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def search_domain(
            query: str = "",
            domain: str = "",
            company: str = "",
            seniority: str = "",
            department: str = "",
        ) -> str:
            """Find email addresses at a company using Hunter.io.

            Args:
                query: Company domain (e.g., 'stripe.com') or company name
                domain: Company domain (e.g., 'stripe.com')
                company: Company name
                seniority: Filter by seniority: 'junior', 'senior', or 'executive'
                department: Filter by department: 'executive', 'it', 'finance', 'sales', 'marketing', etc.
            """
            params: dict[str, Any] = {}

            if domain:
                params["domain"] = domain
            elif company:
                params["company"] = company
            elif query:
                params.update(self._parse_query(query))

            if not params:
                return "No domain or company provided."

            params["limit"] = 10
            if seniority:
                params["seniority"] = seniority
            if department:
                params["department"] = department

            result = self._search_domain(api_key, params)

            if "error" in result:
                return f"Hunter API Error: {result['error']}"

            return self._format_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=search_domain,
                name="hunter_domain_search",
                description=(
                    "Find email addresses at a company using Hunter.io. "
                    "Returns emails with confidence scores, job titles, departments, seniority. "
                    "Best for: Contact Availability, GTM Hiring Signals, Decision-Maker Presence."
                ),
            ),
        )
