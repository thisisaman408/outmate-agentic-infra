"""Shared tool factory for GTM agents.

Creates LangChain StructuredTools from API keys so agents are self-contained —
no need to drag separate tool nodes onto the canvas.
"""

from __future__ import annotations

import json
from typing import Any, cast

import requests
from langchain_core.tools import StructuredTool, ToolException


# ---------------------------------------------------------------------------
# Deterministic circuit breaker — kills tools after first failure
# ---------------------------------------------------------------------------

class _CircuitBreaker:
    """Tracks which tool families are dead. Shared across all calls in a single agent run."""

    def __init__(self):
        self._dead: dict[str, str] = {}  # tool_family -> reason

    def kill(self, family: str, reason: str):
        self._dead[family] = reason

    def is_dead(self, family: str) -> str | None:
        return self._dead.get(family)

    def check_or_raise(self, family: str, alt: str):
        """If this tool family is dead, raise ToolException immediately — zero wasted iterations."""
        reason = self._dead.get(family)
        if reason:
            raise ToolException(f"TOOL PERMANENTLY DISABLED: {reason}. Use {alt} instead.")


# Global breaker — reset per agent run via build_tools_from_keys
_breaker = _CircuitBreaker()


# ---------------------------------------------------------------------------
# DuckDuckGo (free, no key)
# ---------------------------------------------------------------------------

def create_duckduckgo_tool():
    """Create DuckDuckGo search tool (no API key needed), wrapped to handle network errors."""
    try:
        from langchain_community.tools import DuckDuckGoSearchRun

        ddg = DuckDuckGoSearchRun()

        def safe_duckduckgo_search(query: str) -> str:
            """Search the web using DuckDuckGo. Returns text results."""
            try:
                return ddg.run(query)
            except Exception as e:
                return f"DuckDuckGo search failed (network error): {str(e)[:200]}. Try using tavily_search or another tool instead."

        return StructuredTool.from_function(handle_tool_error=True,
            func=safe_duckduckgo_search,
            name="duckduckgo_search",
            description="Search the web using DuckDuckGo. Free, no API key needed. Use for finding company info, news, and leadership data.",
        )
    except ImportError:
        return None


# ---------------------------------------------------------------------------
# Tavily Search
# ---------------------------------------------------------------------------

