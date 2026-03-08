from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, field_validator
from app.services.ai_agents_service import AiAgentsService
from app.core.rate_limiting import limiter, RateLimits
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
@limiter.limit(RateLimits.SEARCH)
async def agentic_search(http_request: Request, body: SearchRequest):
    """Deep agentic search for prospects and companies."""
    try:
        results = await ai_service.agentic_search(body.query)
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search API Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred during search")

@router.post("/research")
@limiter.limit(RateLimits.SEARCH)
async def company_research(http_request: Request, body: ResearchRequest):
    """Deep intelligence research on a specific company."""
    try:
        result = await ai_service.deep_research(body.companyName, body.depth)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Research API Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred during research")

@router.post("/lookalike")
@limiter.limit(RateLimits.SEARCH)
async def find_lookalikes(http_request: Request, body: LookalikeRequest):
    """Find lookalike companies based on seed pool."""
    try:
        results = await ai_service.find_lookalikes(body.seedCompanyIds)
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Lookalike API Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred during lookalike search")

@router.post("/predictive")
@limiter.limit(RateLimits.SEARCH)
async def score_leads(http_request: Request, body: PredictiveRequest):
    """Predictive propensity scoring for a company."""
    try:
        results = await ai_service.predictive_scoring(body.model_dump())
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Predictive API Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred during scoring")


@router.post("/pipeline")
@limiter.limit(RateLimits.DEFAULT)
async def add_to_pipeline(http_request: Request, body: PipelineRequest):
    """Record a lookalike company in the pipeline cohort."""
    try:
        return await ai_service.add_to_pipeline(body.model_dump())
    except Exception as e:
        logger.error(f"Pipeline API Error: {str(e)}")
        raise HTTPException(status_code=500, detail="An error occurred adding to pipeline")
