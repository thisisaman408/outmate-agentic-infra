import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput
from lfx.schema.data import Data


class ResearchAgentComponent(LCToolComponent):
    """Deep company intelligence report via the Outmate AI backend."""

    display_name = "Research Agent"
    description = (
        "Generate a deep company intelligence report including executive summary, "
        "market position, competitive landscape, and opportunities."
    )
    icon = "Outmate"
    name = "ResearchAgent"

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
            name="company_name",
            display_name="Company Name",
            info="Name of the company to research.",
            required=True,
            tool_mode=True,
        ),
        DropdownInput(
            name="depth",
            display_name="Research Depth",
            info="How deep the research should go.",
            options=["quick", "standard", "deep"],
            value="standard",
        ),
    ]

    def _format_report(self, report: dict) -> str:
        sections = [
            f"# Company Research: {report.get('companyName', 'N/A')}",
            "",
            f"## Executive Summary\n{report.get('executiveSummary', 'N/A')}",
            "",
            f"## Market Position\n{report.get('marketPosition', 'N/A')}",
            "",
            f"## Competitive Landscape\n{report.get('competitiveLandscape', 'N/A')}",
            "",
            f"## Recent Developments\n{report.get('recentDevelopments', 'N/A')}",
            "",
            f"## Opportunities\n{report.get('opportunities', 'N/A')}",
            "",
            f"## Risks and Challenges\n{report.get('risksAndChallenges', 'N/A')}",
        ]
        return "\n".join(sections)

    def _call_api(self, company_name: str, depth: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/ai-agents/research"
        payload = {"companyName": company_name, "depth": depth}

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
        report = resp.json()
        text = self._format_report(report)
        return [Data(text=text, data=report)]

    def run_model(self) -> list[Data]:
        data = self._call_api(self.company_name or "", self.depth or "standard")
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _research(company_name: str, depth: str = "standard") -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/ai-agents/research"
            payload = {"companyName": company_name, "depth": depth}
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            report = resp.json()
            sections = [
                f"# Company Research: {report.get('companyName', 'N/A')}",
                "",
                f"## Executive Summary\n{report.get('executiveSummary', 'N/A')}",
                "",
                f"## Market Position\n{report.get('marketPosition', 'N/A')}",
                "",
                f"## Competitive Landscape\n{report.get('competitiveLandscape', 'N/A')}",
                "",
                f"## Recent Developments\n{report.get('recentDevelopments', 'N/A')}",
                "",
                f"## Opportunities\n{report.get('opportunities', 'N/A')}",
                "",
                f"## Risks and Challenges\n{report.get('risksAndChallenges', 'N/A')}",
            ]
            text = "\n".join(sections)
            return [Data(text=text, data=report)]

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="research_agent",
                description="Generate a deep company intelligence report with executive summary, market position, competitive landscape, and opportunities.",
                func=_research,
            ),
        )
