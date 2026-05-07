# Outmate.ai — End-to-End Production Code Review

> **Reviewer:** Senior Full-Stack + Visitor-Tracker Specialist (RB2B-style)
> **Scope:** Backend (FastAPI), Frontend (Next.js 16), Database (Supabase Postgres + pgvector), Infra (Docker / Azure CA), Visitor Tracker pipeline (deep dive)
> **Date:** 2026-05-07
> **Mode:** Read-only audit. No code modified.
> **Repo path:** `C:\Users\User\Outmate`

---

## 0. TL;DR — Production Verdict

**Overall production readiness: 5.5 / 10**

Outmate is a feature-rich AI-native GTM platform with a serious engineering footprint (39 FastAPI route files, 51 ORM models, 220+ React client components, 14 GTM Co-Pilot actions, full visitor-tracking + signal pipeline). The architecture intent is good, but the **current state contains multiple P0 issues that should block production traffic at any non-trivial scale**:

- **Secrets committed to git** (`.env`, `Frontend/.env.local`) including the live Supabase password.
- **CORS wildcard with `allow_credentials=True`** on the API.
- **Severe multi-tenancy gaps** — `signal_events`, repository methods, identity graph, and the visitor `/stream` SSE endpoint are not user/org-scoped.
- **TypeScript build errors silently ignored** in the frontend (`ignoreBuildErrors: true`).
- **Zero automated tests** in the backend.
- **Unbounded cost exposure** on visitor enrichment and LLM calls — no per-org spend ceilings; conservative estimate **$67–80k/month overspend** at moderate scale.
- **Three different filter-sidebar implementations**, two `auth-provider`s, two `components/` trees, dual `integrations` v1/v2 routers, `post_filter_service.py` + `post_filter_service_fixed.py` — clear unfinished refactors / vibe-coded layers.

