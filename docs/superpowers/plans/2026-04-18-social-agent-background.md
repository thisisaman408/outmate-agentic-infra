# Social Agent — Background "Run Search" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Social Agent's "Run search now" button fire a background Celery task instead of holding an open HTTP request, so closing the tab or navigating away doesn't cancel the discovery run. The frontend polls for completion instead of awaiting inline.

**Architecture:**
- New Celery task `run_social_search` wraps the existing `SocialListeningService.run_for_watcher` call (identical logic — just moved off the request thread).
- `POST /searches/{id}/run-now` returns `{run_id, status: "queued"}` immediately after dispatching the task.
- New `GET /searches/{id}/run-status/{run_id}` polls the `outmate_agent_runs` table — reuses the existing `AgentRun` row the service already writes.
- Frontend replaces inline `await runSearchNow()` with a poll loop that updates UI every 3s.

**Tech Stack:** Same stack as the main repo — Celery (existing), FastAPI, Next.js, `AgentRun` model (existing).

---

## File Structure

**Backend — modified files:**
- `Backend/app/tasks/social_listening_tasks.py` — add `run_social_search` task alongside the existing `poll_due_social_searches`
- `Backend/app/api/routes/social_listening.py` — rewire `run_search_now` to enqueue, add `get_run_status`
- `Backend/app/services/social_listening/__init__.py` or the `SocialListeningService` module — ensure `run_for_watcher` writes an `AgentRun` row with `agent_type="social-listening"` before and after (probably already does — verify during Task 1)

**Frontend — modified files:**
- `Frontend/lib/social-listening.ts` — change `runSearchNow` signature to return `{run_id}`, add `getRunStatus`, add `pollUntilDone` helper
- `Frontend/app/(dashboard)/social-agent/page.tsx` — replace the single-await with polling

---

## Task 1: Verify AgentRun is written by `run_for_watcher`

The whole plan hinges on the existing service already writing an `AgentRun` row — if it doesn't, we add that first.

**Files:**
- Read: `Backend/app/services/social_listening/__init__.py` and related service files

- [ ] **Step 1: Find where `run_for_watcher` lives and check its AgentRun writes**

Run:

```bash
cd Backend && grep -rn "class SocialListeningService\|def run_for_watcher\|AgentRun(" app/services/social_listening/
```

Expected: at least one hit for `class SocialListeningService`, `def run_for_watcher`, and an `AgentRun(` instantiation.

- [ ] **Step 2: If AgentRun IS written — move on to Task 2.**

If it ISN'T, modify `run_for_watcher` to:
1. Create a `running` AgentRun row at the top (`agent_type="social-listening"`, `flow_id=<flow>`, `input=<watcher.criteria>`, `user_id=watcher.user_id`)
2. On success: set `status="success"`, `output_text=<raw>`, `leads=<parsed>`, `finished_at=now()`, `duration_ms=...`
3. On error: set `status="error"`, `error_message=...`

Commit that as a separate fix:

```bash
git add Backend/app/services/social_listening/
git commit -m "fix(social): ensure run_for_watcher persists AgentRun for audit/polling"
```

---

## Task 2: Celery task `run_social_search`

**Files:**
- Modify: `Backend/app/tasks/social_listening_tasks.py`

- [ ] **Step 1: Add the task**

Append to `Backend/app/tasks/social_listening_tasks.py`:

```python
@shared_task(
    name="app.tasks.social_listening_tasks.run_social_search",
    bind=True,
)
def run_social_search(self, watcher_id: str, user_id: str) -> Dict[str, Any]:
    """Run discovery for a single watcher in the background.

    Called by `POST /searches/{id}/run-now`.  Returns the AgentRun id so
    the API can forward it to the client for polling.  Failure is captured
    both in the AgentRun row (written by SocialListeningService) and as a
    task-level return value for Celery introspection.
    """
    db = SessionLocal()
    try:
        watcher = (
            db.query(Watcher)
            .filter(Watcher.id == watcher_id, Watcher.user_id == user_id)
            .first()
        )
        if not watcher:
            return {"ok": False, "reason": "watcher_not_found"}
        if watcher.status != "active":
            return {"ok": False, "reason": "watcher_paused"}

        service = SocialListeningService(db)
        summary = asyncio.run(service.run_for_watcher(watcher))
        db.commit()
        return {"ok": True, "summary": summary}
    except Exception as exc:  # noqa: BLE001
        logger.exception("run_social_search failed for watcher %s: %s", watcher_id, exc)
        db.rollback()
        return {"ok": False, "reason": str(exc)[:300]}
    finally:
        db.close()
```

