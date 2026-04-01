# Outmate Co-Pilot: Orchestrator + Grounding Unification
## Product Requirements Document v1.0

---

## 1. Executive Summary

Today, every Co-Pilot action is a single LLM call with isolated enrichment. A user asks for a "renewal proposal" and gets one response — no planning, no multi-step execution, no cross-feature memory.

This PRD defines two foundational upgrades:

1. **Orchestrator Layer** — A planner that breaks any complex task into steps, assigns each step to the right specialized agent, executes them in sequence or parallel, and returns one unified artifact.
2. **Grounding Unification** — A single `ContextEngine` that assembles every available signal (enrichment, signals, briefs, alerts, meeting preps, past actions) into one structured context object before any LLM call runs.

Together these transform Co-Pilot from a feature menu into an autonomous sales assistant.

---

## 2. Problem Statement

### Current Limitations

| Problem | Impact |
|---------|--------|
| Each action runs in isolation — no shared context | Research result from `research` action never feeds into `draft_email` |
| No task decomposition — complex tasks need multiple manual clicks | Rep has to run research → then email → then objections manually |
| No unified context — every action re-fetches the same enrichment data | 5 redundant Explorium/Tavily calls for same prospect in one session |
| No cross-session memory — Co-Pilot forgets past outputs | Yesterday's meeting prep doesn't inform today's email |
| No audit trail — no record of what Co-Pilot did or recommended | Compliance risk; no learning loop |
| Streaming only on some actions — inconsistent UX | Some actions block for 10s with no feedback |

### What Users Need

> *"I have a renewal call with Acme Corp in 30 minutes. Prepare everything."*

That single sentence should trigger: research → meeting brief → objection prep → suggested email → all delivered in one response with live progress.

---

## 3. Goals & Non-Goals

### Goals
- Build an **Orchestrator** that plans and executes multi-step tasks
- Build a **ContextEngine** that unifies all available signals before any LLM call
- Build an **AuditLog** that records every Co-Pilot action
- Stream all progress to the UI in real time (no silent waits)
- Work with existing APIs (no new external services required)
- Remain fully backward compatible — existing single actions still work

### Non-Goals
- CRM integration (no deal stage read/write)
- Proposal PDF generation
- Calendar write-back
- External webhook delivery beyond Slack
- Multi-user collaboration / shared workspaces

---

## 4. Architecture Overview

```
User Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                    API Layer                        │
│  POST /api/copilot/orchestrate  (SSE streaming)    │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                  Orchestrator                       │
│  1. Parse intent (LLM call, ~100 tokens)           │
│  2. Build execution plan (list of steps)           │
│  3. Execute steps in order (sequential/parallel)   │
│  4. Merge outputs into unified artifact            │
└─────────────────────────────────────────────────────┘
     │
     ├──── ContextEngine (runs ONCE per request)
     │         Assembles: enrichment + signals +
     │         briefs + alerts + meeting preps +
     │         past actions → UnifiedContext object
     │
     └──── Step Executors (reuse existing services)
               ├── LeadCopilotService.execute_action()
               ├── MeetingPrepService.generate()
               ├── CampaignOptimizerService.analyze()
               └── (future: ProposalService, DeckService)
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                   AuditLog                         │
│  Records: user_id, task, plan, steps, outputs,     │
│  credits_used, duration, timestamp                 │
└─────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              SSE Response Stream                   │
│  Emits: intent → plan → step_start → step_done    │
│         → artifact → complete                      │
└─────────────────────────────────────────────────────┘
```

---

## 5. Component 1: ContextEngine

### 5.1 What It Does

A single async service that gathers ALL available context for a prospect/company before any LLM call. Results are cached in Redis for 30 minutes so repeated actions within a session don't re-fetch.

### 5.2 Context Sources (in priority order)

