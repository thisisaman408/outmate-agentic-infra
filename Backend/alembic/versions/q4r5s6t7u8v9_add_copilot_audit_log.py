"""Add copilot_audit_log table

Revision ID: q4r5s6t7u8v9
Revises: p3q4r5s6t7u8
Create Date: 2026-04-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "q4r5s6t7u8v9"
down_revision: Union[str, Sequence[str], None] = "p3q4r5s6t7u8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "copilot_audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prospect_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("company_name", sa.String(500), nullable=True),
        # What was requested
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("user_prompt", sa.Text(), nullable=True),
        # What was planned + executed
        sa.Column("plan", postgresql.JSONB(), nullable=True),
        sa.Column("steps_run", postgresql.JSONB(), nullable=True),
        sa.Column("output", postgresql.JSONB(), nullable=True),
        sa.Column("status", sa.String(50), server_default="success"),
        # Metadata
        sa.Column("credits_used", sa.Integer(), server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("enrichment_sources", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_copilot_audit_log_user_id", "copilot_audit_log", ["user_id"])
    op.create_index(
        "ix_copilot_audit_log_prospect_id", "copilot_audit_log", ["prospect_id"]
    )
    op.create_index(
        "ix_copilot_audit_log_user_created",
        "copilot_audit_log",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_copilot_audit_log_user_created", table_name="copilot_audit_log")
    op.drop_index("ix_copilot_audit_log_prospect_id", table_name="copilot_audit_log")
    op.drop_index("ix_copilot_audit_log_user_id", table_name="copilot_audit_log")
    op.drop_table("copilot_audit_log")
