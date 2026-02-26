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
                    
                    org = getattr(details, 'org', None)
                    hostname = getattr(details, 'hostname', None)
                    logger.info(f"[Enrichment] IPinfo success: org={org}, hostname={hostname}")
                    
                    resolution.update({
                        "company": org,
                        "domain": hostname,
                        "geo": {
                            "city": getattr(details, 'city', None),
                            "region": getattr(details, 'region', None),
                            "country": getattr(details, 'country', None),
                        },
                        "confidence": 0.5
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
            # 3. Explorium (Company firmographics via domain)
            # ──────────────────────────────────────────────
            if resolution["domain"]:
                logger.info(f"[Enrichment] Step 3: Explorium lookup for domain={resolution['domain']}")
                try:
                    explorium_data = await self.explorium.search_companies({"domain": resolution["domain"]}, limit=1)
                    if explorium_data.get("companies"):
                        company = explorium_data["companies"][0]
                        resolution["explorium"] = company
                        resolution["confidence"] = max(resolution["confidence"], 0.9)
                        resolution["company"] = company.get("name") or resolution["company"]
                        logger.info(f"[Enrichment] Explorium found: {company.get('name')}")
                except Exception as e:
                    logger.error(f"[Enrichment] Explorium enrichment failed for {resolution['domain']}: {e}")

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
