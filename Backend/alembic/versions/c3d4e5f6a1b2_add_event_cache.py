"""Add event_cache table

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-03-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c3d4e5f6a1b2'
down_revision: Union[str, None] = 'b2c3d4e5f6a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_cache',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('event_uid', sa.String(), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('entity_name', sa.String(), nullable=True),
        sa.Column('entity_type', sa.String(length=20), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('event_label', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('timestamp', sa.String(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('impact', sa.String(), nullable=True),
        sa.Column('event_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('event_uid', name='uq_event_cache_uid'),
    )
    op.create_index('ix_event_cache_entity_id', 'event_cache', ['entity_id'])
    op.create_index('ix_event_cache_fetched_at', 'event_cache', ['fetched_at'])


def downgrade() -> None:
    op.drop_index('ix_event_cache_fetched_at', table_name='event_cache')
    op.drop_index('ix_event_cache_entity_id', table_name='event_cache')
    op.drop_table('event_cache')