| Source | Data | Cache TTL | Failure Behavior |
|--------|------|-----------|-----------------|
| Prospect DB row | Name, title, company, email, seniority, department, LinkedIn | N/A (DB) | Skip if not found |
| Company DB row | Name, domain, industry, employee_count | N/A (DB) | Skip if not found |
| Explorium enrichment | Funding, revenue, tech stack, growth, competitors | 30 min | Log + continue |
| Serper Google mentions | Recent news about prospect | 30 min | Log + continue |
| Serper YouTube | Talks/panels by prospect | 30 min | Log + continue |
| Tavily LinkedIn | LinkedIn posts by prospect | 30 min | Log + continue |
| Tavily news | Company news last 30 days | 30 min | Log + continue |
| Pipeline alerts | Open risk alerts for this company | No cache | Log + continue |
| Meeting preps | Past briefs generated for this company | No cache | Log + continue |
| Daily brief signals | Signals flagged in today's brief | No cache | Log + continue |
| Past lead actions | Last 5 Co-Pilot outputs for this prospect | No cache | Log + continue |

### 5.3 UnifiedContext Object

```python
@dataclass
class UnifiedContext:
    # Identity
    prospect_id: Optional[str]
    prospect_name: str
    prospect_title: str
    prospect_company: str
    prospect_domain: Optional[str]

    # Enrichment (from LeadEnrichmentService — already exists)
    google_mentions: List[Dict]
    youtube_appearances: List[Dict]
    linkedin_posts: List[Dict]
    company_data: Dict               # from Explorium
    recent_news: List[Dict]
    sources_used: List[str]

    # Platform signals (NEW)
    pipeline_alerts: List[Dict]      # from copilot_pipeline_alerts table
    past_meeting_preps: List[Dict]   # last 3 from copilot_meeting_preps table
    daily_brief_signals: List[Dict]  # from today's copilot_briefs
    past_lead_actions: List[Dict]    # last 5 from copilot_audit_log table

    # Metadata
    assembled_at: datetime
    cache_key: str

    def to_prompt_sections(self) -> str:
        """Format all context into LLM-ready section blocks."""
        ...

    def to_summary(self) -> str:
        """One-paragraph summary of available context (for planner LLM)."""
        ...
```

### 5.4 Cache Strategy

```
Cache key: f"ctx:{user_id}:{prospect_id}:{date}"
TTL: 30 minutes
Invalidation: manual via DELETE /api/copilot/context/invalidate
```

External enrichment (Explorium, Serper, Tavily) is cached separately at the enrichment layer (existing behavior). Platform data (alerts, briefs, past actions) is always fresh.

### 5.5 Files

| File | Action |
|------|--------|
| `app/services/copilot/context_engine.py` | NEW — ContextEngine class |
| `app/services/copilot/lead_enrichment.py` | REUSE — called by ContextEngine |
| `app/services/enrichment.py` | REUSE — called by ContextEngine |

---

## 6. Component 2: Orchestrator

### 6.1 What It Does

Takes a free-form user task, plans the execution steps, runs them in order, and merges outputs into one artifact.

### 6.2 Planner

A lightweight LLM call (~100 tokens) that maps a user task to an execution plan.

**System prompt:**
```
You are a sales workflow planner. Given a user task and available context summary,
produce a JSON execution plan.

Available actions: research, draft_email, meeting_prep, objection_handler,
crossfire, compliance, find_similar, bombora_intent, talent_radar, virality,
regime_shift, website_traffic, business_events, custom

Return ONLY valid JSON:
{
  "intent": "one-line description of what user wants",
  "steps": [
    {
      "step_id": "step_1",
      "action": "<action_name>",
      "label": "human-readable label shown in UI",
      "depends_on": [],          // step_ids this step waits for
      "input_from": [],          // step_ids whose output feeds this step
      "extra_instruction": "..." // optional extra context for this step
    }
  ],
  "estimated_credits": <int>,
  "parallel_groups": [["step_1", "step_2"], ["step_3"]]
}
```

**Rules:**
- Max 5 steps per plan
- If intent is unclear → produce single-step plan with action=`custom`
- Steps with no `depends_on` can run in parallel
- `input_from` means the output of that step is appended to this step's context

### 6.3 Execution Engine

