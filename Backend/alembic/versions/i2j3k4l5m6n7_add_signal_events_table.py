"""Add signal_events table for signal pipeline

Revision ID: i2j3k4l5m6n7
Revises: k2d3e4f5a6b7
Create Date: 2026-03-31 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'i2j3k4l5m6n7'
down_revision = 'k2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create signal_events table
    op.create_table(
        'signal_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('signal_type', sa.String(length=50), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('company_domain', sa.String(length=255), nullable=True),
        sa.Column('company_name', sa.String(length=500), nullable=True),
        sa.Column('prospect_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('prospect_email', sa.String(length=255), nullable=True),
        sa.Column('prospect_name', sa.String(length=500), nullable=True),
        sa.Column('prospect_title', sa.String(length=500), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('raw_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('icp_score', sa.Integer(), nullable=True),
        sa.Column('icp_match_factors', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('fingerprint', sa.String(length=32), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('credits_consumed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent_to_copilot', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('copilot_queue_id', sa.String(length=255), nullable=True),
        sa.Column('discovered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ingested_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['prospect_id'], ['prospects.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('fingerprint', 'company_domain', 'signal_type', name='uq_signal_fingerprint_dedup'),
    )

    # Create indexes
    op.create_index('ix_signal_events_signal_type', 'signal_events', ['signal_type'], unique=False)
    op.create_index('ix_signal_events_company_id', 'signal_events', ['company_id'], unique=False)
    op.create_index('ix_signal_events_company_domain', 'signal_events', ['company_domain'], unique=False)
    op.create_index('ix_signal_events_prospect_id', 'signal_events', ['prospect_id'], unique=False)
    op.create_index('ix_signal_events_fingerprint', 'signal_events', ['fingerprint'], unique=False)
    op.create_index('ix_signal_events_is_archived', 'signal_events', ['is_archived'], unique=False)
    op.create_index('ix_signal_events_ingested_at', 'signal_events', ['ingested_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_signal_events_ingested_at', table_name='signal_events')
    op.drop_index('ix_signal_events_is_archived', table_name='signal_events')
    op.drop_index('ix_signal_events_fingerprint', table_name='signal_events')
    op.drop_index('ix_signal_events_prospect_id', table_name='signal_events')
    op.drop_index('ix_signal_events_company_domain', table_name='signal_events')
    op.drop_index('ix_signal_events_company_id', table_name='signal_events')
    op.drop_index('ix_signal_events_signal_type', table_name='signal_events')
    op.drop_table('signal_events')
