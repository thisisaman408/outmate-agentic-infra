"""Add calendar_event_id and viewed_at to copilot_meeting_preps

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = "n2o3p4q5r6s7"
down_revision = "m1n2o3p4q5r6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "copilot_meeting_preps",
        sa.Column("calendar_event_id", sa.Text(), nullable=True),
    )
    op.add_column(
        "copilot_meeting_preps",
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_copilot_meeting_preps_calendar_event_id",
        "copilot_meeting_preps",
        ["calendar_event_id"],
    )


def downgrade():
    op.drop_index("ix_copilot_meeting_preps_calendar_event_id", table_name="copilot_meeting_preps")
    op.drop_column("copilot_meeting_preps", "viewed_at")
    op.drop_column("copilot_meeting_preps", "calendar_event_id")
