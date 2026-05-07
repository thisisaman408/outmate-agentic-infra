# Agentic Infrastructure — Knowledge Transfer

> Internal KT for the Outmate **agentic infrastructure** (the visual flow-builder + agent runtime that ships at `:7860`). This doc is the single source of truth for someone picking the codebase up cold. If something here disagrees with the code, the code wins — but tell whoever you took over from.

---

## 0. Tl;dr

We run **three** processes in dev:

| Process | Port | Code root |
|---|---|---|
| Outmate Backend (FastAPI, business logic, billing, copilot) | `:8000` | `Backend/app/` |
| Outmate Frontend (Next.js dashboard) | `:3000` | `Frontend/` |
| **Agentic Infra** (visual flow-builder + agent runtime) | `:7860` | `src/backend/base/outmate/` + `src/lfx/src/lfx/` |

The agentic infra is a **separate FastAPI app + React SPA** that hosts user-built agent flows. The main backend never invokes agentic flows itself; instead the **frontend deep-links the user into agentic** via an SSO bridge, agentic runs the flow, and pings the main backend back through a system-signed billing webhook to deduct credits.

Both backends share the same Supabase Postgres (different tables) and reuse the same user UUIDs across DBs.

Boot all three: `make dev`. Skip the agentic side: `make dev AGENTIC=0`. Skip the embedding preload (saves RAM, no semantic search): `OUTMATE_SKIP_EMBEDDING_PRELOAD=true make dev`.

---

## 1. Why two backends

Historically the agentic infra was a fork of an OSS visual-flow project, rebranded internally to `outmate` (the package name). It carries its own auth, DB models, telemetry, MCP server, and a 1800+ asset compiled SPA. Rather than fight that, we run it side-by-side with the lean FastAPI backend that owns business logic. Boundaries:

- **Main backend owns**: users, credits, copilot endpoints, voice campaigns, knowledge base, OAuth tokens (Gmail, Calendar), webhooks, billing.
- **Agentic infra owns**: flow CRUD, flow execution, components, vertex/edge graph runtime, global variables (encrypted), flow schedules, MCP servers, deployments.

This split lets us iterate on the dashboard without breaking flow execution, and vice versa.

---

## 2. How to run it

### Local dev (everything)
```bash
make dev                               # all three services
make dev OUTMATE_BACKEND=0             # skip FastAPI
make dev AGENTIC=0                     # skip agentic infra
OUTMATE_SKIP_EMBEDDING_PRELOAD=true make dev   # skip sentence-transformer load
```

The `dev` target lives in `Makefile:291–303`. It just spawns the three processes in parallel under a single trap so `Ctrl+C` cleans them all up.

### Required env vars (agentic side)
Add these to `.env` at repo root (NOT `Backend/.env` — agentic loads the root `.env`):

```bash
# CRITICAL — pin so credentials don't decrypt-fail across restarts (see §10.1)
OUTMATE_SECRET_KEY=<run: python -c "import secrets; print(secrets.token_urlsafe(32))">

# SSO bridge between main backend and agentic
OUTMATE_BRIDGE_SECRET=<shared HS256 secret, same value on both backends>

# Optional
OUTMATE_CORS_ORIGINS=http://localhost:3000,http://localhost:8000
OPENLAYER_API_KEY=<for tracing — completely optional>
```

### Migrations (agentic DB)
```bash
cd src/backend/base/outmate && uv run alembic upgrade head
```
Main backend has its own migrations under `Backend/alembic/`. They are **independent** — both need to be run.

---

