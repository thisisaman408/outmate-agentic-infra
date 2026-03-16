import httpx
import ipinfo
import logging
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.explorium_service import ExploriumService

logger = logging.getLogger(__name__)

class VisitorEnricher:
    def __init__(self):
        self.ipinfo_client = ipinfo.getHandler(settings.IPINFO_TOKEN) if hasattr(settings, 'IPINFO_TOKEN') else None
        self.enrich_api_key = getattr(settings, 'ENRICH_API_KEY', None)
        self.explorium = ExploriumService()

    async def enrich_ip(self, ip: str, url: str, intent_score: float) -> Dict[str, Any]:
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
            "email": None,
            "phone": None,
            "full_name": None,
            "linkedin_url": None,
            "job_title": None,
        }

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

                    logger.info(f"[Enrichment] IPinfo success: org={org}, domain={domain}, city={city}, country={country}")

                    # Only update confidence if we got usable data
                    got_data = bool(org or domain or city or country)
                    resolution.update({
                        "company": org,
                        "domain": domain,
                        "geo": {"city": city, "region": region, "country": country},
                        "confidence": 0.5 if got_data else 0.1,
                    })
                except Exception as e:
                    logger.error(f"[Enrichment] IPinfo lookup failed: {e}")

            # ──────────────────────────────────────────────
            # 2. Enrich.so (IP → Person/Email/Phone)
            # ──────────────────────────────────────────────
            is_high_intent = intent_score > 0.7 or any(
                x in url.lower() for x in ["/pricing", "/demo", "/contact", "/signup", "/book"]
            )
            should_enrich = bool(self.enrich_api_key)

            if should_enrich:
                logger.info(f"[Enrichment] Step 2: Enrich.so lookup for {ip} (high intent={is_high_intent})")
                enrich_data = await self._enrich_so_lookup(ip)
                
                if enrich_data and enrich_data.get("data"):
                    person_data = enrich_data["data"]
                    resolution["person"] = person_data
                    resolution["confidence"] = 0.8
                    
                    # Extract contact details from Enrich.so response
                    resolution["email"] = (
                        person_data.get("email") or 
                        person_data.get("work_email") or
                        person_data.get("personal_email")
                    )
                    resolution["phone"] = (
                        person_data.get("phone") or 
                        person_data.get("mobile_phone") or
                        person_data.get("work_phone")
                    )
                    resolution["full_name"] = (
                        person_data.get("full_name") or 
                        person_data.get("name") or
                        f"{person_data.get('first_name', '')} {person_data.get('last_name', '')}".strip()
                    )
                    resolution["linkedin_url"] = (
                        person_data.get("linkedin_url") or 
                        person_data.get("linkedin") or
                        person_data.get("linkedin_profile_url")
                    )
                    resolution["job_title"] = (
                        person_data.get("title") or 
                        person_data.get("job_title") or
                        person_data.get("position")
                    )
                    
                    # Company data from Enrich.so
                    if person_data.get("company_domain"):
                        resolution["domain"] = person_data["company_domain"]
                    if person_data.get("company_name"):
                        resolution["company"] = person_data["company_name"]
                    
                    logger.info(f"[Enrichment] Enrich.so found: {resolution['full_name']}, {resolution['email']}")
                else:
                    logger.info(f"[Enrichment] Enrich.so returned no data for {ip}")

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

    async def _enrich_so_lookup(self, ip: str) -> Optional[Dict[str, Any]]:
        """
        Call Enrich.so API for IP to Person/Email lookup.
        """
        if not self.enrich_api_key:
            return None
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.enrich.so/ip-to-person",
                    json={"ip": ip},
                    headers={"Authorization": f"Bearer {self.enrich_api_key}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"[Enrichment] Enrich.so API error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"[Enrichment] Enrich.so API call failed: {e}")
        
        return None
