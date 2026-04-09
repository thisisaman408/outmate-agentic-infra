# Feature Architecture & Data Models

Visual reference for the 4 features with complete database schema, service interactions, and API endpoint structure.

---

## 1. ENRICHMENT ARCHITECTURE

### Current Flow Diagram
```
┌─────────────────┐
│ Frontend        │
│ enrichment UI   │
└────────┬────────┘
         │ POST /company
         │ {company_name, domain, field}
         ▼
┌─────────────────────────────────────┐
│ enrichment_routes.py                │
│ POST /company                       │
└────────┬────────────────────────────┘
         │
         ├─────────────────┬──────────────────┐
         ▼                 ▼                  ▼
    BetterContact    ContactOut      Explorium
    (email, phone)   (email, phone)  (company data)
         │                 │                  │
         └─────────────────┴──────────────────┘
                   │
                   ▼ cache in Redis
                   
         ┌──────────────────────┐
         │ Response             │
         │ {email, status}      │
         │ or {phone, status}   │
         └──────────────────────┘
```

### Services
- `bettercontact_service.py` → BetterContact HTTP API
- `contactout_service.py` → ContactOut HTTP API
- `explorium_service.py` → Explorium HTTP API (enrichment module)

### Credit Model
| Action | Cost | Source |
|--------|------|--------|
| Email Reveal | 1 | BetterContact → ContactOut waterfall |
| Phone Reveal | 10 | BetterContact → ContactOut waterfall |
| Company Data | Free | Explorium (via copilot) |

---

## 2. SIGNALS ARCHITECTURE

### Current Data Model (In-Memory)
```python
SIGNAL_STORE = [
    {
        "_id": "signal-a1b2c3d4",
        "name": "Series B Funding Alert",
        "type": "business_event",
        "category": "funding",
        "status": "active",
        "configuration": {
            "event_types": ["new_funding_round"],
            "funding_range": [5000000, 100000000],
            "industry_filters": ["SaaS"]
        },
        "created_at": "2026-03-24T10:00:00Z",
        "last_run_at": "2026-03-24T12:00:00Z",
        "cursor_state": {}  # For pagination in Explorium APIs
    }
]

SIGNAL_RESULTS_STORE = {
    "signal-a1b2c3d4": [
        {
            "_id": "result-x1y2z3",
            "signal_id": "signal-a1b2c3d4",
            "title": "TechCorp raises Series B",
            "description": "Series B funding detected",
            "source_url": "https://...",
            "metadata": {"source": "Explorium"},
            "found_at": "2026-03-24T12:30:00Z"
        }
    ]
}
```

### Signal Types & Sources
```
┌─────────────────────────────────────────────────────┐
│ SIGNAL TYPES                                        │
├─────────────────────────────────────────────────────┤
│ business_event (Explorium)                          │
│ ├─ ipo_announcement                                │
│ ├─ new_funding_round                               │
│ ├─ new_investment                                   │
│ ├─ merger_and_acquisitions                         │
│ ├─ team_expansion                                   │
│ ├─ team_reduction                                   │
│ └─ product_launch                                   │
│                                                     │
│ prospect_signal (Crustdata)                         │
│ ├─ prospect_changed_role                           │
│ ├─ prospect_changed_company                        │
│ └─ prospect_job_start_anniversary                  │
│                                                     │
│ intent_signal (Bombora / Sponsor)                  │
│ ├─ Buyer intent signals (real-time B2B)           │
│                                                     │
│ websight_signal (Clearbit / others)                │
│ └─ Website visitor data                            │
└─────────────────────────────────────────────────────┘
```

### Service Stack
```
signals.py (FastAPI routes)
    ├─ SignalDetectionService
    │   ├─ ExploriumService (companies)
    │   └─ CrustdataService (prospects)
    │
    └─ SignalFetcherService
        ├─ Explorium API calls
        └─ Background async tasks
```

### API Endpoints
```
GET    /signals                       → List all signals
POST   /signals                       → Create signal (starts bg run)
POST   /signals/preview               → Preview matches (no save)
POST   /signals/{id}/run              → Manual trigger
GET    /signals/{id}/results          → Get latest 100 results
POST   /signals/detect                → Detect signals for specific companies
```

---

## 3. WATCHER ARCHITECTURE

### Complete Data Model

