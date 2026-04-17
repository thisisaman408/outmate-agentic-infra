"""Add setup_steps and features columns to integrations

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-04-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "o8p9q0r1s2t3"
down_revision = "n7o8p9q0r1s2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("integrations", sa.Column("setup_steps", postgresql.JSONB, server_default="[]"))
    op.add_column("integrations", sa.Column("features", postgresql.JSONB, server_default="[]"))


def downgrade() -> None:
    op.drop_column("integrations", "features")
    op.drop_column("integrations", "setup_steps")
