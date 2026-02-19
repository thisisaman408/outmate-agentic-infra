"""
Signal Detection API Routes
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

from app.services.signal_detection_service import SignalDetectionService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["signals"])


class SignalDetectionRequest(BaseModel):
    companies: List[Dict[str, Any]]
    prospect_query: Optional[str] = ""
    # Accept either a string or a list of strings
    # For prospects: ["crustdata", "contactout"]
    # For companies: ["explorium", "contactout"]
    data_source: Optional[str | List[str]] = "explorium"


class SignalDetectionResponse(BaseModel):
    signals: List[Dict[str, Any]]
    count: int
    message: str


@router.post("/detect", response_model=SignalDetectionResponse)
async def detect_signals(request: SignalDetectionRequest):
    """
    Detect relevant signals for companies/prospects for outreach personalization.
    
    This endpoint analyzes company data and identifies signals like:
    - Recent funding
    - Hiring trends
    - Technology adoption
    - Growth indicators
    - Expansion signals
    """
    try:
        service = SignalDetectionService()
        
        signals = await service.detect_signals(
            companies=request.companies,
            prospect_query=request.prospect_query or "",
            data_source=request.data_source or "explorium"
        )
        
        return SignalDetectionResponse(
            signals=signals,
            count=len(signals),
            message=f"Successfully detected signals for {len(signals)} companies"
        )
        
    except Exception as e:
        logger.error(f"Signal detection error: {e}")
        raise HTTPException(status_code=500, detail=f"Signal detection failed: {str(e)}")


@router.get("/health")
async def signals_health():
    """Health check for signals service"""
    return {"status": "healthy", "service": "signal_detection"}
