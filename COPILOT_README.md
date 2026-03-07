# Co-Pilot Feature — AI-Powered Sales Intelligence

The Co-Pilot is an AI-powered sales assistant integrated into the Outmate platform. It provides daily briefs, meeting preparation, campaign optimization, and pipeline risk alerts — all driven by LLM-generated insights via OpenRouter.

---

## Features

### 1. Daily Brief
- Auto-generated daily summary of your sales pipeline
- Priority actions ranked by urgency
- New signals detected (funding, hiring, tech changes)
- Key metrics: leads, open rates, active campaigns
- Available as a dashboard widget and in the copilot sidebar

### 2. Meeting Prep
- Enter a company name and meeting date
- Returns company snapshot, prospect profile, talking points, discovery questions
- Identifies relevant signals, risk factors, and competitor mentions
- Stores history for future reference

### 3. Campaign Optimizer
- Paste your email subject line and body
- Gets scored across 6 categories: subject line, personalization, value proposition, CTA, tone/length, spam risk
- Returns specific weaknesses, improvements, suggested subjects, and predicted lift

### 4. Pipeline Alerts
- Submit deals (company, stage, last activity, value) for risk scanning
- Returns health score, risk summary, and at-risk deals with recommended actions
- Alerts categorized by severity (red/yellow/green)

### 5. Settings & Preferences
- Toggle daily brief generation on/off
- Configure email and Slack notifications
- Set pipeline alert severity threshold
- Customize brief delivery time and timezone

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
│   └── daily-brief-widget.tsx          # Dashboard widget card
├── hooks/use-copilot.ts                # React hooks (useDailyBrief, useCopilotPreferences, usePipelineAlerts)
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
| `SMTP_HOST` | SMTP server for email notifications | `None` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username / sender email | `None` |
| `SMTP_PASSWORD` | SMTP password | `None` |
| `SMTP_FROM_EMAIL` | From address for outgoing emails | Falls back to `SMTP_USER` |

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