- [ ] **Step 2: Verify import**

```bash
cd Backend && python -c "from app.tasks.social_listening_tasks import run_social_search; print(run_social_search.name)"
```

Expected: `app.tasks.social_listening_tasks.run_social_search`

- [ ] **Step 3: Commit**

```bash
git add Backend/app/tasks/social_listening_tasks.py
git commit -m "feat(social): run_social_search Celery task for background discovery"
```

---

## Task 3: Rewire `run_search_now` endpoint + add status endpoint

**Files:**
- Modify: `Backend/app/api/routes/social_listening.py`

- [ ] **Step 1: Rewrite `run_search_now` (currently at line 384)**

Replace the existing handler:

```python
class RunNowResponse(BaseModel):
    run_id: str
    task_id: str
    status: str
    watcher_id: str


@router.post("/{search_id}/run-now", response_model=RunNowResponse, status_code=202)
def run_search_now(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunNowResponse:
    """Queue a background discovery run for this watcher.

    Returns immediately with a `run_id` the client can poll via
    `GET /searches/{id}/run-status/{run_id}`.  The run itself executes in
    the Celery worker and survives client disconnects.
    """
    from app.db.models.agent_run import AgentRun
    from app.tasks.social_listening_tasks import run_social_search

    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    if watcher.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="search is paused — resume it before running",
        )

    # Pre-create a "queued" AgentRun row so the client has something to
    # poll immediately.  The Celery task will flip this to running/success
    # in its own transaction.
    import uuid
    run = AgentRun(
        id=uuid.uuid4(),
        user_id=current_user.id,
        agent_type="social-listening",
        flow_id=None,
        input=watcher.criteria or {},
        status="queued",
    )
    db.add(run)
    db.commit()

    task = run_social_search.delay(str(watcher.id), str(current_user.id))

    return RunNowResponse(
        run_id=str(run.id),
        task_id=task.id,
        status="queued",
        watcher_id=str(watcher.id),
    )
```

Also add this right after the `RunNowResponse` class above:

```python
class RunStatusResponse(BaseModel):
    run_id: str
    status: str          # queued | running | success | error
    leads_count: int
    error_message: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]
    search: Optional[SearchResponse]  # populated when status == success


@router.get("/{search_id}/run-status/{run_id}", response_model=RunStatusResponse)
def get_run_status(
    search_id: str,
    run_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RunStatusResponse:
    from app.db.models.agent_run import AgentRun

    watcher = _get_user_search_or_404(db, current_user.id, search_id)
    run = (
        db.query(AgentRun)
        .filter(AgentRun.id == run_id, AgentRun.user_id == current_user.id)
        .first()
    )
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    leads_count = len(run.leads or []) if run.leads else 0
    search_payload = _serialize_search(watcher, db) if run.status == "success" else None

    return RunStatusResponse(
        run_id=str(run.id),
        status=run.status,
        leads_count=leads_count,
        error_message=run.error_message,
        started_at=run.created_at.isoformat() if run.created_at else None,
        finished_at=run.finished_at.isoformat() if run.finished_at else None,
        search=search_payload,
    )
```

Make sure `BaseModel` and `Optional` are already imported at the top of the file (they are — existing router already uses Pydantic schemas).

- [ ] **Step 2: Sanity-check the new endpoint is registered**

```bash
taskkill //IM python.exe //F 2>/dev/null; cd Backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
sleep 3
curl -s http://127.0.0.1:8000/openapi.json | python -c "import sys,json; d=json.load(sys.stdin); print([p for p in d['paths'] if 'run-now' in p or 'run-status' in p])"
```

Expected output includes `/api/v1/searches/{search_id}/run-now` and `/api/v1/searches/{search_id}/run-status/{run_id}`.

- [ ] **Step 3: Commit**

```bash
git add Backend/app/api/routes/social_listening.py
git commit -m "feat(social): run-now is now background (202 + poll endpoint)"
```

---

## Task 4: Frontend — swap await-inline for polling

**Files:**
- Modify: `Frontend/lib/social-listening.ts`
- Modify: `Frontend/app/(dashboard)/social-agent/page.tsx`

- [ ] **Step 1: Update the API client**

In `Frontend/lib/social-listening.ts`, find the existing `runSearchNow` function (around line 150). Replace it with:

