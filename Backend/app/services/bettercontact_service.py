"""
BetterContact Waterfall Enrichment Service.
Async API: submit enrichment → poll for results.
Finds verified work emails and phone numbers.
"""

import os
import json
import httpx
import asyncio
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

BETTERCONTACT_BASE = "https://app.bettercontact.rocks/api/v2"


class BetterContactService:
    def __init__(self):
        self.api_key = os.getenv("BETTERCONTACT_API_KEY")
        if not self.api_key:
            logger.warning("BETTERCONTACT_API_KEY not set")

    def _headers(self) -> Dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def enrich_prospect(
        self,
        first_name: str,
        last_name: str,
        company_name: str = "",
        company_domain: str = "",
        linkedin_url: str = "",
        field: str = "email",
    ) -> Dict[str, Any]:
        """
        Enrich a single prospect to find verified email + phone.
        Uses BetterContact async API: POST to create, then poll GET for results.
        """
        if not self.api_key:
            return {"success": False, "error": "BETTERCONTACT_API_KEY not set"}

        # Build the contact payload
        contact = {
            "first_name": first_name,
            "last_name": last_name,
        }
        if company_name:
            contact["company_name"] = company_name
        if company_domain:
            contact["company_domain"] = company_domain
        if linkedin_url:
            contact["linkedin_url"] = linkedin_url

        payload = {
            "data": [contact],
            "enrich_email": field == "email" or field not in ("email", "phone"),
            "enrich_phone": field == "phone" or field not in ("email", "phone"),
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Step 1: Submit enrichment request
                res = await client.post(
                    f"{BETTERCONTACT_BASE}/async",
                    headers=self._headers(),
                    json=payload,
                )

                if res.status_code not in (200, 201):
                    logger.error(f"BetterContact submit error: {res.status_code} {res.text[:300]}")
                    return {"success": False, "error": f"Submit failed: {res.status_code}"}

                submit_data = res.json()
                request_id = submit_data.get("request_id") or submit_data.get("id")
                if not request_id:
                    logger.error(f"BetterContact: no request_id in response: {submit_data}")
                    return {"success": False, "error": "No request_id returned"}

                logger.info(f"BetterContact enrichment submitted: {request_id}")

                # Step 2: Poll for results (max 60s, every 3s)
                for attempt in range(20):
                    await asyncio.sleep(3)
                    poll_res = await client.get(
                        f"{BETTERCONTACT_BASE}/async/{request_id}",
                        headers=self._headers(),
                    )

                    if poll_res.status_code != 200:
                        continue

                    poll_data = poll_res.json()
                    status = poll_data.get("status", "")

                    if status == "terminated":
                        data_list = poll_data.get("data", [])
                        if data_list and len(data_list) > 0:
                            enriched = data_list[0]
                            return {
                                "success": True,
                                "email": enriched.get("contact_email_address") or "",
                                "email_status": enriched.get("contact_email_address_status") or "",
                                "phone": enriched.get("contact_phone_number") or enriched.get("contact_mobile_phone") or "",
                                "email_provider": enriched.get("email_provider") or "",
                                "credits_consumed": poll_data.get("credits_consumed", 0),
                                "credits_left": poll_data.get("credits_left", 0),
                            }
                        return {"success": True, "email": "", "phone": "", "not_found": True}

                    if status in ("failed", "error"):
                        return {"success": False, "error": f"Enrichment failed: {status}"}

                # Timeout
                return {"success": False, "error": "Enrichment timed out after 60s"}

        except httpx.TimeoutException:
            logger.error("BetterContact request timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"BetterContact error: {e}")
            return {"success": False, "error": str(e)}

    async def enrich_company(
        self,
        company_name: str,
        company_domain: str = "",
    ) -> Dict[str, Any]:
        """
        Enrich a company by finding a generic contact.
        BetterContact is person-centric, so we search for a contact at the company.
        """
        if not self.api_key:
            return {"success": False, "error": "BETTERCONTACT_API_KEY not set"}

        # Use lead_finder to find contacts at this company
        payload = {
            "filters": {
                "company": {
                    "include": [company_domain] if company_domain else [company_name]
                },
                "lead_seniority": {
                    "include": ["c_suite", "vp", "director", "head", "owner", "founder"]
                }
            },
            "max_leads": 1,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                # Step 1: Submit lead finder request
                res = await client.post(
                    f"{BETTERCONTACT_BASE}/lead_finder/async",
                    headers=self._headers(),
                    json=payload,
                )

                if res.status_code not in (200, 201, 202):
                    logger.error(f"BetterContact lead_finder error: {res.status_code} {res.text[:300]}")
                    return {"success": False, "error": f"Lead finder failed: {res.status_code}"}

                submit_data = res.json()
                request_id = submit_data.get("request_id") or submit_data.get("id")
                if not request_id:
                    return {"success": False, "error": "No request_id returned"}

                logger.info(f"BetterContact lead_finder submitted: {request_id}")

                # Step 2: Poll for results
                for attempt in range(10):
                    await asyncio.sleep(3)
                    poll_res = await client.get(
                        f"{BETTERCONTACT_BASE}/lead_finder/async/{request_id}",
                        headers=self._headers(),
                    )

                    if poll_res.status_code != 200:
                        logger.warning(f"BetterContact lead_finder poll attempt {attempt + 1}: HTTP {poll_res.status_code}")
                        continue

                    poll_data = poll_res.json()
                    status = poll_data.get("status", "")
                    logger.info(f"BetterContact lead_finder poll attempt {attempt + 1}: status={status}")

                    if status == "terminated":
                        leads = poll_data.get("leads", [])
                        logger.info(f"BetterContact lead_finder terminated: found {len(leads)} leads")
                        if leads and len(leads) > 0:
                            lead = leads[0]
                            return {
                                "success": True,
                                "contact_name": lead.get("contact_full_name") or "",
                                "contact_title": lead.get("contact_job_title") or "",
                                "email": lead.get("contact_email_address") or "",
                                "phone": lead.get("contact_phone_number") or lead.get("contact_mobile_phone") or "",
                                "linkedin_url": lead.get("contact_linkedin_url") or "",
                                "credits_consumed": poll_data.get("credits_consumed", 0),
                                "credits_left": poll_data.get("credits_left", 0),
                            }
                        return {"success": True, "email": "", "phone": "", "not_found": True}

                    if status in ("failed", "error"):
                        logger.error(f"BetterContact lead_finder failed: {status}")
                        return {"success": False, "error": f"Lead finder failed: {status}"}

                logger.warning(f"BetterContact lead_finder timed out after 30s for request {request_id}")
                return {"success": False, "error": "Lead finder timed out after 30s"}

        except httpx.TimeoutException:
            logger.error("BetterContact lead_finder timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"BetterContact lead_finder error: {e}")
            return {"success": False, "error": str(e)}
