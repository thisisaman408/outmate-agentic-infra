import requests
from typing import cast

from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput
from lfx.schema.data import Data


class PredictiveScoringComponent(LCToolComponent):
    """Score leads at a company for conversion propensity via the Outmate AI backend."""

    display_name = "Predictive Scoring"
    description = (
        "Score leads at a target company for conversion propensity. "
        "Returns scored contacts with prediction factors and guidance."
    )
    icon = "Outmate"
    name = "PredictiveScoring"

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
            info="Name of the target company.",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="domain",
            display_name="Domain",
            info="Company domain (e.g., 'acme.com'). Optional.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="industry",
            display_name="Industry",
            info="Company industry (e.g., 'SaaS'). Optional.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="country",
            display_name="Country",
            info="Company country (e.g., 'US'). Optional.",
            required=False,
            advanced=True,
        ),
    ]

    def _build_company_payload(self) -> dict:
        company: dict = {"name": self.company_name or ""}
        domain = getattr(self, "domain", None)
        industry = getattr(self, "industry", None)
        country = getattr(self, "country", None)
        if domain:
            company["domain"] = domain
        if industry:
            company["industry"] = industry
        if country:
            company["country"] = country
        return company

    def _call_api(self, company: dict) -> list[Data]:
        url = f"{self.backend_url.rstrip('/')}/api/v1/ai-agents/predictive"
        payload = {"company": company}

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
        leads = resp.json()
        if not isinstance(leads, list):
            leads = leads.get("results", leads.get("data", [leads]))

        results: list[Data] = []
        for lead in leads:
            factors = lead.get("factors", [])
            factors_str = ", ".join(factors) if isinstance(factors, list) else str(factors)
            lines = [
                f"Contact: {lead.get('contactName', 'N/A')}",
                f"  Title: {lead.get('title', 'N/A')}",
                f"  Score: {lead.get('score', 'N/A')}",
                f"  Prediction: {lead.get('prediction', 'N/A')}",
                f"  Factors: {factors_str}",
                f"  Guidance: {lead.get('guidance', 'N/A')}",
            ]
            text = "\n".join(lines)
            results.append(Data(text=text, data=lead))

        return results

    def run_model(self) -> list[Data]:
        company = self._build_company_payload()
        data = self._call_api(company)
        self.status = data
        return data

    def build_tool(self) -> Tool:
        backend_url = self.backend_url

        def _score(company_name: str) -> list[Data]:
            url = f"{backend_url.rstrip('/')}/api/v1/ai-agents/predictive"
            payload = {"company": {"name": company_name}}
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            leads = resp.json()
            if not isinstance(leads, list):
                leads = leads.get("results", leads.get("data", [leads]))
            results: list[Data] = []
            for lead in leads:
                factors = lead.get("factors", [])
                factors_str = ", ".join(factors) if isinstance(factors, list) else str(factors)
                lines = [
                    f"Contact: {lead.get('contactName', 'N/A')}",
                    f"  Title: {lead.get('title', 'N/A')}",
                    f"  Score: {lead.get('score', 'N/A')}",
                    f"  Prediction: {lead.get('prediction', 'N/A')}",
                    f"  Factors: {factors_str}",
                    f"  Guidance: {lead.get('guidance', 'N/A')}",
                ]
                results.append(Data(text="\n".join(lines), data=lead))
            return results

        return cast(
            "Tool",
            StructuredTool.from_function(
                name="predictive_scoring",
                description="Score leads at a target company for conversion propensity. Returns scored contacts with prediction factors and guidance.",
                func=_score,
            ),
        )
