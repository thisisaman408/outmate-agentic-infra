"""Outcome runs API: groups vertex_build rows into per-run summaries with
structured columns for the Outcome tab.

We don't add a new table — the agentic backend already records every vertex
execution into `vertex_build`. We aggregate those rows here:

- group by `(flow_id, run_id_proxy)` where run_id_proxy = job_id when set,
  otherwise the timestamp bucket of the latest output vertex
- the row's "output text" is the last output-type vertex's message
- the row's status is `completed` iff every vertex in the group is `valid`,
  else `failed`
- structured columns are produced by `outcome_extractors.extract_for_flow`

The frontend's Outcome tab consumes this endpoint exclusively.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from outmate.agentic.services.outcome_extractors import (
    ExtractedRun,
    extract_for_flow,
)
from outmate.api.utils.core import CurrentActiveUser, DbSession
from outmate.services.database.models.flow.model import Flow
from outmate.services.database.models.vertex_builds.model import VertexBuildTable

router = APIRouter(prefix="/agentic", tags=["Agentic"])


# ---------------------------------------------------------------------------
# Pulling the message text out of a vertex build row
# ---------------------------------------------------------------------------


def _extract_message_text(build_data: Any) -> str:
    """Pull the chat-style message text out of a vertex_build.data payload.

    `vertex_build.data` is a serialized `ResultDataResponse` whose shape is:
        { results: { message: { text: "..." } | str },
          outputs: { <name>: { message: { text: "..." } | str } },
          ... }
    Different node types nest the text under different keys. We try the
    common ones in order. Returns "" if nothing usable is found.
    """
    if not build_data:
        return ""
    if isinstance(build_data, str):
        return build_data

    if not isinstance(build_data, dict):
        return ""

    # Inspect outputs first — that's where final agent text most often sits.
    outputs = build_data.get("outputs") or {}
    if isinstance(outputs, dict):
        for _, out in outputs.items():
            text = _coerce_message(out)
            if text:
                return text

    # Fall back to results.
    results = build_data.get("results") or {}
    if isinstance(results, dict):
        text = _coerce_message(results)
        if text:
            return text
        for _, val in results.items():
            text = _coerce_message(val)
            if text:
                return text

    # Top-level "message" or "text".
    top = _coerce_message(build_data)
    return top or ""


def _coerce_message(node: Any) -> str:
    """Best-effort: pull a string out of a nested message-like dict."""
    if isinstance(node, str):
        return node
    if not isinstance(node, dict):
        return ""
    if isinstance(node.get("text"), str):
        return node["text"]
    msg = node.get("message")
    if isinstance(msg, str):
        return msg
    if isinstance(msg, dict):
        if isinstance(msg.get("text"), str):
            return msg["text"]
        if isinstance(msg.get("message"), str):
            return msg["message"]
    # Some agent components stash the final brief on `result`.
    result = node.get("result")
    if isinstance(result, str):
        return result
    return ""


# ---------------------------------------------------------------------------
# Run aggregation
# ---------------------------------------------------------------------------


def _bucket_key(build: VertexBuildTable) -> str:
    """Group key for a build → which run it belongs to.

    Prefer `job_id` when set (the modern build path stamps it). Otherwise
    bucket by minute of the timestamp so concurrent vertices from the same
    Run still group together.
    """
    if build.job_id:
        return f"job:{build.job_id}"
    ts = build.timestamp.replace(second=0, microsecond=0).isoformat()
    return f"ts:{ts}"


def _is_terminal_node_id(vertex_id: str) -> bool:
    """Heuristic: terminal nodes that hold the final user-facing output.

    Chat outputs always end in ChatOutput-XXX, agent outputs typically end
    in *Agent-XXX. We prefer ChatOutput; if absent, fall back to the latest
    Agent vertex's text.
    """
    return vertex_id.startswith("ChatOutput") or "ChatOutput" in vertex_id


def _agent_or_terminal(vertex_id: str) -> bool:
    return _is_terminal_node_id(vertex_id) or "Agent" in vertex_id or "Output" in vertex_id


def _aggregate_runs(
    builds: list[VertexBuildTable],
    flow_name: str | None,
    flow_data: dict | None,
) -> list[dict]:
    """Group vertex_build rows into Outcome runs."""
    if not builds:
        return []

    by_bucket: dict[str, list[VertexBuildTable]] = {}
    for b in builds:
        by_bucket.setdefault(_bucket_key(b), []).append(b)

    runs: list[dict] = []
    for run_id, items in by_bucket.items():
        items_sorted = sorted(items, key=lambda b: b.timestamp)
        first = items_sorted[0]
        last = items_sorted[-1]

        # Status: any invalid vertex → failed. (We don't bubble error_message
        # because vertex_build doesn't store it explicitly; the failed
        # vertex's `data.outputs` typically embeds the error.)
        status = "completed" if all(b.valid for b in items_sorted) else "failed"

        # Find the best terminal vertex's text — prefer ChatOutput, then
        # any Agent / Output node, in order of recency.
        terminal_text = ""
        for b in reversed(items_sorted):
            if _is_terminal_node_id(b.id):
                terminal_text = _extract_message_text(b.data)
                if terminal_text:
                    break
        if not terminal_text:
            for b in reversed(items_sorted):
                if _agent_or_terminal(b.id):
                    terminal_text = _extract_message_text(b.data)
                    if terminal_text:
                        break

        # Duration: span from first to last build in the group.
        duration_ms = int((last.timestamp - first.timestamp).total_seconds() * 1000)

        if status == "completed":
            extracted: list[ExtractedRun] = extract_for_flow(
                flow_name, flow_data, terminal_text
            )
        else:
            # Find the failing vertex's params (which Langflow stuffs error
            # info into) and surface that as a single explanatory row so the
            # user sees WHY the run failed instead of an empty table.
            failing = next((b for b in items_sorted if not b.valid), items_sorted[-1])
            err_text = (
                str(failing.params)
                if failing.params
                else _extract_message_text(failing.data) or "Run failed (no error message captured)"
            )
            extracted = [
                ExtractedRun(
                    title=f"Failed at {failing.id}",
                    template="Failed",
                    columns={"Failed node": failing.id, "Reason": (err_text[:160] + "…") if len(err_text) > 160 else err_text},
                    sections={"Full error": err_text},
                )
            ]

        # If the parser returned multiple rows (e.g. ICP scoring 5 leads in
        # one run), each becomes its own row in the table — but they share
        # the same run_id so the UI can group / collapse them.
        rows = [
            {
                "title": e.title,
                "template": e.template,
                "columns": e.columns,
                "sections": e.sections,
            }
            for e in extracted
        ]

        runs.append(
            {
                "run_id": run_id,
                "status": status,
                "started_at": first.timestamp.isoformat(),
                "finished_at": last.timestamp.isoformat(),
                "duration_ms": duration_ms,
                "vertex_count": len(items_sorted),
                "output_text": terminal_text,
                "rows": rows,
            }
        )

    runs.sort(key=lambda r: r["finished_at"], reverse=True)
    return runs


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/runs")
async def list_runs(
    current_user: CurrentActiveUser,
    session: DbSession,
    flow_id: UUID = Query(..., description="The flow whose runs to summarise."),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    _ = current_user  # auth gate; runs are scoped per-flow which is per-user
    """Return aggregated runs (with per-template structured columns) for a flow.

    Response shape:
        {
          "flow_id": "...",
          "template": "Prospect Research" | "ICP Scoring" | ... | "Generic",
          "runs": [
            {
              "run_id": "...",
              "status": "completed" | "failed",
              "started_at": "...",
              "finished_at": "...",
              "duration_ms": 4321,
              "vertex_count": 6,
              "output_text": "<raw markdown>",
              "rows": [
                { "title": "...", "template": "...", "columns": {...}, "sections": {...} }
              ]
            },
            ...
          ]
        }
    """
    flow = await session.get(Flow, flow_id)
    if not flow:
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found")
    # Tenant isolation: deliberately return 404 (not 403) for cross-tenant
    # access attempts so existence isn't leaked. Service-account / superuser
    # callers (used by the main backend's billing scrape) are exempt.
    if (
        flow.user_id is not None
        and flow.user_id != current_user.id
        and not getattr(current_user, "is_superuser", False)
    ):
        raise HTTPException(status_code=404, detail=f"Flow {flow_id} not found")

    stmt = (
        select(VertexBuildTable)
        .where(VertexBuildTable.flow_id == flow_id)
        .order_by(VertexBuildTable.timestamp.desc())
        .limit(limit * 32)  # generous: each run produces multiple vertex builds
    )
    # `session.exec(...).all()` on the bare SQLAlchemy AsyncSession returns
    # Row tuples, not model instances — `_aggregate_runs` then blows up the
    # first time it touches `b.id` and the endpoint silently 500s, which
    # showed up in the UI as a permanent "No runs yet" / 0 counts. Use
    # `.scalars()` so we get VertexBuildTable instances back.
    result = await session.execute(stmt)
    builds = result.scalars().all()

    runs = _aggregate_runs(list(builds), flow.name, flow.data)[:limit]

    # Detect template even when there are no successful runs yet, so the
    # Outcome tab still labels itself correctly and the user sees what
    # columns will appear once a run completes.
    from outmate.agentic.services.outcome_extractors import (
        _BY_AGENT_NAME,
        _BY_TEMPLATE_NAME,
        _detect_agent_in_flow,
    )

    template = "Generic"
    for r in runs:
        for row in r["rows"]:
            t = row.get("template")
            if t and t != "Generic":
                template = t
                break
        if template != "Generic":
            break

    if template == "Generic":
        agent_type = _detect_agent_in_flow(flow.data)
        if agent_type and agent_type in _BY_AGENT_NAME:
            # Use the same human label the parser emits.
            label_map = {
                "ProspectResearchAgent": "Prospect Research",
                "ICPScoringAgent": "ICP Scoring",
                "HyperPersonalisationAgent": "Hyper-Personalisation",
            }
            template = label_map.get(agent_type, agent_type)
        elif flow.name and flow.name.strip() in _BY_TEMPLATE_NAME:
            label_map = {
                "Prospect Research Agent": "Prospect Research",
                "ICP Scoring Agent": "ICP Scoring",
                "Hyper-Personalisation Agent": "Hyper-Personalisation",
            }
            template = label_map.get(flow.name.strip(), flow.name.strip())

    return {
        "flow_id": str(flow_id),
        "flow_name": flow.name,
        "template": template,
        "runs": runs,
        "fetched_at": datetime.utcnow().isoformat(),
    }
