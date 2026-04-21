"""Add enrich_first flag + enrichment counters to voice campaigns

Revision ID: a4b5c6d7e8f9
Revises: z3a4b5c6d7e8
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a4b5c6d7e8f9"
down_revision = "z3a4b5c6d7e8"
branch_labels = None
depends_on = None


def upgrade():
    # voice_campaigns: opt-in flag + counters for the enrichment pass
    op.add_column("voice_campaigns", sa.Column("enrich_first", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("voice_campaigns", sa.Column("enrichment_credits_used", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("voice_campaigns", sa.Column("prospects_enriched", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("voice_campaigns", sa.Column("prospects_enrichment_failed", sa.Integer(), nullable=False, server_default="0"))

    # voice_campaign_prospects: per-row enrichment state
    op.add_column(
        "voice_campaign_prospects",
        sa.Column("needs_enrichment", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "voice_campaign_prospects",
        sa.Column("signal_event_id", UUID(as_uuid=True),
                  sa.ForeignKey("signal_events.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_vcp_signal_event_id", "voice_campaign_prospects", ["signal_event_id"])


def downgrade():
    op.drop_index("ix_vcp_signal_event_id", table_name="voice_campaign_prospects")
    op.drop_column("voice_campaign_prospects", "signal_event_id")
    op.drop_column("voice_campaign_prospects", "needs_enrichment")

    op.drop_column("voice_campaigns", "prospects_enrichment_failed")
    op.drop_column("voice_campaigns", "prospects_enriched")
    op.drop_column("voice_campaigns", "enrichment_credits_used")
    op.drop_column("voice_campaigns", "enrich_first")
