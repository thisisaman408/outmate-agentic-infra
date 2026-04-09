# Outmate Feature Implementations Overview

Complete codebase mapping of 4 core features: Enrichment, Signals, Watcher, and Copilot.

---

## 1. ENRICHMENT FEATURE

### Overview
Real-time data enrichment for companies and prospects using BetterContact and ContactOut waterfalls.

### API Routes
**File:** [Backend/app/api/routes/enrichment_routes.py](Backend/app/api/routes/enrichment_routes.py)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/company` | POST | Enrich company with email/phone using BetterContact waterfall |

#### Request/Response Examples
```python
# Request
POST /company
{
  "company_id": "comp-123",
  "company_name": "Stripe",
  "company_domain": "stripe.com",
  "field": "email"  # or "phone"
}

# Response (Success)
{
  "email": "contact@stripe.com",
  "status": "success"
}

# Response (Not Found)
{
  "error": "email not found",
  "status": "not_found"
}
```

### Database Models
Currently uses in-memory service calls; no dedicated enrichment model (processes via BetterContact/ContactOut services).

### Service Layer Implementations
**Directory:** [Backend/app/services/](Backend/app/services/)

| Service | Purpose |
|---------|---------|
| `bettercontact_service.py` | BetterContact email/phone enrichment API wrapper |
| `contactout_service.py` | ContactOut email/phone enrichment API wrapper |
| `copilot/enrichment.py` | Real-time enrichment for Copilot (fetches company data from Explorium, news from Tavily) |
| `copilot/lead_enrichment.py` | Lead-specific enrichment for copilot lead panel (LinkedIn posts, company data, etc.) |

#### Key Enrichment Functions
```python
# From copilot/enrichment.py
async def enrich_company(company_name, company_domain) -> Dict[str, Any]:
    """Fetch real company data from Explorium."""
    
async def fetch_recent_news(company_name, max_results) -> List[Dict]:
    """Search for recent news using Tavily."""
    
async def fetch_prospect_info(prospect_name, company_name) -> List[Dict]:
    """Fetch public prospect information."""
```

### Current Functionality
- **Email Enrichment**: 1 credit per successful reveal (BetterContact → ContactOut waterfall)
- **Phone Enrichment**: 10 credits per successful reveal (BetterContact → ContactOut waterfall)
- **Company Enrichment**: Real-time data fetch from Explorium (includes funding, tech stack, employees, revenue)
- **News Enrichment**: Web search via Tavily for recent company mentions
- **Prospect Enrichment**: LinkedIn posts, job history, company background

### Celery Tasks
None currently (enrichment is synchronous HTTP-based).

---

## 2. SIGNALS FEATURE

### Overview
Real-time event monitoring and alert system for companies and prospects. Detects funding, hiring, technology adoption, news mentions, etc.

### API Routes
**File:** [Backend/app/api/routes/signals.py](Backend/app/api/routes/signals.py)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | List all signals (paginated) |
| `/` | POST | Create a new signal |
| `/preview` | POST | Preview signal matches without saving |
| `/{signal_id}/run` | POST | Manually run a signal |
| `/{signal_id}/results` | GET | Get latest results for a signal (max 100) |
| `/detect` | POST | Detect relevant signals for companies/prospects |

#### Request/Response Examples
```python
# Create Signal Request
POST /signals
{
  "name": "Series B Funding Alert",
  "type": "business_event",  # "business_event", "prospect_signal", "intent_signal", etc.
  "category": "funding",
  "configuration": {
    "event_types": ["new_funding_round", "ipo_announcement"],
    "funding_range": [5000000, 100000000],
    "industry_filters": ["SaaS", "B2B"]
  },
  "status": "active"
}

# Response
{
  "_id": "signal-a1b2c3d4",
  "name": "Series B Funding Alert",
  "type": "business_event",
  "status": "active",
  "created_at": "2026-03-24T10:00:00Z",
  "last_run_at": null,
  "results_count": 0
}

