import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput
from lfx.schema.data import Data


class RegimeShifterComponent(LCToolComponent):
    """Adapt GTM strategy to macro-economic shifts via the Outmate AI backend."""

    display_name = "Regime Shifter"
    description = (
        "Adapt your go-to-market strategy to macro-economic shifts. "
        "Generate a GTM adaptation plan for a given geographic focus and scenario."
    )
    icon = "Outmate"
    name = "RegimeShifter"

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
            name="geo_focus",
            display_name="Geographic Focus",
            info="Geographic region to focus the GTM adaptation on (e.g., 'EMEA', 'North America').",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="scenario",
            display_name="Scenario",
            info="Macro-economic scenario to adapt to (e.g., 'recession', 'tariff war'). Optional.",
            required=False,
        ),
    ]

    def _call_api(self, geo_focus: str, scenario: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/gtm-agents/regime-shifter/run"
        payload: dict = {"geo_focus": geo_focus}
        if scenario:
            payload["scenario"] = scenario

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
        scenario = getattr(self, "scenario", None) or ""
        data = self._call_api(self.geo_focus or "", scenario)
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _regime_shifter(geo_focus: str, scenario: str = "") -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/gtm-agents/regime-shifter/run"
            payload: dict = {"geo_focus": geo_focus}
            if scenario:
                payload["scenario"] = scenario
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            body = resp.json()
            result_text = body.get("result", str(body))
            return [Data(text=result_text, data=body)]

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="regime_shifter",
                description="Adapt GTM strategy to macro-economic shifts for a given geographic focus and scenario.",
                func=_regime_shifter,
            ),
        )
