"""Re-dispatch every voice campaign stuck in status=queued.

Use when a worker crashed mid-task or the Celery queue was purged after
campaigns were created.  Walks the DB for `status='queued'` rows and
sends a fresh `run_voice_campaign` task for each.  Idempotent — the task
itself re-checks campaign status on entry and exits early if already
running or completed.

Usage:
  cd Backend && python -m scripts.reenqueue_pending_campaigns
  cd Backend && python -m scripts.reenqueue_pending_campaigns --user-id <uuid>
"""

from __future__ import annotations

import argparse
import logging
import sys

from dotenv import load_dotenv

load_dotenv()
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

import app.main  # noqa: F401 — booting this configures Celery broker + result backend
from app.core.celery_app import celery_app  # noqa: E402
from app.db.models.voice_campaign import VoiceCampaign  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--user-id", help="Only re-enqueue this user's campaigns")
    args = ap.parse_args()

    db = SessionLocal()
    try:
        q = db.query(VoiceCampaign).filter(VoiceCampaign.status == "queued")
        if args.user_id:
            q = q.filter(VoiceCampaign.user_id == args.user_id)
        pending = q.order_by(VoiceCampaign.created_at.desc()).all()

        if not pending:
            print("no queued campaigns.")
            return 0

        for c in pending:
            r = celery_app.send_task(
                "app.tasks.voice_campaign_tasks.run_voice_campaign",
                args=[str(c.id)],
            )
            print(f"re-enqueued {str(c.id)[:8]}  name={c.name!r}  task={r.id}")

        print(f"done. total: {len(pending)}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
