"""
Visitor Enrichment Pipeline — IP-first, no email shortcuts.

Enrichment layers (in order of execution):
  -1. Identity graph  — visitor_id → cross-org fingerprint → /24 subnet → IP → email
  -0.5. PTR lookup    — reverse DNS (free) — often reveals "vpn.company.com"
  0. ip-api.com       — primary geo (accurate city/region, ISP, mobile/proxy flags)
  1. IPinfo           — secondary geo + company data (paid plan features)
  2. Enrich.so        — IP → Company lookup
  2.5. MX validation  — confirm the resolved domain has real corporate MX records
  3. [Email only]     — Enrich.so + BetterContact + ContactOut person
  4. ContactOut DMs   — company domain → decision maker contacts
  5. Explorium        — company match → firmographics + funding + technographics + LinkedIn posts
  5b. Hunter.io       — domain → leads (if no person yet)
  5c. Clearbit        — company firmographic fallback
  5.5. RDAP           — registrant org fallback (free, no API key)
  6. Identity graph   — store results + fingerprint back for future lookups

Design principle: the email argument is ONLY from pixel form-capture or manual identify().
Login emails are NEVER passed into this pipeline.
"""

import httpx
import ipinfo
import json
import logging
import asyncio
import socket
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

NOISE_ASN_ORGS = {
    "MICROSOFT-CORP", "AMAZON-AES", "GOOGLE", "TENCENT",
    "ALIBABA", "DIGITALOCEAN", "LINODE", "OVHCLOUD",
    "HETZNER", "VULTR", "CLOUDFLARE", "FASTLY",
}

NOISE_INDICATORS = {
    "ua_missing": 15,          # no user agent
    "ua_is_bot": 50,           # "Googlebot", "crawler" in UA
    "headless_webdriver": 50,  # navigator.webdriver signal
    "zero_viewport": 30,       # 0x0 screen from pixel
    "no_cookie_support": 10,   # cookies disabled
    "cloud_asn": 40,           # ASN matches NOISE_ASN_ORGS
    "datacenter_ip": 35,       # IPinfo.io type = "datacenter"
}

# These AS names typically indicate residential/mobile connections in India
MOBILE_ASN_PATTERNS = {"jio", "reliance jio", "airtel", "vodafone idea", "vi "}


def is_isp_or_cloud(org_name: str, allowlist: list | None = None) -> bool:
    """
    Returns True if org_name matches a known ISP/cloud keyword.
    `allowlist` is a per-org list of keyword substrings that override the block
    (e.g. ["cloudflare", "google"] so corp-VPN visitors aren't filtered).
    """
    if not org_name:
        return False
    name_lower = org_name.lower()
    # Per-org allowlist check first
    if allowlist:
        if any(kw.lower() in name_lower for kw in allowlist):
            return False
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

# ── Company name normalisation ─────────────────────────────────────────────────
# Strip legal-entity suffixes so "Acme Ltd.", "ACME LIMITED" and "Acme" all
# compare as equal when checking multi-source agreement.
import re as _re

_LEGAL_SUFFIX_RE = _re.compile(
    r"[\s,.]+(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|"
    r"incorporated|llc|l\.l\.c\.?|llp|corp\.?|corporation|co\.?|company|"
    r"gmbh|ag|bv|nv|plc|pty\s+ltd\.?|pte\s+ltd\.?|sdn\s+bhd|"
    r"s\.a\.?|s\.r\.l\.?|s\.a\.s\.?|s\.p\.a\.?)[\s.]*$",
    _re.IGNORECASE,
)

def _normalize_company_name(name: str | None) -> str | None:
    """Strip legal suffixes, collapse whitespace, return title-cased canonical name."""
    if not name:
        return None
    cleaned = _LEGAL_SUFFIX_RE.sub("", name).strip().strip(".,()-")
    cleaned = " ".join(cleaned.split())  # collapse all whitespace
    return cleaned if len(cleaned) >= 2 else None


# ── PTR hostname classification ────────────────────────────────────────────────
# Patterns that indicate a residential / ISP reverse-DNS hostname.
# Corporate reverse-DNS looks very different — this helps PTR lookup distinguish
# "vpn.acme.com" (corporate) from "broad-89-64-45-112.customer.isp.net" (noise).
_PTR_RESIDENTIAL_RE = _re.compile(
    r"(^|\.)("
    r"broad|dsl|cable|fiber|adsl|vdsl|dialup|dynamic|dhcp|pool|ppp|"
    r"residential|static-|customer|subscriber|cpe|bng|nas|node|bbcust|"
    r"hsd|isp|\d{1,3}-\d{1,3}-\d{1,3}-\d{1,3}"  # IP-in-hostname pattern
    r")",
    _re.IGNORECASE,
)
_PTR_CORPORATE_RE = _re.compile(
    r"(^|\.)("
    r"vpn|proxy|gateway|corp|fw|firewall|egress|nat|outbound|"
    r"mail|smtp|mx|office|hq|edge|gw|router"
    r")",
    _re.IGNORECASE,
)


# ── Main enricher ─────────────────────────────────────────────────────────────