def create_tavily_tool(api_key: str):
    """Create Tavily AI search tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def tavily_search(
        query: str,
        time_range: str = "",
        max_results: int = 5,
        include_domains: str = "",
    ) -> str:
        """Search the web using Tavily AI search. Returns structured results optimized for AI agents.

        Args:
            query: The search query.
            time_range: Filter by recency — 'day', 'week', 'month', 'year', or '' for no filter. Use 'week' to find recent posts.
            max_results: Number of results (1-10). Default 5.
            include_domains: Comma-separated domains to restrict search to (e.g. 'linkedin.com,twitter.com'). Leave empty for all.
        """
        import httpx

        payload: dict = {
            "query": query,
            "max_results": min(max(max_results, 1), 10),
            "search_depth": "basic",
            "include_answer": True,
        }
        if time_range in ("day", "week", "month", "year"):
            payload["time_range"] = time_range
        if include_domains:
            payload["include_domains"] = [d.strip() for d in include_domains.split(",") if d.strip()]

        resp = httpx.post(
            "https://api.tavily.com/search",
            json=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=90.0,
        )
        if resp.status_code != 200:
            return f"Tavily error ({resp.status_code}): {resp.text[:300]}"
        data = resp.json()
        parts = []
        if data.get("answer"):
            parts.append(f"**AI Answer:** {data['answer'][:500]}\n")
        for r in data.get("results", [])[:max_results]:
            content = r.get("content", "")[:400]
            parts.append(f"**{r.get('title', '')}**\n{r.get('url', '')}\n{content}")
        result = "\n\n".join(parts) if parts else "No results found."
        return result[:3000]

    return StructuredTool.from_function(handle_tool_error=True,
        func=tavily_search,
        name="tavily_search",
        description=(
            "Search the web using Tavily AI. Supports time_range='day'|'week'|'month'|'year' to filter recent results. "
            "Use include_domains='linkedin.com' to restrict to LinkedIn. Best for finding recent posts and research."
        ),
    )


# ---------------------------------------------------------------------------
# Apollo Organization Enrichment
# ---------------------------------------------------------------------------

def _guess_domains(company_name: str) -> list[str]:
    """Generate likely domain guesses from a company name."""
    if not company_name:
        return []
    clean = company_name.strip().lower()
    # Remove common suffixes
    for suffix in [" inc", " inc.", " llc", " ltd", " pvt", " pvt.", " private limited", " limited", " corp", " corporation", " co", " co."]:
        clean = clean.replace(suffix, "")
    clean = clean.strip()
    words = clean.split()
    joined = "".join(words)
    # Common patterns
    guesses = []
    guesses.append(f"{joined}.com")  # bigsteptechnologies.com
    if len(words) > 1:
        # Try abbreviations: "Big Step Technologies" -> "bigsteptech.com"
        abbrev = "".join(words[:-1]) + words[-1][:4]
        guesses.append(f"{abbrev}.com")
        # Try without last word: "bigstep.com"
        guesses.append(f"{''.join(words[:-1])}.com")
    guesses.append(f"{joined}.io")
    return list(dict.fromkeys(guesses))  # dedupe preserving order


def create_apollo_org_tool(api_key: str):
    """Create Apollo.io organization enrichment tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def apollo_org_enrichment(domain: str = "", organization_name: str = "") -> str:
        """Enrich company data via Apollo.io. Provide the company domain (e.g. ramp.com) OR the company name. If you only know the name, just pass organization_name and the tool will find the domain."""
        headers = {"Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key}

        # Build list of domains to try
        domains_to_try = []
        if domain:
            domains_to_try.append(domain)
        if organization_name:
            domains_to_try.extend(_guess_domains(organization_name))

        if not domains_to_try and not organization_name:
            return "Provide a domain or organization_name."

        # Try each domain until one works
        org = None
        for d in domains_to_try:
            resp = requests.get(
                "https://api.apollo.io/api/v1/organizations/enrich",
                headers=headers,
                params={"domain": d},
                timeout=30,
            )
            if resp.status_code == 200:
                org = resp.json().get("organization", {})
                if org and org.get("name"):
                    break
                org = None

        if not org:
            return f"No organization data found for '{organization_name or domain}'. Try providing the exact website domain."

        lines = [f"**Company:** {org.get('name', 'N/A')}  *(Source: Apollo.io)*"]
        if org.get("website_url"):
            lines.append(f"**Website:** {org['website_url']}")
        if org.get("industry"):
            lines.append(f"**Industry:** {org['industry']}")
        if org.get("estimated_num_employees"):
            lines.append(f"**Employees:** {org['estimated_num_employees']}")
        if org.get("founded_year"):
            lines.append(f"**Founded:** {org['founded_year']}")
        if org.get("annual_revenue_printed"):
            lines.append(f"**Annual Revenue:** {org['annual_revenue_printed']}")
        if org.get("total_funding_printed"):
            lines.append(f"**Total Funding:** {org['total_funding_printed']}")
        if org.get("latest_funding_stage"):
            lines.append(f"**Latest Funding Stage:** {org['latest_funding_stage']}")
        if org.get("linkedin_url"):
            lines.append(f"**LinkedIn:** {org['linkedin_url']}")
        loc_parts = [org.get("city"), org.get("state"), org.get("country")]
        loc = ", ".join(p for p in loc_parts if p)
        if loc:
            lines.append(f"**Location:** {loc}")
        if org.get("phone"):
            lines.append(f"**Phone:** {org['phone']}")
        if org.get("short_description"):
            lines.append(f"**Description:** {org['short_description']}")

        funding_events = org.get("funding_events", [])
        if funding_events:
            lines.append("\n**Funding Events:**")
            for fe in funding_events[:5]:
                amt = fe.get("amount")
                try:
                    amt_str = f"${float(amt):,.0f}" if amt else "undisclosed"
                except (TypeError, ValueError):
                    amt_str = str(amt) if amt else "undisclosed"
                lines.append(f"  - {fe.get('funding_type', 'Unknown')}: {amt_str} ({fe.get('date', 'N/A')})")

        return "\n".join(lines)

    return StructuredTool.from_function(handle_tool_error=True,
        func=apollo_org_enrichment,
        name="apollo_org_enrichment",
        description="Look up company info: industry, employees, funding, revenue, location via Apollo.io. Pass domain OR organization_name — the tool auto-resolves the domain.",
    )


# ---------------------------------------------------------------------------
# Apollo People Enrichment
# ---------------------------------------------------------------------------

def create_apollo_people_tool(api_key: str):
    """Create Apollo.io people enrichment tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def apollo_people_enrichment(
        email: str = "",
        first_name: str = "",
        last_name: str = "",
        domain: str = "",
        linkedin_url: str = "",
        organization_name: str = "",
    ) -> str:
        """Enrich person data via Apollo.io. Provide email, or name+organization_name, or LinkedIn URL."""
        _breaker.check_or_raise("apollo", "hunter_email_finder")
        params: dict[str, Any] = {}
        if email:
            params["email"] = email
        if first_name:
            params["first_name"] = first_name
        if last_name:
            params["last_name"] = last_name
        if domain:
            params["domain"] = domain
        if linkedin_url:
            params["linkedin_url"] = linkedin_url
        if organization_name:
            params["organization_name"] = organization_name
            # Also try to provide domain from org name for better matching
            if not domain:
                guesses = _guess_domains(organization_name)
                if guesses:
                    params["domain"] = guesses[0]
        if not params:
            return "Provide email, name+organization_name, or linkedin_url."

        resp = requests.post(
            "https://api.apollo.io/api/v1/people/match",
            headers={"Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key},
            json=params,
            timeout=30,
        )
        if resp.status_code in (402, 403):
            _breaker.kill("apollo", "Apollo free plan limit reached (403)")
            raise ToolException("Apollo enrichment DEAD (free plan limit). Use hunter_email_finder instead.")
        if resp.status_code != 200:
            return f"Apollo error ({resp.status_code}): {resp.text[:300]}"

        person = resp.json().get("person", {})
        if not person:
            return "No person data found."

        lines = [f"**Name:** {person.get('first_name', '')} {person.get('last_name', '')}  *(Source: Apollo.io)*"]
        if person.get("title"):
            lines.append(f"**Title:** {person['title']}")
        if person.get("seniority"):
            lines.append(f"**Seniority:** {person['seniority']}")
        if person.get("email"):
            lines.append(f"**Email:** {person['email']}  *(verified by Apollo)*")
        if person.get("linkedin_url"):
            lines.append(f"**LinkedIn:** {person['linkedin_url']}")
        if person.get("organization", {}).get("name"):
            lines.append(f"**Company:** {person['organization']['name']}")
        if person.get("departments"):
            lines.append(f"**Department:** {', '.join(person['departments'])}")
        if person.get("city"):
            lines.append(f"**Location:** {person.get('city', '')}, {person.get('state', '')}, {person.get('country', '')}")

        emp_history = person.get("employment_history", [])
        if emp_history:
            lines.append("\n**Employment History:**")
            for eh in emp_history[:5]:
                lines.append(f"  - {eh.get('title', 'N/A')} at {eh.get('organization_name', 'N/A')}")

        return "\n".join(lines)

    return StructuredTool.from_function(handle_tool_error=True,
        func=apollo_people_enrichment,
        name="apollo_people_enrichment",
        description="Look up person info: title, seniority, email, LinkedIn, work history via Apollo.io.",
    )


# ---------------------------------------------------------------------------
# PDL Company Enrichment
# ---------------------------------------------------------------------------

def create_pdl_company_tool(api_key: str):
    """Create People Data Labs company enrichment tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def pdl_company_enrichment(website: str = "", name: str = "", linkedin_url: str = "") -> str:
        """Enrich company data via People Data Labs. Provide website domain, company name, or LinkedIn URL."""
        params: dict[str, str] = {}
        if website:
            params["website"] = website
        if name:
            params["name"] = name
        if linkedin_url:
            params["profile"] = linkedin_url
        if not params:
            return "Provide website, name, or linkedin_url."

        resp = requests.get(
            "https://api.peopledatalabs.com/v5/company/enrich",
            headers={"X-Api-Key": key, "Content-Type": "application/json"},
            params=params,
            timeout=30,
        )
        if resp.status_code != 200:
            return f"PDL error ({resp.status_code}): {resp.text[:300]}"

        data = resp.json()
        if data.get("status") != 200 and not data.get("name"):
            return f"No company data found. Status: {data.get('status')}"

        lines = [f"**Company:** {data.get('display_name') or data.get('name', 'N/A')}"]
        if data.get("website"):
            lines.append(f"**Website:** {data['website']}")
        if data.get("industry"):
            lines.append(f"**Industry:** {data['industry']}")
        if data.get("employee_count"):
            lines.append(f"**Employees:** {data['employee_count']}")
        if data.get("founded"):
            lines.append(f"**Founded:** {data['founded']}")
        if data.get("linkedin_url"):
            lines.append(f"**LinkedIn:** {data['linkedin_url']}")
        loc = data.get("location", {})
        if loc:
            loc_str = ", ".join(filter(None, [loc.get("locality"), loc.get("region"), loc.get("country")]))
            if loc_str:
                lines.append(f"**Location:** {loc_str}")
        if data.get("tags"):
            lines.append(f"**Tags:** {', '.join(data['tags'][:10])}")
        if data.get("total_funding_raised"):
            lines.append(f"**Total Funding:** ${data['total_funding_raised']:,.0f}")

        return "\n".join(lines)

    return StructuredTool.from_function(handle_tool_error=True,
        func=pdl_company_enrichment,
        name="pdl_company_enrichment",
        description="Look up company info via People Data Labs: industry, size, funding, location, tags.",
    )


# ---------------------------------------------------------------------------
# PDL Person Enrichment
# ---------------------------------------------------------------------------

def create_pdl_person_tool(api_key: str):
    """Create People Data Labs person enrichment tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def pdl_person_enrichment(
        email: str = "",
        first_name: str = "",
        last_name: str = "",
        company: str = "",
        linkedin_url: str = "",
    ) -> str:
        """Enrich person data via People Data Labs. Provide email, name+company, or LinkedIn URL."""
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
        if not params:
            return "Provide email, name+company, or linkedin_url."
        params["min_likelihood"] = 5

        resp = requests.get(
            "https://api.peopledatalabs.com/v5/person/enrich",
            headers={"X-Api-Key": key, "Content-Type": "application/json"},
            params=params,
            timeout=30,
        )
        if resp.status_code != 200:
            return f"PDL error ({resp.status_code}): {resp.text[:300]}"

        data = resp.json().get("data", resp.json())
        if not data or not data.get("full_name"):
            return "No person data found."

        lines = [f"**Name:** {data.get('full_name', 'N/A')}"]
        if data.get("job_title"):
            lines.append(f"**Title:** {data['job_title']}")
        if data.get("job_company_name"):
            lines.append(f"**Company:** {data['job_company_name']}")
        if data.get("linkedin_url"):
            lines.append(f"**LinkedIn:** {data['linkedin_url']}")
        if data.get("work_email"):
            lines.append(f"**Work Email:** {data['work_email']}")
        if data.get("industry"):
            lines.append(f"**Industry:** {data['industry']}")
        if data.get("location_name"):
            lines.append(f"**Location:** {data['location_name']}")
        if data.get("phone_numbers") and isinstance(data["phone_numbers"], list):
            phones = data["phone_numbers"]
            for ph in phones[:3]:
                lines.append(f"**Phone:** {ph}")
        if data.get("mobile_phone"):
            lines.append(f"**Mobile:** {data['mobile_phone']}")
        if data.get("personal_emails") and isinstance(data["personal_emails"], list):
            for pe in data["personal_emails"][:2]:
                lines.append(f"**Personal Email:** {pe}")
        if data.get("skills"):
            lines.append(f"**Skills:** {', '.join(data['skills'][:10])}")

        experience = data.get("experience", [])
        if experience:
            lines.append("\n**Experience:**")
            for exp in experience[:5]:
                title = exp.get("title", {})
                company_info = exp.get("company", {})
                t_name = title.get("name", "N/A") if isinstance(title, dict) else str(title)
                c_name = company_info.get("name", "N/A") if isinstance(company_info, dict) else str(company_info)
                lines.append(f"  - {t_name} at {c_name}")

        return "\n".join(lines)

    return StructuredTool.from_function(handle_tool_error=True,
        func=pdl_person_enrichment,
        name="pdl_person_enrichment",
        description="Look up person info via PDL: title, company, work email, phone numbers, mobile number, LinkedIn, skills, work history. BEST source for phone numbers — always call this for leadership contacts.",
    )


# ---------------------------------------------------------------------------
# Hunter Email Finder
# ---------------------------------------------------------------------------

def create_hunter_email_finder_tool(api_key: str):
    """Create Hunter.io email finder tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def hunter_email_finder(first_name: str = "", last_name: str = "", domain: str = "", company: str = "") -> str:
        """Find a person's email address using Hunter.io. Provide first_name + last_name + domain or company name."""
        if not first_name and not last_name:
            return "Provide first_name and last_name."

        # Build list of domains to try
        domains_to_try = []
        if domain:
            domains_to_try.append(domain)
        if company:
            domains_to_try.extend(_guess_domains(company))
        # Deduplicate
        domains_to_try = list(dict.fromkeys(domains_to_try))

        if not domains_to_try and not company:
            return "Provide domain or company."

        # Try each domain until we find an email
        for d in domains_to_try:
            params: dict[str, str] = {"api_key": key}
            if first_name:
                params["first_name"] = first_name
            if last_name:
                params["last_name"] = last_name
            params["domain"] = d

            resp = requests.get("https://api.hunter.io/v2/email-finder", params=params, timeout=30)
            if resp.status_code != 200:
                continue

            data = resp.json().get("data", {})
            if data and data.get("email"):
                lines = [
                    f"**Email Found:** {data.get('email', 'N/A')}",
                    f"**Confidence Score:** {data.get('score', 'N/A')}%",
                    f"**Source:** Hunter.io (domain: {d})",
                ]
                if data.get("first_name"):
                    lines.append(f"**Name:** {data.get('first_name', '')} {data.get('last_name', '')}")
                if data.get("position"):
                    lines.append(f"**Position:** {data['position']}")
                if data.get("company"):
                    lines.append(f"**Company:** {data['company']}")
                if data.get("verification", {}).get("status"):
                    lines.append(f"**Verification Status:** {data['verification']['status']}")
                return "\n".join(lines)

        tried = ", ".join(domains_to_try[:3])
        return f"No email found via Hunter.io (tried domains: {tried}). The email may have been found by Apollo instead."

    return StructuredTool.from_function(handle_tool_error=True,
        func=hunter_email_finder,
        name="hunter_email_finder",
        description="Find a person's email by name + company domain via Hunter.io.",
    )


# ---------------------------------------------------------------------------
# Hunter Domain Search
# ---------------------------------------------------------------------------

def create_hunter_domain_search_tool(api_key: str):
    """Create Hunter.io domain search tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def hunter_domain_search(domain: str = "", company: str = "", department: str = "", seniority: str = "") -> str:
        """Find all email addresses at a company using Hunter.io. Provide domain (e.g. ramp.com)."""
        params: dict[str, Any] = {"api_key": key, "limit": 10}
        if domain:
            params["domain"] = domain
        elif company:
            params["company"] = company
        else:
            return "Provide a domain or company name."
        if department:
            params["department"] = department
        if seniority:
            params["seniority"] = seniority

        resp = requests.get("https://api.hunter.io/v2/domain-search", params=params, timeout=30)
        if resp.status_code != 200:
            return f"Hunter error ({resp.status_code}): {resp.text[:300]}"

        data = resp.json().get("data", {})
        lines = [
            f"**Domain:** {data.get('domain', 'N/A')}",
            f"**Organization:** {data.get('organization', 'N/A')}",
            f"**Email Pattern:** {data.get('pattern', 'N/A')}",
        ]

        emails = data.get("emails", [])
        if emails:
            lines.append(f"\n**Found {len(emails)} contacts:**")
            for e in emails:
                name = f"{e.get('first_name', '')} {e.get('last_name', '')}".strip()
                lines.append(f"\n  **{name or 'Unknown'}**")
                lines.append(f"  Email: {e.get('value', 'N/A')} (confidence: {e.get('confidence', 'N/A')}%)")
                if e.get("position"):
                    lines.append(f"  Position: {e['position']}")
                if e.get("seniority"):
                    lines.append(f"  Seniority: {e['seniority']}")
                if e.get("department"):
                    lines.append(f"  Department: {e['department']}")
        else:
            lines.append("No emails found.")

        return "\n".join(lines)

    return StructuredTool.from_function(handle_tool_error=True,
        func=hunter_domain_search,
        name="hunter_domain_search",
        description="Find all email addresses at a company by domain via Hunter.io. Returns contacts with confidence scores.",
    )


# ---------------------------------------------------------------------------
# Apollo People Search (discover employees at a company)
# ---------------------------------------------------------------------------

def create_apollo_people_search_tool(api_key: str):
    """Create Apollo.io people search tool — finds employees at a company."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def _format_people(people: list, organization_name: str, domain: str, page: int, total: int) -> str:
        label = organization_name or domain
        lines = [f"**Found {total} employees at {label}** (showing {len(people)}):\n"]
        for i, p in enumerate(people, 1):
            name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            lines.append(f"### {i}. {name or 'Unknown'}")
            if p.get("title"):
                lines.append(f"  **Title:** {p['title']}")
            if p.get("email"):
                lines.append(f"  **Email:** {p['email']}")
            if p.get("seniority"):
                lines.append(f"  **Seniority:** {p['seniority']}")
            if p.get("departments"):
                lines.append(f"  **Department:** {', '.join(p['departments'])}")
            if p.get("linkedin_url"):
                lines.append(f"  **LinkedIn:** {p['linkedin_url']}")
            if p.get("city") or p.get("country"):
                loc_parts = [p.get("city"), p.get("state"), p.get("country")]
                lines.append(f"  **Location:** {', '.join(x for x in loc_parts if x)}")
            if p.get("phone_numbers"):
                phones = p["phone_numbers"]
                if isinstance(phones, list) and phones:
                    phone_str = phones[0].get("sanitized_number", "") if isinstance(phones[0], dict) else str(phones[0])
                    if phone_str:
                        lines.append(f"  **Phone:** {phone_str}")
            lines.append("")
        if total > len(people):
            lines.append(f"_Call again with page={page + 1} to see more results._")
        return "\n".join(lines)

    def apollo_people_search(
        organization_name: str = "",
        domain: str = "",
        person_titles: str = "",
        person_seniorities: str = "",
        departments: str = "",
        page: int = 1,
        per_page: int = 25,
    ) -> str:
        """Search for employees at a company via Apollo.io. Provide organization_name or domain. Optionally filter by title keywords, seniority (senior, manager, director, vp, c_suite, owner, founder), or department (engineering, sales, marketing, finance, hr, operations, legal, support, executive). Call multiple times with different seniority filters (e.g., first c_suite,vp,director then manager,senior) to get a complete team picture."""
        headers = {"Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": key}

        # Resolve domains
        domains = []
        if domain:
            domains.append(domain)
        if organization_name:
            domains.extend(_guess_domains(organization_name))
        domains = list(dict.fromkeys(domains))  # dedupe

        if not domains and not organization_name:
            return "Provide organization_name or domain."

        # Build common payload parts
        filters: dict[str, Any] = {"page": page, "per_page": min(per_page, 25)}
        if domains:
            filters["organization_domains[]"] = domains[:3]
        if organization_name:
            filters["organization_name"] = organization_name
        if person_titles:
            filters["person_titles[]"] = [t.strip() for t in person_titles.split(",")]
        if person_seniorities:
            filters["person_seniorities[]"] = [s.strip() for s in person_seniorities.split(",")]
        if departments:
            filters["person_departments[]"] = [d.strip() for d in departments.split(",")]

        # Try multiple endpoints — /mixed_people/search first, then /people/search as fallback
        endpoints = [
            "https://api.apollo.io/api/v1/mixed_people/search",
            "https://api.apollo.io/v1/mixed_people/search",
        ]

        for endpoint in endpoints:
            try:
                resp = requests.post(endpoint, headers=headers, json=filters, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    people = data.get("people", [])
                    total = data.get("pagination", {}).get("total_entries", 0)
                    if people:
                        return _format_people(people, organization_name, domain, page, total)
            except Exception:
                continue

        # Final fallback: use organization search + people match
        if organization_name or domains:
            # Try to get org ID first, then search people by org ID
            org_domain = domains[0] if domains else ""
            try:
                org_resp = requests.get(
                    "https://api.apollo.io/api/v1/organizations/enrich",
                    headers=headers,
                    params={"domain": org_domain} if org_domain else {"name": organization_name},
                    timeout=30,
                )
                if org_resp.status_code == 200:
                    org = org_resp.json().get("organization", {})
                    org_id = org.get("id")
                    if org_id:
                        search_payload = {
                            "organization_ids[]": [org_id],
                            "page": page,
                            "per_page": min(per_page, 25),
                        }
                        if person_titles:
                            search_payload["person_titles[]"] = [t.strip() for t in person_titles.split(",")]
                        if person_seniorities:
                            search_payload["person_seniorities[]"] = [s.strip() for s in person_seniorities.split(",")]
                        if departments:
                            search_payload["person_departments[]"] = [d.strip() for d in departments.split(",")]

                        people_resp = requests.post(
                            "https://api.apollo.io/api/v1/mixed_people/search",
                            headers=headers,
                            json=search_payload,
                            timeout=30,
                        )
                        if people_resp.status_code == 200:
                            data = people_resp.json()
                            people = data.get("people", [])
                            total = data.get("pagination", {}).get("total_entries", 0)
                            if people:
                                return _format_people(people, organization_name, domain, page, total)
            except Exception:
                pass

        return f"No employees found for '{organization_name or domain}' via Apollo search. Try hunter_domain_search or web search instead."

    return StructuredTool.from_function(handle_tool_error=True,
        func=apollo_people_search,
        name="apollo_people_search",
        description=(
            "Search for employees at a company via Apollo.io. Returns names, titles, emails, "
            "LinkedIn URLs, seniority, and departments. Filter by title, seniority, or department. "
            "Supports pagination. Call multiple times with different filters to get complete coverage "
            "(e.g., first call with seniority=c_suite,vp,director, then seniority=manager,senior)."
        ),
    )


# ---------------------------------------------------------------------------
# PDL Company People Search (discover employees via PDL)
# ---------------------------------------------------------------------------

def create_pdl_people_search_tool(api_key: str):
    """Create People Data Labs person search tool — finds employees at a company."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def pdl_people_search(
        company_name: str = "",
        company_domain: str = "",
        job_title: str = "",
        job_title_role: str = "",
        page_size: int = 25,
    ) -> str:
        """Search for people at a company via People Data Labs. Provide company_name or company_domain. Optionally filter by job_title (e.g. 'CEO') or job_title_role (e.g. 'engineering', 'sales', 'marketing', 'operations', 'finance', 'human_resources', 'executive')."""
        if not company_name and not company_domain:
            return "Provide company_name or company_domain."

        # Build an Elasticsearch DSL query for PDL
        must_clauses = []
        if company_domain:
            must_clauses.append({"term": {"job_company_website": company_domain}})
        if company_name:
            must_clauses.append({"match": {"job_company_name": company_name}})
        if job_title:
            must_clauses.append({"match": {"job_title": job_title}})
        if job_title_role:
            must_clauses.append({"term": {"job_title_role": job_title_role}})

        payload = {
            "query": {"bool": {"must": must_clauses}},
            "size": min(page_size, 100),
        }

        try:
            resp = requests.post(
                "https://api.peopledatalabs.com/v5/person/search",
                headers={"X-Api-Key": key, "Content-Type": "application/json"},
                json=payload,
                timeout=30,
            )
            if resp.status_code != 200:
                return f"PDL search error ({resp.status_code}): {resp.text[:300]}"

            data = resp.json()
            people = data.get("data", [])
            total = data.get("total", 0)

            if not people:
                return f"No employees found for '{company_name or company_domain}' via PDL."

            label = company_name or company_domain
            lines = [f"**Found {total} employees at {label} via PDL** (showing {len(people)}):\n"]

            for i, p in enumerate(people, 1):
                name = p.get("full_name", "Unknown")
                lines.append(f"### {i}. {name}")
                if p.get("job_title"):
                    lines.append(f"  **Title:** {p['job_title']}")
                if p.get("work_email"):
                    lines.append(f"  **Work Email:** {p['work_email']}")
                elif p.get("emails") and isinstance(p["emails"], list):
                    work_emails = [e.get("address", "") for e in p["emails"] if e.get("type") == "current_professional"]
                    if work_emails:
                        lines.append(f"  **Work Email:** {work_emails[0]}")
                if p.get("job_title_role"):
                    lines.append(f"  **Department:** {p['job_title_role']}")
                if p.get("job_title_levels") and isinstance(p["job_title_levels"], list):
                    lines.append(f"  **Seniority:** {', '.join(p['job_title_levels'])}")
                if p.get("linkedin_url"):
                    lines.append(f"  **LinkedIn:** {p['linkedin_url']}")
                if p.get("location_name"):
                    lines.append(f"  **Location:** {p['location_name']}")
                if p.get("phone_numbers") and isinstance(p["phone_numbers"], list):
                    lines.append(f"  **Phone:** {p['phone_numbers'][0]}")
                lines.append("")

            return "\n".join(lines)

        except Exception as e:
            return f"PDL search error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=pdl_people_search,
        name="pdl_people_search",
        description=(
            "Search for employees at a company via People Data Labs. Returns names, titles, work emails, "
            "LinkedIn URLs, seniority, and departments. Powerful alternative to Apollo — "
            "covers 2.8B+ profiles. Filter by job_title or job_title_role (department)."
        ),
    )


# ---------------------------------------------------------------------------
# Apify LinkedIn Company Employees Scraper
# ---------------------------------------------------------------------------

def create_apify_linkedin_employees_tool(api_key: str):
    """Create Apify LinkedIn company employees scraper tool using harvestapi/linkedin-company-employees."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def apify_linkedin_company_employees(
        company_linkedin_url: str,
        max_results: int = 50,
        seniority_filter: str = "",
        function_filter: str = "",
    ) -> str:
        """Scrape employees from a LinkedIn company page using Apify. Provide the company LinkedIn URL like https://www.linkedin.com/company/klenty/. Optionally filter by seniority_filter (comma-separated IDs: 310=CXO, 300=VP, 220=Director, 210=Experienced Manager, 120=Senior, 110=Entry Level, 320=Owner/Partner) or function_filter (comma-separated IDs: 8=Engineering, 25=Sales, 15=Marketing, 12=HR, 18=Operations, 10=Finance, 19=Product Management)."""
        if not company_linkedin_url:
            return "Provide a company LinkedIn URL (e.g. https://www.linkedin.com/company/klenty/)."

        # Normalize URL
        url = company_linkedin_url.strip().rstrip("/")
        if not url.startswith("http"):
            url = f"https://www.linkedin.com/company/{url}"

        try:
            # Build input for harvestapi/linkedin-company-employees actor
            actor_input: dict[str, Any] = {
                "companies": [url],
                "maxItems": min(max_results, 100),
                "profileScraperMode": "Full + email search ($12 per 1k)",
                "companyBatchMode": "all_at_once",
            }

            if seniority_filter:
                actor_input["seniorityLevelIds"] = [s.strip() for s in seniority_filter.split(",")]
            if function_filter:
                actor_input["functionIds"] = [f.strip() for f in function_filter.split(",")]

            # Start the actor run
            resp = requests.post(
                "https://api.apify.com/v2/acts/harvestapi~linkedin-company-employees/runs",
                params={"token": key},
                json=actor_input,
                timeout=30,
            )
            if resp.status_code not in (200, 201):
                return f"Apify error starting actor ({resp.status_code}): {resp.text[:300]}"

            run_data = resp.json().get("data", {})
            run_id = run_data.get("id")
            if not run_id:
                return "Failed to start Apify actor run."

            # Wait for the run to finish (poll with timeout)
            import time
            dataset_id = run_data.get("defaultDatasetId")
            status = run_data.get("status", "RUNNING")

            for _ in range(60):  # max 5 minutes
                if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                    break
                time.sleep(5)
                check = requests.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": key},
                    timeout=15,
                )
                if check.status_code == 200:
                    run_info = check.json().get("data", {})
                    status = run_info.get("status", "RUNNING")
                    dataset_id = run_info.get("defaultDatasetId", dataset_id)

            if status != "SUCCEEDED":
                return f"Apify run ended with status: {status}. Try again or use a different data source."

            # Fetch results from dataset
            if not dataset_id:
                return "No dataset found for the run."

            items_resp = requests.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": key, "format": "json", "limit": max_results},
                timeout=30,
            )
            if items_resp.status_code != 200:
                return f"Error fetching results ({items_resp.status_code}): {items_resp.text[:300]}"

            items = items_resp.json()
            if not items:
                return f"No employees found for {url}."

            lines = [f"**Found {len(items)} employees from LinkedIn via Apify ({url}):**\n"]
            for i, emp in enumerate(items, 1):
                # Handle various output field names from the actor
                name = (
                    emp.get("fullName")
                    or emp.get("name")
                    or f"{emp.get('firstName', '')} {emp.get('lastName', '')}".strip()
                    or "Unknown"
                )
                lines.append(f"### {i}. {name}")

                title = emp.get("title") or emp.get("headline") or emp.get("jobTitle") or emp.get("currentJobTitle", "")
                if title:
                    lines.append(f"  **Title:** {title}")

                profile = emp.get("profileUrl") or emp.get("linkedInUrl") or emp.get("url") or emp.get("linkedinUrl", "")
                if profile:
                    lines.append(f"  **LinkedIn:** {profile}")

                location = emp.get("location") or emp.get("geoLocation") or emp.get("locationName", "")
                if location:
                    lines.append(f"  **Location:** {location}")

                # Email fields (if profileScraperMode includes email search)
                email = emp.get("email") or emp.get("workEmail", "")
                if email:
                    lines.append(f"  **Email:** {email}")

                # Company info
                company = emp.get("companyName") or emp.get("company", "")
                if company:
                    lines.append(f"  **Company:** {company}")

                lines.append("")

            return "\n".join(lines)

        except Exception as e:
            return f"Apify error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=apify_linkedin_company_employees,
        name="apify_linkedin_company_employees",
        description=(
            "Scrape all employees from a LinkedIn company page using Apify (harvestapi/linkedin-company-employees). "
            "Provide the LinkedIn company URL. Returns names, titles, LinkedIn profiles, locations, and optionally emails. "
            "Supports seniority and department filters. No LinkedIn cookies needed."
        ),
    )


