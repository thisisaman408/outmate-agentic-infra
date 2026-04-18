"""Add workflow tables

Revision ID: x1y2z3a4b5c6
Revises: w0x1y2z3a4b5
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "x1y2z3a4b5c6"
down_revision = "w0x1y2z3a4b5"
branch_labels = None
depends_on = None


def upgrade():
    # -- workflows table --
    op.create_table(
        "workflows",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("trigger_type", sa.String(64), nullable=False),
        sa.Column("target_object", sa.String(64), nullable=False),
        sa.Column("nodes", JSONB(), nullable=False, server_default="[]"),
        sa.Column("settings", JSONB(), nullable=False, server_default="{}"),
        sa.Column("owner_name", sa.String(128), nullable=True),
        sa.Column("folder", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("runs_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runs_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runs_in_progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("runs_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credit_usage", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_workflows_user_id", "workflows", ["user_id"])
    op.create_index("ix_workflows_status", "workflows", ["status"])
    op.create_index("ix_workflows_user_status", "workflows", ["user_id", "status"])

    # -- workflow_executions table --
    op.create_table(
        "workflow_executions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("workflow_id", UUID(as_uuid=True), sa.ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="running"),
        sa.Column("input_data", JSONB(), nullable=False, server_default="{}"),
        sa.Column("output_data", JSONB(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("credits_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_workflow_executions_workflow_id", "workflow_executions", ["workflow_id"])
    op.create_index("ix_workflow_executions_user_id", "workflow_executions", ["user_id"])
    op.create_index("ix_workflow_executions_workflow_created", "workflow_executions", ["workflow_id", "created_at"])


def downgrade():
    op.drop_table("workflow_executions")
    op.drop_table("workflows")
