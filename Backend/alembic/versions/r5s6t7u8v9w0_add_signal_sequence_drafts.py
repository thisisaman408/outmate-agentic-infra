"""Add signal_sequence_drafts table and signal_score_threshold to preferences

Revision ID: r5s6t7u8v9w0
Revises: q4r5s6t7u8v9
Create Date: 2026-04-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "r5s6t7u8v9w0"
down_revision: Union[str, Sequence[str], None] = "q4r5s6t7u8v9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add signal_score_threshold to copilot_user_preferences
    op.add_column(
        "copilot_user_preferences",
        sa.Column("signal_score_threshold", sa.Integer(), server_default="70", nullable=False),
    )

    # 2. Create signal_sequence_drafts table
    op.create_table(
        "signal_sequence_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("signal_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Contact info fetched from ContactOut
        sa.Column("lead_name", sa.String(500), nullable=True),
        sa.Column("lead_email", sa.String(255), nullable=True),
        sa.Column("lead_role", sa.String(255), nullable=True),
        sa.Column("lead_domain", sa.String(255), nullable=True),
        sa.Column("lead_linkedin_url", sa.String(500), nullable=True),
        # Generated email
        sa.Column("draft_email_subject", sa.Text(), nullable=True),
        sa.Column("draft_email_body", sa.Text(), nullable=True),
        # Full optimizer output (follow-up sequence, reply probability, etc.)
        sa.Column("optimizer_output", postgresql.JSONB(), nullable=True),
        # Signal metadata
        sa.Column("signal_score", sa.Integer(), nullable=True),
        sa.Column("signal_type", sa.String(100), nullable=False),
        sa.Column("company_name", sa.String(500), nullable=True),
        sa.Column("company_domain", sa.String(255), nullable=True),
        # Lifecycle
        sa.Column(
            "status",
            sa.String(20),
            server_default="pending",
            nullable=False,
        ),  # pending | shown | used | dismissed
        # If pushed to campaign, store campaign_id
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            onupdate=sa.text("now()"),
        ),
    )
    op.create_index("ix_ssd_user_id", "signal_sequence_drafts", ["user_id"])
    op.create_index("ix_ssd_signal_id", "signal_sequence_drafts", ["signal_id"])
    op.create_index("ix_ssd_status", "signal_sequence_drafts", ["status"])
    op.create_index(
        "ix_ssd_user_status",
        "signal_sequence_drafts",
        ["user_id", "status", "created_at"],
    )
    # Unique constraint: one pending/shown draft per signal_id + user_id (dedup guard)
    op.create_index(
        "uq_ssd_signal_user_active",
        "signal_sequence_drafts",
        ["signal_id", "user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('pending', 'shown')"),
    )


def downgrade() -> None:
    op.drop_index("uq_ssd_signal_user_active", table_name="signal_sequence_drafts")
    op.drop_index("ix_ssd_user_status", table_name="signal_sequence_drafts")
    op.drop_index("ix_ssd_status", table_name="signal_sequence_drafts")
    op.drop_index("ix_ssd_signal_id", table_name="signal_sequence_drafts")
    op.drop_index("ix_ssd_user_id", table_name="signal_sequence_drafts")
    op.drop_table("signal_sequence_drafts")
    op.drop_column("copilot_user_preferences", "signal_score_threshold")
