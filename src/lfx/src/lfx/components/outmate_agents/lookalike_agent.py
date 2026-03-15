import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput
from lfx.schema.data import Data


class LookalikeAgentComponent(LCToolComponent):
    """Find companies similar to seed companies via the Outmate AI backend."""

    display_name = "Lookalike Agent"
    description = (
        "Given one or more seed companies, find similar companies with "
        "similarity scores and matching factors."
    )
    icon = "Outmate"
    name = "LookalikeAgent"

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
            name="seed_companies",
            display_name="Seed Companies",
            info="Comma-separated company names to use as seeds (e.g., 'Stripe, Square, Adyen').",
            required=True,
            tool_mode=True,
        ),
    ]

    def _parse_seeds(self, raw: str) -> list[str]:
        return [s.strip() for s in raw.split(",") if s.strip()]

    def _call_api(self, seed_companies: str) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/ai-agents/lookalike"
        seed_ids = self._parse_seeds(seed_companies)
        payload = {"seedCompanyIds": seed_ids}

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
            matching = comp.get("matchingFactors", [])
            factors_str = ", ".join(matching) if isinstance(matching, list) else str(matching)
            lines = [
                f"Company: {comp.get('companyName', 'N/A')}",
                f"  Similarity Score: {comp.get('similarityScore', 'N/A')}",
                f"  Matching Factors: {factors_str}",
                f"  Industry: {comp.get('industry', 'N/A')}",
                f"  Employees: {comp.get('employees', 'N/A')}",
            ]
            text = "\n".join(lines)
            results.append(Data(text=text, data=comp))

        return results

    def run_model(self) -> list[Data]:
        data = self._call_api(self.seed_companies or "")
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _lookalike(seed_companies: str) -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/ai-agents/lookalike"
            seed_ids = [s.strip() for s in seed_companies.split(",") if s.strip()]
            payload = {"seedCompanyIds": seed_ids}
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            companies = resp.json()
            if not isinstance(companies, list):
                companies = companies.get("results", companies.get("data", [companies]))
            results: list[Data] = []
            for comp in companies:
                matching = comp.get("matchingFactors", [])
                factors_str = ", ".join(matching) if isinstance(matching, list) else str(matching)
                lines = [
                    f"Company: {comp.get('companyName', 'N/A')}",
                    f"  Similarity Score: {comp.get('similarityScore', 'N/A')}",
                    f"  Matching Factors: {factors_str}",
                    f"  Industry: {comp.get('industry', 'N/A')}",
                    f"  Employees: {comp.get('employees', 'N/A')}",
                ]
                results.append(Data(text="\n".join(lines), data=comp))
            return results

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="lookalike_agent",
                description="Find companies similar to seed companies. Accepts comma-separated company names.",
                func=_lookalike,
            ),
        )
