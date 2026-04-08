"""HubSpot CRM Integration Component.

Search and manage contacts, deals, and companies in HubSpot CRM.

API Reference: https://developers.hubspot.com/docs/api/crm
Base URL: https://api.hubapi.com
Auth: Bearer token via Private App access token
"""

import json
from typing import Any, cast

import httpx
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput, SecretStrInput, StrInput
from lfx.schema.data import Data


class HubSpotCRMComponent(LCToolComponent):
    """Search and manage contacts, deals, and companies in HubSpot CRM.

    Connect your HubSpot Private App access token to search records,
    retrieve details by ID, or create new CRM objects. Use this tool
    with any sales or GTM agent.
    """

    display_name = "HubSpot CRM"
    description = "Search and manage contacts, deals, and companies in HubSpot CRM."
    icon = "CircleDot"
    name = "HubSpotCRM"

    inputs = [
        SecretStrInput(
            name="access_token",
            display_name="HubSpot Access Token",
            info="Your HubSpot Private App access token from Settings > Integrations > Private Apps.",
            required=True,
        ),
        DropdownInput(
            name="object_type",
            display_name="Object Type",
            info="The CRM object type to operate on.",
            options=["contacts", "deals", "companies"],
            value="contacts",
            required=True,
        ),
        DropdownInput(
            name="operation",
            display_name="Operation",
            info="The operation to perform: search, get (by ID), or create.",
            options=["search", "get", "create"],
            value="search",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Input Value",
            info=(
                "Search query (for search), record ID (for get), or JSON properties (for create). "
                "When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
        StrInput(
            name="properties",
            display_name="Properties",
            info="Comma-separated property names to return (e.g., 'email,firstname,lastname').",
            value="email,firstname,lastname",
            advanced=True,
        ),
    ]

    BASE_URL = "https://api.hubapi.com"

    def _get_headers(self) -> dict[str, str]:
        """Build authorization headers."""
        return {
            "Authorization": f"Bearer {self.access_token.strip()}",
            "Content-Type": "application/json",
        }

    def _parse_properties(self, properties: str) -> list[str]:
        """Parse comma-separated properties string into a list."""
        return [p.strip() for p in properties.split(",") if p.strip()]

    def _search(self, object_type: str, query: str, properties: list[str]) -> dict[str, Any]:
        """Search CRM objects by query."""
        url = f"{self.BASE_URL}/crm/v3/objects/{object_type}/search"
        # Determine the best property to search on based on object type
        if object_type == "contacts":
            property_name = "email"
        elif object_type == "companies":
            property_name = "name"
        else:
            property_name = "dealname"

        body = {
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": property_name,
                            "operator": "CONTAINS_TOKEN",
                            "value": query,
                        }
                    ]
                }
            ],
            "properties": properties,
        }

        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(url, headers=self._get_headers(), json=body)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _get_by_id(self, object_type: str, record_id: str, properties: list[str]) -> dict[str, Any]:
        """Get a CRM object by its ID."""
        props_param = ",".join(properties)
        url = f"{self.BASE_URL}/crm/v3/objects/{object_type}/{record_id}?properties={props_param}"

        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(url, headers=self._get_headers())
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _create(self, object_type: str, properties_json: str) -> dict[str, Any]:
        """Create a new CRM object."""
        url = f"{self.BASE_URL}/crm/v3/objects/{object_type}"

        try:
            props = json.loads(properties_json)
        except json.JSONDecodeError as e:
            return {"error": f"Invalid JSON properties: {e}", "status": 0}

        body = {"properties": props}

        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(url, headers=self._get_headers(), json=body)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> dict[str, Any]:
        """Handle API response and return parsed data or error."""
        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid access token. Check your HubSpot Private App token.", "status": 401}
        if response.status_code == 404:
            return {"error": "Record not found.", "status": 404}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {
                    "error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})",
                    "status": response.status_code,
                }
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_search_results(self, data: dict[str, Any]) -> str:
        """Format search results into readable text."""
        results = data.get("results", [])
        if not results:
            return "No results found."

        lines = [f"**Found {len(results)} result(s):**\n"]
        for i, record in enumerate(results, 1):
            record_id = record.get("id", "N/A")
            props = record.get("properties", {})
            lines.append(f"**Result {i}** (ID: {record_id})")
            for key, value in props.items():
                if value is not None:
                    lines.append(f"  - {key}: {value}")
            lines.append("")

        return "\n".join(lines)

    def _format_record(self, data: dict[str, Any]) -> str:
        """Format a single CRM record into readable text."""
        record_id = data.get("id", "N/A")
        props = data.get("properties", {})
        lines = [f"**Record ID:** {record_id}\n"]
        for key, value in props.items():
            if value is not None:
                lines.append(f"  - {key}: {value}")
        return "\n".join(lines)

    def _execute_operation(
        self, access_token: str, object_type: str, operation: str, input_value: str, properties: str
    ) -> tuple[str, dict[str, Any]]:
        """Execute the requested CRM operation and return (formatted_text, raw_data)."""
        prop_list = self._parse_properties(properties)

        if operation == "search":
            result = self._search(object_type, input_value, prop_list)
            if "error" in result:
                return f"HubSpot API Error: {result['error']}", result
            return self._format_search_results(result), result

        if operation == "get":
            result = self._get_by_id(object_type, input_value.strip(), prop_list)
            if "error" in result:
                return f"HubSpot API Error: {result['error']}", result
            return self._format_record(result), result

        if operation == "create":
            result = self._create(object_type, input_value)
            if "error" in result:
                return f"HubSpot API Error: {result['error']}", result
            formatted = f"Successfully created {object_type} record.\n{self._format_record(result)}"
            return formatted, result

        return f"Unknown operation: {operation}", {"error": f"Unknown operation: {operation}"}

    def run_model(self) -> list[Data]:
        """Run the HubSpot CRM operation with the configured inputs."""
        if not getattr(self, "input_value", None):
            return [Data(text="No input value provided. Provide a search query, record ID, or JSON properties.")]

        formatted, result = self._execute_operation(
            self.access_token,
            self.object_type,
            self.operation,
            self.input_value,
            self.properties,
        )

        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        access_token = self.access_token
        object_type = self.object_type
        operation = self.operation
        properties = self.properties

        def hubspot_crm_tool(
            input_value: str = "",
        ) -> str:
            """Search, get, or create records in HubSpot CRM.

            Args:
                input_value: Search query, record ID, or JSON properties for creation.
            """
            if not input_value:
                return "No input value provided. Provide a search query, record ID, or JSON properties."

            formatted, _result = self._execute_operation(
                access_token,
                object_type,
                operation,
                input_value,
                properties,
            )
            return formatted

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=hubspot_crm_tool,
                name="hubspot_crm",
                description=(
                    "Search, retrieve, or create contacts, deals, and companies in HubSpot CRM. "
                    "Use for: CRM lookups, contact search, deal management, company records."
                ),
            ),
        )
