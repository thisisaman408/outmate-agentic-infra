"""add expires_at to copilot_briefs

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-03-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a1b2c3"
down_revision = "h1b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "copilot_briefs",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_copilot_briefs_expires_at", "copilot_briefs", ["expires_at"])


def downgrade():
    op.drop_index("ix_copilot_briefs_expires_at", table_name="copilot_briefs")
    op.drop_column("copilot_briefs", "expires_at")
