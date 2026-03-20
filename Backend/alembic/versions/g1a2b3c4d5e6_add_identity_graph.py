"""Add identity_nodes table for visitor identity graph

Revision ID: g1a2b3c4d5e6
Revises: f7e8d9c0b1a2
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET


revision = 'g1a2b3c4d5e6'
down_revision = 'f7e8d9c0b1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'identity_nodes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('visitor_id', sa.String(64), unique=True),
        sa.Column('ip', INET),
        sa.Column('email', sa.String(255)),
        sa.Column('full_name', sa.String(255)),
        sa.Column('phone', sa.String(50)),
        sa.Column('linkedin_url', sa.String(512)),
        sa.Column('job_title', sa.String(255)),
        sa.Column('company_name', sa.String(255)),
        sa.Column('company_domain', sa.String(255)),
        sa.Column('raw_data', JSONB, server_default='{}'),
        sa.Column('sources', JSONB, server_default='[]'),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('pixel_key', sa.String(255)),
    )
    op.create_index('ix_identity_nodes_visitor_id', 'identity_nodes', ['visitor_id'], unique=True)
    op.create_index('ix_identity_nodes_ip', 'identity_nodes', ['ip'])
    op.create_index('ix_identity_nodes_email', 'identity_nodes', ['email'])


def downgrade() -> None:
    op.drop_index('ix_identity_nodes_email', table_name='identity_nodes')
    op.drop_index('ix_identity_nodes_ip', table_name='identity_nodes')
    op.drop_index('ix_identity_nodes_visitor_id', table_name='identity_nodes')
    op.drop_table('identity_nodes')