# Get Results
GET /signals/{signal_id}/results
[
  {
    "_id": "result-x1y2z3",
    "signal_id": "signal-a1b2c3d4",
    "title": "TechCorp raises Series B",
    "description": "Series B funding detected",
    "source_url": "https://news.google.com/rss/...",
    "found_at": "2026-03-24T12:30:00Z"
  }
]
```

### Database Models
**File:** [Backend/app/db/models/](Backend/app/db/models/)

#### In-Memory Storage (Current Implementation)
```python
# From signals.py
SIGNAL_STORE: List[Dict[str, Any]] = []  # List of signal definitions
SIGNAL_RESULTS_STORE: Dict[str, List[Dict[str, Any]]] = {}  # signal_id -> results
```

**Note:** Signals are currently stored in memory; no persistent DB model (will be lost on restart).

### Service Layer Implementations

| Service | Purpose |
|---------|---------|
| `signal_detection_service.py` | Core signal detection logic (Crustdata + Explorium APIs) |
| `signal_fetcher_service.py` | Background signal fetcher (runs signals on schedule) |
| `explorium_service.py` | Explorium API wrapper (business events, company search) |

#### Signal Detection Logic
```python
# From signal_detection_service.py
async def detect_signals(
    companies: List[Dict],
    prospect_query: str = "",
    data_source: str = "explorium",  # "explorium" for companies, "crustdata" for prospects
    action: str = ""
) -> List[Dict[str, Any]]:
    """
    Detect signals using Crustdata/Explorium APIs.
    
    For Prospects (crustdata):
    - LinkedIn posts by person
    - Recent job changes
    - Skill updates
    
    For Companies (explorium):
    - Business challenges
    - Funding rounds
    - LinkedIn activity
    - Tech adoption
    """
```

### Signal Types
| Type | Source | Events Detected |
|------|--------|-----------------|
| `business_event` | Explorium | `ipo_announcement`, `new_funding_round`, `new_investment`, `merger_and_acquisitions`, `cost_cutting`, `team_expansion`, `team_reduction`, `product_launch`, `acquisition` |
| `prospect_signal` | Crustdata | `prospect_changed_role`, `prospect_changed_company`, `prospect_job_start_anniversary` |
| `intent_signal` | Bombora | Intent data (real-time B2B intent) |
| `websight_signal` | Clearbit/Integrations | Website visitor data |

### Celery Tasks
None currently (signals use asyncio background tasks).

### Current Functionality
- **Real-time Detection**: Monitors for 50+ event types across Explorium, Crustdata
- **Manual Triggers**: `/run` endpoint to manually execute a signal
- **Result Pagination**: Latest 100 results per signal
- **Custom Filters**: Support for industry, company size, location, funding range, tech stack
- **No Credits**: Signals don't consume credits (monitoring only)

---

## 3. WATCHER FEATURE

### Overview
Personal monitoring system for **events**, **accounts**, and **leads**. Watchers track meaningful changes and notify users of matches.

### API Routes
**File:** [Backend/app/api/routes/watchers.py](Backend/app/api/routes/watchers.py)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | List all watchers (filtered by type) |
| `/{id}` | GET | Get single watcher with recent updates |
| `/event` | POST | Create event-based watcher (criteria-driven) |
| `/account` | POST | Create account watcher (monitor specific business) |
| `/lead` | POST | Create lead watcher (monitor specific prospect) |
| `/{id}/toggle` | POST | Pause/activate a watcher |
| `/{id}/delete` | DELETE | Delete a watcher |
| `/{id}/sync` | POST | Force sync/refresh watcher (fetch latest updates) |

#### Request/Response Examples
```python
# Create Event Watcher
POST /watchers/event
{
  "name": "Series A Startups in AI",
  "description": "Monitor startups raising Series A in AI space",
  "type": "event",
  "criteria": {
    "event_type": ["new_funding_round"],
    "funding_stage": ["Series A"],
    "technology_category": ["Artificial Intelligence"],
    "company_size": ["10-50"],
    "job_level": ["C-level"],
    "department": ["Engineering", "Product"]
  },
  "triggers": ["new_funding_round"],
  "notificationSettings": {
    "email": true,
    "slack": false,
    "webhook": "https://..."
  }
}

