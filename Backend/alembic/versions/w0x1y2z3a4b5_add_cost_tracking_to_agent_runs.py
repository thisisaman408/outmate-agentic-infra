"""Add cost tracking columns to outmate_agent_runs

Revision ID: w0x1y2z3a4b5
Revises: v9w0x1y2z3a4
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa

revision = "w0x1y2z3a4b5"
down_revision = "v9w0x1y2z3a4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("outmate_agent_runs", sa.Column("tokens_input", sa.Integer(), nullable=True))
    op.add_column("outmate_agent_runs", sa.Column("tokens_output", sa.Integer(), nullable=True))
    op.add_column("outmate_agent_runs", sa.Column("cost_credits", sa.Integer(), nullable=True))
    op.add_column("outmate_agent_runs", sa.Column("cost_usd", sa.Float(), nullable=True))
    op.add_column("outmate_agent_runs", sa.Column("model_used", sa.String(128), nullable=True))


def downgrade():
    op.drop_column("outmate_agent_runs", "model_used")
    op.drop_column("outmate_agent_runs", "cost_usd")
    op.drop_column("outmate_agent_runs", "cost_credits")
    op.drop_column("outmate_agent_runs", "tokens_output")
    op.drop_column("outmate_agent_runs", "tokens_input")
