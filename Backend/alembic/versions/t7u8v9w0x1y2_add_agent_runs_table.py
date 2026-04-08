"""add outmate_agent_runs table for outmate-agentic backed agent runs

Revision ID: t7u8v9w0x1y2
Revises: s6t7u8v9w0x1
Create Date: 2026-04-08 00:00:00.000000

This table is the single source of truth for tenant isolation between Outmate
users and the outmate-agentic execution engine.  Every row is keyed to a
specific Outmate user via `user_id`, and every read in
`Backend/app/api/routes/outmate_agentic.py` hard-filters on this column.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "t7u8v9w0x1y2"
down_revision: Union[str, None] = "s6t7u8v9w0x1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "outmate_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_type", sa.String(length=64), nullable=False),
        sa.Column("flow_id", sa.String(length=128), nullable=True),
        sa.Column("input", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("output_text", sa.Text(), nullable=True),
        sa.Column("leads", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("upgrade_tips", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="running"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outmate_agent_runs_user_id", "outmate_agent_runs", ["user_id"], unique=False)
    op.create_index("ix_outmate_agent_runs_agent_type", "outmate_agent_runs", ["agent_type"], unique=False)
    op.create_index("ix_outmate_agent_runs_status", "outmate_agent_runs", ["status"], unique=False)
    op.create_index(
        "ix_outmate_agent_runs_user_agent_created",
        "outmate_agent_runs",
        ["user_id", "agent_type", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_outmate_agent_runs_user_agent_created", table_name="outmate_agent_runs")
    op.drop_index("ix_outmate_agent_runs_status", table_name="outmate_agent_runs")
    op.drop_index("ix_outmate_agent_runs_agent_type", table_name="outmate_agent_runs")
    op.drop_index("ix_outmate_agent_runs_user_id", table_name="outmate_agent_runs")
    op.drop_table("outmate_agent_runs")
