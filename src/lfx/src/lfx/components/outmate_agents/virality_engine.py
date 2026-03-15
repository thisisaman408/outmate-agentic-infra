import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput
from lfx.schema.data import Data


class ViralityEngineComponent(LCToolComponent):
    """Design viral referral loops via the Outmate AI backend."""

    display_name = "Virality Engine"
    description = (
        "Design viral referral loops and growth strategies. "
        "Generate a viral growth plan based on seed customers and target channels."
    )
    icon = "Outmate"
    name = "ViralityEngine"

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
            name="seed_customers",
            display_name="Seed Customers",
            info="Description of seed customers or customer segment to build viral loops around.",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="channels",
            display_name="Channels",
            info="Comma-separated distribution channels (e.g., 'email, linkedin, slack').",
            value="email, linkedin, slack",
            required=False,
        ),
    ]

    def _call_api(self, seed_customers: str, channels: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/gtm-agents/virality-engine/run"
        payload = {
            "seed_customers": seed_customers,
            "channels": channels,
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
        channels = getattr(self, "channels", None) or "email, linkedin, slack"
        data = self._call_api(self.seed_customers or "", channels)
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _virality(seed_customers: str, channels: str = "email, linkedin, slack") -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/gtm-agents/virality-engine/run"
            payload = {
                "seed_customers": seed_customers,
                "channels": channels,
            }
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            body = resp.json()
            result_text = body.get("result", str(body))
            return [Data(text=result_text, data=body)]

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="virality_engine",
                description="Design viral referral loops and growth strategies based on seed customers and target channels.",
                func=_virality,
            ),
        )
