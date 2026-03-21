# Co-Pilot Feature — AI-Powered Sales Intelligence

The Co-Pilot is an AI-powered sales intelligence suite integrated into the Outmate platform. It provides daily briefs, meeting preparation, campaign optimization, pipeline risk alerts, a 14-action lead intelligence panel, and a RAG-powered global product chatbot — all driven by LLM-generated insights via OpenRouter, enriched with **real-time data** from Explorium, Tavily, and Serper APIs.

---

## Features

### 1. Daily Brief
- Auto-generated daily summary of your sales pipeline
- Priority actions ranked by urgency
- New signals detected (funding, hiring, tech changes)
- Key metrics: leads, open rates, active campaigns
- Available as a dashboard widget and in the copilot sidebar
- **Enriched with**: real pipeline alerts from DB, campaign data, trending B2B news (Tavily)

### 2. Meeting Prep
- Enter a company name and meeting date
- Returns company snapshot, prospect profile, talking points, discovery questions
- Identifies relevant signals, risk factors, and competitor mentions
- Stores history for future reference
- **Enriched with**: real company data from Explorium (firmographics, funding, tech stack, headcount), recent news (Tavily), prospect background (Tavily web search)

### 3. Campaign Optimizer
- Paste your email subject line and body
- Gets scored across 6 categories: subject line, personalization, value proposition, CTA, tone/length, spam risk
- Returns specific weaknesses, improvements, suggested subjects, and predicted lift
- **Enriched with**: real industry news for the target audience (Tavily)

### 4. Pipeline Alerts
- Submit deals (company, stage, last activity, value) for risk scanning
- Returns health score, risk summary, and at-risk deals with recommended actions
- Alerts categorized by severity (red/yellow/green)
- **Enriched with**: real company data for at-risk deals from Explorium (funding, hiring signals, tech stack)

### 5. Settings & Preferences
- Toggle daily brief generation on/off
- Configure email and Slack notifications
- Set pipeline alert severity threshold
- Customize brief delivery time and timezone

### 6. Lead Copilot Panel
Context-aware AI assistant built directly into prospect and company profiles. Opens as a right-side Sheet panel when clicking a lead row.

#### Profile Intelligence
- **ProfileHeader** with avatar initials, contact details (email, phone, LinkedIn), seniority badge, location
- **CompanyCard** with firmographics: industry, employee count, revenue, funding stage, growth %, tech stack, HQ
- **AI Suggestions** — proactive recommendations generated per-prospect (e.g. "This lead showed high intent — draft an email")

#### 14 GTM Quick Actions

| Action | Type | Credits | Description |
|--------|------|---------|-------------|
| Draft Email | `draft_email` | 1 | Annotated personalized email with enrichment source tags (PERSONALIZATION, RELEVANCE, TIMING, VALUE_PROP, CTA) |
| Meeting Prep | `meeting_prep` | 2 | Company snapshot, talking points, discovery questions |
| Research | `research` | 2 | Executive summary, talking points, engagement opportunities, recommended approach |
| Find Similar | `find_similar` | 1 | AI-powered lookalike company discovery |
| Objection Handler | `objection_handler` | 1 | Multiple rebuttal strategies with reasoning and follow-up questions |
| Crossfire Intelligence | `crossfire` | 2 | Competitive battle card (competitive edge, objections, talking points, poaching sequence) |
| Compliance Oracle | `compliance` | 1 | Regulatory and compliance analysis |
| Bombora Intent | `bombora_intent` | 2 | Intent topic scoring with progress bars and level assessment |
| Talent Radar | `talent_radar` | 2 | Hiring/talent movement intelligence |
| Virality Engine | `virality` | 1 | Viral growth opportunity analysis |
| Regime Shifter | `regime_shift` | 2 | Leadership and organizational change detection |
| Website Traffic | `website_traffic` | 1 | Signal-based website traffic intelligence |
| Business Events | `business_events` | 1 | Recent business event signals |
| LinkedIn Posts | `linkedin_posts` | 2 | LinkedIn activity analysis with signals |
| Custom | `custom` | 1 | Free-form natural language query about the prospect |

#### SSE Streaming
- All actions stream progress via Server-Sent Events (`POST /lead-action/stream`)
- Stages: `enriching` (researching lead data) → `generating` (LLM response) → `done`
- Real-time animated progress indicator in the UI