```python
class OrchestratorService:
    async def execute(
        self,
        user_id: str,
        prospect_id: str,
        task: str,
        db: Session,
    ) -> AsyncGenerator[OrchestratorEvent, None]:

        # Step 1: Assemble context (once)
        yield OrchestratorEvent(type="context_loading")
        context = await context_engine.assemble(user_id, prospect_id, db)

        # Step 2: Plan
        yield OrchestratorEvent(type="planning")
        plan = await self._plan(task, context)
        yield OrchestratorEvent(type="plan_ready", data=plan)

        # Step 3: Execute steps
        results = {}
        for group in plan.parallel_groups:
            group_tasks = []
            for step_id in group:
                step = plan.steps[step_id]
                # Inject outputs from dependency steps
                step_context = self._merge_context(context, results, step.input_from)
                group_tasks.append(self._execute_step(step, step_context, user_id, prospect_id))
            
            yield OrchestratorEvent(type="steps_starting", data={"steps": group})
            group_results = await asyncio.gather(*group_tasks, return_exceptions=True)
            
            for step_id, result in zip(group, group_results):
                results[step_id] = result
                yield OrchestratorEvent(type="step_complete", data={
                    "step_id": step_id,
                    "label": plan.steps[step_id].label,
                    "result": result,
                })

        # Step 4: Merge into artifact
        yield OrchestratorEvent(type="merging")
        artifact = await self._merge_artifact(plan, results, context)
        yield OrchestratorEvent(type="complete", data=artifact)

        # Step 5: Audit log
        await audit_log.record(user_id, prospect_id, task, plan, results, artifact)
```

### 6.4 Step Executor

Each step calls the existing `LeadCopilotService.execute_action()` with enriched context:

```python
async def _execute_step(self, step, context, user_id, prospect_id) -> dict:
    # Inject dependency outputs into context overrides
    overrides = {"unified_context": context.to_prompt_sections()}
    if step.input_from:
        overrides["prior_step_outputs"] = self._format_prior_outputs(step.input_from)
    
    return await lead_copilot_service.execute_action(
        user_id=user_id,
        prospect_id=prospect_id,
        action_type=step.action,
        prompt=step.extra_instruction or "",
        context_overrides=overrides,
    )
```

### 6.5 Artifact Merger

After all steps complete, a final LLM call merges outputs into one coherent document:

```
System: You are a sales executive assistant. Combine these outputs into one
        clear, actionable artifact. Remove redundancy. Keep all specifics.
        Structure: Summary → Key Intelligence → Actions → Artifacts

User: [all step outputs formatted as sections]
```

Output is a `OrchestratorArtifact` object:
```python
@dataclass
class OrchestratorArtifact:
    intent: str
    summary: str                    # 2-3 sentence overview
    steps_completed: List[str]      # step labels
    sections: List[ArtifactSection] # each step's output as a named section
    credits_used: int
    duration_ms: int
```

### 6.6 Example Plans

**"Prepare me for my call with John at Acme Corp"**
```json
{
  "intent": "Pre-call preparation for John at Acme Corp",
  "steps": [
    {"step_id": "s1", "action": "research", "label": "Research John + Acme"},
    {"step_id": "s2", "action": "meeting_prep", "label": "Generate meeting brief",
     "depends_on": ["s1"], "input_from": ["s1"]},
    {"step_id": "s3", "action": "objection_handler", "label": "Prep objection rebuttals",
     "depends_on": ["s1"], "input_from": ["s1"],
     "extra_instruction": "Focus on pricing and timing objections"}
  ],
  "parallel_groups": [["s1"], ["s2", "s3"]],
  "estimated_credits": 5
}
```

**"Write me a cold email to Jane at TechCorp"**
```json
{
  "intent": "Cold outreach email to Jane at TechCorp",
  "steps": [
    {"step_id": "s1", "action": "draft_email", "label": "Draft personalized email"}
  ],
  "parallel_groups": [["s1"]],
  "estimated_credits": 1
}
```

**"Give me everything on Acme Corp's competitors"**
```json
{
  "intent": "Competitive intelligence on Acme Corp",
  "steps": [
    {"step_id": "s1", "action": "find_similar", "label": "Find similar companies"},
    {"step_id": "s2", "action": "crossfire", "label": "Build battle card vs top competitor",
     "depends_on": ["s1"], "input_from": ["s1"],
     "extra_instruction": "Use the top competitor from step 1"}
  ],
  "parallel_groups": [["s1"], ["s2"]],
  "estimated_credits": 3
}
```

### 6.7 Files