# ---------------------------------------------------------------------------
# Apify Social Media Finder (find X/Twitter, Instagram, GitHub, etc.)
# ---------------------------------------------------------------------------

def create_apify_social_finder_tool(api_key: str):
    """Create Apify social media profile finder tool — finds X, Instagram, GitHub, etc."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def apify_find_social_profiles(names: str, platforms: str = "twitter,instagram,github,facebook,linkedin,medium,youtube") -> str:
        """Find social media profiles for given person names using Apify. Provide comma-separated names (e.g., 'Vidit Paliwal,Niranjan Mangal'). Optionally specify platforms (default: twitter,instagram,github,facebook,linkedin,medium,youtube). Returns profile URLs across platforms."""
        _breaker.check_or_raise("apify", "tavily_search")
        if not names:
            return "Provide comma-separated person names."

        name_list = [n.strip() for n in names.split(",") if n.strip()]

        # Map platform names
        platform_map = {
            "twitter": "threads",  # actor uses "threads" for X/Twitter-like
            "x": "threads",
            "instagram": "instagram",
            "github": "github",
            "facebook": "facebook",
            "linkedin": "linkedin",
            "medium": "medium",
            "youtube": "youtube",
            "tiktok": "tiktok",
            "pinterest": "pinterest",
            "discord": "discord",
            "twitch": "twitch",
        }
        selected = []
        for p in platforms.split(","):
            mapped = platform_map.get(p.strip().lower())
            if mapped:
                selected.append(mapped)
        if not selected:
            selected = ["threads", "instagram", "github", "facebook", "linkedin", "medium", "youtube"]

        try:
            resp = requests.post(
                "https://api.apify.com/v2/acts/tri_angle~social-media-finder/runs",
                params={"token": key},
                json={"profileNames": name_list, "socials": selected},
                timeout=30,
            )
            if resp.status_code not in (200, 201):
                if resp.status_code in (402, 403):
                    _breaker.kill("apify", f"Apify limit exceeded ({resp.status_code})")
                    raise ToolException("Apify DEAD (limit exceeded). Use tavily_search instead.")
                return f"Apify error ({resp.status_code}): {resp.text[:300]}"

            run_data = resp.json().get("data", {})
            run_id = run_data.get("id")
            dataset_id = run_data.get("defaultDatasetId")
            status = run_data.get("status", "RUNNING")

            import time
            for _ in range(40):  # max ~3 min
                if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                    break
                time.sleep(4)
                check = requests.get(f"https://api.apify.com/v2/actor-runs/{run_id}", params={"token": key}, timeout=15)
                if check.status_code == 200:
                    info = check.json().get("data", {})
                    status = info.get("status", "RUNNING")
                    dataset_id = info.get("defaultDatasetId", dataset_id)

            if status != "SUCCEEDED":
                return f"Social finder ended with status: {status}."

            items_resp = requests.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": key, "format": "json", "limit": 200},
                timeout=30,
            )
            if items_resp.status_code != 200:
                return f"Error fetching results: {items_resp.text[:300]}"

            items = items_resp.json()
            if not items:
                return f"No social profiles found for: {', '.join(name_list)}"

            lines = [f"**Social profiles found for {len(name_list)} people:**\n"]
            for item in items:
                query = item.get("query", "Unknown")
                platform = item.get("social", "")
                url = item.get("url", "")
                exists = item.get("exists", False)
                if exists and url:
                    lines.append(f"  - **{query}** on {platform}: {url}")

            return "\n".join(lines) if len(lines) > 1 else f"No active social profiles found for: {', '.join(name_list)}"

        except Exception as e:
            return f"Social finder error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=apify_find_social_profiles,
        name="apify_find_social_profiles",
        description=(
            "Find social media profiles (X/Twitter, Instagram, GitHub, Facebook, LinkedIn, YouTube, Medium, TikTok) "
            "for given person names using Apify. Provide comma-separated names. Returns profile URLs across platforms. No cookies needed."
        ),
    )


# ---------------------------------------------------------------------------
# Apify X/Twitter User Tweets (get recent tweets)
# ---------------------------------------------------------------------------

def create_apify_twitter_tweets_tool(api_key: str):
    """Create Apify X/Twitter user tweets scraper tool — no cookies needed."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def apify_get_twitter_tweets(username: str, max_pages: int = 1) -> str:
        """Get recent tweets from an X/Twitter user. Provide the username (without @). No cookies needed. Returns tweet text, engagement metrics, and dates."""
        if not username:
            return "Provide a Twitter/X username (without @)."

        username = username.strip().lstrip("@")

        try:
            resp = requests.post(
                "https://api.apify.com/v2/acts/patient_discovery~twitter-user-tweets/runs",
                params={"token": key},
                json={"userId": username, "maxPages": min(max_pages, 3)},
                timeout=30,
            )
            if resp.status_code not in (200, 201):
                return f"Apify error ({resp.status_code}): {resp.text[:300]}"

            run_data = resp.json().get("data", {})
            run_id = run_data.get("id")
            dataset_id = run_data.get("defaultDatasetId")
            status = run_data.get("status", "RUNNING")

            import time
            for _ in range(30):
                if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                    break
                time.sleep(4)
                check = requests.get(f"https://api.apify.com/v2/actor-runs/{run_id}", params={"token": key}, timeout=15)
                if check.status_code == 200:
                    info = check.json().get("data", {})
                    status = info.get("status", "RUNNING")
                    dataset_id = info.get("defaultDatasetId", dataset_id)

            if status != "SUCCEEDED":
                return f"Twitter scraper ended with status: {status}."

            items_resp = requests.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": key, "format": "json", "limit": 20},
                timeout=30,
            )
            if items_resp.status_code != 200:
                return f"Error fetching tweets: {items_resp.text[:300]}"

            items = items_resp.json()
            if not items:
                return f"No tweets found for @{username}."

            lines = [f"**Recent tweets from @{username}** ({len(items)} tweets):\n"]
            for i, tweet in enumerate(items[:10], 1):
                text = tweet.get("text") or tweet.get("full_text") or tweet.get("content", "")
                likes = tweet.get("favorite_count") or tweet.get("likes", 0)
                retweets = tweet.get("retweet_count") or tweet.get("retweets", 0)
                date = tweet.get("created_at") or tweet.get("date", "")

                lines.append(f"**{i}.** {text[:200]}")
                lines.append(f"   Likes: {likes} | Retweets: {retweets} | Date: {date}")
                lines.append("")

            return "\n".join(lines)

        except Exception as e:
            return f"Twitter error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=apify_get_twitter_tweets,
        name="apify_get_twitter_tweets",
        description=(
            "Get recent tweets from an X/Twitter user using Apify. Provide username (without @). "
            "Returns tweet text, likes, retweets, and dates. No cookies needed."
        ),
    )


