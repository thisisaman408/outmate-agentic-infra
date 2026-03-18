"""Hunter.io Email Verifier Tool.

Verify whether an email address is valid and deliverable.

API Reference: https://hunter.io/api-documentation/v2
Endpoint: GET https://api.hunter.io/v2/email-verifier
Auth: api_key query parameter or X-API-KEY header
Rate Limit: 10 req/sec, 300 req/min
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class HunterEmailVerifierComponent(LCToolComponent):
    """Verify email deliverability using Hunter.io — check if an email is valid before sending.

    Verifies an email address and returns its deliverability status, confidence score,
    and detailed checks (MX records, SMTP, disposable, etc.).
    """

    display_name = "Hunter Email Verifier"
    description = (
        "Verify email deliverability using Hunter.io. Returns status (valid/invalid/accept_all), "
        "confidence score, and checks for disposable, webmail, MX records, SMTP."
    )
    icon = "Hunter"
    name = "HunterEmailVerifier"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Hunter API Key",
            info="Your Hunter.io API key.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Email Address",
            info="Email address to verify. When used as a tool, the agent passes this automatically.",
            tool_mode=True,
        ),
    ]

    API_URL = "https://api.hunter.io/v2/email-verifier"

    def _verify_email(self, api_key: str, email: str) -> dict[str, Any]:
        """Call Hunter.io Email Verifier API."""
        params = {"email": email, "api_key": api_key.strip()}

        try:
            response = requests.get(self.API_URL, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        # HTTP 202 means verification is still in progress
        if response.status_code == 202:
            return {"error": "Verification in progress. Try again in a few seconds.", "status": 202}
        if response.status_code == 222:
            return {"error": "Remote SMTP server error. Try again later.", "status": 222}
        if response.status_code == 429:
            return {"error": "Monthly quota exceeded. Upgrade your Hunter.io plan.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your Hunter.io API key.", "status": 401}
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
        """Format email verification result into readable text."""
        result = data.get("data", {})
        if not result:
            return "No verification result available."

        lines = []
        lines.append(f"**Email:** {result.get('email', 'N/A')}")
        lines.append(f"**Status:** {result.get('status', 'N/A')}")
        lines.append(f"**Score:** {result.get('score', 'N/A')}/100")

        # Detailed checks
        lines.append("\n**Checks:**")
        checks = {
            "regexp": "Format Valid",
            "gibberish": "Gibberish",
            "disposable": "Disposable",
            "webmail": "Webmail",
            "mx_records": "MX Records",
            "smtp_server": "SMTP Server",
            "smtp_check": "SMTP Check",
            "accept_all": "Accept All",
            "block": "Blocked",
        }

        for key, label in checks.items():
            val = result.get(key)
            if val is not None:
                icon = "Yes" if val else "No"
                lines.append(f"  {label}: {icon}")

        suggestion = result.get("suggested_correction", "")
        if suggestion:
            lines.append(f"\n**Suggested Correction:** {suggestion}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run email verification with the configured inputs."""
        email = getattr(self, "input_value", None)
        if not email:
            return [Data(text="No email address provided.")]

        email = email.strip()
        result = self._verify_email(self.api_key, email)

        if "error" in result:
            return [Data(text=f"Hunter API Error: {result['error']}", data=result)]

        formatted = self._format_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def verify_email(email: str) -> str:
            """Verify if an email address is valid and deliverable using Hunter.io.

            Args:
                email: The email address to verify
            """
            if not email:
                return "No email address provided."

            result = self._verify_email(api_key, email.strip())

            if "error" in result:
                return f"Hunter API Error: {result['error']}"

            return self._format_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=verify_email,
                name="hunter_email_verifier",
                description=(
                    "Verify if an email address is valid and deliverable using Hunter.io. "
                    "Returns status (valid/invalid/accept_all), deliverability score, "
                    "and checks for disposable, webmail, MX records. "
                    "Best for: Email Quality Signals, Contact Availability."
                ),
            ),
        )