```sql
CREATE TABLE watchers (
    -- Identifiers
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(1024),
    
    -- Type & Status
    type VARCHAR(32),  -- 'event', 'account', 'lead'
    status VARCHAR(32),  -- 'active', 'paused'
    
    -- Event Watcher Fields
    criteria JSONB,  -- {event_type: [], funding_stage: [], ...}
    
    -- Account Watcher Fields
    account_name VARCHAR(255),
    account_domain VARCHAR(255),
    business_id VARCHAR(64),  -- Lookedup from account_domain
    
    -- Lead Watcher Fields
    lead_name VARCHAR(255),
    lead_title VARCHAR(255),
    lead_company VARCHAR(255),
    lead_email VARCHAR(255),
    prospect_id VARCHAR(64),  -- Looked up from lead_email
    
    -- Common
    triggers JSONB,  -- ["Funding Events", "Job Changes", ...]
    notification_settings JSONB,  -- {email: true, slack: false, webhook: "..."}
    
    -- Results (persisted)
    recent_updates JSONB,  -- [{id, type, description, date}, ...]
    matches JSONB,         -- Full match objects
    match_count VARCHAR(16),  -- String: "5"
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_synced_at TIMESTAMP
);
```

### Watcher Type Workflows

#### Event Watcher Sync
```
User creates Event Watcher with criteria:
{
    event_type: ["new_funding_round", "ipo_announcement"],
    funding_stage: ["Series B"],
    technology_category: ["AI"],
    company_size: ["10-50"]
}
    ↓
On /sync:
    ↓
Explorium.search_companies(criteria, limit=50)
    ↓
Returns: [{id, name, domain, description, ...}]
    ↓
For each company:
    ├─ Explorium.fetch_business_events(business_id)
    ├─ Check events match selected triggers
    └─ Create update: {id, type, description, date}
    ↓
Store in recent_updates array
    ↓
Send notifications
```

#### Account Watcher Sync
```
User creates Account Watcher:
{
    accountName: "Stripe",
    accountDomain: "stripe.com",
    triggers: ["Funding Events", "Job Changes"]
}
    ↓
First sync:
    ├─ Explorium.match_businesses([{domain, name}])
    ├─ Extract business_id
    └─ Enroll: Explorium.enroll_business_events(business_id, event_types)
    ↓
On subsequent /sync:
    ├─ Explorium.fetch_business_events(business_id)
    ├─ Map triggers to event types:
    │   "Funding Events" → ["new_funding_round", "new_investment"]
    │   "Job Changes" → ["team_expansion", "team_reduction"]
    │   "Tech Changes" → ["product_launch"]
    │   "News" → ["merger_and_acquisitions", "ipo_announcement"]
    └─ Collect matching events
    ↓
Also fetch firmographics as fallback
    ↓
Store in recent_updates array
    ↓
Send notifications
```

#### Lead Watcher Sync
```
User creates Lead Watcher:
{
    leadName: "Patrick Collison",
    leadTitle: "CEO",
    leadCompany: "Stripe",
    leadEmail: "patrick@stripe.com",
    triggers: ["job_change", "promotion", "content_published"]
}
    ↓
First sync:
    ├─ BetterContact/ContactOut.enrich_prospect() → prospect_id
    └─ Cache prospect_id
    ↓
On /sync:
    ├─ Map lead triggers to prospect events:
    │   "job_change" → ["prospect_changed_role", "prospect_changed_company"]
    │   "promotion" → ["prospect_changed_role"]
    │   "content_published" → ["prospect_linkedin_post"]
    │
    ├─ Explorium.fetch_prospect_events(prospect_id, event_types)
    │
    ├─ For each event:
    │   └─ Create update: {id, type (e.g., prospect_changed_role), description, date}
    │
    ├─ Also fetch contact enrichment (email, phone, LinkedIn URL)
    │
    └─ Fallback: enrich_company(lead_company) for context
    ↓
Store in recent_updates array
    ↓
Send notifications (email, Slack webhook, etc.)
```

