"""Add integration engine tables

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "n7o8p9q0r1s2"
down_revision = "m6n7o8p9q0r1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. integrations catalog
    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("short_description", sa.String(500), nullable=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("icon_url", sa.String(500), nullable=True),
        sa.Column("auth_type", sa.String(50), nullable=False, server_default="api_key"),
        sa.Column("auth_config", postgresql.JSONB, server_default="{}"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_coming_soon", sa.Boolean, server_default="false"),
        sa.Column("is_premium", sa.Boolean, server_default="false"),
        sa.Column("is_built_in", sa.Boolean, server_default="false"),
        sa.Column("supported_actions", postgresql.JSONB, server_default="[]"),
        sa.Column("supported_triggers", postgresql.JSONB, server_default="[]"),
        sa.Column("default_field_mappings", postgresql.JSONB, server_default="{}"),
        sa.Column("documentation_url", sa.String(500), nullable=True),
        sa.Column("rate_limit_per_minute", sa.Integer, server_default="60"),
        sa.Column("credit_cost", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_integrations_slug", "integrations", ["slug"], unique=True)
    op.create_index("ix_integrations_category", "integrations", ["category"])

    # 2. user_integrations
    op.create_table(
        "user_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("integrations.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="connected"),
        sa.Column("credentials_encrypted", sa.Text, nullable=True),
        sa.Column("config", postgresql.JSONB, server_default="{}"),
        sa.Column("metadata", postgresql.JSONB, server_default="{}"),
        sa.Column("connected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "integration_id", name="uq_user_integration"),
    )
    op.create_index("ix_user_integrations_user_id", "user_integrations", ["user_id"])

    # 3. integration_sync_logs
    op.create_table(
        "integration_sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sync_type", sa.String(20), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("records_total", sa.Integer, server_default="0"),
        sa.Column("records_succeeded", sa.Integer, server_default="0"),
        sa.Column("records_failed", sa.Integer, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_details", postgresql.JSONB, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
    )
    op.create_index("ix_integration_sync_logs_ui_id", "integration_sync_logs", ["user_integration_id"])

    # 4. integration_webhooks
    op.create_table(
        "integration_webhooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_integrations.id", ondelete="CASCADE"), nullable=True),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("webhook_url", sa.String(500), nullable=True),
        sa.Column("webhook_secret", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_integration_webhooks_user_id", "integration_webhooks", ["user_id"])

    # 5. api_keys
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("key_prefix", sa.String(10), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("scopes", postgresql.JSONB, server_default='["read","write"]'),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])
    op.create_index("ix_api_keys_key_hash", "api_keys", ["key_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("api_keys")
    op.drop_table("integration_webhooks")
    op.drop_table("integration_sync_logs")
    op.drop_table("user_integrations")
    op.drop_table("integrations")