| File | Action |
|------|--------|
| `app/services/copilot/orchestrator_service.py` | NEW — OrchestratorService + planner |
| `app/schemas/copilot.py` | ADD — OrchestratorRequest, OrchestratorEvent, OrchestratorArtifact schemas |
| `app/api/routes/copilot.py` | ADD — POST /orchestrate endpoint (SSE) |
| `app/services/copilot/lead_copilot_service.py` | MODIFY — accept `unified_context` in context_overrides |
| `app/services/copilot/prompts.py` | ADD — ORCHESTRATOR_PLANNER_PROMPT, ARTIFACT_MERGER_PROMPT |

---

## 7. Component 3: AuditLog

### 7.1 What It Records

Every Co-Pilot action (both orchestrated and single) is recorded.

### 7.2 DB Model

```python
class CopilotAuditLog(Base):
    __tablename__ = "copilot_audit_log"

    id            = Column(UUID, primary_key=True)
    user_id       = Column(UUID, nullable=False, index=True)
    prospect_id   = Column(UUID, nullable=True, index=True)
    company_name  = Column(String, nullable=True)

    # What was requested
    action_type   = Column(String, nullable=False)  # "orchestrate" | action name
    user_prompt   = Column(Text, nullable=True)

    # What was planned + executed
    plan          = Column(JSONB, nullable=True)     # orchestrator plan
    steps_run     = Column(JSONB, nullable=True)     # list of step results

    # Result
    output        = Column(JSONB, nullable=True)     # final artifact or action result
    status        = Column(String, default="success") # success | error | partial

    # Metadata
    credits_used  = Column(Integer, default=0)
    duration_ms   = Column(Integer, nullable=True)
    enrichment_sources = Column(JSONB, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
```

### 7.3 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/copilot/audit-log` | Returns last 50 actions for current user (paginated) |
| `GET /api/copilot/audit-log/{id}` | Full detail of one action including all step outputs |

### 7.4 Files

| File | Action |
|------|--------|
| `app/db/models/copilot_audit_log.py` | NEW — AuditLog model |
| `app/services/copilot/audit_log_service.py` | NEW — AuditLogService.record() |
| `app/api/routes/copilot.py` | ADD — audit-log endpoints |
| `alembic/versions/` | NEW — migration for copilot_audit_log table |

---

## 8. SSE Event Schema

All orchestrator progress is streamed via SSE. Frontend subscribes to the stream and renders each event.

```typescript
type OrchestratorEvent =
  | { type: "context_loading" }
  | { type: "planning" }
  | { type: "plan_ready"; data: { intent: string; steps: Step[]; estimated_credits: number } }
  | { type: "steps_starting"; data: { steps: string[] } }
  | { type: "step_complete"; data: { step_id: string; label: string; result: any } }
  | { type: "merging" }
  | { type: "complete"; data: OrchestratorArtifact }
  | { type: "error"; data: { message: string; step_id?: string } }
```

---

## 9. Frontend

### 9.1 New Component: OrchestratorPanel

Location: `app/(dashboard)/copilot/orchestrate/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  What do you need? (large text input)           │
│  [Prospect: Jane Doe ▼]  [2 credits est.]       │
│  [Run Co-Pilot]                                 │
└─────────────────────────────────────────────────┘

Progress (visible during execution):
┌─────────────────────────────────────────────────┐
│  🔍 Loading context...        ✓                 │
│  🧠 Planning steps...         ✓                 │
│  📋 Plan: 3 steps, ~5 credits                   │
│  ─────────────────────────────                  │
│  ✓ Research John + Acme       [expand]          │
│  ⟳ Generating meeting brief...                  │
│  ○ Prep objection rebuttals   (waiting)         │
└─────────────────────────────────────────────────┘

Result (after complete):
┌─────────────────────────────────────────────────┐
│  Pre-call Package: John at Acme Corp            │
│  ─────────────────────────────────              │
│  Summary: [2-3 sentence overview]               │
│                                                 │
│  [Research]  [Meeting Brief]  [Objections]      │
│  (tabs, each shows that step's output)          │
│                                                 │
│  Copy All  |  Save  |  Share                    │
└─────────────────────────────────────────────────┘
```

### 9.2 Changes to Existing Lead Panel