### Trigger Mapping Tables
```python
# Account Watcher Triggers → Explorium Events
ACCOUNT_TRIGGER_MAP = {
    "Funding Events": ["new_funding_round", "new_investment"],
    "Website Content Changes": [],  # Via enrichment API
    "Job Changes": ["team_expansion", "team_reduction"],
    "Technology Changes": ["product_launch"],
    "News Mentions": ["merger_and_acquisitions", "ipo_announcement", "acquisition"],
    "Web Traffic Changes": [],  # Via enrichment API
    # Legacy format support
    "funding": ["new_funding_round", "new_investment"],
    "job_changes": ["team_expansion", "team_reduction"],
}

# Lead Watcher Triggers → Prospect Events
LEAD_TRIGGER_MAP = {
    "job_change": ["prospect_changed_role", "prospect_changed_company"],
    "promotion": ["prospect_changed_role"],
    "content_published": ["prospect_linkedin_post"],
    "speaking_engagement": ["prospect_event_appearance"],
    "award": ["prospect_award"],
    "social_activity": ["prospect_linkedin_post"],
}

# Event Watcher Criteria (from frontend)
EVENT_WATCHER_CRITERIA = {
    "event_type": [],  # from BUSINESS_EVENT_TYPES
    "funding_stage": ["Series A", "Series B", ...],
    "job_level": ["C-level", "VP"],
    "department": ["Engineering", "Sales"],
    "technology_category": ["AI", "Machine Learning"],
    "company_size": ["10-50", "50-100"],
    "industry": ["SaaS", "FinTech"],
    "location": ["US", "EU"],
}
```

### Notification System
```
Watcher.notification_settings = {
    "email": true,
    "slack": false,
    "webhook": "https://api.company.com/webhooks/outmate"
}

On sync completion:
    ├─ Email Notification:
    │   └─ Send transactional email with update summary
    │
    ├─ Slack Notification:
    │   └─ POST to Slack webhook with formatted message
    │
    └─ HTTP Webhook:
        └─ POST to user's webhook URL with JSON payload
```

---

## 4. COPILOT ARCHITECTURE

### Complete Data Model

```sql
-- Daily Brief
CREATE TABLE copilot_briefs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    brief_date DATE NOT NULL,
    brief_type VARCHAR(50),  -- "daily"
    content JSONB,  -- {executive_summary, highlights, deals_at_risk, ...}
    status VARCHAR(20),  -- "generated"
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, brief_date, brief_type)
);

-- Meeting Prep
CREATE TABLE copilot_meeting_preps (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    prospect_name VARCHAR(255),
    content JSONB,  -- {company_overview, prospect_profile, talking_points, ...}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Campaign Analysis
CREATE TABLE copilot_campaign_analyses (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    campaign_id VARCHAR(255),
    subject_line VARCHAR(500),
    email_body TEXT,
    score DECIMAL(3,1),  -- 0.0-10.0
    analysis JSONB,  -- {strengths, improvements, specific_suggestions}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pipeline Alerts
CREATE TABLE copilot_pipeline_alerts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    deal_id VARCHAR(255),
    risk_level VARCHAR(20),  -- "high", "medium", "low"
    alert_text TEXT,
    metrics JSONB,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Preferences
CREATE TABLE copilot_user_preferences (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    daily_brief_enabled BOOLEAN DEFAULT true,
    daily_brief_time VARCHAR(5),  -- "08:00"
    daily_brief_timezone VARCHAR(50),  -- "UTC"
    notify_email BOOLEAN DEFAULT true,
    notify_slack BOOLEAN DEFAULT false,
    slack_webhook_url VARCHAR(1024),
    pipeline_alerts_enabled BOOLEAN DEFAULT true,
    alert_severity_threshold VARCHAR(20),  -- "medium"
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat Sessions
CREATE TABLE copilot_chat_sessions (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    messages JSONB,  -- [{role, content, timestamp}, ...]
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX(user_id, updated_at)
);

-- Product Knowledge (RAG)
CREATE TABLE copilot_knowledge_chunks (
    id UUID PRIMARY KEY,
    content TEXT,
    source VARCHAR(255),  -- "copilot_readme", "feature_doc", etc.
    embedding VECTOR(1536),  -- pgvector embeddings
    keywords TSVECTOR,  -- PostgreSQL full-text search
    feature_tags TEXT[],  -- For context matching
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX ON embedding USING ivfflat,
    INDEX ON keywords USING GIN
);
```

### Service Architecture

