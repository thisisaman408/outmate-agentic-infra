"""Add copilot_notifications table

Revision ID: p3q4r5s6t7u8
Revises: n2o3p4q5r6s7
Create Date: 2026-03-31 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "p3q4r5s6t7u8"
down_revision: Union[str, Sequence[str], None] = "n2o3p4q5r6s7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "copilot_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("cta_url", sa.String(512), nullable=False, server_default=""),
        sa.Column("priority", sa.String(16), nullable=False, server_default="green"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("grouped_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_copilot_notifications_user_id", "copilot_notifications", ["user_id"])
    op.create_index(
        "ix_copilot_notifications_user_created",
        "copilot_notifications",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_copilot_notifications_user_created", table_name="copilot_notifications")
    op.drop_index("ix_copilot_notifications_user_id", table_name="copilot_notifications")
    op.drop_table("copilot_notifications")
