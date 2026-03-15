import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import IntInput, MessageTextInput
from lfx.schema.data import Data


class TalentRadarComponent(LCToolComponent):
    """Monitor accounts for executive churn signals via the Outmate AI backend."""

    display_name = "Talent Radar"
    description = (
        "Monitor target accounts for executive churn signals. "
        "Detect leadership changes, departures, and hiring patterns that indicate opportunity."
    )
    icon = "Outmate"
    name = "TalentRadar"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Outmate Backend URL",
            info="Base URL of the Outmate AI backend (e.g., http://localhost:8000).",
            value="http://localhost:8000",
            required=True,
            advanced=True,
        ),
        MessageTextInput(
            name="accounts",
            display_name="Accounts",
            info="Target accounts to monitor for executive churn (company names or domains).",
            required=True,
            tool_mode=True,
        ),
        IntInput(
            name="lookback_days",
            display_name="Lookback Days",
            info="Number of days to look back for churn signals (7-365).",
            value=90,
            required=False,
            range_spec={"min": 7, "max": 365, "step": 1},
        ),
    ]

    def _call_api(self, accounts: str, lookback_days: int) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/gtm-agents/talent-radar/run"
        payload = {
            "accounts": accounts,
            "lookback_days": lookback_days,
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
        lookback = getattr(self, "lookback_days", 90) or 90
        data = self._call_api(self.accounts or "", int(lookback))
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _talent_radar(accounts: str, lookback_days: int = 90) -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/gtm-agents/talent-radar/run"
            payload = {
                "accounts": accounts,
                "lookback_days": lookback_days,
            }
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            body = resp.json()
            result_text = body.get("result", str(body))
            return [Data(text=result_text, data=body)]

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="talent_radar",
                description="Monitor target accounts for executive churn signals, leadership changes, and hiring patterns.",
                func=_talent_radar,
            ),
        )
