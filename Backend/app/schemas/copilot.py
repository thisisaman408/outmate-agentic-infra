"""
Pydantic schemas for Co-Pilot API request/response models.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date


# ── Daily Brief ───────────────────────────────────────────────

class DailyBriefResponse(BaseModel):
    id: str
    brief_date: str
    summary: str
    priority_actions: List[Dict[str, Any]]
    new_signals: List[Dict[str, Any]]
    follow_ups: List[Dict[str, Any]]
    key_metrics: Dict[str, Any]
    status: str


# ── Meeting Prep ──────────────────────────────────────────────

class MeetingPrepRequest(BaseModel):
    company_name: str = Field(..., min_length=1)
    company_domain: Optional[str] = None
    prospect_name: Optional[str] = None
    prospect_title: Optional[str] = None
    meeting_type: Optional[str] = "discovery"
    additional_context: Optional[str] = None


class MeetingPrepResponse(BaseModel):
    id: str
    company_snapshot: Dict[str, Any]
    prospect_profile: Optional[Dict[str, Any]]
    talking_points: List[str]
    discovery_questions: List[str]
    signals: List[Dict[str, Any]]
    risk_factors: List[str]
    competitors_mentioned: List[str]
    recommended_approach: str


# ── Campaign Optimizer ────────────────────────────────────────

class CampaignOptimizerRequest(BaseModel):
    subject_line: str
    email_body: str
    target_audience: Optional[str] = None
    campaign_id: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None


class CampaignOptimizerResponse(BaseModel):
    id: str
    overall_score: int = Field(ge=0, le=100)
    category_scores: Dict[str, int]
    weaknesses: List[str]
    improvements: List[str]
    suggested_subjects: List[str]
    suggested_openers: List[str]
    predicted_lift: str


# ── Pipeline Risk Alert ───────────────────────────────────────

class DealInput(BaseModel):
    company: str
    stage: str
    last_activity: str
    value: float


class PipelineScanRequest(BaseModel):
    deals: List[DealInput] = Field(..., max_length=20)


class PipelineAlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    description: str
    entity_type: Optional[str] = None
    entity_name: Optional[str] = None
    recommendation: Optional[str] = None
    is_resolved: bool
    created_at: str


class PipelineScanResponse(BaseModel):
    health_score: int
    risk_summary: str
    at_risk_deals: List[Dict[str, Any]]
    total_value_at_risk: float


class PipelineAlertResolveRequest(BaseModel):
    alert_id: str


# ── Preferences ───────────────────────────────────────────────

class CopilotPreferencesRequest(BaseModel):
    daily_brief_enabled: Optional[bool] = None
    daily_brief_time: Optional[str] = None
    daily_brief_timezone: Optional[str] = None
    notify_email: Optional[bool] = None
    notify_slack: Optional[bool] = None
    slack_webhook_url: Optional[str] = None
    pipeline_alerts_enabled: Optional[bool] = None
    alert_severity_threshold: Optional[str] = None
