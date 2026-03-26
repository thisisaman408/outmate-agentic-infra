"""
Employee Discovery Service — Company Domain -> Employee List.

Adds NEW data providers (Apollo, PDL, Apify) on top of what the visitor
enrichment pipeline already collects from ContactOut (step 4) and Hunter (step 5b).

This service does NOT call ContactOut or Hunter — those are already called
earlier in the pipeline and their results arrive via `existing_employees`.
This service only calls providers that the pipeline doesn't already use.

Provider list (only called if API key is set):
  1. Apollo.io    — People Search by company domain
  2. PDL          — People Data Labs company search
  3. Apify        — LinkedIn company employees scraper (harvestapi actor)

The `merge_and_build` method then combines these results with the existing
decision_makers from ContactOut/Hunter into a unified, deduplicated,
seniority-sorted `employees` list.

Output: list of employee dicts, each with:
  { full_name, job_title, email, linkedin_url, seniority, department, source }

Design: pure async, no DB access, no side-effects. The caller (visitor_enrich)
decides where to store the results.
"""

import asyncio
import httpx
import logging
from typing import Dict, Any, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Seniority keywords for rough classification when the API doesn't provide it
_C_SUITE = {"ceo", "cto", "cfo", "coo", "cmo", "cpo", "cio", "cro", "founder", "co-founder", "cofounder", "owner", "president", "partner"}
_VP = {"vp", "vice president", "svp", "evp", "avp"}
_DIRECTOR = {"director", "head of", "head,"}
_MANAGER = {"manager", "lead", "team lead", "supervisor"}


def _guess_seniority(title: str) -> str:
    """Infer seniority from job title string."""
    if not title:
        return "unknown"
    t = title.lower()
    if any(kw in t for kw in _C_SUITE):
        return "c_suite"
    if any(kw in t for kw in _VP):
        return "vp"
    if any(kw in t for kw in _DIRECTOR):
        return "director"
    if any(kw in t for kw in _MANAGER):
        return "manager"
    if "senior" in t or "sr." in t or "sr " in t or "staff" in t or "principal" in t:
        return "senior"
    return "individual"


def _guess_department(title: str) -> str:
    """Infer department from job title."""
    if not title:
        return "unknown"
    t = title.lower()
    dept_keywords = {
        "engineering": ["engineer", "developer", "devops", "sre", "architect", "software", "backend", "frontend", "fullstack", "full-stack", "data engineer", "ml engineer", "platform"],
        "sales": ["sales", "account executive", "business development", "bdr", "sdr", "revenue", "partnerships"],
        "marketing": ["marketing", "growth", "brand", "content", "seo", "demand gen", "communications", "pr "],
        "product": ["product manager", "product lead", "product owner", "product design"],
        "design": ["designer", "ux", "ui", "creative"],
        "hr": ["hr", "human resources", "people ops", "talent", "recruiting", "recruiter"],
        "finance": ["finance", "accounting", "controller", "treasury", "cfo"],
        "operations": ["operations", "ops", "supply chain", "logistics", "coo"],
        "legal": ["legal", "counsel", "compliance", "attorney"],
        "executive": ["ceo", "founder", "co-founder", "president", "managing director"],
        "customer_success": ["customer success", "customer support", "support", "client"],
    }
    for dept, keywords in dept_keywords.items():
        if any(kw in t for kw in keywords):
            return dept
    return "other"


def _normalize_employee(raw: Dict[str, Any], source: str) -> Dict[str, Any]:
    """Normalize an employee record to a standard shape."""
    full_name = (raw.get("full_name") or "").strip()
    job_title = (raw.get("job_title") or raw.get("title") or "").strip()
    email = (raw.get("email") or "").strip().lower()
    linkedin_url = (raw.get("linkedin_url") or "").strip()

    return {
        "full_name": full_name,
        "job_title": job_title,
        "email": email if "@" in email else "",
        "linkedin_url": linkedin_url,
        "seniority": raw.get("seniority") or _guess_seniority(job_title),
        "department": raw.get("department") or _guess_department(job_title),
        "source": source,
    }


