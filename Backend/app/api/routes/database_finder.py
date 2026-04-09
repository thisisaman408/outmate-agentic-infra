"""
Database Finder API routes — ZenRows + Tavily lead discovery
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from app.services.database_finder_service import DatabaseFinderService, DatabaseFinderError

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response models ────────────────────────────────────────────

class DatabaseSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Search term (company name, industry, job title, etc.)")
    location: str = Field("United States", max_length=200)
    limit: int = Field(20, ge=1, le=50)
    include_signals: bool = Field(True, description="Include Tavily company/person signals")


class EnrichLeadRequest(BaseModel):
    linkedin_url: str = Field(..., min_length=10, max_length=500)


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post("/search")
async def search_leads(
    body: DatabaseSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Search for leads via ZenRows (LinkedIn discovery) + Tavily (signals).
    Returns 30-40 data fields per lead.
    """
    logger.info(
        f"Database search: query='{body.query}', location='{body.location}', "
        f"limit={body.limit}, signals={body.include_signals}, user={current_user.id}"
    )

    service = DatabaseFinderService()
    try:
        result = await service.search(
            query=body.query,
            location=body.location,
            limit=body.limit,
            include_signals=body.include_signals,
        )
        return {
            "success": True,
            "data": result,
        }
    except DatabaseFinderError as e:
        logger.error(f"DatabaseFinderError: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Unexpected error in database search: {e}")
        raise HTTPException(status_code=500, detail="Search failed. Please try again.")


@router.post("/enrich")
async def enrich_lead(
    body: EnrichLeadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enrich a single lead by LinkedIn URL.
    Scrapes profile + fetches Tavily signals.
    """
    logger.info(f"Enriching lead: {body.linkedin_url}, user={current_user.id}")

    service = DatabaseFinderService()
    try:
        lead = await service.enrich_lead(body.linkedin_url)
        return {
            "success": True,
            "data": lead,
        }
    except DatabaseFinderError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.exception(f"Enrichment failed: {e}")
        raise HTTPException(status_code=500, detail="Enrichment failed. Please try again.")


@router.get("/status")
async def service_status(
    current_user: User = Depends(get_current_user),
):
    """Check if ZenRows and Tavily API keys are configured."""
    from app.core.config import settings

    zenrows_ok = bool(getattr(settings, "ZENROWS_API_KEY", ""))
    tavily_ok = bool(getattr(settings, "TAVILY_API_KEY", ""))

    return {
        "zenrows_configured": zenrows_ok,
        "tavily_configured": tavily_ok,
        "ready": zenrows_ok or tavily_ok,  # Either ZenRows or Tavily can produce usable leads
    }