# Create Account Watcher
POST /watchers/account
{
  "name": "Monitor Stripe growth",
  "accountName": "Stripe",
  "accountDomain": "stripe.com",
  "triggers": [
    "Funding Events",
    "Job Changes",
    "Technology Changes",
    "News Mentions",
    "Web Traffic Changes"
  ],
  "notificationSettings": {
    "email": true,
    "slack": false
  }
}

# Create Lead Watcher
POST /watchers/lead
{
  "name": "Track Patrick",
  "leadName": "Patrick Collison",
  "leadTitle": "CEO",
  "leadCompany": "Stripe",
  "leadEmail": "patrick@stripe.com",
  "triggers": [
    "job_change",
    "content_published",
    "speaking_engagement",
    "promotion"
  ]
}

# Sync Watcher (Fetch Latest Updates)
POST /watchers/{id}/sync
# Returns:
{
  "id": "w-a1b2c3d4",
  "recentUpdates": [
    {
      "id": "update-123",
      "type": "new_funding_round",
      "description": "Stripe raises $500M Series D at $95B valuation",
      "date": "2026-03-24T10:00:00Z"
    }
  ],
  "matchCount": 5,
  "status": "active"
}
```

### Database Models
**File:** [Backend/app/db/models/watcher.py](Backend/app/db/models/watcher.py)

```python
class Watcher(Base):
    __tablename__ = "watchers"
    
    id: String(64) = "w-{uuid}"
    name: String(255)
    description: String(1024)
    type: String(32)  # "event", "account", "lead"
    status: String(32)  # "active", "paused"
    
    # Event Watcher
    criteria: JSON  # event filters
    
    # Account Watcher
    account_name: String(255)
    account_domain: String(255)
    
    # Lead Watcher
    lead_name: String(255)
    lead_title: String(255)
    lead_company: String(255)
    lead_email: String(255)
    
    # Common Fields
    prospect_id: String(64)  # cached after first match
    business_id: String(64)  # cached after first match
    triggers: JSON  # list of trigger strings
    
    # Results
    recent_updates: JSON  # list of match objects
    matches: JSON  # full match details
    match_count: String(16)  # "0", "1", etc.
    
    notification_settings: JSON  # email, slack, webhook config
    
    created_at: DateTime
    updated_at: DateTime
    last_synced_at: DateTime
```

### Service Layer Implementations

| Service | Purpose |
|---------|---------|
| `explorium_service.py` | Core data source for watcher syncing |

#### Watcher Sync Logic (from watchers.py)
```python
@router.post("/{id}/sync")
async def sync_watcher(id: str, db: Session):
    """
    Sync workflow (for all watcher types):
    
    1. Event Watcher:
       - Run Explorium search with event criteria
       - Return matching companies + events
    
    2. Account Watcher:
       - Enroll account in Explorium event monitoring
       - Fetch business signal events
       - Return recent activity
    
    3. Lead Watcher:
       - Fetch prospect enrichment from Explorium/BetterContact
       - Map trigger types to Explorium events
       - Fetch prospect personality/job events
       - Return recent updates
    """
```

### Watcher Trigger Mappings
```python
# Account Triggers -> Explorium Events
ACCOUNT_TRIGGER_MAP = {
    "Funding Events": ["new_funding_round", "new_investment"],
    "Job Changes": ["team_expansion", "team_reduction"],
    "Technology Changes": ["product_launch"],
    "News Mentions": ["merger_and_acquisitions", "ipo_announcement", "acquisition"],
    "Website Content Changes": [],  # via enrichment
}

