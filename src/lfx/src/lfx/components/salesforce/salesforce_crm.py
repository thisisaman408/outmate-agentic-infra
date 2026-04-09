"""Salesforce CRM Integration Tool.

Query and manage records in Salesforce CRM using SOQL.
Supports querying records, creating new records, and updating existing records.

API Reference: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
Auth: Username + Password + Security Token
"""

import json
from typing import Any, cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput, SecretStrInput, StrInput
from lfx.schema.data import Data


class SalesforceCRMComponent(LCToolComponent):
    """Query and manage records in Salesforce CRM using SOQL.

    Connect your Salesforce org to query, create, and update records.
    Use SOQL queries for flexible data retrieval or specify an SObject type
    for create/update operations.
    """

    display_name = "Salesforce"
    description = "Query and manage records in Salesforce CRM using SOQL."
    icon = "Cloud"
    name = "SalesforceCRM"

    inputs = [
        StrInput(
            name="username",
            display_name="Salesforce Username",
            info="Your Salesforce username (e.g., user@yourorg.com).",
            required=True,
        ),
        SecretStrInput(
            name="password",
            display_name="Salesforce Password",
            info="Your Salesforce account password.",
            required=True,
        ),
        SecretStrInput(
            name="security_token",
            display_name="Security Token",
            info="Salesforce security token. Found under Settings > Reset My Security Token.",
            required=True,
        ),
        StrInput(
            name="instance_url",
            display_name="Instance URL",
            info="Salesforce instance URL (e.g., https://yourorg.my.salesforce.com). Leave blank for auto-detection.",
            required=False,
        ),
        MessageTextInput(
            name="input_value",
            display_name="SOQL Query / Record Data",
            info=(
                "For 'query' operation: a SOQL query string (e.g., \"SELECT Id, Name FROM Contact LIMIT 10\"). "
                "For 'create'/'update' operation: a JSON string with field values "
                "(e.g., '{\"LastName\": \"Smith\", \"Email\": \"test@example.com\"}')."
            ),
            tool_mode=True,
        ),
        DropdownInput(
            name="operation",
            display_name="Operation",
            info="The operation to perform: query, create, or update.",
            options=["query", "create", "update"],
            value="query",
            required=True,
        ),
        StrInput(
            name="sobject_type",
            display_name="SObject Type",
            info="Salesforce object type for create/update operations (e.g., Contact, Lead, Account).",
            required=False,
            advanced=True,
        ),
    ]

    def _get_client(self):
        """Create and return a Salesforce client instance."""
        from simple_salesforce import Salesforce

        kwargs: dict[str, Any] = {
            "username": self.username,
            "password": self.password,
            "security_token": self.security_token,
        }

        instance_url = getattr(self, "instance_url", None)
        if instance_url:
            kwargs["instance_url"] = instance_url

        return Salesforce(**kwargs)

    def _execute_query(self, sf, soql: str) -> dict[str, Any]:
        """Execute a SOQL query and return results."""
        try:
            result = sf.query(soql)
            if not isinstance(result, dict):
                return {"error": f"Unexpected response format (expected dict, got {type(result).__name__})"}
            return result
        except Exception as e:
            return {"error": f"Query failed: {e}"}

    def _execute_create(self, sf, sobject_type: str, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new record in Salesforce."""
        try:
            sobject = getattr(sf, sobject_type)
            result = sobject.create(data)
            if not isinstance(result, dict):
                return {"success": True, "message": str(result)}
            return result
        except Exception as e:
            return {"error": f"Create failed: {e}"}

    def _execute_update(self, sf, sobject_type: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update an existing record in Salesforce."""
        record_id = data.pop("Id", None) or data.pop("id", None)
        if not record_id:
            return {"error": "Record 'Id' field is required for update operations."}

        try:
            sobject = getattr(sf, sobject_type)
            result = sobject.update(record_id, data)
            # update returns the HTTP status code (e.g., 204 for success)
            if isinstance(result, int):
                if 200 <= result < 300:
                    return {"success": True, "id": record_id, "status_code": result}
                return {"error": f"Update returned status code {result}", "id": record_id}
            return {"success": True, "id": record_id, "result": str(result)}
        except Exception as e:
            return {"error": f"Update failed: {e}"}

    def _parse_record_data(self, raw: str) -> dict[str, Any] | None:
        """Parse a JSON string into a dictionary for create/update operations."""
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
            return None
        except (json.JSONDecodeError, TypeError):
            return None

    def _format_query_result(self, result: dict[str, Any]) -> str:
        """Format SOQL query results into readable text."""
        if "error" in result:
            return f"Salesforce Error: {result['error']}"

        records = result.get("records", [])
        total_size = result.get("totalSize", 0)

        lines = [f"**Query Results:** {total_size} record(s) found\n"]

        for i, record in enumerate(records, 1):
            # Remove Salesforce metadata attributes
            clean_record = {k: v for k, v in record.items() if k != "attributes"}
            lines.append(f"**Record {i}:**")
            for key, value in clean_record.items():
                lines.append(f"  {key}: {value}")
            lines.append("")

        if not records:
            lines.append("No records matched the query.")

        return "\n".join(lines)

    def _format_mutation_result(self, result: dict[str, Any], operation: str) -> str:
        """Format create/update results into readable text."""
        if "error" in result:
            return f"Salesforce Error: {result['error']}"

        if result.get("success") or result.get("id"):
            record_id = result.get("id", "N/A")
            return f"**{operation.capitalize()} Successful**\nRecord ID: {record_id}"

        return f"**{operation.capitalize()} Result:**\n{json.dumps(result, indent=2)}"

    def run_model(self) -> list[Data]:
        """Run the Salesforce operation with the configured inputs."""
        operation = getattr(self, "operation", "query") or "query"
        input_value = getattr(self, "input_value", "") or ""
        sobject_type = getattr(self, "sobject_type", "") or ""

        if not input_value:
            return [Data(text="No input provided. Provide a SOQL query or record data.")]

        try:
            sf = self._get_client()
        except Exception as e:
            return [Data(text=f"Salesforce authentication failed: {e}")]

        if operation == "query":
            result = self._execute_query(sf, input_value)
            formatted = self._format_query_result(result)
        elif operation in ("create", "update"):
            if not sobject_type:
                return [Data(text=f"SObject Type is required for '{operation}' operations.")]

            record_data = self._parse_record_data(input_value)
            if record_data is None:
                return [Data(text="Invalid JSON input. Provide a valid JSON object with field values.")]

            if operation == "create":
                result = self._execute_create(sf, sobject_type, record_data)
            else:
                result = self._execute_update(sf, sobject_type, record_data)
            formatted = self._format_mutation_result(result, operation)
        else:
            return [Data(text=f"Unknown operation '{operation}'. Use 'query', 'create', or 'update'.")]

        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""

        def salesforce_operation(
            input_value: str = "",
            operation: str = "query",
            sobject_type: str = "",
        ) -> str:
            """Query or manage records in Salesforce CRM.

            Args:
                input_value: For 'query': a SOQL query string (e.g., "SELECT Id, Name FROM Contact LIMIT 10").
                    For 'create'/'update': a JSON string with field values.
                operation: The operation to perform - 'query', 'create', or 'update'.
                sobject_type: Salesforce object type for create/update (e.g., Contact, Lead, Account).
            """
            if not input_value:
                return "No input provided. Provide a SOQL query or record data."

            try:
                sf = self._get_client()
            except Exception as e:
                return f"Salesforce authentication failed: {e}"

            if operation == "query":
                result = self._execute_query(sf, input_value)
                return self._format_query_result(result)

            if operation in ("create", "update"):
                if not sobject_type:
                    return f"sobject_type is required for '{operation}' operations."

                record_data = self._parse_record_data(input_value)
                if record_data is None:
                    return "Invalid JSON input. Provide a valid JSON object with field values."

                if operation == "create":
                    result = self._execute_create(sf, sobject_type, record_data)
                else:
                    result = self._execute_update(sf, sobject_type, record_data)
                return self._format_mutation_result(result, operation)

            return f"Unknown operation '{operation}'. Use 'query', 'create', or 'update'."

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=salesforce_operation,
                name="salesforce_crm",
                description=(
                    "Query and manage records in Salesforce CRM. "
                    "Use SOQL queries to search records, or create/update records by specifying "
                    "an SObject type and field values as JSON. "
                    "Best for: CRM data retrieval, lead management, contact management, opportunity tracking."
                ),
            ),
        )