class VisitorEnricher:
    # Shared async HTTP client — reused across all enrichment steps in one task
    # invocation.  Limits to 10 concurrent connections total, 5 per host.
    _http_client: httpx.AsyncClient | None = None

    @classmethod
    def _get_http_client(cls) -> httpx.AsyncClient:
        if cls._http_client is None or cls._http_client.is_closed:
            limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)
            cls._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=5.0),
                limits=limits,
            )
        return cls._http_client

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
        self._isp_allowlist: list = []
        self._fp: Optional[str] = None  # browser fingerprint for cross-org identity
        # Shared HTTP client for this enrichment run
        self.http = self._get_http_client()

        logger.info(
            "[VisitorEnricher] APIs: IPINFO=%s, ENRICH_SO=%s, EXPLORIUM=%s, "
            "BETTERCONTACT=%s, CONTACTOUT=%s",
            bool(self.ipinfo_client),
            bool(self.enrich_api_key),
            bool(self.explorium.api_key),
            bool(self.bettercontact.api_key),
            bool(self.contactout.api_key),
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
        fp: Optional[str] = None,
        user_agent: str = "",
        viewport_w: int = 0,
        viewport_h: int = 0,
        isp_allowlist: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Enrich a visitor from their IP address.
        `email` must be from pixel form-capture only — never from a login session.
        `isp_allowlist` is a per-org list of ISP name substrings to NOT filter out.
        """
        self._isp_allowlist = isp_allowlist or []
        self._fp = fp  # store for cross-org fingerprint identity lookup
        # Reject private / loopback IPs (local dev / test)
        is_private = any(ip.startswith(pfx) for pfx in (
            "127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
            "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
            "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.",
            "172.31.", "::1", "localhost",
        ))

        # Calculate base bot score
        def compute_bot_score() -> int:
            score = 0
            if not user_agent:
                score += NOISE_INDICATORS["ua_missing"]
            else:
                tl = user_agent.lower()
                if any(bot in tl for bot in ("bot", "crawler", "spider", "headless")):
                    score += NOISE_INDICATORS["ua_is_bot"]
            if viewport_w == 0 or viewport_h == 0:
                score += NOISE_INDICATORS["zero_viewport"]
            return score

        base_bot_score = compute_bot_score()

        # Reject obvious bots immediately
        if base_bot_score >= 50:
            logger.info("[Enrichment] IP %s blocked by UserAgent pre-filter (score=%s)", ip, base_bot_score)
            return {
                "ip": ip, "is_private_ip": False, "fingerprint": fp,
                "tier": "noise", "bot_score": base_bot_score, "_sources": ["bot_filter"],
                "confidence": 0, "intent_score": intent_score
            }

        resolution: Dict[str, Any] = {
            "ip": ip,
            "is_private_ip": is_private,
            "company": None,
            "domain": None,
            "geo": None,
            "confidence": 0.0,
            "person": None,
            "intent_score": intent_score,
            "fingerprint": fp,
            "tier": "unknown",
            "bot_score": base_bot_score,
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
                
            # ── STEP -0.5: PDL (People Data Labs) / LiveRamp Stub ─────────────
            # TODO: Integrate external Data Cooperative graph API here.
            # Example: result = await self._step_pdl_graph_lookup(fp, ip, email)
            # if result: merge into resolution...

            # ── STEP -0.5: PTR reverse-DNS lookup (free, no API key) ─────────
            # Often reveals corporate hostnames like "vpn.acmecorp.com"
            await self._step_ptr_lookup(ip, resolution)

            # ── STEP 0: ip-api.com (accurate geo — primary source) ────────────
            await self._step_ipapi(ip, resolution)

            # ── STEP 1: IPinfo (company data from paid plan) ──────────────────
            await self._step_ipinfo(ip, resolution)

            # ── STEP 2: Enrich.so IP → Company ───────────────────────────────
            await self._step_enrich_so_ip(ip, resolution)

            # ── STEP 2.5: MX validation — filter out ISP/PTR noise domains ──
            # If PTR or ip-api gave us a domain but it has no MX records,
            # it's likely a reverse-DNS hostname (e.g. "broad.isp.net"), not a company.
            domain_after_ip2 = resolution.get("domain")
            if domain_after_ip2 and resolution.get("confidence", 0) < 0.65:
                has_mx = await self._validate_mx_domain(domain_after_ip2)
                if not has_mx:
                    # Flag as unverified — don't remove, but cap confidence
                    resolution["_mx_unverified"] = True
                    resolution["confidence"] = min(resolution.get("confidence", 0), 0.35)
                    logger.info("[Enrichment] MX check: %s has no MX records — capping confidence", domain_after_ip2)
                else:
                    # Confirmed corporate domain — small confidence boost
                    resolution["confidence"] = max(resolution.get("confidence", 0), 0.55)
                    logger.info("[Enrichment] MX check: %s confirmed corporate domain", domain_after_ip2)

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
                # ── STEP 4: ContactOut DM from company domain (supplementary data) ──
                if resolution.get("domain"):
                    await self._step_contactout_dm(resolution)

                # ── STEP 5: Explorium firmographics ──────────────────────────
                await self._step_explorium(resolution)

                # ── STEP 5b: Hunter.io — domain → leads (if no person yet) ──
                await self._step_hunter_io(resolution)

                # ── STEP 5c: Clearbit company — additional firmographic fallback
                await self._step_clearbit_company(resolution)

                # ── STEP 5.5: IP RDAP — registrant org fallback (free, no key) ─
                await self._step_rdap_lookup(ip, resolution)

                # ── STEP 5.6: Domain RDAP — registrant org from domain registry ─
                # More authoritative than IP RDAP: the domain registrant IS the
                # company. Runs after MX validation confirmed the domain is real.
                final_domain_rdap = resolution.get("domain")
                if final_domain_rdap and not resolution.get("_mx_unverified"):
                    await self._step_domain_rdap(final_domain_rdap, resolution)

                # Cache domain-level results for future visitors from same company
                final_domain = resolution.get("domain")
                if final_domain:
                    await self._cache_domain_enrichment(final_domain, resolution)

            # ── STEP 7: Multi-source company agreement confidence booster ─────
            # Cross-validate all sources — if 2+ agree on the same company name,
            # confidence jumps significantly. Runs even when cache was hit.
            self._boost_confidence_by_agreement(resolution)

            # ── Append default Logo ──────────────────────────────────────────
            if resolution.get("domain") and not resolution.get("logo_url"):
                resolution["logo_url"] = f"https://logo.clearbit.com/{resolution['domain']}"

            # ── STEP 8: Store/update identity graph ───────────────────────────
            await self._step_identity_graph_store(ip, visitor_id, resolution)

        except Exception as e:
            logger.error("[Enrichment] Unhandled fatal error: %s", e, exc_info=True)

        # Apply exact Tiering logic at end of pipeline
        if resolution["bot_score"] >= 40 or (resolution.get("company") and is_isp_or_cloud(resolution["company"], self._isp_allowlist)):
            resolution["tier"] = "noise"
        elif resolution.get("confidence", 0) >= 0.65 and (resolution.get("email") or resolution.get("person")):
            resolution["tier"] = "person"
        elif resolution.get("company") or resolution.get("domain"):
            resolution["tier"] = "company"
        else:
            resolution["tier"] = "noise"

        return resolution

    # ─────────────────────────────────────────────────────────────────────────
    # Domain RDAP lookup — registrant org from domain registry (free, no key)
    # Unlike IP RDAP (step 5.5) this queries the *domain* record, which always
    # contains the registrant's legal organisation name — far more reliable than
    # the IP block owner. Runs after we have a candidate domain.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_domain_rdap(self, domain: str, resolution: Dict[str, Any]) -> None:
        if not domain:
            return
        # Skip if company is already high-confidence from a better source
        if resolution.get("company") and resolution.get("confidence", 0) >= 0.75:
            return
        try:
            resp = await self.http.get(
                f"https://rdap.org/domain/{domain}",
                headers={"Accept": "application/rdap+json"},
                timeout=httpx.Timeout(5.0),
            )
            if resp.status_code != 200:
                return
            data = resp.json()
            org_name = None
            # Registrant entity is the one with role "registrant"
            for entity in (data.get("entities") or []):
                if "registrant" not in (entity.get("roles") or []):
                    continue
                vcard = entity.get("vcardArray") or []
                props = vcard[1] if len(vcard) > 1 else []
                for prop in props:
                    if not isinstance(prop, list) or len(prop) < 4:
                        continue
                    # vCard "org" or "fn" property contains the org name
                    if prop[0] in ("org", "fn"):
                        candidate = str(prop[3]).strip()
                        if candidate and len(candidate) > 2:
                            org_name = candidate
                            break
                if org_name:
                    break

            if not org_name or is_isp_or_cloud(org_name, self._isp_allowlist):
                return

            canonical = _normalize_company_name(org_name) or org_name
            if not resolution.get("company"):
                resolution["company"] = canonical
                resolution["confidence"] = max(resolution.get("confidence", 0), 0.65)
            resolution["_domain_rdap_org"] = canonical
            resolution["_sources"].append("domain_rdap")
            logger.info("[Enrichment] Domain RDAP: %s → org=%s", domain, canonical)
        except Exception as e:
            logger.debug("[Enrichment] Domain RDAP error for %s: %s", domain, e)

    # ─────────────────────────────────────────────────────────────────────────
    # Multi-source company agreement confidence booster
    # ─────────────────────────────────────────────────────────────────────────
    # Inspired by Warmly.ai / 6sense: when 2+ independent sources agree on the
    # same company name (after normalisation), it's extremely unlikely to be wrong.
    # Each extra agreeing source pushes confidence toward 0.95.
    # ─────────────────────────────────────────────────────────────────────────

    def _boost_confidence_by_agreement(self, resolution: Dict[str, Any]) -> None:
        """Cross-validate company name across all sources; boost confidence on agreement."""
        from collections import Counter

        candidates: list[tuple[str, str]] = []  # (source, normalized_name)

        def _add(src: str, raw: str | None) -> None:
            n = _normalize_company_name(raw)
            if n:
                candidates.append((src, n.lower()))

        _add("primary",      resolution.get("company"))
        _add("ipapi",        resolution.get("_ipapi_org"))
        _add("rdap",         resolution.get("_rdap_org"))
        _add("domain_rdap",  resolution.get("_domain_rdap_org"))
        _add("enrich_so",    (resolution.get("enrich_company") or {}).get("name"))
        _add("explorium",    (resolution.get("explorium") or {}).get("name"))
        _add("ipinfo",       (resolution.get("ipinfo_company") or {}).get("name"))

        if len(candidates) < 2:
            return

        name_counts = Counter(name for _, name in candidates)
        top_name, top_count = name_counts.most_common(1)[0]

        if top_count < 2:
            return

        # Promote the canonical-cased version from the highest-priority agreeing source
        priority = ["explorium", "enrich_so", "domain_rdap", "ipinfo", "primary", "rdap", "ipapi"]
        for src in priority:
            for s, n in candidates:
                if s == src and n == top_name:
                    # Get the original (proper-cased) version
                    original = resolution.get("company") if s == "primary" else (
                        resolution.get("_ipapi_org") if s == "ipapi" else (
                        resolution.get("_rdap_org") if s == "rdap" else (
                        resolution.get("_domain_rdap_org") if s == "domain_rdap" else (
                        (resolution.get("enrich_company") or {}).get("name") if s == "enrich_so" else (
                        (resolution.get("explorium") or {}).get("name")
                    )))))
                    if original:
                        resolution["company"] = _normalize_company_name(original) or original
                    break
            else:
                continue
            break

        boosted = min(0.78 + (top_count - 2) * 0.06, 0.95)
        old_conf = resolution.get("confidence", 0)
        resolution["confidence"] = max(old_conf, boosted)
        resolution["_company_sources_agreed"] = top_count
        logger.info(
            "[Enrichment] Multi-source agreement: '%s' from %d sources → confidence %.2f→%.2f",
            resolution.get("company"), top_count, old_conf, resolution["confidence"],
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Step -0.5: PTR reverse-DNS lookup
    # Corporate networks often set PTR records like "vpn.acmecorp.com" or
    # "proxy.televentures.net" — free, zero quota, often reveals the company
    # domain directly without any API call.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_ptr_lookup(self, ip: str, resolution: Dict[str, Any]) -> None:
        # Skip if we already have a high-confidence company
        if resolution.get("company") and resolution.get("confidence", 0) >= 0.7:
            return
        try:
            loop = asyncio.get_event_loop()
            hostname, _, _ = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: socket.gethostbyaddr(ip)),
                timeout=3.0,
            )
            if not hostname or hostname == ip:
                return

            # Reject obvious residential/ISP reverse-DNS patterns
            # e.g. "broad-89-64-45.customer.isp.net", "pool-123-45.dsl.isp.com"
            if _PTR_RESIDENTIAL_RE.search(hostname):
                logger.debug("[Enrichment] PTR: %s looks residential — skipped", hostname)
                return
            if is_isp_or_cloud(hostname, self._isp_allowlist):
                return

            parts = hostname.strip(".").split(".")
            if len(parts) < 2:
                return

            ptr_domain = ".".join(parts[-2:])
            resolution["ptr_hostname"] = hostname
            resolution["_sources"].append("ptr")

            # Corporate hostname patterns get higher confidence (e.g. "vpn.acme.com")
            is_corporate_pattern = bool(_PTR_CORPORATE_RE.search(hostname))
            domain_conf = 0.60 if is_corporate_pattern else 0.50

            # Set domain if not yet known and it isn't an ISP domain
            if not resolution.get("domain") and not is_isp_or_cloud(ptr_domain, self._isp_allowlist):
                resolution["domain"] = ptr_domain
                resolution["confidence"] = max(resolution.get("confidence", 0), domain_conf)
                logger.info("[Enrichment] PTR: %s → domain=%s (corporate=%s)", hostname, ptr_domain, is_corporate_pattern)

            # Derive company name from the registered domain (2nd-level, e.g. "acme" from "vpn.acme.com")
            if not resolution.get("company") and not is_isp_or_cloud(ptr_domain, self._isp_allowlist):
                raw = parts[-2].replace("-", " ").replace("_", " ").strip()
                if len(raw) > 2:
                    company_hint = _normalize_company_name(raw.title()) or raw.title()
                    resolution["company"] = company_hint
                    resolution["confidence"] = max(resolution.get("confidence", 0), 0.45 if not is_corporate_pattern else 0.55)
                    logger.info("[Enrichment] PTR company hint: %s (corporate=%s)", company_hint, is_corporate_pattern)
        except asyncio.TimeoutError:
            pass
        except (socket.herror, socket.gaierror, OSError):
            pass
        except Exception as e:
            logger.debug("[Enrichment] PTR lookup error for %s: %s", ip, e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 5.5: RDAP lookup — free registrant org for IP block (no API key)
    # RDAP is the modern replacement for WHOIS. rdap.org is a public resolver.
    # Used as final fallback after all paid APIs have run.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_rdap_lookup(self, ip: str, resolution: Dict[str, Any]) -> None:
        # Skip if company already identified with reasonable confidence
        if resolution.get("company") and resolution.get("confidence", 0) >= 0.60:
            return
        try:
            resp = await self.http.get(
                f"https://rdap.org/ip/{ip}",
                headers={"Accept": "application/rdap+json"},
                timeout=httpx.Timeout(5.0),
            )
            if resp.status_code != 200:
                return
            data = resp.json()
            org_name = (data.get("name") or "").strip()
            # Also scan remarks for human-readable org descriptions
            if not org_name:
                for remark in (data.get("remarks") or []):
                    for desc in (remark.get("description") or []):
                        candidate = (desc or "").strip()
                        if candidate and len(candidate) > 3 and not candidate.startswith("http"):
                            org_name = candidate
                            break
                    if org_name:
                        break
            if not org_name or is_isp_or_cloud(org_name, self._isp_allowlist):
                return
            canonical = _normalize_company_name(org_name) or org_name
            if not resolution.get("company"):
                resolution["company"] = canonical
                resolution["confidence"] = max(resolution.get("confidence", 0), 0.50)
            resolution["_rdap_org"] = canonical
            resolution["_sources"].append("rdap")
            logger.info("[Enrichment] IP RDAP: %s → org=%s", ip, canonical)
        except Exception as e:
            logger.debug("[Enrichment] RDAP lookup error for %s: %s", ip, e)

    # ─────────────────────────────────────────────────────────────────────────
    # MX validation — confirm a domain has real corporate MX records
    # PTR / ip-api sometimes return ISP reverse-hostnames that look like domains.
    # A real business always has MX records.  Zero API cost — pure DNS.
    # ─────────────────────────────────────────────────────────────────────────

    async def _validate_mx_domain(self, domain: str) -> bool:
        """Return True if `domain` has at least one MX record."""
        try:
            import dns.resolver
            loop = asyncio.get_event_loop()
            answers = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: list(dns.resolver.resolve(domain, "MX"))
                ),
                timeout=3.0,
            )
            return len(answers) > 0
        except Exception:
            return False

    # ─────────────────────────────────────────────────────────────────────────
    # Step 0: ip-api.com — accurate geo (no API key, 45 req/min free)
    # More accurate than IPinfo free for Asia/India because it uses multiple
    # geo databases and has city-level accuracy ~80% globally vs IPinfo ~55%.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_ipapi(self, ip: str, resolution: Dict[str, Any]) -> None:
        logger.info("[Enrichment] Step 0: ip-api.com geo for %s", ip)
        try:
            fields = "status,message,country,countryCode,regionName,city,district,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting"
            resp = await self.http.get(
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
            as_str = data.get("as") or ""   # e.g. "AS12345 Televentures Ltd"
            org_name = None
            if org and " " in org:
                org_name = org.split(" ", 1)[1].strip()
            elif isp:
                org_name = isp

            resolution["_ipapi_isp"] = isp
            resolution["_ipapi_org"] = org_name
            resolution["_ipapi_as"] = as_str
            resolution["_is_mobile"] = is_mobile
            resolution["_is_proxy"] = is_proxy
            resolution["_is_hosting"] = is_hosting

            # Only use org as company if it's NOT a consumer ISP / cloud
            if org_name and not is_isp_or_cloud(org_name, self._isp_allowlist) and not is_mobile and not is_hosting:
                # Normalise name before storing — strips "Ltd", "Inc", etc.
                canonical = _normalize_company_name(org_name) or org_name
                if not resolution.get("company"):
                    resolution["company"] = canonical
                    resolution["confidence"] = max(resolution["confidence"], 0.35)
                    logger.info("[Enrichment] Step 0: org from ip-api = %s", canonical)
                # Cache ASN → company so future IPs from same corporate AS resolve instantly
                if as_str:
                    await self._cache_asn_company(as_str, canonical)
            elif not resolution.get("company") and as_str:
                # Even if this visit is ISP, check if another visitor from same ASN
                # was previously identified as corporate (e.g. VPN exiting via same AS)
                cached_asn_company = await self._get_cached_asn_company(as_str)
                if cached_asn_company:
                    resolution["company"] = cached_asn_company
                    resolution["confidence"] = max(resolution["confidence"], 0.50)
                    resolution["_sources"].append("asn_cache")
                    logger.info("[Enrichment] ASN cache HIT: %s → %s", as_str, cached_asn_company)

            # Check for Cloud/Bot ASNs
            if org_name and any(noise in org_name.upper() for noise in NOISE_ASN_ORGS):
                resolution["bot_score"] += NOISE_INDICATORS["cloud_asn"]
            if is_hosting or data.get("type", "") == "datacenter":
                resolution["bot_score"] += NOISE_INDICATORS["datacenter_ip"]
                
            # Post-geo bot block
            if resolution["bot_score"] >= 40:
                logger.info("[Enrichment] IP %s flagged as Noise/Datacenter (score=%s)", ip, resolution["bot_score"])

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

            if org_name and is_isp_or_cloud(org_name, self._isp_allowlist):
                logger.info("[Enrichment] Step 1: IPinfo org is ISP/cloud (%s) — skipping", org_name)
                org_name = None
                domain = None

            if org_name and not resolution.get("company"):
                resolution["company"] = _normalize_company_name(org_name) or org_name
                resolution["ipinfo_company"] = {"name": resolution["company"]}
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
            resp = await self.http.get(
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

            if is_isp_or_cloud(company_name, self._isp_allowlist) or is_isp_or_cloud(company_domain, self._isp_allowlist):
                logger.info("[Enrichment] Step 2: Enrich.so result is ISP/cloud (%s) — skipping", company_name)
                return

            # Enrich.so is a stronger signal than IPinfo — overwrite with its result
            canonical_name = _normalize_company_name(company_name) or company_name
            if canonical_name:
                resolution["company"] = canonical_name
            if company_domain:
                resolution["domain"] = company_domain

            resolution["enrich_company"] = {
                "name": canonical_name,
                "company_name": canonical_name,
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
            resp = await self.http.get(
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
    # Step 5: Explorium — full company enrichment pipeline
    #
    # Phase 1 — Match: /businesses/match by domain (preferred) or company name
    #            Returns business_id + basic profile from /businesses
    # Phase 2 — Modules (parallel via enrich_company_fully):
    #            /businesses/firmographics/enrich  → employees, revenue, industry,
    #                                                HQ, company type, logo, LinkedIn URL
    #            /businesses/funding_and_acquisition/enrich → investors, stage, total
    #            /businesses/financial_indicators/enrich    → revenue exact, competitors
    #            /businesses/technographics/enrich          → full tech stack
    # Phase 3 — LinkedIn posts: /businesses/linkedin_posts/enrich
    #            → recent posts, follower count, engagement signals
    #
    # Explorium is the highest-trust source — its company name always wins.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_explorium(self, resolution: Dict[str, Any]) -> None:
        domain = resolution.get("domain")
        company = resolution.get("company")
        if not domain and not company:
            logger.info("[Enrichment] Step 5: No domain or company — skipping Explorium")
            return
        logger.info("[Enrichment] Step 5: Explorium full enrichment (domain=%s, company=%s)", domain, company)
        try:
            # ── Phase 1: Match + basic profile ───────────────────────────────
            if domain:
                result = await self.explorium.search_companies({"domain": domain}, limit=1)
                confidence_bump = 0.9
            else:
                result = await self.explorium.search_companies({"name": company}, limit=1)
                confidence_bump = 0.8

            companies = result.get("companies") or []
            if not companies:
                logger.info("[Enrichment] Step 5: Explorium no match for domain=%s name=%s", domain, company)
                return

            exp = dict(companies[0])
            if exp.get("name"):
                exp["name"] = _normalize_company_name(exp["name"]) or exp["name"]

            business_id = exp.get("business_id") or exp.get("id")
            is_real_bid = bool(business_id) and not str(business_id).startswith("temp_")

            # ── Phase 2: Full module enrichment ──────────────────────────────
            # enrich_company_fully runs firmographics + funding + financials +
            # technographics in sequence and merges all results.
            if is_real_bid:
                try:
                    exp = await self.explorium.enrich_company_fully(exp)
                    logger.info("[Enrichment] Step 5: enrich_company_fully done for %s", business_id)
                except Exception as e:
                    logger.warning("[Enrichment] Step 5: enrich_company_fully failed for %s: %s", business_id, e)

            # ── Phase 3: LinkedIn posts enrichment ───────────────────────────
            if is_real_bid:
                try:
                    lp = await self.explorium.enrich_linkedin_posts(business_id)
                    lp_data = (lp or {}).get("data") or {}
                    if lp_data:
                        posts = lp_data.get("posts") or lp_data.get("linkedin_posts") or []
                        followers = (
                            lp_data.get("followers")
                            or lp_data.get("company_followers")
                            or lp_data.get("follower_count")
                        )
                        if posts:
                            exp["linkedin_posts"] = posts[:10]  # keep last 10 posts
                        if followers:
                            exp["linkedin_followers"] = followers
                        logger.info("[Enrichment] Step 5: LinkedIn posts=%d followers=%s",
                                    len(posts), followers)
                except Exception as e:
                    logger.debug("[Enrichment] Step 5: LinkedIn posts failed for %s: %s", business_id, e)

            # ── Merge into resolution ─────────────────────────────────────────
            resolution["explorium"] = exp

            # Explorium is highest-trust source — its company name always wins
            if exp.get("name"):
                resolution["company"] = exp["name"]

            # Propagate domain (Explorium has the canonical registered domain)
            if exp.get("domain") and not resolution.get("domain"):
                resolution["domain"] = exp["domain"]

            # LinkedIn URL from Explorium firmographics
            if exp.get("linkedin_url") and not resolution.get("linkedin_url"):
                resolution["linkedin_url"] = exp["linkedin_url"]

            # Logo URL
            if exp.get("logo_url") and not resolution.get("logo_url"):
                resolution["logo_url"] = exp["logo_url"]

            # Tech stack at top level for easy downstream access
            if exp.get("technologies"):
                resolution["tech_stack"] = list(exp["technologies"])[:30]

            resolution["_sources"].append("explorium")
            resolution["confidence"] = max(resolution["confidence"], confidence_bump)
            logger.info(
                "[Enrichment] Step 5 success: %s | industry=%s | employees=%s | techs=%d | linkedin=%s",
                exp.get("name"),
                exp.get("industry"),
                exp.get("employee_count_range"),
                len(exp.get("technologies") or []),
                bool(exp.get("linkedin_url")),
            )

        except Exception as e:
            logger.warning("[Enrichment] Step 5: Explorium failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 5b: Hunter.io — domain → company email pattern + person lookup
    # Used when we have a domain but no person email.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_hunter_io(self, resolution: Dict[str, Any]) -> None:
        hunter_key = getattr(settings, "HUNTER_API_KEY", None)
        if not hunter_key:
            return
        domain = resolution.get("domain")
        if not domain:
            return
        # Only run Hunter if we don't already have a person
        if resolution.get("email") and resolution.get("full_name"):
            return
        logger.info("[Enrichment] Step 5b: Hunter.io domain search for %s", domain)
        try:
            resp = await self.http.get(
                "https://api.hunter.io/v2/domain-search",
                params={
                    "domain": domain,
                    "limit": 5,
                    "type": "personal",
                    "api_key": hunter_key,
                },
            )
            if resp.status_code != 200:
                return
            data = resp.json().get("data") or {}
            company = data.get("organization") or data.get("company")
            if company and not resolution.get("company"):
                resolution["company"] = company
            # If domain had no company data yet, try to get it from Hunter meta
            if not resolution.get("explorium"):
                emails = data.get("emails") or []
                # Extract top decision-maker leads as company contacts hint
                dm_hints = []
                for e in emails[:5]:
                    if e.get("type") == "personal" or e.get("confidence", 0) >= 70:
                        dm_hints.append({
                            "full_name": f"{e.get('first_name', '')} {e.get('last_name', '')}".strip(),
                            "job_title": e.get("position") or e.get("department"),
                            "email": e.get("value"),
                            "linkedin_url": e.get("linkedin"),
                        })
                if dm_hints and not resolution.get("decision_makers"):
                    resolution["decision_makers"] = dm_hints
            resolution["_sources"].append("hunter_io")
            resolution["confidence"] = max(resolution["confidence"], 0.55)
            logger.info("[Enrichment] Step 5b: Hunter.io company=%s leads=%d", company, len(data.get("emails", [])))
        except Exception as e:
            logger.warning("[Enrichment] Step 5b: Hunter.io failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Step 5c: Clearbit Enrichment API — company + person lookup
    # Free tier: company data by domain; paid: email → person profile.
    # Used as an additional company-level fallback when Explorium and Enrich.so
    # return nothing.
    # ─────────────────────────────────────────────────────────────────────────

    async def _step_clearbit_company(self, resolution: Dict[str, Any]) -> None:
        clearbit_key = getattr(settings, "CLEARBIT_API_KEY", None)
        if not clearbit_key:
            return
        domain = resolution.get("domain")
        if not domain:
            return
        # Only run if Explorium didn't return firmographic data
        if resolution.get("explorium"):
            return
        logger.info("[Enrichment] Step 5c: Clearbit company lookup for %s", domain)
        try:
            resp = await self.http.get(
                f"https://company.clearbit.com/v2/companies/find",
                params={"domain": domain},
                headers={"Authorization": f"Bearer {clearbit_key}"},
            )
            if resp.status_code not in (200, 201):
                return
            data = resp.json()
            company_name = data.get("name")
            if not company_name:
                return
            if not resolution.get("company"):
                resolution["company"] = company_name
            # Build a minimal firmographics dict compatible with explorium shape
            resolution["explorium"] = {
                "name": company_name,
                "domain": data.get("domain") or domain,
                "industry": data.get("category", {}).get("industry") or data.get("category", {}).get("sector"),
                "employee_count_exact": data.get("metrics", {}).get("employees"),
                "employee_count_range": data.get("metrics", {}).get("employeesRange"),
                "revenue_range": str(data.get("metrics", {}).get("estimatedAnnualRevenue") or ""),
                "headquarters_city": (data.get("geo") or {}).get("city"),
                "headquarters_country": (data.get("geo") or {}).get("country"),
                "linkedin_url": data.get("linkedin", {}).get("handle") and f"https://linkedin.com/company/{data['linkedin']['handle']}",
                "description": data.get("description"),
                "technologies": [t.get("name") for t in (data.get("tech") or [])[:10] if t.get("name")],
                "website": data.get("url") or f"https://{domain}",
                "logo_url": data.get("logo"),
            }
            if data.get("logo") and not resolution.get("logo_url"):
                resolution["logo_url"] = data["logo"]
            resolution["_sources"].append("clearbit_company")
            resolution["confidence"] = max(resolution["confidence"], 0.75)
            logger.info("[Enrichment] Step 5c: Clearbit company=%s", company_name)
        except Exception as e:
            logger.warning("[Enrichment] Step 5c: Clearbit company failed: %s", e)

    # ── Identity graph lookup ────────────────────────────────────────────────

    async def _step_identity_graph_lookup(
        self, ip: str, visitor_id: Optional[str], email: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Identity resolution cascade (best signal first):
          1. exact visitor_id  — same browser, same org
          2. cross-org fingerprint — same browser fingerprint seen on any org's site
          3. /24 subnet match — different device, same corporate NAT → company only
          4. exact IP match
          5. email match
        """
        try:
            from app.db.session import SessionLocal
            from app.db.models.identity_graph import IdentityNode
            from sqlalchemy import text
            db = SessionLocal()
            try:
                node = None

                # 1. Exact visitor_id — most reliable signal
                if visitor_id:
                    node = db.query(IdentityNode).filter(
                        IdentityNode.visitor_id == visitor_id
                    ).first()

                # 2. Cross-org fingerprint (RB2B-style)
                # Same physical device visited a different customer's site previously.
                # Re-use the stored identity — zero API cost.
                if not node and self._fp:
                    row = db.execute(
                        text("""
                            SELECT * FROM identity_nodes
                            WHERE raw_data->>'fingerprint' = :fp
                              AND full_name IS NOT NULL
                            ORDER BY last_seen_at DESC
                            LIMIT 1
                        """),
                        {"fp": self._fp},
                    ).mappings().first()
                    if row:
                        d = dict(row)
                        logger.info(
                            "[Enrichment] Cross-org fp match: fp=%s → %s",
                            self._fp[:8], d.get("full_name"),
                        )
                        return {
                            "full_name": d.get("full_name"),
                            "email": d.get("email"),
                            "phone": d.get("phone"),
                            "linkedin_url": d.get("linkedin_url"),
                            "job_title": d.get("job_title"),
                            "company_name": d.get("company_name"),
                            "company_domain": d.get("company_domain"),
                            "_cross_org": True,
                        }

                # 3. /24 subnet clustering — corporate NAT assigns many devices
                # the same /24. We carry company info only, not personal identity.
                if not node and ip and "." in ip:
                    subnet_prefix = ".".join(ip.split(".")[:3]) + "."
                    row = db.execute(
                        text("""
                            SELECT company_name, company_domain
                            FROM identity_nodes
                            WHERE ip::text LIKE :prefix
                              AND company_name IS NOT NULL
                            ORDER BY last_seen_at DESC
                            LIMIT 1
                        """),
                        {"prefix": subnet_prefix + "%"},
                    ).mappings().first()
                    if row and row["company_name"]:
                        logger.info(
                            "[Enrichment] /24 subnet match: %s → company=%s",
                            ip, row["company_name"],
                        )
                        return {
                            "company_name": row["company_name"],
                            "company_domain": row["company_domain"],
                            "_subnet_match": True,
                        }

                # 4. Exact IP match
                if not node and ip:
                    node = db.query(IdentityNode).filter(IdentityNode.ip == ip).first()

                # 5. Email match
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
                    # Update existing — fill empty fields
                    if ip:
                        node.ip = ip
                    # Email from form capture always wins (explicit identification)
                    form_email = resolution.get("email")
                    if form_email and form_email != node.email:
                        node.email = form_email
                    for attr, res_key in [
                        ("full_name", "full_name"),
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
                    node.sources = list(set(existing_sources + new_sources))
                    # Store fingerprint in raw_data for cross-org matching
                    if self._fp:
                        raw = dict(node.raw_data or {})
                        raw["fingerprint"] = self._fp
                        node.raw_data = raw
                else:
                    raw_data: Dict[str, Any] = {}
                    if self._fp:
                        raw_data["fingerprint"] = self._fp
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
                        raw_data=raw_data,
                    )
                    db.add(node)
                db.commit()
                logger.info("[Enrichment] Identity graph STORED for visitor_id=%s fp=%s", visitor_id, bool(self._fp))
            finally:
                db.close()
        except Exception as e:
            logger.warning("[Enrichment] Identity graph store failed: %s", e)

    # ─────────────────────────────────────────────────────────────────────────
    # Redis domain cache — avoid redundant API calls for same company
    # ─────────────────────────────────────────────────────────────────────────

    CACHE_TTL = 72 * 3600        # 72 hours for domain enrichment
    ASN_CACHE_TTL = 24 * 3600   # 24 hours for ASN → company mapping

    # ── ASN → company name Redis cache ────────────────────────────────────────

    async def _get_cached_asn_company(self, as_str: str) -> Optional[str]:
        """Return cached company name for this ASN, or None."""
        if not as_str:
            return None
        asn = as_str.split()[0]  # "AS12345"
        try:
            redis = RedisManager.get_client()
            val = await redis.get(f"enrich:asn:{asn}")
            return val.decode() if isinstance(val, bytes) else val
        except Exception:
            return None

    async def _cache_asn_company(self, as_str: str, company_name: str) -> None:
        """Cache ASN → company name for 24 hours."""
        if not as_str or not company_name:
            return
        asn = as_str.split()[0]
        try:
            redis = RedisManager.get_client()
            await redis.set(f"enrich:asn:{asn}", company_name, ex=self.ASN_CACHE_TTL)
        except Exception:
            pass

    # ── Domain enrichment Redis cache ─────────────────────────────────────────

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