- Add **"Run Full Prep"** button that auto-triggers orchestrator with task = "Prepare everything for my next call with {prospect.name}"
- Show **"Past actions"** tab pulling from audit log

### 9.3 New Tab in Copilot Main Page

Add **"Orchestrate"** as a 5th tab alongside Daily Brief / Meeting Prep / Campaign / Pipeline.

### 9.4 Files

| File | Action |
|------|--------|
| `app/(dashboard)/copilot/orchestrate/page.tsx` | NEW |
| `lib/api/copilot.ts` | ADD — orchestrate() method |
| `hooks/use-copilot.ts` | ADD — useOrchestrator() hook |
| `app/(dashboard)/copilot/page.tsx` | ADD — Orchestrate tab |
| `app/(dashboard)/leads/prospects/[id]/page.tsx` | ADD — "Run Full Prep" button |

---

## 10. Credit Costs

| Action | Credits |
|--------|---------|
| Orchestrate (planner call) | 1 (flat, covers planning + merging) |
| Each step | Same as existing single action cost |
| Context assembly | 0 (no LLM call) |
| Audit log read | 0 |

**Example: "Prepare for call" plan (3 steps)**
- Planner: 1 credit
- Research: 2 credits
- Meeting prep: 2 credits
- Objection handler: 1 credit
- **Total: 6 credits**

Credit estimate is shown to user **before** execution starts (from planner output). User can cancel after seeing the plan.

---

## 11. Implementation Order

### Phase 1 — Foundation (no UI changes needed)
1. `ContextEngine` — assembles UnifiedContext, Redis cache
2. `AuditLog` — DB model + service + migration
3. Wire ContextEngine into existing single actions (inject unified context)

### Phase 2 — Orchestrator Backend
4. `OrchestratorService` — planner + execution engine + artifact merger
5. New SSE endpoint `POST /api/copilot/orchestrate`
6. Add orchestrator schemas to `copilot.py`
7. Audit log all orchestrated actions

### Phase 3 — Frontend
8. `OrchestratorPanel` component with SSE stream consumer
9. Orchestrate tab in main Copilot page
10. "Run Full Prep" button on Lead panel
11. Audit log viewer (Past actions tab)

---

## 12. Files Summary

### New Files (7)
1. `Backend/app/services/copilot/context_engine.py`
2. `Backend/app/services/copilot/orchestrator_service.py`
3. `Backend/app/services/copilot/audit_log_service.py`
4. `Backend/app/db/models/copilot_audit_log.py`
5. `Backend/alembic/versions/<hash>_add_copilot_audit_log.py`
6. `Frontend/app/(dashboard)/copilot/orchestrate/page.tsx`
7. `Frontend/hooks/use-orchestrator.ts`

### Modified Files (8)
1. `Backend/app/schemas/copilot.py` — new schemas
2. `Backend/app/api/routes/copilot.py` — new endpoints
3. `Backend/app/services/copilot/prompts.py` — new prompts
4. `Backend/app/services/copilot/lead_copilot_service.py` — accept unified_context
5. `Backend/app/core/celery_app.py` — (no change)
6. `Frontend/lib/api/copilot.ts` — orchestrate() method
7. `Frontend/app/(dashboard)/copilot/page.tsx` — Orchestrate tab
8. `Frontend/app/(dashboard)/leads/prospects/[id]/page.tsx` — Run Full Prep button

---

## 13. Definition of Done

- [ ] ContextEngine assembles UnifiedContext in < 3s (parallel fetches, Redis cache)
- [ ] Orchestrator plans any free-form task into ≤ 5 steps correctly
- [ ] Multi-step plans execute with live SSE progress visible in UI
- [ ] Step outputs feed into dependent steps (input_from chain works)
- [ ] Parallel steps run concurrently (asyncio.gather)
- [ ] Artifact merger produces coherent single document
- [ ] Every action (single + orchestrated) recorded in audit log
- [ ] Credit estimate shown before execution, correct within ±1
- [ ] All errors surface to UI via SSE error event (no silent failures)
- [ ] Existing single actions unchanged (full backward compatibility)
- [ ] Redis cache prevents duplicate enrichment calls within 30 min
- [ ] MOCK_LLM=true returns deterministic mock responses for all new paths
