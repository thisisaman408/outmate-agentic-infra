"""
ContactOut API Routes - Company Enrichment & Contact Reveal
"""
import logging
import json
import sys
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
import httpx
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.services.contactout_service import ContactOutService

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Request/Response Models ─────────────────────────────────────────────────
class CompanyProfileRequest(BaseModel):
    domain: str


class RevealContactRequest(BaseModel):
    linkedin_url: str
    include_phone: bool = True


# ─── Endpoints ───────────────────────────────────────────────────────────────
@router.get("/company/{domain}")
async def get_company_profile(
    domain: str,
    db: Session = Depends(get_db)
):
    """
    Get full company profile (LinkedIn-style) with decision makers.
    Uses ContactOut to fill missing data from Crustdata.
    """
    try:
        contactout = ContactOutService()
        print(f">>> [Company Profile] Fetching for domain: {domain}", flush=True)
        # 1) Get company details from ContactOut
        try:
            enrichment_data = await contactout.enrich_companies_by_domain([domain])
        except httpx.HTTPStatusError as he:
            # Propagate ContactOut HTTP errors to the client with original status and body
            detail = he.response.text if he.response is not None else str(he)
            logger.error(f"ContactOut HTTP error for {domain}: {detail}")
            raise HTTPException(status_code=he.response.status_code if he.response is not None else 502, detail=detail)
        companies_data = enrichment_data.get("companies", {})

        company_raw = None
        if isinstance(companies_data, dict):
            company_raw = companies_data.get(domain, {})
        # Fallback: old list format
        elif isinstance(companies_data, list):
            for item in companies_data:
                if isinstance(item, dict) and domain in item:
                    company_raw = item[domain]
                    break

        if not company_raw:
            print(f">>> No company data found for {domain}", flush=True)
            return {"success": False, "error": f"No data found for domain '{domain}'"}

        # companies is a list with one dict: [{domain: {company_data}}]
        company = ContactOutService.normalize_company_enrichment({domain: company_raw})

        # 2) Get decision makers (blurred by default)
        try:
            dm_data = await contactout.get_decision_makers(
            domain=domain,
            reveal_info=False,  # blurred
            page=1
        )
        except httpx.HTTPStatusError as he:
            detail = he.response.text if he.response is not None else str(he)
            logger.error(f"ContactOut DM HTTP error for {domain}: {detail}")
            raise HTTPException(status_code=he.response.status_code if he.response is not None else 502, detail=detail)

        profiles = dm_data.get("profiles", {})
        decision_makers = [
            ContactOutService.normalize_decision_maker(dm)
            for dm in profiles.values()
        ]

        print(f">>> [Company Profile] Got {len(decision_makers)} decision makers for {domain}", flush=True)

        return {
            "success": True,
            "data": {
                "company": company,
                "decision_makers": decision_makers,
                "metadata": dm_data.get("metadata", {})
            }
        }

    except HTTPException as he:
        # Propagate HTTPExceptions so FastAPI can return the original status
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stdout)
        print(f">>> [Company Profile] ERROR for {domain}: {str(e)}", flush=True)
        # Return JSON error without 500 to avoid browser red errors
        return {
            "success": False,
            "error": f"Company profile failed: {str(e)}"
        }

@router.post("/reveal-contact")
async def reveal_contact(
    request: RevealContactRequest,  # ← accept raw dict instead of strict model
    db: Session = Depends(get_db)
):
    try:
        contactout = ContactOutService()
        data = await contactout.reveal_contact_info(
            linkedin_url=request.linkedin_url,
            include_phone=request.include_phone
        )

        profile = data.get("profile", {})

        return {
            "success": True,
            "data": {
                "linkedin_url": request.linkedin_url,
                "emails": profile.get("email", []),
                "work_emails": profile.get("work_email", []),
                "personal_emails": profile.get("personal_email", []),
                "phones": profile.get("phone", []) if request.include_phone else [],
            }
        }
    except Exception as e:
        # Ensure JSON-serializable error detail and avoid HTTP 500
        msg = str(e)
        logger.error(f"Reveal contact error: {msg}", exc_info=True)
        return {
            "success": False,
            "error": msg
        }

@router.get("/decision-makers/{domain}")
async def get_decision_makers(
    domain: str,
    page: int = 1,
    db: Session = Depends(get_db)
):
    """
    Get decision makers for a company domain.
    Returns blurred profiles by default.
    """
    try:
        contactout = ContactOutService()
        print(f">>> [Decision Makers] Fetching for domain: {domain}, page={page}", flush=True)
        
        dm_data = await contactout.get_decision_makers(
            domain=domain,
            reveal_info=False,  # blurred by default
            page=page
        )
        
        profiles = dm_data.get("profiles", {})
        decision_makers = [
            ContactOutService.normalize_decision_maker(dm)
            for dm in profiles.values()
        ]
        
        print(f">>> [Decision Makers] Got {len(decision_makers)} decision makers for {domain}", flush=True)
        
        return {
            "success": True,
            "data": decision_makers
        }
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stdout)
        print(f">>> [Decision Makers] ERROR for {domain}: {str(e)}", flush=True)
        # Try to get more details about the error
        if hasattr(e, 'response') and e.response is not None:
            print(f">>> [Decision Makers] Response status: {e.response.status_code}", flush=True)
            print(f">>> [Decision Makers] Response body: {e.response.text}", flush=True)
        return {
            "success": False,
            "error": f"Failed to fetch decision makers: {str(e)}"
        }

@router.post("/enrich-company")
async def enrich_company(
    request: CompanyProfileRequest,
    db: Session = Depends(get_db)
):
    """
    Enrich a single company with ContactOut data.
    Handles both possible response shapes: list of {domain: data} or direct {domain: data} dict.
    """
    try:
        contactout = ContactOutService()

        enrichment_data = await contactout.enrich_companies_by_domain([request.domain])
        
        # Debug print already there - keep it for now
        print(">>> ContactOut RAW RESPONSE:", json.dumps(enrichment_data, indent=2), flush=True)

        companies_data = enrichment_data.get("companies", {})

        # Case 1: companies is a DICT {domain: company_obj}
        if isinstance(companies_data, dict):
            if request.domain in companies_data:
                company_raw = companies_data[request.domain]
            else:
                return {
                    "success": False,
                    "error": f"Domain '{request.domain}' not found in ContactOut response (dict mode)"
                }

        # Case 2: companies is a LIST of {domain: company_obj} (fallback/old format)
        elif isinstance(companies_data, list):
            company_raw = None
            for item in companies_data:
                if isinstance(item, dict) and request.domain in item:
                    company_raw = item[request.domain]
                    break
            if not company_raw:
                return {
                    "success": False,
                    "error": f"Domain '{request.domain}' not found in ContactOut response (list mode)"
                }

        else:
            return {
                "success": False,
                "error": "Unexpected 'companies' format from ContactOut"
            }

        # Normalize and return
        normalized = ContactOutService.normalize_company_enrichment(
            {request.domain: company_raw}
        )

        return {
            "success": True,
            "data": normalized
        }

    except Exception as e:
        logger.error(f"Enrich company error for {request.domain}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"ContactOut enrichment failed: {str(e)}")
