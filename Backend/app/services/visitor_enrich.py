import httpx
import ipinfo
import logging
import re
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.explorium_service import ExploriumService
from app.services.bettercontact_service import BetterContactService
from app.services.contactout_service import ContactOutService

logger = logging.getLogger(__name__)

# Common ISP and Cloud Provider keywords to filter out of company identification
ISP_CLOUD_KEYWORDS = {
    "airtel", "bharti", "reliance", "jio", "vodafone", "telecom", "mobile", "broadband",
    "comcast", "verizon", "at&t", "spectrum", "charter", "infiniti", "google fiber",
    "isp", "internet service", "hosting", "cloud", "server", "data center", "vps",
    "proxad", "wanadoo", "orange", "telefonica", "t-mobile", "sprint", "nexmo", 
    "twilio", "ovh", "digitalocean", "linode", "amazon", "google inc", "microsoft corp",
    "akamai", "cloudflare", "fastly", "level 3", "cogent", "tata communications",
    "network foundation", "isp foundation", "hathway", "act fibernet", "bsnl", "mtnl",
    "centurylink", "cox", "optimum", "suddenlink", "frontier", "windstream",
    "hughesnet", "viasat", "starlink", "earthlink", "netzero", "juno",
    "hetzner", "leaseweb", "choopa", "vultr", "scaleway", "upcloud",
    "azure", "aws", "gcp", "alibaba", "oracle cloud", "ibm cloud",
    "rackspace", "softlayer", "bluehost", "hostgator", "dreamhost", "siteground",
    "godaddy", "namecheap", "wix", "squarespace", "fastweb", "sky broadband",
    "bt group", "talktalk", "virgin media", "telstra", "optus", "tpg", "shaw", "rogers", "telus"
}

def is_isp_or_cloud(org_name: str) -> bool:
    if not org_name:
        return False
    name_lower = org_name.lower()
    return any(keyword in name_lower for keyword in ISP_CLOUD_KEYWORDS)

