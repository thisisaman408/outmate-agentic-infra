"""OrchestratorService — plans and executes multi-step Co-Pilot workflows.

Flow:
  1. ContextEngine assembles UnifiedContext (Redis-cached, run once per request)
  2. Planner LLM call produces ExecutionPlan (JSON, ~100 tokens)
  3. Steps execute in parallel_groups; step outputs chain via input_from
  4. Artifact merger LLM call produces one unified OrchestratorArtifact
  5. AuditLogService records everything
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from sqlalchemy.orm import Session

from app.services.openrouter_service import OpenRouterService
from app.services.copilot.context_engine import ContextEngine, UnifiedContext, context_engine
from app.services.copilot.audit_log_service import AuditLogService
from app.services.copilot.prompts import (
    ORCHESTRATOR_PLANNER_PROMPT,
    ARTIFACT_MERGER_PROMPT,
)
from app.schemas.copilot import (
    PlanStep,
    ExecutionPlan,
    ArtifactSection,
    OrchestratorArtifact,
)

logger = logging.getLogger(__name__)

# ── Mock plan returned when MOCK_LLM=true ──────────────────────────────────

MOCK_PLAN = ExecutionPlan(
    intent="Mock orchestration — prepare for call",
    steps=[
        PlanStep(step_id="s1", action="research", label="Research prospect + company"),
        PlanStep(
            step_id="s2",
            action="draft_email",
            label="Draft outreach email",
            depends_on=["s1"],
            input_from=["s1"],
        ),
    ],
    estimated_credits=4,
    parallel_groups=[["s1"], ["s2"]],
)

MOCK_ARTIFACT = OrchestratorArtifact(
    intent="Mock orchestration — prepare for call",
    summary="This is a mock artifact produced when MOCK_LLM=true.",
    steps_completed=["Research prospect + company", "Draft outreach email"],
    sections=[
        ArtifactSection(
            step_id="s1",
            label="Research prospect + company",
            action="research",
            result={"executive_summary": "Mock research result."},
        ),
        ArtifactSection(
            step_id="s2",
            label="Draft outreach email",
            action="draft_email",
            result={"full_text": "Mock email body.", "subject_line": "Quick note"},
        ),
    ],
    credits_used=4,
    duration_ms=0,
)


# ─────────────────────────────────────────────────────────────────────────── #
# OrchestratorService                                                         #
# ─────────────────────────────────────────────────────────────────────────── #


class OrchestratorService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.openrouter = OpenRouterService()
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"
        self._audit = AuditLogService(db)

    # ------------------------------------------------------------------ #
    # Main entry point                                                      #
    # ------------------------------------------------------------------ #

    async def execute(
        self,
        user_id: str,
        prospect_id: str,
        task: str,
        context_overrides: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Yield SSE-ready event dicts for the full orchestration run."""
        start_ms = int(time.time() * 1000)

        # ── Phase 1: Assemble context ─────────────────────────────────────
        yield {"type": "context_loading"}
        try:
            context = await context_engine.assemble(user_id, prospect_id, self.db)
            # Inject CrustData / external prospect data when prospect isn't in local DB
            if context_overrides:
                p = context_overrides.get("prospect") or {}
                c = context_overrides.get("company") or {}
                if p.get("name") and not context.prospect_name:
                    context.prospect_name = p["name"]
                if p.get("title") and not context.prospect_title:
                    context.prospect_title = p["title"]
                if c.get("name") and not context.prospect_company:
                    context.prospect_company = c["name"]
                if p.get("linkedin_url") and not context.linkedin_url:
                    context.linkedin_url = p["linkedin_url"]
                if p.get("email") and not context.prospect_email:
                    context.prospect_email = p["email"]
        except Exception as exc:
            logger.error("ContextEngine failed: %s", exc)
            yield {"type": "error", "data": {"message": f"Context assembly failed: {exc}"}}
            return

        # ── Phase 2: Plan ─────────────────────────────────────────────────
        yield {"type": "planning"}
        try:
            plan = await self._plan(task, context)
        except Exception as exc:
            logger.error("Planner failed: %s", exc)
            yield {"type": "error", "data": {"message": f"Planning failed: {exc}"}}
            return

        yield {
            "type": "plan_ready",
            "data": {
                "intent": plan.intent,
                "steps": [s.model_dump() for s in plan.steps],
                "estimated_credits": plan.estimated_credits,
            },
        }

        # ── Phase 3: Execute steps in parallel groups ─────────────────────
        results: Dict[str, Dict[str, Any]] = {}
        credits_used = 1  # 1 for orchestrator (planner + merger)

        for group in plan.parallel_groups:
            # Filter out steps that don't exist in the plan (safety check)
            step_map = {s.step_id: s for s in plan.steps}
            group_steps = [step_map[sid] for sid in group if sid in step_map]
            if not group_steps:
                continue

            yield {
                "type": "steps_starting",
                "data": {"steps": [s.step_id for s in group_steps]},
            }

            # Build coroutines for this parallel group
            group_coros = [
                self._execute_step(step, context, results, user_id, prospect_id)
                for step in group_steps
            ]
            group_results = await asyncio.gather(*group_coros, return_exceptions=True)

            for step, result in zip(group_steps, group_results):
                if isinstance(result, Exception):
                    logger.error("Step %s failed: %s", step.step_id, result)
                    result = {"error": str(result)}

                results[step.step_id] = result
                step_credits = self._action_credits(step.action)
                credits_used += step_credits

                yield {
                    "type": "step_complete",
                    "data": {
                        "step_id": step.step_id,
                        "label": step.label,
                        "result": result,
                        "credits": step_credits,
                    },
                }

        # ── Phase 4: Merge artifact ───────────────────────────────────────
        yield {"type": "merging"}
        try:
            artifact = await self._merge_artifact(plan, results, context, credits_used, start_ms)
        except Exception as exc:
            logger.error("Artifact merger failed: %s", exc)
            # Produce a minimal artifact from raw step results
            artifact = self._fallback_artifact(plan, results, credits_used, start_ms)

        yield {"type": "complete", "data": artifact.model_dump()}

        # ── Phase 5: Audit log ─────────────────────────────────────────────
        try:
            self._audit.record(
                user_id=user_id,
                prospect_id=prospect_id,
                company_name=context.prospect_company or None,
                action_type="orchestrate",
                user_prompt=task,
                plan=plan.model_dump(),
                steps_run=[
                    {"step_id": sid, "result": r} for sid, r in results.items()
                ],
                output=artifact.model_dump(),
                status="success",
                credits_used=credits_used,
                duration_ms=int(time.time() * 1000) - start_ms,
            )
        except Exception as exc:
            logger.warning("Audit log failed (non-blocking): %s", exc)

    # ------------------------------------------------------------------ #
    # Planner                                                               #
    # ------------------------------------------------------------------ #

    async def _plan(self, task: str, context: UnifiedContext) -> ExecutionPlan:
        if self.mock:
            return MOCK_PLAN

        user_message = (
            f"User task: {task}\n\n"
            f"Available context summary: {context.to_summary()}"
        )
        raw = await self.openrouter.chat_completion_text(
            system_prompt=ORCHESTRATOR_PLANNER_PROMPT,
            user_prompt=user_message,
            max_tokens=600,
            temperature=0.1,
        )
        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        data = json.loads(raw)
        steps = [PlanStep(**s) for s in data.get("steps", [])]

        # Build parallel_groups if not provided by LLM
        parallel_groups = data.get("parallel_groups")
        if not parallel_groups:
            parallel_groups = self._infer_parallel_groups(steps)

        return ExecutionPlan(
            intent=data.get("intent", task),
            steps=steps,
            estimated_credits=data.get("estimated_credits", len(steps) + 1),
            parallel_groups=parallel_groups,
        )

    # ------------------------------------------------------------------ #
    # Step executor                                                         #
    # ------------------------------------------------------------------ #

    async def _execute_step(
        self,
        step: PlanStep,
        context: UnifiedContext,
        prior_results: Dict[str, Dict[str, Any]],
        user_id: str,
        prospect_id: str,
    ) -> Dict[str, Any]:
        from app.services.copilot.lead_copilot_service import LeadCopilotService

        svc = LeadCopilotService(self.db)

        # Build context overrides — inject unified context + any prior step outputs
        unified_ctx_text = context.to_prompt_sections()
        prior_outputs_text = ""
        if step.input_from:
            prior_parts = []
            for dep_id in step.input_from:
                dep_result = prior_results.get(dep_id, {})
                prior_parts.append(
                    f"=== OUTPUT FROM {dep_id} ===\n{json.dumps(dep_result, indent=2)}"
                )
            prior_outputs_text = "\n\n".join(prior_parts)

        context_overrides: Dict[str, Any] = {
            "unified_context": unified_ctx_text,
            # Inject identity so execute_action works even when prospect_id isn't a DB UUID
            "prospect": {
                "name": context.prospect_name or "",
                "title": context.prospect_title or "",
                "email": context.prospect_email,
                "linkedin_url": context.linkedin_url,
            },
            "company": {
                "name": context.prospect_company or "",
                "domain": context.prospect_domain,
            },
        }
        if prior_outputs_text:
            context_overrides["prior_step_outputs"] = prior_outputs_text

        # Build composite prompt
        prompt_parts = []
        if step.extra_instruction:
            prompt_parts.append(step.extra_instruction)
        if prior_outputs_text:
            prompt_parts.append(
                "Use the prior step outputs above as additional context."
            )
        prompt = "\n".join(prompt_parts) or None

        return await svc.execute_action(
            user_id=user_id,
            prospect_id=prospect_id,
            action_type=step.action,
            prompt=prompt,
            context_overrides=context_overrides,
        )

    # ------------------------------------------------------------------ #
    # Artifact merger                                                       #
    # ------------------------------------------------------------------ #

    async def _merge_artifact(
        self,
        plan: ExecutionPlan,
        results: Dict[str, Dict[str, Any]],
        context: UnifiedContext,
        credits_used: int,
        start_ms: int,
    ) -> OrchestratorArtifact:
        if self.mock:
            mock = MOCK_ARTIFACT
            mock.credits_used = credits_used
            mock.duration_ms = int(time.time() * 1000) - start_ms
            return mock

        step_map = {s.step_id: s for s in plan.steps}

        # Build sections list
        sections = [
            ArtifactSection(
                step_id=sid,
                label=step_map[sid].label if sid in step_map else sid,
                action=step_map[sid].action if sid in step_map else "custom",
                result=result,
            )
            for sid, result in results.items()
        ]

        # Merge prompt
        sections_text = "\n\n".join(
            f"=== {s.label.upper()} ===\n{json.dumps(s.result, indent=2)}"
            for s in sections
        )
        user_message = (
            f"Intent: {plan.intent}\n\n"
            f"Prospect: {context.prospect_name} at {context.prospect_company}\n\n"
            f"{sections_text}"
        )

        summary_raw = await self.openrouter.chat_completion_text(
            system_prompt=ARTIFACT_MERGER_PROMPT,
            user_prompt=user_message,
            max_tokens=900,
            temperature=0.3,
        )

        # The merger returns plain text; wrap in artifact structure
        return OrchestratorArtifact(
            intent=plan.intent,
            summary=summary_raw[:600],  # First ~600 chars as summary
            steps_completed=[s.label for s in sections],
            sections=sections,
            credits_used=credits_used,
            duration_ms=int(time.time() * 1000) - start_ms,
        )

    # ------------------------------------------------------------------ #
    # Helpers                                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _infer_parallel_groups(steps: List[PlanStep]) -> List[List[str]]:
        """Topological sort: group steps with no unmet dependencies together."""
        groups: List[List[str]] = []
        satisfied: set = set()

        remaining = list(steps)
        while remaining:
            ready = [
                s for s in remaining
                if all(dep in satisfied for dep in s.depends_on)
            ]
            if not ready:
                # Circular deps or unresolvable — just add all remaining in one group
                groups.append([s.step_id for s in remaining])
                break
            groups.append([s.step_id for s in ready])
            for s in ready:
                satisfied.add(s.step_id)
                remaining.remove(s)

        return groups

    @staticmethod
    def _action_credits(action: str) -> int:
        costs = {
            "research": 2, "meeting_prep": 2, "crossfire": 2,
            "bombora_intent": 2, "talent_radar": 2, "regime_shift": 2,
            "draft_email": 1, "objection_handler": 1, "compliance": 1,
            "find_similar": 1, "virality": 1, "website_traffic": 1,
            "business_events": 1, "custom": 1,
        }
        return costs.get(action, 1)

    @staticmethod
    def _fallback_artifact(
        plan: ExecutionPlan,
        results: Dict[str, Dict[str, Any]],
        credits_used: int,
        start_ms: int,
    ) -> OrchestratorArtifact:
        step_map = {s.step_id: s for s in plan.steps}
        sections = [
            ArtifactSection(
                step_id=sid,
                label=step_map[sid].label if sid in step_map else sid,
                action=step_map[sid].action if sid in step_map else "custom",
                result=result,
            )
            for sid, result in results.items()
        ]
        return OrchestratorArtifact(
            intent=plan.intent,
            summary=f"Completed {len(sections)} step(s): {', '.join(s.label for s in sections)}.",
            steps_completed=[s.label for s in sections],
            sections=sections,
            credits_used=credits_used,
            duration_ms=int(time.time() * 1000) - start_ms,
        )