# ---------------------------------------------------------------------------
# Apify LinkedIn Profile Posts Scraper (get recent posts from a LinkedIn profile)
# ---------------------------------------------------------------------------

def create_apify_linkedin_posts_tool(api_key: str):
    """Create Apify LinkedIn profile posts scraper tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def apify_get_linkedin_posts(profile_url: str, max_posts: int = 10) -> str:
        """Scrape recent posts from a LinkedIn profile. You can provide either a profile URL (https://www.linkedin.com/in/username) or a post URL (https://www.linkedin.com/posts/username_...) — the username will be extracted automatically. Returns post text, engagement (likes/comments), and dates."""
        _breaker.check_or_raise("apify", "tavily_search")

        if not profile_url:
            return "Provide a LinkedIn profile URL (e.g., https://www.linkedin.com/in/username/)."

        profile_url = profile_url.strip().rstrip("/")

        # If given a post URL (/posts/username_...), extract the username and convert to profile URL
        import re
        post_match = re.search(r"linkedin\.com/posts/([a-zA-Z0-9_-]+?)(?:_|%)", profile_url)
        if post_match:
            username = post_match.group(1)
            profile_url = f"https://www.linkedin.com/in/{username}"

        # Extract the expected username from profile URL for validation
        expected_username = ""
        in_match = re.search(r"linkedin\.com/in/([a-zA-Z0-9_-]+)", profile_url)
        if in_match:
            expected_username = in_match.group(1).lower()

        if "/in/" not in profile_url and "/company/" not in profile_url:
            profile_url = f"https://www.linkedin.com/in/{profile_url}"

        try:
            resp = requests.post(
                "https://api.apify.com/v2/acts/apimaestro~linkedin-profile-posts/runs",
                params={"token": key},
                json={
                    "profileUrls": [profile_url],
                    "maxPosts": min(max_posts, 20),
                },
                timeout=30,
            )
            if resp.status_code in (402, 403):
                _breaker.kill("apify", f"Apify limit exceeded ({resp.status_code})")
                raise ToolException("Apify DEAD (limit exceeded). Use tavily_search instead.")
            if resp.status_code not in (200, 201):
                return f"Apify error ({resp.status_code}): {resp.text[:300]}"

            run_data = resp.json().get("data", {})
            run_id = run_data.get("id")
            dataset_id = run_data.get("defaultDatasetId")
            status = run_data.get("status", "RUNNING")

            import time
            for _ in range(45):
                if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                    break
                time.sleep(4)
                check = requests.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": key},
                    timeout=15,
                )
                if check.status_code == 200:
                    info = check.json().get("data", {})
                    status = info.get("status", "RUNNING")
                    dataset_id = info.get("defaultDatasetId", dataset_id)

            if status != "SUCCEEDED":
                return f"LinkedIn posts scraper ended with status: {status}."

            items_resp = requests.get(
                f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                params={"token": key, "format": "json", "limit": 20},
                timeout=30,
            )
            if items_resp.status_code != 200:
                return f"Error fetching posts: {items_resp.text[:300]}"

            items = items_resp.json()
            if not items:
                return f"No posts found for {profile_url}."

            # VALIDATION: Detect if Apify returned wrong profile data (e.g. Satya Nadella default)
            # Check if any returned post URL contains the expected username
            if expected_username:
                matched_any = False
                for item in items[:5]:
                    post_url = item.get("postUrl") or item.get("url") or item.get("shareUrl", "")
                    author_url = item.get("authorProfileUrl") or item.get("profileUrl") or ""
                    if expected_username in post_url.lower() or expected_username in author_url.lower():
                        matched_any = True
                        break
                if not matched_any:
                    _breaker.kill("apify", f"Apify returned wrong profile data (not {expected_username})")
                    raise ToolException(f"Apify DEAD (returned wrong profile, not {expected_username}). Use tavily_search instead.")

            lines = [f"**Recent LinkedIn posts from {profile_url}** ({len(items)} posts):\n"]
            for i, post in enumerate(items[:10], 1):
                text = post.get("text") or post.get("postText") or post.get("commentary") or post.get("content", "")
                likes = post.get("numLikes") or post.get("likes") or post.get("likeCount", 0)
                comments = post.get("numComments") or post.get("comments") or post.get("commentCount", 0)
                date = post.get("postedDate") or post.get("date") or post.get("postedAt") or post.get("publishedAt", "")
                post_url = post.get("postUrl") or post.get("url") or post.get("shareUrl", "")

                text_preview = text[:300] if text else "(media/shared post)"
                lines.append(f"**{i}.** {text_preview}")
                lines.append(f"   Likes: {likes} | Comments: {comments} | Date: {date}")
                if post_url:
                    lines.append(f"   URL: {post_url}")
                lines.append("")

            return "\n".join(lines)

        except Exception as e:
            return f"LinkedIn posts error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=apify_get_linkedin_posts,
        name="apify_get_linkedin_posts",
        description=(
            "Scrape recent posts from a LinkedIn profile using Apify. Provide the full LinkedIn profile URL "
            "(e.g., https://www.linkedin.com/in/username/). Returns post text, likes, comments, dates, and post URLs. "
            "Great for finding recent activity to personalize outreach messages."
        ),
    )


