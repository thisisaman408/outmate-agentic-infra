"""Social Listening service — continuous monitoring of LinkedIn / X for
people matching a saved search profile.

A "social listening search" is just a `Watcher` row with `type='social_listening'`.
Its config (keywords, signal types, sender context) lives in `criteria` JSON.

This module:
1. Orchestrates the existing LeadDiscoveryOutreachAgent (in the agentic infra)
   for one or many watchers.
2. Parses the agent's structured output and writes one row per discovered
   lead into the existing `signal_events` table.
3. Links each new signal to the matching watcher via
   `signal_watcher_matches`, which is the tenant-isolation backbone.
4. Scores each signal via the existing `ICPSignalScorer`.
5. Updates `watcher.last_synced_at` and `watcher.match_count` so the
   sidebar shows fresh stats.

Reuses (does NOT reinvent):
- The agentic infra agent (already deployed)
- `signal_events` table + dedup fingerprint
- `ICPSignalScorer` (already 0–100, already tested)
- `Watcher` model and CRUD route
"""
from app.services.social_listening.service import SocialListeningService

__all__ = ["SocialListeningService"]
