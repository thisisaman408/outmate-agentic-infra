# Outmate.AI — Claude Code Skills

This file defines the project's architecture rules, coding patterns, and file conventions
so Claude generates code that is consistent with the existing codebase.

---

## Project Structure

```
Outmate_repo/
├── Backend/              # FastAPI Python backend
│   └── app/
│       ├── api/
│       │   ├── routes/   # One file per feature domain
│       │   └── deps/     # Shared FastAPI dependencies (auth, db)
│       ├── services/     # Business logic (one file per service)
│       ├── db/
│       │   ├── models/   # SQLAlchemy ORM models
│       │   ├── base.py   # declarative_base()
│       │   ├── session.py # engine + SessionLocal
│       │   └── deps.py   # get_db() dependency
│       ├── schemas/      # Pydantic request/response models
│       ├── core/
│       │   └── config.py # settings via pydantic-settings
│       └── main.py       # App factory, router registration
└── Frontend/             # Next.js 14 App Router (TypeScript)
    ├── app/
    │   └── (dashboard)/  # All authenticated pages live here
    ├── components/
    │   ├── ui/           # shadcn/ui primitives (DO NOT modify)
    │   ├── layout/       # Sidebar, header, layout wrappers
    │   └── [feature]/    # Feature-specific components
    ├── lib/
    │   ├── api/          # API client files (one per domain)
    │   ├── auth.ts       # authService + getAuthHeaders()
    │   ├── store.ts      # Zustand global store
    │   └── utils.ts      # cn() and shared utilities
    └── hooks/            # Custom React hooks (use-toast, etc.)
```

---

## Backend Patterns

### Route Files (`app/api/routes/`)

```python
"""
Module docstring describing the route group.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from app.services.some_service import SomeService
from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.user import User
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(tags=["feature-name"])

class SomeRequest(BaseModel):
    field: str
    optional_field: Optional[str] = None

@router.post("/endpoint")
async def my_endpoint(
    request: SomeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Docstring describing what this endpoint does."""
    try:
        service = SomeService(db)
        result = await service.do_something(request, current_user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in my_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Operation failed: {str(e)}")
```

**Rules:**
- Always use `logger = logging.getLogger(__name__)` at module level
- Always wrap service calls in try/except — `ValueError` → 400, generic `Exception` → 500
- Pydantic models defined in the route file for simple cases, or in `app/schemas/` for complex ones
- `router = APIRouter(tags=["..."])` — no prefix here, prefix set in `main.py`
- Auth via `Depends(get_current_user)` — returns a `User` object
- DB session via `Depends(get_db)` — pass to service constructor

### Registering Routes in `main.py`

```python
from app.api.routes import copilot
app.include_router(copilot.router, prefix="/api/copilot", tags=["copilot"], dependencies=auth_dependencies)
logger.info("Copilot router registered")
```

Always add a `logger.info()` after each router registration.

### Service Files (`app/services/`)

```python
from app.services.openrouter_service import OpenRouterService
from app.core.config import settings
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

class MyFeatureService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()

    async def do_something(self, data: dict, user_id: str) -> dict:
        # business logic here
        result = await self.openrouter.chat_completion(prompt)
        return result
```

**Rules:**
- Services accept `db: Session` in `__init__` if they need DB access
- Instantiate `OpenRouterService()` inside the service — do NOT pass it in
- All LLM calls go through `OpenRouterService` — never call OpenRouter directly
- Use `async def` for all methods that call LLM or external APIs

### OpenRouterService — How to Use

```python
# Existing method — single user message
result: str = await self.openrouter.chat_completion(prompt="your prompt here")

# New method to add — system + user message with JSON response
result: dict = await self.openrouter.chat_completion_structured(
    system_prompt=SOME_SYSTEM_PROMPT,
    user_prompt="user context data here",
    temperature=0.3,
    max_tokens=2000,
)
```

Location: `Backend/app/services/openrouter_service.py`

### DB Models (`app/db/models/`)

