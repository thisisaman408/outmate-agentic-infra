"""
Pydantic schemas for Co-Pilot API request/response models.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from enum import Enum
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


# ── Email Optimizer (extends Campaign Optimizer) ─────────────

class OptimizedEmail(BaseModel):
    subject_line: str
    body: str
    personalization_hooks_used: List[str]


class FollowUpEmail(BaseModel):
    delay_days: int
    subject_line: str
    body: str
    strategy: str


class ReplyProbability(BaseModel):
    score: int = Field(ge=0, le=100)
    reasoning: str
    boost_suggestions: List[str]


class EmailOptimizerRequest(BaseModel):
    # Existing fields
    subject_line: str
    email_body: str
    target_audience: Optional[str] = None
    campaign_id: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

    # Lead context for deep personalization
    lead_name: Optional[str] = None
    lead_company: Optional[str] = None
    lead_role: Optional[str] = None
    lead_domain: Optional[str] = None
    lead_linkedin_url: Optional[str] = None


class EmailOptimizerResponse(BaseModel):
    # Existing analysis fields (preserved for backward compat)
    id: str
    overall_score: int = Field(ge=0, le=100)
    category_scores: Dict[str, int]
    weaknesses: List[str]
    improvements: List[str]
    suggested_subjects: List[str]
    suggested_openers: List[str]
    predicted_lift: str

    # Optimizer output (present only when lead context is provided)
    optimized_email: Optional[OptimizedEmail] = None
    follow_up_sequence: Optional[List[FollowUpEmail]] = None
    reply_probability: Optional[ReplyProbability] = None
    enrichment_sources_used: Optional[List[str]] = None


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


# ── Lead Copilot ──────────────────────────────────────────────

class LeadActionType(str, Enum):
    draft_email = "draft_email"
    meeting_prep = "meeting_prep"
    research = "research"
    find_similar = "find_similar"
    objection_handler = "objection_handler"
    custom = "custom"
    crossfire = "crossfire"
    compliance = "compliance"
    bombora_intent = "bombora_intent"
    talent_radar = "talent_radar"
    virality = "virality"
    regime_shift = "regime_shift"
    website_traffic = "website_traffic"
    business_events = "business_events"
    linkedin_posts = "linkedin_posts"


class LeadActionRequest(BaseModel):
    prospect_id: str = Field(..., min_length=1)
    action_type: LeadActionType
    prompt: Optional[str] = Field(None, max_length=1000)
    context_overrides: Optional[Dict[str, Any]] = None

    @field_validator("prompt")
    @classmethod
    def sanitize_prompt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        import re
        # Strip HTML tags
        v = re.sub(r"<[^>]+>", "", v)
        return v.strip()


class LeadContextProspect(BaseModel):
    id: str
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    location: Optional[str] = None
    seniority: Optional[str] = None
    department: Optional[str] = None
    data_quality_score: Optional[int] = None


class LeadContextCompany(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    revenue_range: Optional[str] = None
    funding_stage: Optional[str] = None
    funding_total: Optional[int] = None
    technologies: Optional[List[str]] = None
    headquarters: Optional[str] = None
    employee_growth_6m_percent: Optional[int] = None


class LeadSignal(BaseModel):
    signal_type: str
    description: str
    urgency: str = "medium"
    detected_at: Optional[str] = None


class LeadEnrichmentStatus(BaseModel):
    emails_revealed: bool = False
    phones_revealed: bool = False
    company_enriched: bool = False
    last_enriched_at: Optional[str] = None


class LeadContextResponse(BaseModel):
    prospect: LeadContextProspect
    company: Optional[LeadContextCompany] = None
    signals: List[LeadSignal] = []
    enrichment_status: LeadEnrichmentStatus = LeadEnrichmentStatus()


class AnnotatedEmailTag(str, Enum):
    personalization = "PERSONALIZATION"
    relevance = "RELEVANCE"
    timing = "TIMING"
    value_prop = "VALUE_PROP"
    cta = "CTA"


class AnnotatedEmailSegment(BaseModel):
    text: str
    tag: AnnotatedEmailTag
    source: Optional[str] = None
    source_url: Optional[str] = None
    why: Optional[str] = None


class AnnotatedEmailDraft(BaseModel):
    subject_line: str
    segments: List[AnnotatedEmailSegment]
    full_text: str
    enrichment_sources_used: List[str] = []


class LeadActionResponse(BaseModel):
    action_type: str
    result: Dict[str, Any]
    suggestions: List[Dict[str, Any]] = []
    credits_used: int


class LeadSuggestion(BaseModel):
    icon: str
    title: str
    description: str
    action_type: Optional[str] = None
    priority: str = "medium"


class LeadSuggestionsResponse(BaseModel):
    suggestions: List[LeadSuggestion] = []
    signals_detected: int = 0


# ── Product Assistant (Global Chatbot) ────────────────────────

class ProductAssistantContext(BaseModel):
    route: Optional[str] = None
    feature_hint: Optional[str] = None


class ProductAssistantRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    context: Optional[ProductAssistantContext] = None


class ProductAssistantLink(BaseModel):
    label: str
    url: str


class ProductAssistantResponse(BaseModel):
    answer: str
    related_links: List[ProductAssistantLink] = []
    feature_tags: List[str] = []
