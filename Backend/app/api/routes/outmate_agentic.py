"""Routes for agentic-infra-backed agents.

This module is the bridge between the public Outmate API and the internal
outmate-agentic execution engine.  Every endpoint here:

  1. Verifies the caller via the existing Outmate JWT auth (`get_current_user`).
  2. Persists a row in `agent_runs` keyed by `user_id` BEFORE calling the engine.
  3. Calls the agentic infra at `settings.AGENTIC_INFRA_URL` using a service
     account API key (`x-api-key` header).  The agentic infra has no concept of
     individual Outmate users — it runs the flow as a service account.
  4. Stores the result back on the `agent_runs` row.
  5. On reads, hard-filters by `user_id` so User A can never see User B's data.

Tenant isolation lives in this file and the `agent_runs.user_id` column.
Nothing else.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.core.config import settings
from app.db.deps import get_db
from app.db.models.agent_run import AgentRun
from app.db.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Pydantic schemas — exactly the surface the Frontend talks to.
# ---------------------------------------------------------------------------


class SocialListeningRunRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    max_leads: int = Field(5, ge=1, le=20)
    client_company: Optional[str] = Field(None, max_length=200)
    client_description: Optional[str] = Field(None, max_length=2000)
    sender_name: Optional[str] = Field(None, max_length=120)
    message_type: Optional[str] = Field(None, max_length=80)
    tone: Optional[str] = Field(None, max_length=80)
    prospect_data: Optional[str] = Field(None, max_length=4000)
    system_prompt: Optional[str] = Field(None, max_length=4000)


class Lead(BaseModel):
    name: str
    title: str = ""
    company: str = ""
    email: str = ""
    email_unverified: bool = False
    linkedin: str = ""
    post_url: str = ""
    post_snippet: str = ""
    best_hook: str = ""
    message: str = ""
    char_count: int = 0
    char_limit: int = 300
    message_type: str = ""
    tone: str = ""


class AgentRunResponse(BaseModel):
    id: UUID
    agent_type: str
    status: str
    input: Dict[str, Any]
    leads: List[Lead] = []
    upgrade_tips: List[str] = []
    output_text: Optional[str] = None
    error_message: Optional[str] = None
    duration_ms: Optional[int] = None
    created_at: datetime
    finished_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/social-listening/run",
    response_model=AgentRunResponse,
    status_code=status.HTTP_200_OK,
)
async def run_social_listening(
    payload: SocialListeningRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentRunResponse:
    """Execute the Lead Discovery & Outreach agent for the current user.

    Synchronous: returns once the agent finishes (typically 30s–4min).  The row
    in `agent_runs` is written *before* the upstream call so a crash mid-run
    leaves a discoverable record with `status='running'`.
    """
    if not settings.AGENTIC_INFRA_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="agentic infra not configured",
        )

    # 1. Persist the row up-front so any crash leaves a trace tied to the user.
    run = AgentRun(
        user_id=current_user.id,
        agent_type="social-listening",
        flow_id=settings.AGENTIC_INFRA_SOCIAL_LISTENING_FLOW_ID,
        input=payload.model_dump(exclude_none=False),
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # 2. Build tweaks payload.  Per-run service-API keys are injected from this
    #    Backend's already-existing secrets so the agentic infra never needs its
    #    own copy of TAVILY_API_KEY / OPENROUTER_API_KEY / etc.
    tweak_fields: Dict[str, Any] = {
        "keyword": payload.topic,
        "max_leads": payload.max_leads,
    }
    for source_field, dest_field in (
        ("client_company", "client_company"),
        ("client_description", "client_description"),
        ("sender_name", "sender_name"),
        ("message_type", "message_type"),
        ("tone", "tone"),
        ("prospect_data", "prospect_data"),
        ("system_prompt", "system_prompt"),
    ):
        value = getattr(payload, source_field, None)
        if value:
            tweak_fields[dest_field] = value

    # NOTE: We deliberately do NOT inject API keys via tweaks. The agent's
    # secret fields have load_from_db=True, which means any value passed via
    # tweaks is treated as a workspace-variable NAME, not a literal value.
    # The agentic infra resolves keys from its own workspace variables /
    # environment.  In dev: variables exist on the local instance.  In prod:
    # outmate-agentic must have these set as container env vars or workspace
    # variables — see deployment notes.

    tweaks = {settings.AGENTIC_INFRA_SOCIAL_LISTENING_NODE_ID: tweak_fields}

    upstream_url = (
        f"{settings.AGENTIC_INFRA_URL.rstrip('/')}"
        f"/api/v1/run/{settings.AGENTIC_INFRA_SOCIAL_LISTENING_FLOW_ID}?stream=false"
    )
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if settings.AGENTIC_INFRA_API_KEY:
        # Production path: service-account key proves "I am outmate-api"
        headers["x-api-key"] = settings.AGENTIC_INFRA_API_KEY
    # else: dev path — relies on OUTMATE_AUTO_LOGIN + OUTMATE_SKIP_AUTH_AUTO_LOGIN
    # being enabled on a local agentic infra.  No header sent → bypass triggers.

    started_at = time.monotonic()
    output_text: Optional[str] = None
    error_message: Optional[str] = None

    try:
        async with httpx.AsyncClient(timeout=settings.AGENTIC_INFRA_TIMEOUT_SECONDS) as client:
            response = await client.post(
                upstream_url,
                headers=headers,
                json={
                    # Prefix matches the agent's "Run the agent for: ..."
                    # canonical pattern, which bypasses follow-up detection
                    # in lead_discovery_outreach_agent._extract_followup_question.
                    "input_value": f"Run the agent for: {payload.topic}",
                    "input_type": "chat",
                    "output_type": "chat",
                    # Fresh session_id per run → empty chat history → agent
                    # never enters follow-up mode and always runs full discovery.
                    "session_id": str(run.id),
                    "tweaks": tweaks,
                },
            )
        if response.status_code >= 400:
            snippet = response.text[:500] if response.text else f"HTTP {response.status_code}"
            raise RuntimeError(f"agentic infra returned {response.status_code}: {snippet}")
        output_text = _extract_chat_output(response.json())
        if not output_text:
            raise RuntimeError("agentic infra returned no chat output")
    except httpx.TimeoutException:
        error_message = (
            f"agentic infra did not respond within "
            f"{settings.AGENTIC_INFRA_TIMEOUT_SECONDS}s"
        )
    except httpx.HTTPError as exc:
        error_message = f"could not reach agentic infra: {exc}"
    except Exception as exc:  # noqa: BLE001 - we want to capture any failure
        error_message = str(exc)

    duration_ms = int((time.monotonic() - started_at) * 1000)
    finished_at = datetime.now(timezone.utc)

    leads: List[Dict[str, Any]] = []
    upgrade_tips: List[str] = []

    if output_text:
        leads, upgrade_tips = _parse_agent_markdown(output_text)
        run.output_text = output_text
        run.leads = leads
        run.upgrade_tips = upgrade_tips
        run.status = "success"
    else:
        run.status = "error"
        run.error_message = error_message or "unknown error"
        logger.warning(
            "social-listening run failed for user_id=%s run_id=%s: %s",
            current_user.id,
            run.id,
            run.error_message,
        )

    run.duration_ms = duration_ms
    run.finished_at = finished_at
    db.add(run)
    db.commit()
    db.refresh(run)

    if run.status == "error":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=run.error_message,
        )

    return _serialize_run(run)


@router.get(
    "/social-listening/runs",
    response_model=List[AgentRunResponse],
)
def list_social_listening_runs(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[AgentRunResponse]:
    """Return the current user's recent social-listening runs.

    Hard-filtered by `user_id` — there is no path through this endpoint that
    can return another user's row.
    """
    rows = (
        db.query(AgentRun)
        .filter(
            AgentRun.user_id == current_user.id,
            AgentRun.agent_type == "social-listening",
        )
        .order_by(AgentRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_run(r) for r in rows]


@router.get(
    "/social-listening/runs/{run_id}",
    response_model=AgentRunResponse,
)
def get_social_listening_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AgentRunResponse:
    """Fetch one run by id — only if it belongs to the current user."""
    row = (
        db.query(AgentRun)
        .filter(
            AgentRun.id == run_id,
            AgentRun.user_id == current_user.id,
            AgentRun.agent_type == "social-listening",
        )
        .first()
    )
    if not row:
        # 404 (not 403) so we don't leak the existence of other users' rows.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found")
    return _serialize_run(row)


@router.delete(
    "/social-listening/runs/{run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_social_listening_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete one of the current user's runs.  Returns 404 for any row not theirs."""
    row = (
        db.query(AgentRun)
        .filter(
            AgentRun.id == run_id,
            AgentRun.user_id == current_user.id,
            AgentRun.agent_type == "social-listening",
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="run not found")
    db.delete(row)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _serialize_run(run: AgentRun) -> AgentRunResponse:
    return AgentRunResponse(
        id=run.id,
        agent_type=run.agent_type,
        status=run.status,
        input=run.input or {},
        leads=[Lead(**lead) for lead in (run.leads or [])],
        upgrade_tips=run.upgrade_tips or [],
        output_text=run.output_text,
        error_message=run.error_message,
        duration_ms=run.duration_ms,
        created_at=run.created_at,
        finished_at=run.finished_at,
    )


def _extract_chat_output(payload: Any) -> str:
    """Walk the agentic infra's nested run response and return the chat text.

    The shape varies across versions; we BFS for the first text field
    containing the agent's `## Lead Profile:` marker, then fall back to a
    DFS for the longest such string.  This survives shape changes in the
    upstream runtime.
    """
    if not isinstance(payload, (dict, list)):
        return ""

    queue: List[Any] = [payload]
    seen: set = set()

    while queue:
        item = queue.pop(0)
        item_id = id(item)
        if item_id in seen:
            continue
        seen.add(item_id)

        if isinstance(item, dict):
            text_field = item.get("text")
            if isinstance(text_field, str) and "Lead Profile:" in text_field:
                return text_field
            results = item.get("results")
            if isinstance(results, dict):
                msg = results.get("message")
                if isinstance(msg, dict):
                    text = msg.get("text")
                    if isinstance(text, str) and text:
                        return text
            for value in item.values():
                if isinstance(value, (dict, list)):
                    queue.append(value)
        elif isinstance(item, list):
            queue.extend(item)

    # DFS fallback — longest string containing the marker.
    best = ""
    stack: List[Any] = [payload]
    seen2: set = set()
    while stack:
        item = stack.pop()
        item_id = id(item)
        if item_id in seen2:
            continue
        seen2.add(item_id)
        if isinstance(item, str):
            if "Lead Profile:" in item and len(item) > len(best):
                best = item
        elif isinstance(item, dict):
            stack.extend(item.values())
        elif isinstance(item, list):
            stack.extend(item)
    return best


# Markdown parser for the LeadDiscoveryOutreachAgent's `_phase_format_output`.
# Mirrors Frontend/lib/social-agent.ts so the Backend stores structured leads
# instead of asking the client to re-parse on every page load.

_LEAD_BLOCK_SPLIT = re.compile(r"\n?---\n## Lead Profile:")
_TIPS_TAIL = re.compile(r"\n---\n### Upgrade Tips\n([\s\S]*?)$")


def _parse_agent_markdown(markdown: str) -> tuple[list[dict], list[str]]:
    if not markdown:
        return [], []

    body = markdown
    upgrade_tips: list[str] = []

    tips_match = _TIPS_TAIL.search(markdown)
    if tips_match:
        body = markdown[: tips_match.start()]
        for line in tips_match.group(1).split("\n"):
            cleaned = line.lstrip("- ").strip()
            if cleaned:
                upgrade_tips.append(cleaned)

    blocks = _LEAD_BLOCK_SPLIT.split(body)
    leads: list[dict] = []
    for i, block in enumerate(blocks):
        if i == 0:
            block = block.lstrip("---\n").lstrip()
            if "## Lead Profile:" in block:
                block = block.split("## Lead Profile:", 1)[1]
            else:
                continue
        lead = _parse_lead_block(block)
        if lead:
            leads.append(lead)
    return leads, upgrade_tips


def _parse_lead_block(block: str) -> Optional[dict]:
    first_nl = block.find("\n")
    if first_nl < 0:
        return None
    name = block[:first_nl].strip()
    if not name:
        return None

    title_line = _match_line(block, r"\*\*Title:\*\*\s*(.+)")
    title = ""
    company = ""
    if title_line:
        if " at " in title_line:
            title, _, company = title_line.rpartition(" at ")
            title = title.strip()
            company = company.strip()
        else:
            title = title_line.strip()

    email_raw = _match_line(block, r"\*\*Email:\*\*\s*(.+)") or ""
    email_unverified = "(unverified)" in email_raw.lower()
    email = email_raw.replace("(unverified)", "").strip()
    if email.lower() == "not found":
        email = ""

    linkedin = (_match_line(block, r"\*\*LinkedIn:\*\*\s*(.+)") or "").strip()

    post_url = ""
    post_snippet = ""
    post_match = re.search(
        r"### Recent Posts:\n1\.\s*\[([^\]]*)\]\(([^)]*)\)\s*—\s*\"([^\"]*)\"",
        block,
    )
    if post_match:
        post_url = post_match.group(2).strip()
        post_snippet = post_match.group(3).strip() or post_match.group(1).strip()

    best_hook = (_match_line(block, r"### Best Hook:\n-\s*(.+)") or "").strip()

    message = ""
    msg_match = re.search(
        r"\*\*Message:\*\*\n([\s\S]*?)\n\n\*\*Character Count:",
        block,
    )
    if msg_match:
        message = msg_match.group(1).strip()

    char_count = len(message)
    char_limit = 300
    cc_match = re.search(r"\*\*Character Count:\*\*\s*(\d+)\s*/\s*(\d+)", block)
    if cc_match:
        char_count = int(cc_match.group(1))
        char_limit = int(cc_match.group(2))

    type_tone_line = _match_line(block, r"\*\*Type:\*\*\s*(.+)") or ""
    message_type = type_tone_line.split("|")[0].strip() if type_tone_line else ""
    tone_match = re.search(r"\*\*Tone:\*\*\s*(.+)", type_tone_line)
    tone = tone_match.group(1).strip() if tone_match else ""

    return {
        "name": name,
        "title": title,
        "company": company,
        "email": email,
        "email_unverified": email_unverified,
        "linkedin": linkedin,
        "post_url": post_url,
        "post_snippet": post_snippet,
        "best_hook": best_hook,
        "message": message,
        "char_count": char_count,
        "char_limit": char_limit,
        "message_type": message_type,
        "tone": tone,
    }


def _match_line(text: str, pattern: str) -> Optional[str]:
    m = re.search(pattern, text)
    return m.group(1) if m else None