```python
import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.db.base import Base

class MyModel(Base):
    __tablename__ = "my_table"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content    = Column(JSONB, nullable=False)
    status     = Column(String(50), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

**Rules:**
- Always use `UUID(as_uuid=True)` for primary keys and foreign keys
- Use `JSONB` for flexible structured data (not `JSON`)
- Always include `created_at` with `server_default=func.now()`
- Foreign keys to users: `ForeignKey("users.id", ondelete="CASCADE")`
- Add `index=True` on `user_id` and any frequently queried columns

### Auth Pattern

```python
from app.api.deps.auth import get_current_user
from app.db.models.user import User

# In route:
current_user: User = Depends(get_current_user)

# Access user ID:
user_id = str(current_user.id)
```

`get_current_user` decodes JWT from `Authorization: Bearer <token>` header and returns a `User` ORM object.

### Environment / Config

```python
from app.core.config import settings

settings.OPENROUTER_API_KEY
settings.OPENROUTER_BASE_URL
settings.JWT_SECRET
settings.DATABASE_URL
settings.REDIS_URL
```

New env vars must be added to `app/core/config.py` as `Settings` fields.

### Mock Mode Pattern

When `MOCK_LLM=true` in `.env`, skip OpenRouter calls and return hardcoded responses:

```python
import os

class CopilotService:
    def __init__(self, db):
        self.db = db
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def generate_brief(self, user_id: str) -> dict:
        if self.mock:
            return MOCK_DAILY_BRIEF  # hardcoded dict at top of file
        # real LLM call
        result = await self.openrouter.chat_completion_structured(...)
        return result
```

---

## Frontend Patterns

### Page Files (`app/(dashboard)/[feature]/page.tsx`)

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi } from "@/lib/api/copilot"

export default function FeaturePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<SomeType | null>(null)
  const { toast } = useToast()

  const handleAction = async () => {
    setIsLoading(true)
    try {
      const result = await copilotApi.someMethod(payload)
      setData(result.data)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.detail || "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Page Title</h1>
      </div>
      {/* content */}
    </div>
  )
}
```

**Rules:**
- Always `"use client"` at top for interactive pages
- Use `useToast()` from `@/hooks/use-toast` for all error/success notifications
- Loading state with `Loader2` icon from lucide-react: `<Loader2 className="h-4 w-4 animate-spin" />`
- Page wrapper: `<div className="p-6 space-y-6">`
- Import UI components from `@/components/ui/` (shadcn)
- Icons from `lucide-react`

### API Client Files (`lib/api/`)

