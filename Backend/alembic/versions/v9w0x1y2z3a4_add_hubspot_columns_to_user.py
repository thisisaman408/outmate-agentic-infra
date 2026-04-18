"""Add HubSpot OAuth columns to users table

Revision ID: v9w0x1y2z3a4
Revises: u8v9w0x1y2z4
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = "v9w0x1y2z3a4"
down_revision = "u8v9w0x1y2z4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("hubspot_access_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("hubspot_refresh_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("hubspot_portal_id", sa.String(), nullable=True))
    op.add_column("users", sa.Column("hubspot_connected_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("users", "hubspot_connected_at")
    op.drop_column("users", "hubspot_portal_id")
    op.drop_column("users", "hubspot_refresh_token")
    op.drop_column("users", "hubspot_access_token")
