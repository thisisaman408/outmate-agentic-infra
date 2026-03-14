# Co-Pilot Feature — AI-Powered Sales Intelligence

The Co-Pilot is an AI-powered sales assistant integrated into the Outmate platform. It provides daily briefs, meeting preparation, campaign optimization, and pipeline risk alerts — all driven by LLM-generated insights via OpenRouter, enriched with **real-time data** from Explorium and Tavily APIs.

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
- Context-aware AI assistant built directly into prospect profiles
- Actionable side panel on any prospect row
- **Quick Actions**: Draft personalized emails, prepare for meetings, research leads, find similar companies, and handle objections
- **Proactive Suggestions**: Intelligent prompts based on newly detected signals
- **Phase 3 Automation (Coming Soon)**: Workflow playbooks, one-click CRM exports, automated follow-ups, and cross-session conversation memory tracking

---

## Architecture

### Backend (FastAPI + PostgreSQL)

```
Backend/
├── app/
│   ├── api/routes/copilot.py           # 9 REST endpoints
│   ├── db/models/
│   │   ├── copilot_brief.py            # Daily brief model
│   │   ├── copilot_meeting_prep.py     # Meeting prep model
│   │   ├── copilot_campaign_analysis.py # Campaign analysis model
│   │   ├── copilot_pipeline_alert.py   # Pipeline alert model
│   │   └── copilot_preferences.py      # User preferences model
│   ├── schemas/copilot.py              # Pydantic request/response schemas
│   ├── services/copilot/
│   │   ├── copilot_service.py          # Main orchestrator
│   │   ├── lead_copilot_service.py     # Lead action orchestrator (New)
│   │   ├── lead_enrichment.py          # Multi-source lead enrichment (New)
│   │   ├── enrichment.py               # Real-time data enrichment (Explorium + Tavily)
│   │   ├── daily_brief_service.py      # Daily brief generation
│   │   ├── meeting_prep_service.py     # Meeting prep research
│   │   ├── campaign_optimizer_service.py # Campaign scoring
│   │   ├── pipeline_risk_service.py    # Pipeline risk analysis
│   │   ├── notification_service.py     # Email (SMTP) + Slack delivery
│   │   └── prompts.py                  # LLM prompt templates
│   └── tasks/copilot_tasks.py          # Celery Beat scheduled tasks
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
│   ├── lead-copilot-panel.tsx          # Contact-activated side panel (New)
│   └── copilot-command-input.tsx       # AI natural language command input (New)
├── hooks/
│   ├── use-copilot.ts                  # React hooks (useDailyBrief, usePipelineAlerts)
│   └── use-copilot-panel.ts            # State management for Lead Copilot Profile (New)
└── lib/api/copilot.ts                  # API client for all copilot endpoints
```

---

## API Endpoints

All endpoints require authentication (`Authorization: Bearer <token>`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/copilot/daily-brief` | Get today's brief (or latest cached) |
| `POST` | `/api/copilot/daily-brief/generate` | Force-generate a new brief |
| `POST` | `/api/copilot/meeting-prep` | Generate meeting prep for a company |
| `GET` | `/api/copilot/meeting-prep/history` | List past meeting preps |
| `POST` | `/api/copilot/campaign-optimizer` | Analyze and score an email campaign |
| `GET` | `/api/copilot/pipeline-alerts` | List active pipeline alerts |
| `POST` | `/api/copilot/pipeline-alerts/scan` | Scan deals for pipeline risks |
| `PUT` | `/api/copilot/pipeline-alerts/{alert_id}/resolve` | Mark an alert as resolved |
| `GET` | `/api/copilot/preferences` | Get user's copilot preferences |
| `PUT` | `/api/copilot/preferences` | Update preferences |
| `GET` | `/api/copilot/lead-context/{prospect_id}` | Aggregate known DB/enrichment data for prospect panel |
| `POST` | `/api/copilot/lead-action` | Execute AI command on prospect profile |
| `GET` | `/api/copilot/lead-suggestions/{prospect_id}` | Generate proactive AI suggestions for prospect |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `copilot_briefs` | Stores generated daily briefs per user |
| `copilot_meeting_preps` | Meeting prep results with company data |
| `copilot_campaign_analyses` | Campaign optimization scores and suggestions |
| `copilot_pipeline_alerts` | Pipeline risk alerts with severity levels |
| `copilot_user_preferences` | Per-user notification and feature preferences |

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
Every enrichment call is wrapped in `try/except`. If any API is unavailable, the service falls back to the same LLM-only behavior as before — no errors are surfaced to the user.
