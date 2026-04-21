# Voice Campaigns — Background Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Voice Agent's single-prospect "New Voice Campaign" dialog into a proper multi-prospect campaign system that runs in the background via Celery, with prospect sources (Manual list / CSV / HubSpot list / Hot Signals segment), rename the existing single-call dialog to "Quick call", and surface live progress + per-call transcripts in the UI.

**Architecture:**
- Two DB tables: `voice_campaigns` (header) + `voice_campaign_prospects` (one row per prospect; mirrors queue state and stores per-call `agent_run_id`)
- Celery task `run_voice_campaign` iterates pending prospects, respects `max_calls_per_day`, calls the existing `trigger-call` flow per prospect (Retell → webhook pipeline unchanged), writes status back to the prospect row
- Source resolver maps wizard choice → list of prospect dicts (`{name, phone, company, role, city, industry, context}`)
- Frontend wizard for creation, detail page polls `/campaigns/{id}` every 5s for live progress; transcripts already served by existing `/call-details/{run_id}`

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Celery (Redis broker, already configured), Retell AI (existing), HubSpot OAuth (existing via `HubSpotService`), Next.js App Router, Radix UI dialogs, Zustand (light local state only)

---

## File Structure

**Backend — new files:**
- `Backend/app/db/models/voice_campaign.py` — `VoiceCampaign` + `VoiceCampaignProspect` ORM models
- `Backend/alembic/versions/y2z3a4b5c6d7_add_voice_campaign_tables.py` — migration
- `Backend/app/api/routes/voice_campaigns.py` — campaign CRUD + launch + status endpoints
- `Backend/app/tasks/voice_campaign_tasks.py` — `run_voice_campaign` Celery task
- `Backend/app/services/voice_campaign/__init__.py`
- `Backend/app/services/voice_campaign/segment_resolver.py` — hot-signals query → prospect list
- `Backend/app/services/voice_campaign/hubspot_list_resolver.py` — HubSpot list → prospect list

**Backend — modified files:**
- `Backend/app/services/hubspot_service.py` — add `list_contact_lists(user_id)` + `list_contacts_in_list(user_id, list_id)`
- `Backend/app/db/models/__init__.py` — export new models
- `Backend/app/main.py` — register new router
- `Backend/app/core/celery_app.py` — include new tasks module

**Frontend — new files:**
- `Frontend/lib/api/voice-campaigns.ts` — API client
- `Frontend/components/voice-agent/campaign-wizard.tsx` — 3-step wizard (source → preview → launch)
- `Frontend/app/(dashboard)/voice-agent/campaigns/[id]/page.tsx` — live campaign detail page

**Frontend — modified files:**
- `Frontend/app/(dashboard)/voice-agent/page.tsx` — rename "New Voice Campaign" dialog to "Quick call" (button copy + dialog title only; the endpoint stays the same); add "+ New campaign" button + campaigns table

---

## Task 1: VoiceCampaign ORM models

**Files:**
- Create: `Backend/app/db/models/voice_campaign.py`

- [ ] **Step 1: Write the model file**

```python
"""Voice campaign header + per-prospect row.

A campaign is a batch of outbound voice calls the background Celery worker
(`run_voice_campaign`) dispatches one-by-one, respecting `max_calls_per_day`
and the user's pause state.  Each prospect row mirrors one call attempt and
stores the `agent_run_id` so we can join into transcripts + extracted vars
via the existing `/voice-agent/call-details/{run_id}` endpoint.

Tenant isolation: every read MUST filter by `user_id`.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class VoiceCampaign(Base):
    """One voice-call campaign header row."""

    __tablename__ = "voice_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name = Column(String(255), nullable=False)
    call_objective = Column(String(128), nullable=False, default="discovery")
    # manual | csv | hubspot | hot_signals
    source_type = Column(String(32), nullable=False)
    # Opaque, source-specific selector (e.g. {"list_id": "42"} or
    # {"min_intent": 70, "days": 7, "signal_types": ["funding"]})
    source_params = Column(JSONB, nullable=False, default=dict)

    max_calls_per_day = Column(Integer, nullable=False, default=50)

    # queued | running | paused | completed | cancelled | error
    status = Column(String(32), nullable=False, default="queued", index=True)
    error_message = Column(Text, nullable=True)

    total_prospects = Column(Integer, nullable=False, default=0)
    calls_made = Column(Integer, nullable=False, default=0)
    calls_booked = Column(Integer, nullable=False, default=0)
    calls_failed = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", lazy="joined")
    prospects = relationship(
        "VoiceCampaignProspect",
        back_populates="campaign",
        cascade="all, delete-orphan",
        lazy="select",
    )

    __table_args__ = (
        Index("ix_voice_campaigns_user_created", "user_id", "created_at"),
    )


class VoiceCampaignProspect(Base):
    """One prospect in a campaign — mirrors one outbound call attempt."""

    __tablename__ = "voice_campaign_prospects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(
        UUID(as_uuid=True),
        ForeignKey("voice_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Prospect payload used to call Retell.  Mirrors TriggerCallRequest fields.
    prospect_name = Column(String(255), nullable=False)
    prospect_phone = Column(String(50), nullable=False)
    prospect_company = Column(String(255), nullable=False, default="")
    prospect_role = Column(String(255), nullable=False, default="")
    prospect_city = Column(String(128), nullable=False, default="")
    prospect_industry = Column(String(128), nullable=False, default="")
    context = Column(Text, nullable=False, default="")

    # queued | calling | success | error | skipped
    status = Column(String(32), nullable=False, default="queued", index=True)
    error_message = Column(Text, nullable=True)

    # When the Celery worker picks this row up.
    attempted_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    # FK into outmate_agent_runs — the real transcript + extracted vars live
    # there, already populated by the existing Retell webhook.
    agent_run_id = Column(
        UUID(as_uuid=True),
        ForeignKey("outmate_agent_runs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    campaign = relationship("VoiceCampaign", back_populates="prospects")

    __table_args__ = (
        Index("ix_vcp_campaign_status", "campaign_id", "status"),
    )
```

- [ ] **Step 2: Register models in `__init__.py`**

Modify `Backend/app/db/models/__init__.py`:

```python
# Add near the other model imports, after Workflow import:
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect
```

And append to `__all__`:

```python
    # Voice campaigns
    "VoiceCampaign",
    "VoiceCampaignProspect",
```

- [ ] **Step 3: Commit**

```bash
git add Backend/app/db/models/voice_campaign.py Backend/app/db/models/__init__.py
git commit -m "feat(voice): add VoiceCampaign + VoiceCampaignProspect models"
```

---

## Task 2: Alembic migration for voice_campaign tables

**Files:**
- Create: `Backend/alembic/versions/y2z3a4b5c6d7_add_voice_campaign_tables.py`

- [ ] **Step 1: Write the migration**

```python
"""Add voice_campaigns + voice_campaign_prospects tables

Revision ID: y2z3a4b5c6d7
Revises: x1y2z3a4b5c6
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "y2z3a4b5c6d7"
down_revision = "x1y2z3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "voice_campaigns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("call_objective", sa.String(128), nullable=False, server_default="discovery"),
        sa.Column("source_type", sa.String(32), nullable=False),
        sa.Column("source_params", JSONB(), nullable=False, server_default="{}"),
        sa.Column("max_calls_per_day", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("total_prospects", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("calls_made", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("calls_booked", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("calls_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_voice_campaigns_user_id", "voice_campaigns", ["user_id"])
    op.create_index("ix_voice_campaigns_status", "voice_campaigns", ["status"])
    op.create_index("ix_voice_campaigns_user_created", "voice_campaigns", ["user_id", "created_at"])

    op.create_table(
        "voice_campaign_prospects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("voice_campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prospect_name", sa.String(255), nullable=False),
        sa.Column("prospect_phone", sa.String(50), nullable=False),
        sa.Column("prospect_company", sa.String(255), nullable=False, server_default=""),
        sa.Column("prospect_role", sa.String(255), nullable=False, server_default=""),
        sa.Column("prospect_city", sa.String(128), nullable=False, server_default=""),
        sa.Column("prospect_industry", sa.String(128), nullable=False, server_default=""),
        sa.Column("context", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agent_run_id", UUID(as_uuid=True), sa.ForeignKey("outmate_agent_runs.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_vcp_campaign_id", "voice_campaign_prospects", ["campaign_id"])
    op.create_index("ix_vcp_user_id", "voice_campaign_prospects", ["user_id"])
    op.create_index("ix_vcp_status", "voice_campaign_prospects", ["status"])
    op.create_index("ix_vcp_agent_run_id", "voice_campaign_prospects", ["agent_run_id"])
    op.create_index("ix_vcp_campaign_status", "voice_campaign_prospects", ["campaign_id", "status"])


def downgrade():
    op.drop_index("ix_vcp_campaign_status", table_name="voice_campaign_prospects")
    op.drop_index("ix_vcp_agent_run_id", table_name="voice_campaign_prospects")
    op.drop_index("ix_vcp_status", table_name="voice_campaign_prospects")
    op.drop_index("ix_vcp_user_id", table_name="voice_campaign_prospects")
    op.drop_index("ix_vcp_campaign_id", table_name="voice_campaign_prospects")
    op.drop_table("voice_campaign_prospects")

    op.drop_index("ix_voice_campaigns_user_created", table_name="voice_campaigns")
    op.drop_index("ix_voice_campaigns_status", table_name="voice_campaigns")
    op.drop_index("ix_voice_campaigns_user_id", table_name="voice_campaigns")
    op.drop_table("voice_campaigns")
```

