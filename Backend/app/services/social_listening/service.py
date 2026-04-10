"""SocialListeningService — runs an agent for a watcher and ingests signals."""

from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.db.models.signal_event import SignalEvent
from app.db.models.signal_watcher_match import SignalWatcherMatch
from app.db.models.watcher import Watcher
from app.services.social_listening.signal_taxonomy import classify_signal
from app.services.social_listening.sources.dispatcher import dispatch_search

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# All social-listening signals share the same source string so the existing
# signal pipeline (scoring, archiving, credit accounting) treats them as a
# single class.
SOCIAL_LISTENING_SOURCE = "social_listening"

# New signal_type values for the social_events.signal_type column.  The
# column is String(50) with no enum constraint so adding values is free.
SIGNAL_TYPE_POST = "social_post"
SIGNAL_TYPE_COMMENT = "social_comment"
SIGNAL_TYPE_REACTION = "social_reaction"
SIGNAL_TYPE_ARTICLE = "social_article"
SIGNAL_TYPE_RESHARE = "social_reshare"
SIGNAL_TYPE_JOB_CHANGE = "social_job_change"

ALL_SOCIAL_SIGNAL_TYPES = [
    SIGNAL_TYPE_POST,
    SIGNAL_TYPE_COMMENT,
    SIGNAL_TYPE_REACTION,
    SIGNAL_TYPE_ARTICLE,
    SIGNAL_TYPE_RESHARE,
    SIGNAL_TYPE_JOB_CHANGE,
]