```typescript
import { authService } from "@/lib/auth"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const fetchWithAuth = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, value)
  })
  return fetch(url, { ...init, headers })
}

export const copilotApi = {
  getDailyBrief: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/daily-brief`)
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to fetch daily brief")
    }
    return response.json()
  },
}
```

**Rules:**
- Use `fetchWithAuth` (not axios) — matches existing `campaigns.ts` pattern
- Always use `authService.getAuthHeaders()` for JWT token
- Always check `!response.ok` and throw with `error?.detail` from backend
- `BACKEND_BASE` from `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`
- Export a named object (e.g., `copilotApi`) with methods

### Sidebar Navigation (`components/layout/sidebar.tsx`)

To add a nav item, add an entry to the `navItems` array:

```typescript
{ name: "Co-Pilot", href: "/copilot", icon: Sparkles }
```

Import the icon at the top of the file with the other lucide-react imports.
`Sparkles` is already used in the project (ai-powered-search page).

### UI Components (shadcn/ui — already installed)

Use these — do not install new UI libraries:
- `@/components/ui/card` — Card, CardContent, CardHeader, CardTitle, CardDescription
- `@/components/ui/button` — Button (variants: default, outline, ghost, destructive)
- `@/components/ui/badge` — Badge (variants: default, secondary, destructive, outline)
- `@/components/ui/tabs` — Tabs, TabsList, TabsTrigger, TabsContent
- `@/components/ui/input` — Input
- `@/components/ui/textarea` — Textarea
- `@/components/ui/table` — Table, TableHeader, TableBody, TableRow, TableHead, TableCell
- `@/components/ui/separator` — Separator

### Tailwind CSS Conventions

```
- Page padding: p-6
- Section spacing: space-y-6
- Card gap: gap-4 or gap-6
- Text colors: text-primary, text-muted-foreground
- Background: bg-background, bg-muted
- Risk colors: text-red-500, text-yellow-500, text-green-500
- Priority badges: "high" → destructive, "medium" → secondary, "low" → outline
```

---

## Key File Paths — Quick Reference

| What | Path |
|------|------|
| LLM service | `Backend/app/services/openrouter_service.py` |
| Auth dependency | `Backend/app/api/deps/auth.py` |
| DB session dep | `Backend/app/db/deps.py` |
| App factory | `Backend/app/main.py` |
| DB base | `Backend/app/db/base.py` |
| Settings | `Backend/app/core/config.py` |
| Sidebar nav | `Frontend/components/layout/sidebar.tsx` |
| Auth client | `Frontend/lib/auth.ts` |
| Campaigns API (reference) | `Frontend/lib/api/campaigns.ts` |
| Campaigns page (reference) | `Frontend/app/(dashboard)/campaigns/page.tsx` |
| Search page (reference) | `Frontend/app/(dashboard)/ai-powered-search/page.tsx` |

---

## Co-Pilot Feature — New Files to Create

### Backend
| File | Purpose |
|------|---------|
| `Backend/app/services/openrouter_service.py` | MODIFY: add `chat_completion_structured()` |
| `Backend/app/services/copilot/prompts.py` | LLM prompt templates for all 4 features |
| `Backend/app/services/copilot/copilot_service.py` | Orchestrator |
| `Backend/app/services/copilot/daily_brief_service.py` | Daily brief logic |
| `Backend/app/services/copilot/meeting_prep_service.py` | Meeting prep logic |
| `Backend/app/services/copilot/campaign_optimizer_service.py` | Campaign analysis logic |
| `Backend/app/services/copilot/pipeline_risk_service.py` | Pipeline risk logic |
| `Backend/app/schemas/copilot.py` | Pydantic schemas |
| `Backend/app/api/routes/copilot.py` | All copilot endpoints |
| `Backend/app/db/models/copilot_brief.py` | CopilotBrief model |
| `Backend/app/db/models/copilot_meeting_prep.py` | CopilotMeetingPrep model |
| `Backend/app/db/models/copilot_campaign_analysis.py` | CopilotCampaignAnalysis model |
| `Backend/app/db/models/copilot_pipeline_alert.py` | CopilotPipelineAlert model |
| `Backend/app/db/models/copilot_preferences.py` | CopilotUserPreferences model |
| `Backend/app/main.py` | MODIFY: register copilot router |

### Frontend
| File | Purpose |
|------|---------|
| `Frontend/lib/api/copilot.ts` | API client |
| `Frontend/app/(dashboard)/copilot/page.tsx` | Main copilot page (4 tabs) |
| `Frontend/app/(dashboard)/copilot/daily-brief/page.tsx` | Daily brief page |
| `Frontend/app/(dashboard)/copilot/meeting-prep/page.tsx` | Meeting prep page |
| `Frontend/app/(dashboard)/copilot/campaign-optimizer/page.tsx` | Campaign optimizer page |
| `Frontend/app/(dashboard)/copilot/pipeline-alerts/page.tsx` | Pipeline alerts page |
| `Frontend/components/layout/sidebar.tsx` | MODIFY: add Co-Pilot nav item |

---

## Do Not

- Do not modify existing service files except `openrouter_service.py`
- Do not install new npm packages — use only what's already in `package.json`
- Do not install new Python packages unless absolutely necessary
- Do not modify existing DB models
- Do not use axios in the frontend — use `fetchWithAuth` pattern from `campaigns.ts`
- Do not hardcode API URLs — always use `NEXT_PUBLIC_API_URL` env var
- Do not skip auth on copilot endpoints — all require `get_current_user`
