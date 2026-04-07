"""merge_all_heads

Revision ID: 96daf690f1a4
Revises: c3d4e5f6a1b2, g1a2b3c4d5e6, i2j3k4l5m6n7, r5s6t7u8v9w0
Create Date: 2026-04-07 17:03:32.272974

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '96daf690f1a4'
down_revision: Union[str, Sequence[str], None] = ('c3d4e5f6a1b2', 'g1a2b3c4d5e6', 'i2j3k4l5m6n7', 'r5s6t7u8v9w0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
