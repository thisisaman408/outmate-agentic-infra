"""Add copilot tables

Revision ID: a1b2c3d4e5f6
Revises: ce442e5895fc
Create Date: 2026-03-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'ce442e5895fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # copilot_briefs
    op.create_table(
        'copilot_briefs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('brief_date', sa.Date(), nullable=False, index=True),
        sa.Column('brief_type', sa.String(50), server_default='daily'),
        sa.Column('content', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(20), server_default='generated'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('user_id', 'brief_date', 'brief_type', name='uq_user_brief_date_type'),
    )

    # copilot_meeting_preps
    op.create_table(
        'copilot_meeting_preps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('company_name', sa.String(500), nullable=False),
        sa.Column('company_domain', sa.String(255), nullable=True),
        sa.Column('prospect_name', sa.String(500), nullable=True),
        sa.Column('prospect_title', sa.String(500), nullable=True),
        sa.Column('meeting_type', sa.String(50), server_default='discovery'),
        sa.Column('content', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # copilot_campaign_analyses
    op.create_table(
        'copilot_campaign_analyses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('campaign_id', sa.String(255), nullable=True),
        sa.Column('input_data', postgresql.JSONB(), nullable=False),
        sa.Column('analysis', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # copilot_pipeline_alerts
    op.create_table(
        'copilot_pipeline_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), server_default='medium'),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.String(255), nullable=True),
        sa.Column('entity_name', sa.String(500), nullable=True),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # copilot_user_preferences
    op.create_table(
        'copilot_user_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column('daily_brief_enabled', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('daily_brief_time', sa.String(5), server_default='08:00'),
        sa.Column('daily_brief_timezone', sa.String(50), server_default='UTC'),
        sa.Column('notify_email', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('notify_slack', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('slack_webhook_url', sa.String(500), nullable=True),
        sa.Column('pipeline_alerts_enabled', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('alert_severity_threshold', sa.String(20), server_default='medium'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('copilot_user_preferences')
    op.drop_table('copilot_pipeline_alerts')
    op.drop_table('copilot_campaign_analyses')
    op.drop_table('copilot_meeting_preps')
    op.drop_table('copilot_briefs')