# ---------------------------------------------------------------------------
# BrightData LinkedIn Posts Scraper (PREFERRED — simpler, more reliable)
# ---------------------------------------------------------------------------

def create_brightdata_linkedin_posts_tool(api_token: str):
    """Create BrightData LinkedIn posts scraper — synchronous, single API call, no polling."""
    if not api_token or not api_token.strip():
        return None

    token = api_token.strip()

    def brightdata_get_linkedin_posts(profile_url: str) -> str:
        """Scrape recent LinkedIn posts from a person's profile using BrightData. Provide a LinkedIn profile URL (https://www.linkedin.com/in/username) or a post URL (the username will be extracted). Returns post text, dates, likes, comments, and post URLs. THIS IS THE MOST RELIABLE LinkedIn scraper — prefer it over Apify."""
        _breaker.check_or_raise("brightdata", "tavily_search")
        if not profile_url:
            return "Provide a LinkedIn profile URL (e.g., https://www.linkedin.com/in/username/)."

        profile_url = profile_url.strip().rstrip("/")

        # If given a post URL, extract username and convert to profile URL
        import re
        post_match = re.search(r"linkedin\.com/posts/([a-zA-Z0-9_-]+?)(?:_|%)", profile_url)
        if post_match:
            username = post_match.group(1)
            profile_url = f"https://www.linkedin.com/in/{username}"

        if "/in/" not in profile_url and "/company/" not in profile_url:
            profile_url = f"https://www.linkedin.com/in/{profile_url}"

        try:
            # BrightData synchronous scrape — single call, results inline
            resp = requests.post(
                "https://api.brightdata.com/datasets/v3/trigger",
                params={
                    "dataset_id": "gd_lyy3tktm25m4avu764",
                    "format": "json",
                    "uncompressed_webhook": "true",
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=[{"url": profile_url}],
                timeout=60,
            )

            if resp.status_code in (401, 403):
                _breaker.kill("brightdata", f"BrightData auth error ({resp.status_code})")
                raise ToolException(f"BrightData DEAD ({resp.status_code}). Use tavily_search instead.")
            if resp.status_code == 402:
                return "BrightData credits exhausted. Add funds at brightdata.com."

            if resp.status_code not in (200, 201):
                return f"BrightData error ({resp.status_code}): {resp.text[:300]}"

            data = resp.json()

            # If async response with snapshot_id, poll for results
            snapshot_id = None
            if isinstance(data, dict) and data.get("snapshot_id"):
                snapshot_id = data["snapshot_id"]
            elif isinstance(data, list) and data:
                # Synchronous — data returned directly
                items = data
            else:
                # Try to extract snapshot_id from response
                snapshot_id = data.get("snapshot_id") if isinstance(data, dict) else None
                if not snapshot_id:
                    return f"Unexpected BrightData response: {str(data)[:300]}"

            if snapshot_id:
                import time
                items = []
                for _ in range(30):
                    time.sleep(5)
                    progress_resp = requests.get(
                        f"https://api.brightdata.com/datasets/v3/progress/{snapshot_id}",
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=15,
                    )
                    if progress_resp.status_code == 200:
                        progress = progress_resp.json()
                        status = progress.get("status", "running")
                        if status == "ready":
                            result_resp = requests.get(
                                f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}",
                                params={"format": "json"},
                                headers={"Authorization": f"Bearer {token}"},
                                timeout=30,
                            )
                            if result_resp.status_code == 200:
                                items = result_resp.json() if isinstance(result_resp.json(), list) else []
                            break
                        elif status in ("failed", "error"):
                            return f"BrightData scraping failed: {progress.get('message', 'unknown error')}"

                if not items:
                    return f"BrightData timeout — no results returned for {profile_url}."

            if not items:
                return f"No posts found for {profile_url}."

            # Filter and format posts — only last 14 days
            from datetime import datetime, timedelta
            cutoff = datetime.now() - timedelta(days=14)

            lines = [f"**Recent LinkedIn posts from {profile_url}** ({len(items)} posts found):\n"]
            count = 0
            for post in items:
                date_str = post.get("date_posted") or post.get("postedDate") or post.get("date", "")
                post_date = None
                if date_str:
                    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%B %d, %Y", "%m/%d/%Y"):
                        try:
                            post_date = datetime.strptime(date_str.split(".")[0].split("+")[0], fmt)
                            break
                        except (ValueError, AttributeError):
                            continue

                # Skip old posts
                if post_date and post_date < cutoff:
                    continue

                count += 1
                if count > 10:
                    break

                text = post.get("post_text") or post.get("text") or post.get("title") or ""
                likes = post.get("num_likes") or post.get("likes") or 0
                comments = post.get("num_comments") or post.get("comments") or 0
                post_url = post.get("url") or post.get("post_url") or ""
                date_display = date_str or "unknown"

                text_preview = text[:300] if text else "(media/shared post)"
                lines.append(f"**{count}.** {text_preview}")
                lines.append(f"   Likes: {likes} | Comments: {comments} | Date: {date_display}")
                if post_url:
                    lines.append(f"   URL: {post_url}")
                lines.append("")

            if count == 0:
                return f"No recent posts (last 14 days) found for {profile_url}."

            return "\n".join(lines)

        except requests.exceptions.Timeout:
            return f"BrightData request timed out for {profile_url}. Try again."
        except Exception as e:
            return f"BrightData error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=brightdata_get_linkedin_posts,
        name="brightdata_get_linkedin_posts",
        description=(
            "Scrape recent LinkedIn posts from a profile using BrightData (MOST RELIABLE). "
            "Provide a LinkedIn profile URL (https://www.linkedin.com/in/username) or a post URL. "
            "Returns post text, dates, likes, comments, post URLs. Auto-filters to last 14 days. "
            "Prefer this over apify_get_linkedin_posts."
        ),
    )


