from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, field_validator
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

class PipelineRequest(BaseModel):
    companyId: str
    companyName: str
    contactName: Optional[str] = None
    similarityScore: Optional[float] = None

    @field_validator("companyId", "companyName", mode="before")
    @classmethod
    def coerce_to_str(cls, v: Any) -> str:
        if v is None:
            raise ValueError("field is required")
        return str(v)

    @field_validator("similarityScore", mode="before")
    @classmethod
    def coerce_score(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

@router.post("/search")
async def agentic_search(request: SearchRequest):
    """Deep agentic search for prospects and companies."""
    try:
        results = await ai_service.agentic_search(request.query)
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/research")
async def company_research(request: ResearchRequest):
    """Deep intelligence research on a specific company."""
    try:
        result = await ai_service.deep_research(request.companyName, request.depth)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Research API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/lookalike")
async def find_lookalikes(request: LookalikeRequest):
    """Find lookalike companies based on seed pool."""
    try:
        results = await ai_service.find_lookalikes(request.seedCompanyIds)
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lookalike API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predictive")
async def score_leads(request: PredictiveRequest):
    """Predictive propensity scoring for a company."""
    try:
        results = await ai_service.predictive_scoring(request.model_dump())
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictive API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pipeline")
async def add_to_pipeline(request: PipelineRequest):
    """Record a lookalike company in the pipeline cohort."""
    try:
        return await ai_service.add_to_pipeline(request.model_dump())
    except Exception as e:
        logger.error(f"Pipeline API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