## 3. Architecture map

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Frontend (Next)    │        │  User's browser          │
│  :3000              │        └──────────────────────────┘
└─────────┬───────────┘                  │
          │ axios → /api/*               │ top-level navigation
          ▼                              │ to /api/v1/auth/agentic-bridge
┌─────────────────────┐                  │
│  Main Backend       │ ──── 302 ───────▶│
│  :8000              │                  │
│  Backend/app/       │                  ▼
│                     │       ┌──────────────────────────┐
│  - Copilot routes   │       │  Agentic Infra :7860     │
│  - Credits / billing│       │  src/backend/base/outmate│
│  - Auth / OAuth     │◀──────│  + src/lfx/src/lfx       │
│  - Voice campaigns  │ POST  │                          │
│  - Knowledge base   │ /api/v1/billing/agentic-run     │
└──────────┬──────────┘       │  - Flow CRUD             │
           │                  │  - Component runtime     │
           ▼                  │  - Variable encryption   │
┌─────────────────────┐       │  - SSE stream events     │
│  Supabase Postgres  │◀──────│  - MCP servers           │
│  (shared schema-    │       │  - Static SPA assets     │
│   level isolation)  │       └──────────────────────────┘
└─────────────────────┘
```

Both processes hit the same Postgres but write to different tables. User UUIDs are deliberately reused across both DBs so a user row in the main DB and a user row in the agentic DB share the same `id`.

---

## 4. Directory map

### `src/backend/base/outmate/` — agentic FastAPI app

| Path | Role |
|---|---|
| `__main__.py` | CLI entrypoint (`uv run outmate run …`). Boots services, finds free port, launches Uvicorn/Gunicorn. |
| `main.py` | `create_app()` — FastAPI factory. Mounts API router, static SPA, lifespan hooks, CORS. |
| `api/router.py` | Composes all v1/v2 routers under `/api`. |
| `api/v1/` | Most routes. See §6 catalog. Files modified locally: `chat.py`, `flows.py`, `store.py`, `build.py`, `auth_bridge.py`, `integrations.py`. |
| `api/v2/` | New/experimental endpoints (files, MCP, registration, workflow). |
| `agentic/api/` | Lazy-loaded under `/api`; flow run management. |
| `services/` | DI container + singletons (auth, cache, db, session, chat, store, **variable**, storage, state, task, telemetry, tracing, job_queue, jobs, mcp_composer, shared_component_cache). |
| `services/variable/service.py` | DB lookup for encrypted global variables. **Bug landmine — see §10.1.** |
| `services/auth/service.py` | Fernet encrypt/decrypt for credentials. **Silently returns `""` on decrypt failure (line 711).** |
| `services/billing_client.py` | Posts every flow run to main backend `POST /api/v1/billing/agentic-run` (system-signed JWT). |
| `services/database/session.py` | Async SQLAlchemy session. Same `DATABASE_URL` as main backend. |
| `services/tracing/openlayer.py` | Optional Openlayer tracing. Off unless `OPENLAYER_API_KEY` is set. |
| `initial_setup/starter_projects/` | Default flow JSONs imported on first boot. |
| `frontend/` | Compiled SPA (1866 hashed asset files). Served as static at `/`. Don't hand-edit; rebuild via the SPA's own build pipeline. |
| `alembic/` | Agentic-side DB migrations. |
| `helpers/`, `events/`, `inputs/`, `interface/`, `io/`, `load/`, `logging/`, `graph/`, `field_typing/`, `core/`, `custom/`, `cli/`, `base/` | Compatibility layer over the runtime in `src/lfx/`. Most thin re-exports. |

### `src/lfx/src/lfx/` — flow execution runtime

| Path | Role |
|---|---|
| `components/` | 100+ component implementations (LLM, retrieval, memory, embeddings, prompts, tools). |
| `components/gtm_agents/` | **Our custom agents** — see §7 catalog. |
| `components/gtm_agents/_tool_factory.py` | `build_tools_from_keys()` — turns API keys into LangChain `StructuredTool` instances. Implements circuit breaker. |
| `base/agents/agent.py` | `LCToolsAgentComponent` — base class our GTM agents inherit. |
| `base/models/unified_models.py` | LLM provider mapping (`ChatOpenAI`, `ChatAnthropic`, `ChatGroq`, `ChatGoogleGenerativeAIFixed`, `ChatOllama`, `ChatWatsonx`). `get_llm()` instantiates from a `ModelInput` value. |
| `base/models/groq_model_discovery.py` | Hits Groq API, caches available models 24h, falls back to hardcoded list. |
| `custom/custom_component/custom_component.py` | `CustomComponent` base class. Lifecycle, input parsing, variable resolution. |
| `inputs/inputs.py` | All input types. **`SecretStrInput` defaults `load_from_db=True` (line 407).** |
| `interface/initialize/loading.py` | The runtime resolution layer. `update_params_with_load_from_db_fields()` is where variable lookup happens. |
| `services/settings/auth.py` | `AuthSettings` — **defines `SECRET_KEY` field with auto-generation if unset (line 212).** |
| `services/auth/`, `services/cache/`, `services/storage/`, `services/database/` | Service interfaces consumed by the outmate package. |
| `graph/`, `processing/`, `run/`, `schema/` | Flow Graph IR + execution engine. |
| `log/` | Async-aware logger config. |

---

## 5. Boot sequence

When you run `uv run outmate run --frontend-path ... --port 7860`:

1. **`__main__.py:run()`** (lines 182–437) — 7-step CLI bootstrap.
2. Settings service loads `.env` from cwd → builds `Settings` Pydantic model.
3. **CRITICAL field validator** at `src/lfx/src/lfx/services/settings/auth.py:212`:
   - If `OUTMATE_SECRET_KEY` is set in env → use it, write to `<CONFIG_DIR>/secret_key`.
   - Else if `<CONFIG_DIR>/secret_key` file exists → load from file.
   - Else → generate `secrets.token_urlsafe(32)`, write to file.
   - `CONFIG_DIR` defaults vary by platform — if it shifts (different cwd, cleared cache), the secret rotates and **all stored credentials become un-decryptable**. See §10.1.
4. Port-availability check; auto-finds free port if `:7860` is taken.
5. Uvicorn (Windows) or Gunicorn `OutmateApplication` (Unix) launches `outmate.main:create_app`.
6. `create_app()` (main.py:436+) registers lifespan, mounts routers, mounts SPA at `/`, sets CORS.
7. **Lifespan startup** (main.py:148–433):
   - Blocking: settings, DB migrations, superuser bootstrap, bundle loading.
   - Background (releases port immediately): LLM caching, telemetry, MCP composer, agentic global variables import, flow loading, queue service, MCP servers, flow scheduler.
8. Health check at `/health` — `make dev` waits for this before printing the banner.

---

## 6. API surface (`/api/v1/...`)

All v1 routers are composed in `api/v1/__init__.py`. Hot routers:

| Route prefix | File | Purpose |
|---|---|---|
| `/auth/login` | `v1/login.py` | OAuth2 password login (creates `access_token_lf` + `refresh_token_lf` cookies). |
| `/auth/bridge` | `v1/auth_bridge.py` | **SSO entry from main backend (§9).** Validates `OUTMATE_BRIDGE_SECRET`-signed JWT, auto-provisions agentic User row, sets cookies, 302 to `next`. |
| `/flows` | `v1/flows.py` | Flow CRUD, versioning. **Locally modified — has a known race condition guard, see §10.4.** |
| `/build/{flow_id}` | `v1/build.py` | Compiles flow → vertices, returns build job. **Locally modified — billing client posting + traceback workaround, see §10.6.** |
| `/build/{flow_id}/vertices/{id}` | `v1/build.py` | Builds a single vertex. SSE-streams events. |
| `/chat` | `v1/chat.py` | Chat UI endpoint (SSE). **Locally modified — log-level demotion.** |
| `/store/...` | `v1/store.py` | Store/marketplace (locally modified). |
| `/variables` | `v1/variables.py` | Global variables CRUD — credentials and generic. **Where you create `GROQ_API_KEY` etc.** |
| `/api_key` | `v1/api_key.py` | User API keys (long-lived, stored in DB). |
| `/users` | `v1/users.py` | User management. |
| `/files`, `/files/...` | `v1/files.py`, `v2/files.py` | Upload / download. |
| `/folders`, `/projects` | `v1/folders.py`, `v1/projects.py` | Workspace organization. |
| `/knowledge_bases` | `v1/knowledge_bases.py` | KB management. |
| `/integrations` | `v1/integrations.py` | Third-party integrations (locally modified). |
| `/mcp`, `/mcp_projects` | `v1/mcp.py`, `v1/mcp_projects.py` | Model Context Protocol server. |
| `/openai_responses` | `v1/openai_responses.py` | OpenAI-compatible response shape (for clients expecting the OpenAI API). |
| `/voice_mode` | `v1/voice_mode.py` | Voice I/O. |
| `/models`, `/model_options` | `v1/models.py`, `v1/model_options.py` | LLM provider catalog. |
| `/monitor`, `/traces` | `v1/monitor.py`, `v1/traces.py` | Execution traces, telemetry. |
| `/deployments`, `/flow_version`, `/flow_schedules` | Self-explanatory. `flow_schedules.py` is currently **untracked / unfinished**. |
| `/starter_projects` | `v1/starter_projects.py` | Default starter flows. |
| `/endpoints` | `v1/endpoints.py` | Public flow endpoints (deployed flows callable as APIs). |
| `/validate` | `v1/validate.py` | Flow JSON schema validation. |

Agentic-specific routes (lazy-loaded):
- `agentic/api/router.py`, `agentic/api/runs.py` — flow run lifecycle.

---

## 7. Components and GTM agents

### Component anatomy

A **Component** is a class that subclasses `CustomComponent` (or one of the LangChain-aware bases like `LCModelComponent`, `LCToolsAgentComponent`). Pattern:

```python
class HyperPersonalisationAgentComponent(LCToolsAgentComponent):
    display_name = "Hyper-Personalisation Agent"
    icon = "mail"
    name = "HyperPersonalisationAgent"

    inputs = [
        *LCToolsAgentComponent.get_base_inputs(),
        ModelInput(name="model", display_name="Language Model", real_time_refresh=True, required=True),
        SecretStrInput(name="api_key", display_name="API Key", advanced=True),     # ← load_from_db=True
        SecretStrInput(name="tavily_api_key", advanced=True),
        # ...
    ]

    outputs = [Output(name="response", method="run_agent")]

    async def run_agent(self) -> Message: ...
```

Key files for understanding the model:
- `src/lfx/src/lfx/custom/custom_component/custom_component.py:43–653` — `CustomComponent` base.
- `src/lfx/src/lfx/base/agents/agent.py` — `LCToolsAgentComponent`.
- `src/lfx/src/lfx/inputs/inputs.py` — every `*Input` type. Note `SecretStrInput.load_from_db: CoalesceBool = True` (line 407) — this is the trigger for variable resolution.

### GTM agents catalog (`src/lfx/src/lfx/components/gtm_agents/`)

| Component | Purpose |
|---|---|
| `champion_tracker_agent.py` | Tracks champion engagement signals. |
| `crm_autofill_agent.py` | Auto-populates CRM fields from prospect data. |
| `hyper_personalisation_agent.py` | Writes hyper-personalised cold emails using research tools. |
| `icp_builder_agent.py` | Builds an ICP from existing customer data. |
| `icp_scoring_agent.py` | Scores prospects against the ICP. |
| `intent_signal_agent.py` | Detects buying-intent signals. |
| `lead_discovery_outreach_agent.py` | Discovers leads and runs outreach. |
| `linkedin_outreach_agent.py` | LinkedIn-specific outreach. |
| `meeting_prep_agent.py` | Pre-meeting research briefing. |
| `outbound_campaign_agent.py` | Manages outbound campaigns. |
| `outmate_voice_call.py` | Voice-call integration (Retell). |
| `prospect_research_agent.py` | Researches a prospect across the web. |
| `reply_handler_agent.py` | Handles inbound replies. |
| `tam_discovery_agent.py` | TAM discovery. |
| `team_finder_agent.py` | Finds decision-maker teams. |
| `voice_outreach_agent.py` | Voice-driven outreach. |
| `waterfall_enrichment_agent.py` | Cascading enrichment across providers. |
| `_tool_factory.py` | **Shared.** Turns API keys into `StructuredTool`s — see below. |

### Tool factory (`_tool_factory.py`)

`build_tools_from_keys(...)` returns a list of `StructuredTool`s based on which keys are non-empty. Implementation details:

- **DuckDuckGo** (lines 47–68) — free, no key. Wrapped for resilience.
- **Tavily** (74–134) — needs `tavily_api_key`. 5–10 results, time/domain filters.
- **Apollo Org / People Enrichment** (164–344) — needs `apollo_api_key`.
- **Hunter Email Finder** (567+) — needs `hunter_api_key`.
- **PDL, NeverBounce, SendGrid** — same pattern.
- **Circuit breaker** (20–40): if a tool throws once, it's disabled for the rest of the run. Prevents the agent from wasting iterations retrying a broken tool.

**Important fallback semantics**: every tool builder checks `if not api_key or not api_key.strip(): return None`. When a credential decrypts to `""` (see §10.1), the tool *silently disappears* — no error, no warning. That's why `Apollo`, `Hunter`, `Tavily` etc. just stop being callable when SECRET_KEY rotates.

### Unified LLM resolution

`get_llm()` in `src/lfx/src/lfx/base/models/unified_models.py:1328–1477`:

1. Reads `model[0]["provider"]` from the `ModelInput` value.
2. Looks up `model_provider_metadata` (provider → `{api_key_param, model_class, model_name_param, ...}`).
3. Resolves API key via `get_api_key_for_provider()` (component input → DB variable → env var fallback).
4. Imports and instantiates the model class:
   ```python
   "ChatOpenAI":   ("langchain_openai",   "ChatOpenAI",   None),
   "ChatAnthropic":("langchain_anthropic","ChatAnthropic",None),
   "ChatGroq":     ("langchain_groq",     "ChatGroq",     None),
   "ChatOllama":   ("langchain_ollama",   "ChatOllama",   None),
   "ChatGoogleGenerativeAIFixed": (..., "ChatGoogleGenerativeAIFixed", "langchain-google-genai"),
   "ChatWatsonx":  ("langchain_ibm",      "ChatWatsonx",  None),
   ```

---

## 8. Variable & credential system (read this carefully)

This is the most error-prone subsystem. Trace of how `SecretStrInput(name="api_key", value="GROQ_API_KEY")` becomes a real key at runtime:

1. **Field declaration** — `SecretStrInput` defaults `load_from_db=True`. The flow JSON stores the **variable name** `"GROQ_API_KEY"`, not the value. (`src/lfx/src/lfx/inputs/inputs.py:407`)
2. **Param handler** collects every `load_from_db` field on a vertex into a list. (`src/lfx/src/lfx/graph/vertex/param_handler.py:118+`)
3. **Loading layer** — `update_params_with_load_from_db_fields()` is called before `build()`. (`src/lfx/src/lfx/interface/initialize/loading.py:238+`)
4. For each field: `await custom_component.get_variable(name="GROQ_API_KEY", field="api_key", session=session)`.
5. **DB query** — `select(Variable).where(Variable.user_id == user_id, Variable.name == "GROQ_API_KEY")`. Fails with `ValueError("variable not found.")` if missing. (`src/backend/base/outmate/services/variable/service.py:179–217`)
6. If `Variable.type == CREDENTIAL`, decrypt via `auth_utils.decrypt_api_key(variable.value)`. If `GENERIC`, return as-is.
7. **Decrypt** — Fernet AES with `SECRET_KEY` from settings. (`src/backend/base/outmate/services/auth/service.py:670–711`)
   - If the blob doesn't start with `gAAAAA` → returns the string verbatim (treated as plaintext).
   - If decrypt throws → **silently returns `""`** (line 711). No exception bubbles up.
8. **Fallback** — if DB lookup raised `variable not found.` and `fallback_to_env_var=True` (default in settings), try `os.getenv("GROQ_API_KEY")`. (`src/lfx/src/lfx/interface/initialize/loading.py:114–137`)
9. The resolved key is set as the param value. `ChatGroq(api_key=<resolved>)` is invoked.

### Implications you must internalise

- **Variable type matters.** Credentials are encrypted at rest; Generic variables are plaintext. If you save an API key as Generic, anyone with DB read can see it.
- **Variable names are case-sensitive.** `GROQ_API_KEY` ≠ `groq_api_key` ≠ `Groq`.
- **Variables are scoped per user.** A variable created by user A can't be used by user B's flow run. The SSO bridge (§9) reuses user UUIDs across DBs, so this Just Works as long as the variable is created in the agentic side under the same user ID.
- **Silent decryption failure is the #1 source of "invalid API key" errors.** See §10.1.

---

## 9. Integration with the main Outmate backend

### 9.1 SSO bridge

Shared secret env: `OUTMATE_BRIDGE_SECRET` (HS256, identical on both backends).

Flow:

1. User clicks something in the dashboard that needs the agentic UI.
2. Frontend calls `agenticBridgeUrl(next)` from `Frontend/lib/agentic-bridge.ts`. It reads the user's main JWT from localStorage and builds:
   ```
   GET http://localhost:8000/api/v1/auth/agentic-bridge?next=<path>&auth=<jwt>
   ```
3. Main backend (`Backend/app/api/routes/auth.py:171–267`) validates the user JWT and mints a 60-second bridge JWT:
   ```json
   { "sub": user_id, "email": ..., "name": ..., "type": "outmate_bridge",
     "exp": now+60s, "iat": now, "jti": <uuid> }
   ```
   Signs with `OUTMATE_BRIDGE_SECRET`. Redirects to:
   ```
   GET http://localhost:7860/api/v1/auth/bridge?token=<jwt>&next=<path>
   ```
4. Agentic side (`src/backend/base/outmate/api/v1/auth_bridge.py:86–195`) validates JWT.
5. **Auto-provision** (line ~131): if `User(id=user_id)` doesn't exist on the agentic DB, create it now with the same UUID as the main DB. This is why both DBs share user IDs.
6. Sets cookies:
   - `access_token_lf` — agentic's normal access token (signed with agentic's `SECRET_KEY`, **not** the bridge secret).
   - `refresh_token_lf` — 7-day refresh.
   - `apikey_tkn_lflw` — only if user has an agentic-side API key.
7. 302 to `next`.

After this, the browser carries `access_token_lf` to `:7860` automatically; agentic API requests authenticate without further negotiation.

### 9.2 Billing webhook (reverse direction)

After every flow / vertex build, agentic posts to the main backend:

```
POST http://localhost:8000/api/v1/billing/agentic-run
Header: X-Outmate-System: <system JWT, type="outmate_system", signed with OUTMATE_BRIDGE_SECRET>
Body: { user_id, flow_id, run_id, success, duration_ms, tokens_input, tokens_output, model, error_message }
```

- **Sender**: `src/backend/base/outmate/services/billing_client.py:56–111` — fire-and-forget, swallows local errors. **Bug landmine — see §10.2.**
- **Receiver**: `Backend/app/api/routes/agentic_billing.py:47–87` — validates token, deducts 1 credit on `success=True`, writes `CreditTransaction` + `AgentRun` rows.

Pricing today is flat (1 credit per successful run). v2 plan: token-aware pricing. Failed runs are free.

### 9.3 Shared database

- Both processes connect to the same Supabase Postgres via `DATABASE_URL` env.
- They write to **disjoint tables** — agentic uses its own schema (`flow`, `vertex_build`, `variable`, etc.); main backend uses its own (`users`, `credit_transaction`, `agent_run`, etc.).
- **User UUIDs are deliberately reused** across both DBs so cross-process joins / lookups by user_id Just Work.
- Agentic's `Variable.user_id` FK assumes the same user exists on the agentic side — auto-provisioned via the SSO bridge.

### 9.4 Frontend access

The Next.js frontend talks to the main backend (`:8000`) for everything except agentic UI navigation. For agentic pages it uses `Frontend/lib/agentic-bridge.ts`:

- `agenticBridgeUrl(next)` — builds the bridge URL.
- `openAgenticFlow(flowId)`, `openAgenticHome()` — top-level navigation helpers.

Bridge happens via top-level navigation, not fetch — fetch can't set Authorization headers across origins reliably, so the JWT goes in the query string for the bridge step only.

---

## 10. Known bugs and pitfalls (the meat)

### 10.1 SECRET_KEY rotation kills all stored credentials [CRITICAL]

**Symptom**: every API-key-using component (Groq, Tavily, Apollo, Hunter, etc.) suddenly returns 401 / "Invalid API Key" or behaves as if the credential isn't set, even though the global variable is clearly visible in Settings.

**Cause**:
- `OUTMATE_SECRET_KEY` is not pinned in `.env`.
- `src/lfx/src/lfx/services/settings/auth.py:212` auto-generates a key if missing, persists it to `<CONFIG_DIR>/secret_key`.
- If `CONFIG_DIR` shifts (different cwd, cleaned cache, container restart with ephemeral FS), a **new** key is generated.
- `src/backend/base/outmate/services/auth/service.py:711` swallows the resulting Fernet decryption failure and **returns empty string**.
- `ChatGroq(api_key="")` → 401.

**Fix**: pin `OUTMATE_SECRET_KEY` permanently in `.env`. After pinning, **re-create every credential global variable** in Settings → Global Variables (the old encrypted blobs are dead weight encrypted under the rotated key).

**Better fix (TODO)**: change `decrypt_api_key` to log an error and re-raise, not return `""`. Silent empty strings make this nearly impossible to diagnose.

### 10.2 Billing webhook silently swallows everything [HIGH]

`src/backend/base/outmate/api/build.py:294–299`:
```python
try:
    from outmate.services.billing_client import record_agentic_run
    ...
except Exception:  # noqa: BLE001
    pass  # Imports / kwargs mismatch shouldn't kill telemetry — log later.
```

If the billing client can't import or its signature drifts, **no credits are deducted** and there is no error in the logs. Revenue leak. Fix: at minimum `logger.exception(...)`; ideally fail closed in dev and alert in prod.

### 10.3 Worker SIGKILL (OOM) under load [HIGH]

Default Gunicorn workers load the full sentence-transformer embedding model into memory. Under any concurrent load this OOMs and the worker is `SIGKILL`-ed.

Visible in logs as:
```
Worker (pid:NNNNN) was sent SIGKILL! Perhaps out of memory?
... unhandled error: no running event loop
```

The "no running event loop" line is collateral damage from the SIGKILL — the next request hits a half-initialised worker.

**Mitigation today**: `OUTMATE_SKIP_EMBEDDING_PRELOAD=true make dev` skips the preload (Backend/app/main.py:586). Cuts the memory footprint dramatically; cost is that semantic search uses lazy loading on first request.

**Real fix (TODO)**: move the embedding model out of the agentic worker process entirely. Run it as a separate inference service so the agentic workers stay slim.

### 10.4 Flow autosave race condition [MEDIUM]

`src/backend/base/outmate/api/v1/flows.py:480–535` — recently added guard against the React client autosaving with stale state, which would clobber the server's edges with `[]` and nullify `endpoint_name`. Workaround:
- Drop the update if `incoming_edges < db_edges` AND `incoming_nodes >= 4` (heuristic).
- Don't overwrite `endpoint_name` on routine saves.

Debug `[FLOW_PATCH]` logging (line 481–497) is left on in production. Either gate it behind a debug flag or strip it once the root cause is fixed in the frontend.

**Real fix (TODO)**: optimistic concurrency via `If-Match` / `If-Unmodified-Since` against a flow version number, instead of trusting the body verbatim.

### 10.5 CORS permissive defaults [MEDIUM]

`src/backend/base/outmate/main.py:141–145` warns on startup:
```
CORS: Using permissive defaults (all origins + credentials).
Set OUTMATE_CORS_ORIGINS for production. Stricter defaults in v2.0.
```

`allow_credentials=True` + `allow_origins=["*"]` together violate the CORS spec; some browsers refuse, others leak the credential. **Set `OUTMATE_CORS_ORIGINS` explicitly before any deploy that's not local dev.**

### 10.6 Logging traceback workaround [LOW–MEDIUM]

`src/backend/base/outmate/api/build.py:258–266` manually formats tracebacks because `aexception` emits the trace as a separate structured field which "some log frontends drop". Indicates a structured-logging pipeline misconfiguration. Either fix the pipeline or accept this workaround long-term — but document why next to the comment.

### 10.7 Background-task draining bug [LOW–MEDIUM]

`src/backend/base/outmate/api/build.py:397–408` — switched from FastAPI `BackgroundTasks.add_task()` to bare `asyncio.create_task()` because background tasks were draining before the job-queue completed, leaving streamed agent runs without their final log entries. Comment explains the symptom (Outcome tab always empty for streaming agents). Working as intended now, but the choice is fragile — if anything later relies on `BackgroundTasks` semantics for these, double-check.

### 10.8 Component-search swallows errors [HIGH]

`src/backend/base/outmate/agentic/utils/component_search.py:99–101`:
```python
except Exception as e:  # noqa: BLE001
    await logger.aerror(f"Error listing components: {e}")
    return []
```

UI shows "no components" instead of a real error message. Users assume the catalog is empty; in reality it's a missing import or DB query failing. Fix: differentiate "empty catalog" from "lookup error" in the response.

### 10.9 Event consumer silently ignores disconnect failures [HIGH]

`src/backend/base/outmate/agentic/services/helpers/event_consumer.py:59–60`:
```python
except Exception:  # noqa: BLE001, S110
    pass  # Intentionally ignore disconnection check failures
```

If the disconnection probe itself crashes, the agent keeps streaming to a dead client — wasting LLM tokens, holding open connections. Fix: log the failure and break the loop after N consecutive probe errors.

### 10.10 `mcp_projects.py` TODO: stateless mode toggle [LOW]

```python
# TODO: implement an environment variable to enable/disable stateless mode
```
Stateless behavior is hardcoded; no runtime toggle for migrations or debugging.

### 10.11 Schema serializer max-length bypass [LOW]

`src/backend/base/outmate/api/v1/schemas/__init__.py`:
```python
# return serialize(data, max_length=get_max_text_length())  # TODO: Safe?
```
Commented-out `max_length` enforcement. Responses are unbounded — large flow runs can return huge JSON payloads. Could blow up clients or memory.

### 10.12 Upstash Redis quota exhaustion [INFRA]

Free tier is 500k requests/month. The auth denylist check fires on every authenticated request, which burns the quota fast. When exhausted:
```
Redis denylist check failed: max requests limit exceeded. Limit: 500000, Usage: 500000
```
Auth still works (fails open) but token revocation no longer enforced. Either upgrade the Upstash plan or move denylist to Postgres.

### 10.13 `.env` location confusion [PITFALL]

The agentic process reads `.env` from the **repo root**, not from `Backend/`. Adding `OUTMATE_SECRET_KEY` etc. to `Backend/.env` will not affect it. Verified: only `/.env` is loaded by `outmate run`.

### 10.14 Untracked / unfinished files [PITFALL]

These files have local modifications or are new and uncommitted at time of writing:
- `src/backend/base/outmate/api/build.py` — billing client + traceback workaround + bg-task fix.
- `src/backend/base/outmate/api/v1/flows.py` — autosave race-condition guard.
- `src/backend/base/outmate/api/v1/chat.py` — log-level demotion.
- `src/backend/base/outmate/api/v1/auth_bridge.py`, `integrations.py`, `flow_schedules.py` — newly added/modified.

Before doing a big refactor in `api/`, `git status` and decide what to land vs. revert.

---

## 11. Common tasks

### Add a new GTM agent

1. Drop a new file under `src/lfx/src/lfx/components/gtm_agents/your_agent.py`.
2. Subclass `LCToolsAgentComponent`. Declare `inputs` (use `SecretStrInput` for keys, `ModelInput` for the LLM, `MessageTextInput` / `MultilineInput` for prompts).
3. Implement `run_agent()` returning a `Message`.
4. Tools come from `build_tools_from_keys(...)` in `_tool_factory.py`.
5. Re-register in `gtm_agents/__init__.py` if there's an explicit registry there.
6. Restart agentic. The component appears in the UI under the GTM Agents category.

### Add a new tool to the tool factory

1. Add a builder function in `_tool_factory.py` that returns a `StructuredTool`.
2. Gate on the relevant API key being non-empty.
3. Add the API key as a `SecretStrInput` on every agent that uses the tool.
4. Wire it into the call inside the agent's `run_agent()` (typically threaded through `build_tools_from_keys`).

### Add a new global variable type

Variables today are `CREDENTIAL` (encrypted) or `GENERIC` (plain). Rarely do you need a new type — prefer encoding structure inside the value (JSON string in a Generic) before adding a new enum.

### Debug a flow that 401s on an LLM call

1. Check global variable exists for the current user: open Settings → Global Variables in the agentic UI.
2. Confirm `OUTMATE_SECRET_KEY` is pinned in `.env` (not blank, not changed since the variable was created).
3. Look for `API key decryption failed after retry` in agentic logs — that's the smoking gun for §10.1.
4. If you see it: re-create the variable, restart agentic.

### Add a new API route

1. Pick `api/v1/` (mature) or `api/v2/` (new).
2. Create the router file. Add `router = APIRouter(prefix="/your-route", tags=["your-route"])`.
3. Register it in `api/v1/__init__.py` (or `v2/__init__.py`).
4. Auth: depend on `get_current_active_user` from the auth deps module.
5. DB: `async with session_scope() as session: ...`.

---

## 12. Reading roadmap (in this order, if you're new)

1. `Makefile:291–303` — see how the three services boot together.
2. `src/backend/base/outmate/__main__.py` and `main.py` — agentic boot sequence.
3. `src/backend/base/outmate/api/v1/__init__.py` — every API surface in one place.
4. `src/backend/base/outmate/api/v1/auth_bridge.py` + `Backend/app/api/routes/auth.py` (search for `agentic-bridge`) — the SSO seam.
5. `src/lfx/src/lfx/inputs/inputs.py:393–407` and `src/lfx/src/lfx/interface/initialize/loading.py:114–137` and `src/backend/base/outmate/services/variable/service.py:195–217` and `src/backend/base/outmate/services/auth/service.py:670–711` — the variable resolution chain end to end. Study this; most production fires originate here.
6. `src/lfx/src/lfx/components/gtm_agents/hyper_personalisation_agent.py` — the canonical custom agent.
7. `src/lfx/src/lfx/components/gtm_agents/_tool_factory.py` — tool patterns + circuit breaker.
8. `src/lfx/src/lfx/base/models/unified_models.py:1328–1477` — `get_llm()` provider resolution.
9. `src/backend/base/outmate/services/billing_client.py` — billing webhook to main backend.
10. `Backend/app/api/routes/agentic_billing.py` — the receiver side.

After this you can pretty much navigate the codebase on your own.

---

## 13. Open work / recommended next steps

In priority order:

1. **Fix `decrypt_api_key` to fail loud, not silent** (§10.1). Single most-impactful change. Add a feature flag `OUTMATE_STRICT_DECRYPT=true` if you're worried about regressing prod.
2. **Move embedding model to a separate inference service** (§10.3). The OOMs only get worse as concurrent load grows.
3. **Replace billing-webhook bare except with proper logging + retry** (§10.2).
4. **Land the autosave race-condition fix properly** with optimistic concurrency, retire the heuristic guard (§10.4).
5. **Migrate Redis denylist to Postgres** (§10.12). Upstash's free tier is not viable for this hot path.
6. **Set `OUTMATE_CORS_ORIGINS` in every non-local deploy** (§10.5). Don't ship to staging without it.
7. **Strip `[FLOW_PATCH]` debug logging** from `flows.py` once #4 is done.
8. **Gate or implement the `serialize(..., max_length=...)` cap** (§10.11).
9. **Fix component-search to distinguish empty from error** (§10.8).
10. **Triage the `mcp_projects.py` stateless-mode TODO** (§10.10).

Anything not on this list is fine to ignore for now.
