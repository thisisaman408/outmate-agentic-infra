"""Add event_enrollments table

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-03-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'event_enrollments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('entity_name', sa.String(), nullable=True),
        sa.Column('entity_type', sa.String(length=20), nullable=False),
        sa.Column('event_types', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('entity_id', 'entity_type', name='uq_event_enrollment_entity'),
    )
    op.create_index('ix_event_enrollments_entity_id', 'event_enrollments', ['entity_id'])


def downgrade() -> None:
    op.drop_index('ix_event_enrollments_entity_id', table_name='event_enrollments')
    op.drop_table('event_enrollments')