```
┌───────────────────────────────────────────────────────┐
│ copilot.py (22 API endpoints)                         │
└─────────────────────────────────────────┬─────────────┘
                                          │
          ┌───────────────────────────────┼──────────────────────────────┐
          │                               │                              │
          ▼                               ▼                              ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ CopilotService       │  │ LeadCopilotService   │  │ ProductAssistant     │
│ (Orchestrator)       │  │ (14 lead actions)    │  │ Service (RAG)        │
│                      │  │                      │  │                      │
│ ├─ DailyBriefSvc    │  │ ├─ draft_email      │  │ ├─ KnowledgeService │
│ ├─ MeetingPrepSvc   │  │ ├─ research        │  │ ├─ Tavily search    │
│ ├─ CampaignOptSvc   │  │ ├─ find_similar    │  │ ├─ Feature registry │
│ └─ PipelineRiskSvc  │  │ ├─ meeting_prep    │  │ └─ LLM context      │
│                      │  │ ├─ objection_handler│  │                      │
│ + Enrichment.py     │  │ ├─ [10 more]       │  │                      │
│ + Prompts.py        │  │ └─ streaming SSE   │  │                      │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
          │                        │                         │
          └────────────┬───────────┴────────────┬────────────┘
                       │                        │
        ┌──────────────▼────────────┬───────────▼──────────────┐
        │                           │                          │
        ▼                           ▼                          ▼
   OpenRouter LLM           External Enrichment APIs      PostgreSQL Database
   (Claude 3 Opus)          - Explorium                   (models above)
   - Completions            - Crustdata
   - Streaming             - Tavily
                            - LinkedIn/Clearbit
```

### Lead Copilot Action Flow

```
User on prospect panel → clicks "Draft Email" action
    │
    ├─ Check credits: cost = 1
    │
    ├─ Emit SSE: {stage: "enriching", message: "Researching lead..."}
    │
    ├─ LeadEnrichmentService.get_lead_context(prospect_id)
    │   ├─ DB lookup: {name, title, company, email, phone}
    │   ├─ BetterContact enrich prospect
    │   ├─ Explorium enrich company
    │   ├─ Crustdata fetch LinkedIn data
    │   ├─ SparkPost/Tavily fetch news
    │   └─ Signal detection service get recent signals
    │
    ├─ Build enriched context text:
    │   ├─ format_company_context(company_data)
    │   ├─ format_news_context(articles)
    │   ├─ format_prospect_signals(signals)
    │   └─ Concatenate all
    │
    ├─ Emit SSE: {stage: "generating", message: "Generating email..."}
    │
    ├─ OpenRouterService.chat_completion(
    │     system_prompt=ANNOTATED_EMAIL_SYSTEM_PROMPT,
    │     user_prompt="Draft email for: [prospect] at [company]\n\n" + context,
    │     model="claude-3-opus"
    │   )
    │
    ├─ Stream tokens: for each chunk
    │   └─ Emit SSE: {stage: "token", content: "fragment"}
    │
    ├─ On completion:
    │   ├─ Emit SSE: {stage: "complete", result: {...}, credits_used: 1}
    │   ├─ Deduct credits: user.credits -= 1
    │   └─ Log transaction
    │
    └─ Frontend: consume SSE stream, render UI
```

### 14 Lead Copilot Actions

```
┌─────────────────────────────────────────────────────────────┐
│ LEAD COPILOT ACTIONS (14 total)                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Draft Email (1 credit)                                   │
│    └─ Generate personalized cold email                      │
│                                                              │
│ 2. Meeting Prep (2 credits)                                 │
│    └─ Pre-call research & talking points                    │
│                                                              │
│ 3. Research (2 credits)                                     │
│    └─ Deep dive prospect/company research                   │
│                                                              │
│ 4. Find Similar (1 credit)                                  │
│    └─ Find similar accounts (ICP matching)                  │
│                                                              │
│ 5. Objection Handler (1 credit)                             │
│    └─ Generate rebuttals for objections                     │
│                                                              │
│ 6. Custom (1 credit)                                        │
│    └─ Freeform user question                                │
│                                                              │
│ 7. Crossfire (2 credits)                                    │
│    └─ Competitive analysis                                  │
│                                                              │
│ 8. Compliance (1 credit)                                    │
│    └─ Regulatory/compliance check                           │
│                                                              │
│ 9. Bombora Intent (2 credits)                               │
│    └─ B2B intent signal detection                           │
│                                                              │
│ 10. Talent Radar (2 credits)                                │
│     └─ Talent movement detection                            │
│                                                              │
│ 11. Virality (1 credit)                                     │
│     └─ Content virality potential                           │
│                                                              │
│ 12. Regime Shift (2 credits)                                │
│     └─ Market/technology shift detection                    │
│                                                              │
│ 13. Website Traffic (1 credit)                              │
│     └─ Website traffic analysis                             │
│                                                              │
│ 14. LinkedIn Posts (2 credits)                              │
│     └─ LinkedIn activity analysis                           │
└─────────────────────────────────────────────────────────────┘
```

