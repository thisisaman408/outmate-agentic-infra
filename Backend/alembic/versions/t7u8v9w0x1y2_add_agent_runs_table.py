"""add outmate_agent_runs table for outmate-agentic backed agent runs

Revision ID: t7u8v9w0x1y2
Revises: 860ea7a80510
Create Date: 2026-04-08 00:00:00.000000

This table is the single source of truth for tenant isolation between Outmate
users and the outmate-agentic execution engine.  Every row is keyed to a
specific Outmate user via `user_id`, and every read in
`Backend/app/api/routes/outmate_agentic.py` hard-filters on this column.

Notes on chain + idempotency:
- `down_revision` points at `u8v9w0x1y2z3` because that revision ID is what
  prod's `alembic_version` table actually contains.  No file with that ID
  exists in `versions/`, but it is the de-facto HEAD that this migration
  must extend.  Once the upstream branch fixes the orphan, this can be
  rebased onto its proper parent.
- The table was originally created on prod via direct SQL during early
  bootstrap (alembic was wedged on the orphan revision).  This migration
  was then stamped via `alembic stamp t7u8v9w0x1y2`, so prod knows it has
  been "applied" without ever actually running upgrade().
- For new environments (fresh DBs), upgrade() must be re-runnable on top
  of an existing table without crashing.  All DDL is wrapped in
  IF NOT EXISTS / IF EXISTS to make this safe.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "t7u8v9w0x1y2"
down_revision: Union[str, None] = "860ea7a80510"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Idempotent: safe to run on databases where the table already exists.

    Uses raw SQL with IF NOT EXISTS instead of op.create_table because the
    Alembic op.* helpers don't support IF NOT EXISTS at the table level on
    Postgres.
    """
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS outmate_agent_runs (
            id              UUID         NOT NULL,
            user_id         UUID         NOT NULL,
            agent_type      VARCHAR(64)  NOT NULL,
            flow_id         VARCHAR(128),
            input           JSONB        NOT NULL,
            output_text     TEXT,
            leads           JSONB,
            upgrade_tips    JSONB,
            status          VARCHAR(32)  NOT NULL DEFAULT 'running',
            error_message   TEXT,
            duration_ms     INTEGER,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
            finished_at     TIMESTAMPTZ,
            CONSTRAINT outmate_agent_runs_pkey PRIMARY KEY (id),
            CONSTRAINT outmate_agent_runs_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_outmate_agent_runs_user_id "
        "ON outmate_agent_runs (user_id);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_outmate_agent_runs_agent_type "
        "ON outmate_agent_runs (agent_type);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_outmate_agent_runs_status "
        "ON outmate_agent_runs (status);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_outmate_agent_runs_user_agent_created "
        "ON outmate_agent_runs (user_id, agent_type, created_at);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_outmate_agent_runs_user_agent_created;")
    op.execute("DROP INDEX IF EXISTS ix_outmate_agent_runs_status;")
    op.execute("DROP INDEX IF EXISTS ix_outmate_agent_runs_agent_type;")
    op.execute("DROP INDEX IF EXISTS ix_outmate_agent_runs_user_id;")
    op.execute("DROP TABLE IF EXISTS outmate_agent_runs;")
