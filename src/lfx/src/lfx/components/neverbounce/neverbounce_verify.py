"""NeverBounce Email Verification Tool.

Verify email deliverability using NeverBounce's single verification API.

API Reference: https://developers.neverbounce.com/reference
Endpoint: GET https://api.neverbounce.com/v4.2/single/check
Auth: key query parameter
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import BoolInput, IntInput, MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class NeverBounceVerifyComponent(LCToolComponent):
    """Verify email deliverability using NeverBounce — 1,000 free verifications per month.

    Check if an email address is valid, invalid, disposable, catch-all, or unknown.
    Includes detailed flags for DNS, SMTP, free email hosts, role accounts, and more.
    """

    display_name = "NeverBounce Email Verify"
    description = (
        "Verify email deliverability using NeverBounce. Returns result "
        "(valid/invalid/disposable/catchall/unknown) with detailed flags."
    )
    icon = "NeverBounce"
    name = "NeverBounceVerify"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="NeverBounce API Key",
            info="Your NeverBounce API key (starts with 'secret_').",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Email Address",
            info="Email address to verify. When used as a tool, the agent passes this automatically.",
            tool_mode=True,
        ),
        BoolInput(
            name="address_info",
            display_name="Include Address Info",
            info="Include parsed address components (addr, host, domain, TLD).",
            value=True,
            advanced=True,
        ),
        BoolInput(
            name="credits_info",
            display_name="Include Credits Info",
            info="Include remaining credit balance in response.",
            value=False,
            advanced=True,
        ),
        IntInput(
            name="timeout",
            display_name="Timeout (seconds)",
            info="Max seconds to attempt verification before returning 'unknown'.",
            value=30,
            required=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.neverbounce.com/v4.2/single/check"

    # Map result codes to human-readable descriptions
    RESULT_DESCRIPTIONS = {
        "valid": "Verified as a real, deliverable email address",
        "invalid": "Verified as not valid / undeliverable",
        "disposable": "Temporary/disposable email provider",
        "catchall": "Domain accepts all addresses (cannot confirm individual)",
        "unknown": "Mail server unreachable; cannot determine validity",
    }

    def _verify_email(self, api_key: str, email: str, **kwargs: Any) -> dict[str, Any]:
        """Call NeverBounce Single Check API."""
        # Encode + as %2B for email aliases
        email = email.replace("+", "%2B") if "+" in email else email

        params: dict[str, Any] = {
            "key": api_key.strip(),
            "email": email,
        }

        if kwargs.get("address_info"):
            params["address_info"] = 1
        if kwargs.get("credits_info"):
            params["credits_info"] = 1
        if kwargs.get("timeout"):
            params["timeout"] = kwargs["timeout"]

        try:
            response = requests.get(self.API_URL, params=params, timeout=60)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": "error"}

        try:
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            return {"error": f"API error: {e}", "status": "error"}

        if not isinstance(data, dict):
            return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": "error"}

        # Check for API-level errors
        if data.get("status") != "success":
            error_msg = data.get("message", data.get("status", "Unknown error"))
            return {"error": f"NeverBounce error: {error_msg}", "status": "error"}

        return data

    def _format_result(self, data: dict[str, Any]) -> str:
        """Format verification result into readable text."""
        result = data.get("result", "unknown")
        description = self.RESULT_DESCRIPTIONS.get(result, "Unknown result")

        lines = []
        lines.append(f"**Result:** {result.upper()}")
        lines.append(f"**Description:** {description}")

        # Flags
        flags = data.get("flags", [])
        if flags:
            lines.append(f"\n**Flags:**")
            for flag in flags:
                lines.append(f"  - {flag}")

        # Suggested correction
        suggestion = data.get("suggested_correction", "")
        if suggestion:
            lines.append(f"\n**Suggested Correction:** {suggestion}")

        # Address info
        addr_info = data.get("address_info", {})
        if addr_info and isinstance(addr_info, dict):
            lines.append("\n**Address Details:**")
            lines.append(f"  Original: {addr_info.get('original_email', 'N/A')}")
            lines.append(f"  Normalized: {addr_info.get('normalized_email', 'N/A')}")
            lines.append(f"  Host: {addr_info.get('host', 'N/A')}")
            lines.append(f"  Domain: {addr_info.get('domain', 'N/A')}")
            if addr_info.get("subdomain"):
                lines.append(f"  Subdomain: {addr_info['subdomain']}")
            if addr_info.get("alias"):
                lines.append(f"  Alias: {addr_info['alias']}")

        # Credits info
        credits = data.get("credits_info", {})
        if credits and isinstance(credits, dict):
            lines.append("\n**Credits:**")
            lines.append(f"  Free remaining: {credits.get('free_credits_remaining', 'N/A')}")
            lines.append(f"  Paid remaining: {credits.get('paid_credits_remaining', 'N/A')}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run email verification with the configured inputs."""
        email = getattr(self, "input_value", None)
        if not email:
            return [Data(text="No email address provided.")]

        email = email.strip()
        result = self._verify_email(
            self.api_key,
            email,
            address_info=getattr(self, "address_info", True),
            credits_info=getattr(self, "credits_info", False),
            timeout=getattr(self, "timeout", 30),
        )

        if "error" in result:
            return [Data(text=f"NeverBounce Error: {result['error']}", data=result)]

        formatted = self._format_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def verify_email(email: str) -> str:
            """Verify if an email is valid and deliverable using NeverBounce.

            Returns: valid, invalid, disposable, catchall, or unknown with detailed flags.

            Args:
                email: The email address to verify
            """
            if not email:
                return "No email address provided."

            result = self._verify_email(api_key, email.strip(), address_info=True)

            if "error" in result:
                return f"NeverBounce Error: {result['error']}"

            return self._format_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=verify_email,
                name="neverbounce_email_verify",
                description=(
                    "Verify email deliverability using NeverBounce. "
                    "Returns valid/invalid/disposable/catchall/unknown with flags for DNS, SMTP, "
                    "free email, role account. Best for: Email Quality Signals, Contact Availability."
                ),
            ),
        )
