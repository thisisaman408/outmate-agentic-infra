"""Add gmail_access_token and gmail_refresh_token to users table

Revision ID: h1b2c3d4e5f7
Revises: g1a2b3c4d5e6
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = "h1b2c3d4e5f7"
down_revision = "af6371e90c7d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("gmail_access_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("gmail_refresh_token", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("users", "gmail_refresh_token")
    op.drop_column("users", "gmail_access_token")