class SocialListeningService:
    """Run a social-listening watcher and ingest the results as signals.

    Lifecycle of one call to `run_for_watcher`:
        1. Extract the watcher's keywords, source, boolean_query and filters
           from `watcher.criteria`.
        2. Call the multi-source dispatcher which routes to CrustData
           (always available) and optionally Apify for enhancement.
        3. For each normalized result, dedupe by fingerprint and either
           insert a new `signal_events` row or reuse the existing one.
        4. Link the signal to this watcher via `signal_watcher_matches`.
        5. Score the lead with a lightweight inline scorer (the full
           `ICPSignalScorer` runs later via the signal_pipeline beat task).
        6. Bump `watcher.last_synced_at` + `match_count`.

    All DB writes happen on the caller-provided session.  The caller owns
    commit/rollback.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    async def run_for_watcher(
        self,
        watcher: Watcher,
    ) -> Dict[str, Any]:
        """Execute the dispatcher for one watcher.  Returns a summary dict."""
        if watcher.type != "social_listening":
            raise ValueError(
                f"watcher {watcher.id} is type={watcher.type!r}, not 'social_listening'"
            )

        criteria: Dict[str, Any] = dict(watcher.criteria or {})
        keywords: List[str] = list(criteria.get("keywords") or [])
        if not keywords:
            raise ValueError(f"watcher {watcher.id} has no keywords")

        max_leads = int(criteria.get("max_leads", 5))

        started = time.monotonic()
        try:
            results = await dispatch_search(
                source=criteria.get("source", "linkedin_posts"),
                keywords=keywords,
                boolean_query=criteria.get("boolean_query"),
                filters=criteria.get("filters"),
                max_results=max_leads,
                time_frame=criteria.get("time_frame", "week"),
            )
        except Exception as exc:  # noqa: BLE001
            duration_ms = int((time.monotonic() - started) * 1000)
            logger.warning(
                "social-listening dispatcher failed for watcher_id=%s user_id=%s: %s",
                watcher.id,
                watcher.user_id,
                exc,
            )
            return {
                "watcher_id": watcher.id,
                "status": "error",
                "error": str(exc),
                "discovered": 0,
                "duration_ms": duration_ms,
            }

        discovered = 0
        signals_created: List[SignalEvent] = []
        for result in results:
            sig = self._ingest_lead_as_signal(watcher, result)
            if sig:
                signals_created.append(sig)
            discovered += 1

        # Auto-enrich if enabled on this watcher
        enriched_count = 0
        if criteria.get("auto_enrich"):
            from app.services.social_listening.enrichment import enrich_signal as do_enrich

            for sig in signals_created:
                if not sig.prospect_email:
                    try:
                        await do_enrich(sig, self.db)
                        enriched_count += 1
                    except Exception as enrich_exc:  # noqa: BLE001
                        logger.debug(
                            "auto-enrich failed for signal %s: %s",
                            sig.id,
                            enrich_exc,
                        )

        # Update the watcher's stats so the sidebar shows fresh numbers.
        watcher.last_synced_at = datetime.now(timezone.utc)
        try:
            new_count = int(watcher.match_count or 0) + discovered
        except (TypeError, ValueError):
            new_count = discovered
        watcher.match_count = str(new_count)

        duration_ms = int((time.monotonic() - started) * 1000)
        logger.info(
            "social-listening run OK watcher_id=%s user_id=%s discovered=%d enriched=%d duration_ms=%d",
            watcher.id,
            watcher.user_id,
            discovered,
            enriched_count,
            duration_ms,
        )
        return {
            "watcher_id": watcher.id,
            "status": "success",
            "discovered": discovered,
            "enriched": enriched_count,
            "duration_ms": duration_ms,
        }

    # ----------------------------------------------------------------------
    # Internal — ingest a single agent-parsed lead into signal_events
    # ----------------------------------------------------------------------

    def _ingest_lead_as_signal(self, watcher: Watcher, lead: Dict[str, Any]) -> Optional[SignalEvent]:
        """Insert (or reuse) a signal_events row and link it to the watcher.

        Returns the SignalEvent object (new or existing) so callers can
        perform post-ingestion work like auto-enrichment.
        """

        linkedin = (lead.get("linkedin") or "").strip()
        post_url = (lead.get("post_url") or "").strip()
        company = (lead.get("company") or "").strip()
        domain = self._extract_domain(lead.get("email") or "") or self._slugify_domain(company)

        fingerprint = self._fingerprint(linkedin, post_url, company)

        # Try to find an existing global signal with the same fingerprint.
        # The unique constraint on (fingerprint, company_domain, signal_type)
        # would raise on a re-insert, so we look up first.
        existing = (
            self.db.query(SignalEvent)
            .filter(SignalEvent.fingerprint == fingerprint)
            .first()
        )
        # Classify the signal using the taxonomy based on post content.
        taxonomy = classify_signal(
            lead.get("post_snippet", ""), signal_type=SIGNAL_TYPE_POST
        )

        if existing:
            signal = existing
            # Back-fill taxonomy on existing signals that were ingested before
            # the classifier was added.
            raw = dict(signal.raw_data or {})
            if "taxonomy" not in raw:
                raw["taxonomy"] = taxonomy
                signal.raw_data = raw
        else:
            raw_data = {
                "linkedin": linkedin,
                "post_url": post_url,
                "post_snippet": lead.get("post_snippet") or "",
                "best_hook": lead.get("best_hook") or "",
                "message": lead.get("message") or "",
                "char_count": lead.get("char_count") or 0,
                "char_limit": lead.get("char_limit") or 300,
                "message_type": lead.get("message_type") or "",
                "tone": lead.get("tone") or "",
                "email_unverified": lead.get("email_unverified") or False,
                "taxonomy": taxonomy,
            }
            # Use the classified signal name (e.g. "champion_job_change")
            # instead of the generic "social_post" constant.  The column is
            # String(50) with no enum constraint so any name is valid.
            signal_type_name = taxonomy.get("signal_name") or SIGNAL_TYPE_POST

            signal = SignalEvent(
                signal_type=signal_type_name,
                source=SOCIAL_LISTENING_SOURCE,
                company_name=company or None,
                company_domain=domain or None,
                prospect_name=lead.get("name") or None,
                prospect_title=lead.get("title") or None,
                prospect_email=lead.get("email") or None,
                raw_data=raw_data,
                fingerprint=fingerprint,
                icp_score=self._inline_intent_score(lead),
                icp_match_factors=self._inline_match_factors(lead, watcher),
                discovered_at=datetime.now(timezone.utc),
            )
            self.db.add(signal)
            self.db.flush()  # populate signal.id without committing

        # Link to this watcher (idempotent — pkey is composite).
        link_exists = (
            self.db.query(SignalWatcherMatch)
            .filter(
                SignalWatcherMatch.signal_id == signal.id,
                SignalWatcherMatch.watcher_id == watcher.id,
            )
            .first()
        )
        if not link_exists:
            self.db.add(
                SignalWatcherMatch(
                    signal_id=signal.id,
                    watcher_id=watcher.id,
                    user_id=watcher.user_id,
                    match_score=signal.icp_score,
                )
            )

        return signal

    # ----------------------------------------------------------------------
    # Helpers
    # ----------------------------------------------------------------------

    @staticmethod
    def _fingerprint(linkedin: str, post_url: str, company: str) -> str:
        """Stable per-(person,post) hash so the same signal isn't ingested twice.

        Falls back to (company, name) when no post URL is available.
        """
        material = "|".join([linkedin.lower(), post_url.lower(), company.lower()])
        return hashlib.md5(material.encode("utf-8")).hexdigest()

    @staticmethod
    def _extract_domain(email: str) -> Optional[str]:
        if not email or "@" not in email:
            return None
        return email.split("@", 1)[1].strip().lower() or None

    @staticmethod
    def _slugify_domain(company: str) -> Optional[str]:
        """When no email is available, fabricate a stable identifier from the
        company name so dedup still works.  Not a real domain — never used
        for outreach, only for the unique constraint on signal_events.
        """
        if not company:
            return None
        slug = re.sub(r"[^a-z0-9]+", "", company.lower())
        return f"{slug}.unknown" if slug else None

    @staticmethod
    def _inline_intent_score(lead: Dict[str, Any]) -> int:
        """Lightweight 0–100 scorer used at ingestion time.

        The full ICPSignalScorer needs an async DB lookup of the user's ICP
        criteria, which is too slow to do inline.  This inline version uses
        signal-strength heuristics that match the client mockup's sort
        behaviour: long, recent, sender-targeted posts score higher.

        It's intentionally deterministic so two runs of the same lead give
        the same score (visible in the UI as a stable rank).
        """
        score = 50  # baseline

        # Engagement signals — bigger post body = stronger intent
        snippet = (lead.get("post_snippet") or "").strip()
        if len(snippet) > 200:
            score += 15
        elif len(snippet) > 80:
            score += 8

        # Social engagement metrics from CrustData
        likes = lead.get("likes") or 0
        comments = lead.get("comments_count") or 0
        if likes >= 50:
            score += 10
        elif likes >= 10:
            score += 5
        if comments >= 10:
            score += 8
        elif comments >= 3:
            score += 4

        # The agent already extracts a "best hook" only when the post strongly
        # ties to our buyer profile.  Treat its presence as a strong signal.
        if (lead.get("best_hook") or "").strip():
            score += 15

        # Email already verified = a higher-quality lead
        if (lead.get("email") or "").strip() and not lead.get("email_unverified"):
            score += 10

        # The agent only writes a message when it's reasonably confident
        if (lead.get("message") or "").strip():
            score += 10

        return max(0, min(100, score))

    @staticmethod
    def _inline_match_factors(lead: Dict[str, Any], watcher: Watcher) -> List[str]:
        """Reasons this signal scored where it did.  Stored on the row so the
        UI can show "why this is hot" without re-running the scorer.
        """
        factors: List[str] = []
        if (lead.get("post_snippet") or "").strip():
            factors.append("recent_post")
        if (lead.get("email") or "").strip() and not lead.get("email_unverified"):
            factors.append("verified_email")
        if (lead.get("best_hook") or "").strip():
            factors.append("hook_extracted")
        if (lead.get("message") or "").strip():
            factors.append("outreach_drafted")

        # Surface keyword matches against the watcher's keyword list.
        keywords = (watcher.criteria or {}).get("keywords") or []
        snippet_lower = (lead.get("post_snippet") or "").lower()
        for kw in keywords[:5]:
            if kw and kw.lower() in snippet_lower:
                factors.append(f"kw:{kw}")
        return factors
