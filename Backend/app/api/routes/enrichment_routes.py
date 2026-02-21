from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from pydantic import BaseModel
from app.services.bettercontact_service import BetterContactService

router = APIRouter(tags=["enrichment"])

class CompanyEnrichmentRequest(BaseModel):
    company_id: str
    company_name: str
    company_domain: str = ""
    field: str  # 'email' or 'phone'

@router.post("/company")
async def enrich_company(request: CompanyEnrichmentRequest) -> Dict[str, Any]:
    """Enrich a company with email or phone using BetterContact waterfall"""
    try:
        if request.field not in ['email', 'phone']:
            raise HTTPException(status_code=400, detail="Field must be 'email' or 'phone'")

        service = BetterContactService()

        # For companies, we need to enrich a contact at the company
        # Let's try to find a generic contact like CEO or founder
        result = await service.enrich_company(
            company_name=request.company_name,
            company_domain=request.company_domain
        )

        if result.get("success"):
            # Return the enriched field
            if request.field == 'email' and result.get("email"):
                logger.info(f"Company enrichment successful: {request.company_name} - email: {result['email']}")
                return {"email": result["email"], "status": "success"}
            elif request.field == 'phone' and result.get("phone"):
                logger.info(f"Company enrichment successful: {request.company_name} - phone: {result['phone']}")
                return {"phone": result["phone"], "status": "success"}
            else:
                logger.warning(f"Company enrichment found lead but no {request.field}: {request.company_name} - result: {result}")
                return {"error": f"{request.field} not found", "status": "not_found"}
        else:
            logger.error(f"Company enrichment failed: {request.company_name} - error: {result.get('error')}")
            return {"error": result.get("error", "Enrichment failed"), "status": "error"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")