- [ ] **Step 2: Run the migration**

```bash
cd Backend && alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade x1y2z3a4b5c6 -> y2z3a4b5c6d7, Add voice_campaigns ...`

- [ ] **Step 3: Verify tables exist**

```bash
cd Backend && python -c "from app.db.session import engine; from sqlalchemy import inspect; i=inspect(engine); print([t for t in i.get_table_names() if 'voice_camp' in t])"
```

Expected output: `['voice_campaigns', 'voice_campaign_prospects']`

- [ ] **Step 4: Commit**

```bash
git add Backend/alembic/versions/y2z3a4b5c6d7_add_voice_campaign_tables.py
git commit -m "feat(voice): migration for voice_campaigns + voice_campaign_prospects"
```

---

## Task 3: Hot Signals segment resolver

**Files:**
- Create: `Backend/app/services/voice_campaign/__init__.py`
- Create: `Backend/app/services/voice_campaign/segment_resolver.py`

- [ ] **Step 1: Create the package init**

Write `Backend/app/services/voice_campaign/__init__.py`:

```python
"""Voice campaign helpers — source resolvers that turn a campaign's
`source_type` + `source_params` into a concrete list of prospect dicts
the Celery worker will call."""
```

- [ ] **Step 2: Write the hot-signals resolver**

Write `Backend/app/services/voice_campaign/segment_resolver.py`:

```python
"""Hot Signals segment resolver.

Query `signal_events` joined with `signal_watcher_matches` (tenant
isolation) and `prospects` (phone number) to produce the list of callable
prospects for a "hot_signals" campaign.

Params schema (`source_params`):
    {
      "min_intent": 70,              # icp_score >= this
      "days": 7,                     # discovered_at within last N days
      "signal_types": ["funding", "hiring", "job_change"],  # optional
      "max_prospects": 200,          # hard cap
    }
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.prospect import Prospect
from app.db.models.signal_event import SignalEvent
from app.db.models.signal_watcher_match import SignalWatcherMatch


def resolve_hot_signals(
    db: Session, user_id: UUID, params: Dict[str, Any]
) -> List[Dict[str, str]]:
    """Return a list of prospect dicts ready for `TriggerCallRequest`.

    Joins signal_events → signal_watcher_matches (to enforce user scope) →
    prospects (to pull a callable phone number).  Signals without a
    matched prospect that has a phone are filtered out.
    """
    min_intent = int(params.get("min_intent", 70))
    days = int(params.get("days", 7))
    signal_types = params.get("signal_types") or []
    max_prospects = int(params.get("max_prospects", 200))

    since = datetime.now(timezone.utc) - timedelta(days=days)

    q = (
        db.query(SignalEvent, Prospect)
        .join(SignalWatcherMatch, SignalWatcherMatch.signal_id == SignalEvent.id)
        .join(Prospect, Prospect.id == SignalEvent.prospect_id)
        .filter(SignalWatcherMatch.user_id == user_id)
        .filter(SignalEvent.is_archived == False)  # noqa: E712
        .filter(SignalEvent.discovered_at >= since)
        .filter(SignalEvent.icp_score.isnot(None))
        .filter(SignalEvent.icp_score >= min_intent)
        .filter(Prospect.phone.isnot(None))
        .filter(Prospect.phone != "")
    )

    if signal_types:
        q = q.filter(SignalEvent.signal_type.in_(signal_types))

    q = q.order_by(SignalEvent.icp_score.desc(), SignalEvent.discovered_at.desc()).limit(max_prospects)

    rows = q.all()

    # Dedup by phone — one prospect, one call, regardless of how many signals.
    seen_phones: set[str] = set()
    prospects: List[Dict[str, str]] = []
    for signal, prospect in rows:
        if not prospect.phone or prospect.phone in seen_phones:
            continue
        seen_phones.add(prospect.phone)

        name = prospect.full_name or f"{prospect.first_name or ''} {prospect.last_name or ''}".strip() or "Unknown"
        # Signal becomes the call context — this is the "why we're calling"
        signal_blurb = _describe_signal(signal)
        prospects.append({
            "prospect_name": name,
            "prospect_phone": prospect.phone,
            "prospect_company": signal.company_name or "",
            "prospect_role": prospect.job_title or signal.prospect_title or "",
            "prospect_city": prospect.city or "",
            "prospect_industry": "",
            "context": signal_blurb,
        })

    return prospects


def _describe_signal(signal: SignalEvent) -> str:
    """One-sentence context line fed into the Retell `lead_context` variable."""
    st = (signal.signal_type or "").lower()
    co = signal.company_name or "their company"
    if st == "funding":
        return f"{co} recently raised funding — time-sensitive discovery call."
    if st == "hiring":
        return f"{co} is actively hiring GTM roles — scaling outbound team."
    if st == "job_change":
        return f"{signal.prospect_name or 'Prospect'} recently changed roles at {co}."
    if st == "g2_intent":
        return f"{co} showed buying intent in a competitive review context."
    if st == "website_visit":
        return f"{co} visited the Outmate website recently."
    return f"Fresh signal detected for {co} ({st or 'general'})."
```

- [ ] **Step 3: Smoke-test the resolver against the real DB**

Run:

```bash
cd Backend && python -c "
from uuid import UUID
from app.db.session import SessionLocal
from app.services.voice_campaign.segment_resolver import resolve_hot_signals
db = SessionLocal()
# Pick any real user id from the DB
from app.db.models.user import User
u = db.query(User).first()
print('user:', u.id if u else 'NONE')
rows = resolve_hot_signals(db, u.id, {'min_intent': 0, 'days': 365, 'max_prospects': 10}) if u else []
print('rows:', len(rows))
for r in rows[:3]:
    print('  ', r['prospect_name'], '-', r['prospect_phone'], '-', r['context'][:60])
db.close()
"
```

