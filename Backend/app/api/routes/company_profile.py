"""Company Profile API — one row per user describing their company +
how downstream agents (Voice, Social, Co-Pilot) should pitch it.

A user fills this out ONCE in Settings → Company Profile and every
agent reads from it.  GET returns the existing row (creating a blank
one lazily if none exists so the UI always has something to render).
PUT upserts.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.company_profile import UserCompanyProfile
from app.db.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/company-profile", tags=["company-profile"])


class CompanyProfile(BaseModel):
    company_name: str = ""
    website_url: str = ""
    one_liner: str = ""
    product_description: str = ""
    pricing_summary: str = ""
    icp_description: str = ""
    objection_handling: str = ""
    key_differentiators: str = ""
    additional_context: str = ""
    agent_persona_name: str = "Alex"
    agent_persona_role: str = "GTM Specialist"
    calendar_booking_url: str = ""


class CompanyProfileOut(CompanyProfile):
    id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _serialize(p: UserCompanyProfile) -> CompanyProfileOut:
    return CompanyProfileOut(
        id=str(p.id),
        company_name=p.company_name,
        website_url=p.website_url,
        one_liner=p.one_liner,
        product_description=p.product_description,
        pricing_summary=p.pricing_summary,
        icp_description=p.icp_description,
        objection_handling=p.objection_handling,
        key_differentiators=p.key_differentiators,
        additional_context=p.additional_context,
        agent_persona_name=p.agent_persona_name,
        agent_persona_role=p.agent_persona_role,
        calendar_booking_url=p.calendar_booking_url,
        created_at=p.created_at.isoformat() if p.created_at else None,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
    )


def get_or_create_profile(db: Session, user_id) -> UserCompanyProfile:
    """Return the user's profile row, lazily creating an empty one.

    Also importable by the voice agent + campaign worker so every call
    reads from the same source of truth.
    """
    profile = (
        db.query(UserCompanyProfile)
        .filter(UserCompanyProfile.user_id == user_id)
        .first()
    )
    if profile is None:
        profile = UserCompanyProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("", response_model=CompanyProfileOut)
def get_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, user.id)
    return _serialize(profile)


@router.put("", response_model=CompanyProfileOut)
def update_profile(
    payload: CompanyProfile,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = get_or_create_profile(db, user.id)
    profile.company_name = payload.company_name.strip()
    profile.website_url = payload.website_url.strip()
    profile.one_liner = payload.one_liner.strip()
    profile.product_description = payload.product_description.strip()
    profile.pricing_summary = payload.pricing_summary.strip()
    profile.icp_description = payload.icp_description.strip()
    profile.objection_handling = payload.objection_handling.strip()
    profile.key_differentiators = payload.key_differentiators.strip()
    profile.additional_context = payload.additional_context.strip()
    profile.agent_persona_name = (payload.agent_persona_name or "Alex").strip()
    profile.agent_persona_role = (payload.agent_persona_role or "GTM Specialist").strip()
    profile.calendar_booking_url = payload.calendar_booking_url.strip()
    db.commit()
    db.refresh(profile)
    return _serialize(profile)