# Lead Triggers -> Prospect Events
LEAD_TRIGGER_MAP = {
    "job_change": ["prospect_changed_role", "prospect_changed_company"],
    "promotion": ["prospect_changed_role"],
    "content_published": ["prospect_linkedin_post"],
    "speaking_engagement": ["prospect_event_appearance"],
}
```

### Celery Tasks
None currently (sync is on-demand HTTP).

### Current Functionality
- **3 Watch Types**: Event (criteria-driven), Account (specific business), Lead (specific person)
- **Trigger Mapping**: Frontend trigger names → Explorium event types
- **On-Demand Sync**: `/sync` endpoint triggers real-time data fetch
- **Notifications**: Email/Slack/Webhook support (configured per watcher)
- **Match Caching**: Recent updates stored in DB (persists across restarts)
- **No Credits**: Watching is free (notifications trigger based on setup)

---

## 4. COPILOT FEATURE

### Overview
AI-powered sales intelligence suite with 5 sub-features:
1. **Daily Brief** - Daily intelligence digest
2. **Meeting Prep** - Pre-call research brief
3. **Campaign Optimizer** - Email campaign scoring
4. **Pipeline Alerts** - Deal risk detection
5. **Lead Copilot Panel** - 14 AI actions for prospect/company panels

Plus **Product Assistant** (global RAG chatbot).

### API Routes
**File:** [Backend/app/api/routes/copilot.py](Backend/app/api/routes/copilot.py)

#### Daily Brief
| Endpoint | Method | Purpose | Cost |
|----------|--------|---------|------|
| `/daily-brief` | GET | Get today's brief (auto-generate if missing) | 1 credit |
| `/daily-brief/generate` | POST | Force-regenerate today's brief | 1 credit |

#### Meeting Prep
| Endpoint | Method | Purpose | Cost |
|----------|--------|---------|------|
| `/meeting-prep` | POST | Generate pre-call brief | 2 credits |
| `/meeting-prep/history` | GET | List past meeting preps | Free |

#### Campaign/Email Optimizer
| Endpoint | Method | Purpose | Cost |
|----------|--------|---------|------|
| `/campaign-optimizer` | POST | Score email campaign | 1 credit |
| `/email-optimizer` | POST | Rewrite email with lead enrichment | 2 credits |

#### Pipeline Alerts
| Endpoint | Method | Purpose | Cost |
|----------|--------|---------|------|
| `/pipeline-alerts` | GET | List active pipeline alerts | Free |
| `/pipeline-alerts/scan` | POST | Scan pipeline for risks | 2 credits |
| `/pipeline-alerts/{alert_id}/resolve` | PUT | Mark alert as resolved | Free |

#### Lead Copilot (14 Actions)
| Action | Cost | Purpose |
|--------|------|---------|
| `draft_email` | 1 | Generate personalized email |
| `meeting_prep` | 2 | Pre-meeting research |
| `research` | 2 | Deep prospect research |
| `find_similar` | 1 | Find similar accounts |
| `objection_handler` | 1 | Generate objection rebuttals |
| `custom` | 1 | Freeform AI question |
| `crossfire` | 2 | Crossfire competitive analysis |
| `compliance` | 1 | Check compliance/regulatory |
| `bombora_intent` | 2 | B2B intent signals |
| `talent_radar` | 2 | Talent movement detection |
| `virality` | 1 | Viral content potential |
| `regime_shift` | 2 | Market shift detection |
| `website_traffic` | 1 | Website traffic analysis |
| `linkedin_posts` | 2 | LinkedIn activity analysis |

#### Lead Copilot Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/lead-context/{prospect_id}` | GET | Aggregate lead data (free) |
| `/lead-action` | POST | Execute AI action (JSON response) |
| `/lead-action/stream` | POST | Execute AI action (SSE streaming) |
| `/lead-suggestions/{prospect_id}` | GET | Proactive AI suggestions (free preview) |

#### Preferences & Chat History
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/preferences` | GET | Get copilot settings |
| `/preferences` | PUT | Update copilot settings |
| `/credits` | GET | Check credit balance |
| `/chat-history` | GET | List chat sessions |
| `/chat-history` | POST | Save chat session |
| `/chat-history/{session_id}` | GET | Get chat session |
| `/chat-history/{session_id}` | DELETE | Delete chat session |

#### Product Assistant (Global Chatbot)
| Endpoint | Method | Purpose | Cost |
|----------|--------|---------|------|
| `/product-assistant` | POST | Ask question (JSON) | 0 (free) |
| `/product-assistant/stream` | POST | Ask question (SSE) | 0 (free) |

#### Request/Response Examples
```python
# Meeting Prep Request
POST /meeting-prep
{
  "company_name": "Stripe",
  "company_domain": "stripe.com",
  "prospect_name": "Patrick Collison",
  "prospect_title": "CEO",
  "meeting_type": "discovery",
  "additional_context": "Discussing new payment rails"
}