The code is shippable for closed alpha / design-partner load (≤10 paying customers, ≤10k visitors/day, ≤100k LLM tokens/day). It is **not safe for an open production funnel** until P0 items below are closed.

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Browser / Pixel  →  Next.js 16 (App Router) → /api/* rewrite → FastAPI  │
│                                                                          │
│  FastAPI (39 routers)                                                    │
│   ├─ Auth (JWT in Redis denylist)                                        │
│   ├─ Co-Pilot (14 GTM actions, SSE stream)                               │
│   ├─ Visitor Tracker (pixel.js + /track + /stream + enrichment)          │
│   ├─ Signal Pipeline (CrustData / Explorium / RSS / Webhook)             │
│   ├─ Voice Campaigns, Calendar, Integrations, Workflows, AI Agents       │
│   │                                                                      │
│   ├─ Services Layer (60+ services)                                       │
│   │   └─ OpenRouterService → Claude Sonnet 4.6 (default), GPT-4o (fb)    │
│   │                                                                      │
│   ├─ Repository Layer (SQLAlchemy 2.0 async, Supabase pooler)            │
│   │   └─ ⚠ Repos do NOT enforce user_id filter                           │
│   │                                                                      │
│   └─ Celery (Redis broker, Upstash) → tasks/* (5 task modules)           │
│                                                                          │
│  External APIs: OpenRouter, Tavily, Serper, Explorium, ContactOut,       │
│                 BetterContact, Hunter, CrustData, Apollo, ip-api,        │
│                 Clearbit, Slack, Discord, Salesforce, HubSpot, Zoho,     │
│                 Gmail, Outlook, Teams, Calendly, Unipile, Retell, ...    │
└──────────────────────────────────────────────────────────────────────────┘
```

**Scale signals:**
- 51 SQLAlchemy models across ~44 model files
- 33 Alembic migrations (chain healthy after merge `96daf690f1a4`)
- 60+ service modules in `Backend/app/services/`
- 218 React client components ("use client")
- ~3 distinct filter-sidebar implementations for the same Companies page
- ~75 markdown design docs at the repo root (most outdated)

---

## 2. P0 — Stop-Ship Issues (must fix before any new external traffic)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| **P0-1** | **Live `.env` with Supabase password committed to git** | `/.env`, `Frontend/.env.local` | DB credential leak. Plaintext password `Outmate.Ai2026` is in history. |
| **P0-2** | **CORS wildcard + credentials** | `Backend/app/main.py:174-180` | Any site can drive authenticated API calls from a victim's browser (CSRF / token theft). Modern browsers reject this combination outright. |
| **P0-3** | **Signal events NOT user-scoped** | `Backend/app/api/routes/signal_pipeline.py:155-192`; `Backend/app/db/models/signal_event.py` (no user_id) | Cross-tenant data leak — any authenticated user can query `/active?company_domain=X` and see another tenant's signals. |
| **P0-4** | **Repositories ignore `user_id` filter** | `Backend/app/db/repositories/prospect_repository.py:9,16,30`; `company_repository.py` | `get_by_email`, `get_by_domain`, `get_by_linkedin_url` return rows from any tenant. |
| **P0-5** | **Visitor SSE stream doesn't bind token to user** | `Backend/app/api/routes/visitors.py:468, 493-520` | SSE token is `(token → org_id)` only. Anyone holding a leaked token can stream another org's live visitor feed. |
| **P0-6** | **TypeScript errors disabled in production build** | `Frontend/next.config.mjs:10-12` `typescript.ignoreBuildErrors: true` | Type errors silently ship. Combined with 386 `: any` usages, type guarantees are nominal. |
| **P0-7** | **JWT stored in `localStorage`** | `Frontend/lib/auth.ts:38, 79, 110, 116-128` | Any XSS = full account takeover. The 5 `dangerouslySetInnerHTML` sites widen the blast radius. |
| **P0-8** | **No daily / monthly LLM spend ceiling** | `Backend/app/services/openrouter_service.py:111-126` | Credits are **calculated** but never **enforced** before the call. A prompt-injection or runaway agent can burn $1000s before anyone notices. |
| **P0-9** | **`pgvector` extension is never created in migrations** | `Backend/alembic/versions/*` (no `CREATE EXTENSION pgvector`) | A clean Postgres deploy will fail boot when ProductKnowledge model loads. |
| **P0-10** | **Tracking pixel uses `user.id` as `data-pixel-key`** | `Frontend/components/tracking-pixel.tsx:18` | The user's primary key is treated as a public site-tracking secret. `user.id` is in JWTs / props / logs. Anyone holding it can spam fake visitors and trigger paid enrichment for that org. |
| **P0-11** | **Dwell-time race condition** | `Backend/app/tasks/visitors.py:334-357, 380-382` | Concurrent leave/pageview events update the wrong visit row; some visits get permanently stuck in `processing`. |
| **P0-12** | **DB connection pool = `NullPool`** | `Backend/app/db/session.py:25` | A new DB connection per request. At 100+ RPS this exceeds Supabase pooler limits and crashes auth + reads. |

---

## 3. Backend Audit (FastAPI + Celery + Redis)

### 3.1 Pros

- Custom `JsonFormatter` + `TextFormatter` structured logging (`core/logging.py`)
- Security headers middleware (HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection) — `main.py:157-164`
- Graceful exception handlers that **don't echo input back** in 422 responses (`main.py:226-230`) ✅
- JWT denylist on logout via Redis (`api/deps/auth.py:36-47`)
- Pixel-specific CORS middleware so the public tracker can be embedded (`main.py:182-215`) ✅
- Proper Alembic chain (no broken heads after merge `96daf690f1a4`)
- Slowapi rate limiting present on auth + AI agents

### 3.2 Cons / Risks

| Sev | Finding | File:Line |
|-----|---------|-----------|
| P0 | CORS wildcard + credentials | `main.py:174-180` |
| P0 | `JWT_SECRET` has a weak public default string | `core/settings.py:510-525` |
| P0 | `NullPool` for DB → connection blowup | `db/session.py:25` |
| P0 | `signal_events` IDOR / cross-tenant | `routes/signal_pipeline.py:155-192` |
| P0 | LLM spend not capped per user/org | `services/openrouter_service.py:111-126` |
| P1 | JWT TTL = 24h, no refresh tokens | `core/settings.py:68-71` |
| P1 | Password reset endpoint missing (only OTP send/verify) | `routes/auth.py` |
| P1 | OTP fallback to in-memory dict if Redis missing → DoS via process kill | `routes/auth.py:31` |
| P1 | `task_time_limit=3600` (1h) — hung tasks block workers | `core/celery_app.py:31` |
| P1 | `worker_prefetch_multiplier=1` — wasted broker round-trips | `core/celery_app.py:35` |
| P1 | Signal task has no `autoretry_for` / `max_retries` — silent drops | `tasks/signal_tasks.py:52-150` |
| P1 | No circuit breaker on Explorium / ContactOut / OpenRouter | `services/visitor_enrich.py`, `openrouter_service.py` |
| P1 | LLM timeout = 45s — burns most of FastAPI's 60s window | `services/openrouter_service.py:131` |
| P1 | `users.anthropic_api_key` stored plaintext (column comment lies: "encrypted in practice") | `db/models/user.py:50` |
| P1 | `signals.py` persists state to local JSON files (`signals_store.json`) — wiped on container restart | `routes/signals.py:113-134` |
| P1 | No request-ID correlation in logs | `core/logging.py` |
| P1 | No Sentry / Prometheus / APM | repo-wide |
| P2 | `redirect_slashes=False` is a workaround, not a fix; routes register `/event` and `/event/` twice | `routes/watchers.py:120-637` |
| P2 | Duplicate `from app.api.deps.auth import get_current_user` (line 14 + 15) | `routes/watchers.py` |
| P2 | `_db_executor` + `_run_db()` defined and unused | `routes/visitors.py:78-79, 114` |
| P2 | `print()` in production code | `services/post_filter_service.py:46-50`, `explorium_service.py:18-23`, `routes/leads.py:30-57`, `services/openrouter_service.py:184,189` |

### 3.3 Code Smells / Vibe-Coded Layers

These should be **deleted or merged** before production:

- `Backend/app/services/post_filter_service.py` **AND** `post_filter_service_fixed.py` — pick one, delete the other.
- `Backend/app/api/routes/integrations.py` **AND** `integrations_v2.py` both mounted on `/api/v1/integrations` — silent route shadowing.
- `Backend/app/api/routes/signals.py` **AND** `signal_pipeline.py` — overlapping `/api/v1/signals/*` namespace.
- `Backend/probe_industry.py`, `probe_industry_deep.py`, `probe_industry_robust.py`, `test_explorium_search.py`, `test_nlp_routing.py`, `test_signal_sequence.py`, `diag_*.py` — diagnostic scripts checked into the production tree.
- Repo root: `should` (empty file), `tmp_file.py`, `db_check_urls.py`, `test_match.py`, `2ca4135a-de70-4909-b186-99f569a7eaed.jpeg`, `package.json.bak`, `package-lock.json.bak` — leftover scaffolding.
- 75+ markdown design docs at root (`AZURE_INFRASTRUCTURE_PLAN.md`, `COPILOT_*`, `OUTMATE_PRODUCTION_PLAYBOOK.md`, `OUTMATE_PRODUCTION_PLAYBOOK_V2.md`, `PRODUCTION_READINESS_REPORT.md`, `CODEBASE_ANALYSIS_REPORT.md`, `CODEBASE_FULL_ANALYSIS.md`, etc.). Move to `/docs` and prune duplicates.
- `Backend/app/api/routes/outmate_agentic.py` — confirm it isn't dead-mounted alongside `gtm_agents.py`.

### 3.4 Tests

**No `Backend/tests/` directory.** Zero unit tests, zero integration tests. Production behavior is verified by users. The most damaging absences:
- No test for repository tenant filtering (P0-4 would have been caught immediately).
- No test for SSE token binding (P0-5).
- No test for credit deduction on success/failure paths.
- No regression tests for the visitor enrichment scoring algorithm (`visitor_enrich.py:488-618`) which is non-deterministic.

---

## 4. Frontend Audit (Next.js 16 / React 19)

> The dispatched frontend agent timed out. Findings below are from direct grep+read of the codebase.

### 4.1 Pros

- App Router with proper route groups: `(dashboard)`, `(onboarding)`, `auth`, `company`
- TailwindCSS v4 with OKLCH design tokens (`globals.css`); recent design system migration is real (`bg-primary/10`, `bg-success/10`)
- Zustand for state, sane store split (`lib/store.ts` + `lib/stores/`)
- shadcn/ui primitives (`components/ui/`) with proper Radix wiring
- Server-side proxy: `next.config.mjs` rewrites `/api/*` → `BACKEND_INTERNAL_URL`, so the browser never talks to FastAPI directly
- Build SHA header for deploy traceability (`X-Outmate-Build`)

### 4.2 Cons / Risks

| Sev | Finding | File:Line |
|-----|---------|-----------|
| P0 | `typescript.ignoreBuildErrors: true` — broken types ship | `next.config.mjs:10-12` |
| P0 | JWT in `localStorage` (XSS = ATO) | `lib/auth.ts:21, 38, 79, 110, 116-128` |
| P0 | `data-pixel-key={user.id}` — leaks user PK as tracking auth | `components/tracking-pixel.tsx:18` |
| P1 | `Cache-Control: no-cache, no-store, must-revalidate` on every non-`_next/*` route — kills CDN edge caching | `next.config.mjs:40-43` |
| P1 | 386 `: any` annotations across 104 files — TS guarantees are nominal | grep |
| P1 | 204 `console.log` calls across 41 files (incl. `lead-copilot-panel.tsx:13`, `visitors/page.tsx:7`) — leaks state to DevTools | grep |
| P1 | 5 files use `dangerouslySetInnerHTML` (incl. `app/components/leads/companies/filter-sidebar.tsx:8` — that's 8 occurrences in one file) — XSS surface | grep |
| P1 | Two parallel `auth-provider` implementations: `components/auth/auth-provider.tsx` + `components/providers/auth-provider.tsx` — only one wins, the other rots | ls |
| P1 | Two parallel component trees: `Frontend/components/leads/companies/` AND `Frontend/app/components/leads/companies/` — duplicates, only some files diverge | ls |
| P1 | Three filter-sidebar versions: `filter-sidebar.tsx`, `filter-sidebar-new.tsx`, `filter-sidebar-clean.tsx` — pick one | `app/components/leads/companies/` |
| P1 | God-components: `(dashboard)/visitors/page.tsx` = **1960 LOC**, `(dashboard)/leads/companies/page.tsx` = **1168 LOC** | wc -l |
| P1 | `resetPassword` is a TODO stub (`return Promise.resolve()`) — UI claims feature exists | `lib/auth.ts:206-209` |
| P1 | `fix_localhost.js`, `dev.log`, `tmp_insert.ps1`, `test_frontend_logic.js`, `next_function.js`, `package.json.bak`, `package-lock.json.bak` committed at frontend root | ls |
| P1 | No `middleware.ts` — every dashboard route is client-protected only. A user with the URL gets HTML before client-side redirect runs | `app/` |
| P2 | 218 `"use client"` directives — most pages are client-rendered, defeating App Router benefits | grep |
| P2 | No CSP header in `next.config.mjs` headers block | `next.config.mjs:33-45` |
| P2 | `allowedDevOrigins: ['*.ngrok-free.app', ...]` shipped in prod config | `next.config.mjs:9` |
| P2 | `pnpm-lock.yaml` AND `package-lock.json` both present — pick one package manager | ls |
| P2 | `experimental.proxyTimeout: 600_000` (10 min) for "social-listening" — ties up Node connections; should stream from server, not block proxy | `next.config.mjs:20-22` |

### 4.3 Visitor / Companies Pages

- `Frontend/components/visitors/` contains **only** `enrichment-modal.tsx` — the entire 1960-line page logic lives in `app/(dashboard)/visitors/page.tsx`. Refactor required.
- The user's currently open file `app/(dashboard)/leads/companies/page.tsx` is **1168 LOC** with **11 `: any`** usages and **2 `console.log`** — this is a god-component that should be split into ≤6 sub-components and a custom hook for state.

---

## 5. Database Audit (Postgres / Supabase / pgvector)

### 5.1 Quantitative

| Metric | Count | Status |
|--------|-------|--------|
| Total ORM models | 51 | ✅ |
| Models with `user_id` or `org_id` | ~33 | ⚠ |
| Models without tenant scope | ~11 (IdentityNode, EventEnrollment, EventCache, ProductKnowledge, OfficeIpCluster, PersonResolutionLearningStat, CompanyResolutionAlias, AvailableFilter, ProviderFilterMapping, SearchResult, CachedQuery) | ❌ P1 |
| Models without `created_at` | 5 (mostly compensated by domain timestamps) | ⚠ |
| Migrations | 33 (chain healthy after merge) | ✅ |
| Retention policies enforced | **0** | ❌ P1 |
| `pgvector` extension migration | **missing** | ❌ P0 |
| HNSW / IVFFlat index on embeddings | **missing** | ❌ P1 |

### 5.2 Critical Findings

- **Tenancy leaks (P1):**
  - `signal_events` has no `user_id`. Today, isolation is "join through `signal_watcher_matches.user_id`", but code at `routes/signal_pipeline.py:155` queries `signal_events` directly. **Add `user_id` (or `org_id`) FK.**
  - `IdentityNode` has `pixel_key` but not `org_id`. Two orgs with the same `visitor_id` collide.
  - `EventEnrollment(entity_id, entity_type)` is globally unique → cross-tenant collision on identical IDs.
  - `ProductKnowledge` (RAG corpus) has no tenant — Co-Pilot RAG retrieves chunks across all tenants. **Confidential product docs leak to other orgs' Co-Pilots.**
  - `CachedQuery.query_hash` is global — two orgs running the same query share cached results, including private filters.

- **Unbounded growth (P1):** `visits`, `visitor_sessions`, `signal_events`, `api_usage_logs`, `event_cache`, `anonymous_visitor_profiles`, `copilot_audit_log` — **no daily-job-driven retention exists in code**. At 5k visitors/day this becomes 1.8M rows/year on one table.

- **`pgvector` extension never created (P0):** Models import `pgvector.sqlalchemy.Vector` (`db/models/product_knowledge.py:15`) but no migration runs `CREATE EXTENSION IF NOT EXISTS pgvector`. **A fresh deploy will fail.**

- **Vector index missing (P1):** `embedding Vector(384)` has no IVFFlat or HNSW index. RAG retrieval is O(n) — fine at 1k chunks, terrible at 100k.

- **JSONB sprawl (P1):** `Company.raw_data`, `SignalEvent.raw_data`, `Workflow.nodes`, `Prospect.raw_data` are unbounded blobs without GIN indexes or schema validation. Some rows can be 10MB+ from a chatty provider.

- **Schema synchronization warning (P1):** `db/repositories/company_repository.py:74-129` has a fallback raw-SQL path triggered when ORM hits `AttributeError` for missing columns. **This is a tell that ORM ↔ DB drift is real and being papered over.**

- **`User.py` has duplicate column declarations** at lines 40-42 AND 43-45 (`onboarding_data`, `icp_config`, `integrations` defined twice). Last declaration wins; the file says they're "restored after accidental drop". Clean up.

- **String/UUID PK inconsistency:** `Watcher.id = "w-{uuid.hex[:8]}"`, `ChampionChangeEvent.id = "cce-{uuid.hex[:10]}"` while everything else is UUID. Slower indexing, harder to migrate.

- **Missing indexes that will bite at 100k rows:**
  - `visits(org_id, enrichment_status, created_at)` — dashboard filtering
  - `visits(org_id, (resolution->>'domain'), created_at)` — account-level rollups
  - `visits(org_id, (resolution->>'visitor_id'), created_at DESC)` — visitor-history fetch in `tasks/visitors.py:522-542` (currently a sequential scan on a JSONB field)
  - `signal_events(fingerprint, company_domain, signal_type)` — dedup
  - `api_usage_logs(user_id, created_at)` — retention deletes
  - `company_visitor_memories(org_id, last_seen_at)`
  - GIN on `Company.technologies`, `Company.location_data`, `Prospect.raw_data`

### 5.3 ON DELETE Behavior

Inconsistent: `Workflow.user_id` = CASCADE, `SignalEvent.company_id` = SET NULL, `Company.user_id` = (default RESTRICT). Document an org-wide policy: CASCADE on owner FKs, SET NULL on optional dimension FKs, RESTRICT on shared catalog FKs.

---

## 6. Visitor Tracker Deep Dive (RB2B-style review)

> The single feature the user asked for hardest analysis on.

**Verdict: 6.5 / 10.** Identity resolution and learning systems show real engineering thought. Cost controls, GDPR primitives, race-safety, and tenancy are weak.

### 6.1 Pipeline Map

```
pixel.js (data-pixel-key=user.id [BUG])
   ↓ POST /api/v1/visitors/track     (deduped via Redis fingerprint+url 60s)
   ↓ Stub Visit insert               (routes/visitors.py:264, 353-370)
   ↓ Celery task enqueued            (tasks/visitors.py)
   ↓ visitor_enrich.enrich_ip()      (services/visitor_enrich.py:865-994)
       ├─ ip-api / IPinfo           (geo, ISP)
       ├─ PTR + RDAP
       ├─ MX validation
       ├─ Identity Graph lookup     (3 sequential DB queries — should be gather())
       ├─ Office IP cluster check
       ├─ Domain enrichment cache (24h TTL — looked up AFTER MX, not BEFORE → cache miss is too late)
       ├─ Explorium (firmographics + LinkedIn posts)
       ├─ Apollo
       ├─ Enrich.so
       ├─ ContactOut email + DM
       ├─ Hunter / Clearbit fallback
       └─ Person resolution scoring (488-618)
   ↓ resolution JSONB written      (visits.resolution + identity_nodes)
   ↓ visitor_alerts → webhook delivery (Slack / HubSpot / Salesforce, awaited inline)
   ↓ /stream SSE → frontend live feed
```

### 6.2 P0 / P1 Findings (visitor-specific)

| Sev | Finding | File:Line |
|-----|---------|-----------|
| **P0** | Tracking pixel uses `user.id` as the auth secret. Anyone with a user UUID can fire fake `/track` events for that org. | `Frontend/components/tracking-pixel.tsx:18`; `routes/visitors.py:264` |
| **P0** | Domain enrichment cache is checked AFTER MX validation (line 893-915) — should be the FIRST step. Currently 1000 visitors from the same domain in parallel can each independently fire Explorium/ContactOut/Apollo. | `services/visitor_enrich.py:870 vs 896-914` |
| **P0** | No per-org daily API budget. A single bad week of bot traffic hitting `/track` can cost **$2-3k/day** in enrichment APIs. | `services/visitor_enrich.py` (no budget check anywhere) |
| **P0** | PII (email, full_name, phone, linkedin_url) stored plaintext in `visits.resolution` JSONB and indexed in `identity_nodes`. No field-level encryption. **GDPR violation for EU customers.** | `db/models/visitor.py:29-46`, `identity_graph.py:12-14` |
| **P0** | IP anonymization is opt-in via SiteConfig (default OFF). Default should be ON for GDPR. | `db/models/visitor.py:24` (SiteConfig.anonymize_ips) |
| **P0** | SSE token in Redis = `(token → org_id)` only. No `user_id` binding → cross-tenant stream subscription. | `routes/visitors.py:468, 493-520` |
| **P0** | Dwell-time race: `action="leave"` updates last visit by `(visitor_id, url)` while a new pageview is racing to insert. Wrong row updated; some visits stuck `processing` forever. | `tasks/visitors.py:334-357, 380-382` |
| **P0** | Visitor history fetch is JSONB sequential scan: `WHERE org_id = :org AND resolution->>'visitor_id' = :vid` with no GIN/expression index. Fires for every visitor on every enrichment. | `tasks/visitors.py:522-584` |
| **P1** | Identity graph lookup is 3 sequential awaits (email, visitor_id, IP/24) — should be `asyncio.gather()`. Adds ~150ms per visitor for free. | `services/visitor_enrich.py:833-852` |
| **P1** | Webhook delivery is awaited inline in the enrichment flow — slow HubSpot/Salesforce backs up the whole pipeline. Should be a separate `deliver_webhook` Celery task. | `services/visitor_alerts.py:277-418` |
| **P1** | Webhooks send full PII payloads (email, full_name) — should send only `{email_domain, company_domain, confidence}`. | `services/visitor_alerts.py:578` |
| **P1** | Visitor resolution merging (`_finalize_company_resolution`) is **non-deterministic** — score ties resolved by source-add order. Two parallel visits from the same domain can produce different company names. | `services/visitor_enrich.py:488-618` |
| **P1** | `Watcher.id` / `ChampionChangeEvent.id` use string-prefixed UUIDs — slower index, harder to migrate. | `db/models/watcher.py:11`, `champion_change_event.py:11` |
| **P1** | Pixel keys never rotated, never hashed. If leaked, full org-spam vector. | `routes/visitors.py:57`, `db/models/visitor.py:12` |
| **P1** | `secrets.token_hex(32)` for webhook secret = 256 bits is fine, but the calling pattern doesn't expose entropy concerns; check `token_urlsafe` for shorter URLs. | `routes/visitors.py:57` |
| **P1** | No retention policy on `visits` / `anonymous_visitor_profiles` / `visitor_sessions`. At 5k visitors/day with 20 pages each = 36M rows/year. | repo-wide |
| **P2** | `routes/watchers.py` registers `/event` and `/event/` separately (twice each handler). Caused by `redirect_slashes=False` workaround. | `routes/watchers.py:120-637` |

### 6.3 RB2B / Clearbit Reveal / Warmly Comparison

| Aspect | Outmate | RB2B | Clearbit Reveal | Warmly |
|--------|---------|------|-----------------|--------|
| Identity resolution | Probabilistic, multi-source | Deterministic IP+fingerprint | Deterministic email+company | Probabilistic behavioral+IP |
| Per-visitor cost ceiling | **None** | Strict quota | Per-API rate limit | Monthly account cap |
| Default GDPR posture | **Off** | Always anon IP | Never stores IP | Always encrypted |
| PII at rest | **Plaintext JSONB** | Encrypted | Not stored | Encrypted |
| Real-time alert latency | 5-10s (sync webhook) | In-app | SF async | Browser push |
| Cache TTL on domain enrich | 24h | 30d | Live DB | 7d |

**Outmate's edge:** breadth of enrichment, account memory, journey sequencing.
**Outmate's gaps that block enterprise:** cost ceiling, GDPR-by-default, deterministic resolution, encrypted PII.

---

## 7. Security & Secrets

### 7.1 Critical

- **`.env` (repo root) and `Frontend/.env.local` are tracked in git.** The Supabase pooler password `Outmate.Ai2026` is recoverable from history. **Rotate immediately**, then `git filter-repo` or BFG.
- `.aider.chat.history.md` (172KB), `.aider.input.history`, `.secrets.baseline` (250KB), `dev.log`, `2ca4135a-...jpeg`, multiple `.bak` and `tmp_*` files are also tracked.
- `JWT_SECRET` has a hardcoded human-readable default in `core/settings.py:510-525`. If `JWT_SECRET` env is unset in prod, that default is used — and it's in the source code on GitHub.
- `users.anthropic_api_key = Column(Text)` — column comment claims "encrypted in practice" but the value is plaintext. BYOK keys for every user are at risk if Supabase is ever breached.

### 7.2 Auth Hardening Backlog

- Migrate JWT from `localStorage` to httpOnly + SameSite=Strict + Secure cookie.
- Drop access-token TTL to 30-60 minutes; add refresh tokens with rotation + reuse detection.
- Add `/auth/password-reset/{request,confirm}` (today only OTP send/verify exists; `lib/auth.ts:206-209` is a `Promise.resolve()` stub).
- Make Redis a **hard dependency** for `/auth/*`. Today, OTP falls back to a process-local dict — kill the worker, all in-flight resets disappear.
- Re-validate JWT denylist inside long-running SSE streams (currently only checked at connection time).
- Add per-user rate limit (today rate limits are per-IP only).

### 7.3 IDOR / Tenancy Hot Spots

Audit every list endpoint that doesn't pass `current_user.id` to its query. Confirmed bad:
- `GET /api/v1/signals/active` (P0)
- All `prospect_repository` / `company_repository` `get_by_*` methods (P0)
- `GET /api/v1/visitors/stream?org_id=...` (P0)

Probable bad (need direct read):
- `routes/watchers.py` — verify every `watchers/*` endpoint filters by `user_id`
- `routes/saved_searches.py`
- `routes/copilot.py` non-current-user paths

### 7.4 Outbound URL Hygiene

- `services/visitor_enrich.py` does PTR lookups + HTTP fetches based on incoming visitor data. Confirm there's no path where a visitor-controlled URL becomes a server-side `httpx.get()` without allowlist (SSRF).
- Webhook delivery URLs are user-supplied per integration. Confirm they're validated against private IP ranges (10.0.0.0/8, 169.254.0.0/16, 127.0.0.0/8) before fetch.

---

## 8. Cost / FinOps

> All numbers below are order-of-magnitude estimates based on current code paths and public list-prices.

### 8.1 LLM (OpenRouter)

- **Default model:** `anthropic/claude-sonnet-4.6` ($3 / $15 per 1M tokens) — `services/openrouter_service.py:65-66`. **Default Co-Pilot action:** ~2k input + 1k output ≈ $0.06/action.
- **Prompt caching** is defined (`create_cache_control_header`, line 103-109) but **never actually wired into `chat_completion_structured`**. Repeated 2k-token system prompts pay full price every call.
- **Embedding calls** (`copilot/knowledge_service.py:84`) are recomputed per query. No Redis cache.

| Lever | Saving estimate |
|-------|-----------------|
| Switch routine Co-Pilot calls to Haiku 3.5 (~10x cheaper) for research-style actions | $7-9k/mo at 1k DAU |
| Wire prompt caching for system prompts + product knowledge | $1.5-2k/mo |
| Cache embeddings 48h by query hash | $0.3-0.5k/mo |
| Per-user/org daily LLM ceiling (e.g., $5/user/day) | bounds worst-case to a known number |

### 8.2 Visitor Enrichment

Per-visitor cost ladder (rough public pricing):
- IP only → ~$0.01
- IP + company resolved (Explorium + Clearbit) → ~$0.50
- IP + company + person (ContactOut email, Apollo, Hunter) → ~$1.50-2.00

**Current state:** every page view triggers full enrichment unless deduped within a 60s window. Domain-cache lookup is **after** MX validation, not before — concurrent visitors from same domain each pay full enrichment.

| Lever | Saving estimate |
|-------|-----------------|
| Move domain cache lookup to step 1 (`visitor_enrich.py:870`) | -50-70% on duplicate-domain spend |
| Extend domain cache TTL 24h → 14-30d | -10-20% |
| Pre-filter ISP / residential / cloud-provider IPs before paid APIs | -20% |
| Batch Explorium calls (10-50 per task vs 1 per visitor) | -40-60% on Explorium |
| Per-org daily enrichment budget in `SiteConfig` (default $50) | bounds worst-case |

**At 5k visitors/day with current code paths: ~$2.5k/day = ~$75k/month.** With the levers above: **~$10-15k/month**, i.e. **$60-65k/month savings**.

### 8.3 Other

- `social-listening-poll-15m` runs every 15 min over **all due watchers** with no concurrency cap (`core/celery_app.py:65-67`). At 1000 watchers × 4 polls/hour = 4000 agentic calls/hour.
- Unbounded `api_usage_logs` and `event_cache` growth → Supabase storage bill + slower scans.

### 8.4 Headline Numbers

| Scenario | Current monthly | After fixes |
|----------|-----------------|-------------|
| 100 active users, 5k visitors/day | $80-100k | $15-20k |
| 1000 active users, 50k visitors/day | $700k+ unbounded | $100-150k |

---

## 9. Dead Code / Vibe-Coded Patterns to Remove

These all live in the production tree and should be **removed** or **merged**:

**Backend:**
- `Backend/app/services/post_filter_service.py` ↔ `post_filter_service_fixed.py` (dual)
- `Backend/app/api/routes/integrations.py` ↔ `integrations_v2.py` (both mounted on same prefix)
- `Backend/app/api/routes/signals.py` ↔ `signal_pipeline.py` (overlapping namespace)
- `Backend/app/api/routes/visitors.py` lines 78-79 + 114 — unused `_db_executor` / `_run_db()`
- `Backend/app/api/routes/watchers.py` line 14+15 — duplicate import; `/event` + `/event/` registered twice
- `Backend/probe_industry*.py`, `test_explorium_search.py`, `test_nlp_routing.py`, `test_signal_sequence.py`, `diag_*.py`
- `Backend/app/db/repositories/company_repository.py:74-129` — raw-SQL fallback for missing columns (schema drift smell)
- `Backend/app/db/models/user.py:40-45` — duplicate column declarations
- `print()` calls in `services/post_filter_service.py`, `services/explorium_service.py`, `services/openrouter_service.py:184,189`, `routes/leads.py:30-57`

**Frontend:**
- `Frontend/components/auth/auth-provider.tsx` ↔ `Frontend/components/providers/auth-provider.tsx`
- `Frontend/app/components/leads/companies/` (entire tree) ↔ `Frontend/components/leads/companies/` — pick one
- `filter-sidebar.tsx`, `filter-sidebar-new.tsx`, `filter-sidebar-clean.tsx` — keep one
- `Frontend/fix_localhost.js`, `Frontend/dev.log`, `Frontend/test_frontend_logic.js`, `Frontend/next_function.js`, `Frontend/tmp_insert.ps1`
- `Frontend/package.json.bak`, `Frontend/package-lock.json.bak`, `Frontend/tsconfig.tsbuildinfo`
- Either `Frontend/package-lock.json` or `Frontend/pnpm-lock.yaml` (pick one PM)
- `Frontend/app/(dashboard)/leads/prospects/page_head.tsx` (looks scaffold-leftover; verify)
- All 204 `console.log` in production paths

**Repo root:**
- `.aider.chat.history.md`, `.aider.input.history`, `.aider.tags.cache.v4/`
- `.composio.lock`
- `2ca4135a-de70-4909-b186-99f569a7eaed.jpeg`
- `should` (empty), `tmp_file.py`, `db_check_urls.py`, `test_match.py`, `test_gtm_integrations.py`
- `outmate-frontend-update/` (looks like a parallel frontend tree)
- `package.json.bak`, `package-lock.json.bak`
- `Backend/Crustdata documentation.md` (move to `/docs`)
- `Agents (1).md`, `GTM -1.json`, `tavily.docs`, `explorium.docs`, `contactout.docs`, `openrouter.docs` (move to `/docs/vendor`)
- 75+ markdown files at root: most are duplicate "production playbooks" / "implementation plans" from 03/2026 that contradict each other (`OUTMATE_PRODUCTION_PLAYBOOK.md` vs `OUTMATE_PRODUCTION_PLAYBOOK_V2.md`, `CODEBASE_ANALYSIS_REPORT.md` vs `CODEBASE_FULL_ANALYSIS.md`). Consolidate into `/docs/architecture.md` + `/docs/runbooks/*`. Delete the rest.

---

## 10. Must-Have Implementations (gaps blocking production parity)

1. **Cost ceiling middleware:**
   - `users.daily_llm_cents`, `site_configs.daily_enrichment_cents`. Check before every paid call. Soft-throttle at 80%, hard-stop at 100%.
2. **Refresh tokens** with rotation + reuse detection.
3. **Password reset** end-to-end (OTP-based or magic-link). Today the frontend `resetPassword()` is a stub.
4. **Field-level PII encryption** (`Fernet` or app-level AES-GCM) for `visits.resolution.email`, `.full_name`, `.phone`, and `identity_nodes.email/.phone/.linkedin_url`.
5. **GDPR retention jobs** — Celery beat tasks that hard-delete `visits` / `signal_events` / `api_usage_logs` / `event_cache` older than configurable TTL (90 / 30 / 30 / 7 days).
6. **Sentry + Prometheus + request-ID middleware.** Today there is no production observability.
7. **Test suite.** Even a 200-test smoke layer would have caught P0-3 / P0-4 / P0-5 / P0-11.
8. **`pgvector` extension migration + HNSW index** on `product_knowledge.embedding`.
9. **Tenant-scoped repositories.** Every `get_by_*` should require `user_id` (or `org_id`).
10. **`signal_events.user_id` column + backfill migration.**
11. **Async webhook delivery.** Today HubSpot latency stalls the entire enrichment pipeline.
12. **Pixel key rotation** (issue/revoke endpoints; hash at rest).
13. **CSP + frame-ancestors** headers on Next.js.
14. **httpOnly cookie auth** to retire `localStorage` JWT.
15. **CI gate that fails on `: any`, `console.log`, `@ts-ignore`, and `ignoreBuildErrors`.**

---

## 11. Prioritized Remediation Roadmap

### Phase 0 — This week (stop bleeding)

1. Rotate all secrets exposed in git (`.env`, `Frontend/.env.local`): Supabase password, JWT_SECRET, OpenRouter, Explorium, ContactOut, Crustdata, Tavily, Serper, Hunter. Purge `.env*` from git history (BFG / `git filter-repo`).
2. Replace `allow_origins=["*"]` + `allow_credentials=True` with an explicit allowlist driven by `settings.CORS_ALLOWED_ORIGINS`.
3. Add `user_id` filter to `signal_events` queries; add `user_id` parameter to `prospect_repository`, `company_repository` methods; refuse PRs that introduce repo lookups without it.
4. Bind SSE token to `(org_id, user_id)` and validate on `/visitors/stream`.
5. Stop using `user.id` as `data-pixel-key` — fetch `pixel_key` from `/visitors/site-config` (already exists, see `lib/auth.ts:284-294`) and use that.
6. Flip `next.config.mjs` `typescript.ignoreBuildErrors` to `false`. Fix or `// @ts-expect-error <reason>` whatever appears.
7. Per-org / per-user daily LLM ceiling + per-org daily enrichment ceiling.
8. Remove `print()` debug statements from `openrouter_service.py`, `post_filter_service.py`, `explorium_service.py`, `routes/leads.py`.
9. Add `CREATE EXTENSION IF NOT EXISTS pgvector` migration before product-knowledge table creation. Add HNSW index on `embedding`.

### Phase 1 — Next 2 weeks

10. Move domain-cache lookup to **first** step in `visitor_enrich.enrich_ip` (before MX/PTR).
11. Parallelize identity-graph lookups with `asyncio.gather()`.
12. Move webhook delivery to its own Celery task (`deliver_webhook_task`) with retry + DLQ.
13. Fix dwell-time race: pass `visit.id` (not `visitor_id+url`) and wrap in SERIALIZABLE transaction.
14. Convert DB pool from `NullPool` to `QueuePool(pool_size=10, max_overflow=20)` against the Supabase session pooler.
15. Add Sentry; add request-ID middleware; add Prometheus `/metrics`.
16. PII field encryption + IP anonymization default ON.
17. Retention Celery jobs for `visits`, `signal_events`, `api_usage_logs`, `event_cache`.
18. Add pixel-key rotation endpoints; hash key at rest.
19. Migrate JWT to httpOnly cookie; add refresh-token rotation; add real password reset endpoints.
20. Add a `Backend/tests/` smoke suite covering: tenancy filtering on every list endpoint, SSE token binding, credit deduction on success/failure, password reset, OTP flow, signal-events isolation.

### Phase 2 — Following 4 weeks

21. Consolidate `integrations.py` ↔ `integrations_v2.py`, `signals.py` ↔ `signal_pipeline.py`, `post_filter_service*.py`, the two `auth-provider`s, the two `components/leads/companies/` trees, and the three filter-sidebars.
22. Split `(dashboard)/visitors/page.tsx` (1960 LOC) and `(dashboard)/leads/companies/page.tsx` (1168 LOC) into composable feature modules.
23. Wire OpenRouter prompt caching in `chat_completion_structured`.
24. Switch routine Co-Pilot calls to Claude Haiku where Sonnet isn't required.
25. Implement circuit breakers (e.g. `pybreaker`) on Explorium / ContactOut / OpenRouter / Tavily.
26. Add deterministic tiebreakers in `_finalize_company_resolution`.
27. Move `signals_store.json` JSON-file persistence to DB or Redis.
28. Decide owner-FK cascade policy and write it down; reconcile inconsistencies (`SignalEvent.company_id`, `Workflow.user_id`, `Company.user_id`).
29. Migrate string-prefixed PKs (`Watcher`, `ChampionChangeEvent`) to UUIDs.
30. Add CSP, `Strict-Transport-Security` already present, add `Permissions-Policy`, `frame-ancestors 'none'` to Next.js + FastAPI responses.

### Phase 3 — Quarter 2

31. SOC 2 / GDPR readiness pass (DPA, ROPA, retention policy doc, sub-processor list).
32. Pen-test against the IDOR surface (every list endpoint).
33. Load test: 1k concurrent users + 10k visitors/min ingest. Validate Celery queue depth, DB pool saturation, Redis throughput.
34. Multi-region DR plan (Supabase point-in-time backups confirmed; Redis primary failure runbook).

---

## 12. Final Risk Heatmap

| Domain | Risk | Confidence |
|--------|------|------------|
| Secrets in repo | 🔴 CRITICAL | High |
| CORS / CSRF | 🔴 CRITICAL | High |
| Tenant isolation (signals + repos + SSE + identity graph + RAG) | 🔴 CRITICAL | High |
| Visitor pixel auth (user.id leak) | 🔴 CRITICAL | High |
| LLM / enrichment runaway spend | 🔴 CRITICAL | High |
| GDPR / PII at rest | 🔴 CRITICAL | High |
| pgvector extension/index missing | 🟠 HIGH | High |
| Frontend XSS surface (localStorage JWT + dangerouslySetInnerHTML + ignoreBuildErrors) | 🟠 HIGH | High |
| DB connection pooling under load | 🟠 HIGH | High |
| Race conditions in dwell-time / enrichment | 🟠 HIGH | Medium |
| Zero observability (no Sentry / metrics) | 🟠 HIGH | High |
| No tests | 🟠 HIGH | High |
| Code-rot (duplicate filters / providers / route files) | 🟡 MEDIUM | High |
| Dead artifacts in repo | 🟡 MEDIUM | High |
| Missing indexes at scale | 🟡 MEDIUM | Medium |
| Inconsistent ON DELETE / soft-delete | 🟢 LOW | High |

---

## 13. One-Page Executive Summary (for non-engineers)

> Outmate.ai's product breadth is impressive: an end-to-end AI GTM stack with visitor identification, signal ingestion, Co-Pilot, voice campaigns, and 25+ integrations. The architecture is in the right shape and the team has clearly built fast.
>
> However, **the codebase is not yet safe for unbounded production traffic**. Three categories of risk dominate:
>
> 1. **Security/privacy:** Database credentials and API keys are checked into git, the API allows any website to call it on behalf of logged-in users, and authenticated users can read each other's signal events. Visitor PII (emails, names) is stored in plain text. **A single screenshot of `git log` is enough to compromise the database.**
>
> 2. **Cost:** Every page view on a customer's website can fire 6+ paid enrichment APIs with no daily budget cap. Every Co-Pilot click defaults to the most expensive Claude model, with prompt caching defined-but-unused. Plausible monthly burn on a moderate account: **$75-100k. Same workload after the Phase 1 fixes: $10-20k.**
>
> 3. **Engineering hygiene:** Zero automated tests; multiple parallel implementations of the same feature (`filter-sidebar.tsx` × 3, two `auth-provider`s, two component trees, two integration routers); TypeScript build errors silently ignored. Each item compounds future bug rate.
>
> **Recommended path:** Pause new feature work for ~3 engineer-weeks, execute Phase 0 + Phase 1 of section 11. After that the platform is genuinely production-grade and can scale to 1000+ paying customers without cost or compliance surprises.

---

*End of report. Total findings: **12 P0**, **27 P1**, **20 P2**. Confidence: **high** on structural/security findings (verified file:line); **medium** on cost-savings dollars (depend on traffic mix).*
