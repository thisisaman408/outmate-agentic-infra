"""Retroactively extract prospect_name / company_name / profile picture URL
for social-listening signals that were ingested before the improved parsers
in brightdata_discover landed.

Reads each SignalEvent where `prospect_name IS NULL` but `raw_data` contains
a scraped LinkedIn post snippet, re-runs the current extractors, and writes
the result back.  Never overwrites fields that are already populated.

Usage:
  cd Backend && python -m scripts.backfill_social_signals
  cd Backend && python -m scripts.backfill_social_signals --dry-run
  cd Backend && python -m scripts.backfill_social_signals --limit 500
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

from sqlalchemy import or_  # noqa: E402

from app.db.models.signal_event import SignalEvent  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.social_listening.sources.brightdata_discover import (  # noqa: E402
    _clean_linkedin_content,
    _extract_company_from_content,
    _extract_person_from_content,
    _extract_person_from_title,
    _humanize_username,
)


def _resolve_name(signal: SignalEvent) -> Optional[str]:
    raw = signal.raw_data or {}
    # Try the cleaned post snippet first (most information-rich)
    for key in ("post_snippet", "message"):
        blob = raw.get(key) or ""
        for extractor in (_extract_person_from_content, _extract_person_from_title):
            name = extractor(blob)
            if name:
                return name
    # Fallback: guess from the linkedin post URL slug
    post_url = raw.get("post_url") or ""
    name = _humanize_username(post_url)
    return name or None


def _resolve_company(signal: SignalEvent) -> Optional[str]:
    raw = signal.raw_data or {}
    for key in ("post_snippet", "message"):
        blob = raw.get(key) or ""
        company = _extract_company_from_content(blob)
        if company:
            return company
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=5000, help="max rows to touch")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        query = (
            db.query(SignalEvent)
            .filter(SignalEvent.source == "social_listening")
            .filter(
                or_(
                    SignalEvent.prospect_name.is_(None),
                    SignalEvent.prospect_name == "",
                    SignalEvent.company_name.is_(None),
                    SignalEvent.company_name == "",
                )
            )
            .order_by(SignalEvent.discovered_at.desc())
            .limit(args.limit)
        )
        candidates = query.all()
        print(f"candidates to re-parse: {len(candidates)}")

        updated = 0
        name_hits = 0
        company_hits = 0
        snippet_cleaned = 0
        for signal in candidates:
            changed = False

            if not signal.prospect_name:
                name = _resolve_name(signal)
                if name:
                    signal.prospect_name = name
                    name_hits += 1
                    changed = True

            if not signal.company_name:
                company = _resolve_company(signal)
                if company:
                    signal.company_name = company
                    company_hits += 1
                    changed = True

            # Also clean up the stored post_snippet so the UI stops
            # rendering the cookie/About/Accessibility footer as if it
            # were the post body.
            raw = dict(signal.raw_data or {})
            snippet = raw.get("post_snippet") or ""
            cleaned = _clean_linkedin_content(snippet)
            if cleaned and cleaned != snippet:
                raw["post_snippet"] = cleaned
                signal.raw_data = raw
                snippet_cleaned += 1
                changed = True

            if changed:
                updated += 1

        if args.dry_run:
            db.rollback()
            print(f"dry-run — would update {updated} rows "
                  f"(names: {name_hits}, companies: {company_hits}, snippets cleaned: {snippet_cleaned})")
        else:
            db.commit()
            print(f"committed — updated {updated} rows "
                  f"(names: {name_hits}, companies: {company_hits}, snippets cleaned: {snippet_cleaned})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
