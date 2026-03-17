# Outmate.ai — Deep Codebase Analysis Report

**Generated:** March 6, 2026
**Branch:** `nlp`
**Scope:** Full end-to-end analysis — Backend (FastAPI/Python) + Frontend (Next.js/TypeScript)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Backend Deep Analysis](#3-backend-deep-analysis)
   - [Directory Structure](#31-directory-structure)
   - [Core Layer](#32-core-layer)
   - [Database Layer](#33-database-layer)
   - [API Routes Layer](#34-api-routes-layer)
   - [Services Layer](#35-services-layer)
   - [Automations & AI Agents](#36-automations--ai-agents)
   - [Migrations & Scripts](#37-migrations--scripts)
4. [Frontend Deep Analysis](#4-frontend-deep-analysis)
   - [Directory Structure](#41-directory-structure)
   - [App Router Pages](#42-app-router-pages)
   - [Components Library](#43-components-library)
   - [Library & Utilities](#44-library--utilities)
   - [API Client Layer](#45-api-client-layer)
5. [Data Flow & Integration Map](#5-data-flow--integration-map)
6. [External Service Integrations](#6-external-service-integrations)
7. [Security Analysis](#7-security-analysis)
8. [Performance & Caching Architecture](#8-performance--caching-architecture)
9. [AI & NLP Architecture](#9-ai--nlp-architecture)
10. [Issues, Gaps & Recommendations](#10-issues-gaps--recommendations)
11. [Summary Scorecard](#11-summary-scorecard)

---

## 1. Project Overview

**Outmate.ai** is a B2B Go-To-Market (GTM) Intelligence Platform that combines data aggregation from multiple third-party providers with AI-driven prospecting, signal detection, and outreach automation.

### Core Value Propositions
| Feature | Description |
|---|---|
| Multi-provider B2B search | Aggregates data from Crustdata, Explorium, ContactOut, BetterContact |
| NLP-powered search | Natural language queries converted to structured API filters |
| Intent signals | Real-time buying signal detection (hiring, funding, tech adoption, LinkedIn posts) |
| AI Agents | 9 specialized agents for prospecting, research, lookalike, predictive scoring |
| Campaign automation | LLM-powered email/LinkedIn message generation via OpenRouter/Claude |
| Visitor intelligence | IP-to-company tracking pixel with enrichment pipeline |
| Credit system | Usage-based credit tracking per user/search |

---

## 2. Technology Stack

### Backend
| Layer | Technology | Version |
|---|---|---|
| Framework | FastAPI | Latest |
| Language | Python | 3.x |
| ORM | SQLAlchemy | ≥ 2.0 |
| Database | PostgreSQL (Supabase) | - |
| Caching | Redis (Upstash) | ≥ 4.2 |
| Auth | JWT (PyJWT) + PBKDF2-SHA256 | - |
| Task Queue | Celery (configured, minimal use) | ≥ 5.3 |
| NLP/AI | LangChain, LangGraph, HuggingFace embeddings | Latest |
| Vector DB | PGVector (pgvector extension) | - |
| Agents | CrewAI | 1.9.3 |
| LLM Gateway | OpenRouter (Claude 3.5 Haiku) | - |
| Rate Limiting | SlowAPI | - |
| Serving | Uvicorn + Gunicorn | - |
| HTTP Client | HTTPX (async) | ≥ 0.25 |
| Validation | Pydantic v2 | ≥ 2.0 |

### Frontend
| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | ^16.1.6 |
| Language | TypeScript | ^5 |
| UI Library | React | 19.2.0 |
| Styling | Tailwind CSS | ^4.1.9 |
| Animation | Framer Motion | ^12.29.2 |
| Component System | Radix UI | Various |
| Icons | Lucide React | ^0.454.0 |
| State Management | Zustand | 5.0.9 |
| Form Handling | React Hook Form + Zod | Latest |
| Charts | Recharts | 2.15.4 |
| HTTP Client | Axios | ^1.13.6 |
| Notifications | Sonner | ^1.7.4 |
| Analytics | Custom Visitor Script | 1.0.0 |
| DB (server) | pg (postgres) + ioredis | Latest |

---

## 3. Backend Deep Analysis

### 3.1 Directory Structure

```
Backend/
├── app/
│   ├── main.py                      # FastAPI app entry point
│   ├── api/
│   │   ├── routes/                  # 20 route files
│   │   └── deps/
│   │       └── auth.py              # JWT auth dependency
│   ├── core/
│   │   ├── settings.py              # Pydantic Settings (validated config)
│   │   ├── config.py                # Config alias
│   │   ├── redis.py                 # Redis singleton manager
│   │   ├── celery_app.py            # Celery configuration
│   │   ├── logging.py               # JSON/text logging setup
│   │   ├── middleware.py            # Request ID, Logging, Security middleware
│   │   └── rate_limiting.py         # SlowAPI rate limiting
│   ├── db/
│   │   ├── base.py                  # SQLAlchemy declarative base
│   │   ├── session.py               # Connection pool (QueuePool)
│   │   ├── deps.py                  # get_db FastAPI dependency
│   │   ├── vector_setup.py          # PGVector extension setup
│   │   ├── models/                  # 12 SQLAlchemy models
│   │   ├── repositories/            # Repository pattern (empty/minimal)
│   │   └── utils.py                 # DB helper utilities
│   ├── services/                    # 20+ business logic services
│   ├── schemas/                     # Pydantic input/output schemas
│   ├── tasks/                       # Celery async tasks
│   └── utils/                       # Shared utilities
├── automations-agents/              # 5 CrewAI agent projects
├── alembic/                         # DB migrations (minimal setup)
├── migrations/                      # SQL migration files
├── config/                          # Config overrides
├── scripts/                         # Utility scripts
├── Dockerfile                       # Production Docker build
└── requirements.txt                 # Python dependencies
```

### 3.2 Core Layer

#### `app/main.py` — Application Entry Point
- Creates FastAPI instance with Swagger/ReDoc docs
- Registers **14 routers** across all domains
- Applies `SecurityHeadersMiddleware` inline (duplicate of `core/middleware.py`)
- CORS configured with `allow_origin_regex=".*"` (**security concern — see §7**)
- Custom validation error handler with detailed logging
- Startup lifecycle: DB table creation → Redis connection → PGVector setup (async background task)
- Exposes `/v1/models` endpoint simulating OpenAI API format

#### `app/core/settings.py` — Centralized Configuration
- Uses Pydantic `BaseSettings` for type-safe environment loading
- **Required fields:** `DATABASE_URL`, `JWT_SECRET`, `CRUSTDATA_API_KEY`, `EXPLORIUM_API_KEY`, `CONTACTOUT_API_KEY`, `OPENROUTER_API_KEY`
- **Validators:** Enforces 32+ char JWT secret, validates PostgreSQL URL prefix, rejects placeholder API keys
- Connection pool tuning: `pool_size=5`, `max_overflow=10`, `pool_recycle=1800` (optimized for Supabase Session Pooler)
- Optional keys: Gemini, Perplexity, Serper, Tavily, SEC, IPinfo, Enrich.so, BrightData, Unipile, Google OAuth
- CORS origins configurable via comma-separated env var
- Azure Key Vault integration mentioned in docs but not implemented in code

#### `app/core/redis.py` — Redis Singleton
- Implements `RedisManager` class (not a true singleton pattern, but class-level state)
- Supports both `redis://` (plain) and `rediss://` (TLS) for Upstash
- Exponential backoff retry (3 attempts via `redis.retry.Retry`)
- Health check every 30s via `health_check_interval`
- Dual mode: sync ping at startup + async client for operations
- `get_redis()` async dependency available for FastAPI injection

#### `app/core/middleware.py`
- `RequestIDMiddleware`: UUID-based request tracing (`X-Request-ID` header)
- `RequestLoggingMiddleware`: Logs method/path/status/timing; WARN on 4xx+
- `SecurityHeadersMiddleware`: HSTS, X-Frame-Options, XSS protection (defined but applied separately in `main.py`)

#### `app/core/rate_limiting.py`
- SlowAPI integration for per-endpoint rate limiting
- Rate limits configurable per route

### 3.3 Database Layer

#### Models (12 total)

| Model | Table | Key Fields |
|---|---|---|
| `User` | `users` | UUID PK, email (unique), hashed_password, credits_balance (default 100), subscription_tier (free/basic/pro/enterprise) |
| `Company` | `companies` | UUID PK, domain (unique), industry, employee_count_range, revenue, location JSONB, technologies JSONB, funding info, headcount growth |
| `Prospect` | `prospects` | UUID PK, FK→companies, full_name, email, job_title, seniority_level, department, linkedin_url |
| `CreditTransaction` | `credit_transactions` | UUID PK, FK→users, amount (±), type (purchase/usage/refund/bonus) |
| `SearchQuery` | `search_queries` | Vector(384) embedding, content, metadata JSONB |
| `ApiUsageLog` | `api_usage_logs` | Request logging per API call |
| `NLPChatSession` | chat sessions | NLP query chat history |
| `SiteConfig` | `site_configs` | Pixel key, ICP filters, webhook URLs |
| `Visit` | `visits` | FK→site_configs, IP (INET type), URL, intent_score, resolution JSONB |
| `Alert` | `alerts` | FK→visits, webhook_type, status, payload |
| `AvailableFilter` | Filters catalog | - |
| `CachedQuery` | Query cache | - |

#### Connection Pool (session.py)
- `QueuePool` with SSL enforcement (`sslmode=require`)
- 30-second statement timeout via `options` connect arg
- `pool_pre_ping=True` prevents stale connection issues
- `pool_recycle=1800` for Supabase's session limits

#### Vector Database (vector_setup.py)
- Enables `pgvector` PostgreSQL extension at startup
- Creates `search_queries` table with `vector(384)` embedding column
- Creates `company_vectors` table for company similarity search
- Uses HuggingFace `all-MiniLM-L6-v2` model (384 dimensions)
- Backfills missing columns on pre-existing tables

### 3.4 API Routes Layer

#### Route Summary (20 route files)

| Route File | Prefix | Purpose |
|---|---|---|
| `auth.py` | `/api/auth` | Register, Login (JWT) |
| `leads.py` | `/api/leads` | Lead CRUD, search, export |
| `prospects.py` | `/api/prospects` | Prospect search/filter |
| `companies.py` | `/api/companies` | Company search |
| `crustdata_routes.py` | `/api/crustdata` | Direct Crustdata proxy |
| `explorium_routes.py` | `/api/explorium` | Direct Explorium proxy |
| `contactout_routes.py` | `/api/contactout` | ContactOut enrichment |
| `bettercontact_routes.py` | `/api/bettercontact` | BetterContact waterfall |
| `enrichment_routes.py` | `/api/enrich` | General enrichment |
| `signals.py` | `/api/signals` | Signal CRUD + run + preview |
| `campaigns.py` | `/api/campaigns` | Campaign drafts, message gen |
| `ai_agents.py` | `/api/ai-agents` | AI agent invocations |
| `gtm_agents.py` | `/api/gtm-agents` | GTM-specific agents |
| `chat.py` | `/api/chat` | NLP chat interface |
| `chat_history.py` | - | Chat session history |
| `visitors.py` | `/api/visitors` | Visit tracking, enrichment |
| `health.py` | - | Health checks |
| `diagnostics.py` | `/api/diagnostics` | System diagnostics |

#### Auth Flow (`auth.py`)
1. `POST /api/auth/register`: Creates user with PBKDF2-SHA256 hashed password; 100 free credits
2. `POST /api/auth/login`: Verifies password → issues JWT (HS256, configurable expiry)
3. Auth dependency (`deps/auth.py`): HTTPBearer → decode JWT → lookup User in DB

#### Signals API (`signals.py` — 70,239 bytes, largest route file)
- Signal types: `x_mentions`, `x_profiles`, `x_hashtags`, `x_trends`, `monitor_rss_feed`, `monitor_google_search_results`, `monitor_professional_posts`, `monitor_interactions_with_professional_post`
- Supports signal creation, editing, deletion, preview, and run
- `run_signal` internally delegates to `signal_fetcher_service`
- Filter normalization: handles comma-separated strings, type coercion, empty value stripping
- Company discovery via `SignalDetectionService._search_companies_by_filters()`
- `ExploriumCreditError` custom exception for 403 handling

#### Visitors API (`visitors.py`)
- `GET /api/visitors/pixel.js`: Serves tracking pixel JS from Frontend/public
- `POST /api/visitors/track`: Receives IP, URL, referrer; deduplication via Redis; enriches via `VisitorEnricher`
- Uses `ThreadPoolExecutor` (4 workers) for sync DB operations with 15s timeout
- Returns 503 on DB timeout rather than hanging

### 3.5 Services Layer (20+ files)

#### `crustdata_service.py` (67,793 bytes — largest service)
- Core search service for people/company data
- Endpoints: realtime company search, company screener/enrichment, people search, LinkedIn posts, people enrichment
- `normalize_company()`: Maps raw Crustdata response to internal schema
- `comprehensive_company_search()`: Wraps realtime search + enrichment flow
- `_sanitize_enrichment_fields()`: Removes unsupported fields to prevent 400 errors
- Debug print statements throughout (print to stdout, not proper logging)

#### `explorium_service.py` (70,711 bytes — largest overall service)
- Comprehensive Explorium API wrapper
- `_map_filters()`: Maps frontend filter names to Explorium API format
- Country code normalization + regional grouping (north america, europe, APAC)
- LinkedIn category alias system: maps user terms ("saas", "fintech") to multiple LinkedIn categories for broader search
- Methods: `search_companies()`, `search_business_signals()`, `get_linkedin_posts()`, `get_business_challenges()`

#### `advanced_nlp_service.py` (40,215 bytes)
- LangGraph multi-node workflow for NLP processing
- Graph nodes: `categorize` → `extract_filters` → `find_similar` → `synthesize`
- Uses OpenRouter API for query categorization
- HuggingFace `all-MiniLM-L6-v2` embeddings (shared singleton across instances to avoid reloading)
- `_infer_intent_from_query()`: Heuristic fallback using keyword lists
- Intent types: `prospect` (person-focused), `company` (company-focused)
- `MemorySaver` for LangGraph workflow state persistence

#### `search_service.py` (40,342 bytes)
- Orchestrates multi-step search flow:
  1. `FilterMappingService.transform_to_realtime_format()` — normalize filters
  2. `CrustdataService.comprehensive_company_search()` — primary data
  3. Company normalization and enrichment
  4. `ContactOutService` enrichment for gaps
  5. Credit deduction with row-level locking (`with_for_update()`)
- Validates credits before search execution
- `CreditTransaction` record created for audit trail

#### `signal_detection_service.py` (41,586 bytes)
- Routes signal detection based on `data_source` parameter:
  - `"crustdata"` → People APIs (LinkedIn posts, enrichment, job changes)
  - `"explorium"` → Company APIs (business challenges, LinkedIn company posts)
- Detects: funding rounds, hiring trends, tech adoption, growth indicators, recent news

#### `signal_fetcher_service.py` (12,417 bytes)
- `run_signal()`: Executes individual signals based on type
- Integrates: RSS feeds (feedparser), Google search, social media monitoring
- Returns structured `SignalResult` objects

#### `ai_agents_service.py` (62,091 bytes)
- `AiAgentsService`: Core class for all AI agent operations
- Search tools: Serper (Google Search API), Tavily (AI search)
- `_call_serper()`: POST to `google.serper.dev/search` with retry (2 attempts)
- Domain lookup for seed companies (Stripe, Airbnb, Notion hardcoded)
- Redis-backed pipeline cohort data
- Agent types handled: agentic search, lookalike, research, predictive scoring

#### `campaign_service.py` (15,244 bytes)
- `CampaignService.generate_draft()`: LLM-powered email + LinkedIn message generation
- Uses OpenRouter (Claude) for personalized outreach drafts
- Recipient normalization for both prospect and company intents
- Formats recipients + signals as structured prompt context

#### `campaign_dashboard_service.py` (6,354 bytes)
- Dashboard-level aggregations: sequences, email accounts, blocklists
- Pulls stats for inbox, analytics feeds

#### `filter_mapping_service.py` (20,409 bytes)
- `FilterMappingService`: Maps frontend filter names → Crustdata API format
- Extensive lookup tables: `EMPLOYEE_COUNT_MAP`, `COUNTRY_REGION_MAP`, `INDUSTRY_MAP`
- `transform_to_realtime_format()`: Converts to list-based Crustdata format
- Supported Crustdata filters: 30+ fields including headcount growth, department size, funding stage

#### `contactout_service.py` (18,315 bytes)
- Company and people enrichment via ContactOut API
- `_attempt_with_header_variants()`: Tries multiple auth header formats on 401 (robustness for API quirks)
- Email/phone sanitization via utils

#### `bettercontact_service.py` (14,854 bytes)
- Async waterfall enrichment: POST to create → poll GET for results
- Finds verified work emails and phone numbers
- Supports enrichment by first_name + last_name + company + LinkedIn URL

#### `openrouter_service.py` (2,049 bytes)
- Simple Claude 3.5 Haiku wrapper via OpenRouter
- 800 max tokens, 0.7 temperature
- Handles both string and list content formats in Claude's response

#### `visitor_enrich.py` (8,351 bytes)
- Multi-step IP enrichment pipeline:
  1. IPinfo lookup (geo + basic org/ISP)
  2. Domain resolution to company name
  3. Explorium company enrichment
  4. Person/contact matching
- Returns unified enrichment object with company, person, email, phone

#### `redis_service.py` (3,688 bytes)
- Higher-level Redis helper methods for caching search results

#### `gmail_service.py` / `unipile_service.py`
- Email sending: Gmail OAuth flow + Unipile (multi-channel email/LinkedIn)
- OAuth redirect handling

#### `nlp_service.py` (3,817 bytes) / `chat_agent_service.py` (14,918 bytes)
- NLP query parsing and chat agent for natural language B2B queries
- Routes to companies or prospects based on detected intent

#### `gtm_agents_service.py` (5,445 bytes)
- GTM-specific agent operations separate from core AI agents
- Market analysis, ICP targeting

### 3.6 Automations & AI Agents

Located in `automations-agents/`, these are **standalone CrewAI projects** (not integrated into the main FastAPI app):

| Project | Purpose |
|---|---|
| `adaptive_icp_command_center_v1_crewai-project` | ICP definition and targeting |
| `b2b_viral_growth_engine_v1_crewai-project` | Referral/viral growth strategy |
| `competitive_intelligence_market_analysis_v1_crewai-project` | Competitor analysis |
| `executive_churn_prediction_engine_v1_crewai-project` | Churn prediction for accounts |
| `global_outreach_compliance_engine_v1_crewai-project` | Outreach compliance checking |

Each project follows CrewAI structure with `src/`, `tests/`, `pyproject.toml`, `knowledge/` directories.

### 3.7 Migrations & Scripts

- **`alembic/`**: Alembic configured (`alembic.ini`) but minimal migration files present. Schema managed primarily via `Base.metadata.create_all()` at startup
- **`migrations/`**: Raw SQL files:
  - `add_company_fields.sql`: Adds firmographic columns
  - `add_user_auth_fields.sql`: Adds `hashed_password` column
- **`scripts/`**: Utility/deployment scripts
- **Probe scripts** at root: `probe_explorium_categories.py`, `probe_industry.py`, etc. — development/debug scripts left in repo

---

## 4. Frontend Deep Analysis

### 4.1 Directory Structure

```
Frontend/
├── app/
│   ├── layout.tsx                   # Root layout (AuthProvider wrapper)
│   ├── page.tsx                     # Root → redirects to /dashboard
│   ├── globals.css                  # Global styles + Tailwind
│   ├── auth/                        # Auth page
│   ├── company/                     # Company detail page
│   ├── components/                  # App-level components
│   ├── api/                         # Next.js API routes (proxy/server-side)
│   │   ├── contactout/
│   │   ├── database/
│   │   ├── explorium/
│   │   ├── leads/
│   │   ├── location-search/
│   │   ├── nlp-enrichment/
│   │   ├── proxy/
│   │   └── school-search/
│   └── (dashboard)/                 # Dashboard route group
│       ├── layout.tsx               # Dashboard shell layout
│       ├── dashboard/               # Main dashboard
│       ├── ai-agents/               # AI Agents hub
│       ├── ai-powered-search/       # NLP search
│       ├── analytics/               # Analytics dashboard
│       ├── campaigns/               # Campaign management
│       ├── integrations/            # Third-party integrations
│       ├── leads/
│       │   ├── companies/           # Company leads
│       │   ├── prospects/           # People leads
│       │   ├── history/             # Search history
│       │   ├── watcher/             # Lead watcher
│       │   └── web/
│       ├── prompt-search/           # Free-text search
│       ├── scoring/                 # Lead scoring
│       ├── settings/                # User settings
│       ├── signals/
│       │   ├── events/
│       │   ├── intent/
│       │   ├── tracker/
│       │   ├── websights/
│       │   └── formcomplete/
│       ├── visitors/                # Visitor intelligence
│       └── workflows/               # Workflow builder
├── components/
│   ├── ui/                          # 28 Radix-based primitives
│   ├── ai-agents/                   # 9 agent panels
│   ├── auth/                        # Auth modal, forms, provider
│   ├── campaigns/                   # Campaign wizard + list
│   ├── dashboard/                   # KPI cards, charts
│   ├── layout/                      # Sidebar, Header
│   ├── leads/                       # Lead tables, panels
│   ├── providers/                   # React context providers
│   ├── shared/                      # CSV import button
│   └── signals/                     # Signal creation dialog + list
├── lib/
│   ├── auth.ts                      # Auth service (localStorage tokens)
│   ├── store.ts                     # Zustand global state
│   ├── database.ts                  # Server-side pg + Redis clients
│   ├── database.ts                  # DB connection utilities
│   ├── export-csv.ts                # CSV export helper
│   ├── utils.ts                     # cn() helper
│   ├── api/                         # API client modules
│   ├── stores/                      # Additional Zustand stores
│   ├── services/                    # Frontend service layer
│   ├── utils/                       # Additional utilities
│   ├── cache/                       # Client caching
│   └── data/                        # Static data/constants
├── hooks/
│   ├── use-debounce.ts              # Debounce hook
│   └── use-toast.ts                 # Toast notification hook
├── styles/                          # Additional CSS
└── next.config.mjs                  # Next.js config with API proxy
```

### 4.2 App Router Pages

#### Root (`app/page.tsx`)
- Immediate redirect to `/dashboard` via `useRouter().push()`
- No landing page — authenticated users go straight to dashboard

#### Auth (`app/auth/`)
- Auth modal-based flow (not a dedicated route page per directory structure)

#### Dashboard Group `(dashboard)/`
All pages within the route group share the dashboard layout with sidebar and header.

| Page | Route | Key Functionality |
|---|---|---|
| `dashboard/page.tsx` | `/dashboard` | KPI cards, charts, recent leads, active signals |
| `ai-agents/page.tsx` | `/ai-agents` | 9-agent hub with tabbed panel switching |
| `ai-powered-search/` | `/ai-powered-search` | NLP-powered B2B search interface |
| `campaigns/page.tsx` | `/campaigns` | Campaign list, creation wizard, dashboard sections |
| `leads/page.tsx` | `/leads` | Main leads hub |
| `leads/companies/` | `/leads/companies` | Company search results + filters |
| `leads/prospects/` | `/leads/prospects` | People search results + filters |
| `leads/history/` | `/leads/history` | Past search history |
| `signals/page.tsx` | `/signals` | Signal overview with list + create |
| `signals/events/` | `/signals/events` | Signal event stream |
| `signals/intent/` | `/signals/intent` | Intent signal monitoring |
| `signals/tracker/` | `/signals/tracker` | Active trackers |
| `signals/websights/` | `/signals/websights` | Website visitor signals |
| `signals/formcomplete/` | `/signals/formcomplete` | Form completion signals |
| `visitors/page.tsx` | `/visitors` | Visitor intelligence dashboard |
| `analytics/` | `/analytics` | Analytics dashboard |
| `integrations/` | `/integrations` | Third-party integration setup |
| `settings/` | `/settings` | User profile + preferences |
| `scoring/` | `/scoring` | Lead scoring configuration |
| `workflows/` | `/workflows` | Workflow automation builder |
| `prompt-search/` | `/prompt-search` | Free-text natural language search |

#### AI Agents Page (`ai-agents/page.tsx`)
- 9 specialized AI agent tabs:
  1. **Agentic Search** — Multi-step prospect identification
  2. **Lookalike** — Mirror best customers
  3. **Research** — Deep company intelligence
  4. **Predictive** — Lead conversion scoring
  5. **Crossfire Agent** — Competitive account poaching
  6. **Compliance Oracle** — Global outreach compliance
  7. **Virality Engine** — B2B referral chain propagation
  8. **Talent Radar** — Talent movement signals
  9. **Regime Shifter** — Market regime change detection

#### Campaigns Page (`campaigns/page.tsx`)
- Multi-section dashboard: campaigns list, sequences, email accounts, blocklist
- Derived analytics from campaign data (open rates, lead counts)
- Campaign creation wizard via `CampaignCreationWizard` component

### 4.3 Components Library

#### `components/ui/` (28 Radix-based primitives)
Standard shadcn/ui component set: Accordion, AlertDialog, Avatar, Badge, Button, Calendar, Card, Checkbox, Collapsible, Command, Dialog, Dropdown, Input, Label, Popover, Progress, ScrollArea, Select, Separator, Sheet, Skeleton, Switch, Table, Tabs, Textarea, Toast, Tooltip

#### `components/ai-agents/` (9 panel components)
| Component | Lines | Key API Calls |
|---|---|---|
| `agentic-search-panel.tsx` | ~450 | `aiAgentsApi.agenticSearch()` |
| `lookalike-panel.tsx` | ~400 | `aiAgentsApi.lookalikeSearch()` |
| `research-panel.tsx` | ~420 | `aiAgentsApi.researchCompany()` |
| `predictive-panel.tsx` | ~400 | `aiAgentsApi.predictiveScore()` |
| `crossfire-panel.tsx` | ~180 | Competitive analysis calls |
| `compliance-oracle-panel.tsx` | ~170 | Compliance checking |
| `virality-engine-panel.tsx` | ~180 | Referral chain analysis |
| `talent-radar-panel.tsx` | ~160 | Talent movement signals |
| `regime-shifter-panel.tsx` | ~155 | Market regime detection |

All panels use `SimulatedActivityFeed` pattern: animated log messages during search to communicate AI processing steps.

#### `components/campaigns/`
- `campaign-creation-wizard.tsx` (28,831 bytes): Multi-step wizard for campaign setup (type, audience, message, scheduling)
- `campaigns-list.tsx`: Sortable, filterable campaign table

#### `components/signals/`
- `create-signal-dialog.tsx` (11,625 bytes): Complex dialog for all 8 signal types with type-specific configuration options
- `signals-list.tsx`: Signal cards with status, run button, results preview

#### `components/leads/`
- `lead-generation-panel.tsx`: Filter-based lead generation with preset filters
- `leads-table.tsx` (12,026 bytes): Full-featured data table with sorting/filtering
- `nlp-search-bar.tsx`: Natural language search input with backend NLP integration
- `companies/`: Company-specific search results component
- `prospects/`: Prospect-specific search with LinkedIn-style cards

#### `components/layout/`
- `sidebar.tsx` (11,398 bytes): Collapsible sidebar with animated nav items, sub-menus (Leads, Signals expanded)
- `header.tsx` (5,019 bytes): Top nav with user info, credits display
- `main-layout-wrapper.tsx`: Layout wrapper component
- `theme-toggle.tsx`: Dark/light mode toggle

#### `components/auth/`
- `auth-modal.tsx`: Tabbed login/signup modal (6,241 bytes)
- `auth-provider.tsx`: React context provider for auth state
- `login-form.tsx`, `signup-form.tsx`, `forgot-password-form.tsx`

### 4.4 Library & Utilities

#### `lib/auth.ts` — Auth Service
- `authService` object: login, signup, logout, getCurrentUser, getToken, getAuthHeaders, resetPassword
- Tokens stored in `localStorage` (`outmate_auth_token` key)
- User data stored in `localStorage` (`outmate_user_data` key)
- `resetPassword` is a **placeholder** (logs to console, no backend call)

#### `lib/store.ts` — Global State (Zustand)
- Simple store: `user`, `isAuthenticated`, `sidebarCollapsed`
- Actions: `setUser`, `setSidebarCollapsed`, `logout`

#### `lib/stores/searchHistoryStore.ts`
- Zustand store for search history persistence
- Search history items with timestamps and filter state

#### `lib/database.ts` — Server-Side DB
- Node.js PostgreSQL pool (`pg` library): max 20 connections, 30s idle timeout
- ioredis client with robust retry strategy (10 attempts, linear backoff capped at 2s)
- `reconnectOnError`: Allows reconnect for ECONNREFUSED, ETIMEDOUT, READONLY
- Guards against client-side execution with `typeof window` checks

#### `lib/export-csv.ts`
- Simple CSV export helper for lead data download

#### `next.config.mjs` — Proxy Configuration
- `typescript.ignoreBuildErrors: true` (**removes TypeScript safety — see §7**)
- API proxy: `/api/*` → `NEXT_PUBLIC_API_URL/api/*` (defaults to `localhost:8000`)
- Images unoptimized (suitable for Docker/self-hosted)

### 4.5 API Client Layer (`lib/api/`)

| File | Purpose | Key Methods |
|---|---|---|
| `ai-agents.ts` | AI agent calls | `agenticSearch()`, `lookalikeSearch()`, `researchCompany()`, `predictiveScore()` |
| `campaigns.ts` | Campaign management | `getCampaigns()`, `createCampaign()`, `generateDraft()`, `sendEmail()` |
| `signals.ts` | Signal operations | `getSignals()`, `createSignal()`, `runSignal()`, `previewSignal()`, `getSignalResults()` |
| `leads.ts` | Lead generation | `generateLeads()`, `searchCompanies()`, `searchProspects()`, `exportLeads()` |
| `analytics.ts` | Analytics data | Dashboard metrics, time-series data |
| `dashboard.ts` | Dashboard widgets | KPI aggregations, recent activity |
| `integrations.ts` | Integration status | Gmail, LinkedIn, CRM connections |
| `settings.ts` | User settings | Profile, API keys, preferences |
| `gtm-agents.ts` | GTM agent calls | Market analysis, ICP targeting |
| `watcher-api.ts` | Lead watcher | Automated lead monitoring |

All API clients:
- Read `NEXT_PUBLIC_API_URL` from env (fallback: `localhost:8000`)
- Attach `Authorization: Bearer <token>` from localStorage
- Use `axios` for HTTP calls

---

## 5. Data Flow & Integration Map

### Search Flow (Company)
```
User Input (Filters/NLP)
  → Frontend Filter Panel OR NLP Search Bar
  → POST /api/prospects or /api/explorium/companies
  → FilterMappingService.transform_to_realtime_format()
  → CrustdataService.comprehensive_company_search()
  → ContactOutService.enrich_company() [gap filling]
  → SearchService._deduct_credits() [credit tracking]
  → Response → Frontend Table
```

### Visitor Tracking Flow
```
Website Pixel (pixel.js) [embedded on customer's site]
  → POST /api/visitors/track [IP, URL, referrer, user_agent]
  → Redis deduplication check (VISITOR_DEDUPE_SECONDS: 3600)
  → VisitorEnricher.enrich_ip()
    → IPinfo lookup (geo + org)
    → Explorium company enrichment
    → Person/contact matching
  → Visit record saved to DB
  → Webhook delivery (if configured)
```

### Campaign Generation Flow
```
User selects leads + context
  → POST /api/campaigns/generate-draft
  → CampaignService.generate_draft()
    → _extract_recipients() [normalize lead data]
    → _format_recipients_for_prompt() [structure for LLM]
    → OpenRouter Claude API call
  → Response: email subject + body + LinkedIn message
  → Optional: POST /api/campaigns/send [Gmail/Unipile]
```

### Signal Detection Flow
```
User creates signal (type + configuration)
  → POST /api/signals [save to DB]
  → POST /api/signals/{id}/run
    → signal_fetcher_service.run_signal()
      → RSS parsing / Google Search / Social monitoring
    → SignalDetectionService.detect_signals()
      → Explorium (companies) or Crustdata (prospects)
  → Results stored → Frontend signal results panel
```

### NLP Query Flow
```
User types natural language query
  → POST /api/chat or /api/leads/nlp
  → AdvancedNLPService workflow (LangGraph):
    1. categorize (OpenRouter) → intent: prospect|company
    2. extract_filters (LangChain) → structured filters
    3. find_similar (PGVector similarity search)
    4. synthesize → final response
  → Route to prospects or companies search
  → Return results
```

### Auth Flow
```
User submits credentials
  → Frontend auth.ts login()
  → POST /api/auth/login [proxied to backend]
  → Backend: PBKDF2-SHA256 verify → JWT (HS256) generation
  → Token stored in localStorage
  → Subsequent requests: Authorization: Bearer <token>
  → Backend: HTTPBearer → jwt.decode → User lookup
```

---

## 6. External Service Integrations

| Service | Purpose | Auth Method | Files |
|---|---|---|---|
| **Crustdata** | Company/People B2B data | `Authorization: Token` | `crustdata_service.py` |
| **Explorium** | Business intelligence | `api_key` header | `explorium_service.py` |
| **ContactOut** | Email/company enrichment | `token` + `authorization: basic` headers | `contactout_service.py` |
| **BetterContact** | Waterfall email/phone enrichment | `X-API-Key` header | `bettercontact_service.py` |
| **OpenRouter** | LLM gateway (Claude 3.5 Haiku) | `Bearer` token | `openrouter_service.py`, `campaign_service.py` |
| **Serper** | Google Search API | `X-API-KEY` | `ai_agents_service.py` |
| **Tavily** | AI-powered search | API key | `ai_agents_service.py` |
| **IPinfo** | IP geolocation + org lookup | Token | `visitor_enrich.py` |
| **Gmail API** | Email sending | OAuth 2.0 | `gmail_service.py` |
| **Unipile** | Multi-channel email/LinkedIn | API key + DSN | `unipile_service.py` |
| **Supabase** | PostgreSQL database | Connection string | `session.py` |
| **Upstash Redis** | Caching + deduplication | Redis URL (TLS) | `redis.py` |
| **HuggingFace** | `all-MiniLM-L6-v2` embeddings | Model download | `advanced_nlp_service.py` |
| **Frontend Analytics** | Visitor tracking script | Auto (script) | `app/layout.tsx` |

---

## 7. Security Analysis

### ✅ Security Strengths
- JWT-based auth with configurable expiry and 32-char minimum secret enforcement
- PBKDF2-SHA256 password hashing (strong, industry-standard)
- Security headers: HSTS, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options
- SSL enforced on DB connections (`sslmode=require`)
- Row-level locking (`with_for_update()`) for credit deduction
- API key placeholder validation prevents accidental deployment with test keys
- Server-side guard on `database.ts`: prevents DB access from browser

### ⚠️ Security Concerns

| Issue | Severity | Location | Details |
|---|---|---|---|
| Wildcard CORS `allow_origin_regex=".*"` | HIGH | `main.py:89` | Allows any origin despite specific origins listed. Should remove regex or restrict to specific patterns |
| `typescript.ignoreBuildErrors: true` | MEDIUM | `next.config.mjs:4` | Type errors suppressed — potential runtime failures |
| JWT tokens in `localStorage` | MEDIUM | `lib/auth.ts` | Vulnerable to XSS. Consider `httpOnly` cookies for production |
| Debug `print()` statements | LOW | `crustdata_service.py`, `explorium_service.py` | Leaks API key prefixes to stdout in production |
| `allow_origin_regex` combined with credentials | HIGH | `main.py:86-92` | CORS with credentials + wildcard regex creates security risk |
| Password reset is a stub | MEDIUM | `lib/auth.ts:100-104` | No actual reset flow implemented |
| CrewAI projects not isolated | LOW | `automations-agents/` | Separate Python projects co-located with main app |
| `enrich` API_KEY potentially unused | LOW | `settings.py` | Optional keys with no validation |

---

## 8. Performance & Caching Architecture

### Redis Caching Strategy
- **Search result caching**: Company/prospect searches cached by filter hash
- **Visitor deduplication**: IP+URL dedup within configurable window (default: 3600s)
- **Session data**: NLP chat sessions
- **Pipeline cohort**: AI agent pipeline state

### Database Optimization
- Connection pool: 5 persistent + 10 overflow connections
- `pool_pre_ping=True`: Eliminates stale connection failures
- `pool_recycle=1800`: Matches Supabase's session pooler limits
- `statement_timeout=30000`: Prevents runaway queries
- Indexed columns: email, domain, industry, employee_count_range, job_title, etc.

### Frontend Performance
- Zustand for lightweight state management (avoids Redux overhead)
- `use-debounce` hook for search input throttling
- Framer Motion animations with `AnimatePresence` for smooth transitions
- Custom Visitor Tracking Script for production monitoring

### API Timeout Configuration
| Service | Timeout |
|---|---|
| Crustdata | 30s |
| Explorium | 30s |
| ContactOut | 30s |
| DB operations (visitors) | 15s |
| OpenRouter (campaigns) | 60s |
| IPinfo | Default |

### Known Performance Issues
- `HuggingFaceEmbeddings` class-level singleton avoids re-loading model but first load is slow
- Large service files (70KB Explorium, 67KB Crustdata) suggest opportunity for decomposition
- No background task queue actively used (Celery configured but underutilized)
- Vector similarity search uses FAISS-CPU (suitable for development, needs index optimization for production scale)

---

## 9. AI & NLP Architecture

### NLP Pipeline (`AdvancedNLPService`)

```
Query Input
  ├── Intent Detection (heuristic keyword matching)
  ├── OpenRouter LLM Categorization
  ├── LangChain Filter Extraction
  ├── PGVector Similarity Search (find similar past queries)
  └── Result Synthesis
```

- **Embeddings Model**: `all-MiniLM-L6-v2` (384-dim, lightweight, fast)
- **Vector Store**: PostgreSQL pgvector extension
- **Graph Engine**: LangGraph `StateGraph` with `MemorySaver` checkpoint
- **Allowed Filter Keys**: `industry`, `location`, `company_size`, `current_title`, `keywords`

### AI Agent Architecture

**In-app agents** (`ai_agents_service.py`):
- Serper (Google Search) as primary web intelligence tool
- Tavily as alternative AI search
- Explorium for B2B company data enrichment
- OpenRouter/Claude for synthesis and scoring

**Standalone CrewAI agents** (`automations-agents/`):
- 5 specialized multi-agent workflows
- Each uses `crewai[tools]` v1.9.3
- Independent Python projects with own dependencies
- Not yet integrated into the FastAPI API surface

### LLM Usage Pattern
- **Model**: `anthropic/claude-3.5-haiku` via OpenRouter
- **Temperature**: 0.7 (balanced creativity/consistency)
- **Max tokens**: 800 (campaign drafts), variable for agents
- **Prompting**: Structured text prompts with recipient/signal context

---

## 10. Issues, Gaps & Recommendations

### Critical Issues
| # | Issue | Location | Recommendation |
|---|---|---|---|
| C1 | CORS wildcard regex bypasses allowlist | `main.py:89` | Remove `allow_origin_regex=".*"` or restrict to specific domain pattern |
| C2 | TypeScript build errors suppressed | `next.config.mjs:4` | Set `ignoreBuildErrors: false` and fix type errors |
| C3 | Alembic migrations barely used | `alembic/` | All schema changes should go through Alembic, not `create_all()` at startup |

### High Priority Gaps
| # | Gap | Details |
|---|---|---|
| H1 | Password reset not implemented | `lib/auth.ts:100-104` logs to console only — no email/token flow |
| H2 | Debug print statements in production services | `crustdata_service.py`, `explorium_service.py` — leaks sensitive prefixes to logs |
| H3 | CrewAI agents not API-connected | 5 agent projects exist but aren't callable from the FastAPI API layer |
| H4 | No refresh token mechanism | JWT expires, users forced to re-login with no silent refresh |
| H5 | `allow_origin_regex` + credentials | Security risk — should use explicit origin list only |

### Medium Priority Issues
| # | Issue | Details |
|---|---|---|
| M1 | localStorage JWT storage | XSS-vulnerable; consider `httpOnly` cookie migration |
| M2 | Celery configured but unused | `celery_app.py` exists but tasks not deployed; background jobs run in FastAPI async instead |
| M3 | Probe scripts in root | `probe_*.py`, `repro_*.py`, `test_*.py` at repo root are dev artifacts |
| M4 | Duplicate SecurityHeadersMiddleware | Defined in both `main.py` (inline) and `core/middleware.py` (not used from core) |
| M5 | No rate limiting on auth endpoints | `/api/auth/login` and `/api/auth/register` have no rate limiting → brute force risk |
| M6 | HuggingFace model downloads at startup | First boot downloads model; no pre-caching in Dockerfile |
| M7 | Hardcoded seed domains in AI agents | `"stripe": "stripe.com"` etc. hardcoded in `ai_agents_service.py` |

### Low Priority / Quality
| # | Issue | Details |
|---|---|---|
| L1 | `post_filter_service.py` + `post_filter_service_fixed.py` | Both exist — dead code, one should be removed |
| L2 | Repository pattern started but empty | `db/repositories/` exists but is unused |
| L3 | Magic numbers throughout | Timeouts, limits hardcoded in multiple services |
| L4 | Frontend `database.ts` connects to Supabase directly | Both frontend and backend have DB connections — unclear ownership |
| L5 | `20%` file at backend root | Empty file with name `20%` — likely accidental |
| L6 | Probe/repro scripts in backend root | Development artifacts: `repro_explorium.py`, `test_nlp_routing.py`, etc. |

### Feature Gaps (Not Yet Implemented)
| Feature | Status | Location |
|---|---|---|
| Workflow builder UI | Page exists, no backend | `/workflows` |
| Lead scoring configuration | Page exists | `/scoring` |
| Analytics dashboard | Page structure present | `/analytics` |
| Integration management | UI exists, some wired | `/integrations` |
| User subscription/billing | Model defined, no payment flow | `User.subscription_tier` |
| Google OAuth login | Configured in settings, no route | `settings.py` GOOGLE_CLIENT_ID |
| Email campaign sending | `gmail_service.py` written, partial integration | `campaigns.py` |

---

## 11. Summary Scorecard

| Dimension | Score | Notes |
|---|---|---|
| **Architecture** | 8/10 | Clean service layer, strong separation of concerns, good FastAPI structure |
| **Code Quality** | 6/10 | Large files (70KB services), debug prints, dev artifacts in repo |
| **Security** | 6/10 | Good fundamentals (JWT, hashing, HSTS) but CORS misconfiguration, localStorage JWT |
| **Database Design** | 8/10 | Rich model set, good indexing, pgvector integration, proper connection pool |
| **API Design** | 7/10 | RESTful, well-organized, consistent auth; some route duplication |
| **Frontend Quality** | 7/10 | Modern React 19, good component structure; `ignoreBuildErrors` concern |
| **AI/NLP Integration** | 8/10 | Sophisticated LangGraph pipeline, multi-source AI, vector search |
| **Testing** | 3/10 | Minimal test files found; no comprehensive test suite |
| **Documentation** | 9/10 | Excellent inline docs, extensive .md files, env examples |
| **Production Readiness** | 6/10 | Dockerfile present, Redis/DB config solid, but Alembic migrations incomplete |

### Overall Assessment
**Outmate.ai is a feature-rich, architecturally sound B2B intelligence platform** with impressive AI integration (LangGraph, CrewAI, vector search, multi-LLM). The core data aggregation pipeline (Crustdata → ContactOut → Explorium) is well-designed. The main areas for improvement are: security hardening (CORS, auth token storage), completing the migration to Alembic for schema management, removing debug code from production services, and adding a proper test suite. Several UI pages exist without backend endpoints (workflows, scoring), indicating the platform is still actively under development.

---

*Report generated by deep static analysis of the full Outmate codebase — Backend (FastAPI) + Frontend (Next.js).*
