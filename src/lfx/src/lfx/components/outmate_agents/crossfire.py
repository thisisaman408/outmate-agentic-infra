import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, MultilineInput
from lfx.schema.data import Data


class CrossfireComponent(LCToolComponent):
    """Competitive intelligence: research competitor weaknesses and generate battle cards via the Outmate AI backend."""

    display_name = "Crossfire"
    description = (
        "Competitive intelligence agent. Research competitor weaknesses "
        "and generate battle cards for your sales team."
    )
    icon = "Outmate"
    name = "Crossfire"

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
            name="competitor_domain",
            display_name="Competitor Domain",
            info="Domain of the competitor to analyze (e.g., 'competitor.com').",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="target_region",
            display_name="Target Region",
            info="Geographic region to focus the analysis on (e.g., 'North America'). Optional.",
            required=False,
        ),
        MultilineInput(
            name="notes",
            display_name="Notes",
            info="Additional context or specific areas to investigate. Optional.",
            required=False,
        ),
    ]

    def _call_api(self, competitor_domain: str, target_region: str, notes: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/gtm-agents/crossfire/run"
        payload: dict = {"competitor_domain": competitor_domain}
        if target_region:
            payload["target_region"] = target_region
        if notes:
            payload["notes"] = notes

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
        target_region = getattr(self, "target_region", None) or ""
        notes = getattr(self, "notes", None) or ""
        data = self._call_api(self.competitor_domain or "", target_region, notes)
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _crossfire(competitor_domain: str, target_region: str = "", notes: str = "") -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/gtm-agents/crossfire/run"
            payload: dict = {"competitor_domain": competitor_domain}
            if target_region:
                payload["target_region"] = target_region
            if notes:
                payload["notes"] = notes
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            body = resp.json()
            result_text = body.get("result", str(body))
            return [Data(text=result_text, data=body)]

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="crossfire",
                description="Competitive intelligence: research competitor weaknesses and generate battle cards.",
                func=_crossfire,
            ),
        )
