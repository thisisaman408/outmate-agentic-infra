"""People Data Labs Person Enrichment Tool.

Enriches person data using the PDL API. Provide an email, LinkedIn URL,
name + company, or phone number to get detailed person information.

API Reference: https://docs.peopledatalabs.com/docs/reference-person-enrichment-api
Endpoint: GET https://api.peopledatalabs.com/v5/person/enrich
Auth: X-Api-Key header
"""

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import IntInput, MessageTextInput, SecretStrInput
from lfx.schema.data import Data


class PDLPersonEnrichmentComponent(LCToolComponent):
    """Enrich person data using People Data Labs — 2.8B+ profiles with emails, jobs, education.

    Provide an email, LinkedIn URL, name + company, or phone to get detailed
    person information including contact details, employment history, education, and social profiles.
    """

    display_name = "PDL Person Enrichment"
    description = (
        "Enrich person data via People Data Labs API. Returns emails, phone numbers, "
        "job title, company, seniority, employment history, education, and social profiles."
    )
    icon = "PDL"
    name = "PDLPersonEnrichment"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="PDL API Key",
            info="Your People Data Labs API key.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Lookup Query",
            info=(
                "Person lookup query. Provide email, LinkedIn URL, or 'first_name last_name at company'. "
                "When used as a tool, the agent passes this automatically."
            ),
            tool_mode=True,
        ),
        MessageTextInput(
            name="email",
            display_name="Email",
            info="Person's email address.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="linkedin_url",
            display_name="LinkedIn URL",
            info="Person's LinkedIn profile URL.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="first_name",
            display_name="First Name",
            info="Person's first name (use with last_name + company).",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="last_name",
            display_name="Last Name",
            info="Person's last name (use with first_name + company).",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="company",
            display_name="Company",
            info="Company name, website, or social URL.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="phone",
            display_name="Phone",
            info="Phone number (must begin with +country_code).",
            required=False,
            advanced=True,
        ),
        IntInput(
            name="min_likelihood",
            display_name="Min Likelihood",
            value=5,
            info="Minimum confidence score (1-10). Higher = fewer but more accurate results.",
            required=False,
            advanced=True,
        ),
    ]

    API_URL = "https://api.peopledatalabs.com/v5/person/enrich"

    def _build_request_params(self) -> dict[str, Any]:
        """Build request parameters from component inputs."""
        params: dict[str, Any] = {}

        if getattr(self, "email", None):
            params["email"] = self.email
        if getattr(self, "linkedin_url", None):
            params["profile"] = self.linkedin_url
        if getattr(self, "first_name", None):
            params["first_name"] = self.first_name
        if getattr(self, "last_name", None):
            params["last_name"] = self.last_name
        if getattr(self, "company", None):
            params["company"] = self.company
        if getattr(self, "phone", None):
            params["phone"] = self.phone
        if getattr(self, "min_likelihood", None):
            params["min_likelihood"] = self.min_likelihood

        return params

    def _parse_query_string(self, query: str) -> dict[str, Any]:
        """Parse a natural-language query into API parameters."""
        query = query.strip()

        if "linkedin.com" in query:
            return {"profile": query}

        if "@" in query and " " not in query:
            return {"email": query}

        if query.startswith("+") and query[1:].replace(" ", "").replace("-", "").isdigit():
            return {"phone": query}

        parts = query.replace(" at ", " @ ").split("@")
        if len(parts) == 2:
            name_part = parts[0].strip()
            company_part = parts[1].strip()
            name_parts = name_part.split()
            result: dict[str, Any] = {"company": company_part}
            if len(name_parts) >= 2:
                result["first_name"] = name_parts[0]
                result["last_name"] = " ".join(name_parts[1:])
            elif len(name_parts) == 1:
                result["name"] = name_parts[0]
            return result

        name_parts = query.split()
        if len(name_parts) >= 2:
            return {"first_name": name_parts[0], "last_name": " ".join(name_parts[1:])}

        return {"name": query}

    def _enrich_person(self, api_key: str, params: dict[str, Any]) -> dict[str, Any]:
        """Call PDL Person Enrichment API."""
        headers = {
            "X-Api-Key": api_key.strip(),
            "Content-Type": "application/json",
        }

        try:
            response = requests.get(self.API_URL, headers=headers, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 404:
            return {"error": "No matching person found.", "status": 404}
        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your PDL API key.", "status": 401}
        if response.status_code == 402:
            return {"error": "Credit limit reached. Check your PDL account usage.", "status": 402}
        if response.status_code == 400:
            return {"error": f"Bad request: {response.text[:200]}", "status": 400}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})", "status": response.status_code}
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _format_person_result(self, data: dict[str, Any]) -> str:
        """Format person enrichment result into readable text."""
        try:
            return self._format_person_result_inner(data)
        except Exception as e:
            # Fallback: return raw JSON if formatting fails
            import json
            return f"Person data (raw): {json.dumps(data, indent=2, default=str)[:3000]}"

    def _format_person_result_inner(self, data: dict[str, Any]) -> str:
        """Inner formatting - may raise on unexpected data types."""
        person = data.get("data", data)
        if not person or not isinstance(person, dict):
            return "No person data found."

        likelihood = data.get("likelihood", "N/A")
        lines = []
        lines.append(f"**Confidence:** {likelihood}/10")
        lines.append(f"**Name:** {person.get('full_name', 'N/A')}")
        lines.append(f"**Job Title:** {person.get('job_title', 'N/A')}")
        title_levels = person.get('job_title_levels') or []
        if not isinstance(title_levels, list):
            title_levels = [str(title_levels)] if title_levels else []
        lines.append(f"**Seniority:** {', '.join(title_levels)}")
        lines.append(f"**Company:** {person.get('job_company_name', 'N/A')}")
        lines.append(f"**Company Industry:** {person.get('job_company_industry', 'N/A')}")
        lines.append(f"**Company Size:** {person.get('job_company_size', 'N/A')}")
        lines.append(f"**Company Employees:** {person.get('job_company_employee_count', 'N/A')}")
        lines.append(f"**Location:** {person.get('location_name', 'N/A')}")
        lines.append(f"**LinkedIn:** {person.get('linkedin_url', 'N/A')}")

        # Emails
        emails = person.get("emails") or []
        if isinstance(emails, list) and emails:
            email_list = [e.get("address", "") for e in emails if isinstance(e, dict)]
            if email_list:
                lines.append(f"**Emails:** {', '.join(email_list[:5])}")

        # Phone
        phones = person.get("phone_numbers") or []
        if isinstance(phones, list) and phones:
            lines.append(f"**Phones:** {', '.join(str(p) for p in phones[:3])}")

        # Experience
        experience = person.get("experience") or []
        if isinstance(experience, list) and experience:
            lines.append("\n**Experience:**")
            for exp in experience[:5]:
                if isinstance(exp, dict):
                    company = exp.get("company", {})
                    company_name = company.get("name", "N/A") if isinstance(company, dict) else str(company)
                    primary = " (Current)" if exp.get("is_primary") else ""
                    title = exp.get("title", "N/A")
                    if isinstance(title, dict):
                        title = title.get("name", "N/A")
                    lines.append(f"  - {title} at {company_name}{primary}")

        # Education
        education = person.get("education") or []
        if isinstance(education, list) and education:
            lines.append("\n**Education:**")
            for edu in education[:3]:
                if isinstance(edu, dict):
                    school = edu.get("school", {})
                    school_name = school.get("name", "N/A") if isinstance(school, dict) else str(school)
                    degrees = edu.get("degrees") or []
                    if not isinstance(degrees, list):
                        degrees = [str(degrees)] if degrees else []
                    degree_str = f" ({', '.join(degrees)})" if degrees else ""
                    lines.append(f"  - {school_name}{degree_str}")

        # Social profiles
        linkedin = person.get("linkedin_url", "")
        github = person.get("github_url", "")
        twitter = person.get("twitter_url", "")
        socials = []
        if linkedin:
            socials.append(f"LinkedIn: {linkedin}")
        if github:
            socials.append(f"GitHub: {github}")
        if twitter:
            socials.append(f"Twitter: {twitter}")
        if socials:
            lines.append(f"\n**Social Profiles:** {' | '.join(socials)}")

        return "\n".join(lines)

    def run_model(self) -> list[Data]:
        """Run person enrichment with the configured inputs."""
        params = self._build_request_params()

        if not params and getattr(self, "input_value", None):
            params = self._parse_query_string(self.input_value)

        if not params:
            return [Data(text="No lookup parameters provided. Provide an email, LinkedIn URL, or name + company.")]

        result = self._enrich_person(self.api_key, params)

        if not isinstance(result, dict):
            return [Data(text=f"PDL API Error: Unexpected response type ({type(result).__name__})")]

        if "error" in result:
            return [Data(text=f"PDL API Error: {result['error']}", data=result)]

        formatted = self._format_person_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key

        def enrich_person(
            query: str = "",
            email: str = "",
            first_name: str = "",
            last_name: str = "",
            company: str = "",
            linkedin_url: str = "",
            phone: str = "",
        ) -> str:
            """Enrich person data using People Data Labs (2.8B+ profiles). Returns emails, jobs, education, social.

            Args:
                query: Natural language query like 'john@example.com' or 'John Doe at Stripe'
                email: Person's email address
                first_name: Person's first name
                last_name: Person's last name
                company: Company name or domain
                linkedin_url: LinkedIn profile URL
                phone: Phone number (with +country_code)
            """
            try:
                params: dict[str, Any] = {}

                if email:
                    params["email"] = email
                if first_name:
                    params["first_name"] = first_name
                if last_name:
                    params["last_name"] = last_name
                if company:
                    params["company"] = company
                if linkedin_url:
                    params["profile"] = linkedin_url
                if phone:
                    params["phone"] = phone

                if not params and query:
                    params = self._parse_query_string(query)

                if not params:
                    return "No parameters provided. Provide email, name + company, LinkedIn URL, or phone."

                params["min_likelihood"] = getattr(self, "min_likelihood", 5) or 5

                result = self._enrich_person(api_key, params)

                if not isinstance(result, dict):
                    return f"PDL API Error: Unexpected response type ({type(result).__name__})"

                if "error" in result:
                    return f"PDL API Error: {result['error']}"

                return self._format_person_result(result)
            except Exception as exc:
                return f"PDL tool error: {type(exc).__name__}: {exc}"

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=enrich_person,
                name="pdl_person_enrichment",
                description=(
                    "Look up detailed person information using People Data Labs (2.8B+ profiles). "
                    "Returns emails, phone, job title, company, seniority, employment history, education, social profiles. "
                    "Best for: Decision-Maker Presence, Persona Seniority, Contact Availability, Company Firmographics."
                ),
            ),
        )