# ---------------------------------------------------------------------------
# BrightData LinkedIn Profile Enrichment
# ---------------------------------------------------------------------------

def create_brightdata_linkedin_profile_tool(api_token: str):
    """Create BrightData LinkedIn profile enrichment — get name, title, company, about, experience."""
    if not api_token or not api_token.strip():
        return None

    token = api_token.strip()

    def brightdata_get_linkedin_profile(profile_url: str) -> str:
        """Enrich a person using their LinkedIn profile via BrightData. Provide a LinkedIn profile URL or post URL. Returns name, title, company, location, about, experience, followers. More reliable than Apollo for LinkedIn data."""
        _breaker.check_or_raise("brightdata", "hunter_email_finder or tavily_search")
        if not profile_url:
            return "Provide a LinkedIn profile URL."

        profile_url = profile_url.strip().rstrip("/")

        import re
        post_match = re.search(r"linkedin\.com/posts/([a-zA-Z0-9_-]+?)(?:_|%)", profile_url)
        if post_match:
            username = post_match.group(1)
            profile_url = f"https://www.linkedin.com/in/{username}"

        if "/in/" not in profile_url:
            profile_url = f"https://www.linkedin.com/in/{profile_url}"

        try:
            resp = requests.post(
                "https://api.brightdata.com/datasets/v3/trigger",
                params={
                    "dataset_id": "gd_l1viktl72bvl7bjuj0",
                    "format": "json",
                    "uncompressed_webhook": "true",
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=[{"url": profile_url}],
                timeout=60,
            )

            if resp.status_code in (400, 401, 402, 403):
                _breaker.kill("brightdata", f"BrightData error ({resp.status_code}): {resp.text[:100]}")
                raise ToolException(f"BrightData DEAD ({resp.status_code}). Use hunter_email_finder or tavily_search.")
            if resp.status_code not in (200, 201):
                return f"BrightData error ({resp.status_code}): {resp.text[:300]}"

            data = resp.json()

            # Handle async with snapshot_id
            if isinstance(data, dict) and data.get("snapshot_id"):
                import time
                snapshot_id = data["snapshot_id"]
                items = []
                for _ in range(30):
                    time.sleep(5)
                    progress_resp = requests.get(
                        f"https://api.brightdata.com/datasets/v3/progress/{snapshot_id}",
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=15,
                    )
                    if progress_resp.status_code == 200:
                        progress = progress_resp.json()
                        if progress.get("status") == "ready":
                            result_resp = requests.get(
                                f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}",
                                params={"format": "json"},
                                headers={"Authorization": f"Bearer {token}"},
                                timeout=30,
                            )
                            if result_resp.status_code == 200:
                                items = result_resp.json() if isinstance(result_resp.json(), list) else []
                            break
                        elif progress.get("status") in ("failed", "error"):
                            return "BrightData profile scraping failed."
                if not items:
                    return "BrightData timeout for profile."
                person = items[0] if items else {}
            elif isinstance(data, list) and data:
                person = data[0]
            else:
                return f"No profile data returned for {profile_url}."

            if not person:
                return f"No profile data for {profile_url}."

            lines = [f"**Name:** {person.get('name', 'N/A')}  *(Source: BrightData/LinkedIn)*"]
            if person.get("position"):
                lines.append(f"**Title:** {person['position']}")
            if person.get("current_company"):
                company = person["current_company"]
                if isinstance(company, dict):
                    lines.append(f"**Company:** {company.get('name', 'N/A')}")
                    if company.get("url"):
                        lines.append(f"**Company LinkedIn:** {company['url']}")
                else:
                    lines.append(f"**Company:** {company}")

            # Extract email from any known field BrightData might return
            email = (
                person.get("email")
                or person.get("email_address")
                or person.get("personal_email")
                or person.get("work_email")
            )
            # Also check contact_info dict
            contact_info = person.get("contact_info") or person.get("contact") or {}
            if isinstance(contact_info, dict):
                email = email or contact_info.get("email") or contact_info.get("email_address")
                if contact_info.get("phone"):
                    lines.append(f"**Phone:** {contact_info['phone']}")
                if contact_info.get("twitter"):
                    lines.append(f"**Twitter:** {contact_info['twitter']}")
                if contact_info.get("website"):
                    lines.append(f"**Website:** {contact_info['website']}")
            if email:
                lines.append(f"**Email:** {email}")

            if person.get("city") or person.get("country_code"):
                lines.append(f"**Location:** {person.get('city', '')}, {person.get('country_code', '')}")
            if person.get("about"):
                lines.append(f"**About:** {str(person['about'])[:300]}")
            if person.get("followers"):
                lines.append(f"**Followers:** {person['followers']}")
            if person.get("connections"):
                lines.append(f"**Connections:** {person['connections']}")

            experience = person.get("experience", [])
            if experience and isinstance(experience, list):
                lines.append("\n**Experience:**")
                for exp in experience[:5]:
                    if isinstance(exp, dict):
                        title = exp.get("title", "N/A")
                        company_name = exp.get("company", "N/A")
                        lines.append(f"  - {title} at {company_name}")

            return "\n".join(lines)

        except Exception as e:
            return f"BrightData profile error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=brightdata_get_linkedin_profile,
        name="brightdata_get_linkedin_profile",
        description=(
            "Enrich a person from their LinkedIn profile via BrightData. Returns name, title, company, "
            "location, about, followers, experience. Provide profile URL or post URL. "
            "More reliable than Apollo for LinkedIn-based enrichment."
        ),
    )