def _dedup_employees(employees: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deduplicate employees by email (primary) or name (fallback).
    When two records match, merge — prefer the one with more data.
    """
    by_email: Dict[str, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}
    result = []

    for emp in employees:
        email = emp.get("email", "")
        name = emp.get("full_name", "").lower().strip()

        if not name and not email:
            continue

        # Check email dedup first
        if email and email in by_email:
            existing = by_email[email]
            _merge_into(existing, emp)
            continue

        # Check name dedup
        if name and name in by_name:
            existing = by_name[name]
            _merge_into(existing, emp)
            continue

        # New employee
        if email:
            by_email[email] = emp
        if name:
            by_name[name] = emp
        result.append(emp)

    return result


def _merge_into(existing: Dict[str, Any], new: Dict[str, Any]) -> None:
    """Merge new employee data into existing record (fill blanks, merge source)."""
    for key in ("email", "linkedin_url", "job_title", "seniority", "department"):
        if not existing.get(key) and new.get(key):
            existing[key] = new[key]
    # Merge source tags
    existing_src = existing.get("source", "")
    new_src = new.get("source", "")
    if new_src and new_src not in existing_src:
        existing["source"] = f"{existing_src}+{new_src}" if existing_src else new_src


# ── Seniority sort order (leadership first) ──────────────────────────────────
_SENIORITY_ORDER = {
    "c_suite": 0, "vp": 1, "director": 2, "manager": 3,
    "senior": 4, "individual": 5, "unknown": 6,
}


class EmployeeDiscoveryService:
    """
    Discovers employees at a company using NEW data providers (Apollo, PDL, Apify).

    Does NOT call ContactOut or Hunter — those are already called in
    visitor_enrich.py steps 4 and 5b. This service only adds providers
    that the existing pipeline doesn't use.
    """

    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        self.http = http_client or httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=5.0)
        )
        self._apollo_key = getattr(settings, "APOLLO_API_KEY", "") or ""
        self._pdl_key = getattr(settings, "PDL_API_KEY", "") or ""
        self._apify_key = getattr(settings, "APIFY_API_KEY", "") or ""

    @property
    def has_any_provider(self) -> bool:
        """Return True if at least one new provider is configured."""
        return bool(self._apollo_key or self._pdl_key or self._apify_key)

    async def discover_new_sources(
        self,
        domain: str,
        company_name: str = "",
        company_linkedin_url: str = "",
        max_results: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Find employees using Apollo, PDL, and Apify LinkedIn scraper.
        ContactOut/Hunter results should be passed to `merge_and_build` separately.
        `company_linkedin_url` is needed for Apify (e.g. https://linkedin.com/company/microsoft).
        """
        if not domain:
            return []

        max_results = min(max_results, 20)
        all_employees: List[Dict[str, Any]] = []
        sources_tried = []
        sources_succeeded = []

        # 1. Apollo People Search
        if self._apollo_key:
            sources_tried.append("apollo")
            try:
                apollo_results = await self._search_apollo(domain, max_results)
                all_employees.extend(apollo_results)
                if apollo_results:
                    sources_succeeded.append("apollo")
            except Exception as e:
                logger.warning("[EmployeeDiscovery] Apollo failed: %s", e)

        # 2. People Data Labs
        if self._pdl_key:
            sources_tried.append("pdl")
            try:
                pdl_results = await self._search_pdl(domain, company_name, max_results)
                all_employees.extend(pdl_results)
                if pdl_results:
                    sources_succeeded.append("pdl")
            except Exception as e:
                logger.warning("[EmployeeDiscovery] PDL failed: %s", e)

        # 3. Apify LinkedIn scraper (only if we have a LinkedIn company URL)
        if self._apify_key and company_linkedin_url:
            sources_tried.append("apify")
            try:
                apify_results = await self._search_apify(company_linkedin_url, max_results)
                all_employees.extend(apify_results)
                if apify_results:
                    sources_succeeded.append("apify")
            except Exception as e:
                logger.warning("[EmployeeDiscovery] Apify failed: %s", e)

        logger.info(
            "[EmployeeDiscovery] New sources for %s: tried=%s, succeeded=%s, found=%d",
            domain, sources_tried or ["none configured"], sources_succeeded, len(all_employees),
        )
        return all_employees

    @staticmethod
    def merge_and_build(
        existing_decision_makers: List[Dict[str, Any]],
        new_source_employees: List[Dict[str, Any]],
        max_results: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Merge employees from all sources into a single deduplicated list.

        `existing_decision_makers` = from ContactOut (step 4) and Hunter (step 5b),
            already in the resolution["decision_makers"] format.
        `new_source_employees` = from Apollo/PDL (this service), already normalized.

        Returns a seniority-sorted, deduplicated list.
        """
        # Normalize the existing decision_makers into the same shape
        normalized_existing = []
        for dm in existing_decision_makers:
            normalized_existing.append(_normalize_employee({
                "full_name": dm.get("full_name") or "",
                "job_title": dm.get("job_title") or "",
                "email": dm.get("email") or "",
                "linkedin_url": dm.get("linkedin_url") or "",
            }, source="pipeline"))

        combined = normalized_existing + new_source_employees
        if not combined:
            return []

        deduped = _dedup_employees(combined)
        deduped.sort(key=lambda e: _SENIORITY_ORDER.get(e.get("seniority", "unknown"), 6))

        return deduped[:min(max_results, 20)]

    # ─────────────────────────────────────────────────────────────────────────
    # Apollo.io — People Search
    # Docs: https://apolloio.github.io/apollo-api-docs/?shell#search-for-contacts
    # ─────────────────────────────────────────────────────────────────────────

    async def _search_apollo(self, domain: str, limit: int) -> List[Dict[str, Any]]:
        resp = await self.http.post(
            "https://api.apollo.io/v1/mixed_people/search",
            headers={"Content-Type": "application/json", "Cache-Control": "no-cache"},
            json={
                "api_key": self._apollo_key,
                "q_organization_domains": domain,
                "page": 1,
                "per_page": min(limit, 25),
                "person_seniorities": ["owner", "founder", "c_suite", "partner", "vp", "director", "manager"],
            },
        )
        if resp.status_code != 200:
            logger.info("[EmployeeDiscovery] Apollo HTTP %d for %s", resp.status_code, domain)
            return []

        data = resp.json()
        people = data.get("people") or []
        results = []
        for p in people:
            name = p.get("name") or f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            results.append(_normalize_employee({
                "full_name": name,
                "job_title": p.get("title") or p.get("headline"),
                "email": p.get("email"),
                "linkedin_url": p.get("linkedin_url"),
                "seniority": p.get("seniority"),
                "department": p.get("departments", [""])[0] if p.get("departments") else "",
            }, source="apollo"))

        logger.info("[EmployeeDiscovery] Apollo: %d people for %s", len(results), domain)
        return results

    # ─────────────────────────────────────────────────────────────────────────
    # People Data Labs — Person Search
    # Docs: https://docs.peopledatalabs.com/docs/person-search-api
    # ─────────────────────────────────────────────────────────────────────────

    async def _search_pdl(self, domain: str, company_name: str, limit: int) -> List[Dict[str, Any]]:
        # PDL uses Elasticsearch-style queries
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"term": {"job_company_website": domain}},
                    ]
                }
            },
            "size": min(limit, 20),
        }
        # If company name is available, add it as a should clause for better ranking
        if company_name:
            query["query"]["bool"]["should"] = [
                {"match": {"job_company_name": company_name}}
            ]

        resp = await self.http.post(
            "https://api.peopledatalabs.com/v5/person/search",
            headers={
                "X-Api-Key": self._pdl_key,
                "Content-Type": "application/json",
            },
            json=query,
        )
        if resp.status_code != 200:
            logger.info("[EmployeeDiscovery] PDL HTTP %d for %s", resp.status_code, domain)
            return []

        data = resp.json()
        people = data.get("data") or []
        results = []
        for p in people:
            name = p.get("full_name") or f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
            if not name:
                continue
            results.append(_normalize_employee({
                "full_name": name,
                "job_title": p.get("job_title"),
                "email": p.get("work_email") or (p.get("emails", [{}])[0].get("address") if p.get("emails") else ""),
                "linkedin_url": p.get("linkedin_url"),
                "department": p.get("job_title_sub_role") or p.get("job_company_industry"),
            }, source="pdl"))

        logger.info("[EmployeeDiscovery] PDL: %d people for %s", len(results), domain)
        return results

    # ─────────────────────────────────────────────────────────────────────────
    # Apify — LinkedIn Company Employees Scraper
    # Actor: harvestapi/linkedin-company-employees (no LinkedIn cookies needed)
    # Docs: https://apify.com/harvestapi/linkedin-company-employees
    #
    # Flow: start actor run → poll for completion (max 90s) → fetch dataset
    # Uses "Fast" scraper mode to minimize cost ($1.40 per 1k vs $12 for Full).
    # Only fetches leadership seniority to keep results relevant and cheap.
    # ─────────────────────────────────────────────────────────────────────────

    _APIFY_ACTOR = "harvestapi~linkedin-company-employees"
    _APIFY_POLL_INTERVAL = 5   # seconds between status checks
    _APIFY_MAX_WAIT = 90       # max seconds to wait for run completion

    async def _search_apify(self, company_linkedin_url: str, limit: int) -> List[Dict[str, Any]]:
        url = company_linkedin_url.strip().rstrip("/")
        if not url.startswith("http"):
            url = f"https://www.linkedin.com/company/{url}"

        # Start the actor run
        resp = await self.http.post(
            f"https://api.apify.com/v2/acts/{self._APIFY_ACTOR}/runs",
            params={"token": self._apify_key},
            json={
                "companies": [url],
                "maxItems": min(limit, 25),
                "profileScraperMode": "Fast ($1.40 per 1k)",
                "companyBatchMode": "all_at_once",
                # Only leadership — keeps results relevant and cost low
                "seniorityLevelIds": ["310", "300", "220", "210", "320"],
                # 310=CXO, 300=VP, 220=Director, 210=Manager, 320=Owner/Partner
            },
            timeout=httpx.Timeout(30.0),
        )
        if resp.status_code not in (200, 201):
            logger.info("[EmployeeDiscovery] Apify start failed: HTTP %d", resp.status_code)
            return []

        run_data = resp.json().get("data", {})
        run_id = run_data.get("id")
        dataset_id = run_data.get("defaultDatasetId")
        if not run_id:
            logger.warning("[EmployeeDiscovery] Apify: no run ID returned")
            return []

        # Poll for completion
        status = run_data.get("status", "RUNNING")
        elapsed = 0
        while status in ("RUNNING", "READY") and elapsed < self._APIFY_MAX_WAIT:
            await asyncio.sleep(self._APIFY_POLL_INTERVAL)
            elapsed += self._APIFY_POLL_INTERVAL
            try:
                check = await self.http.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": self._apify_key},
                    timeout=httpx.Timeout(10.0),
                )
                if check.status_code == 200:
                    run_info = check.json().get("data", {})
                    status = run_info.get("status", "RUNNING")
                    dataset_id = run_info.get("defaultDatasetId", dataset_id)
            except Exception:
                pass

        if status != "SUCCEEDED":
            logger.info("[EmployeeDiscovery] Apify run status=%s after %ds for %s", status, elapsed, url)
            return []

        # Fetch results from dataset
        if not dataset_id:
            return []

        items_resp = await self.http.get(
            f"https://api.apify.com/v2/datasets/{dataset_id}/items",
            params={"token": self._apify_key, "format": "json", "limit": limit},
            timeout=httpx.Timeout(15.0),
        )
        if items_resp.status_code != 200:
            logger.info("[EmployeeDiscovery] Apify dataset fetch failed: HTTP %d", items_resp.status_code)
            return []

        items = items_resp.json()
        if not isinstance(items, list):
            return []

        results = []
        for emp in items:
            name = (
                emp.get("fullName")
                or emp.get("name")
                or f"{emp.get('firstName', '')} {emp.get('lastName', '')}".strip()
            )
            if not name:
                continue
            results.append(_normalize_employee({
                "full_name": name,
                "job_title": emp.get("title") or emp.get("headline") or emp.get("jobTitle") or emp.get("currentJobTitle"),
                "email": emp.get("email") or emp.get("workEmail"),
                "linkedin_url": emp.get("profileUrl") or emp.get("linkedInUrl") or emp.get("url") or emp.get("linkedinUrl"),
            }, source="apify"))

        logger.info("[EmployeeDiscovery] Apify: %d people for %s (took %ds)", len(results), url, elapsed)
        return results