class VisitorEnricher:
    def __init__(self):
        self.ipinfo_client = ipinfo.getHandler(settings.IPINFO_TOKEN) if hasattr(settings, 'IPINFO_TOKEN') else None
        self.enrich_api_key = getattr(settings, 'ENRICH_API_KEY', None)
        self.explorium = ExploriumService()
        self.bettercontact = BetterContactService()
        self.contactout = ContactOutService()
        
        # Debug API statuses
        logger.info(f"[VisitorEnricher] Configured: IPINFO={bool(self.ipinfo_client)}, "
                    f"ENRICH_SO={bool(self.enrich_api_key)}, "
                    f"EXPLORIUM={bool(self.explorium.api_key)}, "
                    f"BETTERCONTACT={bool(self.bettercontact.api_key)}, "
                    f"CONTACTOUT={bool(self.contactout.api_key)}")

    async def enrich_ip(self, ip: str, url: str, intent_score: float, email: Optional[str] = None) -> Dict[str, Any]:
        """
        Enrich visitor IP with company, person, email, phone, and other contact data.
        """
        resolution = {
            "ip": ip,
            "company": None,
            "domain": None,
            "geo": None,
            "confidence": 0.0,
            "person": None,
            "intent_score": intent_score,
            # Contact-level fields (flattened for easy access)
            "email": email,
            "phone": None,
            "full_name": None,
            "linkedin_url": None,
            "job_title": None,
        }
        if email:
            resolution["confidence"] = 0.5
            if "@" in email:
                domain = email.split("@")[-1].lower()
                # If it's not a common personal domain, use it as the company domain
                personal_domains = {"gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "mail.com"}
                if domain not in personal_domains:
                    resolution["domain"] = domain

        try:
            # ──────────────────────────────────────────────
            # 1. IPinfo lookup (Geo + Basic Company/ISP)
            # ──────────────────────────────────────────────
            if self.ipinfo_client:
                logger.info(f"[Enrichment] Step 1: IPinfo lookup for {ip}")
                try:
                    import asyncio
                    from functools import partial
                    loop = asyncio.get_event_loop()
                    details = await loop.run_in_executor(None, partial(self.ipinfo_client.getDetails, ip))

                    # org is "AS12345 Company Name" — strip the ASN prefix
                    raw_org = getattr(details, 'org', None) or ""
                    if raw_org.startswith("AS") and " " in raw_org:
                        org = raw_org.split(" ", 1)[1].strip()
                    else:
                        org = raw_org or None

                    # IPinfo paid plans expose a `company` dict with name + domain
                    company_attr = getattr(details, 'company', None)
                    if isinstance(company_attr, dict):
                        org = company_attr.get("name") or org
                        domain = company_attr.get("domain") or None
                    else:
                        domain = None

                    # hostname is usable only when it looks like a real domain (≤3 labels)
                    # e.g. "office.acme.com" is good; "123-45-67.broadband.isp.com" is not
                    hostname = getattr(details, 'hostname', None)
                    if not domain and hostname:
                        parts = hostname.strip(".").split(".")
                        # Keep if it has 2-3 labels and no IP octets (digits only segments)
                        has_ip_octets = any(p.isdigit() for p in parts)
                        if not has_ip_octets and 2 <= len(parts) <= 3:
                            domain = ".".join(parts[-2:])

                    city = getattr(details, 'city', None) or None
                    region = getattr(details, 'region', None) or None
                    country = getattr(details, 'country', None) or None

                    # ISP and Cloud Provider Filtering:
                    # If the organization matches our ISP/Cloud list, do NOT use it as the company name.
                    if is_isp_or_cloud(org) or is_isp_or_cloud(domain):
                        logger.info(f"[Enrichment] Filtered out ISP/Cloud organization: {org} (domain={domain})")
                        org = None
                        domain = None

                    logger.info(f"[Enrichment] IPinfo success: org={org}, domain={domain}, city={city}, country={country}")

                    # Only update confidence if we got usable data
                    got_data = bool(org or domain or city or country)
                    
                    # Update resolution, but PROTECT EXISTING DATA from email logic
                    if org:
                        resolution["company"] = org
                    if domain and not resolution.get("domain"):
                        resolution["domain"] = domain
                    
                    if city or country:
                        resolution["geo"] = {"city": city, "region": region, "country": country}
                    
                    if got_data:
                        resolution["confidence"] = max(resolution["confidence"], 0.4)
                except Exception as e:
                    logger.error(f"[Enrichment] IPinfo lookup failed: {e}")

            # ──────────────────────────────────────────────
            # 2. Enrich.so IP → Company
            # ──────────────────────────────────────────────
            should_enrich = bool(self.enrich_api_key)

            if should_enrich:
                logger.info(f"[Enrichment] Step 2: Enrich.so IP-to-Company for {ip}")
                enrich_data = await self._enrich_so_lookup(ip)

                if enrich_data and enrich_data.get("data"):
                    company_data = enrich_data["data"]
                    company_name = company_data.get("company_name") or ""
                    company_domain = company_data.get("company_domain") or ""

                    # Only use if NOT an ISP/cloud provider
                    if company_name and not is_isp_or_cloud(company_name) and not is_isp_or_cloud(company_domain):
                        resolution["company"] = company_name
                        if company_domain and not resolution.get("domain"):
                            resolution["domain"] = company_domain
                        
                        resolution["confidence"] = max(resolution["confidence"], 0.7)
                        # Store extra company info
                        resolution["enrich_company"] = company_data
                        logger.info(f"[Enrichment] Enrich.so IP found company: {company_name} ({company_domain})")
                    else:
                        logger.info(f"[Enrichment] Enrich.so IP returned ISP/cloud or empty: {company_name} — skipped")
                else:
                    logger.info(f"[Enrichment] Enrich.so IP returned no company data for {ip}")

            # ──────────────────────────────────────────────
            # 2b. Enrich.so Email → Person
            #     Enrich by email to get person details (name, LinkedIn, title, phone).
            #     Works for both work and personal emails.
            # ──────────────────────────────────────────────
            if resolution.get("email") and self.enrich_api_key:
                logger.info(f"[Enrichment] Step 2b: Enrich.so email lookup for {resolution['email']}")
                email_enrich = await self._enrich_so_email_lookup(resolution["email"])
                if email_enrich and email_enrich.get("data"):
                    person_data = email_enrich["data"]
                    resolution["person"] = person_data
                    resolution["confidence"] = max(resolution["confidence"], 0.8)

                    resolution["full_name"] = (
                        person_data.get("full_name") or
                        person_data.get("name") or
                        f"{person_data.get('first_name', '')} {person_data.get('last_name', '')}".strip()
                    ) or resolution.get("full_name")
                    resolution["phone"] = (
                        person_data.get("phone") or
                        person_data.get("mobile_phone") or
                        person_data.get("work_phone")
                    ) or resolution.get("phone")
                    resolution["linkedin_url"] = (
                        person_data.get("linkedin_url") or
                        person_data.get("linkedin") or
                        person_data.get("linkedin_profile_url")
                    ) or resolution.get("linkedin_url")
                    resolution["job_title"] = (
                        person_data.get("title") or
                        person_data.get("job_title") or
                        person_data.get("position")
                    ) or resolution.get("job_title")

                    if person_data.get("company_domain") and not resolution["domain"]:
                        resolution["domain"] = person_data["company_domain"]
                    if person_data.get("company_name") and not resolution["company"]:
                        resolution["company"] = person_data["company_name"]

                    logger.info(f"[Enrichment] Enrich.so email found: {resolution['full_name']}, domain={resolution.get('domain')}")
                else:
                    logger.info(f"[Enrichment] Enrich.so email lookup returned no data for {resolution['email']}")

            # ──────────────────────────────────────────────
            # 2c. BetterContact fallback (when Enrich.so email returned no/partial person data)
            #     Uses 20+ waterfall data sources to find name, LinkedIn, phone.
            #     Always attempt when we have email — BetterContact can enrich by email alone.
            # ──────────────────────────────────────────────
            needs_more_data = not resolution.get("full_name") or not resolution.get("phone") or not resolution.get("linkedin_url")
            if resolution.get("email") and needs_more_data and self.bettercontact.api_key:
                logger.info(f"[Enrichment] Step 2c: BetterContact fallback for {resolution['email']} "
                            f"(missing: name={not resolution.get('full_name')}, phone={not resolution.get('phone')}, linkedin={not resolution.get('linkedin_url')})")
                
                # Use name hints from resolution if available (found by previous steps)
                full_name = resolution.get("full_name") or ""
                first_name, last_name = ("", "")
                if " " in full_name:
                    parts = full_name.split(" ", 1)
                    first_name, last_name = parts[0], parts[1]
                else:
                    first_name = full_name

                bc_result = await self.bettercontact.enrich_prospect(
                    first_name=first_name,
                    last_name=last_name,
                    email=resolution["email"],
                    company_name=resolution.get("company") or "",
                    company_domain=resolution.get("domain") or "",
                    linkedin_url=resolution.get("linkedin_url") or "",
                )
                if bc_result.get("success"):
                    if bc_result.get("email") and not resolution.get("email"):
                        resolution["email"] = bc_result["email"]
                    if bc_result.get("phone") and not resolution.get("phone"):
                        resolution["phone"] = bc_result["phone"]
                    if bc_result.get("contact_name") and not resolution.get("full_name"):
                        resolution["full_name"] = bc_result["contact_name"]
                        resolution["confidence"] = max(resolution["confidence"], 0.6)
                    if bc_result.get("linkedin_url") and not resolution.get("linkedin_url"):
                        resolution["linkedin_url"] = bc_result["linkedin_url"]
                    if bc_result.get("contact_title") and not resolution.get("job_title"):
                        resolution["job_title"] = bc_result["contact_title"]
                    logger.info(f"[Enrichment] BetterContact result: name={resolution.get('full_name')}, "
                                f"phone={bool(resolution.get('phone'))}, linkedin={bool(resolution.get('linkedin_url'))}")
                else:
                    logger.info(f"[Enrichment] BetterContact returned no data: {bc_result.get('error')}")

            # ──────────────────────────────────────────────
            # 2d. ContactOut fallback (get decision makers by domain)
            # ──────────────────────────────────────────────
            if resolution.get("domain") and not resolution.get("full_name") and self.contactout.api_key:
                logger.info(f"[Enrichment] Step 2d: ContactOut fallback for domain {resolution['domain']}")
                try:
                    co_data = await self.contactout.get_decision_makers(domain=resolution["domain"], reveal_info=False)
                    profiles = co_data.get("profiles", {})
                    if profiles:
                        # Take first DM
                        dm = next(iter(profiles.values()))
                        normalized = ContactOutService.normalize_decision_maker(dm)
                        resolution["full_name"] = normalized.get("full_name") or resolution.get("full_name")
                        resolution["job_title"] = normalized.get("title") or resolution.get("job_title")
                        resolution["linkedin_url"] = normalized.get("linkedin_url") or resolution.get("linkedin_url")
                        logger.info(f"[Enrichment] ContactOut found DM: {resolution['full_name']}")
                except Exception as e:
                    logger.warning(f"[Enrichment] ContactOut fallback failed: {e}")

            # ──────────────────────────────────────────────
            # 3. Explorium (Company firmographics)
            #    Primary: lookup by domain
            #    Fallback: lookup by company name (when IPinfo returns org but no domain)
            # ──────────────────────────────────────────────
            async def _explorium_lookup_and_apply(filters: dict, label: str) -> bool:
                """Run Explorium search, validate result, update resolution. Returns True on success."""
                try:
                    explorium_data = await self.explorium.search_companies(filters, limit=1)
                    if not explorium_data.get("companies"):
                        return False
                    company = explorium_data["companies"][0]
                    company_domain = (company.get("domain") or "").strip().lower().lstrip("www.")
                    queried_domain = (filters.get("domain") or "").strip().lower()
                    # Domain validation only when we queried by domain
                    if queried_domain:
                        domain_ok = (
                            not company_domain
                            or company_domain == queried_domain
                            or queried_domain.endswith(f".{company_domain}")
                            or company_domain.endswith(f".{queried_domain}")
                        )
                        if not domain_ok:
                            logger.warning(
                                f"[Enrichment] Explorium domain mismatch ({label}): "
                                f"queried={queried_domain}, got={company_domain} ({company.get('name')}) — skipping"
                            )
                            return False
                    resolution["explorium"] = company
                    resolution["confidence"] = max(resolution["confidence"], 0.9)
                    resolution["company"] = company.get("name") or resolution["company"]
                    # Backfill domain from Explorium if we didn't have one
                    if not resolution["domain"] and company_domain:
                        resolution["domain"] = company_domain
                    if not resolution["linkedin_url"]:
                        resolution["linkedin_url"] = company.get("linkedin_url")
                    logger.info(f"[Enrichment] Explorium found ({label}): {company.get('name')} ({company_domain})")
                    return True
                except Exception as e:
                    logger.error(f"[Enrichment] Explorium lookup failed ({label}): {e}")
                    return False

            explorium_matched = False
            if resolution["domain"]:
                logger.info(f"[Enrichment] Step 3: Explorium domain lookup for {resolution['domain']}")
                explorium_matched = await _explorium_lookup_and_apply(
                    {"domain": resolution["domain"]}, f"domain={resolution['domain']}"
                )

            # Fallback: try by company name from IPinfo org field
            if not explorium_matched and resolution["company"]:
                logger.info(f"[Enrichment] Step 3b: Explorium name fallback for '{resolution['company']}'")
                await _explorium_lookup_and_apply(
                    {"name": resolution["company"]}, f"name={resolution['company']}"
                )

        except Exception as e:
            logger.error(f"[Enrichment] Visitor enrichment failed for IP {ip}: {e}")
        
        logger.info(f"[Enrichment] Final result for {ip}: company={resolution['company']}, "
                     f"email={resolution.get('email')}, confidence={resolution['confidence']}")
        return resolution






    async def _enrich_so_email_lookup(self, email: str) -> Optional[Dict[str, Any]]:
        """Call Enrich.so API for Email to Person lookup (GET /v1/api/person?email=)."""
        if not self.enrich_api_key:
            return None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.enrich.so/v1/api/person",
                    params={"email": email},
                    headers={
                        "Authorization": f"Bearer {self.enrich_api_key}",
                        "Content-Type": "application/json",
                    },
                    timeout=15.0,
                )
                if response.status_code == 200:
                    result = response.json()
                    # Normalize Enrich.so response to our standard person format
                    raw = result.get("data") or result
                    if isinstance(raw, dict) and (raw.get("displayName") or raw.get("firstName")):
                        person = {
                            "full_name": raw.get("displayName") or f"{raw.get('firstName', '')} {raw.get('lastName', '')}".strip(),
                            "first_name": raw.get("firstName") or "",
                            "last_name": raw.get("lastName") or "",
                            "email": email,
                            "work_email": raw.get("workEmail") or raw.get("work_email") or "",
                            "personal_email": raw.get("personalEmail") or raw.get("personal_email") or email,
                            "phone": raw.get("phoneNumber") or raw.get("phone") or "",
                            "linkedin_url": raw.get("linkedInProfileUrl") or raw.get("profileUrl") or raw.get("linkedin_url") or "",
                            "title": raw.get("headline") or raw.get("occupation") or raw.get("title") or "",
                            "job_title": raw.get("occupation") or raw.get("headline") or raw.get("title") or "",
                            "company_name": raw.get("companyName") or raw.get("company_name") or "",
                            "company_domain": raw.get("companyDomain") or raw.get("company_domain") or "",
                            "summary": raw.get("summary") or "",
                            "location": raw.get("location") or raw.get("geoLocation") or "",
                        }
                        return {"data": person}
                    return result
                else:
                    logger.warning(f"[Enrichment] Enrich.so email API error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"[Enrichment] Enrich.so email API call failed: {e}")
        return None

    async def _enrich_so_lookup(self, ip: str) -> Optional[Dict[str, Any]]:
        """
        Call Enrich.so IP to Company API (GET /v1/api/ip-to-company-lookup?ip=).
        Returns company data — Enrich.so does not have IP-to-person.
        """
        if not self.enrich_api_key:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.enrich.so/v1/api/ip-to-company-lookup",
                    params={"ip": ip},
                    headers={
                        "Authorization": f"Bearer {self.enrich_api_key}",
                        "Content-Type": "application/json",
                    },
                    timeout=15.0,
                )
                if response.status_code == 200:
                    result = response.json()
                    raw = result.get("data") or result
                    if isinstance(raw, dict) and (raw.get("companyName") or raw.get("name") or raw.get("domain")):
                        # Return in a format compatible with our enrichment flow
                        company_data = {
                            "company_name": raw.get("companyName") or raw.get("name") or "",
                            "company_domain": raw.get("domain") or raw.get("companyDomain") or "",
                            "industry": raw.get("industry") or "",
                            "employee_count": raw.get("employeeCount") or raw.get("employee_count") or "",
                            "linkedin_url": raw.get("linkedInUrl") or raw.get("linkedin_url") or "",
                            "website": raw.get("website") or "",
                            "description": raw.get("description") or "",
                        }
                        return {"data": company_data, "type": "company"}
                    return result
                else:
                    logger.warning(f"[Enrichment] Enrich.so IP API error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"[Enrichment] Enrich.so IP API call failed: {e}")

        return None
