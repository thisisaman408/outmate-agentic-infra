"""Google Sheets Integration Component.

Read and write data to Google Sheets spreadsheets using the Google Sheets API v4.
Supports public sheets via API key and private sheets via service account JSON.

API Reference: https://developers.google.com/sheets/api/reference/rest
Endpoint: https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
Auth: API key (query param) or service account Bearer token (header)
"""

import json
from typing import Any, cast

import httpx
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput, SecretStrInput, StrInput
from lfx.schema.data import Data

BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets"


class GoogleSheetsComponent(LCToolComponent):
    """Read and write data to Google Sheets spreadsheets.

    Provide a spreadsheet ID, sheet range, and operation to interact with
    Google Sheets. Supports reading, writing, and appending data.
    """

    display_name = "Google Sheets"
    description = "Read and write data to Google Sheets spreadsheets."
    icon = "Googlesheets"
    name = "GoogleSheets"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Google API Key / Service Account JSON Path",
            info=(
                "Google API key for public sheets, OR the file path to your service account "
                "JSON file (e.g. /path/to/service-account.json). The component will read "
                "the file automatically."
            ),
            required=True,
        ),
        StrInput(
            name="spreadsheet_id",
            display_name="Spreadsheet ID",
            info="The spreadsheet ID from the Google Sheets URL (the long string between /d/ and /edit).",
            required=True,
        ),
        StrInput(
            name="sheet_range",
            display_name="Sheet Range",
            info="Range in A1 notation, e.g. 'Sheet1!A1:D10' or just 'Sheet1'.",
            value="Sheet1",
            required=True,
        ),
        DropdownInput(
            name="operation",
            display_name="Operation",
            options=["read", "write", "append"],
            value="read",
            info="The operation to perform: read, write, or append data.",
        ),
        MessageTextInput(
            name="input_value",
            display_name="Data to Write",
            info=(
                "Data to write or append. Accepts plain text (comma-separated for columns, "
                "newlines for rows), or JSON arrays. Example: 'Aman, Resyl, Founder'. "
                "Ignored for read operations."
            ),
            tool_mode=True,
        ),
        DropdownInput(
            name="value_input_option",
            display_name="Value Input Option",
            options=["RAW", "USER_ENTERED"],
            value="USER_ENTERED",
            info="How input data should be interpreted. USER_ENTERED parses formulas; RAW inserts as-is.",
            advanced=True,
        ),
    ]

    def _is_service_account_json(self, key: str) -> bool:
        """Check whether the provided key looks like a service account JSON."""
        stripped = key.strip()
        return stripped.startswith("{") and "private_key" in stripped

    @staticmethod
    def _clean_json_string(raw: str) -> dict:
        """Parse a JSON string that may have mangled control characters.

        Service account JSON contains \\n in the private_key field.
        When pasted into UI text fields, these can become real newlines,
        breaking json.loads. This method tries multiple strategies.
        """
        import re

        # Strategy 1: direct parse
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 2: replace actual newlines/carriage returns with \\n
        cleaned = raw.replace("\r\n", "\\n").replace("\r", "\\n").replace("\n", "\\n")
        try:
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 3: only replace unescaped newlines
        cleaned = re.sub(r'(?<!\\)\n', '\\n', raw)
        try:
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 4: strip all control characters except inside the private_key value
        cleaned = re.sub(r'[\x00-\x1f\x7f]', '', raw)
        return json.loads(cleaned)

    def _get_bearer_token(self, service_account_json: str) -> str:
        """Generate a short-lived OAuth2 access token from service account credentials.

        Uses a self-signed JWT exchanged at Google's OAuth2 token endpoint.
        """
        import time

        sa = self._clean_json_string(service_account_json)
        now = int(time.time())

        # Build JWT header and claim set
        header = {"alg": "RS256", "typ": "JWT"}
        claims = {
            "iss": sa["client_email"],
            "scope": "https://www.googleapis.com/auth/spreadsheets",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        }

        import base64

        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        def _b64url(data: bytes) -> str:
            return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

        header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode())
        claims_b64 = _b64url(json.dumps(claims, separators=(",", ":")).encode())
        signing_input = f"{header_b64}.{claims_b64}"

        private_key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
        signature = private_key.sign(  # type: ignore[union-attr]
            signing_input.encode(),
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        jwt_token = f"{signing_input}.{_b64url(signature)}"

        # Exchange JWT for access token
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": jwt_token,
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    def _resolve_api_key(self, api_key: str) -> str:
        """Resolve the api_key — if it's a file path, read the file contents."""
        import os

        stripped = api_key.strip()
        # Check if it looks like a file path (not JSON, not a short API key)
        if not stripped.startswith("{") and os.path.isfile(stripped):
            with open(stripped) as f:
                return f.read().strip()
        return stripped

    def _build_auth(self, api_key: str) -> tuple[dict[str, str], dict[str, str]]:
        """Return (headers, query_params) for authentication.

        For service account JSON (or file path to one), returns a Bearer token header.
        For a plain API key, returns a key= query parameter.
        """
        resolved = self._resolve_api_key(api_key)
        if self._is_service_account_json(resolved):
            token = self._get_bearer_token(resolved)
            return {"Authorization": f"Bearer {token}"}, {}
        return {}, {"key": resolved.strip()}

    def _execute_operation(
        self,
        api_key: str,
        spreadsheet_id: str,
        sheet_range: str,
        operation: str,
        data: list[list[Any]] | None = None,
        value_input_option: str = "USER_ENTERED",
    ) -> dict[str, Any]:
        """Execute a Google Sheets API operation."""
        headers, params = self._build_auth(api_key)
        headers["Content-Type"] = "application/json"

        url = f"{BASE_URL}/{spreadsheet_id}/values/{sheet_range}"

        try:
            if operation == "read":
                response = httpx.get(url, headers=headers, params=params, timeout=30)

            elif operation == "write":
                params["valueInputOption"] = value_input_option
                body = {"range": sheet_range, "majorDimension": "ROWS", "values": data or []}
                response = httpx.put(url, headers=headers, params=params, json=body, timeout=30)

            elif operation == "append":
                url = f"{url}:append"
                params["valueInputOption"] = value_input_option
                body = {"range": sheet_range, "majorDimension": "ROWS", "values": data or []}
                response = httpx.post(url, headers=headers, params=params, json=body, timeout=30)

            else:
                return {"error": f"Unknown operation: {operation}"}

        except httpx.RequestError as e:
            return {"error": f"Network error: {e}"}

        if response.status_code == 401:
            return {"error": "Authentication failed. Check your API key or service account JSON.", "status": 401}
        if response.status_code == 403:
            return {"error": "Permission denied. Ensure the sheet is shared or the API key has access.", "status": 403}
        if response.status_code == 404:
            return {"error": "Spreadsheet or range not found. Check the spreadsheet ID and range.", "status": 404}

        try:
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"API error ({response.status_code}): {e}", "status": response.status_code}

    def _format_read_result(self, data: dict[str, Any]) -> str:
        """Format a read response into readable text."""
        values = data.get("values", [])
        if not values:
            return "No data found in the specified range."

        lines = []
        lines.append(f"**Range:** {data.get('range', 'N/A')}")
        lines.append(f"**Rows:** {len(values)}")
        lines.append("")

        # Format as a simple table
        for i, row in enumerate(values):
            row_str = " | ".join(str(cell) for cell in row)
            lines.append(f"Row {i + 1}: {row_str}")
            if i == 0 and len(values) > 1:
                # Add separator after header row
                lines.append("-" * len(row_str))

        return "\n".join(lines)

    def _format_write_result(self, data: dict[str, Any], operation: str) -> str:
        """Format a write/append response into readable text."""
        if operation == "write":
            updated_range = data.get("updatedRange", "N/A")
            updated_cells = data.get("updatedCells", 0)
            updated_rows = data.get("updatedRows", 0)
            return (
                f"**Write successful.**\n"
                f"**Range:** {updated_range}\n"
                f"**Updated Rows:** {updated_rows}\n"
                f"**Updated Cells:** {updated_cells}"
            )

        # Append
        updates = data.get("updates", {})
        updated_range = updates.get("updatedRange", "N/A")
        updated_cells = updates.get("updatedCells", 0)
        updated_rows = updates.get("updatedRows", 0)
        return (
            f"**Append successful.**\n"
            f"**Range:** {updated_range}\n"
            f"**Appended Rows:** {updated_rows}\n"
            f"**Appended Cells:** {updated_cells}"
        )

    def _parse_input_data(self, input_value: str) -> list[list[Any]] | None:
        """Parse input_value into a list of lists.

        Accepts:
        - JSON array of arrays: [["a","b"],["c","d"]]
        - JSON array: ["a","b","c"]
        - Comma-separated text: "Aman, Resyl, Founder"
        - Plain text: "hello world" (becomes a single cell)
        - Multi-line text: each line becomes a row, commas split columns
        """
        if not input_value or not input_value.strip():
            return None

        stripped = input_value.strip()

        # Try JSON first
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                return [row if isinstance(row, list) else [row] for row in parsed]
            if isinstance(parsed, dict):
                # Convert dict to a header + values row
                return [list(parsed.keys()), list(str(v) for v in parsed.values())]
            return [[str(parsed)]]
        except (json.JSONDecodeError, ValueError):
            pass

        # Plain text fallback: split lines into rows, commas into columns
        lines = [line.strip() for line in stripped.split("\n") if line.strip()]
        rows = []
        for line in lines:
            if "," in line:
                rows.append([cell.strip() for cell in line.split(",")])
            else:
                rows.append([line])
        return rows if rows else None

    def run_model(self) -> list[Data]:
        """Run the Google Sheets operation with the configured inputs."""
        operation = self.operation
        spreadsheet_id = self.spreadsheet_id
        sheet_range = self.sheet_range
        api_key = self.api_key

        write_data = None
        if operation in ("write", "append"):
            write_data = self._parse_input_data(self.input_value)
            if write_data is None:
                return [Data(text="Invalid or missing data. Provide a JSON array of arrays for write/append operations.")]

        result = self._execute_operation(
            api_key=api_key,
            spreadsheet_id=spreadsheet_id,
            sheet_range=sheet_range,
            operation=operation,
            data=write_data,
            value_input_option=self.value_input_option,
        )

        if "error" in result:
            return [Data(text=f"Google Sheets API Error: {result['error']}", data=result)]

        if operation == "read":
            formatted = self._format_read_result(result)
        else:
            formatted = self._format_write_result(result, operation)

        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key
        spreadsheet_id = self.spreadsheet_id
        default_range = self.sheet_range
        default_operation = self.operation
        default_value_input_option = self.value_input_option

        def google_sheets_tool(
            operation: str = "",
            sheet_range: str = "",
            data: str = "",
        ) -> str:
            """Read, write, or append data to a Google Sheets spreadsheet.

            Args:
                operation: The operation to perform: "read", "write", or "append".
                sheet_range: Range in A1 notation, e.g. 'Sheet1!A1:D10'.
                data: JSON array of arrays for write/append, e.g. '[["Name","Age"],["Alice",30]]'.
            """
            op = operation or default_operation
            rng = sheet_range or default_range

            write_data = None
            if op in ("write", "append"):
                write_data = self._parse_input_data(data)
                if write_data is None:
                    return "Invalid or missing data. Provide a JSON array of arrays for write/append."

            result = self._execute_operation(
                api_key=api_key,
                spreadsheet_id=spreadsheet_id,
                sheet_range=rng,
                operation=op,
                data=write_data,
                value_input_option=default_value_input_option,
            )

            if "error" in result:
                return f"Google Sheets API Error: {result['error']}"

            if op == "read":
                return self._format_read_result(result)
            return self._format_write_result(result, op)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=google_sheets_tool,
                name="google_sheets",
                description=(
                    "Read, write, or append data to a Google Sheets spreadsheet. "
                    "Supports reading cell ranges, writing data to specific ranges, "
                    "and appending rows. Provide operation, range, and data as needed."
                ),
            ),
        )