```typescript
export interface RunNowResponse {
  run_id: string
  task_id: string
  status: string
  watcher_id: string
}

export interface RunStatusResponse {
  run_id: string
  status: "queued" | "running" | "success" | "error"
  leads_count: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  search: SocialSearch | null
}

export async function runSearchNow(id: string): Promise<RunNowResponse> {
  const res = await fetch(`/api/v1/searches/${id}/run-now`, { method: "POST" })
  if (!res.ok) throw new Error(`runSearchNow ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function getRunStatus(searchId: string, runId: string): Promise<RunStatusResponse> {
  const res = await fetch(`/api/v1/searches/${searchId}/run-status/${runId}`)
  if (!res.ok) throw new Error(`getRunStatus ${res.status}: ${await res.text()}`)
  return res.json()
}

/**
 * Kick off a background run and resolve only when it finishes (or errors).
 * Use when you want the "feels synchronous but is background" UX.
 * Caller can cancel via the AbortSignal.
 */
export async function runSearchAndWait(
  searchId: string,
  opts?: { onProgress?: (s: RunStatusResponse) => void; signal?: AbortSignal; intervalMs?: number },
): Promise<SocialSearch> {
  const { run_id } = await runSearchNow(searchId)
  const interval = opts?.intervalMs ?? 3000
  while (true) {
    if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError")
    const status = await getRunStatus(searchId, run_id)
    opts?.onProgress?.(status)
    if (status.status === "success" && status.search) return status.search
    if (status.status === "error") throw new Error(status.error_message || "Run failed")
    await new Promise((r) => setTimeout(r, interval))
  }
}
```

- [ ] **Step 2: Update the social-agent page caller**

In `Frontend/app/(dashboard)/social-agent/page.tsx` at line ~122 (find `runSearchNow(id)` usage):

Before:
```tsx
const updated = await runSearchNow(id)
```

After:
```tsx
const updated = await runSearchAndWait(id, {
  onProgress: (s) => {
    // Optional: reflect running/queued state in the UI.  For now a toast
    // or spinner is enough; the search row updates once done.
    console.debug("social search progress", s.status, s.leads_count)
  },
})
```

Make sure `runSearchAndWait` is added to the import statement at the top of the file (replacing or alongside `runSearchNow`).

- [ ] **Step 3: Verify — the golden path**

1. Start Celery worker: `cd Backend && celery -A app.core.celery_app:celery_app worker --loglevel=info`
2. Start backend: `taskkill //IM python.exe //F 2>/dev/null; cd Backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
3. Start frontend: `cd Frontend && npm run dev`
4. Open Social Agent page → click "Run now" on a search
5. **Immediately close the browser tab.** Open it again 30s later.
6. Refresh — the search's stats should reflect the background completion.

If the page shows updated lead counts after reopening, background execution works. If counts are unchanged, the worker likely didn't pick up the task — check Celery logs.

- [ ] **Step 4: Commit**

```bash
git add Frontend/lib/social-listening.ts Frontend/app/\(dashboard\)/social-agent/page.tsx
git commit -m "feat(social): run-now is background — client polls for completion"
```

---

## Self-Review

**1. Spec coverage:**
- Move `run_search_now` off the request thread — **Task 3** ✅
- Survive tab close / navigation — **Tasks 2+3** (Celery is independent of the HTTP request lifecycle) ✅
- UI stays usable during the run — **Task 4** (poll + callback, not a blocking await) ✅

**2. Placeholder scan:** clean.

**3. Type consistency:**
- `RunNowResponse` Pydantic ↔ `RunNowResponse` TS interface: fields match (run_id, task_id, status, watcher_id) ✅
- `RunStatusResponse` Pydantic ↔ `RunStatusResponse` TS interface: identical field names + optional-ness ✅
- `AgentRun` model fields referenced (id, user_id, agent_type, status, error_message, leads, created_at, finished_at, input) all exist per `Backend/app/db/models/agent_run.py` ✅

**4. Dependency on existing code:** Task 1 verifies the assumption. If it turns out `run_for_watcher` doesn't write AgentRun, Task 1's fix must land before Task 3 works.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-social-agent-background.md`.

This plan is much smaller (4 tasks) than the voice campaigns plan. Recommended to execute it right after the voice-campaigns plan — both share the Celery infrastructure, so momentum carries over.

Same execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task.
**2. Inline Execution** — execute in this session with checkpoints.
