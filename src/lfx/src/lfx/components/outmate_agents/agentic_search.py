import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput
from lfx.schema.data import Data


class AgenticSearchComponent(LCToolComponent):
    """Prospect discovery from a natural-language query via the Outmate AI backend."""

    display_name = "Agentic Search"
    description = (
        "Discover prospects from a natural-language query. "
        "Returns companies with scores, contact info, and buying signals."
    )
    icon = "Outmate"
    name = "AgenticSearch"

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
            name="query",
            display_name="Search Query",
            info="Natural-language prospect search query (e.g., 'Series B fintech companies in Europe').",
            required=True,
            tool_mode=True,
        ),
    ]

    def _call_api(self, query: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/ai-agents/search"
        payload = {"query": query}

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
        companies = resp.json()
        if not isinstance(companies, list):
            companies = companies.get("results", companies.get("data", [companies]))

        results: list[Data] = []
        for comp in companies:
            lines = [
                f"Company: {comp.get('companyName', 'N/A')}",
                f"  Score: {comp.get('score', 'N/A')}",
                f"  Reason: {comp.get('reason', 'N/A')}",
                f"  Industry: {comp.get('industry', 'N/A')}",
                f"  Employees: {comp.get('employees', 'N/A')}",
                f"  Location: {comp.get('location', 'N/A')}",
                f"  Contact: {comp.get('contactName', 'N/A')} - {comp.get('title', 'N/A')}",
                f"  Email: {comp.get('email', 'N/A')}",
                f"  Signals: {comp.get('signals', 'N/A')}",
            ]
            text = "\n".join(lines)
            results.append(Data(text=text, data=comp))

        return results

    def run_model(self) -> list[Data]:
        data = self._call_api(self.query or "")
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _search(query: str) -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/ai-agents/search"
            payload = {"query": query}
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            companies = resp.json()
            if not isinstance(companies, list):
                companies = companies.get("results", companies.get("data", [companies]))
            results: list[Data] = []
            for comp in companies:
                lines = [
                    f"Company: {comp.get('companyName', 'N/A')}",
                    f"  Score: {comp.get('score', 'N/A')}",
                    f"  Reason: {comp.get('reason', 'N/A')}",
                    f"  Industry: {comp.get('industry', 'N/A')}",
                    f"  Employees: {comp.get('employees', 'N/A')}",
                    f"  Location: {comp.get('location', 'N/A')}",
                    f"  Contact: {comp.get('contactName', 'N/A')} - {comp.get('title', 'N/A')}",
                    f"  Email: {comp.get('email', 'N/A')}",
                    f"  Signals: {comp.get('signals', 'N/A')}",
                ]
                results.append(Data(text="\n".join(lines), data=comp))
            return results

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="agentic_search",
                description="Discover prospects from a natural-language query. Returns companies with scores, contact info, and buying signals.",
                func=_search,
            ),
        )
