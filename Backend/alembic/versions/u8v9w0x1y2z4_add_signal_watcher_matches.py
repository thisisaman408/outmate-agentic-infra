"""add signal_watcher_matches join table for social listening

Revision ID: u8v9w0x1y2z4
Revises: t7u8v9w0x1y2
Create Date: 2026-04-10 00:00:00.000000

Many-to-many between `signal_events` and `watchers`, with `user_id`
denormalised onto each row so the social-listening feed is a single
indexed scan instead of a 2-hop join through watchers.

This table was originally created on prod via direct SQL (alembic was
already wedged on the orphan u8v9w0x1y2z3 chain at the time of the
bootstrap commit).  This migration is idempotent so future clones can
run `alembic upgrade head` cleanly without crashing.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "u8v9w0x1y2z4"
down_revision: Union[str, None] = "t7u8v9w0x1y2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS signal_watcher_matches (
            signal_id   UUID         NOT NULL
                REFERENCES signal_events(id) ON DELETE CASCADE,
            watcher_id  VARCHAR(64)  NOT NULL
                REFERENCES watchers(id) ON DELETE CASCADE,
            user_id     UUID         NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
            match_score INTEGER,
            matched_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
            CONSTRAINT pk_signal_watcher_matches PRIMARY KEY (signal_id, watcher_id)
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_signal_watcher_matches_user_matched "
        "ON signal_watcher_matches (user_id, matched_at DESC);"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_signal_watcher_matches_watcher "
        "ON signal_watcher_matches (watcher_id);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_signal_watcher_matches_watcher;")
    op.execute("DROP INDEX IF EXISTS ix_signal_watcher_matches_user_matched;")
    op.execute("DROP TABLE IF EXISTS signal_watcher_matches;")
