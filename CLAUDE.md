# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Start dev server (Windows: always kill zombie Python processes first)
taskkill //IM python.exe //F 2>/dev/null; cd Backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Install dependencies (always use uv pip, not pip)
pip install uv && cd Backend && uv pip install -r requirements.txt

# Run database migrations
cd Backend && alembic upgrade head
alembic revision --autogenerate -m "description"  # auto-detect model changes

# Kill port 8000 if stuck (Windows)
taskkill //PID $(netstat -ano | grep :8000 | awk '{print $5}') //F
```

### Frontend
```bash
cd Frontend && npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

### Makefile (from repo root)
```bash
make init            # Install all deps
make run_backend     # Start backend
make run_frontend    # Start frontend
make tests           # Run all tests
make format          # Format code
```

## Architecture

### Monorepo Layout
```
Outmate_repo/
├── Backend/app/      # FastAPI application root
│   ├── api/routes/   # HTTP endpoint handlers
│   ├── services/     # Business logic (including copilot/)
│   ├── db/models/    # SQLAlchemy ORM models
│   ├── db/repositories/ # Data access layer
│   ├── schemas/      # Pydantic DTOs
│   ├── core/         # Config, Redis, Celery, middleware
│   └── tasks/        # Celery async tasks
└── Frontend/
    ├── app/          # Next.js App Router pages
    ├── components/   # Feature + UI components
    ├── hooks/        # Custom React hooks
    └── lib/api/      # Axios API client services
```

### Backend Patterns
- **Import config** as `from app.core.config import settings` (not `app.core.settings`)
- **Layered arch**: Route handler → Service → Repository → Model. Keep business logic in services, not routes.
- **Dependency injection**: `get_current_user()` in `app/api/deps/auth.py`, `get_db()` in `app/db/deps.py`
- **Credit system**: Routes check/deduct credits via `get_user_credits()` / `deduct_credits()` before expensive operations
- **LLM calls**: All LLM access goes through `OpenRouterService` in `app/services/openrouter_service.py`
- **Async pattern**: Services are async; use `asyncio.gather()` for concurrent external API calls
- **Settings**: All env vars typed in `app/core/settings.py` as a Pydantic `BaseSettings` class

### Frontend Patterns
- **App Router**: Pages under `app/(dashboard)/` for authenticated views; API routes proxy to backend
- **State**: Zustand stores in `lib/stores/`; feature hooks in `hooks/`
- **API calls**: Go through `lib/api/*.ts` Axios clients, not direct fetch
- **UI primitives**: Always use Radix UI wrappers from `components/ui/`
- **Streaming**: SSE responses consumed via `EventSource` or `fetch` with `ReadableStream`

### Co-Pilot Module (primary feature)
Services in `app/services/copilot/`:
- `lead_copilot_service.py` — 14 GTM actions with SSE streaming (`execute_action_stream()`)
- `campaign_optimizer_service.py` — score-only (1 credit) or full enrichment (2 credits)
- `knowledge_service.py` — RAG pipeline for product assistant chatbot
- `prompts.py` — all LLM prompt templates live here

Frontend copilot: `app/(dashboard)/copilot/` pages + `components/copilot/` + `hooks/use-copilot.ts`

### Key External Services
| Service | Purpose | Config key |
|---------|---------|-----------|
| OpenRouter | All LLM calls (Claude via proxy) | `OPENROUTER_API_KEY` |
| Serper | Google/YouTube search | `SERPER_API_KEY` |
| Tavily | Web research + LinkedIn | `TAVILY_API_KEY` |
| Explorium | Company firmographics | `EXPLORIUM_API_KEY` |
| CrustData | Prospect/company search | `CRUSTDATA_API_KEY` |
| Supabase | PostgreSQL + pgvector | `DATABASE_URL` |
| Upstash | Redis cache | `REDIS_URL` |
| Celery | Scheduled tasks | (uses Redis as broker) |

### Database
- **ORM**: SQLAlchemy 2.0 with async support; models in `app/db/models/`
- **Migrations**: Alembic in `Backend/alembic/`; always `alembic upgrade head` after pulling
- **SSL**: `sslmode=prefer` in `session.py` (not `require`) — prevents Windows + Supabase hang
- **pgvector**: Used for knowledge base embeddings (`ProductKnowledge` model)

## Environment Notes
- `MOCK_LLM=false` — real LLM calls are active; keep an eye on OpenRouter credits
- Frontend proxies `/api/*` → `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- **Windows gotcha**: `import sqlalchemy` blocks if zombie Python/uvicorn processes exist — always kill all Python processes before restarting backend
