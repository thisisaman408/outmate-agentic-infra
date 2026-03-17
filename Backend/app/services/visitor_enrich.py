import httpx
import ipinfo
import logging
import re
import os
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

                    # org is \"AS12345 Company Name\" — strip the ASN prefix
                    raw_org = getattr(details, 'org', None) or ""
                    if raw_org.startswith("AS") and " " in raw_org:
                        org = raw_org.split(" ", 1)[1].strip()
                    else:
                        org = raw_org or None

                    company_attr = getattr(details, 'company', None)
                    if isinstance(company_attr, dict):
                        org = company_attr.get("name") or org
                        domain = company_attr.get("domain") or None

                    hostname = getattr(details, 'hostname', None)
                    if not domain and hostname:
                        parts = hostname.strip(".").split(".")
                        has_ip_octets = any(p.isdigit() for p in parts)
                        if not has_ip_octets and 2 <= len(parts) <= 3:
                            domain = ".".join(parts[-2:])

                    city = getattr(details, 'city', None) or None
                    region = getattr(details, 'region', None) or None
                    country = getattr(details, 'country', None) or None

                    if is_isp_or_cloud(org) or is_isp_or_cloud(domain):
                        logger.info(f"[Enrichment] Filtered out ISP/Cloud organization: {org} (domain={domain})")
                        org = None
                        domain = None

                    if org:
                        resolution["company"] = org
                    if domain and not resolution.get("domain"):
                        resolution["domain"] = domain
                    if city or country:
                        resolution["geo"] = {"city": city, "region": region, "country": country}
                    
                    if org or domain or city or country:
                        resolution["confidence"] = max(resolution["confidence"], 0.4)
                except Exception as e:
                    logger.error(f"[Enrichment] IPinfo lookup failed: {e}")

            # ──────────────────────────────────────────────
            # 2. Enrich.so IP → Company
            # ──────────────────────────────────────────────
            if self.enrich_api_key:
                logger.info(f"[Enrichment] Step 2: Enrich.so IP-to-Company for {ip}")
                enrich_data = await self._enrich_so_lookup(ip)
                if enrich_data and enrich_data.get("data"):
                    company_data = enrich_data["data"]
                    company_name = company_data.get("company_name") or ""
                    company_domain = company_data.get("company_domain") or ""
                    if company_name and not is_isp_or_cloud(company_name) and not is_isp_or_cloud(company_domain):
                        resolution["company"] = company_name
                        if company_domain and not resolution.get("domain"):
                            resolution["domain"] = company_domain
                        resolution["confidence"] = max(resolution["confidence"], 0.7)
                        resolution["enrich_company"] = company_data
                        logger.info(f"[Enrichment] Step 2 success: found {company_name}")
                else:
                    logger.info(f"[Enrichment] Step 2: Enrich.so IP lookup returned no data")

            # ──────────────────────────────────────────────
            # 2b. Enrich.so Email → Person
            # ──────────────────────────────────────────────
            if resolution.get("email") and self.enrich_api_key:
                logger.info(f"[Enrichment] Step 2b: Enrich.so email lookup for {resolution['email']}")
                email_enrich = await self._enrich_so_email_lookup(resolution["email"])
                if email_enrich and email_enrich.get("data"):
                    person_data = email_enrich["data"]
                    resolution["person"] = person_data
                    resolution["confidence"] = max(resolution["confidence"], 0.8)
                    resolution["full_name"] = person_data.get("full_name") or person_data.get("name") or resolution.get("full_name")
                    resolution["phone"] = person_data.get("phone") or resolution.get("phone")
                    resolution["linkedin_url"] = person_data.get("linkedin_url") or person_data.get("linkedin") or resolution.get("linkedin_url")
                    resolution["job_title"] = person_data.get("job_title") or person_data.get("title") or resolution.get("job_title")
                    if person_data.get("company_domain") and not resolution.get("domain"):
                        resolution["domain"] = person_data["company_domain"]
                    logger.info(f"[Enrichment] Step 2b success: found {resolution['full_name']}")
                else:
                    logger.info(f"[Enrichment] Step 2b: Enrich.so email lookup NO data")

            # ──────────────────────────────────────────────
            # 2c. BetterContact fallback
            # ──────────────────────────────────────────────
            needs_more_data = not resolution.get("full_name") or not resolution.get("phone") or not resolution.get("linkedin_url")
            if resolution.get("email") and needs_more_data and self.bettercontact.api_key:
                logger.info(f"[Enrichment] Step 2c: BetterContact fallback for {resolution['email']}")
                bc_result = await self.bettercontact.enrich_prospect(
                    email=resolution["email"],
                    company_name=resolution.get("company") or "",
                    company_domain=resolution.get("domain") or "",
                )
                if bc_result.get("success"):
                    resolution["full_name"] = bc_result.get("full_name") or resolution.get("full_name")
                    resolution["phone"] = bc_result.get("phone") or resolution.get("phone")
                    resolution["linkedin_url"] = bc_result.get("linkedin_url") or resolution.get("linkedin_url")
                    resolution["job_title"] = bc_result.get("job_title") or resolution.get("job_title")
                    resolution["confidence"] = max(resolution["confidence"], 0.6)
                    logger.info(f"[Enrichment] Step 2c success: found {resolution['full_name']}")
                else:
                    logger.info(f"[Enrichment] Step 2c: BetterContact NO match")

            # ──────────────────────────────────────────────
            # 2ca. ContactOut Email → Person
            # ──────────────────────────────────────────────
            if resolution.get("email") and not resolution.get("full_name") and self.contactout.api_key:
                logger.info(f"[Enrichment] Step 2ca: ContactOut email lookup for {resolution['email']}")
                co_enrich = await self.contactout.enrich_person_by_email(resolution["email"])
                profile = co_enrich.get("profile", {})
                if profile:
                    resolution["full_name"] = profile.get("fullName") or profile.get("full_name") or resolution.get("full_name")
                    resolution["linkedin_url"] = profile.get("linkedinUrl") or profile.get("linkedin_url") or resolution.get("linkedin_url")
                    resolution["job_title"] = profile.get("headline") or profile.get("job_title") or resolution.get("job_title")
                    resolution["confidence"] = max(resolution["confidence"], 0.75)
                    logger.info(f"[Enrichment] Step 2ca success: found {resolution['full_name']}")
                else:
                    logger.info(f"[Enrichment] Step 2ca: ContactOut email lookup NO match")

            # ──────────────────────────────────────────────
            # 2d. ContactOut DM fallback
            # ──────────────────────────────────────────────
            if resolution.get("domain") and not resolution.get("full_name") and self.contactout.api_key:
                logger.info(f"[Enrichment] Step 2d: ContactOut fallback (DMs) for {resolution['domain']}")
                co_data = await self.contactout.get_decision_makers(domain=resolution["domain"], reveal_info=False)
                profiles = co_data.get("profiles", {})
                if profiles:
                    dm = next(iter(profiles.values()))
                    resolution["full_name"] = dm.get("full_name") or resolution.get("full_name")
                    resolution["job_title"] = dm.get("title") or resolution.get("job_title")
                    resolution["linkedin_url"] = dm.get("linkedin_url") or resolution.get("linkedin_url")
                    logger.info(f"[Enrichment] Step 2d success: found DM {resolution['full_name']}")

            # ──────────────────────────────────────────────
            # 3. Explorium
            # ──────────────────────────────────────────────
            if resolution.get("domain"):
                explorium_data = await self.explorium.search_companies({"domain": resolution["domain"]}, limit=1)
                if explorium_data.get("companies"):
                    resolution["explorium"] = explorium_data["companies"][0]
                    resolution["confidence"] = max(resolution["confidence"], 0.9)
            elif resolution.get("company"):
                explorium_data = await self.explorium.search_companies({"name": resolution["company"]}, limit=1)
                if explorium_data.get("companies"):
                    resolution["explorium"] = explorium_data["companies"][0]
                    resolution["confidence"] = max(resolution["confidence"], 0.8)

        except Exception as e:
            logger.error(f"[Enrichment] Fatal error: {e}")

        return resolution

    async def _enrich_so_email_lookup(self, email: str) -> Optional[Dict[str, Any]]:
        if not self.enrich_api_key:
            return None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    \"https://api.enrich.so/v1/api/person\",
                    params={\"email\": email},
                    headers={\"Authorization\": f\"Bearer {self.enrich_api_key}\"},
                    timeout=15.0,
                )
                if response.status_code == 200:
                    result = response.json()
                    raw = result.get(\"data\") or result
                    if isinstance(raw, dict) and (raw.get(\"displayName\") or raw.get(\"firstName\")):
                        person = {
                            \"full_name\": raw.get(\"displayName\") or f\"{raw.get('firstName', '')} {raw.get('lastName', '')}\".strip(),
                            \"email\": email,
                            \"phone\": raw.get(\"phoneNumber\") or raw.get(\"phone\") or \"\",
                            \"linkedin_url\": raw.get(\"linkedInProfileUrl\") or raw.get(\"linkedin_url\") or \"\",
                            \"job_title\": raw.get(\"headline\") or raw.get(\"title\") or \"\",
                            \"company_domain\": raw.get(\"companyDomain\") or \"\",
                        }
                        return {\"data\": person}
                return None
        except Exception:
            return None

    async def _enrich_so_lookup(self, ip: str) -> Optional[Dict[str, Any]]:
        if not self.enrich_api_key:
            return None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    \"https://api.enrich.so/v1/api/ip-to-company-lookup\",
                    params={\"ip\": ip},
                    headers={\"Authorization\": f\"Bearer {self.enrich_api_key}\"},
                    timeout=15.0,
                )
                if response.status_code == 200:
                    result = response.json()
                    raw = result.get(\"data\") or result
                    if isinstance(raw, dict) and (raw.get(\"companyName\") or raw.get(\"domain\")):
                        return {
                            \"data\": {
                                \"company_name\": raw.get(\"companyName\") or \"\",
                                \"company_domain\": raw.get(\"domain\") or \"\",
                            }
                        }
                return None
        except Exception:
            return None
