import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, MultilineInput
from lfx.schema.data import Data


class ComplianceOracleComponent(LCToolComponent):
    """Audit outbound messages for regulatory compliance via the Outmate AI backend."""

    display_name = "Compliance Oracle"
    description = (
        "Audit outbound messages (emails, ads, sequences) for compliance "
        "with CAN-SPAM, GDPR, CCPA, and other regulations."
    )
    icon = "Outmate"
    name = "ComplianceOracle"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Outmate Backend URL",
            info="Base URL of the Outmate AI backend (e.g., http://localhost:8000).",
            value="http://localhost:8000",
            required=True,
            advanced=True,
        ),
        MultilineInput(
            name="message_template",
            display_name="Message Template",
            info="The outbound message text to audit for compliance.",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="jurisdictions",
            display_name="Jurisdictions",
            info="Comma-separated jurisdictions to check against (e.g., 'US, EU, UK').",
            value="US, EU, UK",
            required=False,
        ),
    ]

    def _call_api(self, message_template: str, jurisdictions: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/gtm-agents/compliance-oracle/run"
        payload = {
            "message_template": message_template,
            "jurisdictions": jurisdictions,
        }

        try:
            resp = requests.post(url, json=payload, timeout=120)
        except requests.ConnectionError as exc:
            error_text = f"Connection error: could not reach {url} - {exc}"
            return [Data(text=error_text, data={"error": str(exc)})]
        except requests.Timeout as exc:
            error_text = f"Request timed out after 120 seconds - {exc}"
            return [Data(text=error_text, data={"error": str(exc)})]

        if resp.status_code == 402:
            error_text = "Credit exhaustion: your Outmate account has insufficient credits."
            return [Data(text=error_text, data={"error": error_text, "status_code": 402})]
        if resp.status_code == 429:
            error_text = "Rate limit exceeded. Please wait and try again."
            return [Data(text=error_text, data={"error": error_text, "status_code": 429})]
        if resp.status_code >= 500:
            error_text = f"Server error ({resp.status_code}): {resp.text}"
            return [Data(text=error_text, data={"error": error_text, "status_code": resp.status_code})]

        resp.raise_for_status()
        body = resp.json()
        result_text = body.get("result", str(body))
        return [Data(text=result_text, data=body)]

    def run_model(self) -> list[Data]:
        jurisdictions = getattr(self, "jurisdictions", None) or "US, EU, UK"
        data = self._call_api(self.message_template or "", jurisdictions)
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _compliance(message_template: str, jurisdictions: str = "US, EU, UK") -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/gtm-agents/compliance-oracle/run"
            payload = {
                "message_template": message_template,
                "jurisdictions": jurisdictions,
            }
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            body = resp.json()
            result_text = body.get("result", str(body))
            return [Data(text=result_text, data=body)]

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="compliance_oracle",
                description="Audit outbound messages for compliance with CAN-SPAM, GDPR, CCPA, and other regulations.",
                func=_compliance,
            ),
        )
