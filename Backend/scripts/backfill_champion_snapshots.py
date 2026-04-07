"""
back-fill: seed last_known_company / last_known_title for existing lead watchers.

For every lead-type watcher that has lead_company or lead_title stored but no
last_known_company snapshot yet, we copy the stored lead data into the snapshot
columns so the first poll has a baseline to diff against.

Run once after migration:
    cd Backend && python scripts/backfill_champion_snapshots.py

Optionally seed last_known_* from a fresh CrustData call for watchers that
have a linkedin_url (pass --live to enable — costs CrustData credits).
"""
import sys
import os
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# Ensure app package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
from app.db.models.watcher import Watcher


def backfill_from_stored(db) -> int:
    """Copy lead_company / lead_title → last_known_* for watchers missing a snapshot."""
    watchers = (
        db.query(Watcher)
        .filter(
            Watcher.type == "lead",
            Watcher.last_known_company == None,  # noqa: E711
        )
        .all()
    )
    logger.info(f"Found {len(watchers)} lead watchers without a company snapshot")

    updated = 0
    for w in watchers:
        if w.lead_company or w.lead_title:
            w.last_known_company = w.lead_company
            w.last_known_title = w.lead_title
            updated += 1

    db.commit()
    logger.info(f"Seeded {updated} watcher snapshots from stored lead data")
    return updated


def backfill_from_crustdata(db) -> int:
    """
    For watchers with a linkedin_url, fetch fresh company/title from CrustData
    and overwrite last_known_* with live data (costs credits).
    """
    import httpx
    from app.core.config import settings

    ENRICH_URL = "https://api.crustdata.com/screener/person/enrich"
    headers = {
        "Authorization": f"Token {settings.CRUSTDATA_API_KEY}",
        "Accept": "application/json",
    }

    watchers = (
        db.query(Watcher)
        .filter(
            Watcher.type == "lead",
            Watcher.linkedin_url.isnot(None),
        )
        .all()
    )
    logger.info(f"Found {len(watchers)} lead watchers with a LinkedIn URL — enriching live")

    updated = 0
    for w in watchers:
        try:
            resp = httpx.get(
                ENRICH_URL,
                params={
                    "linkedin_profile_url": w.linkedin_url,
                    "fields": "name,title,current_employers",
                    "enrich_realtime": "false",
                },
                headers=headers,
                timeout=15,
            )
            if resp.status_code == 429:
                logger.warning("CrustData 429 — stopping live backfill to avoid ban")
                break
            if resp.status_code != 200:
                logger.warning(f"Watcher {w.id}: CrustData HTTP {resp.status_code}, skipping")
                continue

            data = resp.json()
            profile = data[0] if isinstance(data, list) and data else (data if isinstance(data, dict) else {})
            employers = profile.get("current_employers") or []
            fresh_company = employers[0].get("employer_name", "") if employers else ""
            fresh_title = profile.get("title") or ""

            if fresh_company or fresh_title:
                w.last_known_company = fresh_company or w.lead_company
                w.last_known_title = fresh_title or w.lead_title
                updated += 1
                logger.info(f"Watcher {w.id} ({w.lead_name}): '{fresh_company}' / '{fresh_title}'")

        except Exception as exc:
            logger.error(f"Watcher {w.id}: error — {exc}")
            continue

    db.commit()
    logger.info(f"Live-enriched {updated} watcher snapshots from CrustData")
    return updated


def main():
    parser = argparse.ArgumentParser(description="Backfill champion job-change snapshots")
    parser.add_argument(
        "--live",
        action="store_true",
        help="Also call CrustData for watchers with a linkedin_url (costs credits)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        backfill_from_stored(db)
        if args.live:
            backfill_from_crustdata(db)
    finally:
        db.close()

    logger.info("Done.")


if __name__ == "__main__":
    main()
