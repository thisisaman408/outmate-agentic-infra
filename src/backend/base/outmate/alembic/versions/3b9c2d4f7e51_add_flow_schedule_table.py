"""Add flow_schedule table for cron/interval workflow scheduling

Revision ID: 3b9c2d4f7e51
Revises: 2a8f1c9b4e72
Create Date: 2026-04-30 15:30:00.000000

Dialect-aware: native ENUM on Postgres, VARCHAR + CHECK constraint on SQLite.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3b9c2d4f7e51"
down_revision: str | None = "2a8f1c9b4e72"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SCHEDULE_TYPE_VALUES = ("manual", "interval", "cron")


def _uuid_type(bind):
    if bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import UUID

        return UUID(as_uuid=True)
    # SQLite + others: store as 36-char string
    return sa.String(length=36)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "flow_schedule" in set(inspector.get_table_names()):
        return

    schedule_type_col = sa.Enum(
        *SCHEDULE_TYPE_VALUES,
        name="flow_schedule_type",
        # On SQLite this becomes VARCHAR + CHECK; on Postgres a native enum.
        native_enum=True,
    )

    op.create_table(
        "flow_schedule",
        sa.Column("id", _uuid_type(bind), primary_key=True),
        sa.Column(
            "flow_id",
            _uuid_type(bind),
            sa.ForeignKey("flow.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "schedule_type",
            schedule_type_col,
            nullable=False,
            server_default=sa.text("'manual'"),
        ),
        sa.Column("expression", sa.String(), nullable=True),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
        ),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_flow_schedule_flow_id", "flow_schedule", ["flow_id"]
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "flow_schedule" in set(inspector.get_table_names()):
        op.drop_index("ix_flow_schedule_flow_id", table_name="flow_schedule")
        op.drop_table("flow_schedule")

    if bind.dialect.name == "postgresql":
        # Drop the native enum after the table is gone.
        op.execute(sa.text("DROP TYPE IF EXISTS flow_schedule_type"))
