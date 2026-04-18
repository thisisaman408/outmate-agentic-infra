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
