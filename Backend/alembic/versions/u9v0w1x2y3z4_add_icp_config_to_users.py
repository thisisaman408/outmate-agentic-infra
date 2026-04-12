"""add icp_config JSONB column to users table

Revision ID: u9v0w1x2y3z4
Revises: t7u8v9w0x1y2
Create Date: 2026-04-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "u9v0w1x2y3z4"
down_revision: Union[str, None] = "t7u8v9w0x1y2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("icp_config", JSONB, server_default="{}", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "icp_config")