Expected: prints a user id and `rows:` count (may be 0 if no phone-enriched signals yet — that's fine; the point is no SQL errors).

- [ ] **Step 4: Commit**

```bash
git add Backend/app/services/voice_campaign/
git commit -m "feat(voice): hot-signals segment resolver"
```

---

## Task 4: HubSpot list methods on HubSpotService

**Files:**
- Modify: `Backend/app/services/hubspot_service.py`

- [ ] **Step 1: Add `list_contact_lists` + `list_contacts_in_list` methods**

Add these methods at the end of the `HubSpotService` class in `Backend/app/services/hubspot_service.py` (after `search_contact`, before `_get_integration_row`):

```python
    async def list_contact_lists(self, user_id, limit: int = 50) -> List[Dict[str, Any]]:
        """Return all HubSpot contact lists the user can see.

        Uses HubSpot's v3 lists endpoint.  Each result has {listId, name,
        processingType, additionalProperties}.
        """
        token = await self._get_or_refresh_token(user_id)
        if not token:
            return []

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{HUBSPOT_API_BASE}/crm/v3/lists",
                headers={"Authorization": f"Bearer {token}"},
                params={"count": limit},
            )
            if resp.status_code != 200:
                return []
            body = resp.json()
            return body.get("lists", []) or body.get("results", [])

    async def list_contacts_in_list(
        self, user_id, list_id: str, limit: int = 200
    ) -> List[Dict[str, Any]]:
        """Return contacts in a specific HubSpot list.

        Calls GET /crm/v3/lists/{listId}/memberships then fetches contact
        details in bulk to get phone + company properties.
        """
        token = await self._get_or_refresh_token(user_id)
        if not token:
            return []

        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: membership IDs
            mem_resp = await client.get(
                f"{HUBSPOT_API_BASE}/crm/v3/lists/{list_id}/memberships",
                headers={"Authorization": f"Bearer {token}"},
                params={"limit": limit},
            )
            if mem_resp.status_code != 200:
                return []
            record_ids = [m.get("recordId") for m in mem_resp.json().get("results", []) if m.get("recordId")]
            if not record_ids:
                return []

            # Step 2: batch-read contact details
            batch_resp = await client.post(
                f"{HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "properties": ["firstname", "lastname", "email", "phone",
                                   "mobilephone", "company", "jobtitle", "city"],
                    "inputs": [{"id": rid} for rid in record_ids],
                },
            )
            if batch_resp.status_code != 200:
                return []
            return batch_resp.json().get("results", [])

    async def _get_or_refresh_token(self, user_id) -> Optional[str]:
        """Get a valid token, refreshing if the stored one is expired."""
        token = self._get_access_token(user_id)
        if token:
            return token
        return await self.refresh_token(user_id)
```

- [ ] **Step 2: Verify with a real (or mock) token**

```bash
cd Backend && python -c "
import asyncio
from app.services.hubspot_service import HubSpotService
from app.db.session import SessionLocal
from app.db.models.user import User
db = SessionLocal()
u = db.query(User).first()
async def main():
    s = HubSpotService(db)
    print('connected:', s.is_connected(u))
    if s.is_connected(u).get('connected'):
        lists = await s.list_contact_lists(u.id)
        print('lists:', len(lists))
        if lists:
            sample = await s.list_contacts_in_list(u.id, str(lists[0].get('listId') or lists[0].get('id')))
            print('contacts in first list:', len(sample))
asyncio.run(main())
db.close()
"
```

Expected: either `connected: {...'connected': False}` (no user has HubSpot linked yet — fine) or real numbers without exceptions.

- [ ] **Step 3: Commit**

```bash
git add Backend/app/services/hubspot_service.py
git commit -m "feat(hubspot): list_contact_lists + list_contacts_in_list"
```

---

## Task 5: HubSpot list resolver (campaign source → prospect dicts)

**Files:**
- Create: `Backend/app/services/voice_campaign/hubspot_list_resolver.py`

- [ ] **Step 1: Write the resolver**

```python
"""HubSpot list → prospect dicts for voice campaigns.

Params schema:
    {"list_id": "42"}

Uses the existing OAuth token (HubSpotService) — no separate auth flow
on the voice-agent side.  If the user has not connected HubSpot yet,
the endpoint caller raises a 400 before we get here.
"""

from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.hubspot_service import HubSpotService


async def resolve_hubspot_list(
    db: Session, user_id: UUID, params: Dict[str, Any]
) -> List[Dict[str, str]]:
    list_id = str(params.get("list_id") or "").strip()
    if not list_id:
        return []

    svc = HubSpotService(db)
    contacts = await svc.list_contacts_in_list(user_id, list_id)

    prospects: List[Dict[str, str]] = []
    seen_phones: set[str] = set()
    for c in contacts:
        props = c.get("properties") or {}
        phone = (props.get("phone") or props.get("mobilephone") or "").strip()
        if not phone or phone in seen_phones:
            continue
        seen_phones.add(phone)
        first = (props.get("firstname") or "").strip()
        last = (props.get("lastname") or "").strip()
        name = f"{first} {last}".strip() or (props.get("email") or "Unknown")
        prospects.append({
            "prospect_name": name,
            "prospect_phone": phone,
            "prospect_company": (props.get("company") or "").strip(),
            "prospect_role": (props.get("jobtitle") or "").strip(),
            "prospect_city": (props.get("city") or "").strip(),
            "prospect_industry": "",
            "context": f"Imported from HubSpot list {list_id}.",
        })
    return prospects
```

- [ ] **Step 2: Commit**

```bash
git add Backend/app/services/voice_campaign/hubspot_list_resolver.py
git commit -m "feat(voice): hubspot-list source resolver"
```

---

## Task 6: Celery task — `run_voice_campaign`

**Files:**
- Create: `Backend/app/tasks/voice_campaign_tasks.py`
- Modify: `Backend/app/core/celery_app.py` (register module)

- [ ] **Step 1: Write the Celery task**

```python
"""Celery task that drives a voice campaign to completion.

Picks up a `VoiceCampaign` row and iterates its `voice_campaign_prospects`
in queued order.  For each prospect:
  1. Check credits — skip if insufficient (don't fail the whole campaign)
  2. Create an AgentRun up-front (crash-safety pattern — matches
     voice_agent.trigger_voice_call)
  3. Call Retell via `_call_via_retell` (same helper the sync endpoint uses)
  4. Persist result, deduct credits on success, update campaign counters
  5. Respect `max_calls_per_day` — if hit, leave remaining rows queued and
     reschedule task for tomorrow 00:15 UTC via `apply_async(eta=...)`
  6. Poll for `status = paused | cancelled` between calls — bail immediately

No Retell-side delay knob here; Retell itself paces inbound requests.
Between calls we `asyncio.sleep(2)` so we never flood HubSpot/Retell if
someone dumps 500 prospects at once.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from celery import shared_task
from sqlalchemy.orm import Session

from app.api.routes.voice_agent import (
    TriggerCallRequest,
    _call_via_agentic_infra,
    _call_via_retell,
    _config_key,
)
from app.core.config import settings
from app.core.redis import RedisManager
from app.db.deps import SessionLocal
from app.db.models.agent_run import AgentRun
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect
from app.db.utils import check_sufficient_credits, deduct_credits

logger = logging.getLogger(__name__)

VOICE_CALL_COST = 5
BETWEEN_CALLS_SECONDS = 2


@shared_task(name="app.tasks.voice_campaign_tasks.run_voice_campaign", bind=True)
def run_voice_campaign(self, campaign_id: str) -> Dict[str, Any]:
    """Drive one campaign to completion (or until daily cap / pause)."""
    db: Session = SessionLocal()
    try:
        return asyncio.run(_run_async(db, campaign_id))
    finally:
        db.close()


async def _run_async(db: Session, campaign_id: str) -> Dict[str, Any]:
    campaign = db.query(VoiceCampaign).filter(VoiceCampaign.id == campaign_id).first()
    if not campaign:
        logger.warning("run_voice_campaign: campaign %s not found", campaign_id)
        return {"ok": False, "reason": "not_found"}

    if campaign.status in ("completed", "cancelled"):
        return {"ok": True, "reason": f"campaign_{campaign.status}"}

    # Mark running
    campaign.status = "running"
    if not campaign.started_at:
        campaign.started_at = datetime.now(timezone.utc)
    db.commit()

    # Count calls already made today — enforces max_calls_per_day even
    # across worker restarts.
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    calls_today = (
        db.query(VoiceCampaignProspect)
        .filter(
            VoiceCampaignProspect.campaign_id == campaign.id,
            VoiceCampaignProspect.attempted_at.isnot(None),
            VoiceCampaignProspect.attempted_at >= today_start,
        )
        .count()
    )

    # Load user's call script + voice config once (same replacements as
    # voice_agent.trigger_voice_call).
    call_script, voice_config = await _load_user_voice_config(campaign.user_id)

    while True:
        # Re-read campaign state in case the UI paused/cancelled us mid-run.
        db.expire(campaign)
        db.refresh(campaign)
        if campaign.status in ("paused", "cancelled"):
            logger.info("run_voice_campaign: campaign %s %s — stopping", campaign.id, campaign.status)
            return {"ok": True, "reason": f"campaign_{campaign.status}"}

        if calls_today >= campaign.max_calls_per_day:
            # Reschedule for tomorrow 00:15 UTC
            tomorrow = datetime.now(timezone.utc).replace(
                hour=0, minute=15, second=0, microsecond=0
            ) + timedelta(days=1)
            run_voice_campaign.apply_async(args=[str(campaign.id)], eta=tomorrow)
            logger.info(
                "run_voice_campaign: hit daily cap %d — rescheduled campaign %s for %s",
                campaign.max_calls_per_day,
                campaign.id,
                tomorrow.isoformat(),
            )
            return {"ok": True, "reason": "daily_cap_hit"}

        # Pick next queued prospect — ORDER BY id for determinism
        prospect = (
            db.query(VoiceCampaignProspect)
            .filter(
                VoiceCampaignProspect.campaign_id == campaign.id,
                VoiceCampaignProspect.status == "queued",
            )
            .order_by(VoiceCampaignProspect.id)
            .first()
        )
        if not prospect:
            # All done
            campaign.status = "completed"
            campaign.finished_at = datetime.now(timezone.utc)
            db.commit()
            logger.info("run_voice_campaign: campaign %s completed", campaign.id)
            return {"ok": True, "reason": "completed"}

        await _call_one(db, campaign, prospect, call_script, voice_config)
        calls_today += 1

        await asyncio.sleep(BETWEEN_CALLS_SECONDS)


async def _load_user_voice_config(user_id) -> tuple[Dict | None, Dict | None]:
    redis = RedisManager.get_client()
    raw = await redis.get(_config_key(str(user_id)))
    if not raw:
        return None, None
    cfg = json.loads(raw)
    return cfg.get("call_script"), cfg


async def _call_one(
    db: Session,
    campaign: VoiceCampaign,
    prospect: VoiceCampaignProspect,
    call_script: Dict | None,
    voice_config: Dict | None,
) -> None:
    """Execute one call.  Persists result on the prospect row + campaign counters."""
    # Credit check
    if not check_sufficient_credits(db, campaign.user_id, VOICE_CALL_COST):
        prospect.status = "skipped"
        prospect.error_message = "Insufficient credits"
        prospect.finished_at = datetime.now(timezone.utc)
        campaign.calls_failed += 1
        db.commit()
        return

    # Build TriggerCallRequest-shaped object from the prospect row
    req = TriggerCallRequest(
        prospect_name=prospect.prospect_name,
        prospect_phone=prospect.prospect_phone,
        prospect_company=prospect.prospect_company,
        prospect_role=prospect.prospect_role,
        prospect_city=prospect.prospect_city,
        prospect_industry=prospect.prospect_industry,
        call_objective=campaign.call_objective,
        context=prospect.context,
    )

    # Persist AgentRun up-front (crash-safe; same pattern as sync endpoint)
    run = AgentRun(
        user_id=campaign.user_id,
        agent_type="voice-agent",
        flow_id="retell" if settings.RETELL_API_KEY else "agentic-infra",
        input=req.model_dump(),
        status="running",
        cost_credits=VOICE_CALL_COST,
    )
    db.add(run)
    db.flush()  # get run.id without committing — atomic with prospect update

    prospect.status = "calling"
    prospect.attempted_at = datetime.now(timezone.utc)
    prospect.agent_run_id = run.id
    db.commit()

    # Call
    started = time.monotonic()
    result: Dict[str, Any] = {}
    err: str | None = None
    try:
        if settings.RETELL_API_KEY:
            result = await _call_via_retell(req, call_script, voice_config)
        else:
            result = await _call_via_agentic_infra(req, call_script)
    except Exception as exc:
        err = str(exc)[:500]

    run.duration_ms = int((time.monotonic() - started) * 1000)
    run.finished_at = datetime.now(timezone.utc)

    if err:
        run.status = "error"
        run.error_message = err
        prospect.status = "error"
        prospect.error_message = err
        prospect.finished_at = run.finished_at
        campaign.calls_failed += 1
        campaign.calls_made += 1
        db.commit()
        return

    # Success — the final outcome (booked vs. voicemail) arrives later via
    # the Retell webhook and updates the AgentRun row.  We treat "call
    # successfully initiated" as success for campaign counters; the UI can
    # refine later from the webhook-updated AgentRun.
    run.status = "success"
    run.output_text = json.dumps(result)
    run.leads = [{"call_id": result.get("call_id"), "prospect": req.prospect_name}]
    prospect.status = "success"
    prospect.finished_at = run.finished_at
    campaign.calls_made += 1
    campaign.calls_booked += 1
    db.commit()

    # Deduct credits AFTER persisting success (matches sync endpoint)
    deduct_credits(
        db=db,
        user_id=campaign.user_id,
        amount=VOICE_CALL_COST,
        reference_id=run.id,
        description=f"Voice campaign {campaign.name} → {req.prospect_name}",
    )
```

- [ ] **Step 2: Register the module in celery_app**

Modify `Backend/app/core/celery_app.py` — add the new module to the `include` list:

```python
    include=[
        "app.tasks.visitors",
        "app.tasks.copilot_tasks",
        "app.tasks.signal_tasks",
        "app.tasks.sequence_tasks",
        "app.tasks.champion_tasks",
        "app.tasks.social_listening_tasks",
        "app.tasks.voice_campaign_tasks",  # ← add this line
    ]
```

- [ ] **Step 3: Sanity-check the task imports**

```bash
cd Backend && python -c "from app.tasks.voice_campaign_tasks import run_voice_campaign; print(run_voice_campaign.name)"
```

Expected: `app.tasks.voice_campaign_tasks.run_voice_campaign`

- [ ] **Step 4: Commit**

```bash
git add Backend/app/tasks/voice_campaign_tasks.py Backend/app/core/celery_app.py
git commit -m "feat(voice): run_voice_campaign Celery task with daily-cap + pause support"
```

---

## Task 7: Campaign CRUD + launch API routes

**Files:**
- Create: `Backend/app/api/routes/voice_campaigns.py`
- Modify: `Backend/app/main.py` (register router)

- [ ] **Step 1: Write the router**

```python
"""Voice Campaign API — create / list / get / pause / resume / cancel.

Create kicks off the background Celery task `run_voice_campaign`.  The
endpoint returns immediately with the campaign ID so the UI can start
polling `/voice-campaigns/{id}` for live progress.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.db.deps import get_db
from app.db.models.agent_run import AgentRun
from app.db.models.user import User
from app.db.models.voice_campaign import VoiceCampaign, VoiceCampaignProspect
from app.services.hubspot_service import HubSpotService
from app.services.voice_campaign.hubspot_list_resolver import resolve_hubspot_list
from app.services.voice_campaign.segment_resolver import resolve_hot_signals
from app.tasks.voice_campaign_tasks import run_voice_campaign

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/voice-campaigns", tags=["voice-campaigns"])


# ────────── Schemas ──────────

class ManualProspect(BaseModel):
    prospect_name: str
    prospect_phone: str
    prospect_company: str = ""
    prospect_role: str = ""
    prospect_city: str = ""
    prospect_industry: str = ""
    context: str = ""


class CreateCampaignRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    call_objective: str = "discovery"
    source_type: Literal["manual", "csv", "hubspot", "hot_signals"]
    source_params: Dict[str, Any] = {}
    max_calls_per_day: int = Field(50, ge=1, le=500)
    # Required when source_type == "manual"
    manual_prospects: Optional[List[ManualProspect]] = None


class CampaignProspectOut(BaseModel):
    id: str
    prospect_name: str
    prospect_phone: str
    prospect_company: str
    prospect_role: str
    status: str
    error_message: Optional[str]
    attempted_at: Optional[str]
    finished_at: Optional[str]
    agent_run_id: Optional[str]


class CampaignOut(BaseModel):
    id: str
    name: str
    call_objective: str
    source_type: str
    source_params: Dict[str, Any]
    max_calls_per_day: int
    status: str
    error_message: Optional[str]
    total_prospects: int
    calls_made: int
    calls_booked: int
    calls_failed: int
    created_at: Optional[str]
    started_at: Optional[str]
    finished_at: Optional[str]


class CampaignDetail(CampaignOut):
    prospects: List[CampaignProspectOut]


class PreviewRequest(BaseModel):
    source_type: Literal["hubspot", "hot_signals"]
    source_params: Dict[str, Any] = {}


class HubSpotListOut(BaseModel):
    list_id: str
    name: str
    size: Optional[int] = None


# ────────── Helpers ──────────

def _serialize(c: VoiceCampaign) -> CampaignOut:
    return CampaignOut(
        id=str(c.id),
        name=c.name,
        call_objective=c.call_objective,
        source_type=c.source_type,
        source_params=c.source_params or {},
        max_calls_per_day=c.max_calls_per_day,
        status=c.status,
        error_message=c.error_message,
        total_prospects=c.total_prospects,
        calls_made=c.calls_made,
        calls_booked=c.calls_booked,
        calls_failed=c.calls_failed,
        created_at=c.created_at.isoformat() if c.created_at else None,
        started_at=c.started_at.isoformat() if c.started_at else None,
        finished_at=c.finished_at.isoformat() if c.finished_at else None,
    )


def _serialize_prospect(p: VoiceCampaignProspect) -> CampaignProspectOut:
    return CampaignProspectOut(
        id=str(p.id),
        prospect_name=p.prospect_name,
        prospect_phone=p.prospect_phone,
        prospect_company=p.prospect_company,
        prospect_role=p.prospect_role,
        status=p.status,
        error_message=p.error_message,
        attempted_at=p.attempted_at.isoformat() if p.attempted_at else None,
        finished_at=p.finished_at.isoformat() if p.finished_at else None,
        agent_run_id=str(p.agent_run_id) if p.agent_run_id else None,
    )


async def _resolve_source(
    db: Session, user_id: UUID, source_type: str, params: Dict[str, Any],
    manual: Optional[List[ManualProspect]],
) -> List[Dict[str, str]]:
    if source_type == "manual":
        return [p.model_dump() for p in (manual or [])]
    if source_type == "csv":
        # CSV was already uploaded + stashed in Redis by /voice-agent/upload-list
        from app.core.redis import RedisManager
        import json
        redis = RedisManager.get_client()
        raw = await redis.get(f"voice_agent:contact_list:{user_id}")
        if not raw:
            return []
        rows = json.loads(raw)
        return [{
            "prospect_name": r.get("name", ""),
            "prospect_phone": r.get("phone", ""),
            "prospect_company": r.get("company", ""),
            "prospect_role": r.get("role", ""),
            "prospect_city": "",
            "prospect_industry": "",
            "context": "Imported from CSV upload.",
        } for r in rows if r.get("name") and r.get("phone")]
    if source_type == "hot_signals":
        return resolve_hot_signals(db, user_id, params)
    if source_type == "hubspot":
        return await resolve_hubspot_list(db, user_id, params)
    return []


# ────────── Endpoints ──────────

@router.get("", response_model=List[CampaignOut])
def list_campaigns(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.user_id == user.id)
        .order_by(VoiceCampaign.created_at.desc())
        .limit(100)
        .all()
    )
    return [_serialize(r) for r in rows]


@router.post("/preview")
async def preview_source(
    req: PreviewRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dry-run a source to show how many prospects a campaign would include.

    Returns a preview list (capped) and a total count.  Used by the wizard
    so the user sees what they're about to call before spending credits.
    """
    if req.source_type == "hot_signals":
        rows = resolve_hot_signals(db, user.id, req.source_params)
    elif req.source_type == "hubspot":
        rows = await resolve_hubspot_list(db, user.id, req.source_params)
    else:
        rows = []
    return {"total": len(rows), "preview": rows[:10]}


@router.get("/hubspot-lists", response_model=List[HubSpotListOut])
async def get_hubspot_lists(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List available HubSpot contact lists.

    If HubSpot isn't connected, return 400 with a pointer to the OAuth
    flow — we never ask the user to reconnect inside the voice agent.
    """
    svc = HubSpotService(db)
    conn = svc.is_connected(user)
    if not conn.get("connected"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "hubspot_not_connected",
                "message": "Connect HubSpot in Settings → Integrations to use this source.",
                "connect_url": svc.get_auth_url(state=str(user.id)),
            },
        )
    raw = await svc.list_contact_lists(user.id)
    out: List[HubSpotListOut] = []
    for item in raw:
        lid = str(item.get("listId") or item.get("id") or "")
        if not lid:
            continue
        out.append(HubSpotListOut(
            list_id=lid,
            name=item.get("name", "Unnamed list"),
            size=item.get("size") or item.get("additionalProperties", {}).get("hs_list_size"),
        ))
    return out


@router.post("", response_model=CampaignOut, status_code=201)
async def create_campaign(
    req: CreateCampaignRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create + launch a campaign.

    Resolves the source → persists prospects → creates campaign row →
    dispatches the Celery task → returns immediately.
    """
    if req.source_type == "manual" and not req.manual_prospects:
        raise HTTPException(status_code=400, detail="manual_prospects required for source_type=manual")

    prospect_dicts = await _resolve_source(
        db, user.id, req.source_type, req.source_params, req.manual_prospects,
    )
    if not prospect_dicts:
        raise HTTPException(status_code=400, detail="Source resolved to zero callable prospects")

    campaign = VoiceCampaign(
        user_id=user.id,
        name=req.name,
        call_objective=req.call_objective,
        source_type=req.source_type,
        source_params=req.source_params,
        max_calls_per_day=req.max_calls_per_day,
        total_prospects=len(prospect_dicts),
        status="queued",
    )
    db.add(campaign)
    db.flush()

    for p in prospect_dicts:
        db.add(VoiceCampaignProspect(
            campaign_id=campaign.id,
            user_id=user.id,
            prospect_name=p.get("prospect_name", ""),
            prospect_phone=p.get("prospect_phone", ""),
            prospect_company=p.get("prospect_company", ""),
            prospect_role=p.get("prospect_role", ""),
            prospect_city=p.get("prospect_city", ""),
            prospect_industry=p.get("prospect_industry", ""),
            context=p.get("context", ""),
        ))
    db.commit()
    db.refresh(campaign)

    # Fire the Celery task — returns immediately
    run_voice_campaign.delay(str(campaign.id))

    return _serialize(campaign)


@router.get("/{campaign_id}", response_model=CampaignDetail)
def get_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    prospects = (
        db.query(VoiceCampaignProspect)
        .filter(VoiceCampaignProspect.campaign_id == c.id)
        .order_by(VoiceCampaignProspect.id)
        .all()
    )
    base = _serialize(c)
    return CampaignDetail(
        **base.model_dump(),
        prospects=[_serialize_prospect(p) for p in prospects],
    )


@router.post("/{campaign_id}/pause", response_model=CampaignOut)
def pause_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status not in ("queued", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot pause — status is {c.status}")
    c.status = "paused"
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.post("/{campaign_id}/resume", response_model=CampaignOut)
def resume_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume — status is {c.status}")
    c.status = "queued"
    db.commit()
    # Re-dispatch
    run_voice_campaign.delay(str(c.id))
    db.refresh(c)
    return _serialize(c)


@router.post("/{campaign_id}/cancel", response_model=CampaignOut)
def cancel_campaign(
    campaign_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = (
        db.query(VoiceCampaign)
        .filter(VoiceCampaign.id == campaign_id, VoiceCampaign.user_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status in ("completed", "cancelled"):
        return _serialize(c)
    c.status = "cancelled"
    db.commit()
    db.refresh(c)
    return _serialize(c)
```

- [ ] **Step 2: Register router in main.py**

Find the block in `Backend/app/main.py` where other voice-agent routers are registered. Add:

```python
from app.api.routes import voice_campaigns
app.include_router(voice_campaigns.router)
```

- [ ] **Step 3: Start the backend and verify endpoints register**

```bash
taskkill //IM python.exe //F 2>/dev/null; cd Backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
sleep 3
curl -s http://127.0.0.1:8000/openapi.json | python -c "import sys,json; d=json.load(sys.stdin); print([p for p in d['paths'] if 'voice-campaigns' in p])"
```

Expected: a list including `/api/v1/voice-campaigns`, `/api/v1/voice-campaigns/{campaign_id}`, `/api/v1/voice-campaigns/preview`, `/api/v1/voice-campaigns/hubspot-lists`, etc.

- [ ] **Step 4: Commit**

```bash
git add Backend/app/api/routes/voice_campaigns.py Backend/app/main.py
git commit -m "feat(voice): campaigns API — create/preview/get/pause/resume/cancel"
```

---

## Task 8: Rename frontend "New Voice Campaign" → "Quick call"

**Files:**
- Modify: `Frontend/app/(dashboard)/voice-agent/page.tsx`

This is a copy-only change. The existing `triggerVoiceCall` endpoint stays as-is — it's the real single-call flow.

- [ ] **Step 1: Update the button label at line ~363**

Find:

```tsx
<Button size="sm" className="gap-2 bg-primary" onClick={() => { setCampaignOpen(true); setCampaignResult(null); setCampaignError("") }}>
```

The button text near this line currently reads `"New Campaign"` or similar. Change the button child text to:

```tsx
<Plus className="h-4 w-4" />
Quick call
```

- [ ] **Step 2: Update the dialog title at line ~762**

Find:

```tsx
<DialogTitle>New Voice Campaign</DialogTitle>
```

Replace with:

```tsx
<DialogTitle>Quick call</DialogTitle>
```

And the dialog description (the `DialogDescription` right after the title — currently says "Trigger a voice call to a prospect. Costs 5 credits.") — update to:

```tsx
<DialogDescription>One-off call to a single prospect — for bulk or signal-triggered calls use "+ New campaign" instead. Costs 5 credits.</DialogDescription>
```

- [ ] **Step 3: Rename internal state vars (optional, for clarity)**

Rename `campaignOpen/setCampaignOpen/campaignForm/setCampaignForm/campaignSubmitting/setCampaignSubmitting/campaignResult/setCampaignResult/campaignError/setCampaignError/handleCampaignSubmit` → swap `campaign` → `quickCall` throughout the file. Use `Edit` with `replace_all: true` on each identifier.

(Optional because it's purely a naming change — the plan can skip this step without breaking functionality, but the code will read cleaner.)

- [ ] **Step 4: Verify visually**

```bash
cd Frontend && npm run dev
```

Open http://localhost:3000/voice-agent, click the button — should now say "Quick call" and the dialog title should match.

- [ ] **Step 5: Commit**

```bash
git add Frontend/app/\(dashboard\)/voice-agent/page.tsx
git commit -m "feat(voice): rename single-call dialog to 'Quick call'"
```

---

## Task 9: Frontend API client for campaigns

**Files:**
- Create: `Frontend/lib/api/voice-campaigns.ts`

- [ ] **Step 1: Write the client**

```typescript
// Voice Campaigns API client — talks to /api/v1/voice-campaigns/*
// Auth header is auto-attached by AuthProvider's window.fetch patch.

const API = "/api/v1/voice-campaigns"

// ---------- Types ----------

export type CampaignSourceType = "manual" | "csv" | "hubspot" | "hot_signals"
export type CampaignStatus = "queued" | "running" | "paused" | "completed" | "cancelled" | "error"
export type ProspectStatus = "queued" | "calling" | "success" | "error" | "skipped"

export interface ManualProspect {
  prospect_name: string
  prospect_phone: string
  prospect_company?: string
  prospect_role?: string
  prospect_city?: string
  prospect_industry?: string
  context?: string
}

export interface CreateCampaignRequest {
  name: string
  call_objective?: string
  source_type: CampaignSourceType
  source_params?: Record<string, any>
  max_calls_per_day?: number
  manual_prospects?: ManualProspect[]
}

export interface Campaign {
  id: string
  name: string
  call_objective: string
  source_type: CampaignSourceType
  source_params: Record<string, any>
  max_calls_per_day: number
  status: CampaignStatus
  error_message: string | null
  total_prospects: number
  calls_made: number
  calls_booked: number
  calls_failed: number
  created_at: string | null
  started_at: string | null
  finished_at: string | null
}

export interface CampaignProspect {
  id: string
  prospect_name: string
  prospect_phone: string
  prospect_company: string
  prospect_role: string
  status: ProspectStatus
  error_message: string | null
  attempted_at: string | null
  finished_at: string | null
  agent_run_id: string | null
}

export interface CampaignDetail extends Campaign {
  prospects: CampaignProspect[]
}

export interface HubSpotList {
  list_id: string
  name: string
  size: number | null
}

export interface PreviewResult {
  total: number
  preview: ManualProspect[]
}

// ---------- API functions ----------

async function fetchJson<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Campaigns API ${res.status}: ${body}`)
  }
  return res.json()
}