# Meeting Prep Response
{
  "company_overview": "Stripe is a SaaS payment platform founded in 2010...",
  "prospect_profile": {
    "background": "Patrick Collison is CEO of Stripe...",
    "communication_style": "Direct, technical, data-driven"
  },
  "talking_points": ["Recent IPO plans", "Expansion to APAC"],
  "conversation_starters": ["Ask about recent funding"],
  "risk_factors": ["They may use competitors"],
  "recommended_approach": "Lead with unique value prop"
}

# Lead Action Request (Streaming)
POST /lead-action/stream
{
  "prospect_id": "lead-123",
  "action_type": "draft_email",
  "prompt": null,  # null = use defaults
  "context_overrides": {}
}

# Lead Action SSE Response
data: {"stage": "enriching", "message": "Researching lead..."}
data: {"stage": "generating", "message": "Drafting email..."}
data: {"stage": "token", "content": "Hi Patrick,"}
data: {"stage": "token", "content": "\n\nI saw your recent..."}
data: {"stage": "complete", "result": {...}, "credits_used": 1}

# Product Assistant Request
POST /product-assistant/stream
{
  "question": "How do pipeline alerts work?",
  "context": {
    "route": "/copilot/pipeline-alerts",
    "feature_hint": null
  }
}
```

### Database Models
**Directory:** [Backend/app/db/models/](Backend/app/db/models/)

| Model | Purpose |
|-------|---------|
| `copilot_brief.py` | CopilotBrief (daily brief storage) |
| `copilot_meeting_prep.py` | CopilotMeetingPrep (meeting prep history) |
| `copilot_campaign_analysis.py` | CopilotCampaignAnalysis (campaign score history) |
| `copilot_pipeline_alert.py` | CopilotPipelineAlert (active/resolved alerts) |
| `copilot_preferences.py` | CopilotUserPreferences (user settings) |
| `copilot_chat_session.py` | CopilotChatSession (chat history + JSONB messages) |
| `product_knowledge.py` | ProductKnowledgeChunk (RAG embeddings + tsvector for search) |

#### Key Model: CopilotBrief
```python
class CopilotBrief(Base):
    __tablename__ = "copilot_briefs"
    
    id: UUID = uuid4()
    user_id: UUID
    brief_date: Date
    brief_type: String(50) = "daily"
    content: JSONB = {
        "executive_summary": "...",
        "highlights": [...],
        "deals_at_risk": [...],
        "action_items": [...]
    }
    status: String(20) = "generated"
    created_at: DateTime
    
    __table_args__ = (
        UniqueConstraint("user_id", "brief_date", "brief_type"),
    )
```

#### Key Model: CopilotChatSession
```python
class CopilotChatSession(Base):
    __tablename__ = "copilot_chat_sessions"
    
    id: UUID = uuid4()
    user_id: String(255)
    title: String(255) = "New Conversation"
    messages: JSONB = [
        {
            "role": "user",
            "content": "How do signals work?",
            "timestamp": "2026-03-24T10:00:00Z"
        },
        {
            "role": "assistant",
            "content": "Signals are real-time event monitors...",
            "timestamp": "2026-03-24T10:00:05Z"
        }
    ]
    created_at: DateTime
    updated_at: DateTime
```

### Service Layer Implementations
**Directory:** [Backend/app/services/copilot/](Backend/app/services/copilot/)

| Service | Purpose |
|---------|---------|
| `copilot_service.py` | Orchestrator (composes sub-services) |
| `daily_brief_service.py` | Daily brief generation + caching |
| `meeting_prep_service.py` | Meeting prep research generation |
| `campaign_optimizer_service.py` | Email/campaign scoring + rewrite |
| `pipeline_risk_service.py` | Deal risk detection + alerts |
| `lead_copilot_service.py` | Lead panel AI actions (14 actions) |
| `lead_enrichment.py` | Lead data aggregation (DB + APIs) |
| `product_assistant_service.py` | RAG pipeline for global chatbot |
| `knowledge_service.py` | Knowledge base indexing + hybrid search (pgvector + tsvector) |
| `prompts.py` | LLM prompt templates (all actions) |
| `notification_service.py` | Email/Slack delivery |

#### Core Orchestrator
```python
# From copilot_service.py
class CopilotService:
    def __init__(self, db: Session):
        self.db = db
        self.daily_brief = DailyBriefService(db)
        self.meeting_prep = MeetingPrepService(db)
        self.campaign_optimizer = CampaignOptimizerService(db)
        self.pipeline_risk = PipelineRiskService(db)
