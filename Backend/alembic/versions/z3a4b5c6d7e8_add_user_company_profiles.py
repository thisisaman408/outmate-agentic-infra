"""Add user_company_profiles table

Revision ID: z3a4b5c6d7e8
Revises: y2z3a4b5c6d7
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "z3a4b5c6d7e8"
down_revision = "y2z3a4b5c6d7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_company_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("website_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("one_liner", sa.Text(), nullable=False, server_default=""),
        sa.Column("product_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("pricing_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("icp_description", sa.Text(), nullable=False, server_default=""),
        sa.Column("objection_handling", sa.Text(), nullable=False, server_default=""),
        sa.Column("key_differentiators", sa.Text(), nullable=False, server_default=""),
        sa.Column("additional_context", sa.Text(), nullable=False, server_default=""),
        sa.Column("agent_persona_name", sa.String(128), nullable=False, server_default="Alex"),
        sa.Column("agent_persona_role", sa.String(128), nullable=False, server_default="GTM Specialist"),
        sa.Column("calendar_booking_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_company_profiles_user_id", "user_company_profiles", ["user_id"])
    op.create_unique_constraint("uq_user_company_profile_user_id", "user_company_profiles", ["user_id"])


def downgrade():
    op.drop_constraint("uq_user_company_profile_user_id", "user_company_profiles", type_="unique")
    op.drop_index("ix_user_company_profiles_user_id", table_name="user_company_profiles")
    op.drop_table("user_company_profiles")