export const listCampaigns = () => fetchJson<Campaign[]>("")
export const getCampaign = (id: string) => fetchJson<CampaignDetail>(`/${id}`)

export const createCampaign = (req: CreateCampaignRequest) =>
  fetchJson<Campaign>("", { method: "POST", body: JSON.stringify(req) })

export const pauseCampaign = (id: string) =>
  fetchJson<Campaign>(`/${id}/pause`, { method: "POST" })

export const resumeCampaign = (id: string) =>
  fetchJson<Campaign>(`/${id}/resume`, { method: "POST" })

export const cancelCampaign = (id: string) =>
  fetchJson<Campaign>(`/${id}/cancel`, { method: "POST" })

export const previewSource = (
  source_type: "hot_signals" | "hubspot",
  source_params: Record<string, any>,
) => fetchJson<PreviewResult>("/preview", {
  method: "POST",
  body: JSON.stringify({ source_type, source_params }),
})

export const getHubSpotLists = () => fetchJson<HubSpotList[]>("/hubspot-lists")
```

- [ ] **Step 2: Commit**

```bash
git add Frontend/lib/api/voice-campaigns.ts
git commit -m "feat(voice): frontend API client for campaigns"
```

---

## Task 10: Campaign wizard component (3 steps: source → preview → launch)

**Files:**
- Create: `Frontend/components/voice-agent/campaign-wizard.tsx`

- [ ] **Step 1: Write the wizard**

```tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, ChevronRight, Users, FileSpreadsheet, Zap, Link2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  createCampaign,
  getHubSpotLists,
  previewSource,
  type CampaignSourceType,
  type HubSpotList,
  type ManualProspect,
  type PreviewResult,
  type Campaign,
} from "@/lib/api/voice-campaigns"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (c: Campaign) => void
}