```

#### Lead Copilot Service
```python
# From lead_copilot_service.py
class LeadCopilotService:
    def get_lead_context(prospect_id: str) -> Dict[str, Any]:
        """
        Aggregate all known data for prospect:
        - DB record (title, company, email, phone)
        - Company enrichment from Explorium
        - LinkedIn data from Crustdata
        - Recent signals/events
        - Website traffic (if available)
        """
    
    async def execute_action(
        user_id: str,
        prospect_id: str,
        action_type: str,  # 14 types
        prompt: str,
        context_overrides: Dict
    ) -> Dict[str, Any]:
        """Execute one of 14 AI actions with prospect context."""
    
    async def execute_action_stream(
        user_id: str,
        prospect_id: str,
        action_type: str,
        prompt: str,
        context_overrides: Dict
    ) -> AsyncGenerator[Dict, None]:
        """Stream output of AI action (SSE)."""
```

### Data Enrichment Architecture
**File:** [Backend/app/services/copilot/enrichment.py](Backend/app/services/copilot/enrichment.py)

```python
# Enrichment pipeline for copilot services

async def enrich_company(company_name: str) -> Dict:
    """Fetch from Explorium (funding, tech stack, employees, etc.)"""

async def fetch_recent_news(company_name: str) -> List[Dict]:
    """Search web via Tavily"""

async def fetch_prospect_info(prospect_name: str, company_name: str) -> List[Dict]:
    """Fetch prospect background via Tavily"""

def format_company_context(data: Dict) -> str:
    """Convert raw data to LLM-ready prompt block"""

def format_news_context(articles: List[Dict]) -> str:
    """Convert news to prompt block"""
```

### LLM Integration
**Integration:** OpenRouter API (via `openrouter_service.py`)

```python
# From openrouter_service.py
OpenRouterService().chat_completion(
    model="anthropic/claude-3-opus",  # Configured in env
    system_prompt=PROMPT_TEMPLATE,
    messages=[
        {"role": "user", "content": "..."}
    ],
    max_tokens=2000,
    temperature=0.7
)
```

### Celery Tasks
**Status:** No scheduled Celery tasks yet.

**Planned (but not implemented):**
- Daily brief auto-generation at user's preferred time
- Pipeline scan on schedule (e.g., 8am daily)
- Email notifications for alerts

### Current Functionality
- **Real-time AI Actions**: 14 lead copilot actions (streaming + JSON)
- **Credit System**: Usage-based billing (1-2 credits per action)
- **Enrichment Pipeline**: Explorium + Tavily + Crustdata data injection
- **RAG Chatbot**: Product assistant with knowledge base + feature registry
- **Session Persistence**: Chat history stored in JSONB
- **Streaming Support**: SSE for real-time token output
- **Context Awareness**: Route/page context for product assistant

---

## COMPARISON TABLE: All Features

| Aspect | Enrichment | Signals | Watcher | Copilot |
|--------|-----------|---------|---------|---------|
| **Primary Use** | Add data fields | Real-time monitoring events | Personal tracking | AI intelligence |
| **Trigger** | On-demand | On-demand or scheduled | On-demand sync | On-demand (user action) |
| **Data Source** | BetterContact, ContactOut | Explorium, Crustdata | Explorium, Crustdata | Explorium, Crustdata, Tavily, OpenRouter |
| **Persistence** | No (stateless) | In-memory (lost on restart) | PostgreSQL | PostgreSQL |
| **Credits** | 1-10 per action | Free | Free | 0-2 per action |
| **Notifications** | None | Not yet | Email/Slack/Webhook | Email/Slack |
| **API Methods** | REST (JSON) | REST (JSON) | REST (JSON) | REST (JSON) + SSE |

---

## TECHNICAL ARCHITECTURE SUMMARY

### Backend Stack
- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy + SQLModel
- **Database**: PostgreSQL (JSONB, pgvector for embeddings)
- **Async**: Python asyncio (for HTTP calls, streaming)
- **LLM**: OpenRouter API (Claude 3 Opus)
- **External APIs**: Explorium, Crustdata, Tavily, BetterContact, ContactOut, Clearbit, Bombora

### Frontend Stack
- **Framework**: Next.js 14 (TypeScript)
- **UI**: React components (Shadcn UI)
- **Real-time**: SSE (Server-Sent Events) for streaming responses
- **State**: React hooks (useState, useEffect)

### Key Flow Diagrams

#### Watcher Sync Flow
```
User clicks "Sync" 
  ↓
