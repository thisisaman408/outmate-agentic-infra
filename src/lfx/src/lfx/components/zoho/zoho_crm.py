"""Zoho CRM Integration Tool.

Search and manage contacts, leads, and deals in Zoho CRM.

API Reference: https://www.zoho.com/crm/developer/docs/api/v8/
Auth: Zoho-oauthtoken header (OAuth 2.0 access token)
"""

import json
from typing import Any, cast

import httpx
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput, SecretStrInput
from lfx.schema.data import Data

BASE_URLS = {
    "us": "https://www.zohoapis.com",
    "eu": "https://www.zohoapis.eu",
    "in": "https://www.zohoapis.in",
    "au": "https://www.zohoapis.com.au",
    "cn": "https://www.zohoapis.com.cn",
    "jp": "https://www.zohoapis.jp",
}


class ZohoCRMComponent(LCToolComponent):
    """Search and manage contacts, leads, and deals in Zoho CRM.

    Provide an OAuth access token and select a module and operation to
    interact with your Zoho CRM data. Connect this tool to any GTM agent.
    """

    display_name = "Zoho CRM"
    description = "Search and manage contacts, leads, and deals in Zoho CRM."
    icon = "Building"
    name = "ZohoCRM"

    inputs = [
        SecretStrInput(
            name="access_token",
            display_name="Zoho OAuth Access Token",
            info="Your Zoho CRM OAuth 2.0 access token.",
            required=True,
        ),
        DropdownInput(
            name="data_center",
            display_name="Data Center",
            info="Zoho data center region that determines the API base URL.",
            options=["us", "eu", "in", "au", "cn", "jp"],
            value="us",
        ),
        DropdownInput(
            name="module_name",
            display_name="Module",
            info="The Zoho CRM module to operate on.",
            options=["Contacts", "Leads", "Deals", "Accounts"],
            value="Contacts",
        ),
        DropdownInput(
            name="operation",
            display_name="Operation",
            info="The operation to perform on the selected module.",
            options=["search", "get_records", "create"],
            value="search",
        ),
        MessageTextInput(
            name="input_value",
            display_name="Input",
            info=(
                "Search criteria (e.g., an email address), record data as JSON for create, "
                "or a record ID. When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
    ]

    def _get_base_url(self) -> str:
        """Return the API base URL for the configured data center."""
        dc = getattr(self, "data_center", "us") or "us"
        return BASE_URLS.get(dc, BASE_URLS["us"])

    def _get_headers(self) -> dict[str, str]:
        """Build authorization headers."""
        return {
            "Authorization": f"Zoho-oauthtoken {self.access_token.strip()}",
            "Content-Type": "application/json",
        }

    def _search(self, module: str, query: str) -> dict[str, Any]:
        """Search records by email criteria."""
        base_url = self._get_base_url()
        url = f"{base_url}/crm/v8/{module}/search"
        params = {"criteria": f"(Email:equals:{query.strip()})"}
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers(), params=params)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _get_records(self, module: str) -> dict[str, Any]:
        """Get records with default fields."""
        base_url = self._get_base_url()
        url = f"{base_url}/crm/v8/{module}"
        params = {"fields": "Email,Last_Name,First_Name"}
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers(), params=params)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _create(self, module: str, record_data: str) -> dict[str, Any]:
        """Create a new record in the given module."""
        base_url = self._get_base_url()
        url = f"{base_url}/crm/v8/{module}"
        try:
            parsed = json.loads(record_data)
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON input: {e}", "status": 0}

        body = {"data": [parsed] if isinstance(parsed, dict) else parsed}
        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(url, headers=self._get_headers(), json=body)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> dict[str, Any]:
        """Process an HTTP response into a result dict."""
        if response.status_code == 401:
            return {"error": "Invalid or expired access token. Check your Zoho OAuth token.", "status": 401}
        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _execute_operation(self, operation: str, module: str, input_value: str) -> dict[str, Any]:
        """Dispatch to the correct operation handler."""
        if operation == "search":
            return self._search(module, input_value)
        if operation == "get_records":
            return self._get_records(module)
        if operation == "create":
            return self._create(module, input_value)
        return {"error": f"Unknown operation: {operation}", "status": 0}

    def _format_result(self, data: dict[str, Any], operation: str) -> str:
        """Format API result into readable text."""
        if "error" in data:
            return f"Zoho CRM Error: {data['error']}"

        records = data.get("data", [])
        if not records:
            return "No records found."

        if operation == "create":
            lines = ["**Record(s) Created:**"]
            for record in records:
                if isinstance(record, dict):
                    details = record.get("details", record)
                    status = record.get("status", "unknown")
                    record_id = details.get("id", "N/A") if isinstance(details, dict) else "N/A"
                    lines.append(f"  - Status: {status}, ID: {record_id}")
            return "\n".join(lines)

        lines = [f"**Found {len(records)} record(s):**\n"]
        for record in records:
            if isinstance(record, dict):
                first = record.get("First_Name", "")
                last = record.get("Last_Name", "")
                email = record.get("Email", "N/A")
                record_id = record.get("id", "N/A")
                name = f"{first} {last}".strip() or "N/A"
                lines.append(f"  - **{name}** | Email: {email} | ID: {record_id}")
        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run the configured Zoho CRM operation."""
        operation = getattr(self, "operation", "search") or "search"
        module = getattr(self, "module_name", "Contacts") or "Contacts"
        input_value = getattr(self, "input_value", "") or ""

        if operation in ("search", "create") and not input_value:
            return [Data(text=f"No input provided. The '{operation}' operation requires input data.")]

        result = self._execute_operation(operation, module, input_value)

        if "error" in result:
            return [Data(text=f"Zoho CRM Error: {result['error']}", data=result)]

        formatted = self._format_result(result, operation)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""

        def zoho_crm_tool(
            input_value: str = "",
            operation: str = "",
            module_name: str = "",
        ) -> str:
            """Interact with Zoho CRM to search, list, or create records.

            Args:
                input_value: Search criteria (email), JSON data for create, or leave empty for get_records.
                operation: One of 'search', 'get_records', or 'create'. Defaults to component setting.
                module_name: One of 'Contacts', 'Leads', 'Deals', or 'Accounts'. Defaults to component setting.
            """
            op = operation or getattr(self, "operation", "search") or "search"
            mod = module_name or getattr(self, "module_name", "Contacts") or "Contacts"
            value = input_value or getattr(self, "input_value", "") or ""

            if op in ("search", "create") and not value:
                return f"No input provided. The '{op}' operation requires input data."

            result = self._execute_operation(op, mod, value)

            if "error" in result:
                return f"Zoho CRM Error: {result['error']}"

            return self._format_result(result, op)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=zoho_crm_tool,
                name="zoho_crm",
                description=(
                    "Search, list, and create records in Zoho CRM. "
                    "Supports Contacts, Leads, Deals, and Accounts modules. "
                    "Best for: CRM lookups, lead management, deal tracking, contact search."
                ),
            ),
        )