### Product Assistant (Global Chatbot) Architecture

```
User types question anywhere in app → clicks Copilot icon
    │
    ├─ ProductAssistantService.answer(
    │     question="How do signals work?",
    │     context={route: "/leads", feature_hint: null}
    │   )
    │
    ├─ KnowledgeService.search(question)
    │   ├─ pgvector similarity search (embeddings)
    │   ├─ tsvector full-text search (keywords)
    │   ├─ Combine results
    │   └─ Return top-5 knowledge chunks
    │
    ├─ Build system prompt:
    │   ├─ PRODUCT_ASSISTANT_SYSTEM_PROMPT
    │   ├─ Feature registry links (19 routes)
    │   ├─ Knowledge chunks context
    │   └─ Current route context
    │
    ├─ OpenRouterService.chat_completion(
    │     system_prompt=system,
    │     user_prompt=question,
    │     model="claude-3-opus"
    │   )
    │
    ├─ Stream response with SSE
    │
    └─ Save to CopilotChatSession for history
```

### Knowledge Base Schema
```
Features indexed in copilot_knowledge_chunks:
├─ 19 platform routes (from feature-registry.json)
├─ Each route has:
│   ├─ Documentation
│   ├─ Use cases
│   ├─ Related features
│   └─ Quick tips
│
Raw markdown/docs → Chunked (512-token) → Embedded → Indexed

Search: hybrid (semantic + keyword)
├─ Semantic: pgvector cosine similarity
└─ Keyword: PostgreSQL tsvector GIN index
```

---

## COMPARISON: Feature Persistence & State

| Feature | Persistence | State Management | Refresh |
|---------|-------------|-----------------|---------|
| **Enrichment** | None (stateless) | Returned in response | N/A |
| **Signals** | Memory only (lost on restart) | SIGNAL_STORE list | Manual `/run` |
| **Watcher** | PostgreSQL | recent_updates JSONB | Manual `/sync` |
| **Copilot** | PostgreSQL (briefs, history, preferences) | Session JSONB | Per-action |

---

## API Endpoint Grouping

### Public Routes (no auth required, for system checks)
```
GET /health
GET /docs
```

### Enrichment Endpoints
```
POST /enrichment/company
```

### Signals Endpoints
```
GET    /signals
POST   /signals
POST   /signals/preview
POST   /signals/{id}/run
GET    /signals/{id}/results
POST   /signals/detect
```

### Watcher Endpoints
```
GET    /api/v1/watchers
GET    /api/v1/watchers/{id}
POST   /api/v1/watchers/event
POST   /api/v1/watchers/account
POST   /api/v1/watchers/lead
POST   /api/v1/watchers/{id}/toggle
DELETE /api/v1/watchers/{id}
POST   /api/v1/watchers/{id}/sync
```

### Copilot Endpoints
```
# Daily Brief
GET    /api/copilot/daily-brief
POST   /api/copilot/daily-brief/generate

# Meeting Prep
POST   /api/copilot/meeting-prep
GET    /api/copilot/meeting-prep/history

# Campaign/Email
POST   /api/copilot/campaign-optimizer
POST   /api/copilot/email-optimizer

# Pipeline
GET    /api/copilot/pipeline-alerts
POST   /api/copilot/pipeline-alerts/scan
PUT    /api/copilot/pipeline-alerts/{id}/resolve

# Lead Copilot
GET    /api/copilot/lead-context/{prospect_id}
POST   /api/copilot/lead-action
POST   /api/copilot/lead-action/stream
GET    /api/copilot/lead-suggestions/{prospect_id}

# Settings
GET    /api/copilot/preferences
PUT    /api/copilot/preferences
GET    /api/copilot/credits

# Chat History
GET    /api/copilot/chat-history
POST   /api/copilot/chat-history
GET    /api/copilot/chat-history/{session_id}
DELETE /api/copilot/chat-history/{session_id}

# Product Assistant
POST   /api/copilot/product-assistant
POST   /api/copilot/product-assistant/stream
```

---

Generated: March 24, 2026 | Outmate Product-4 Codebase Analysis
