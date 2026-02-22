from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.services.ai_agents_service import AiAgentsService
import logging

router = APIRouter()
logger = logging.getLogger(__name__)
ai_service = AiAgentsService()

class SearchRequest(BaseModel):
    query: str

class ResearchRequest(BaseModel):
    companyName: str
    depth: str = "standard"

class LookalikeRequest(BaseModel):
    seedCompanyIds: List[str]

class PredictiveRequest(BaseModel):
    company: Optional[Dict[str, Any]] = None

@router.post("/search")
async def agentic_search(request: SearchRequest):
    """Deep agentic search for prospects and companies."""
    try:
        results = await ai_service.agentic_search(request.query)
        return results
    except Exception as e:
        logger.error(f"Search API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/research")
async def company_research(request: ResearchRequest):
    """Deep intelligence research on a specific company."""
    try:
        result = await ai_service.deep_research(request.companyName, request.depth)
        return result
    except Exception as e:
        logger.error(f"Research API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lookalike")
async def find_lookalikes(request: LookalikeRequest):
    """Find lookalike companies based on seed pool."""
    try:
        results = await ai_service.find_lookalikes(request.seedCompanyIds)
        return results
    except Exception as e:
        logger.error(f"Lookalike API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predictive")
async def score_leads(request: PredictiveRequest):
    """Predictive propensity scoring for a company."""
    try:
        results = await ai_service.predictive_scoring(request.dict())
        return results
    except Exception as e:
        logger.error(f"Predictive API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