#### Specialized Result Renderers
- **AnnotatedEmailResult** — Email segments with color-coded enrichment source tags and tooltip provenance
- **BattleCard** — Collapsible sections for competitive edge, objections, talking points, poaching sequence
- **SignalCards** — Urgency-colored cards (red/amber/teal) with copy and suggested action
- **BomboraIntentResult** — Topic score bars with gradient fills
- **ResearchResult** — Executive summary + expandable talking points and engagement opportunities
- **GTMActionResult** — Markdown-rendered with show more/less toggle
- **ObjectionResult** — Multiple rebuttals with recommended highlight
- **FindSimilarResult** — Company cards with industry and size
- **MeetingPrepResult** — Snapshot + discovery questions with expandable sections

#### Smart Follow-ups
After each action completes, contextual next-step suggestions appear (e.g. after Research → "Draft Email" and "Meeting Prep").

#### Natural Language Input
`CopilotCommandInput` at the bottom of the panel accepts free-form questions about the prospect, sent as `custom` action type.

#### Enrichment Credits
- **Email Reveal**: 1 Credit (BetterContact/ContactOut waterfall)
- **Phone Reveal**: 10 Credits (BetterContact/ContactOut waterfall)

### 7. Global Copilot Chatbot
RAG-powered product assistant available from any page via a floating button (bottom-right). Answers questions about Outmate features, provides contextual navigation links, and maintains chat history — all without consuming credits.

> **Full documentation**: See [COPILOT_CHATBOT_README.md](COPILOT_CHATBOT_README.md)

---

## Architecture

### Backend (FastAPI + PostgreSQL)

```
Backend/
├── app/
│   ├── api/routes/copilot.py              # 22 REST endpoints
│   ├── db/models/
│   │   ├── copilot_brief.py               # Daily brief model
│   │   ├── copilot_meeting_prep.py        # Meeting prep model
│   │   ├── copilot_campaign_analysis.py   # Campaign analysis model
│   │   ├── copilot_pipeline_alert.py      # Pipeline alert model
│   │   ├── copilot_preferences.py         # User preferences model
│   │   ├── copilot_chat_session.py        # Chat session model (JSONB messages)
│   │   └── product_knowledge.py           # Knowledge chunks (pgvector + tsvector)
│   ├── schemas/copilot.py                 # Pydantic request/response schemas
│   ├── services/copilot/
│   │   ├── copilot_service.py             # Main orchestrator
│   │   ├── lead_copilot_service.py        # Lead action orchestrator + SSE streaming
│   │   ├── lead_enrichment.py             # Multi-source lead enrichment
│   │   ├── product_assistant_service.py   # RAG pipeline + feature registry + link validation
│   │   ├── knowledge_service.py           # Hybrid search (pgvector + tsvector), indexing
│   │   ├── enrichment.py                  # Real-time data enrichment (Explorium + Tavily)
│   │   ├── daily_brief_service.py         # Daily brief generation
│   │   ├── meeting_prep_service.py        # Meeting prep research
│   │   ├── campaign_optimizer_service.py  # Campaign scoring
│   │   ├── pipeline_risk_service.py       # Pipeline risk analysis
│   │   ├── notification_service.py        # Email (SMTP) + Slack delivery
│   │   └── prompts.py                     # LLM prompt templates
│   └── tasks/copilot_tasks.py             # Celery Beat scheduled tasks
├── scripts/
│   └── index_product_docs.py              # Knowledge base indexing script
├── alembic/versions/
│   └── a1b2c3d4e5f6_add_copilot_tables.py  # DB migration
```

### Frontend (Next.js 14 + TypeScript)

```
Frontend/
├── app/(dashboard)/copilot/
│   ├── page.tsx                        # Main copilot page (4 tabs)
│   ├── layout.tsx                      # Section layout
│   ├── daily-brief/page.tsx            # Daily brief tab
│   ├── meeting-prep/page.tsx           # Meeting prep tab
│   ├── campaign-optimizer/page.tsx     # Campaign optimizer tab
│   ├── pipeline-alerts/page.tsx        # Pipeline alerts tab
│   └── settings/page.tsx              # Preferences UI
├── components/copilot/
│   ├── copilot-sidebar.tsx             # Global floating sidebar panel
│   ├── daily-brief-widget.tsx          # Dashboard widget card
│   ├── lead-copilot-panel.tsx          # Lead AI panel (14 actions, streaming, markdown)
│   ├── global-copilot-panel.tsx        # Global chatbot panel (RAG, history, suggestions)
│   └── copilot-command-input.tsx       # AI natural language command input
├── hooks/
│   ├── use-copilot.ts                  # React hooks (useDailyBrief, usePipelineAlerts)
│   ├── use-copilot-panel.ts            # State management for Lead Copilot Panel
│   └── use-chatbot.ts                  # SSE streaming + chat session persistence
├── lib/api/copilot.ts                  # API client for all copilot endpoints
└── feature-registry.json               # 19 platform routes (used by backend + frontend)
```

