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
        Enrich visitor IP with company and person data.
        """
        resolution = {
            "ip": ip,
            "company": None,
            "domain": None,
            "geo": None,
            "confidence": 0.0,
            "person": None,
            "intent_score": intent_score
        }

        try:
            # 1. IPinfo lookup (Geo + Basic Company)
            if self.ipinfo_client:
                logger.info(f"Visiting IPinfo for {ip}")
                # details = self.ipinfo_client.getDetails(ip) # Synchronous!
                # For now let's keep it but add try/except and logging
                try:
                    import asyncio
                    from functools import partial
                    loop = asyncio.get_event_loop()
                    details = await loop.run_in_executor(None, partial(self.ipinfo_client.getDetails, ip))
                    
                    logger.info(f"IPinfo success for {ip}: {getattr(details, 'org', 'No Org')}")
                    resolution.update({
                        "company": getattr(details, 'org', None),
                        "domain": getattr(details, 'hostname', None),
                        "geo": {
                            "city": getattr(details, 'city', None),
                            "region": getattr(details, 'region', None),
                            "country": getattr(details, 'country', None),
                        },
                        "confidence": 0.5
                    })
                except Exception as e:
                    logger.error(f"IPinfo lookup failed: {e}")

            # 2. Enrich.so lookup (IP to Person/Email) for high intent
            if (intent_score > 0.7 or any(x in url.lower() for x in ["/pricing", "/demo", "/contact"])) and self.enrich_api_key:
                enrich_data = await self._enrich_so_lookup(ip)
                if enrich_data and enrich_data.get("data"):
                    person_data = enrich_data["data"]
                    resolution["person"] = person_data
                    resolution["confidence"] = 0.8
                    
                    # If we got a domain from Enrich.so, use it
                    if person_data.get("company_domain"):
                        resolution["domain"] = person_data["company_domain"]
                    if person_data.get("company_name"):
                        resolution["company"] = person_data["company_name"]

            # 3. Explorium Enrichment for Company details if domain exists
            if resolution["domain"]:
                try:
                    explorium_data = await self.explorium.search_companies({"domain": resolution["domain"]}, limit=1)
                    if explorium_data.get("companies"):
                        company = explorium_data["companies"][0]
                        resolution["explorium"] = company
                        resolution["confidence"] = max(resolution["confidence"], 0.9)
                        # Optionally update company name from explorium
                        resolution["company"] = company.get("name") or resolution["company"]
                except Exception as e:
                    logger.error(f"Explorium enrichment failed for {resolution['domain']}: {e}")

        except Exception as e:
            logger.error(f"Visitor enrichment failed for IP {ip}: {e}")
        
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
                    "https://api.enrich.so/ip-to-person", # Adjust endpoint based on actual API docs if needed
                    json={"ip": ip},
                    headers={"Authorization": f"Bearer {self.enrich_api_key}"},
                    timeout=10.0
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.warning(f"Enrich.so API error: {response.status_code} - {response.text}")
        except Exception as e:
            logger.error(f"Enrich.so API call failed: {e}")
        
        return None
