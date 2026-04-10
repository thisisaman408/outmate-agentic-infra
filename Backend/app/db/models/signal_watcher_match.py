"""Many-to-many join between signal_events and watchers.

This is the tenant-isolation backbone for the Social Listening feature:
the global `signal_events` table has no `user_id` (signals are
de-duplicated globally by fingerprint), so we link each signal to one
or more watchers via this table, and each watcher is owned by a user.
A user sees a signal iff at least one of their watchers matched it.

`user_id` is denormalised onto each row so the social-listening feed
query can be a single indexed scan instead of a 2-hop join.
"""
import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, PrimaryKeyConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.base import Base


class SignalWatcherMatch(Base):
    __tablename__ = "signal_watcher_matches"

    signal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signal_events.id", ondelete="CASCADE"),
        nullable=False,
    )
    watcher_id = Column(
        String(64),
        ForeignKey("watchers.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Per-watcher match strength (how confident this match is, 0-100).
    # The signal's overall icp_score is global; this is per-watcher.
    match_score = Column(Integer, nullable=True)

    matched_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("signal_id", "watcher_id", name="pk_signal_watcher_matches"),
        Index("ix_signal_watcher_matches_user_matched", "user_id", "matched_at"),
        Index("ix_signal_watcher_matches_watcher", "watcher_id"),
    )