---

## API Endpoints

All endpoints require authentication (`Authorization: Bearer <token>`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Daily Brief** | | |
| `GET` | `/api/copilot/daily-brief` | Get today's brief (or latest cached) |
| `POST` | `/api/copilot/daily-brief/generate` | Force-generate a new brief |
| **Meeting Prep** | | |
| `POST` | `/api/copilot/meeting-prep` | Generate meeting prep for a company |
| `GET` | `/api/copilot/meeting-prep/history` | List past meeting preps |
| **Campaign & Email** | | |
| `POST` | `/api/copilot/campaign-optimizer` | Analyze and score an email campaign |
| `POST` | `/api/copilot/email-optimizer` | Rewrite email with lead-specific enrichment |
| **Pipeline Alerts** | | |
| `GET` | `/api/copilot/pipeline-alerts` | List active pipeline alerts |
| `POST` | `/api/copilot/pipeline-alerts/scan` | Scan deals for pipeline risks |
| `PUT` | `/api/copilot/pipeline-alerts/{alert_id}/resolve` | Mark an alert as resolved |
| **Preferences & Credits** | | |
| `GET` | `/api/copilot/preferences` | Get user's copilot preferences |
| `PUT` | `/api/copilot/preferences` | Update preferences |
| `GET` | `/api/copilot/credits` | Get user's credit balance |
| **Lead Copilot** | | |
| `GET` | `/api/copilot/lead-context/{prospect_id}` | Aggregate known DB/enrichment data for prospect panel |
| `POST` | `/api/copilot/lead-action` | Execute AI command on prospect (JSON response) |
| `POST` | `/api/copilot/lead-action/stream` | Execute AI command on prospect (SSE streaming) |
| `GET` | `/api/copilot/lead-suggestions/{prospect_id}` | Generate proactive AI suggestions for prospect |
| **Global Chatbot** | | |
| `POST` | `/api/copilot/product-assistant` | Ask a product question (JSON response) |
| `POST` | `/api/copilot/product-assistant/stream` | Ask a product question (SSE streaming) |
| `GET` | `/api/copilot/chat-history` | List all chat sessions |
| `GET` | `/api/copilot/chat-history/{session_id}` | Get a chat session with messages |
| `POST` | `/api/copilot/chat-history` | Create or update a chat session |
| `DELETE` | `/api/copilot/chat-history/{session_id}` | Delete a chat session |
| **Enrichment** | | |
| `POST` | `/api/bettercontact/enrich-prospect` | Waterfall enrichment for email/phone (1-10 credits) |
| `POST` | `/api/contactout/reveal-contact` | Reveal verified contact info (Email: 1, Phone: 10 credits) |
| `POST` | `/api/enrichment/company` | Enrich company info (Waterfall) |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `copilot_briefs` | Stores generated daily briefs per user |
| `copilot_meeting_preps` | Meeting prep results with company data |
| `copilot_campaign_analyses` | Campaign optimization scores and suggestions |
| `copilot_pipeline_alerts` | Pipeline risk alerts with severity levels |
| `copilot_user_preferences` | Per-user notification and feature preferences |
| `copilot_chat_sessions` | Chatbot conversation sessions (user_id, title, messages JSONB) |
| `copilot_knowledge_chunks` | Indexed documentation chunks (pgvector embeddings + tsvector) |

---

## Configuration

### Environment Variables (Backend `.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `MOCK_LLM` | Use mock responses instead of real LLM calls | `true` |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM access | — |
| `EXPLORIUM_API_KEY` | Explorium API key for company enrichment (firmographics, funding, tech stack) | — |
| `TAVILY_API_KEY` | Tavily API key for real-time web/news search | — |
| `SERPER_API_KEY` | Serper API key for Google search (used by AI agents) | — |
| `SMTP_HOST` | SMTP server for email notifications | `None` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username / sender email | `None` |
| `SMTP_PASSWORD` | SMTP password | `None` |
| `SMTP_FROM_EMAIL` | From address for outgoing emails | Falls back to `SMTP_USER` |
| `BETTERCONTACT_API_KEY` | API key for BetterContact waterfall enrichment | — |
| `CONTACTOUT_API_KEY` | API key for ContactOut email/phone enrichment | — |

> **Note**: Explorium and Tavily keys are optional. If missing or if API calls fail, the copilot gracefully falls back to LLM-only generation (without real-time data enrichment).

---

## Running Locally

### Backend
```bash
cd Backend
pip install -r requirements.txt    # or: uv pip install --system -r requirements.txt
alembic upgrade head               # run DB migration
uvicorn app.main:app --reload      # starts on http://127.0.0.1:8000
```

### Frontend
```bash
cd Frontend
npm install
npm run dev                        # starts on http://localhost:3000
```

### Testing the API
```bash
# Register and login
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123","name":"Tester"}'

curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Use the returned token
curl http://127.0.0.1:8000/api/copilot/daily-brief \
  -H "Authorization: Bearer <TOKEN>"
```

Navigate to `http://localhost:3000/copilot` in the browser to use the full UI.

---

## Scheduled Tasks (Celery)

| Task | Schedule | Description |
|------|----------|-------------|
| `generate_daily_briefs` | Daily at 08:00 UTC | Auto-generates briefs for opted-in users |
| `scan_pipeline_risks` | Every 6 hours | Scans pipelines and creates alerts |

Requires Redis and Celery worker/beat running:
```bash
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL (Supabase), Alembic, Celery + Redis
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **AI**: OpenRouter (LLM gateway), structured JSON output parsing
- **Data Enrichment**: Explorium (company firmographics, funding, tech stack), Tavily (real-time news/web search)

---

## Data Enrichment Architecture

All copilot features follow a **"Enrich First, LLM Second"** pattern:

```
1. Try Explorium/Tavily APIs → fetch real company/news data
2. If APIs succeed → inject verified data into LLM prompt → grounded results
3. If APIs fail (timeout, rate limit, key missing) → fall back to LLM-only generation
```

### Enrichment Module (`enrichment.py`)

| Function | Data Source | Used By |
|----------|-----------|---------|
| `enrich_company()` | Explorium (search + full enrichment) | Meeting Prep, Pipeline Alerts |
| `fetch_recent_news()` | Tavily web search | Meeting Prep, Daily Brief, Campaign Optimizer |
| `fetch_prospect_info()` | Tavily web search | Meeting Prep |
| `format_company_context()` | Formatter | All services |
| `format_news_context()` | Formatter | All services |
| `format_prospect_context()` | Formatter | Meeting Prep |

### What data is enriched per feature

| Feature | Explorium | Tavily | DB Data |
|---------|-----------|--------|---------|
| **Meeting Prep** | Company firmographics, funding, tech stack, headcount | Company news, prospect background | — |
| **Daily Brief** | — | Trending B2B news | Pipeline alerts, campaigns |
| **Pipeline Alerts** | At-risk company data (top 3) | — | Deal data from request |
| **Campaign Optimizer** | — | Target audience industry news | — |

### Fallback Behavior
Every enrichment call is wrapped in `try/except`. If any API is unavailable, the service falls back to the same LLM-only behavior as before. 

### Credit Policy
- **New Users**: Receive **100 free credits** upon signup (configured in `User` model).
- **Enrichment**:
    - **Email Reveal**: 1 Credit (BetterContact/ContactOut waterfall)
    - **Phone Reveal**: 10 Credits (BetterContact/ContactOut waterfall)
- **AI Actions**:
    - **Daily Brief**: 1 Credit (charged once per day; subsequent views are cached)
    - **Meeting Prep**: 2 Credits
    - **Campaign/Email Optimization**: 1-2 Credits (2 with enrichment)
    - **Pipeline Scan**: 2 Credits
    - **Lead Panel Actions**: 1-2 Credits per action (see Lead Copilot Panel section for full breakdown)
    - **Global Chatbot**: Free (no credits charged)
