"""Add performance indexes for visitor tables

Revision ID: f7e8d9c0b1a2
Revises: ce442e5895fc
Create Date: 2026-03-17

Indexes added:
  - visits(ip)                      → fast IP lookups in analytics + dedup
  - visits(org_id, matched)         → fast stats queries (count matched vs total)
  - visits(org_id, created_at DESC) → already exists, kept for reference
  - visits(created_at)              → analytics time-range scans
  - visits.resolution gin index     → fast JSONB path queries (visitor_id retrolink, category filter)
  - alerts(visit_id)                → fast alert lookups per visit
"""

from alembic import op
import sqlalchemy as sa


revision = 'f7e8d9c0b1a2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── visits indexes ────────────────────────────────────────────────────────

    # IP lookups (analytics geographic grouping, dedup verification)
    op.create_index(
        'ix_visits_ip',
        'visits',
        ['ip'],
        unique=False,
    )

    # Stats queries: COUNT WHERE org_id=X AND matched=Y
    op.create_index(
        'ix_visits_org_id_matched',
        'visits',
        ['org_id', 'matched'],
        unique=False,
    )

    # Time-range scans for analytics (org_id + created_at is the primary filter)
    op.create_index(
        'ix_visits_created_at',
        'visits',
        ['created_at'],
        unique=False,
    )

    # GIN index on resolution JSONB — enables fast:
    #   resolution->>'visitor_id' = X  (retroactive linking UPDATE)
    #   resolution->>'category' = X    (category filter)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_visits_resolution_gin ON visits USING GIN (resolution)"
    )

    # ── alerts indexes ────────────────────────────────────────────────────────

    # Fast alert lookups by visit (webhook audit queries)
    op.create_index(
        'ix_alerts_visit_id',
        'alerts',
        ['visit_id'],
        unique=False,
    )

    # Alert status queries (find pending/failed alerts for retry monitoring)
    op.create_index(
        'ix_alerts_status',
        'alerts',
        ['status'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_alerts_status', table_name='alerts')
    op.drop_index('ix_alerts_visit_id', table_name='alerts')
    op.execute("DROP INDEX IF EXISTS ix_visits_resolution_gin")
    op.drop_index('ix_visits_created_at', table_name='visits')
    op.drop_index('ix_visits_org_id_matched', table_name='visits')
    op.drop_index('ix_visits_ip', table_name='visits')
