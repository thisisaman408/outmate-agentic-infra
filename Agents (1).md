# Outmate.ai — AI Agents Feature: Complete Technical Documentation

**Version:** 1.0 | **Date:** March 2026 | **Environment:** Production-ready (Azure)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Diagram](#3-architecture-diagram)
4. [External Service Dependencies](#4-external-service-dependencies)
5. [Backend: Route Layer](#5-backend-route-layer)
6. [Backend: Service Layer](#6-backend-service-layer)
7. [Agent Deep-Dives — AI Agents (4 agents)](#7-agent-deep-dives--ai-agents)
8. [Agent Deep-Dives — GTM Agents (5 agents)](#8-agent-deep-dives--gtm-agents)
9. [Frontend API Client Layer](#9-frontend-api-client-layer)
10. [Frontend Component Layer](#10-frontend-component-layer)
11. [Rate Limiting](#11-rate-limiting)
12. [Error Handling](#12-error-handling)
13. [Environment Variables Required](#13-environment-variables-required)
14. [File Map](#14-file-map)

---

## 1. Overview

Outmate.ai implements a **9-agent AI system** split into two tiers:

| Tier | Agents | Purpose |
|---|---|---|
| **AI Agents** | Agentic Search, Research, Lookalike, Predictive | Core prospect discovery and intelligence |
| **GTM Agents** | Crossfire, Compliance Oracle, Virality Engine, Talent Radar, Regime Shifter | Go-to-market strategy execution |

All agents are **async Python** services on FastAPI, called through a Next.js proxy frontend. LLM calls are routed through **OpenRouter** using Claude 3.5 Haiku, Claude 3.5 Sonnet, and Perplexity Sonar models depending on the task.

---

## 2. Tech Stack

### Backend
- **Framework:** FastAPI (Python), async
- **LLM Gateway:** OpenRouter (`https://openrouter.ai/api/v1`)
- **Models used:** `anthropic/claude-3.5-haiku`, `anthropic/claude-3.5-sonnet`, `perplexity/sonar-pro`, `perplexity/sonar-reasoning-pro`, `perplexity/sonar-deep-research`, `perplexity/sonar-pro-search`
- **Search APIs:** Serper (Google Search), Tavily (real-time research)
- **Data enrichment:** Explorium API (via `SearchService`), SEC EDGAR (public API), Wikipedia API
- **Cache/Queue:** Redis (pipeline cohort tracking via `RedisManager`)
- **HTTP client:** `httpx` (async)
- **Validation:** Pydantic v2
- **Rate limiting:** `slowapi`

### Frontend
- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** TailwindCSS v4, shadcn/ui
- **Animation:** Framer Motion
- **State:** React `useState` (local per-panel)
- **HTTP:** `fetch` (browser-native)

---

## 3. Architecture Diagram

```
Browser (Next.js)
        │
        │  POST /api/v1/ai-agents/*
        │  POST /api/v1/gtm-agents/*
        ▼
FastAPI Backend (uvicorn)
        │
        ├──► AiAgentsService
        │        ├── Serper API         (Google Search)
        │        ├── Tavily API         (Real-time research)
        │        ├── OpenRouter         (Claude 3.5 Haiku, Perplexity Sonar)
        │        ├── Explorium API      (Company metadata / lookalikes)
        │        ├── SEC EDGAR API      (US financial data)
        │        ├── Wikipedia API      (Scale signals)
        │        └── Redis              (Pipeline cohort store)
        │
        └──► GTMAgentsService
                 └── OpenRouter         (Claude 3.5 Haiku OR Perplexity Sonar Pro)
```

---

## 4. External Service Dependencies

| Service | Used By | Purpose | Key Config |
|---|---|---|---|
| OpenRouter | All agents | LLM API gateway | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` |
| Serper | Agentic Search | Google search for company discovery + evidence | `SERPER_API_KEY` |
| Tavily | Research Agent | Real-time deep-search for company research | `TAVILY_API_KEY` |
| Explorium | Lookalike, Agentic Search | Company metadata, lookalike database | via `ExploriumService` |
| SEC EDGAR | Predictive | US company revenue/financial data | Public API, no key |
| Wikipedia | Predictive | Company scale signals | Public API, no key |
| Redis | Pipeline | Store pipeline cohort additions (last 100) | `REDIS_URL` |

---

## 5. Backend: Route Layer

### 5.1 AI Agents Router

**File:** `Backend/app/api/routes/ai_agents.py`

**Registered at:** `main.py` → prefix `/api/v1/ai-agents`

**Rate limit:** `RateLimits.SEARCH` on all search/research/lookalike/predictive endpoints; `RateLimits.DEFAULT` on pipeline.

#### Request Models (Pydantic)

```python
class SearchRequest(BaseModel):
    query: str

class ResearchRequest(BaseModel):
    companyName: str
    depth: str = "standard"   # "quick" | "standard" | "deep"

class LookalikeRequest(BaseModel):
    seedCompanyIds: List[str]

class PredictiveRequest(BaseModel):
    company: Optional[Dict[str, Any]] = None

class PipelineRequest(BaseModel):
    companyId: str
    companyName: str
    contactName: Optional[str] = None
    similarityScore: Optional[float] = None
```

#### Endpoints

| Method | Path | Handler | Service Method |
|---|---|---|---|
| POST | `/api/v1/ai-agents/search` | `agentic_search` | `ai_service.agentic_search(query)` |
| POST | `/api/v1/ai-agents/research` | `company_research` | `ai_service.deep_research(companyName, depth)` |
| POST | `/api/v1/ai-agents/lookalike` | `find_lookalikes` | `ai_service.find_lookalikes(seedCompanyIds)` |
| POST | `/api/v1/ai-agents/predictive` | `score_leads` | `ai_service.predictive_scoring(body.model_dump())` |
| POST | `/api/v1/ai-agents/pipeline` | `add_to_pipeline` | `ai_service.add_to_pipeline(body.model_dump())` |

---

### 5.2 GTM Agents Router

**File:** `Backend/app/api/routes/gtm_agents.py`

**Registered at:** `main.py` — the router defines its own prefix `"/api/v1/gtm-agents"` internally.

**Note:** GTM agents are NOT rate-limited at the route layer (no `@limiter.limit` decorators — can be added if needed).

#### Request Models (Pydantic)

```python
class CrossfirePayload(BaseModel):
    competitor_domain: str         # required — e.g. "apollo.io"
    target_region: Optional[str]   # optional — e.g. "US", "EU", "global"
    notes: Optional[str]           # optional — extra ICP context

class CompliancePayload(BaseModel):
    message_template: str          # required — outbound message text
    jurisdictions: Optional[str] = "US, EU, UK"  # comma-separated

class ViralityPayload(BaseModel):
    seed_customers: str            # required — comma-separated company/persona names
    channels: Optional[str] = "email, linkedin, slack"

class TalentRadarPayload(BaseModel):
    accounts: str                  # required — comma-separated account names
    lookback_days: int = 90        # 7–365 range validated

class RegimeShifterPayload(BaseModel):
    geo_focus: str                 # required — e.g. "US SaaS", "DACH manufacturing"
    scenario: Optional[str]        # optional — e.g. "election", "tariffs", "recession"
```

#### Endpoints

| Method | Path | Handler | Service Method |
|---|---|---|---|
| POST | `/api/v1/gtm-agents/crossfire/run` | `run_crossfire_agent` | `gtm_agents_service.run_crossfire(payload)` |
| POST | `/api/v1/gtm-agents/compliance-oracle/run` | `run_compliance_oracle_agent` | `gtm_agents_service.run_compliance_oracle(payload)` |
| POST | `/api/v1/gtm-agents/virality-engine/run` | `run_virality_engine_agent` | `gtm_agents_service.run_virality_engine(payload)` |
| POST | `/api/v1/gtm-agents/talent-radar/run` | `run_talent_radar_agent` | `gtm_agents_service.run_talent_radar(payload)` |
| POST | `/api/v1/gtm-agents/regime-shifter/run` | `run_regime_shifter_agent` | `gtm_agents_service.run_regime_shifter(payload)` |
| POST | `/api/v1/gtm-agents/{agent_name}/run` | `run_gtm_agent` | Generic fallback dispatcher |

---

## 6. Backend: Service Layer

### 6.1 `AiAgentsService`

**File:** `Backend/app/services/ai_agents_service.py` (~1,487 lines)

**Instantiated as:** Module-level singleton in `ai_agents.py` → `ai_service = AiAgentsService()`

#### Constructor — Loaded from Settings

```python
self.openrouter_api_key   # settings.OPENROUTER_API_KEY
self.tavily_api_key       # settings.TAVILY_API_KEY
self.serper_api_key       # settings.SERPER_API_KEY
self.openrouter_base_url  # settings.OPENROUTER_BASE_URL
self.explorium            # ExploriumService()
self.redis                # RedisManager.get_client() (graceful fallback)
```

#### Core Helper Methods

**`_call_serper(query, num=10)`**
- Calls `https://google.serper.dev/search`
- Returns list of organic results `[{title, link, snippet}]`
- Retries once on HTTP 429 with 1s delay
- Returns `[]` if key missing or error

**`_call_tavily(query, search_depth="advanced")`**
- Calls `https://api.tavily.com/search`
- Returns `{results: [{title, url, content}], answer}`
- `search_depth`: `"basic"` (quick), `"advanced"` (standard/deep)
- Returns `{"results": [], "error": "..."}` if key missing

**`_call_openrouter(model, messages, temperature=0.7, reasoning=False, max_tokens=3000)`**
- Calls `{OPENROUTER_BASE_URL}/chat/completions`
- Headers include `HTTP-Referer: http://localhost:3000` and `X-Title: Outmate AI`
- Returns `{content, reasoning_details, usage}`
- Raises `HTTPException(402)` on credit exhaustion
- 120s timeout

**`_map_with_concurrency(items, limit, func)`**
- Runs async `func` on each item with `asyncio.Semaphore(limit)`
- Used for parallel evidence collection (limit=5)

**`_extract_employees_from_text(item)`**
- Regex extracts employee count from text fields
- Pattern: numbers followed by "employees", "staff", "people", "team"

**`_fetch_company_metadata(domain)`**
- Calls `SearchService.search_companies_explorium(filters={"domain": [domain]}, limit=1)`
- Returns first company or `None`

**`_enrich_with_live_metadata(items)`**
- For each item, fetches metadata by domain and fills in missing `location` and `employees`

---

### 6.2 `GTMAgentsService`

**File:** `Backend/app/services/gtm_agents_service.py` (185 lines)

**Instantiated as:** `gtm_agents_service = GTMAgentsService()` at module level

#### Module-level OpenRouter config

```python
_OPENROUTER_URL  = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
_MODEL_HAIKU     = "anthropic/claude-3.5-haiku"
_MODEL_PERPLEXITY = "perplexity/sonar-pro"
_TIMEOUT         = 120.0
```

#### `_call_openrouter(model, system_prompt, user_message, temperature=0.4)` (module-level function)

- Appends strict formatting rule to every system prompt:
  > "Do NOT use markdown symbols like #, *, **. Do NOT use tables. Use plain text with capitalized headers."
- Post-processes output: strips citation markers `[1]`, markdown bold/italic, table pipes, heading hashes
- Returns clean plain-text string
- 120s timeout

---

## 7. Agent Deep-Dives — AI Agents

### Agent 1: Agentic Search

**Purpose:** Multi-layer prospect discovery from a natural language query. Finds real companies matching the user's B2B target profile, with contact details for key stakeholders.

**Endpoint:** `POST /api/v1/ai-agents/search`

**Frontend component:** `Frontend/components/ai-agents/agentic-search-panel.tsx`

#### Request

```json
{
  "query": "Series B SaaS startups in DACH region hiring engineers"
}
```

#### Internal 7-Layer Pipeline

**Layer 1 — Query Normalization & Mode Detection**
- Lowercases query, strips leading verbs ("find", "show me", "list")
- Detects mode based on keywords:
  - `"actively hiring"` or `"open roles"` → `STRICT` (filters to Active/Moderate hiring signals only)
  - `"hiring"`, `"funded"`, `"remote"` → `FILTERED`
  - Default → `DISCOVERY`

**Layer 2 — Tiered Discovery via Serper (parallel)**
- 3 concurrent Serper searches (20 results each):
  1. `"top market leader {topic} companies"`
  2. `"fast growing mid-sized {topic} companies"`
  3. `"new innovative {topic} startups 2024 2025"`

**Layer 3 — Deduplication & Merging**
- Extracts domain from each result URL
- Blocks: `linkedin.com`, `clutch.co`, `g2.com`, `glassdoor.com`, `wikipedia.org`, `quora.com`, `youtube.com`
- Deduplicates by domain
- Selection: 5 famous + 5 mid + 10 startups = up to 20 candidates

**Layer 4 — Deep Evidence Collection (concurrent, semaphore=5)**
- For each candidate, 2 parallel Serper calls:
  1. `"site:{domain} (hiring OR careers OR 'product launch' OR funding OR 'press release')"` — signals
  2. `"site:{domain} (email OR '@{domain}' OR 'leadership' OR 'team')"` — contacts
- Produces up to 6 evidence snippets per candidate

**Layer 5 — AI Interpretation (Claude 3.5 Haiku → Perplexity Sonar Pro)**
- Batches of 10 candidates sent to Claude 3.5 Haiku
- Prompt instructs extraction of: company profile, target stakeholder, contact details, signals, score (0–99), reason
- Perplexity Sonar Pro then cross-validates: enriches `perplexityReason` and fills missing contact emails
- JSON parse failure → retry with `temperature=0.3` + explicit repair prompt
- Merges contacts from Perplexity where Claude's contacts are incomplete

**Layer 6 — Constraint Enforcement**
- `STRICT` mode: filters to companies with `signals.hiring` in `["Active", "Moderate"]`
- Sorts all results by `score` descending
- Final deduplication by `id`

**Layer 7 — Output Normalization**
- Fills all fallback fields: `contactName`, `title`, `email`, `location`, `employees`, `reason`
- Returns cleaned list

#### Response Schema

```json
[
  {
    "id": "uuid-v4",
    "companyName": "string",
    "website": "string",
    "domain": "string",
    "industry": "string",
    "location": "string",
    "employees": "string",
    "score": 85,
    "reason": "Why this company fits the query",
    "signals": {
      "hiring": "Active | Moderate | Low | Not detected",
      "productActivity": "string | Not detected",
      "momentum": "Positive | Neutral | Unclear",
      "evidence": [{ "summary": "string", "sourceUrl": "string" }]
    },
    "contacts": [
      {
        "name": "Full Name | Not found",
        "title": "Exact Job Title",
        "email": "work@company.com | null",
        "linkedin": "https://linkedin.com/in/... | null",
        "sourceUrl": "string | null"
      }
    ],
    "contactName": "Primary contact name (flattened from contacts[0])",
    "title": "Primary contact title (flattened)",
    "email": "Primary contact email (flattened)",
    "linkedin": "Primary contact linkedin (flattened)",
    "perplexityReason": "Perplexity's validation/enrichment text",
    "perplexityDetails": "Full Perplexity response text",
    "perplexityReasoning": "Perplexity reasoning trace"
  }
]
```

---

### Agent 2: Research Agent

**Purpose:** Deep intelligence report on a specific company at three depth levels.

**Endpoint:** `POST /api/v1/ai-agents/research`

**Frontend component:** `Frontend/components/ai-agents/research-panel.tsx`

#### Request

```json
{
  "companyName": "Notion",
  "depth": "standard"
}
```

`depth` values: `"quick"` | `"standard"` (default) | `"deep"`

#### Internal Pipeline

**Step 1 — Real-Time Research via Tavily**
- Query: `"detailed strategic analysis, recent news, and competitors of {company_name}"`
- `depth=quick` → `search_depth="basic"`, max 5 results
- `depth=standard/deep` → `search_depth="advanced"`, max 5 / 10 results
- Returns research context string

**Step 2 — Model & Schema Selection**

| Depth | Model | Max Tokens | Schema Coverage |
|---|---|---|---|
| `quick` | `perplexity/sonar-pro` | 4,000 | Summary, products, market position, top competitors, recent news, risks |
| `standard` | `perplexity/sonar-reasoning-pro` | 6,000 | All quick fields + business model, revenue streams, full competitive landscape, opportunities |
| `deep` | `perplexity/sonar-deep-research` | 8,000 | All standard fields + regulatory environment, M&A signals, technology stack, GTM strategy, financial indicators |

**Step 3 — Perplexity Execution**
- System prompt instructs structured JSON output matching chosen schema
- User message includes Tavily research context + specific company query
- Response parsed as JSON

**Step 4 — Fallback Repair (Claude 3.5 Haiku)**
- If JSON parse fails → retry with Claude 3.5 Haiku to repair the malformed JSON
- If still fails → returns `{"error": "..."}`

#### Response Schema (standard depth example)

```json
{
  "companyName": "string",
  "executiveSummary": "string",
  "companyType": "B2B | B2C | D2C | Marketplace | Mixed",
  "businessModel": {
    "description": "string",
    "targetCustomers": "string",
    "revenueStreams": ["string"],
    "businessDurability": "string"
  },
  "productsAndServices": [
    { "name": "string", "description": "string" }
  ],
  "marketPosition": {
    "industry": "string",
    "geographicPresence": "string",
    "positioning": "Leader | Challenger | Niche | Emerging",
    "keyDifferentiators": ["string"],
    "marketDynamics": "string"
  },
  "competitiveLandscape": {
    "directCompetitors": ["string"],
    "indirectCompetitors": ["string"],
    "competitiveContext": "string"
  },
  "recentDevelopments": [
    { "event": "string", "date": "string", "strategicImpact": "string" }
  ],
  "opportunities": ["string"],
  "risksAndChallenges": ["string"],
  "confidenceLevel": "High | Medium | Low"
}
```

---

### Agent 3: Lookalike Agent

**Purpose:** Given a seed pool of company IDs/names, find highly similar companies using Explorium's lookalike database with Claude-based fallback.

**Endpoint:** `POST /api/v1/ai-agents/lookalike`

**Frontend component:** `Frontend/components/ai-agents/lookalike-panel.tsx`

#### Request

```json
{
  "seedCompanyIds": ["stripe", "airbnb", "notion"]
}
```

The `seedCompanyIds` can be company names (strings) or domain-resolvable IDs. The service maps known names to domains via a built-in lookup:
```python
self.seed_domain_lookup = {
    "stripe": "stripe.com",
    "airbnb": "airbnb.com",
    "notion": "notion.so",
}
```

#### Internal Pipeline

1. Resolves each seed ID to a business ID via Explorium `resolve_business_ids`
2. Queries Ocean.io / Explorium lookalike database using resolved business IDs
3. Scores and normalizes similarity scores via `_map_similarity_score()`
4. Falls back to Claude 3.5 Haiku similarity reasoning if Explorium returns no results
5. Returns up to 3 highest-similarity matches

#### Response Schema

```json
[
  {
    "id": "uuid-v4",
    "companyName": "string",
    "similarityScore": 0.87,
    "similarityLabel": "High | Medium | Low",
    "matchingFactors": ["Same ICP segment", "Comparable ARR", "Enterprise SaaS"],
    "industry": "string",
    "employees": "string",
    "location": "string",
    "revenue": "string",
    "website": "string",
    "description": "string"
  }
]
```

#### Pipeline Cohort Integration

After the user clicks "Add to Pipeline", the frontend calls:

```
POST /api/v1/ai-agents/pipeline
{
  "companyId": "...",
  "companyName": "...",
  "contactName": "...",
  "similarityScore": 0.87
}
```

Service stores in Redis:
```python
await redis.lpush("ai:lookalike:pipeline", json.dumps(entry))
await redis.ltrim("ai:lookalike:pipeline", 0, 99)  # Keeps last 100
```

Returns: `{"status": "added", "company": "CompanyName", "pipeline_size": N}`

---

### Agent 4: Predictive Scoring Agent

**Purpose:** Scores leads/contacts at a target company for conversion propensity using multi-signal intelligence.

**Endpoint:** `POST /api/v1/ai-agents/predictive`

**Frontend component:** `Frontend/components/ai-agents/predictive-panel.tsx`

#### Request

```json
{
  "company": {
    "name": "Stripe",
    "domain": "stripe.com",
    "industry": "FinTech",
    "country": "US"
  }
}
```

All company fields are optional; only `name` is effectively required for meaningful scoring.

#### Internal Pipeline

**Step 1 — Wikipedia Signal Extraction**
- Queries Wikipedia API for company page
- Extracts scale signals: IPO mentions, employee count, global expansion dates, founding year, revenue numbers

**Step 2 — SEC EDGAR Revenue Verification (US companies only)**
- Calls EDGAR full-text search API to find CIK number
- Retrieves latest 10-K filing for revenue data
- Adds `"SEC EDGAR verified revenue"` as a positive signal

**Step 3 — Claude 3.5 Sonnet Scoring**
- System prompt: "You are an expert B2B lead scoring model..."
- User message provides all gathered signals + company data
- Instructs output of JSON array of scored leads (up to 5 contacts for the company)
- Returns confidence, propensity label, and signal breakdown per lead

#### Response Schema

```json
[
  {
    "id": "uuid-v4",
    "companyId": "string",
    "companyName": "string",
    "contactName": "string",
    "title": "string",
    "email": "string",
    "score": 78,
    "conversionLikelihood": 0.78,
    "confidence": 85,
    "prediction": "High | Medium | Low",
    "factors": [
      { "name": "Recent funding round", "impact": "positive" },
      { "name": "No known email", "impact": "negative" }
    ],
    "guidance": "Approach with ROI-focused pitch targeting the finance team",
    "recommendation": "Prioritize outreach this week",
    "profileLink": "https://linkedin.com/in/..."
  }
]
```

---

## 8. Agent Deep-Dives — GTM Agents

All GTM agents share the same response envelope:

```json
{ "result": "Plain text report..." }
```

The `_call_openrouter` function in `gtm_agents_service.py` enforces plain-text output (no markdown, no tables, no citations) via post-processing and system prompt injection.

---

### Agent 5: Crossfire (Competitive Intelligence)

**Purpose:** Research a competitor's weaknesses, identify stealable accounts, generate battle cards and poaching sequences.

**Endpoint:** `POST /api/v1/gtm-agents/crossfire/run`

**Frontend component:** `Frontend/components/ai-agents/crossfire-panel.tsx`

**Model:** `perplexity/sonar-pro` (real-time web research)

#### Request

```json
{
  "competitor_domain": "apollo.io",
  "target_region": "US",
  "notes": "Our ICP is SMB SaaS teams under 50 people"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `competitor_domain` | string | Yes | Domain of competitor to research |
| `target_region` | string | No | Geography focus (e.g. "US", "EU", "global") |
| `notes` | string | No | Extra ICP/pipeline context for the agent |

#### System Prompt Role
> "Professional B2B competitive intelligence agent. Uses real-time web research to identify competitor weaknesses and stealable accounts. Identifies real signals like pricing changes, product complaints, or leadership churn."

#### Output Structure (plain text report)
1. **Competitor Profile** — overview of the competitor
2. **Stealable Account Segments** — segments with signals (complaints, gaps)
3. **Hard-hitting Objection Handles** — rebuttals to common objections
4. **Battle Card Differentiators** — feature/value comparison
5. **Poaching Sequences** — outreach cadence for competitor accounts

---

### Agent 6: Compliance Oracle

**Purpose:** Audit an outbound message or sequence for global email/outreach compliance laws, then produce compliant rewrites.

**Endpoint:** `POST /api/v1/gtm-agents/compliance-oracle/run`

**Frontend component:** `Frontend/components/ai-agents/compliance-oracle-panel.tsx`

**Model:** `anthropic/claude-3.5-haiku` at `temperature=0.2` (low temperature for legal precision)

#### Request

```json
{
  "message_template": "Hi [First Name], I noticed your team at [Company] has been growing fast. We help companies like yours automate outbound. Worth 15 mins?",
  "jurisdictions": "US, EU, UK, CA"
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `message_template` | string | Yes | — |
| `jurisdictions` | string | No | `"US, EU, UK"` |

Supported laws implicitly covered: GDPR (EU), CAN-SPAM (US), CASL (CA), UK GDPR, and others inferred from jurisdiction list.

#### System Prompt Role
> "Global outbound compliance expert. Audit messages for GDPR, CAN-SPAM, CASL, etc. Be precise but maintain sales effectiveness."

#### Output Structure (plain text report)
1. **Risk Assessment** — overall compliance risk level
2. **Jurisdiction Analysis** — per-jurisdiction breakdown (compliant/non-compliant + why)
3. **Required Changes** — specific edits needed
4. **Compliant Rewrite** — fully rewritten compliant version of the message

---

### Agent 7: Virality Engine

**Purpose:** Design a referral/viral growth loop from a set of champion customers or personas, using psychological triggers.

**Endpoint:** `POST /api/v1/gtm-agents/virality-engine/run`

**Frontend component:** `Frontend/components/ai-agents/virality-engine-panel.tsx`

**Model:** `anthropic/claude-3.5-haiku` at `temperature=0.4`

#### Request

```json
{
  "seed_customers": "Stripe, Figma, Notion",
  "channels": "email, linkedin, slack"
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `seed_customers` | string | Yes | — (comma-separated company/persona names) |
| `channels` | string | No | `"email, linkedin, slack"` |

#### System Prompt Role
> "B2B viral growth engineer. Designs self-propagating referral loops and cascade campaigns. Uses psychological triggers to turn champions into propagators."

#### Output Structure (plain text report)
1. **Champion Profiling** — characteristics of the ideal champion per seed
2. **Viral Loop Design** — mechanics of the referral loop
3. **Referral Hooks** — specific copy/incentive hooks
4. **Cascade Sequence** — step-by-step outreach cascade to propagate

---

### Agent 8: Talent Radar

**Purpose:** Monitor key accounts for executive churn signals (new hires, title changes, job postings) and produce retention playbooks.

**Endpoint:** `POST /api/v1/gtm-agents/talent-radar/run`

**Frontend component:** `Frontend/components/ai-agents/talent-radar-panel.tsx`

**Model:** `perplexity/sonar-pro` (real-time personnel signals)

#### Request

```json
{
  "accounts": "Salesforce, HubSpot, Outreach",
  "lookback_days": 90
}
```

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| `accounts` | string | Yes | — | — |
| `lookback_days` | int | No | `ge=7, le=365` | `90` |

#### System Prompt Role
> "Executive talent analyst. Identifies churn risks by monitoring real-time signals: new leadership hires, job postings, and title changes at specific accounts."

#### Output Structure (plain text report)
1. **Churn Risk Assessment** — per-account risk level
2. **Leading Indicator Signals** — specific signals found in the lookback window
3. **Early Warning Triggers** — threshold-based early warning criteria
4. **Retention Playbook** — recommended actions to retain/re-engage those accounts

---

### Agent 9: Regime Shifter

**Purpose:** Adapt ICP targeting and messaging to macro-economic shifts, geopolitical events, or regulatory changes in a specific geography.

**Endpoint:** `POST /api/v1/gtm-agents/regime-shifter/run`

**Frontend component:** `Frontend/components/ai-agents/regime-shifter-panel.tsx`

**Model:** `perplexity/sonar-pro` (macro-economic research)

#### Request

```json
{
  "geo_focus": "EU SaaS mid-market",
  "scenario": "GDPR enforcement wave"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `geo_focus` | string | Yes | Target geo/market, e.g. "US SaaS", "DACH manufacturing", "APAC fintech" |
| `scenario` | string | No | Optional macro event: "election", "tariffs", "recession", "regulation change" |

#### System Prompt Role
> "Macro-economic GTM strategist. Adapts ICP and messaging to market shifts like regulation changes, economic events, or geopolitical scenarios."

#### Output Structure (plain text report)
1. **Impact Analysis** — how the scenario affects the target geo/market
2. **ICP Adjustments** — which segments to prioritize or de-prioritize
3. **Messaging Pivots** — updated value propositions and pain points
4. **Phased GTM Plan** — time-phased action plan

---

## 9. Frontend API Client Layer

### 9.1 AI Agents Client

**File:** `Frontend/lib/api/ai-agents.ts`

**Base URL:** `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`

```typescript
// All methods are on the aiAgentsApi object

aiAgentsApi.searchProspects(query: string): Promise<AgenticSearchResult[]>
aiAgentsApi.findLookalikeCompanies(seedCompanyIds: string[]): Promise<LookalikeResult[]>
aiAgentsApi.researchCompany(companyName: string, depth: "quick" | "standard" | "deep"): Promise<ResearchResult>
aiAgentsApi.scoreLeads(company: { name, domain?, industry?, country? }): Promise<PredictiveScore[]>
aiAgentsApi.addPipelineCompany(payload: { companyId, companyName, contactName?, similarityScore? }): Promise<any>
```

#### TypeScript Interfaces

```typescript
interface AgenticSearchResult {
  id: string
  companyName: string
  score: number
  reason: string
  industry: string
  employees: string
  location: string
  contactName: string
  title: string
  email: string
  linkedin?: string
  perplexityReason?: string
  perplexityDetails?: string
  perplexityReasoning?: any
}

interface LookalikeResult {
  id: string
  companyName: string
  similarityScore?: number
  matchingFactors?: string[]
  industry?: string
  employees?: string
  location?: string
  revenue?: string
  website?: string
  description?: string
  similarityLabel?: string
}

interface ResearchResult {
  companyName: string
  summary: string
  marketPosition: string
  keyInsights: string[]
  opportunities: string[]
  risks: string[]
  competitors: string[]
  recentNews: string[]
}

interface PredictiveScore {
  id: string
  companyId: string
  companyName: string
  contactName: string
  title: string
  email: string
  score: number                          // 0–100
  conversionLikelihood: number           // 0.0–1.0
  confidence: number                     // 0–100
  prediction: "High" | "Medium" | "Low"
  factors: { name: string; impact: "positive" | "negative" }[]
  guidance: string
  recommendation: string
  profileLink?: string
}
```

---

### 9.2 GTM Agents Client

**File:** `Frontend/lib/api/gtm-agents.ts`

**Base URL:** `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`

**Note:** Uses the full base URL directly, so requests go to `http://localhost:8000/api/v1/gtm-agents/...` in dev.

```typescript
// All methods return GTMAgentRunResponse
interface GTMAgentRunResponse {
  result?: string     // Plain text report
  results?: unknown   // Alternative key for some responses
  [key: string]: any  // Flexible for future agents
}

gtmAgentsApi.runCrossfire({ competitor_domain, target_region?, notes? })
gtmAgentsApi.runComplianceOracle({ message_template, jurisdictions? })
gtmAgentsApi.runViralityEngine({ seed_customers, channels? })
gtmAgentsApi.runTalentRadar({ accounts, lookback_days? })
gtmAgentsApi.runRegimeShifter({ geo_focus, scenario? })
```

Internal `postJson()` utility:
- Calls `${API_BASE_URL}${path}` with `Content-Type: application/json`
- On non-2xx: attempts to parse `payload.detail` or `payload.error` for the error message
- Returns typed promise

---

## 10. Frontend Component Layer

All agent panels live in `Frontend/components/ai-agents/`.

The hub page `Frontend/app/(dashboard)/ai-agents/page.tsx` renders each panel via an `activeAgent.component` tab selector.

| Component File | Agent | Key Inputs | Key Output |
|---|---|---|---|
| `agentic-search-panel.tsx` | Agentic Search | NLP text query | Company cards with signals, contact details, intelligence records; CSV export |
| `research-panel.tsx` | Research | Company name, depth selector | Overview card, news feed, opportunities, risks, competitor list, CSV export |
| `lookalike-panel.tsx` | Lookalike | Seed pool editor (add/remove companies) | Similarity cards with score, factors, "Add to Pipeline" button |
| `predictive-panel.tsx` | Predictive | Company name, domain, industry, country | Lead score cards with propensity badge, signal breakdown, confidence % |
| `crossfire-panel.tsx` | Crossfire | Competitor domain, region, notes | Plain text Crossfire report |
| `compliance-oracle-panel.tsx` | Compliance Oracle | Message template, jurisdictions | Plain text compliance audit + rewrite |
| `virality-engine-panel.tsx` | Virality Engine | Seed customers, channels | Plain text viral growth plan |
| `talent-radar-panel.tsx` | Talent Radar | Accounts, lookback_days (slider) | Plain text churn risk report |
| `regime-shifter-panel.tsx` | Regime Shifter | Geo focus, macro scenario | Plain text GTM adaptation plan |

### Shared UI Patterns Across All Panels
- `useState` for: `loading`, `error`, `output/results`
- Loading state shows `<Loader2 className="animate-spin">` or `SimulatedActivityFeed`
- Error state shows `<AlertCircle>` with error message
- Empty state shows centered icon + description
- GTM agent panels use `extractResultText()` helper to normalize `result` | `results` | first string value from response

---

## 11. Rate Limiting

**Library:** `slowapi` (FastAPI port of Flask-Limiter)

**File:** `Backend/app/core/rate_limiting.py`

**Configured in:** `main.py` via `setup_rate_limiting(app, environment=settings.ENVIRONMENT)`

| Constant | Applied To |
|---|---|
| `RateLimits.SEARCH` | `/search`, `/research`, `/lookalike`, `/predictive` |
| `RateLimits.DEFAULT` | `/pipeline` |

**Critical implementation note:** slowapi requires the Starlette `Request` parameter to be named **exactly `request`** (not `http_request` or any other name). All rate-limited endpoints in `ai_agents.py` follow this pattern:

```python
@router.post("/search")
@limiter.limit(RateLimits.SEARCH)
async def agentic_search(request: Request, body: SearchRequest):
    ...
```

**GTM agents do not currently have rate limiting** at the route level. Consider adding `@limiter.limit` decorators if needed.

---

## 12. Error Handling

### Backend Patterns

| Scenario | Behavior |
|---|---|
| `OPENROUTER_API_KEY` missing | `logger.warning` at startup; requests will fail with 500 |
| OpenRouter HTTP 402 (credit exhaustion) | `HTTPException(402, "OpenRouter error: ...")` bubbles up |
| OpenRouter HTTP 429 (rate limit) | Not explicitly retried in GTM service; raises as 500 |
| Serper HTTP 429 | Retries once with 1s delay; returns `[]` on second failure |
| Tavily unavailable | Returns `{"results": [], "error": "TAVILY_API_KEY missing"}` |
| JSON parse failure from Claude | Retries with repair prompt + `temperature=0.3`; returns `[]` on double failure |
| Redis unavailable | Graceful degradation — pipeline logs warning; endpoint may fail if Redis fully unavailable |
| All route-level exceptions | Caught by generic `except Exception`, logged with `logger.error`, re-raised as `HTTPException(500, "An error occurred...")` — no raw error details exposed to client |

### Frontend Patterns

- `try/catch` around all `fetch` calls
- Non-OK responses attempt `res.json()` for `detail`/`error` fields
- Falls back to `"Request failed with status {N}"` if JSON parse fails
- Error displayed inline in each panel's error state

---

## 13. Environment Variables Required

```bash
# OpenRouter (ALL agents depend on this)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Serper — Agentic Search (Layer 2 and 4 discovery)
SERPER_API_KEY=...

# Tavily — Research Agent real-time search
TAVILY_API_KEY=tvly-...

# Redis — Pipeline cohort storage
REDIS_URL=redis://...

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000    # or Azure backend URL in production
```

---

## 14. File Map

```
Backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── ai_agents.py            ← Route definitions + Pydantic models (AI Agents)
│   │       └── gtm_agents.py           ← Route definitions + Pydantic models (GTM Agents)
│   ├── services/
│   │   ├── ai_agents_service.py        ← Core logic: search, research, lookalike, predictive, pipeline
│   │   └── gtm_agents_service.py       ← GTM logic: crossfire, compliance, virality, talent, regime
│   └── core/
│       ├── rate_limiting.py            ← slowapi limiter setup + RateLimits constants
│       ├── settings.py                 ← Pydantic settings (OPENROUTER_API_KEY, TAVILY_API_KEY, etc.)
│       └── redis.py                    ← RedisManager singleton

Frontend/
├── app/(dashboard)/
│   ├── ai-agents/
│   │   └── page.tsx                    ← Hub page: 9-tab agent selector
│   └── ai-powered-search/
│       └── page.tsx                    ← Alternative NLP-driven search interface
├── components/
│   └── ai-agents/
│       ├── agentic-search-panel.tsx
│       ├── research-panel.tsx
│       ├── lookalike-panel.tsx
│       ├── predictive-panel.tsx
│       ├── crossfire-panel.tsx
│       ├── compliance-oracle-panel.tsx
│       ├── virality-engine-panel.tsx
│       ├── talent-radar-panel.tsx
│       └── regime-shifter-panel.tsx
└── lib/
    └── api/
        ├── ai-agents.ts                ← TypeScript client for /api/v1/ai-agents/*
        └── gtm-agents.ts               ← TypeScript client for /api/v1/gtm-agents/*
```

---

*End of documentation. All endpoints, service logic, request/response schemas, model selections, error patterns, and frontend integration details are covered above.*