# ---------------------------------------------------------------------------
# NeverBounce Email Verify
# ---------------------------------------------------------------------------

def create_neverbounce_tool(api_key: str):
    """Create NeverBounce email verification tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def neverbounce_email_verify(email: str) -> str:
        """Verify if an email is valid and deliverable using NeverBounce."""
        if not email:
            return "No email provided."

        params = {"key": key, "email": email.strip().replace("+", "%2B"), "address_info": 1, "timeout": 10}
        resp = requests.get("https://api.neverbounce.com/v4.2/single/check", params=params, timeout=60)
        if resp.status_code != 200:
            return f"NeverBounce error ({resp.status_code}): {resp.text[:300]}"

        data = resp.json()
        result_map = {0: "valid", 1: "invalid", 2: "disposable", 3: "catchall", 4: "unknown"}
        result_code = data.get("result", 4)
        status = result_map.get(result_code, "unknown")

        lines = [f"**Email:** {email}", f"**Status:** {status}"]
        flags = data.get("flags", [])
        if flags:
            lines.append(f"**Flags:** {', '.join(flags)}")
        addr_info = data.get("address_info", {})
        if addr_info:
            if addr_info.get("has_dns"):
                lines.append(f"**Has DNS:** {addr_info['has_dns']}")
            if addr_info.get("has_dns_mx"):
                lines.append(f"**Has MX Record:** {addr_info['has_dns_mx']}")

        return "\n".join(lines)

    return StructuredTool.from_function(handle_tool_error=True,
        func=neverbounce_email_verify,
        name="neverbounce_email_verify",
        description="Verify email deliverability: valid, invalid, disposable, catchall, or unknown.",
    )


# ---------------------------------------------------------------------------
# Firecrawl Scrape
# ---------------------------------------------------------------------------

def create_firecrawl_tool(api_key: str):
    """Create Firecrawl web scraping tool."""
    if not api_key or not api_key.strip():
        return None

    key = api_key.strip()

    def firecrawl_scrape(url: str) -> str:
        """Scrape a web page and return its content as markdown using Firecrawl."""
        if not url:
            return "No URL provided."

        resp = requests.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"url": url, "formats": ["markdown"], "onlyMainContent": True},
            timeout=60,
        )
        if resp.status_code != 200:
            return f"Firecrawl error ({resp.status_code}): {resp.text[:300]}"

        data = resp.json().get("data", {})
        markdown = data.get("markdown", "")
        if not markdown:
            return "No content extracted."

        # Truncate if too long
        if len(markdown) > 5000:
            markdown = markdown[:5000] + "\n\n[...content truncated...]"

        title = data.get("metadata", {}).get("title", "")
        return f"**Page: {title}**\n**URL:** {url}\n\n{markdown}" if title else markdown

    return StructuredTool.from_function(handle_tool_error=True,
        func=firecrawl_scrape,
        name="firecrawl_scrape",
        description="Scrape any web page URL and get its content as clean markdown. Great for company websites, pricing pages, about pages.",
    )


# ---------------------------------------------------------------------------
# SendGrid Email Sender
# ---------------------------------------------------------------------------

def create_sendgrid_tool(api_key: str, sender_email: str):
    """Create SendGrid email sending tool."""
    if not api_key or not api_key.strip():
        return None
    if not sender_email or not sender_email.strip():
        return None

    key = api_key.strip()
    from_email = sender_email.strip()

    def sendgrid_send_email(
        to_email: str,
        to_name: str = "",
        subject: str = "",
        body: str = "",
    ) -> str:
        """Send an email via SendGrid. Provide to_email, subject, and body (plain text or HTML)."""
        if not to_email or not subject or not body:
            return "Error: to_email, subject, and body are all required."

        # Detect if body contains HTML
        is_html = "<" in body and ">" in body

        payload = {
            "personalizations": [
                {
                    "to": [{"email": to_email.strip(), "name": to_name.strip() or to_email.strip()}],
                    "subject": subject.strip(),
                }
            ],
            "from": {"email": from_email},
            "content": [
                {
                    "type": "text/html" if is_html else "text/plain",
                    "value": body,
                }
            ],
        }

        try:
            resp = requests.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=30,
            )

            if resp.status_code in (200, 201, 202):
                return (
                    f"**Email sent successfully!**\n"
                    f"- **To:** {to_name} <{to_email}>\n"
                    f"- **Subject:** {subject}\n"
                    f"- **Status:** Delivered to SendGrid (status {resp.status_code})\n"
                    f"- **From:** {from_email}"
                )
            else:
                error_detail = resp.text[:300] if resp.text else "No details"
                return (
                    f"**Email failed to send.**\n"
                    f"- **Status:** {resp.status_code}\n"
                    f"- **Error:** {error_detail}\n"
                    f"- Check your SendGrid API key and verified sender email."
                )
        except Exception as e:
            return f"SendGrid error: {str(e)}"

    return StructuredTool.from_function(handle_tool_error=True,
        func=sendgrid_send_email,
        name="sendgrid_send_email",
        description=(
            "Send an email via SendGrid. Use this AFTER writing the email to actually deliver it. "
            "Provide to_email, to_name, subject, and body (the email text)."
        ),
    )


# ---------------------------------------------------------------------------
# Helper: build tools from a key map
# ---------------------------------------------------------------------------

def build_tools_from_keys(
    *,
    tavily_api_key: str = "",
    apollo_api_key: str = "",
    pdl_api_key: str = "",
    hunter_api_key: str = "",
    neverbounce_api_key: str = "",
    firecrawl_api_key: str = "",
    sendgrid_api_key: str = "",
    sendgrid_sender_email: str = "",
    apify_api_key: str = "",
    brightdata_api_token: str = "",
    include_duckduckgo: bool = True,
    include_apollo_org: bool = False,
    include_apollo_people: bool = False,
    include_apollo_people_search: bool = False,
    include_pdl_company: bool = False,
    include_pdl_person: bool = False,
    include_hunter_finder: bool = False,
    include_hunter_domain: bool = False,
    include_apify_linkedin_employees: bool = False,
    include_apify_social_finder: bool = False,
    include_apify_twitter_tweets: bool = False,
    include_apify_linkedin_posts: bool = False,
    include_pdl_people_search: bool = False,
    include_brightdata_linkedin_posts: bool = False,
    include_brightdata_linkedin_profile: bool = False,
) -> list:
    """Build a list of tools from provided API keys. Only creates tools for non-empty keys."""
    # Reset circuit breaker for each new agent run
    global _breaker
    _breaker = _CircuitBreaker()
    tools = []

    # Only add DuckDuckGo if Tavily is NOT available (avoid giving model 2 search tools)
    if tavily_api_key:
        t = create_tavily_tool(tavily_api_key)
        if t:
            tools.append(t)
    elif include_duckduckgo:
        t = create_duckduckgo_tool()
        if t:
            tools.append(t)

    if apollo_api_key and include_apollo_org:
        t = create_apollo_org_tool(apollo_api_key)
        if t:
            tools.append(t)

    if apollo_api_key and include_apollo_people:
        t = create_apollo_people_tool(apollo_api_key)
        if t:
            tools.append(t)

    if apollo_api_key and include_apollo_people_search:
        t = create_apollo_people_search_tool(apollo_api_key)
        if t:
            tools.append(t)

    if pdl_api_key and include_pdl_company:
        t = create_pdl_company_tool(pdl_api_key)
        if t:
            tools.append(t)

    if pdl_api_key and include_pdl_person:
        t = create_pdl_person_tool(pdl_api_key)
        if t:
            tools.append(t)

    if hunter_api_key and include_hunter_finder:
        t = create_hunter_email_finder_tool(hunter_api_key)
        if t:
            tools.append(t)

    if hunter_api_key and include_hunter_domain:
        t = create_hunter_domain_search_tool(hunter_api_key)
        if t:
            tools.append(t)

    if neverbounce_api_key:
        t = create_neverbounce_tool(neverbounce_api_key)
        if t:
            tools.append(t)

    if firecrawl_api_key:
        t = create_firecrawl_tool(firecrawl_api_key)
        if t:
            tools.append(t)

    if sendgrid_api_key and sendgrid_sender_email:
        t = create_sendgrid_tool(sendgrid_api_key, sendgrid_sender_email)
        if t:
            tools.append(t)

    if apify_api_key and include_apify_linkedin_employees:
        t = create_apify_linkedin_employees_tool(apify_api_key)
        if t:
            tools.append(t)

    if apify_api_key and include_apify_social_finder:
        t = create_apify_social_finder_tool(apify_api_key)
        if t:
            tools.append(t)

    if apify_api_key and include_apify_twitter_tweets:
        t = create_apify_twitter_tweets_tool(apify_api_key)
        if t:
            tools.append(t)

    if apify_api_key and include_apify_linkedin_posts:
        t = create_apify_linkedin_posts_tool(apify_api_key)
        if t:
            tools.append(t)

    if pdl_api_key and include_pdl_people_search:
        t = create_pdl_people_search_tool(pdl_api_key)
        if t:
            tools.append(t)

    if brightdata_api_token and include_brightdata_linkedin_posts:
        t = create_brightdata_linkedin_posts_tool(brightdata_api_token)
        if t:
            tools.append(t)

    if brightdata_api_token and include_brightdata_linkedin_profile:
        t = create_brightdata_linkedin_profile_tool(brightdata_api_token)
        if t:
            tools.append(t)

    return tools
