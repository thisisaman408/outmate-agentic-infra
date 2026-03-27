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
from app.core.config import settings

logger = logging.getLogger(__name__)

BETTERCONTACT_BASE = "https://app.bettercontact.rocks/api/v2"


class BetterContactService:
    def __init__(self):
        self.api_key = getattr(settings, 'BETTERCONTACT_API_KEY', None) or os.getenv("BETTERCONTACT_API_KEY")
        if not self.api_key:
            logger.warning("BETTERCONTACT_API_KEY not set")

    def _headers(self) -> Dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def enrich_prospect(
        self,
        first_name: str = "",
        last_name: str = "",
        email: str = "",
        company_name: str = "",
        company_domain: str = "",
        linkedin_url: str = "",
        field: str = "email",
        _is_fallback: bool = False,
    ) -> Dict[str, Any]:
        """
        Enrich a single prospect to find verified email + phone.
        Uses BetterContact async API: POST to create, then poll GET for results.
        """
        if not self.api_key:
            return {"success": False, "error": "BETTERCONTACT_API_KEY not set"}

        # Build the contact payload
        contact = {}
        if first_name:
            contact["first_name"] = first_name
        if last_name:
            contact["last_name"] = last_name
        if email:
            contact["email"] = email
        if company_name:
            contact["company"] = company_name
        if company_domain:
            contact["company_domain"] = company_domain
        if linkedin_url:
            contact["linkedin_url"] = linkedin_url

        payload = {
            "data": [contact],
            "enrich_email_address": True,
            "enrich_phone_number": True,
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
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

                print(f">>> [BetterContact] enrich_prospect submitted: {request_id} (contact: {first_name} {last_name}, company: {company_name}, domain: {company_domain}, linkedin: {linkedin_url}, is_fallback: {_is_fallback})", flush=True)

                # Step 2: Poll for results (60s window to let BetterContact search all sources)
                for attempt in range(24):
                    await asyncio.sleep(2.5)
                    poll_res = await client.get(
                        f"{BETTERCONTACT_BASE}/async/{request_id}",
                        headers=self._headers(),
                    )

                    if poll_res.status_code != 200:
                        print(f">>> [BetterContact] enrich_prospect poll {attempt+1}: HTTP {poll_res.status_code}", flush=True)
                        continue

                    poll_data = poll_res.json()
                    status = poll_data.get("status", "")
                    print(f">>> [BetterContact] enrich_prospect poll {attempt+1}: status={status}", flush=True)

                    if status == "terminated":
                        data_list = poll_data.get("data", [])
                        if data_list and len(data_list) > 0:
                            enriched = data_list[0]
                            email = enriched.get("contact_email_address") or ""
                            phone = enriched.get("contact_phone_number") or enriched.get("contact_mobile_phone") or ""
                            first_name = enriched.get("contact_first_name") or ""
                            last_name = enriched.get("contact_last_name") or ""
                            full_name = enriched.get("contact_full_name") or f"{first_name} {last_name}".strip()
                            
                            print(f">>> [BetterContact] enrich_prospect result: name={full_name}, email={bool(email)}, phone={bool(phone)}, status={enriched.get('contact_email_address_status')}", flush=True)
                            
                            credits_consumed = poll_data.get("credits_consumed", 0)
                            credits_left = poll_data.get("credits_left", 0)
                            
                            return {
                                "success": True,
                                "email": email,
                                "email_status": enriched.get("contact_email_address_status") or "",
                                "phone": phone,
                                "first_name": first_name,
                                "last_name": last_name,
                                "full_name": full_name,
                                "job_title": enriched.get("contact_job_title") or "",
                                "linkedin_url": enriched.get("contact_linkedin_profile_url") or enriched.get("contact_linkedin_url") or "",
                                "email_provider": enriched.get("email_provider") or "",
                                "credits_consumed": credits_consumed,
                                "credits_left": credits_left,
                                "raw_data": enriched
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

        # Use company domain/name filter with seniority to find decision-makers
        filters = {
            "company": {
                "include": [company_domain] if company_domain else [company_name]
            },
            "lead_seniority": {
                "include": ["director", "vp", "c-level", "founder", "manager", "senior"]
            },
        }

        payload = {
            "filters": filters,
            "max_leads": 5,
        }

        try:
            async with httpx.AsyncClient(timeout=120) as client:
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

                # Step 2: Poll for results (60s window to let BetterContact search all sources)
                for attempt in range(24):
                    await asyncio.sleep(2.5)
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
                            lead = next((l for l in leads if l.get("contact_email_address") or l.get("contact_phone_number") or l.get("contact_mobile_phone")), leads[0])
                            contact_email = lead.get("contact_email_address") or ""
                            contact_phone = lead.get("contact_phone_number") or lead.get("contact_mobile_phone") or ""
                            if not contact_email and not contact_phone:
                                logger.info("BetterContact lead lacks email+phone, invoking prospect fallback",
                                            extra={"lead_id": lead.get("contact_id"), "company": company_name})
                                prospect_first_name = lead.get("contact_first_name") or ""
                                prospect_last_name = lead.get("contact_last_name") or ""
                                if not prospect_first_name and not prospect_last_name:
                                    full_name = lead.get("contact_full_name", "") or ""
                                    name_parts = [p for p in full_name.split() if p]
                                    if name_parts:
                                        prospect_first_name = name_parts[0]
                                        prospect_last_name = name_parts[-1] if len(name_parts) > 1 else ""
                                    else:
                                        prospect_first_name = company_name
                                prospect_result = await self.enrich_prospect(
                                    first_name=prospect_first_name,
                                    last_name=prospect_last_name,
                                    company_name=company_name,
                                    company_domain=company_domain,
                                    linkedin_url=lead.get("contact_linkedin_profile_url") or lead.get("contact_linkedin_url") or "",
                                    _is_fallback=True,
                                )
                                logger.info("BetterContact prospect fallback result triggered",
                                            extra={
                                                "lead_id": lead.get("contact_id"),
                                                "company": company_name,
                                                "email": prospect_result.get("email"),
                                                "phone": prospect_result.get("phone"),
                                            })
                                contact_email = prospect_result.get("email") or ""
                                if not contact_phone:
                                    contact_phone = prospect_result.get("phone") or ""
                                credits_consumed = prospect_result.get("credits_consumed") or poll_data.get("credits_consumed", 0)
                                credits_left = prospect_result.get("credits_left") or poll_data.get("credits_left", 0)
                            else:
                                credits_consumed = poll_data.get("credits_consumed", 0)
                                credits_left = poll_data.get("credits_left", 0)
                            return {
                                "success": True,
                                "contact_name": lead.get("contact_full_name") or "",
                                "contact_title": lead.get("contact_job_title") or "",
                                "email": contact_email,
                                "phone": contact_phone,
                                "linkedin_url": lead.get("contact_linkedin_profile_url") or lead.get("contact_linkedin_url") or "",
                                "credits_consumed": credits_consumed,
                                "credits_left": credits_left,
                            }
                        return {"success": True, "email": "", "phone": "", "not_found": True}

                    if status in ("failed", "error"):
                        logger.error(f"BetterContact lead_finder failed: {status}")
                        return {"success": False, "error": f"Lead finder failed: {status}"}

                logger.warning(f"BetterContact lead_finder timed out after 60s for request {request_id}")
                return {"success": False, "error": "Lead finder timed out after 60s"}

        except httpx.TimeoutException:
            logger.error("BetterContact lead_finder timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"BetterContact lead_finder error: {e}")
            return {"success": False, "error": str(e)}
