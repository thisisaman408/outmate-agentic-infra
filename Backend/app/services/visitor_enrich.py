"""
Visitor Enrichment Pipeline — IP-first, no email shortcuts.

Enrichment layers (in order of execution):
  -1. Identity graph  — check PostgreSQL identity_nodes for prior matches
  0. ip-api.com       — primary geo (accurate city/region, ISP, mobile/proxy flags)
  1. IPinfo           — secondary geo + company data (paid plan features)
  2. Enrich.so        — IP → Company lookup
  3. [Email only]     — Enrich.so + BetterContact + ContactOut + FullContact person
  4. ContactOut DMs   — company domain → decision maker contacts
  5. Explorium        — company firmographics by domain
  6. Identity graph   — store results back for future lookups

Design principle: the email argument is ONLY from pixel form-capture or manual identify().
Login emails are NEVER passed into this pipeline.
"""

import httpx
import ipinfo
import json
import logging
import asyncio
from functools import partial
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.redis import RedisManager
from app.services.explorium_service import ExploriumService
from app.services.bettercontact_service import BetterContactService
from app.services.contactout_service import ContactOutService
from app.services.fullcontact_service import FullContactService

logger = logging.getLogger(__name__)

# ── ISP / Cloud / Residential filter ─────────────────────────────────────────
# If the IP org resolves to any of these → it's a residential/consumer/cloud IP
# and cannot be de-anonymised to a company.
ISP_CLOUD_KEYWORDS = {
    # India residential ISPs
    "airtel", "bharti", "reliance jio", "jio", "vodafone", "bsnl", "mtnl",
    "hathway", "act fibernet", "tikona", "spectranet", "excitel", "gtpl",
    "asianet", "you broadband", "den networks",
    # Global consumer ISPs
    "comcast", "verizon", "at&t", "spectrum", "charter", "cox", "optimum",
    "suddenlink", "frontier", "windstream", "centurylink", "lumen",
    "t-mobile", "sprint", "nexmo", "twilio",
    "proxad", "wanadoo", "orange", "telefonica",
    "sky broadband", "bt group", "talktalk", "virgin media",
    "telstra", "optus", "tpg", "shaw", "rogers", "telus",
    "google fiber", "starlink", "hughesnet", "viasat", "earthlink",
    # Cloud / hosting providers
    "amazon", "aws", "google inc", "microsoft corp", "azure",
    "digitalocean", "linode", "vultr", "hetzner", "leaseweb", "choopa",
    "scaleway", "upcloud", "ovh", "rackspace", "softlayer",
    "akamai", "cloudflare", "fastly", "level 3", "cogent",
    "tata communications", "bluehost", "hostgator", "dreamhost",
    "siteground", "godaddy", "namecheap", "wix", "squarespace",
    "alibaba", "oracle cloud", "ibm cloud",
    # Generic
    "internet service", "hosting", "cloud", "server", "data center",
    "vps", "isp", "network foundation", "broadband",
}

# These AS names typically indicate residential/mobile connections in India
MOBILE_ASN_PATTERNS = {"jio", "reliance jio", "airtel", "vodafone idea", "vi "}


def is_isp_or_cloud(org_name: str) -> bool:
    if not org_name:
        return False
    name_lower = org_name.lower()
    return any(keyword in name_lower for keyword in ISP_CLOUD_KEYWORDS)


def _clean_domain(domain: str | None) -> str | None:
    if not domain:
        return None
    d = domain.strip().lower().lstrip("www.")
    return d.rstrip(".") or None


PERSONAL_EMAIL_DOMAINS = {
    "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com",
    "me.com", "aol.com", "mail.com", "protonmail.com", "zoho.com",
    "yandex.com", "rediffmail.com", "live.com", "msn.com",
}


# ── Main enricher ─────────────────────────────────────────────────────────────

