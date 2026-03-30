"""Add google_calendar_channel_id, resource_id, webhook_expiry to users table

Revision ID: m1n2o3p4q5r6
Revises: k2d3e4f5a6b7
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = "m1n2o3p4q5r6"
down_revision = "d4e5f6a1b2c3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("google_calendar_channel_id", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("google_calendar_resource_id", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("google_calendar_webhook_expiry", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("users", "google_calendar_webhook_expiry")
    op.drop_column("users", "google_calendar_resource_id")
    op.drop_column("users", "google_calendar_channel_id")
