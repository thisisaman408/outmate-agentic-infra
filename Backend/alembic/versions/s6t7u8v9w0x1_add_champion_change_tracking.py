"""add_champion_change_tracking

Revision ID: s6t7u8v9w0x1
Revises: 96daf690f1a4
Create Date: 2026-04-07

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision: str = 's6t7u8v9w0x1'
down_revision: Union[str, None] = '96daf690f1a4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend watchers table ──────────────────────────────────────────────
    op.add_column('watchers', sa.Column('linkedin_url',        sa.String(512),              nullable=True))
    op.add_column('watchers', sa.Column('track_job_changes',   sa.Boolean(),                nullable=False, server_default='false'))
    op.add_column('watchers', sa.Column('last_known_company',  sa.String(255),              nullable=True))
    op.add_column('watchers', sa.Column('last_known_title',    sa.String(255),              nullable=True))
    op.add_column('watchers', sa.Column('last_job_check_at',   sa.DateTime(timezone=True),  nullable=True))

    # ── New champion_change_events table ──────────────────────────────────
    op.create_table(
        'champion_change_events',
        sa.Column('id',               sa.String(64),              primary_key=True),
        sa.Column('watcher_id',       sa.String(64),              sa.ForeignKey('watchers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',          pg.UUID(as_uuid=True),      sa.ForeignKey('users.id',   ondelete='CASCADE'), nullable=False),
        sa.Column('contact_name',     sa.String(255),             nullable=True),
        sa.Column('contact_linkedin', sa.String(512),             nullable=True),
        sa.Column('prev_company',     sa.String(255),             nullable=True),
        sa.Column('prev_title',       sa.String(255),             nullable=True),
        sa.Column('new_company',      sa.String(255),             nullable=True),
        sa.Column('new_title',        sa.String(255),             nullable=True),
        sa.Column('change_type',      sa.String(32),              nullable=False),   # left_account | joined_account | promoted
        sa.Column('draft_email',      sa.Text(),                  nullable=True),
        sa.Column('status',           sa.String(32),              nullable=False, server_default='pending'),
        sa.Column('is_read',          sa.Boolean(),               nullable=False, server_default='false'),
        sa.Column('detected_at',      sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_champion_change_events_watcher',      'champion_change_events', ['watcher_id'])
    op.create_index('ix_champion_change_events_user',         'champion_change_events', ['user_id'])
    op.create_index('ix_champion_change_events_user_detected','champion_change_events', ['user_id', 'detected_at'])


def downgrade() -> None:
    op.drop_index('ix_champion_change_events_user_detected', table_name='champion_change_events')
    op.drop_index('ix_champion_change_events_user',          table_name='champion_change_events')
    op.drop_index('ix_champion_change_events_watcher',       table_name='champion_change_events')
    op.drop_table('champion_change_events')
    for col in ('last_job_check_at', 'last_known_title', 'last_known_company', 'track_job_changes', 'linkedin_url'):
        op.drop_column('watchers', col)
