"""Add slack_workspaces and slack_channel_configs tables

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-04-03 00:00:00.000000

Changes:
  - slack_workspaces: bot token storage per workspace install
  - slack_channel_configs: per-alert-type channel routing
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "l5m6n7o8p9q0"
down_revision = "k4l5m6n7o8p9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── slack_workspaces ──────────────────────────────────────────────────
    op.create_table(
        "slack_workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slack_team_id", sa.String(50), nullable=False),
        sa.Column("slack_team_name", sa.String(255), nullable=True),
        sa.Column("slack_team_domain", sa.String(255), nullable=True),
        sa.Column("bot_access_token", sa.Text(), nullable=False),
        sa.Column("bot_user_id", sa.String(50), nullable=True),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("authed_user_id", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "installed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_slack_workspaces_user_id"),
        sa.UniqueConstraint("slack_team_id", name="uq_slack_workspaces_team_id"),
    )
    op.create_index("ix_slack_workspaces_user_id", "slack_workspaces", ["user_id"])
    op.create_index("ix_slack_workspaces_team_id", "slack_workspaces", ["slack_team_id"])

    # ── slack_channel_configs ─────────────────────────────────────────────
    op.create_table(
        "slack_channel_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("channel_id", sa.String(50), nullable=False),
        sa.Column("channel_name", sa.String(255), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["slack_workspaces.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id", "alert_type", name="uq_slack_channel_workspace_alert"
        ),
    )
    op.create_index(
        "ix_slack_channel_configs_workspace_id",
        "slack_channel_configs",
        ["workspace_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_slack_channel_configs_workspace_id",
        table_name="slack_channel_configs",
    )
    op.drop_table("slack_channel_configs")

    op.drop_index("ix_slack_workspaces_team_id", table_name="slack_workspaces")
    op.drop_index("ix_slack_workspaces_user_id", table_name="slack_workspaces")
    op.drop_table("slack_workspaces")
