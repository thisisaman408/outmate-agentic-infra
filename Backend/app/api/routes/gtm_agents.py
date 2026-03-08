from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Literal, Optional
import logging

from app.services.gtm_agents_service import gtm_agents_service

router = APIRouter(prefix="/api/v1/gtm-agents", tags=["gtm-agents"])
logger = logging.getLogger(__name__)


AgentName = Literal["crossfire", "compliance_oracle", "virality_engine", "talent_radar", "regime_shifter"]


class CrossfirePayload(BaseModel):
    competitor_domain: str = Field(..., description="Primary competitor domain, e.g. apollo.io")
    target_region: Optional[str] = Field(None, description="Optional focus region, e.g. 'US', 'EU', or 'global'")
    notes: Optional[str] = Field(None, description="Extra context about your ICP or current pipeline")


class CompliancePayload(BaseModel):
    message_template: str = Field(..., description="Outbound email or sequence to check for global compliance.")
    jurisdictions: Optional[str] = Field(
        "US, EU, UK", description="Comma-separated list of key jurisdictions, e.g. 'US, EU, UK, CA'"
    )


class ViralityPayload(BaseModel):
    seed_customers: str = Field(
        ..., description="Comma-separated list of champion customers or personas to base virality loops on."
    )
    channels: Optional[str] = Field(
        "email, linkedin, slack",
        description="Preferred channels, e.g. 'email, linkedin, slack, in-product'",
    )


class TalentRadarPayload(BaseModel):
    accounts: str = Field(
        ..., description="Comma-separated list of key accounts to monitor for executive churn risk."
    )
    lookback_days: int = Field(
        90, ge=7, le=365, description="Lookback window for signals such as hiring, title changes, and visitor drops."
    )


class RegimeShifterPayload(BaseModel):
    geo_focus: str = Field(
        ..., description="Target geos or markets, e.g. 'US SaaS', 'DACH manufacturing', 'APAC fintech'."
    )
    scenario: Optional[str] = Field(
        None,
        description="Optional macro event to adapt to, e.g. 'election', 'tariffs', 'recession', 'regulation change'.",
    )


class GenericRunRequest(BaseModel):
    """
    Low-level escape hatch for future use; not used by the typed endpoints.
    """

    inputs: Dict[str, Any] = Field(default_factory=dict)


@router.post("/{agent_name}/run")
async def run_gtm_agent(agent_name: AgentName, request: GenericRunRequest):
    """
    Generic GTM agent runner. Prefer the typed endpoints below from the frontend.
    """
    try:
        if agent_name == "crossfire":
            payload = CrossfirePayload(**request.inputs)
            return await gtm_agents_service.run_crossfire(payload.model_dump())
        if agent_name == "compliance_oracle":
            payload = CompliancePayload(**request.inputs)
            return await gtm_agents_service.run_compliance_oracle(payload.model_dump())
        if agent_name == "virality_engine":
            payload = ViralityPayload(**request.inputs)
            return await gtm_agents_service.run_virality_engine(payload.model_dump())
        if agent_name == "talent_radar":
            payload = TalentRadarPayload(**request.inputs)
            return await gtm_agents_service.run_talent_radar(payload.model_dump())
        if agent_name == "regime_shifter":
            payload = RegimeShifterPayload(**request.inputs)
            return await gtm_agents_service.run_regime_shifter(payload.model_dump())

        raise HTTPException(status_code=404, detail=f"Unknown GTM agent: {agent_name}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("GTM agent %s failed: %s", agent_name, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/crossfire/run")
async def run_crossfire_agent(payload: CrossfirePayload):
    return await gtm_agents_service.run_crossfire(payload.model_dump())


@router.post("/compliance-oracle/run")
async def run_compliance_oracle_agent(payload: CompliancePayload):
    return await gtm_agents_service.run_compliance_oracle(payload.model_dump())


@router.post("/virality-engine/run")
async def run_virality_engine_agent(payload: ViralityPayload):
    return await gtm_agents_service.run_virality_engine(payload.model_dump())


@router.post("/talent-radar/run")
async def run_talent_radar_agent(payload: TalentRadarPayload):
    return await gtm_agents_service.run_talent_radar(payload.model_dump())


@router.post("/regime-shifter/run")
async def run_regime_shifter_agent(payload: RegimeShifterPayload):
    return await gtm_agents_service.run_regime_shifter(payload.model_dump())

