# Outmate.AI Co-Pilot — Implementation Plan

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema Changes](#3-database-schema-changes)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Feature 1: Daily Brief](#6-feature-1-daily-brief)
7. [Feature 2: Meeting Prep](#7-feature-2-meeting-prep)
8. [Feature 3: Campaign Optimizer](#8-feature-3-campaign-optimizer)
9. [Feature 4: Pipeline Risk Alert](#9-feature-4-pipeline-risk-alert)
10. [Additional Co-Pilot Features](#10-additional-co-pilot-features)
11. [Notification System (Email/Slack)](#11-notification-system-emailslack)
12. [Implementation Order & Phases](#12-implementation-order--phases)
13. [File-by-File Checklist](#13-file-by-file-checklist)

---

## 1. Executive Summary

The Co-Pilot is an AI assistance layer built on top of Outmate's existing GTM intelligence platform. It uses Claude 3.5 Haiku via OpenRouter (already integrated in `OpenRouterService`) to proactively deliver insights, recommendations, and alerts to sales teams.

**What already exists that we reuse:**
- `OpenRouterService` (`app/services/openrouter_service.py`) — Claude API calls
- `SignalDetectionService` (`app/services/signal_detection_service.py`) — signal detection via CrustData/Explorium
- `SignalFetcherService` (`app/services/signal_fetcher_service.py`) — Google News, LinkedIn, RSS signals
- `CampaignService` (`app/services/campaign_service.py`) — campaign draft generation
- `CampaignDashboardService` (`app/services/campaign_dashboard_service.py`) — campaign metrics
- `ChatAgentService` (`app/services/chat_agent_service.py`) — conversational AI patterns
- PostgreSQL models: `User`, `Prospect`, `Company`, `Search`, `SearchResult`
- Redis caching via `RedisManager`
- JWT auth via `get_current_user`
- Celery task queue (in requirements, not yet heavily used — perfect for scheduled jobs)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Daily    │ │ Meeting  │ │ Campaign │ │  Pipeline     │  │
│  │  Brief   │ │ Prep     │ │ Optimizer│ │  Risk Alert   │  │
│  │  Widget  │ │ Panel    │ │ Analyzer │ │  Dashboard    │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │             │            │               │           │
│  ┌────┴─────────────┴────────────┴───────────────┴────────┐  │
│  │              Co-Pilot Sidebar / Command Bar             │  │
│  └─────────────────────────┬──────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────┘
                             │ REST API
┌────────────────────────────┼─────────────────────────────────┐
│                     BACKEND (FastAPI)                         │
│                             │                                │
│  ┌──────────────────────────┴──────────────────────────────┐ │
│  │              /api/copilot/*  Router                      │ │
│  └──┬───────┬──────────┬───────────┬───────────────────────┘ │
│     │       │          │           │                         │
│  ┌──┴──┐ ┌──┴───┐ ┌───┴───┐ ┌────┴────┐                    │
│  │Daily│ │Meet  │ │Camp.  │ │Pipeline │                    │
│  │Brief│ │Prep  │ │Optim. │ │Risk     │                    │
│  │Svc  │ │Svc   │ │Svc    │ │Svc      │                    │
│  └──┬──┘ └──┬───┘ └───┬───┘ └────┬────┘                    │
│     │       │         │          │                          │
│  ┌──┴───────┴─────────┴──────────┴──────┐                   │
│  │        CopilotService (orchestrator)  │                   │
│  │        ┌─────────────────────┐        │                   │
│  │        │ OpenRouterService   │        │                   │
│  │        │ (Claude 3.5 Haiku)  │        │                   │
│  │        └─────────────────────┘        │                   │
│  └──┬────────┬────────┬─────────────────┘                   │
│     │        │        │                                     │
│  ┌──┴──┐ ┌──┴──┐ ┌───┴──────┐                              │
│  │Redis│ │ DB  │ │Celery    │──→ Email/Slack notifications  │
│  │Cache│ │     │ │Scheduler │                               │
│  └─────┘ └─────┘ └──────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- All Co-Pilot features live under a single `/api/copilot` router
- A shared `CopilotService` orchestrator composes data from existing services + LLM calls
- Redis caches generated briefs (TTL 4 hours) to avoid redundant LLM calls
- Celery Beat schedules daily brief generation + email/Slack delivery
- Each feature has its own Pydantic schemas for request/response validation

---

## 3. Database Schema Changes

### 3.1 New Tables

Create a new Alembic migration for these tables:

#### `copilot_briefs` — Stores generated daily briefs

```python
# Backend/app/db/models/copilot_brief.py

class CopilotBrief(Base):
    __tablename__ = "copilot_briefs"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    brief_date    = Column(Date, nullable=False, index=True)          # The day this brief is for
    brief_type    = Column(String(50), default="daily")               # "daily", "weekly"
    content       = Column(JSONB, nullable=False)                     # Structured brief content
    # content schema:
    # {
    #   "summary": "string",
    #   "priority_actions": [...],
    #   "new_signals": [...],
    #   "follow_ups": [...],
    #   "key_metrics": {...}
    # }
    status        = Column(String(20), default="generated")           # "generated", "sent", "read"
    sent_via      = Column(JSONB, default=[])                         # ["email", "slack"]
    sent_at       = Column(DateTime(timezone=True), nullable=True)
    read_at       = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "brief_date", "brief_type", name="uq_user_brief_date_type"),
    )
```

#### `copilot_meeting_preps` — Stores generated meeting prep briefs

```python
# Backend/app/db/models/copilot_meeting_prep.py

class CopilotMeetingPrep(Base):
    __tablename__ = "copilot_meeting_preps"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    company_name    = Column(String(500), nullable=False)
    company_domain  = Column(String(255), nullable=True)
    prospect_name   = Column(String(500), nullable=True)
    prospect_title  = Column(String(500), nullable=True)
    content         = Column(JSONB, nullable=False)
    # content schema:
    # {
    #   "company_snapshot": {...},
    #   "prospect_profile": {...},
    #   "talking_points": [...],
    #   "discovery_questions": [...],
    #   "signals": [...],
    #   "risk_factors": [...],
    #   "competitors_mentioned": [...],
    #   "recommended_approach": "string"
    # }
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
```

#### `copilot_campaign_analyses` — Stores campaign optimization results

```python
# Backend/app/db/models/copilot_campaign_analysis.py

class CopilotCampaignAnalysis(Base):
    __tablename__ = "copilot_campaign_analyses"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id     = Column(String(255), nullable=True)              # Link to existing campaign if applicable
    input_data      = Column(JSONB, nullable=False)                   # Original campaign data submitted
    analysis        = Column(JSONB, nullable=False)
    # analysis schema:
    # {
    #   "overall_score": 0-100,
    #   "category_scores": { "subject_line": 75, "personalization": 60, ... },
    #   "weaknesses": [...],
    #   "improvements": [...],
    #   "suggested_subjects": [...],
    #   "suggested_openers": [...],
    #   "predicted_lift": "string"
    # }
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
```

#### `copilot_pipeline_alerts` — Stores pipeline risk alerts

```python
# Backend/app/db/models/copilot_pipeline_alert.py

class CopilotPipelineAlert(Base):
    __tablename__ = "copilot_pipeline_alerts"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type      = Column(String(50), nullable=False)              # "stuck_deal", "ghost_prospect", "forecast_risk", "churn_risk"
    severity        = Column(String(20), default="medium")            # "low", "medium", "high", "critical"
    title           = Column(String(500), nullable=False)
    description     = Column(Text, nullable=False)
    entity_type     = Column(String(50))                              # "prospect", "company", "campaign"
    entity_id       = Column(String(255))
    entity_name     = Column(String(500))
    recommendation  = Column(Text)
    is_resolved     = Column(Boolean, default=False)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
```

#### `copilot_user_preferences` — User-specific copilot settings

```python
# Backend/app/db/models/copilot_preferences.py

class CopilotUserPreferences(Base):
    __tablename__ = "copilot_user_preferences"

    id                     = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id                = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    daily_brief_enabled    = Column(Boolean, default=True)
    daily_brief_time       = Column(String(5), default="08:00")       # HH:MM in user's timezone
    daily_brief_timezone   = Column(String(50), default="UTC")
    notify_email           = Column(Boolean, default=True)
    notify_slack           = Column(Boolean, default=False)
    slack_webhook_url      = Column(String(500), nullable=True)
    pipeline_alerts_enabled = Column(Boolean, default=True)
    alert_severity_threshold = Column(String(20), default="medium")   # Only alert at this level or above
    created_at             = Column(DateTime(timezone=True), server_default=func.now())
    updated_at             = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

### 3.2 Alembic Migration

```bash
# Generate migration
cd Backend
alembic revision --autogenerate -m "add_copilot_tables"
alembic upgrade head
```

---

## 4. Backend Implementation

### 4.1 File Structure

```
Backend/app/
├── api/routes/
│   └── copilot.py                          # NEW — All copilot API endpoints
├── services/
│   ├── copilot/                            # NEW — Copilot service package
│   │   ├── __init__.py
│   │   ├── copilot_service.py              # Orchestrator
│   │   ├── daily_brief_service.py          # Daily brief generation
│   │   ├── meeting_prep_service.py         # Meeting prep generation
│   │   ├── campaign_optimizer_service.py   # Campaign analysis
│   │   ├── pipeline_risk_service.py        # Pipeline risk detection
│   │   ├── notification_service.py         # Email & Slack delivery
│   │   └── prompts.py                      # All LLM prompt templates
│   └── (existing services unchanged)
├── schemas/
│   └── copilot.py                          # NEW — Pydantic request/response models
├── db/models/
│   ├── copilot_brief.py                    # NEW
│   ├── copilot_meeting_prep.py             # NEW
│   ├── copilot_campaign_analysis.py        # NEW
│   ├── copilot_pipeline_alert.py           # NEW
│   └── copilot_preferences.py             # NEW
└── tasks/
    └── copilot_tasks.py                    # NEW — Celery tasks for scheduled jobs
```

### 4.2 Pydantic Schemas

```python
# Backend/app/schemas/copilot.py

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date

# ── Daily Brief ──────────────────────────────────────────────
class DailyBriefResponse(BaseModel):
    id: str
    brief_date: date
    summary: str
    priority_actions: List[Dict[str, Any]]
    new_signals: List[Dict[str, Any]]
    follow_ups: List[Dict[str, Any]]
    key_metrics: Dict[str, Any]
    status: str

# ── Meeting Prep ─────────────────────────────────────────────
class MeetingPrepRequest(BaseModel):
    company_name: str = Field(..., min_length=1)
    company_domain: Optional[str] = None
    prospect_name: Optional[str] = None
    prospect_title: Optional[str] = None
    meeting_type: Optional[str] = "discovery"  # "discovery", "demo", "negotiation", "follow_up"
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

# ── Campaign Optimizer ───────────────────────────────────────
class CampaignOptimizerRequest(BaseModel):
    subject_line: str
    email_body: str
    target_audience: Optional[str] = None
    campaign_id: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    # metrics: { "sent": 500, "opened": 150, "replied": 20, "bounced": 10 }

class CampaignOptimizerResponse(BaseModel):
    id: str
    overall_score: int = Field(ge=0, le=100)
    category_scores: Dict[str, int]
    weaknesses: List[str]
    improvements: List[str]
    suggested_subjects: List[str]
    suggested_openers: List[str]
    predicted_lift: str

# ── Pipeline Risk Alert ──────────────────────────────────────
class PipelineAlertResponse(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    description: str
    entity_type: Optional[str]
    entity_name: Optional[str]
    recommendation: Optional[str]
    is_resolved: bool
    created_at: str

class PipelineAlertResolveRequest(BaseModel):
    alert_id: str

# ── Preferences ──────────────────────────────────────────────
class CopilotPreferencesRequest(BaseModel):
    daily_brief_enabled: Optional[bool] = None
    daily_brief_time: Optional[str] = None
    daily_brief_timezone: Optional[str] = None
    notify_email: Optional[bool] = None
    notify_slack: Optional[bool] = None
    slack_webhook_url: Optional[str] = None
    pipeline_alerts_enabled: Optional[bool] = None
    alert_severity_threshold: Optional[str] = None
```

### 4.3 API Routes

```python
# Backend/app/api/routes/copilot.py

router = APIRouter(prefix="/api/copilot", tags=["copilot"])

# ── Daily Brief ──
GET  /api/copilot/daily-brief                # Get today's brief (generate if missing)
GET  /api/copilot/daily-brief/{date}         # Get brief for a specific date
POST /api/copilot/daily-brief/generate       # Force regenerate today's brief

# ── Meeting Prep ──
POST /api/copilot/meeting-prep               # Generate a meeting prep brief
GET  /api/copilot/meeting-prep/{id}          # Retrieve a saved meeting prep
GET  /api/copilot/meeting-prep/history       # List past meeting preps

# ── Campaign Optimizer ──
POST /api/copilot/campaign-optimizer          # Analyze a campaign
GET  /api/copilot/campaign-optimizer/{id}     # Retrieve saved analysis
GET  /api/copilot/campaign-optimizer/history  # List past analyses

# ── Pipeline Risk Alerts ──
GET  /api/copilot/pipeline-alerts             # List active alerts
POST /api/copilot/pipeline-alerts/scan        # Trigger a pipeline scan
PUT  /api/copilot/pipeline-alerts/{id}/resolve # Mark alert as resolved
GET  /api/copilot/pipeline-alerts/summary     # Get alert summary stats

# ── Preferences ──
GET  /api/copilot/preferences                 # Get user's copilot preferences
PUT  /api/copilot/preferences                 # Update preferences

# ── Unified Feed ──
GET  /api/copilot/feed                        # Combined feed: briefs + alerts + insights
```

### 4.4 Core Service — CopilotService (Orchestrator)

```python
# Backend/app/services/copilot/copilot_service.py

class CopilotService:
    """
    Central orchestrator for all Co-Pilot features.
    Composes data from existing services, calls LLM, caches results.
    """
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.signal_detection = SignalDetectionService()
        self.redis = RedisManager
        self.daily_brief_svc = DailyBriefService(db, self.openrouter, self.redis)
        self.meeting_prep_svc = MeetingPrepService(db, self.openrouter, self.signal_detection)
        self.campaign_opt_svc = CampaignOptimizerService(db, self.openrouter)
        self.pipeline_risk_svc = PipelineRiskService(db, self.openrouter)
```

### 4.5 LLM Prompt Templates

```python
# Backend/app/services/copilot/prompts.py

DAILY_BRIEF_SYSTEM_PROMPT = """You are Outmate AI Co-Pilot, a sales intelligence assistant.
Generate a concise daily brief for a sales rep. Focus on actionable items.

You will receive:
- Recent signals detected for the user's tracked companies/prospects
- Pending follow-ups and tasks
- Campaign performance snapshots
- New leads that match their ICP

Return a structured JSON with:
{
  "summary": "1-2 sentence overview of the day",
  "priority_actions": [
    {"priority": 1, "action": "...", "reason": "...", "entity": "...", "entity_type": "prospect|company"}
  ],
  "new_signals": [
    {"signal_type": "...", "entity": "...", "description": "...", "urgency": "high|medium|low"}
  ],
  "follow_ups": [
    {"prospect": "...", "company": "...", "last_contact": "...", "suggested_action": "..."}
  ],
  "key_metrics": {
    "active_campaigns": 0,
    "open_rate_trend": "up|down|stable",
    "new_leads_today": 0,
    "signals_detected": 0
  }
}
Only return valid JSON. No markdown, no explanation."""

MEETING_PREP_SYSTEM_PROMPT = """You are Outmate AI Co-Pilot preparing a sales rep for a meeting.

You will receive company data, prospect data, and detected signals.
Generate a comprehensive but scannable pre-call brief.

Return a structured JSON with:
{
  "company_snapshot": {
    "name": "...",
    "industry": "...",
    "size": "...",
    "revenue": "...",
    "recent_news": ["..."],
    "tech_stack": ["..."],
    "growth_indicators": ["..."]
  },
  "prospect_profile": {
    "name": "...",
    "title": "...",
    "background": "...",
    "likely_priorities": ["..."],
    "communication_style_hint": "..."
  },
  "talking_points": ["..."],
  "discovery_questions": ["..."],
  "signals": [{"type": "...", "detail": "...", "relevance": "..."}],
  "risk_factors": ["..."],
  "competitors_mentioned": ["..."],
  "recommended_approach": "..."
}
Only return valid JSON."""

CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT = """You are Outmate AI Co-Pilot analyzing a sales email campaign.

You will receive the campaign subject line, body, target audience info, and performance metrics (if available).
Analyze the campaign and provide actionable optimization recommendations.

Return a structured JSON with:
{
  "overall_score": 0-100,
  "category_scores": {
    "subject_line": 0-100,
    "personalization": 0-100,
    "value_proposition": 0-100,
    "call_to_action": 0-100,
    "tone_and_length": 0-100,
    "spam_risk": 0-100
  },
  "weaknesses": ["..."],
  "improvements": ["specific improvement suggestion..."],
  "suggested_subjects": ["alt subject 1", "alt subject 2", "alt subject 3"],
  "suggested_openers": ["alt opener 1", "alt opener 2"],
  "predicted_lift": "Estimated X-Y% improvement in open/reply rates if changes are applied"
}
Only return valid JSON."""

PIPELINE_RISK_SYSTEM_PROMPT = """You are Outmate AI Co-Pilot analyzing a sales pipeline for risks.

You will receive:
- Active prospects and their engagement history
- Campaign performance data
- Signal data for tracked companies

Identify pipeline risks such as:
- Stuck deals (no activity for extended periods)
- Ghost prospects (opened emails but never replied)
- Declining engagement trends
- Forecast risks (deals unlikely to close on time)

Return a JSON array of alerts:
[
  {
    "alert_type": "stuck_deal|ghost_prospect|forecast_risk|declining_engagement",
    "severity": "low|medium|high|critical",
    "title": "Short descriptive title",
    "description": "Detailed explanation",
    "entity_type": "prospect|company|campaign",
    "entity_name": "...",
    "recommendation": "What to do about it"
  }
]
Only return valid JSON."""
```

### 4.6 Extending OpenRouterService

The existing `OpenRouterService` only supports a single user message. We need to add a `chat_completion_structured` method for system + user messages with JSON mode:

```python
# Add to Backend/app/services/openrouter_service.py

async def chat_completion_structured(
    self,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 2000,
) -> dict:
    """Send system + user message and parse JSON response."""
    payload = {
        "model": self.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
    }
    # ... same headers and httpx call as existing method ...
    # ... parse response and json.loads() the content ...
```

---

## 5. Frontend Implementation

### 5.1 New Files Structure

```
Frontend/
├── app/(dashboard)/copilot/
│   ├── layout.tsx                          # Co-Pilot section layout with sidebar nav
│   ├── page.tsx                            # Main copilot dashboard (unified feed)
│   ├── daily-brief/
│   │   └── page.tsx                        # Daily brief full view
│   ├── meeting-prep/
│   │   └── page.tsx                        # Meeting prep generator
│   ├── campaign-optimizer/
│   │   └── page.tsx                        # Campaign analysis tool
│   ├── pipeline-alerts/
│   │   └── page.tsx                        # Pipeline risk alerts dashboard
│   └── settings/
│       └── page.tsx                        # Copilot preferences
├── components/copilot/
│   ├── copilot-sidebar.tsx                 # Floating/collapsible copilot sidebar
│   ├── copilot-command-bar.tsx             # Cmd+K style quick access
│   ├── daily-brief-card.tsx                # Brief summary card widget
│   ├── daily-brief-detail.tsx              # Full brief view
│   ├── meeting-prep-form.tsx               # Input form for meeting prep
│   ├── meeting-prep-result.tsx             # Rendered meeting prep
│   ├── campaign-optimizer-form.tsx         # Campaign input form
│   ├── campaign-optimizer-result.tsx       # Score + suggestions display
│   ├── pipeline-alert-card.tsx             # Individual alert card
│   ├── pipeline-alerts-list.tsx            # List of alerts with filters
│   ├── copilot-feed.tsx                    # Unified activity feed
│   └── copilot-preferences-form.tsx        # Settings form
├── lib/api/
│   └── copilot.ts                          # NEW — API client functions
└── hooks/
    └── use-copilot.ts                      # NEW — React hooks for copilot state
```

### 5.2 API Client

```typescript
// Frontend/lib/api/copilot.ts

import axios from "axios";

const API = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

// Attach JWT from localStorage/cookie
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const copilotApi = {
  // Daily Brief
  getDailyBrief: () => API.get("/api/copilot/daily-brief"),
  getDailyBriefByDate: (date: string) => API.get(`/api/copilot/daily-brief/${date}`),
  regenerateDailyBrief: () => API.post("/api/copilot/daily-brief/generate"),

  // Meeting Prep
  generateMeetingPrep: (data: MeetingPrepInput) => API.post("/api/copilot/meeting-prep", data),
  getMeetingPrep: (id: string) => API.get(`/api/copilot/meeting-prep/${id}`),
  getMeetingPrepHistory: () => API.get("/api/copilot/meeting-prep/history"),

  // Campaign Optimizer
  analyzeCampaign: (data: CampaignOptimizerInput) => API.post("/api/copilot/campaign-optimizer", data),
  getCampaignAnalysis: (id: string) => API.get(`/api/copilot/campaign-optimizer/${id}`),

  // Pipeline Alerts
  getPipelineAlerts: () => API.get("/api/copilot/pipeline-alerts"),
  scanPipeline: () => API.post("/api/copilot/pipeline-alerts/scan"),
  resolveAlert: (id: string) => API.put(`/api/copilot/pipeline-alerts/${id}/resolve`),
  getAlertSummary: () => API.get("/api/copilot/pipeline-alerts/summary"),

  // Preferences
  getPreferences: () => API.get("/api/copilot/preferences"),
  updatePreferences: (data: CopilotPreferences) => API.put("/api/copilot/preferences", data),

  // Unified Feed
  getFeed: () => API.get("/api/copilot/feed"),
};
```

### 5.3 Copilot Sidebar (Global Widget)

A persistent, collapsible sidebar available on every dashboard page. This is the primary entry point for the Co-Pilot.

Location: Inject into `Frontend/components/layout/main-layout-wrapper.tsx`

Behavior:
- Collapsed by default: shows a small floating "Co-Pilot" icon (bottom-right or right-edge)
- Expanded: slides out a panel showing the daily brief summary, active alerts count, and quick actions
- Keyboard shortcut: `Ctrl+Shift+P` or `Cmd+Shift+P` to toggle

---

## 6. Feature 1: Daily Brief

### What It Does
Every morning (or on-demand), generates a prioritized action list for the sales rep. Shows new signals, follow-ups needed, campaign performance, and key metrics.

### Data Sources
1. **Signals** — Query `SignalDetectionService` for user's tracked companies
2. **Prospects** — Query DB for prospects the user has interacted with recently
3. **Campaigns** — Query `CampaignDashboardService` for active campaign stats
4. **Search History** — Query `search` + `search_results` tables for recent searches

### Backend Flow
1. `GET /api/copilot/daily-brief` hits `CopilotService.get_daily_brief(user_id)`
2. Check Redis cache key `copilot:brief:{user_id}:{today}` — return if cached
3. If not cached, gather context data:
   - Fetch recent signals for user's companies (last 24h)
   - Fetch prospects with stale follow-up dates
   - Fetch active campaign metrics
   - Fetch new leads from recent searches
4. Compose user prompt with all context data
5. Call `OpenRouterService.chat_completion_structured()` with `DAILY_BRIEF_SYSTEM_PROMPT`
6. Parse JSON response, save to `copilot_briefs` table
7. Cache in Redis (TTL 4 hours)
8. Return structured response

### Email/Slack Delivery (Scheduled)
- Celery Beat task runs at each user's configured `daily_brief_time`
- Generates brief, formats as HTML email or Slack Block Kit message
- Sends via SMTP (email) or Slack webhook

### Frontend
- **Dashboard widget**: `daily-brief-card.tsx` shown on the main dashboard page
- **Full view**: `/copilot/daily-brief` page with expandable sections
- **Copilot sidebar**: Shows brief summary with "View Full Brief" link

---

## 7. Feature 2: Meeting Prep

### What It Does
User inputs a company name (+ optional prospect name) and gets a structured pre-call brief with company data, talking points, questions, signals, and risk factors.

### Data Sources
1. **Company data** — Query `companies` table by name/domain; enrich via CrustData/Explorium if missing
2. **Prospect data** — Query `prospects` table; enrich via ContactOut if missing
3. **Signals** — Run signal detection for the specific company
4. **News** — Use `SignalFetcherService` for Google News RSS about the company
5. **Existing interactions** — Check if user has previous search results or campaigns involving this company

### Backend Flow
1. `POST /api/copilot/meeting-prep` with `{ company_name, prospect_name?, ... }`
2. Look up company in DB by name/domain; if not found, run CrustData enrichment
3. Look up prospect in DB; if not found and name provided, run ContactOut lookup
4. Run `SignalDetectionService.detect_signals()` for the company
5. Run `SignalFetcherService.run_signal()` for recent news
6. Compose user prompt with all gathered data
7. Call `OpenRouterService.chat_completion_structured()` with `MEETING_PREP_SYSTEM_PROMPT`
8. Save to `copilot_meeting_preps` table
9. Return structured response

### Frontend
- **Form page**: `/copilot/meeting-prep` with inputs for company, prospect, meeting type
- **Auto-suggest**: Company name input uses existing autocomplete endpoint (`/api/proxy/autocomplete`)
- **Result display**: Structured sections with collapsible panels for each section (snapshot, talking points, questions, etc.)
- **Export**: "Copy to clipboard" / "Export as PDF" buttons
- **History**: List of previously generated preps with search/filter

---

## 8. Feature 3: Campaign Optimizer

### What It Does
User pastes their email campaign subject + body (and optionally metrics), and gets an AI-powered score, weakness analysis, and improvement suggestions.

### Data Sources
1. **User input** — Subject line, email body, target audience description, performance metrics
2. **Existing campaign data** — If `campaign_id` provided, pull from `CampaignDashboardService`
3. **Industry benchmarks** — Hardcoded or LLM-inferred benchmarks for context

### Backend Flow
1. `POST /api/copilot/campaign-optimizer` with campaign data
2. If `campaign_id` provided, fetch existing metrics from dashboard service
3. Compose user prompt with subject, body, audience, and metrics
4. Call `OpenRouterService.chat_completion_structured()` with `CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT`
5. Save to `copilot_campaign_analyses` table
6. Return structured response

### Frontend
- **Form page**: `/copilot/campaign-optimizer` with textarea for subject/body, optional metrics inputs
- **Score display**: Circular gauge for overall score, bar charts for category scores
- **Suggestions**: Side-by-side comparison of original vs. suggested subject lines
- **Quick apply**: "Use this subject" button to copy suggestion to clipboard
- **History**: Past analyses with score trends

### Competitor Reference (Jiva)
Research Jiva's campaign optimization features for inspiration:
- A/B test suggestions
- Send-time optimization
- Audience segment recommendations
- Multi-touch sequence analysis (not just single email)

---

## 9. Feature 4: Pipeline Risk Alert

### What It Does
Continuously monitors the user's pipeline for risks — stuck deals, ghost prospects, declining engagement — and surfaces alerts with remediation suggestions.

### Data Sources
1. **Prospect engagement** — Search results + campaign interaction timestamps
2. **Campaign metrics** — Open rates, reply rates, bounce rates from `CampaignDashboardService`
3. **Signals** — Negative signals (layoffs, leadership changes) from signal detection
4. **Activity gaps** — Prospects with no interaction in N days

### Backend Flow
1. `POST /api/copilot/pipeline-alerts/scan` triggers a full pipeline scan
2. Gather data:
   - All prospects with `updated_at` older than 14 days
   - Campaigns with declining open/reply rates
   - Prospects who opened emails but never replied (ghost prospects)
   - Companies with negative signals
3. Compose user prompt with pipeline data
4. Call `OpenRouterService.chat_completion_structured()` with `PIPELINE_RISK_SYSTEM_PROMPT`
5. Parse alert array, save new alerts to `copilot_pipeline_alerts`
6. Deduplicate against existing unresolved alerts
7. Return alerts list

### Scheduled Scanning
- Celery task runs every 6 hours
- Only generates new alerts for changes since last scan
- High-severity alerts trigger immediate email/Slack notification

### Frontend
- **Dashboard page**: `/copilot/pipeline-alerts` with severity filters, date range
- **Alert cards**: Color-coded by severity, with expandable details and recommendation
- **Resolve action**: "Mark as Resolved" button with optional note
- **Summary stats**: Total alerts by type/severity, trend over time

### Competitor Reference (Apollo)
Research Apollo's pipeline management features:
- Deal health scoring
- Activity-based risk signals
- Automated task creation for at-risk deals
- Pipeline velocity metrics

---

## 10. Additional Co-Pilot Features

Beyond the four core features, these additions would complete the Co-Pilot experience:

### 10.1 Smart Follow-Up Composer
**What**: When a rep needs to follow up with a prospect, the Co-Pilot generates a personalized follow-up email based on previous interactions, signals, and time elapsed.

**Implementation**:
- New endpoint: `POST /api/copilot/follow-up-composer`
- Input: `{ prospect_id, last_interaction_summary?, tone? }`
- Uses prospect data + signals + campaign history to generate email
- New prompt template: `FOLLOW_UP_COMPOSER_PROMPT`
- Frontend: Quick action button on prospect cards throughout the app

### 10.2 ICP Match Scorer
**What**: Scores any prospect/company against the user's Ideal Customer Profile and explains why they're a good or bad fit.

**Implementation**:
- New endpoint: `POST /api/copilot/icp-score`
- Input: `{ prospect_id or company_id }` + user's ICP criteria (stored in preferences)
- Add `icp_criteria` JSONB field to `copilot_user_preferences`
- Returns: Score (0-100), matching factors, gaps, recommended actions
- Frontend: Badge/score shown on prospect and company cards across the app

### 10.3 Objection Handler
**What**: Rep enters a prospect's objection (e.g., "too expensive", "not the right time") and gets AI-generated response frameworks tailored to the prospect's context.

**Implementation**:
- New endpoint: `POST /api/copilot/objection-handler`
- Input: `{ objection_text, prospect_id?, company_id?, deal_context? }`
- Returns: 2-3 response frameworks with tone variations (empathetic, data-driven, challenger)
- Frontend: Chat-like interface in the copilot sidebar

### 10.4 Weekly Performance Digest
**What**: A weekly rollup showing what the rep accomplished, what moved forward, what stalled, and recommended focus areas for next week.

**Implementation**:
- Reuse `DailyBriefService` with `brief_type="weekly"` and a different prompt
- Celery Beat task runs every Monday morning
- Includes: emails sent, responses received, meetings booked, pipeline movement
- Delivered via email/Slack like the daily brief

### 10.5 Real-Time Signal Nudges
**What**: When a significant signal is detected for a tracked company/prospect, push an immediate notification to the user.

**Implementation**:
- Extend `SignalDetectionService` to emit events when high-priority signals found
- Use Server-Sent Events (SSE) endpoint: `GET /api/copilot/stream` for real-time push
- Frontend: Toast notifications via existing `use-toast.ts` hook
- Also push to Slack/email for high-severity signals

### 10.6 Conversation Intelligence Summary
**What**: After a call/meeting, rep pastes notes or a transcript, and Co-Pilot extracts key action items, sentiment, next steps, and updates the prospect record.

**Implementation**:
- New endpoint: `POST /api/copilot/conversation-summary`
- Input: `{ transcript_or_notes, prospect_id?, meeting_type? }`
- Returns: Action items, sentiment analysis, next steps, risk flags
- Auto-updates prospect record with extracted information

---

## 11. Notification System (Email/Slack)

### 11.1 Email Delivery

**Option A — SMTP Direct (Simple)**
```python
# Backend/app/services/copilot/notification_service.py

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

class NotificationService:
    async def send_email(self, to: str, subject: str, html_body: str):
        # Use SMTP settings from environment
        # SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
```

**Option B — SendGrid/Resend (Production recommended)**
Add `sendgrid` or `resend` to `requirements.txt` for reliable transactional email.

New env vars needed:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@outmate.ai
SMTP_PASSWORD=app_password_here
# OR
SENDGRID_API_KEY=your_key
```

### 11.2 Slack Integration

**Incoming Webhooks (simplest)**:
- User configures a Slack webhook URL in copilot preferences
- Notifications POST to that webhook with Block Kit formatted messages

**Slack App (advanced, future)**:
- Build a Slack app with slash commands (`/outmate brief`, `/outmate prep Acme`)
- OAuth flow for workspace installation
- Add to preferences: `slack_team_id`, `slack_channel_id`

### 11.3 Celery Beat Schedule

```python
# Backend/app/tasks/copilot_tasks.py

from celery import Celery
from celery.schedules import crontab

app = Celery("outmate")
app.config_from_object("app.core.celery_config")

app.conf.beat_schedule = {
    "generate-daily-briefs": {
        "task": "app.tasks.copilot_tasks.generate_all_daily_briefs",
        "schedule": crontab(minute=0, hour="6,7,8,9"),  # Run every hour 6-9 AM UTC
        # Each run checks which users have their brief_time in the current hour
    },
    "scan-pipeline-risks": {
        "task": "app.tasks.copilot_tasks.scan_all_pipelines",
        "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
    },
    "weekly-digest": {
        "task": "app.tasks.copilot_tasks.generate_weekly_digests",
        "schedule": crontab(minute=0, hour=8, day_of_week=1),  # Monday 8 AM UTC
    },
}
```

---

## 12. Implementation Order & Phases

### Phase 1 — Foundation (Week 1-2)
1. Create all DB models and run Alembic migration
2. Extend `OpenRouterService` with `chat_completion_structured()`
3. Build `CopilotService` orchestrator skeleton
4. Build `prompts.py` with all prompt templates
5. Create Pydantic schemas in `schemas/copilot.py`
6. Create the `/api/copilot` router with stub endpoints
7. Register router in `main.py`
8. Frontend: Create `lib/api/copilot.ts` API client
9. Frontend: Create `/copilot` layout and navigation

### Phase 2 — Daily Brief (Week 2-3)
1. Implement `DailyBriefService` — data gathering + LLM call
2. Wire up `GET /api/copilot/daily-brief` and `POST .../generate`
3. Add Redis caching for briefs
4. Frontend: Build `daily-brief-card.tsx` and `daily-brief-detail.tsx`
5. Frontend: Add daily brief widget to main dashboard
6. Frontend: Build `/copilot/daily-brief` full page

### Phase 3 — Meeting Prep (Week 3-4)
1. Implement `MeetingPrepService` — company/prospect lookup + enrichment + LLM
2. Wire up `POST /api/copilot/meeting-prep` and history endpoints
3. Frontend: Build `meeting-prep-form.tsx` and `meeting-prep-result.tsx`
4. Frontend: Build `/copilot/meeting-prep` page with autocomplete

### Phase 4 — Campaign Optimizer (Week 4-5)
1. Implement `CampaignOptimizerService` — campaign analysis + LLM scoring
2. Wire up `POST /api/copilot/campaign-optimizer` and history
3. Frontend: Build `campaign-optimizer-form.tsx` and `campaign-optimizer-result.tsx`
4. Frontend: Build `/copilot/campaign-optimizer` page with score visualizations

### Phase 5 — Pipeline Risk Alerts (Week 5-6)
1. Implement `PipelineRiskService` — pipeline data gathering + LLM analysis
2. Wire up all `/api/copilot/pipeline-alerts` endpoints
3. Frontend: Build `pipeline-alert-card.tsx` and `pipeline-alerts-list.tsx`
4. Frontend: Build `/copilot/pipeline-alerts` page

### Phase 6 — Notifications & Scheduling (Week 6-7)
1. Implement `NotificationService` — email (SMTP/SendGrid) + Slack webhooks
2. Set up Celery Beat configuration
3. Implement `copilot_tasks.py` — scheduled brief generation + delivery
4. Frontend: Build copilot preferences/settings page
5. Add Docker service for Celery worker + beat in `docker-compose.yml`

### Phase 7 — Copilot Sidebar & Polish (Week 7-8)
1. Build `copilot-sidebar.tsx` — global floating panel
2. Build `copilot-command-bar.tsx` — Cmd+K quick access
3. Inject sidebar into `main-layout-wrapper.tsx`
4. Build `copilot-feed.tsx` — unified activity feed
5. Add keyboard shortcuts
6. End-to-end testing and prompt tuning

### Phase 8 — Additional Features (Week 8+)
- Smart Follow-Up Composer
- ICP Match Scorer
- Objection Handler
- Weekly Digest
- Real-Time Signal Nudges (SSE)
- Conversation Intelligence Summary

---

## 13. File-by-File Checklist

### Backend — New Files
| # | File | Purpose |
|---|------|---------|
| 1 | `app/db/models/copilot_brief.py` | CopilotBrief model |
| 2 | `app/db/models/copilot_meeting_prep.py` | CopilotMeetingPrep model |
| 3 | `app/db/models/copilot_campaign_analysis.py` | CopilotCampaignAnalysis model |
| 4 | `app/db/models/copilot_pipeline_alert.py` | CopilotPipelineAlert model |
| 5 | `app/db/models/copilot_preferences.py` | CopilotUserPreferences model |
| 6 | `app/schemas/copilot.py` | All Pydantic request/response schemas |
| 7 | `app/api/routes/copilot.py` | All Co-Pilot API endpoints |
| 8 | `app/services/copilot/__init__.py` | Package init |
| 9 | `app/services/copilot/copilot_service.py` | Orchestrator service |
| 10 | `app/services/copilot/daily_brief_service.py` | Daily brief generation |
| 11 | `app/services/copilot/meeting_prep_service.py` | Meeting prep generation |
| 12 | `app/services/copilot/campaign_optimizer_service.py` | Campaign analysis |
| 13 | `app/services/copilot/pipeline_risk_service.py` | Pipeline risk detection |
| 14 | `app/services/copilot/notification_service.py` | Email/Slack delivery |
| 15 | `app/services/copilot/prompts.py` | All LLM prompt templates |
| 16 | `app/tasks/copilot_tasks.py` | Celery scheduled tasks |
| 17 | `alembic/versions/xxx_add_copilot_tables.py` | Database migration |

### Backend — Modified Files
| # | File | Change |
|---|------|--------|
| 1 | `app/main.py` | Add `from app.api.routes import copilot` and `app.include_router(copilot.router, ...)` |
| 2 | `app/services/openrouter_service.py` | Add `chat_completion_structured()` method |
| 3 | `app/db/models/__init__.py` | Import new copilot models |
| 4 | `app/core/settings.py` | Add SMTP/notification env vars |
| 5 | `docker-compose.yml` | Add Celery worker + beat services |
| 6 | `requirements.txt` | Add `sendgrid` or `python-multipart` (if not already) |

### Frontend — New Files
| # | File | Purpose |
|---|------|---------|
| 1 | `app/(dashboard)/copilot/layout.tsx` | Copilot section layout |
| 2 | `app/(dashboard)/copilot/page.tsx` | Copilot main dashboard / feed |
| 3 | `app/(dashboard)/copilot/daily-brief/page.tsx` | Daily brief page |
| 4 | `app/(dashboard)/copilot/meeting-prep/page.tsx` | Meeting prep page |
| 5 | `app/(dashboard)/copilot/campaign-optimizer/page.tsx` | Campaign optimizer page |
| 6 | `app/(dashboard)/copilot/pipeline-alerts/page.tsx` | Pipeline alerts page |
| 7 | `app/(dashboard)/copilot/settings/page.tsx` | Copilot preferences page |
| 8 | `components/copilot/copilot-sidebar.tsx` | Global floating sidebar |
| 9 | `components/copilot/copilot-command-bar.tsx` | Cmd+K quick access |
| 10 | `components/copilot/daily-brief-card.tsx` | Brief summary widget |
| 11 | `components/copilot/daily-brief-detail.tsx` | Full brief view |
| 12 | `components/copilot/meeting-prep-form.tsx` | Meeting prep input form |
| 13 | `components/copilot/meeting-prep-result.tsx` | Meeting prep output |
| 14 | `components/copilot/campaign-optimizer-form.tsx` | Campaign input form |
| 15 | `components/copilot/campaign-optimizer-result.tsx` | Campaign score + suggestions |
| 16 | `components/copilot/pipeline-alert-card.tsx` | Alert card component |
| 17 | `components/copilot/pipeline-alerts-list.tsx` | Alert list with filters |
| 18 | `components/copilot/copilot-feed.tsx` | Unified activity feed |
| 19 | `components/copilot/copilot-preferences-form.tsx` | Settings form |
| 20 | `lib/api/copilot.ts` | API client for all copilot endpoints |
| 21 | `hooks/use-copilot.ts` | React hooks for copilot state |

### Frontend — Modified Files
| # | File | Change |
|---|------|--------|
| 1 | `components/layout/main-layout-wrapper.tsx` | Inject `<CopilotSidebar />` |
| 2 | `app/(dashboard)/dashboard/page.tsx` | Add daily brief widget card |
| 3 | Navigation/sidebar component | Add "Co-Pilot" nav item with icon |

---

## Environment Variables to Add

```env
# Backend/.env — Add these for notification support
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@outmate.ai
SMTP_PASSWORD=your_app_password
# OR use SendGrid
SENDGRID_API_KEY=your_sendgrid_key

# Celery broker (reuse existing Redis)
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
```

## Docker Compose Additions

```yaml
# Add to docker-compose.yml

  celery-worker:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    container_name: outmate-celery-worker
    command: celery -A app.tasks.copilot_tasks worker --loglevel=info
    env_file:
      - ./Backend/.env
    depends_on:
      - redis
      - postgres
    networks:
      - outmate-network

  celery-beat:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    container_name: outmate-celery-beat
    command: celery -A app.tasks.copilot_tasks beat --loglevel=info
    env_file:
      - ./Backend/.env
    depends_on:
      - redis
      - postgres
    networks:
      - outmate-network
```
