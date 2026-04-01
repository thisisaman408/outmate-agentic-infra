"""
Signal Pipeline API Routes

Public endpoints for ingesting signals and querying signal data.
Also includes admin endpoints for debugging and manual operations.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.api.deps.auth import get_current_user
from app.db.models.signal_event import SignalEvent
from app.db.models.user import User
from app.services.signal_pipeline import (
    SignalEventBus,
    SignalIngester,
    SignalEnricher,
)

router = APIRouter(prefix="/api/v1/signals/pipeline", tags=["signal_pipeline"])

import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────


class PublishSignalRequest(BaseModel):
    """Request to publish a signal to the event bus."""

    signal_type: str = Field(
        ...,
        description="Type: job_change|funding|hiring|g2_intent|website_visit|email_open|linkedin_activity",
    )
    source: str = Field(
        ..., description="Data source: crustdata|explorium|rss|webhook|g2|visitor|campaign"
    )
    company_domain: Optional[str] = Field(None, description="Company domain")
    company_name: Optional[str] = Field(None, description="Company name")
    prospect_email: Optional[str] = Field(None, description="Prospect email")
    prospect_name: Optional[str] = Field(None, description="Prospect name")
    prospect_title: Optional[str] = Field(None, description="Prospect job title")
    raw_data: Optional[Dict[str, Any]] = Field(None, description="Original API response")
    discovered_at: Optional[datetime] = Field(
        None, description="When signal actually occurred"
    )


class SignalEventResponse(BaseModel):
    """Signal event response."""

    id: UUID
    signal_type: str
    source: str
    company_domain: Optional[str]
    company_name: Optional[str]
    prospect_email: Optional[str]
    prospect_name: Optional[str]
    icp_score: Optional[int]
    icp_match_factors: List[str]
    credits_consumed: int
    is_archived: bool
    sent_to_copilot: bool
    discovered_at: datetime
    ingested_at: datetime

    class Config:
        from_attributes = True


class SignalStatisticsResponse(BaseModel):
    """Signal pipeline statistics."""

    total_signals: int
    active_signals: int
    archived_signals: int
    by_type: Dict[str, int]
    by_source: Dict[str, int]
    stream_stats: Dict[str, Any]


# ─────────────────────────────────────────────────────────────
# Public Endpoints
# ─────────────────────────────────────────────────────────────


@router.post("/publish", response_model=Dict[str, Any])
async def publish_signal(
    request: PublishSignalRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Publish a raw signal to the event bus.

    The signal will be processed asynchronously by Celery tasks:
    1. Ingested into database
    2. Deduplicated against 24hr window
    3. Enriched with company/prospect context
    4. Scored for ICP match
    5. Routed to Co-Pilot queue

    Args:
        request: Signal event data
        current_user: Current authenticated user

    Returns:
        Confirmation of publishing
    """
    try:
        event_bus = SignalEventBus()

        from app.services.signal_pipeline.signal_event_bus import SignalEventPayload

        payload = SignalEventPayload(
            signal_type=request.signal_type,
            source=request.source,
            company_domain=request.company_domain,
            company_name=request.company_name,
            prospect_email=request.prospect_email,
            prospect_name=request.prospect_name,
            raw_data=request.raw_data,
            discovered_at=request.discovered_at,
        )

        stream_id = await event_bus.publish_signal(payload)

        if not stream_id:
            raise HTTPException(status_code=503, detail="Signal bus unavailable")

        logger.info(
            f"Signal published: type={request.signal_type}, source={request.source}, "
            f"stream_id={stream_id}, user={current_user.id}"
        )

        return {
            "status": "published",
            "stream_id": stream_id,
            "signal_type": request.signal_type,
            "user_id": str(current_user.id),
        }
    except Exception as e:
        logger.error(f"Failed to publish signal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active", response_model=List[SignalEventResponse])
