"""
BetterContact Waterfall Enrichment API Routes.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.bettercontact_service import BetterContactService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bettercontact"])


class EnrichProspectRequest(BaseModel):
    first_name: str
    last_name: str
    company_name: Optional[str] = ""
    company_domain: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    field: Optional[str] = "email"


class EnrichCompanyRequest(BaseModel):
    company_name: str
    company_domain: Optional[str] = ""


@router.post("/enrich-prospect")
async def enrich_prospect(request: EnrichProspectRequest):
    """Enrich a prospect to find verified email + phone via BetterContact waterfall."""
    try:
        service = BetterContactService()
        result = await service.enrich_prospect(
            first_name=request.first_name,
            last_name=request.last_name,
            company_name=request.company_name,
            company_domain=request.company_domain,
            linkedin_url=request.linkedin_url,
            field=request.field,
        )
        return result
    except Exception as e:
        logger.error(f"BetterContact enrich prospect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enrich-company")
async def enrich_company(request: EnrichCompanyRequest):
    """Enrich a company to find a key contact via BetterContact lead finder."""
    logger.info(f"BetterContact enrich-company called: company_name={request.company_name}, domain={request.company_domain}")
    try:
        service = BetterContactService()
        result = await service.enrich_company(
            company_name=request.company_name,
            company_domain=request.company_domain,
        )
        logger.info(f"BetterContact enrich-company result: success={result.get('success')}, email={result.get('email')}, phone={result.get('phone')}")
        return result
    except Exception as e:
        logger.error(f"BetterContact enrich company error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