class VisitorEnricher:
    def __init__(self):
        self.ipinfo_client = (
            ipinfo.getHandler(settings.IPINFO_TOKEN)
            if getattr(settings, "IPINFO_TOKEN", None)
            else None
        )
        self.enrich_api_key = getattr(settings, "ENRICH_API_KEY", None)
        self.explorium = ExploriumService()
        self.bettercontact = BetterContactService()
        self.contactout = ContactOutService()
        self.fullcontact = FullContactService()

        logger.info(
            "[VisitorEnricher] APIs: IPINFO=%s, ENRICH_SO=%s, EXPLORIUM=%s, "
            "BETTERCONTACT=%s, CONTACTOUT=%s, FULLCONTACT=%s",
            bool(self.ipinfo_client),
            bool(self.enrich_api_key),
            bool(self.explorium.api_key),
            bool(self.bettercontact.api_key),
            bool(self.contactout.api_key),
            bool(self.fullcontact.api_key),
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Public entry point
    # ─────────────────────────────────────────────────────────────────────────

    async def enrich_ip(
        self,
        ip: str,
        url: str,
        intent_score: float,
        email: Optional[str] = None,
        visitor_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enrich a visitor from their IP address.
        `email` must be from pixel form-capture only — never from a login session.
        """
        # Reject private / loopback IPs (local dev / test)
        is_private = any(ip.startswith(pfx) for pfx in (
            "127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
            "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
            "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.",
            "172.31.", "::1", "localhost",
        ))

        resolution: Dict[str, Any] = {
            "ip": ip,
            "is_private_ip": is_private,
            "company": None,
            "domain": None,
            "geo": None,
            "confidence": 0.0,
            "person": None,
            "intent_score": intent_score,
            # Person contact fields
            "email": email if email and email not in ("", "null", "undefined") else None,
            "phone": None,
            "full_name": None,
            "linkedin_url": None,
            "job_title": None,
            "decision_makers": [],
            "logo_url": None,
            # Enrichment source flags (for debugging)
            "_sources": [],
        }

        # If a form-captured work email is available, pre-fill domain
        if resolution["email"] and "@" in resolution["email"]:
            domain_from_email = resolution["email"].split("@")[-1].lower()
            if domain_from_email not in PERSONAL_EMAIL_DOMAINS:
                resolution["domain"] = _clean_domain(domain_from_email)
                resolution["confidence"] = max(resolution["confidence"], 0.5)

        if is_private:
            logger.info("[Enrichment] Private IP %s — skipping external lookups", ip)
            resolution["geo"] = {"city": "localhost", "region": None, "country": None}
            return resolution

        try:
            # ── STEP -1: Identity graph lookup (visitor_id / IP / email) ──────
            graph_hit = await self._step_identity_graph_lookup(ip, visitor_id, email)
            if graph_hit:
                # Merge person-level fields from graph
                for key in ("full_name", "phone", "linkedin_url", "job_title", "email"):
                    if graph_hit.get(key) and not resolution.get(key):
                        resolution[key] = graph_hit[key]
                if graph_hit.get("company_name") and not resolution.get("company"):
                    resolution["company"] = graph_hit["company_name"]
                if graph_hit.get("company_domain") and not resolution.get("domain"):
                    resolution["domain"] = graph_hit["company_domain"]
                resolution["_sources"].append("identity_graph")
                resolution["confidence"] = max(resolution["confidence"], 0.85)
                logger.info("[Enrichment] Identity graph HIT for visitor_id=%s ip=%s", visitor_id, ip)

            # ── STEP 0: ip-api.com (accurate geo — primary source) ────────────
            await self._step_ipapi(ip, resolution)

            # ── STEP 1: IPinfo (company data from paid plan) ──────────────────
            await self._step_ipinfo(ip, resolution)

            # ── STEP 2: Enrich.so IP → Company ───────────────────────────────
            await self._step_enrich_so_ip(ip, resolution)

            # ── Redis cache: reuse domain-level enrichment if available ───────
            domain_after_ip = resolution.get("domain")
            cached = None
            if domain_after_ip:
                cached = await self._get_cached_domain_enrichment(domain_after_ip)
            if cached:
                # Merge cached domain-level data (don't overwrite visitor-specific fields)
                if cached.get("company") and not resolution.get("company"):
                    resolution["company"] = cached["company"]
                if cached.get("explorium"):
                    resolution["explorium"] = cached["explorium"]
                if cached.get("visitor_contacts"):
                    resolution["visitor_contacts"] = cached["visitor_contacts"]
                if cached.get("enrich_company"):
                    resolution["enrich_company"] = cached["enrich_company"]
                if cached.get("logo_url") and not resolution.get("logo_url"):
                    resolution["logo_url"] = cached["logo_url"]
                resolution["_sources"].append("cache")
                resolution["confidence"] = max(resolution["confidence"], 0.65)
            else:
                # No cache — run full enrichment pipeline

                # ── STEP 3 (Email path): Enrich person from form-captured email ───
                if resolution["email"]:
                    await self._step_enrich_so_email(resolution)
                    await self._step_bettercontact(resolution)
                    await self._step_contactout_email(resolution)
                    # FullContact enrichment as fallback
                    await self._step_fullcontact(ip, resolution)

                # ── STEP 4: ContactOut DM from company domain (supplementary data) ──
                if resolution.get("domain"):
                    await self._step_contactout_dm(resolution)

                # ── STEP 5: Explorium firmographics ──────────────────────────────
                await self._step_explorium(resolution)

                # Cache domain-level results for future visitors from same company
                final_domain = resolution.get("domain")
                if final_domain:
                    await self._cache_domain_enrichment(final_domain, resolution)

            # ── Append default Logo ──────────────────────────────────────────
            if resolution.get("domain") and not resolution.get("logo_url"):
                resolution["logo_url"] = f"https://logo.clearbit.com/{resolution['domain']}"

            # ── STEP 6: Store/update identity graph ───────────────────────────
            await self._step_identity_graph_store(ip, visitor_id, resolution)

        except Exception as e:
            logger.error("[Enrichment] Unhandled fatal error: %s", e, exc_info=True)

        return resolution

    # ─────────────────────────────────────────────────────────────────────────
    # Step 0: ip-api.com — accurate geo (no API key, 45 req/min free)
    # More accurate than IPinfo free for Asia/India because it uses multiple
    # geo databases and has city-level accuracy ~80% globally vs IPinfo ~55%.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_ipapi(self, ip: str, resolution: Dict[str, Any]) -> None:
        logger.info("[Enrichment] Step 0: ip-api.com geo for %s", ip)
        try:
            fields = "status,message,country,countryCode,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting"
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"http://ip-api.com/json/{ip}",
                    params={"fields": fields},
                )
            if resp.status_code != 200:
                return
            data = resp.json()
            if data.get("status") != "success":
                logger.info("[Enrichment] Step 0: ip-api.com returned status=%s for %s", data.get("status"), ip)
                return

            city = data.get("city") or None
            district = data.get("district") or None
            region = data.get("regionName") or None
            country = data.get("country") or None
            country_code = data.get("countryCode") or None
            lat = data.get("lat")
            lon = data.get("lon")
            timezone = data.get("timezone") or None
            isp = data.get("isp") or None
            org = data.get("org") or None          # usually "AS12345 Company Name"
            asname = data.get("asname") or None    # short AS name e.g. "JIO-IN"
            is_mobile = bool(data.get("mobile"))
            is_proxy = bool(data.get("proxy"))
            is_hosting = bool(data.get("hosting"))

            # Store accurate geo — prefer city over district
            resolution["geo"] = {
                "city": city or district,
                "district": district,
                "region": region,
                "country": country,
                "country_code": country_code,
                "lat": lat,
                "lon": lon,
                "timezone": timezone,
                "is_mobile": is_mobile,
                "is_proxy": is_proxy,
                "is_hosting": is_hosting,
            }
            resolution["_sources"].append("ipapi")
            resolution["confidence"] = max(resolution["confidence"], 0.2)

            # Extract company from org field (strip "AS12345 " prefix)
            org_name = None
            if org and " " in org:
                org_name = org.split(" ", 1)[1].strip()
            elif isp:
                org_name = isp

            resolution["_ipapi_isp"] = isp
            resolution["_ipapi_org"] = org_name
            resolution["_is_mobile"] = is_mobile
            resolution["_is_proxy"] = is_proxy
            resolution["_is_hosting"] = is_hosting

            # Only use org as company if it's NOT a consumer ISP / cloud
            if org_name and not is_isp_or_cloud(org_name) and not is_mobile and not is_hosting:
                if not resolution.get("company"):
                    resolution["company"] = org_name
                    resolution["confidence"] = max(resolution["confidence"], 0.35)
                    logger.info("[Enrichment] Step 0: org from ip-api = %s", org_name)

            logger.info(
                "[Enrichment] Step 0 done: %s, %s %s (mobile=%s, proxy=%s, hosting=%s)",
                city, region, country, is_mobile, is_proxy, is_hosting,
            )

        except Exception as e:
            logger.warning("[Enrichment] Step 0: ip-api.com failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 1: IPinfo — company data (best with paid plan, fallback to free org)
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_ipinfo(self, ip: str, resolution: Dict[str, Any]) -> None:
        if not self.ipinfo_client:
            return
        logger.info("[Enrichment] Step 1: IPinfo for %s", ip)
        try:
            loop = asyncio.get_event_loop()
            details = await loop.run_in_executor(
                None, partial(self.ipinfo_client.getDetails, ip)
            )

            # Paid plan: company object with name + domain
            company_attr = getattr(details, "company", None)
            org_name = None
            domain = None
            if isinstance(company_attr, dict):
                org_name = company_attr.get("name") or None
                domain = _clean_domain(company_attr.get("domain"))

            # Free plan fallback: org field = "AS12345 Company Name"
            if not org_name:
                raw_org = getattr(details, "org", None) or ""
                if raw_org.startswith("AS") and " " in raw_org:
                    org_name = raw_org.split(" ", 1)[1].strip()

            # Hostname → domain fallback
            if not domain:
                hostname = getattr(details, "hostname", None)
                if hostname:
                    parts = hostname.strip(".").split(".")
                    if not any(p.isdigit() for p in parts) and 2 <= len(parts) <= 3:
                        domain = _clean_domain(".".join(parts[-2:]))

            # Geo fallback (only fill if ip-api.com missed it)
            if not resolution.get("geo") or not (resolution["geo"] or {}).get("city"):
                city = getattr(details, "city", None)
                region = getattr(details, "region", None)
                country = getattr(details, "country", None)
                if city or country:
                    resolution["geo"] = {
                        **(resolution.get("geo") or {}),
                        "city": city,
                        "region": region,
                        "country": country,
                    }

            if org_name and is_isp_or_cloud(org_name):
                logger.info("[Enrichment] Step 1: IPinfo org is ISP/cloud (%s) — skipping", org_name)
                org_name = None
                domain = None

            if org_name and not resolution.get("company"):
                resolution["company"] = org_name
                resolution["confidence"] = max(resolution["confidence"], 0.35)

            if domain and not resolution.get("domain"):
                resolution["domain"] = domain
                resolution["confidence"] = max(resolution["confidence"], 0.4)

            if org_name or domain:
                resolution["_sources"].append("ipinfo")
                logger.info("[Enrichment] Step 1: IPinfo company=%s domain=%s", org_name, domain)

        except Exception as e:
            logger.warning("[Enrichment] Step 1: IPinfo failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 2: Enrich.so IP → Company
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_enrich_so_ip(self, ip: str, resolution: Dict[str, Any]) -> None:
        if not self.enrich_api_key:
            logger.info("[Enrichment] Step 2: Enrich.so not configured, skipping")
            return
        logger.info("[Enrichment] Step 2: Enrich.so IP→Company for %s", ip)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.enrich.so/v1/api/ip-to-company-lookup",
                    params={"ip": ip},
                    headers={"Authorization": f"Bearer {self.enrich_api_key}"},
                )
            if resp.status_code != 200:
                logger.info("[Enrichment] Step 2: Enrich.so returned HTTP %d", resp.status_code)
                return

            raw = resp.json()
            data = raw.get("data") or raw
            company_name = (data.get("companyName") or data.get("company_name") or "").strip()
            company_domain = _clean_domain(data.get("domain") or data.get("company_domain") or "")

            if not company_name and not company_domain:
                logger.info("[Enrichment] Step 2: Enrich.so no data for %s", ip)
                return

            if is_isp_or_cloud(company_name) or is_isp_or_cloud(company_domain):
                logger.info("[Enrichment] Step 2: Enrich.so result is ISP/cloud (%s) — skipping", company_name)
                return

            # Enrich.so is a stronger signal than IPinfo — overwrite with its result
            if company_name:
                resolution["company"] = company_name
            if company_domain:
                resolution["domain"] = company_domain

            resolution["enrich_company"] = {
                "company_name": company_name,
                "company_domain": company_domain,
                "raw": data,
            }
            resolution["_sources"].append("enrich_so_ip")
            resolution["confidence"] = max(resolution["confidence"], 0.7)
            logger.info("[Enrichment] Step 2 success: company=%s domain=%s", company_name, company_domain)

        except Exception as e:
            logger.warning("[Enrichment] Step 2: Enrich.so IP lookup failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 3a: Enrich.so Email → Person (form-captured email only)
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_enrich_so_email(self, resolution: Dict[str, Any]) -> None:
        email = resolution.get("email")
        if not email or not self.enrich_api_key:
            return
        logger.info("[Enrichment] Step 3a: Enrich.so email→person for %s", email)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    "https://api.enrich.so/v1/api/person",
                    params={"email": email},
                    headers={"Authorization": f"Bearer {self.enrich_api_key}"},
                )
            if resp.status_code != 200:
                return

            raw_result = resp.json()
            raw = raw_result.get("data") or raw_result

            if not isinstance(raw, dict):
                return
            if not (raw.get("displayName") or raw.get("firstName") or raw.get("fullName")):
                return

            first = raw.get("firstName", "")
            last = raw.get("lastName", "")
            full = (
                raw.get("displayName")
                or raw.get("fullName")
                or f"{first} {last}".strip()
                or None
            )
            person = {
                "full_name": full,
                "email": email,
                "phone": raw.get("phoneNumber") or raw.get("phone") or "",
                "linkedin_url": raw.get("linkedInProfileUrl") or raw.get("linkedin_url") or "",
                "job_title": raw.get("headline") or raw.get("title") or "",
                "company_domain": _clean_domain(raw.get("companyDomain") or "") or "",
                "company_name": raw.get("companyName") or raw.get("company") or "",
            }

            resolution["person"] = person
            resolution["full_name"] = resolution["full_name"] or person["full_name"]
            resolution["phone"] = resolution["phone"] or person["phone"]
            resolution["linkedin_url"] = resolution["linkedin_url"] or person["linkedin_url"]
            resolution["job_title"] = resolution["job_title"] or person["job_title"]

            if person["company_domain"] and not resolution.get("domain"):
                resolution["domain"] = person["company_domain"]
            if person["company_name"] and not resolution.get("company"):
                resolution["company"] = person["company_name"]

            resolution["_sources"].append("enrich_so_email")
            resolution["confidence"] = max(resolution["confidence"], 0.8)
            logger.info("[Enrichment] Step 3a success: full_name=%s", full)

        except Exception as e:
            logger.warning("[Enrichment] Step 3a: Enrich.so email lookup failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 3b: BetterContact fallback (email → more contact details)
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_bettercontact(self, resolution: Dict[str, Any]) -> None:
        email = resolution.get("email")
        if not email or not self.bettercontact.api_key:
            return
        needs_data = not resolution.get("full_name") or not resolution.get("phone")
        if not needs_data:
            return
        logger.info("[Enrichment] Step 3b: BetterContact for %s", email)
        try:
            bc = await self.bettercontact.enrich_prospect(
                email=email,
                company_name=resolution.get("company") or "",
                company_domain=resolution.get("domain") or "",
            )
            if bc.get("success"):
                resolution["full_name"] = resolution["full_name"] or bc.get("full_name")
                resolution["phone"] = resolution["phone"] or bc.get("phone")
                resolution["linkedin_url"] = resolution["linkedin_url"] or bc.get("linkedin_url")
                resolution["job_title"] = resolution["job_title"] or bc.get("job_title")
                resolution["_sources"].append("bettercontact")
                resolution["confidence"] = max(resolution["confidence"], 0.75)
                logger.info("[Enrichment] Step 3b success: %s", bc.get("full_name"))
        except Exception as e:
            logger.warning("[Enrichment] Step 3b: BetterContact failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 3c: ContactOut Email → Person
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_contactout_email(self, resolution: Dict[str, Any]) -> None:
        email = resolution.get("email")
        if not email or not self.contactout.api_key:
            return
        if resolution.get("full_name") and resolution.get("linkedin_url"):
            return  # already have full person data
        logger.info("[Enrichment] Step 3c: ContactOut email lookup for %s", email)
        try:
            co = await self.contactout.enrich_person_by_email(email)
            profile = co.get("profile", {})
            if profile:
                resolution["full_name"] = resolution["full_name"] or profile.get("fullName") or profile.get("full_name")
                resolution["linkedin_url"] = resolution["linkedin_url"] or profile.get("linkedinUrl") or profile.get("linkedin_url")
                resolution["job_title"] = resolution["job_title"] or profile.get("headline") or profile.get("job_title")
                resolution["_sources"].append("contactout_email")
                resolution["confidence"] = max(resolution["confidence"], 0.75)
                logger.info("[Enrichment] Step 3c success: %s", resolution["full_name"])
        except Exception as e:
            logger.warning("[Enrichment] Step 3c: ContactOut email failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 4: ContactOut DM lookup (company domain → decision makers)
    # Stores DMs as supplementary company data only — NEVER overwrites
    # primary person fields (full_name, email, etc.) because those must
    # represent the actual visitor, not a random employee.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_contactout_dm(self, resolution: Dict[str, Any]) -> None:
        domain = resolution.get("domain")
        if not domain or not self.contactout.api_key:
            return
        logger.info("[Enrichment] Step 4: ContactOut DM for domain %s", domain)
        try:
            co_data = await self.contactout.get_decision_makers(domain=domain, reveal_info=False)
            profiles = co_data.get("profiles", {})
            if not profiles:
                logger.info("[Enrichment] Step 4: No DMs found for %s", domain)
                return

            # Store as supplementary company contacts — NOT as the visitor's identity
            top_dms = []
            for profile_id, dm_data in list(profiles.items())[:5]:
                top_dms.append({
                    "full_name": dm_data.get("full_name") or dm_data.get("name"),
                    "job_title": dm_data.get("title") or dm_data.get("headline"),
                    "linkedin_url": dm_data.get("linkedin_url") or dm_data.get("linkedin"),
                    "email": dm_data.get("work_email") or dm_data.get("personal_email"),
                })

            resolution["decision_makers"] = top_dms
            # DO NOT fill primary person fields — those belong to the actual visitor

            resolution["_sources"].append("contactout_dm")
            logger.info("[Enrichment] Step 4 success: %d DMs stored as company contacts for %s", len(top_dms), domain)
        except Exception as e:
            logger.warning("[Enrichment] Step 4: ContactOut DM failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 5: Explorium — B2B firmographics by domain or company name
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_explorium(self, resolution: Dict[str, Any]) -> None:
        domain = resolution.get("domain")
        company = resolution.get("company")
        if not domain and not company:
            logger.info("[Enrichment] Step 5: No domain or company — skipping Explorium")
            return
        logger.info("[Enrichment] Step 5: Explorium firmographics (domain=%s, company=%s)", domain, company)
        try:
            if domain:
                result = await self.explorium.search_companies({"domain": domain}, limit=1)
                confidence_bump = 0.9
            else:
                result = await self.explorium.search_companies({"name": company}, limit=1)
                confidence_bump = 0.8

            companies = result.get("companies") or []
            if companies:
                resolution["explorium"] = companies[0]
                resolution["_sources"].append("explorium")
                resolution["confidence"] = max(resolution["confidence"], confidence_bump)
                logger.info(
                    "[Enrichment] Step 5 success: %s (industry=%s, employees=%s)",
                    companies[0].get("name"),
                    companies[0].get("industry"),
                    companies[0].get("employee_count_range"),
                )
            else:
                logger.info("[Enrichment] Step 5: Explorium no match for domain=%s name=%s", domain, company)

        except Exception as e:
            logger.warning("[Enrichment] Step 5: Explorium failed: %s", e)

    # ── Step 3.5: FullContact resolve (email/IP → person) ──────────────────

    async def _step_fullcontact(self, ip: str, resolution: Dict[str, Any]) -> None:
        email = resolution.get("email")
        if not self.fullcontact.api_key:
            return
        if resolution.get("full_name") and resolution.get("linkedin_url"):
            return  # already have full person data
        logger.info("[Enrichment] Step 3.5: FullContact for email=%s ip=%s", email, ip)
        try:
            person = await self.fullcontact.resolve_person(email=email, ip=ip)
            if not person:
                return
            for key in ("full_name", "job_title", "linkedin_url", "phone"):
                if not resolution.get(key) and person.get(key):
                    resolution[key] = person[key]
            if not resolution.get("domain") and person.get("company_domain"):
                resolution["domain"] = person["company_domain"]
            if not resolution.get("company") and person.get("company_name"):
                resolution["company"] = person["company_name"]

            resolution["_sources"].append("fullcontact")
            resolution["confidence"] = max(resolution["confidence"], 0.8)
            logger.info("[Enrichment] Step 3.5 success: %s", person.get("full_name"))
        except Exception as e:
            logger.warning("[Enrichment] Step 3.5: FullContact failed: %s", e)

    # ── Identity graph lookup ────────────────────────────────────────────────

    async def _step_identity_graph_lookup(
        self, ip: str, visitor_id: Optional[str], email: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Query identity_nodes by visitor_id, then IP, then email."""
        try:
            from app.db.session import SessionLocal
            from app.db.models.identity_graph import IdentityNode
            db = SessionLocal()
            try:
                node = None
                if visitor_id:
                    node = db.query(IdentityNode).filter(IdentityNode.visitor_id == visitor_id).first()
                if not node and ip:
                    node = db.query(IdentityNode).filter(IdentityNode.ip == ip).first()
                if not node and email:
                    node = db.query(IdentityNode).filter(IdentityNode.email == email).first()
                if not node:
                    return None
                return {
                    "full_name": node.full_name,
                    "email": node.email,
                    "phone": node.phone,
                    "linkedin_url": node.linkedin_url,
                    "job_title": node.job_title,
                    "company_name": node.company_name,
                    "company_domain": node.company_domain,
                }
            finally:
                db.close()
        except Exception as e:
            logger.warning("[Enrichment] Identity graph lookup failed: %s", e)
            return None

    # ── Identity graph store/update ──────────────────────────────────────────

    async def _step_identity_graph_store(
        self, ip: str, visitor_id: Optional[str], resolution: Dict[str, Any]
    ) -> None:
        """Upsert enrichment results into identity_nodes."""
        if not visitor_id:
            return
        # Only store if we have meaningful person or company data
        has_data = any(resolution.get(k) for k in ("full_name", "email", "company", "domain"))
        if not has_data:
            return
        try:
            from app.db.session import SessionLocal
            from app.db.models.identity_graph import IdentityNode
            db = SessionLocal()
            try:
                node = db.query(IdentityNode).filter(IdentityNode.visitor_id == visitor_id).first()
                if node:
                    # Update existing — only fill empty fields (never overwrite)
                    if ip:
                        node.ip = ip
                    for attr, res_key in [
                        ("email", "email"), ("full_name", "full_name"),
                        ("phone", "phone"), ("linkedin_url", "linkedin_url"),
                        ("job_title", "job_title"), ("company_name", "company"),
                        ("company_domain", "domain"),
                    ]:
                        val = resolution.get(res_key)
                        if val and not getattr(node, attr):
                            setattr(node, attr, val)
                    # Always update sources
                    existing_sources = node.sources or []
                    new_sources = resolution.get("_sources", [])
                    merged = list(set(existing_sources + new_sources))
                    node.sources = merged
                else:
                    node = IdentityNode(
                        visitor_id=visitor_id,
                        ip=ip,
                        email=resolution.get("email"),
                        full_name=resolution.get("full_name"),
                        phone=resolution.get("phone"),
                        linkedin_url=resolution.get("linkedin_url"),
                        job_title=resolution.get("job_title"),
                        company_name=resolution.get("company"),
                        company_domain=resolution.get("domain"),
                        sources=resolution.get("_sources", []),
                    )
                    db.add(node)
                db.commit()
                logger.info("[Enrichment] Identity graph STORED for visitor_id=%s", visitor_id)
            finally:
                db.close()
        except Exception as e:
            logger.warning("[Enrichment] Identity graph store failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Redis domain cache — avoid redundant API calls for same company
    # ─────────────────────────────────────────────────────────────────────────

    CACHE_TTL = 72 * 3600  # 72 hours

    async def _get_cached_domain_enrichment(self, domain: str) -> Optional[Dict[str, Any]]:
        """Return cached enrichment for a domain, or None."""
        try:
            redis = RedisManager.get_client()
            raw = await redis.get(f"enrich:domain:{domain}")
            if raw:
                logger.info("[Enrichment] Cache HIT for domain %s", domain)
                return json.loads(raw)
        except Exception as e:
            logger.debug("[Enrichment] Cache read error: %s", e)
        return None

    async def _cache_domain_enrichment(self, domain: str, resolution: Dict[str, Any]) -> None:
        """Cache enrichment result for a domain."""
        try:
            # Only cache fields that are domain-level (not visitor-specific like IP/geo)
            cacheable = {
                "company": resolution.get("company"),
                "domain": resolution.get("domain"),
                "explorium": resolution.get("explorium"),
                "visitor_contacts": resolution.get("visitor_contacts"),
                "enrich_company": resolution.get("enrich_company"),
                "logo_url": resolution.get("logo_url"),
            }
            redis = RedisManager.get_client()
            await redis.set(
                f"enrich:domain:{domain}",
                json.dumps(cacheable, default=str),
                ex=self.CACHE_TTL,
            )
            logger.info("[Enrichment] Cached domain enrichment for %s (TTL=%dh)", domain, self.CACHE_TTL // 3600)
        except Exception as e:
            logger.debug("[Enrichment] Cache write error: %s", e)