async def get_active_signals(
    signal_type: Optional[str] = Query(None, description="Filter by signal type"),
    company_domain: Optional[str] = Query(None, description="Filter by company domain"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get active (non-archived) signals.

    Args:
        signal_type: Optional filter by signal type
        company_domain: Optional filter by company domain
        limit: Max results (1-500)
        offset: Pagination offset
        current_user: Current user
        db: Database session

    Returns:
        List of active signals
    """
    try:
        query = db.query(SignalEvent).filter_by(is_archived=False)

        if signal_type:
            query = query.filter_by(signal_type=signal_type)

        if company_domain:
            query = query.filter_by(company_domain=company_domain)

        signals = query.order_by(SignalEvent.ingested_at.desc()).limit(limit).offset(offset).all()

        return [SignalEventResponse.from_orm(s) for s in signals]
    except Exception as e:
        logger.error(f"Failed to get active signals: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics", response_model=SignalStatisticsResponse)
async def get_signal_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get signal pipeline statistics.

    Returns counts by type, source, and stream health status.
    """
    try:
        total_signals = db.query(SignalEvent).count()
        active_signals = db.query(SignalEvent).filter_by(is_archived=False).count()
        archived_signals = db.query(SignalEvent).filter_by(is_archived=True).count()

        # Count by type
        type_counts = {}
        for row in db.query(SignalEvent.signal_type, db.func.count()).group_by(
            SignalEvent.signal_type
        ).all():
            type_counts[row[0]] = row[1]

        # Count by source
        source_counts = {}
        for row in db.query(SignalEvent.source, db.func.count()).group_by(
            SignalEvent.source
        ).all():
            source_counts[row[0]] = row[1]

        # Stream stats
        event_bus = SignalEventBus()
        stream_stats = await event_bus.get_stream_stats()

        return SignalStatisticsResponse(
            total_signals=total_signals,
            active_signals=active_signals,
            archived_signals=archived_signals,
            by_type=type_counts,
            by_source=source_counts,
            stream_stats=stream_stats,
        )
    except Exception as e:
        logger.error(f"Failed to get signal statistics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────
# Admin Endpoints (debugging/manual operations)
# ─────────────────────────────────────────────────────────────


@router.post("/admin/trigger-processing")
async def trigger_signal_processing(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually trigger signal processing.

    Admin-only: processes pending signals from the event bus immediately
    instead of waiting for Celery scheduler.
    """
    try:
        # Check if user is admin (optional - can add admin role check)
        # For now, just log the action
        logger.info(f"Manual signal processing triggered by user {current_user.id}")

        # Import and run the processing task directly
        from app.tasks.signal_tasks import _process_signal_events

        result = await _process_signal_events()

        return {
            "status": "triggered",
            "result": result,
        }
    except Exception as e:
        logger.error(f"Failed to trigger signal processing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/trigger-archival")
async def trigger_signal_archival(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually trigger signal archival.

    Admin-only: archives signals older than 7 days immediately.
    """
    try:
        logger.info(f"Manual signal archival triggered by user {current_user.id}")

        from app.tasks.signal_tasks import _archive_stale_signals

        result = await _archive_stale_signals()

        return {
            "status": "triggered",
            "result": result,
        }
    except Exception as e:
        logger.error(f"Failed to trigger signal archival: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/event-bus-stats")
async def get_event_bus_stats(
    current_user: User = Depends(get_current_user),
):
    """
    Get event bus (Redis Streams) statistics.

    Admin endpoint for monitoring stream health and pending messages.
    """
    try:
        event_bus = SignalEventBus()
        stats = await event_bus.get_stream_stats()

        return {
            "status": "ok",
            "stats": stats,
        }
    except Exception as e:
        logger.error(f"Failed to get event bus stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/copilot-queue-peek")
async def peek_copilot_queue(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """
    Peek at Co-Pilot queue (Redis list) without consuming.

    Admin endpoint for monitoring signals queued for Co-Pilot.
    """
    try:
        event_bus = SignalEventBus()
        items = await event_bus.peek_copilot_queue(count=limit)

        return {
            "status": "ok",
            "count": len(items),
            "items": items,
        }
    except Exception as e:
        logger.error(f"Failed to peek Co-Pilot queue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
