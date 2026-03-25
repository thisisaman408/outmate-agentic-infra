"""Visitor tracker v2 — schema fixes and enhancements

Revision ID: k2d3e4f5a6b7
Revises: f7e8d9c0b1a2
Create Date: 2026-03-23

Changes:
  site_configs:
    + webhook_secret       VARCHAR(64)  — HMAC secret for webhook signatures
    + isp_allowlist        JSONB        — per-org ISP keyword override list
    + anonymize_ips        BOOLEAN      — GDPR: mask last IP octet
    + gdpr_mode            BOOLEAN      — GDPR: honour visitor opt-out tokens

  visits:
    + enrichment_status    VARCHAR(20)  — pending | processing | done | failed

  visitor_sessions:           (new table)
    Full session-level aggregation of page views per visitor_id

  Indexes:
    + ix_visits_enrichment_status           — monitor failed enrichments
    + ix_visits_org_matched_partial         — partial index WHERE matched=true
    + ix_visits_fingerprint_expr            — expression index on resolution->>'fingerprint'
    + ix_visits_visitor_id_expr             — expression index on resolution->>'visitor_id'
    + ix_visitor_sessions_org_visitor       — fast session lookups
    + ix_identity_nodes_ip                  — already exists; no-op
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision = 'k2d3e4f5a6b7'
down_revision = 'f7e8d9c0b1a2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── site_configs additions ────────────────────────────────────────────────
    op.add_column('site_configs', sa.Column('webhook_secret', sa.String(64), nullable=True))
    op.add_column('site_configs', sa.Column('isp_allowlist', pg.JSONB, server_default='[]'))
    op.add_column('site_configs', sa.Column('anonymize_ips', sa.Boolean(), server_default='false'))
    op.add_column('site_configs', sa.Column('gdpr_mode', sa.Boolean(), server_default='false'))

    # ── visits additions ──────────────────────────────────────────────────────
    op.add_column(
        'visits',
        sa.Column('enrichment_status', sa.String(20), server_default='done', nullable=False),
    )

    # ── visitor_sessions table ────────────────────────────────────────────────
    op.create_table(
        'visitor_sessions',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True),
        sa.Column('org_id', pg.UUID(as_uuid=True),
                  sa.ForeignKey('site_configs.org_id', ondelete='CASCADE')),
        sa.Column('visitor_id', sa.String(64), nullable=False, index=True),
        sa.Column('session_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('session_end', sa.DateTime(timezone=True)),
        sa.Column('page_count', sa.Integer(), server_default='1'),
        sa.Column('total_dwell_ms', sa.Integer(), server_default='0'),
        sa.Column('avg_scroll_depth', sa.Float(), server_default='0'),
        sa.Column('total_cta_clicks', sa.Integer(), server_default='0'),
        sa.Column('entry_url', sa.Text()),
        sa.Column('exit_url', sa.Text()),
        sa.Column('referrer', sa.Text()),
        sa.Column('predicted_persona', sa.String(50)),
        sa.Column('buying_stage', sa.String(20)),
        sa.Column('engagement_score', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # ── New indexes ───────────────────────────────────────────────────────────

    # Monitor failed enrichments quickly
    op.create_index(
        'ix_visits_enrichment_status',
        'visits',
        ['org_id', 'enrichment_status'],
    )

    # Partial index — dashboard "matched visits" queries are the most common
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_visits_org_matched_partial "
        "ON visits (org_id, created_at DESC) WHERE matched = true"
    )

    # Expression index on fingerprint — enables fast fingerprint-based dedup checks
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_visits_fingerprint_expr "
        "ON visits ((resolution->>'fingerprint')) WHERE resolution->>'fingerprint' IS NOT NULL"
    )

    # Expression index on visitor_id — speeds up retroactive linking UPDATE
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_visits_visitor_id_expr "
        "ON visits ((resolution->>'visitor_id')) WHERE resolution->>'visitor_id' IS NOT NULL"
    )

    # Session table indexes
    op.create_index(
        'ix_visitor_sessions_org_visitor',
        'visitor_sessions',
        ['org_id', 'visitor_id', 'session_end'],
    )
    op.create_index(
        'ix_visitor_sessions_session_end',
        'visitor_sessions',
        ['session_end'],
    )

    # Backfill webhook_secret for existing site_configs rows
    op.execute(
        "UPDATE site_configs SET webhook_secret = encode(gen_random_bytes(32), 'hex') "
        "WHERE webhook_secret IS NULL"
    )


def downgrade() -> None:
    op.drop_index('ix_visitor_sessions_session_end', table_name='visitor_sessions')
    op.drop_index('ix_visitor_sessions_org_visitor', table_name='visitor_sessions')
    op.execute("DROP INDEX IF EXISTS ix_visits_visitor_id_expr")
    op.execute("DROP INDEX IF EXISTS ix_visits_fingerprint_expr")
    op.execute("DROP INDEX IF EXISTS ix_visits_org_matched_partial")
    op.drop_index('ix_visits_enrichment_status', table_name='visits')
    op.drop_table('visitor_sessions')
    op.drop_column('visits', 'enrichment_status')
    op.drop_column('site_configs', 'gdpr_mode')
    op.drop_column('site_configs', 'anonymize_ips')
    op.drop_column('site_configs', 'isp_allowlist')
    op.drop_column('site_configs', 'webhook_secret')