sync_watcher(id)
  ↓
Determine watcher type → [event | account | lead]
  ↓
Event: Explorium search with criteria
Account: Match domain → Explorium business events
Lead: Match prospect ID → Enrichment + prospect events
  ↓
Collect updates (max 100 recent)
  ↓
Store in DB (recent_updates, matches fields)
  ↓
Send notifications (email/slack/webhook)
  ↓
Return to frontend
```

#### Copilot Lead Action Flow
```
User selects action (e.g., "Draft Email") + clicks "Generate"
  ↓
_check_credits(user, cost=1)
  ↓
LeadCopilotService.execute_action_stream()
  ↓
Emit "enriching" event
  ↓
Fetch from DB + Explorium + Crustdata
  ↓
Emit "generating" event
  ↓
Call OpenRouter with enriched context
  ↓
Stream tokens: emit "token" event for each chunk
  ↓
Emit "complete" event + deduct_credits(user, cost)
```

---

## KEY FILES REFERENCE

### Backend Core
- [Backend/app/api/routes/enrichment_routes.py](Backend/app/api/routes/enrichment_routes.py) — Enrichment API
- [Backend/app/api/routes/signals.py](Backend/app/api/routes/signals.py) — Signals API
- [Backend/app/api/routes/watchers.py](Backend/app/api/routes/watchers.py) — Watchers API
- [Backend/app/api/routes/copilot.py](Backend/app/api/routes/copilot.py) — Copilot API (22 endpoints)

### Backend Services
- [Backend/app/services/signal_detection_service.py](Backend/app/services/signal_detection_service.py) — Signal logic
- [Backend/app/services/copilot/](Backend/app/services/copilot/) — Copilot service suite
  - `copilot_service.py` — Orchestrator
  - `lead_copilot_service.py` — Lead actions
  - `daily_brief_service.py` — Daily brief
  - `meeting_prep_service.py` — Meeting prep
  - `product_assistant_service.py` — Chatbot RAG
  - `enrichment.py` — Data fetching
  - `prompts.py` — LLM templates

### Backend Models
- [Backend/app/db/models/watcher.py](Backend/app/db/models/watcher.py) — Watcher ORM
- [Backend/app/db/models/copilot_*.py](Backend/app/db/models/) — Copilot models

### Frontend
- [Frontend/app/(dashboard)/copilot/](Frontend/app/(dashboard)/copilot/) — Copilot pages
- [Frontend/app/(dashboard)/leads/watcher/](Frontend/app/(dashboard)/leads/watcher/) — Watcher pages
- [Frontend/components/leads/watcher/](Frontend/components/leads/watcher/) — Watcher components

---

## NEXT STEPS FOR IMPLEMENTATION

### High Priority
1. **Persistent Signal Storage**: Migrate `SIGNAL_STORE` from in-memory to PostgreSQL
2. **Scheduled Celery Tasks**: 
   - Daily brief auto-generation
   - Pipeline risk scanning on schedule
   - Email notifications

3. **UI Refinements**:
   - Add signal management dashboard
   - Watcher trigger configuration UI
   - Copilot credits usage display

### Medium Priority
1. **Webhook Support**: Implement webhook delivery for watchers
2. **Batch Operations**: Multi-select watcher admin (pause all, delete all)
3. **Audit Logging**: Track all copilot credit usage

### Low Priority
1. **Performance**: Optimize Explorium queries for large datasets
2. **Caching**: Redis caching for frequent enrichment calls
3. **Analytics**: Track most-used copilot actions, signal effectiveness

