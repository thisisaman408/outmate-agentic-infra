"""Add metadata JSONB to flow for structured workflow settings

Revision ID: 2a8f1c9b4e72
Revises: fc7f696a57bf
Create Date: 2026-04-30 14:30:00.000000

Stores per-flow workflow settings used by the redesigned editor:
timezone, business_hours_only, skip_weekends, max_runs_per_record,
re_enrollment_rule, notify_owner_on_exit, slack_alerts,
email_notifications, error_alerts.

Dialect-aware: JSONB on Postgres, generic JSON on SQLite/MySQL.
Nullable + defaults to NULL so existing flows are unaffected.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "2a8f1c9b4e72"
down_revision: str | None = "fc7f696a57bf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _json_type(bind):
    return (
        postgresql.JSONB(astext_type=sa.Text())
        if bind.dialect.name == "postgresql"
        else sa.JSON()
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = [c["name"] for c in inspector.get_columns("flow")]

    if "workflow_metadata" not in column_names:
        with op.batch_alter_table("flow", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("workflow_metadata", _json_type(bind), nullable=True)
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    column_names = [c["name"] for c in inspector.get_columns("flow")]

    if "workflow_metadata" in column_names:
        with op.batch_alter_table("flow", schema=None) as batch_op:
            batch_op.drop_column("workflow_metadata")
