"""
ContactOut Service - Company & Contact Enrichment
Fills gaps in Crustdata data with ContactOut's extensive company/people data
"""
import httpx
import os
import logging
from typing import Dict, List, Optional, Any
import json
from typing import Iterable, List
from app.core.config import settings
from app.utils.contact_sanitization import sanitize_email_values, sanitize_phone_values

logger = logging.getLogger(__name__)


class ContactOutService:
    """
    Service for enriching company and contact data via ContactOut API.
    Used to supplement Crustdata's search results with:
    - Company details (phone, email, funding, etc.)
    - Contact information (blurred until user requests)
    """

    def __init__(self):
        self.api_key = settings.CONTACTOUT_API_KEY
        self.base_url = "https://api.contactout.com/v1"
        self.timeout = settings.CONTACTOUT_TIMEOUT
        
        # Debug: Print configured status
        print(f">>> ContactOutService: API key configured: {bool(self.api_key)}", flush=True)

    def _get_headers(self) -> Dict[str, str]:
        # ContactOut expects the API key as the `token` header and some endpoints
        # also accept/require a basic authorization header. Include both.
        return {
            "token": self.api_key,
            "authorization": "basic",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def _masked(self, headers: Dict[str, str]) -> Dict[str, str]:
        try:
            return {k: (v if k.lower() != 'token' else (v[:4] + '...' if v else '')) for k, v in headers.items()}
        except Exception:
            return {k: '***' for k in headers.keys()}

    async def _attempt_with_header_variants(self, client: httpx.AsyncClient, method: str, url: str, headers: Dict[str, str], **kwargs) -> httpx.Response:
        """Attempt request and on 401 try a small set of header variants."""
        # Initial attempt already performed by caller in most cases; provide general helper
        # Variants to try when a 401 is returned
        variants = []

        # 1: Authorization header value capitalized
        v1 = headers.copy()
        v1['authorization'] = 'Basic'
        variants.append(v1)

        # 2: Capitalize the token header name
        v2 = {('Token' if k.lower() == 'token' else k): v for k, v in headers.items()}
        variants.append(v2)

        # 3: Remove authorization header, just token
        v3 = headers.copy()
        v3.pop('authorization', None)
        variants.append(v3)

        # 4: Use Authorization: Basic and Token header
        v4 = {('Token' if k.lower() == 'token' else k): v for k, v in headers.items()}
        v4['Authorization'] = 'Basic'
        variants.append(v4)

        # 5: Minimal header with only token
        v5 = {'token': headers.get('token')}
        variants.append(v5)

        last_exc = None
        for idx, hv in enumerate(variants, start=1):
            try:
                print(f">>> ContactOut retry attempt {idx} with headers: {json.dumps(self._masked(hv))}", flush=True)
                if method.lower() == 'get':
                    resp = await client.get(url, headers=hv, **kwargs)
                elif method.lower() == 'post':
                    resp = await client.post(url, headers=hv, **kwargs)
                else:
                    raise ValueError("Unsupported method")

                print(f">>> ContactOut retry {idx} status: {resp.status_code}", flush=True)
                print(f">>> ContactOut retry {idx} body (truncated): {resp.text[:500]}", flush=True)
                resp.raise_for_status()
                return resp
            except httpx.HTTPStatusError as e:
                last_exc = e
                # if not 401, stop trying and re-raise
                if e.response is not None and e.response.status_code != 401:
                    raise
                # otherwise continue to next variant
                continue
        # All variants failed
        if last_exc:
            raise last_exc
        raise Exception("ContactOut: all header variants failed")

    # ──────────────────────────────────────────────────────────────────────────
    # Company Information from Domains
    # ──────────────────────────────────────────────────────────────────────────
    async def enrich_companies_by_domain(
        self,
        domains: List[str]
    ) -> Dict[str, Any]:
        """
        POST /domain/enrich
        Get detailed company info for up to 30 domains.
        Returns: revenue, type, founded_at, locations, etc.
        """
        try:
            domains = domains[:30]  # max 30 per request per docs

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                print(f">>> ContactOut: enriching {len(domains)} domains", flush=True)
                headers = self._get_headers()
                # Mask token for logs
                try:
                    masked = {k: (v if k.lower() != 'token' else (v[:4] + '...' if v else '')) for k, v in headers.items()}
                except Exception:
                    masked = {'token': '***'}
                print(f">>> ContactOut request headers: {json.dumps(masked)}", flush=True)

                response = await client.post(
                    f"{self.base_url}/domain/enrich",
                    headers=headers,
                    json={"domains": domains}
                )
                print(f">>> ContactOut response status: {response.status_code}", flush=True)
                print(f">>> ContactOut response body (truncated): {response.text[:1000]}", flush=True)
                try:
                    response.raise_for_status()
                    data = response.json()
                except httpx.HTTPStatusError as he:
                    # on 401 try header variants
                    if he.response is not None and he.response.status_code == 401:
                        resp = await self._attempt_with_header_variants(
                            client, 'post', f"{self.base_url}/domain/enrich", headers, json={"domains": domains}
                        )
                        data = resp.json()
                    else:
                        raise
                print(">>> ContactOut RAW RESPONSE:", json.dumps(data, indent=2), flush=True)
                companies = data.get("companies", [])
                print(f">>> ContactOut: got {len(companies)} enriched companies", flush=True)
                return data

        except httpx.HTTPStatusError as e:
            print(f">>> ContactOut HTTP error: {e.response.status_code} — {e.response.text[:300]}", flush=True)
            raise
        except Exception as e:
            print(f">>> ContactOut error: {e}", flush=True)
            raise

    # ──────────────────────────────────────────────────────────────────────────
    # Decision Makers (for Company Profile page)
    # ──────────────────────────────────────────────────────────────────────────
    async def get_decision_makers(
        self,
        domain: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        reveal_info: bool = False,
        page: int = 1
    ) -> Dict[str, Any]:
        """
        GET /people/decision-makers
        Get key decision makers for a company (for company profile page).
        
        reveal_info=False returns blurred contact info
        reveal_info=True charges credits and reveals email/phone
        """
        try:
            params = {"page": page, "reveal_info": str(reveal_info).lower()}
            if domain:
                params["domain"] = domain
            if linkedin_url:
                params["linkedin_url"] = linkedin_url
            print(f">>> ContactOut decision-makers params: {params}", flush=True)
            print(f">>> ContactOut decision-makers URL: {self.base_url}/people/decision-makers", flush=True)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = self._get_headers()
                try:
                    masked = {k: (v if k.lower() != 'token' else (v[:4] + '...' if v else '')) for k, v in headers.items()}
                except Exception:
                    masked = {'token': '***'}
                print(f">>> ContactOut request headers: {json.dumps(masked)} params: {params}", flush=True)

                response = await client.get(
                    f"{self.base_url}/people/decision-makers",
                    headers=headers,
                    params=params
                )

                print(f">>> DM status: {response.status_code}", flush=True)
                print(f">>> DM response body (truncated): {response.text[:1000]}", flush=True)
                try:
                    if response.status_code != 200:
                        print(f">>> DM error body: {response.text[:500]}", flush=True)
                    response.raise_for_status()
                    data = response.json()
                except httpx.HTTPStatusError as he:
                    if he.response is not None and he.response.status_code == 401:
                        resp = await self._attempt_with_header_variants(
                            client, 'get', f"{self.base_url}/people/decision-makers", headers, params=params
                        )
                        data = resp.json()
                    else:
                        raise
                print(f">>> DM got {len(data.get('profiles', {}))} profiles", flush=True)
                return data

        except httpx.HTTPStatusError as e:
            raise Exception(f"ContactOut DM HTTP {e.response.status_code}: {e.response.text}")
        except Exception as e:
            raise Exception(f"ContactOut decision makers failed: {str(e)}")

    # ──────────────────────────────────────────────────────────────────────────
    # Contact Info Reveal (when user clicks "Reveal")
    # ──────────────────────────────────────────────────────────────────────────
    async def reveal_contact_info(
        self,
        linkedin_url: str,
        include_phone: bool = True
    ) -> Dict[str, Any]:
        """
        GET /people/linkedin
        Reveal contact info for a specific person (charges credits).
        Called when user clicks "Reveal Contact" button.
        """
        try:
            # Validate: ContactOut /people/linkedin only works with personal profiles, not company pages
            if "/company/" in linkedin_url or "/school/" in linkedin_url:
                raise ValueError(
                    f"Cannot reveal contact info for a company/school LinkedIn page. "
                    f"A personal LinkedIn profile URL (linkedin.com/in/...) is required."
                )

            params = {
                "profile": linkedin_url,
                "include_phone": str(include_phone).lower()
            }

            print(f">>> ContactOut: revealing contact for LinkedIn: {linkedin_url}", flush=True)
            print(f">>> Params: {params}", flush=True)

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                headers = self._get_headers()
                try:
                    masked = {k: (v if k.lower() != 'token' else (v[:4] + '...' if v else '')) for k, v in headers.items()}
                except Exception:
                    masked = {'token': '***'}
                print(f">>> ContactOut request headers: {json.dumps(masked)} params: {params}", flush=True)

                response = await client.get(
                    f"{self.base_url}/people/linkedin",
                    headers=headers,
                    params=params
                )

                print(f">>> ContactOut reveal status: {response.status_code}", flush=True)
                try:
                    if response.status_code != 200:
                        print(f">>> ContactOut reveal error body: {response.text[:500]}", flush=True)
                    response.raise_for_status()
                    data = response.json()
                except httpx.HTTPStatusError as he:
                    if he.response is not None and he.response.status_code == 401:
                        resp = await self._attempt_with_header_variants(
                            client, 'get', f"{self.base_url}/people/linkedin", headers, params=params
                        )
                        data = resp.json()
                    else:
                        raise

                profile = data.get("profile", {})
                raw_emails = profile.get("email") or profile.get("emails") or []
                raw_phones = profile.get("phone") or profile.get("phones") or []
                if isinstance(raw_emails, str):
                    raw_emails = [raw_emails]
                if isinstance(raw_phones, str):
                    raw_phones = [raw_phones]

                sanitized_emails = sanitize_email_values(raw_emails)
                sanitized_phones = sanitize_phone_values(raw_phones)
                if sanitized_emails or sanitized_phones:
                    print(f">>> ContactOut: sanitized reveal {len(sanitized_emails)} emails, {len(sanitized_phones)} phones", flush=True)
                else:
                    print(f">>> ContactOut: reveal returned only placeholders", flush=True)

                return {
                    "profile": profile,
                    "sanitized_emails": sanitized_emails,
                    "sanitized_phones": sanitized_phones,
                }

        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            print(f">>> ContactOut reveal error: {e.response.status_code} - {error_detail[:300]}", flush=True)
            raise Exception(f"ContactOut reveal failed: {e.response.status_code} - {error_detail}")
        except Exception as e:
            print(f">>> ContactOut error: {str(e)}", flush=True)
            raise

    # ──────────────────────────────────────────────────────────────────────────
    # Normalizers  (map ContactOut → our schema)
    # ──────────────────────────────────────────────────────────────────────────
    @staticmethod
    def normalize_company_enrichment(raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map ContactOut /domain/enrich response → our company schema.
        Fills in fields that Crustdata doesn't provide.
        """
        # ContactOut wraps each company in a dict keyed by domain
        # e.g. {"contactout.com": {...actual company data...}}
        # We need to unwrap it
        if not raw:
            return {}

        # Get the first (and only) company object
        company_data = list(raw.values())[0] if isinstance(raw, dict) else raw

        return {
            # identity
            "domain":   company_data.get("domain", ""),
            "name":     company_data.get("name", ""),
            "website":  company_data.get("website", ""),

            # details Crustdata doesn't have
            "company_type":  company_data.get("type", ""),
            "founded_year":  company_data.get("founded_at"),
            "revenue_exact": company_data.get("revenue"),
            # Do NOT set employee_count_exact from 'size' (often a bucket code)

            # location
            "headquarters_country": company_data.get("country", ""),
            "headquarters_city":    (company_data.get("headquarter", "") or "").split(",")[0].strip(),

            # social / contact  ← NEW from ContactOut
            "linkedin_url": company_data.get("li_vanity", ""),

            # misc
            "description": company_data.get("description", ""),
            "industry":    company_data.get("industry", ""),
            "specialties": company_data.get("specialties", []),
            "locations":   company_data.get("locations", []),
            "logo_url":    company_data.get("logo_url", ""),

            "provider_source": "contactout",
            "raw_data": company_data,
        }

    @staticmethod
    def normalize_decision_maker(raw: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map ContactOut decision maker → our people schema.
        """
        company = raw.get("company", {})

        return {
            "full_name":    raw.get("full_name", ""),
            "linkedin_url": f"https://www.linkedin.com/in/{raw.get('li_vanity', '')}",
            "title":        raw.get("title", ""),
            "headline":     raw.get("headline", ""),

            # contact (blurred unless revealed)
            "contact_availability": raw.get("contact_availability", {}),
            "contact_info":         raw.get("contact_info", {}),

            # company
            "company_name":   company.get("name", ""),
            "company_domain": company.get("domain", ""),

            # misc
            "location":      raw.get("location", ""),
            "profile_picture_url": raw.get("profile_picture_url", ""),
            "job_function":  raw.get("job_function", ""),
            "seniority":     raw.get("seniority", ""),

            "provider_source": "contactout",
            "raw_data": raw,
        }