type Step = "source" | "config" | "preview"

const SOURCES: { id: CampaignSourceType; icon: any; label: string; desc: string }[] = [
  { id: "hot_signals", icon: Zap, label: "Hot Signals", desc: "Prospects with fresh signals (funding, hiring, job changes)" },
  { id: "hubspot", icon: Link2, label: "HubSpot list", desc: "Pull contacts from one of your HubSpot lists" },
  { id: "csv", icon: FileSpreadsheet, label: "Uploaded CSV", desc: "The CSV you uploaded via 'Upload list'" },
  { id: "manual", icon: Users, label: "Manual list", desc: "Paste rows — name, phone, company" },
]

export function CampaignWizard({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>("source")
  const [source, setSource] = useState<CampaignSourceType | null>(null)

  // Config state
  const [name, setName] = useState("")
  const [objective, setObjective] = useState("discovery")
  const [maxPerDay, setMaxPerDay] = useState(50)

  // Hot signals
  const [minIntent, setMinIntent] = useState(70)
  const [days, setDays] = useState(7)

  // HubSpot
  const [hsLists, setHsLists] = useState<HubSpotList[]>([])
  const [hsListId, setHsListId] = useState("")
  const [hsError, setHsError] = useState<{ message: string; connect_url?: string } | null>(null)
  const [hsLoading, setHsLoading] = useState(false)

  // Manual
  const [manualText, setManualText] = useState("")  // "name, phone, company\nJane, +1..., Acme"

  // Preview
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const reset = () => {
    setStep("source"); setSource(null); setName(""); setObjective("discovery")
    setMaxPerDay(50); setMinIntent(70); setDays(7); setHsListId("")
    setHsError(null); setManualText(""); setPreview(null); setSubmitError("")
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  // Fetch HubSpot lists when user picks hubspot source
  useEffect(() => {
    if (source !== "hubspot") return
    setHsLoading(true); setHsError(null)
    getHubSpotLists()
      .then(setHsLists)
      .catch((e) => {
        // Backend returns a JSON detail on 400 — parse it
        try {
          const detail = JSON.parse(e.message.split(": ").slice(1).join(": "))
          if (detail.error === "hubspot_not_connected") {
            setHsError({ message: detail.message, connect_url: detail.connect_url })
          } else {
            setHsError({ message: e.message })
          }
        } catch {
          setHsError({ message: e.message })
        }
      })
      .finally(() => setHsLoading(false))
  }, [source])

  const manualProspects: ManualProspect[] = useMemo(() => {
    return manualText.split("\n").map((line) => {
      const [n, p, c = "", r = ""] = line.split(",").map((x) => x.trim())
      return n && p ? { prospect_name: n, prospect_phone: p, prospect_company: c, prospect_role: r } : null
    }).filter(Boolean) as ManualProspect[]
  }, [manualText])

  const canLaunch = useMemo(() => {
    if (!name.trim()) return false
    if (source === "manual") return manualProspects.length > 0
    if (source === "hubspot") return !!hsListId
    return true
  }, [name, source, manualProspects, hsListId])

  const sourceParams = useMemo(() => {
    if (source === "hot_signals") return { min_intent: minIntent, days, max_prospects: 200 }
    if (source === "hubspot") return { list_id: hsListId }
    return {}
  }, [source, minIntent, days, hsListId])

  const runPreview = useCallback(async () => {
    if (source !== "hot_signals" && source !== "hubspot") {
      // manual + csv don't need a preview call (we already have the list)
      setStep("preview"); return
    }
    setPreviewLoading(true)
    try {
      const p = await previewSource(source, sourceParams)
      setPreview(p)
      setStep("preview")
    } catch (e: any) {
      setSubmitError(e.message || "Preview failed")
    } finally {
      setPreviewLoading(false)
    }
  }, [source, sourceParams])

  const handleLaunch = useCallback(async () => {
    if (!source) return
    setSubmitting(true); setSubmitError("")
    try {
      const c = await createCampaign({
        name,
        call_objective: objective,
        source_type: source,
        source_params: sourceParams,
        max_calls_per_day: maxPerDay,
        manual_prospects: source === "manual" ? manualProspects : undefined,
      })
      onCreated(c)
      onOpenChange(false)
    } catch (e: any) {
      setSubmitError(e.message || "Failed to create campaign")
    } finally {
      setSubmitting(false)
    }
  }, [source, name, objective, sourceParams, maxPerDay, manualProspects, onCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New voice campaign</DialogTitle>
          <DialogDescription>
            {step === "source" && "Pick where the prospects come from"}
            {step === "config" && "Configure the campaign"}
            {step === "preview" && "Review and launch"}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Source picker ── */}
        {step === "source" && (
          <div className="grid grid-cols-2 gap-3">
            {SOURCES.map((s) => {
              const Icon = s.icon
              const active = source === s.id
              return (
                <Card
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`cursor-pointer transition ${active ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                >
                  <CardContent className="p-4">
                    <Icon className="h-5 w-5 mb-2 text-primary" />
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* ── Step 2: Config ── */}
        {step === "config" && source && (
          <div className="space-y-4">
            <div>
              <Label>Campaign name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funding outreach — Apr 2026" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Call objective</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="demo">Intro demo</SelectItem>
                    <SelectItem value="followup">Follow up</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max calls/day</Label>
                <Input type="number" value={maxPerDay} onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 50)} min={1} max={500} />
              </div>
            </div>

            {source === "hot_signals" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min intent score</Label>
                  <Input type="number" value={minIntent} onChange={(e) => setMinIntent(parseInt(e.target.value) || 0)} min={0} max={100} />
                </div>
                <div>
                  <Label>Signals from last N days</Label>
                  <Input type="number" value={days} onChange={(e) => setDays(parseInt(e.target.value) || 7)} min={1} max={90} />
                </div>
              </div>
            )}

            {source === "hubspot" && (
              <div>
                <Label>HubSpot list</Label>
                {hsLoading && <div className="text-xs text-muted-foreground mt-2"><Loader2 className="h-3 w-3 inline animate-spin" /> Loading lists…</div>}
                {hsError && (
                  <div className="text-sm text-destructive mt-2 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <div>{hsError.message}</div>
                      {hsError.connect_url && (
                        <a href={hsError.connect_url} className="underline text-primary text-xs">Connect HubSpot →</a>
                      )}
                    </div>
                  </div>
                )}
                {!hsLoading && !hsError && (
                  <Select value={hsListId} onValueChange={setHsListId}>
                    <SelectTrigger><SelectValue placeholder="Choose a list" /></SelectTrigger>
                    <SelectContent>
                      {hsLists.map((l) => (
                        <SelectItem key={l.list_id} value={l.list_id}>
                          {l.name} {l.size ? `(${l.size})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {source === "manual" && (
              <div>
                <Label>Prospects (one per line: name, phone, company, role)</Label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm font-mono min-h-[120px] bg-background"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Jane Smith, +14155551234, Acme Corp, VP Sales"
                />
                <div className="text-xs text-muted-foreground mt-1">{manualProspects.length} valid rows</div>
              </div>
            )}

            {source === "csv" && (
              <div className="text-sm text-muted-foreground">
                Uses whichever CSV you last uploaded via the "Upload list" button.
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">{preview?.total ?? manualProspects.length}</span> prospects will be called.
            </div>
            <div className="text-xs text-muted-foreground">
              Credit cost: <span className="font-medium text-foreground">{(preview?.total ?? manualProspects.length) * 5}</span> credits (5 per call).
              Calls will spread across {Math.ceil((preview?.total ?? manualProspects.length) / maxPerDay)} day(s) at {maxPerDay}/day.
            </div>
            <div className="border rounded-md divide-y max-h-64 overflow-y-auto text-sm">
              {(preview?.preview ?? manualProspects.slice(0, 10)).map((p, i) => (
                <div key={i} className="px-3 py-2 flex justify-between">
                  <span>{p.prospect_name} — {p.prospect_company}</span>
                  <span className="text-muted-foreground text-xs">{p.prospect_phone}</span>
                </div>
              ))}
            </div>
            {submitError && <div className="text-sm text-destructive">{submitError}</div>}
          </div>
        )}

        <DialogFooter>
          {step !== "source" && (
            <Button variant="ghost" onClick={() => setStep(step === "preview" ? "config" : "source")} disabled={submitting}>
              Back
            </Button>
          )}
          {step === "source" && (
            <Button onClick={() => setStep("config")} disabled={!source}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "config" && (
            <Button onClick={runPreview} disabled={!canLaunch || previewLoading}>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Preview <ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
          )}
          {step === "preview" && (
            <Button onClick={handleLaunch} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Launch campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add Frontend/components/voice-agent/campaign-wizard.tsx
git commit -m "feat(voice): campaign wizard component (source → config → preview)"
```

---

## Task 11: Voice agent page — add campaigns table + "New campaign" button

**Files:**
- Modify: `Frontend/app/(dashboard)/voice-agent/page.tsx`

- [ ] **Step 1: Import the wizard + campaigns API**

Add near the existing imports:

```tsx
import { CampaignWizard } from "@/components/voice-agent/campaign-wizard"
import { listCampaigns, pauseCampaign, resumeCampaign, cancelCampaign, type Campaign } from "@/lib/api/voice-campaigns"
import Link from "next/link"
```

- [ ] **Step 2: Add wizard + campaigns state inside the component**

Near the other `useState` calls in `VoiceAgentPage`:

```tsx
const [wizardOpen, setWizardOpen] = useState(false)
const [campaigns, setCampaigns] = useState<Campaign[]>([])

const loadCampaigns = useCallback(async () => {
  try { setCampaigns(await listCampaigns()) } catch { /* ignore */ }
}, [])

useEffect(() => { loadCampaigns() }, [loadCampaigns])

// Poll campaigns every 10s while the tab is open — shows live counters
useEffect(() => {
  const t = setInterval(loadCampaigns, 10_000)
  return () => clearInterval(t)
}, [loadCampaigns])
```

- [ ] **Step 3: Add "New campaign" button + campaigns table to the page body**

Find the section where the "Quick call" button lives (the button from Task 8). Add a second button next to it:

```tsx
<Button size="sm" variant="outline" className="gap-2" onClick={() => setWizardOpen(true)}>
  <Sparkles className="h-4 w-4" />
  New campaign
</Button>
```

Then, somewhere after the existing `Recent calls` section, insert a Campaigns card:

```tsx
<Card>
  <CardContent className="p-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-medium text-sm">Campaigns</h3>
      <span className="text-xs text-muted-foreground">{campaigns.length} total</span>
    </div>
    {campaigns.length === 0 ? (
      <div className="text-sm text-muted-foreground">
        No campaigns yet. Click <span className="font-medium">New campaign</span> to launch a background call batch.
      </div>
    ) : (
      <div className="divide-y text-sm">
        {campaigns.slice(0, 10).map((c) => {
          const pct = c.total_prospects ? Math.round((c.calls_made / c.total_prospects) * 100) : 0
          return (
            <Link key={c.id} href={`/voice-agent/campaigns/${c.id}`} className="flex items-center justify-between py-2 hover:bg-accent/30 -mx-4 px-4 transition">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.source_type} · {c.calls_made}/{c.total_prospects} calls · {c.calls_booked} booked
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <Badge variant="outline" className="text-xs">{c.status}</Badge>
              </div>
            </Link>
          )
        })}
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 4: Mount the wizard near the bottom of the return**

Just before the closing fragment/element, add:

```tsx
<CampaignWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  onCreated={(c) => { setCampaigns((prev) => [c, ...prev]) }}
/>
```

- [ ] **Step 5: Visual verify**

Open http://localhost:3000/voice-agent → two buttons visible (Quick call + New campaign) → campaigns card visible. Clicking New campaign opens the 3-step wizard. Create a manual campaign with 1 fake number → verify it appears in the list → status transitions through queued/running.

- [ ] **Step 6: Commit**

```bash
git add Frontend/app/\(dashboard\)/voice-agent/page.tsx
git commit -m "feat(voice): campaigns table + 'New campaign' button on voice-agent page"
```

---

## Task 12: Campaign detail page with live polling + transcript drawer

**Files:**
- Create: `Frontend/app/(dashboard)/voice-agent/campaigns/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Loader2, Pause, Play, Square, Phone, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  getCampaign, pauseCampaign, resumeCampaign, cancelCampaign,
  type CampaignDetail, type CampaignProspect,
} from "@/lib/api/voice-campaigns"
import { fetchCallDetails, type CallDetails } from "@/lib/api/voice-agent"

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  error: "bg-red-100 text-red-700",
  calling: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  skipped: "bg-gray-100 text-gray-500",
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [data, setData] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedProspect, setSelectedProspect] = useState<CampaignProspect | null>(null)
  const [callDetail, setCallDetail] = useState<CallDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getCampaign(id)
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Live polling while campaign isn't finished
  useEffect(() => {
    if (!data) return
    if (data.status === "completed" || data.status === "cancelled") return
    const t = setInterval(load, 5_000)
    return () => clearInterval(t)
  }, [data, load])

  const openProspectDetail = useCallback(async (p: CampaignProspect) => {
    setSelectedProspect(p)
    setCallDetail(null)
    if (!p.agent_run_id) return
    setDetailLoading(true)
    try {
      const d = await fetchCallDetails(p.agent_run_id)
      setCallDetail(d)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Campaign not found</div>

  const pct = data.total_prospects ? Math.round((data.calls_made / data.total_prospects) * 100) : 0

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <Link href="/voice-agent" className="flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
          <ChevronLeft className="h-4 w-4" /> Voice agent
        </Link>
        <div className="flex gap-2">
          {data.status === "running" || data.status === "queued" ? (
            <Button size="sm" variant="outline" onClick={async () => { await pauseCampaign(id); load() }}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          ) : data.status === "paused" ? (
            <Button size="sm" variant="outline" onClick={async () => { await resumeCampaign(id); load() }}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          ) : null}
          {data.status !== "completed" && data.status !== "cancelled" && (
            <Button size="sm" variant="destructive" onClick={async () => { await cancelCampaign(id); load() }}>
              <Square className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <Badge className={STATUS_COLORS[data.status]}>{data.status}</Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {data.source_type} · {data.call_objective} · max {data.max_calls_per_day}/day
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total prospects</div>
          <div className="text-2xl font-semibold">{data.total_prospects}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Calls made</div>
          <div className="text-2xl font-semibold">{data.calls_made}</div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Booked</div>
          <div className="text-2xl font-semibold text-green-600">{data.calls_booked}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Failed</div>
          <div className="text-2xl font-semibold text-red-600">{data.calls_failed}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y text-sm">
            {data.prospects.map((p) => {
              const Icon = p.status === "success" ? CheckCircle2
                : p.status === "error" ? XCircle
                : p.status === "calling" ? Phone
                : Clock
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-accent/30 cursor-pointer transition"
                  onClick={() => openProspectDetail(p)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Icon className={`h-4 w-4 shrink-0 ${p.status === "success" ? "text-green-600" : p.status === "error" ? "text-red-600" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.prospect_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.prospect_company} · {p.prospect_phone}
                      </div>
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transcript drawer */}
      <Dialog open={!!selectedProspect} onOpenChange={(v) => !v && setSelectedProspect(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProspect?.prospect_name} — call details</DialogTitle>
          </DialogHeader>
          {detailLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!detailLoading && selectedProspect && !callDetail && (
            <div className="text-sm text-muted-foreground py-4">
              {selectedProspect.status === "queued"
                ? "Call hasn't started yet."
                : selectedProspect.status === "error"
                ? `Error: ${selectedProspect.error_message}`
                : "No call data yet — transcript arrives after the call ends via the Retell webhook."}
            </div>
          )}
          {callDetail && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Duration:</span> {callDetail.duration}</div>
                <div><span className="text-muted-foreground">Credits:</span> {callDetail.credits_used}</div>
                <div><span className="text-muted-foreground">Disconnect:</span> {callDetail.disconnection_reason || "—"}</div>
                <div><span className="text-muted-foreground">Objective:</span> {callDetail.call_objective}</div>
              </div>
              {callDetail.extracted_variables && Object.entries(callDetail.extracted_variables).some(([, v]) => v) && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Extracted variables</div>
                  <div className="space-y-1 border rounded-md p-3 bg-muted/30">
                    {Object.entries(callDetail.extracted_variables)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="font-medium">{k}:</span> {String(v)}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {callDetail.transcript && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Transcript</div>
                  <div className="whitespace-pre-wrap border rounded-md p-3 bg-muted/30 text-xs max-h-64 overflow-y-auto">
                    {callDetail.transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Visual verify**

Create a campaign with 2-3 manual prospects (use fake numbers) → navigate to `/voice-agent/campaigns/<id>` → see the live counters update every 5s → click a prospect row → transcript drawer opens (will be empty until Retell webhook returns, but UI handles that).

- [ ] **Step 3: Commit**

```bash
git add Frontend/app/\(dashboard\)/voice-agent/campaigns/
git commit -m "feat(voice): campaign detail page with live polling + transcript drawer"
```

---

## Task 13: End-to-end smoke test (real worker, real Retell)

This is an integration test — not a unit test. No mocks per the project's feedback memory ("no stubs, real integrations").

- [ ] **Step 1: Start the Celery worker**

In a dedicated terminal:

```bash
cd Backend && celery -A app.core.celery_app:celery_app worker --loglevel=info
```

Expected: worker connects to Redis and registers `app.tasks.voice_campaign_tasks.run_voice_campaign` among the task names.

- [ ] **Step 2: Create a small manual campaign via the UI**

Via the wizard: `Manual` → 1–2 prospects using **real phone numbers you own** (or your own + a voicemail-only second number) → Launch.

- [ ] **Step 3: Watch the campaign execute**

- Worker logs: `run_voice_campaign: campaign <id> completed` within ~30s–2min
- Campaign detail page: counters move from 0 → 1 → 2 live
- Retell console: 1 call per prospect
- After the call: `/api/v1/voice-agent/call-details/<agent_run_id>` returns a transcript + extracted vars

- [ ] **Step 4: Pause mid-run test**

Create a 3-prospect campaign. After the first call starts, click Pause. Expect: worker completes the in-flight call, then stops. Campaign status = `paused`. Click Resume → it continues with prospect #2.

- [ ] **Step 5: Daily cap test (optional)**

Create a campaign with `max_calls_per_day=1` and 2 prospects. Expect: 1 call runs, then worker reschedules via `apply_async(eta=tomorrow)` and exits cleanly. Celery `flower` (if installed) or Redis CLI (`zrange celery 0 -1`) shows a delayed task.

- [ ] **Step 6: No-code commit (documentation only)**

```bash
# Nothing to commit — this task is a manual smoke test
```

---

## Self-Review

**1. Spec coverage:**
- Rename "New Voice Campaign" → "Quick call" — **Task 8** ✅
- Multi-prospect campaign with sources — **Tasks 1–7, 9–11** ✅
- Manual source — **Tasks 7, 10** ✅
- CSV source (reuses existing `/upload-list`) — **Task 7** ✅
- HubSpot source, no double OAuth — **Tasks 4, 5, 7, 10** ✅
- Hot Signals segment — **Tasks 3, 7, 10** ✅
- Background execution via Celery — **Tasks 6, 7** ✅
- Transcripts + extracted variables surfaced — **Task 12** (reuses existing `/call-details/{run_id}` from webhook) ✅
- Live progress in UI — **Tasks 11, 12** (polling every 5–10s) ✅
- Pause / resume / cancel — **Tasks 7, 12** ✅
- `max_calls_per_day` enforcement — **Task 6** ✅

**Gap identified:** none — all spec items mapped to tasks.

**2. Placeholder scan:** clean — no TBD / "TODO" / "implement later" / "handle edge cases" strings. Every code step shows the real code.

**3. Type consistency:**
- `CampaignSourceType` in frontend = `source_type` column values in backend ✅
- `ProspectStatus` in frontend = `VoiceCampaignProspect.status` literals in backend (`queued | calling | success | error | skipped`) ✅
- `CampaignStatus` = `VoiceCampaign.status` (`queued | running | paused | completed | cancelled | error`) ✅
- `agent_run_id` FK → `outmate_agent_runs.id` (already-existing table, `AgentRun.__tablename__`) ✅
- `CreateCampaignRequest.source_type` Literal matches exactly the 4 resolver cases in `_resolve_source` ✅
- `TriggerCallRequest` fields in the Celery task exactly match the fields on `VoiceCampaignProspect` ✅

**4. Sequencing:**
- Task 1 (models) → Task 2 (migration) → Task 3 (resolver) → Task 4/5 (hubspot) → Task 6 (celery task, imports from Task 1+3+5) → Task 7 (router, imports from 1, 3, 5, 6) → Task 8 (rename, independent) → Task 9 (frontend client, depends on 7) → Task 10 (wizard, depends on 9) → Task 11 (page, depends on 10) → Task 12 (detail, depends on 9) → Task 13 (smoke test)

All earlier tasks don't import later-task code. Safe to execute in order.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-voice-campaigns-background.md`.

**A companion plan for the Social Agent background fix is in `2026-04-18-social-agent-background.md`** — same Celery pattern, much smaller (4 tasks). Can be executed after this one or interleaved.

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration, each task's context stays small.

**2. Inline Execution** — Execute tasks in this session, with batch checkpoints for review.

**Which approach?**
