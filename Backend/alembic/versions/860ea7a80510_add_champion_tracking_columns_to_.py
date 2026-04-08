"""Add champion tracking columns to watchers

Revision ID: 860ea7a80510
Revises: s6t7u8v9w0x1
Create Date: 2026-04-08 14:33:08.587047

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '860ea7a80510'
down_revision: Union[str, Sequence[str], None] = 's6t7u8v9w0x1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('watchers', sa.Column('linkedin_url', sa.String(length=512), nullable=True))
    op.add_column('watchers', sa.Column('track_job_changes', sa.Boolean(), server_default='False', nullable=False))
    op.add_column('watchers', sa.Column('last_known_company', sa.String(length=255), nullable=True))
    op.add_column('watchers', sa.Column('last_known_title', sa.String(length=255), nullable=True))
    op.add_column('watchers', sa.Column('last_job_check_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('watchers', 'last_job_check_at')
    op.drop_column('watchers', 'last_known_title')
    op.drop_column('watchers', 'last_known_company')
    op.drop_column('watchers', 'track_job_changes')
    op.drop_column('watchers', 'linkedin_url')
