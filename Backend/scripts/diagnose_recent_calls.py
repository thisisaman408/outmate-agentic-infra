"""Print what Retell actually saw for the last N voice-agent calls.

Usage:
  cd Backend && python -m scripts.diagnose_recent_calls
  cd Backend && python -m scripts.diagnose_recent_calls --limit 5
  cd Backend && python -m scripts.diagnose_recent_calls --user-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

from app.core.config import settings  # noqa: E402
from app.db.models.agent_run import AgentRun  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402


async def run(user_id: str, limit: int) -> None:
    db = SessionLocal()
    try:
        runs = (
            db.query(AgentRun)
            .filter(AgentRun.user_id == user_id, AgentRun.agent_type == "voice-agent")
            .order_by(AgentRun.created_at.desc())
            .limit(limit)
            .all()
        )

        async with httpx.AsyncClient() as c:
            for r in runs:
                data = json.loads(r.output_text) if r.output_text else {}
                cid = data.get("call_id") or ((r.leads or [{}])[0].get("call_id") if r.leads else None)
                if not cid:
                    print(f"{str(r.id)[:8]} | no call_id | db_status={r.status}")
                    continue

                resp = await c.get(
                    f"https://api.retellai.com/v2/get-call/{cid}",
                    headers={"Authorization": f"Bearer {settings.RETELL_API_KEY}"},
                    timeout=10,
                )
                j = resp.json()
                start = j.get("start_timestamp", 0) or 0
                end = j.get("end_timestamp", 0) or 0
                dur = (end - start) // 1000 if (start and end) else 0
                print(
                    f"{str(r.id)[:8]} | "
                    f"call_status={j.get('call_status')!r} | "
                    f"disconnect={j.get('disconnection_reason')!r} | "
                    f"dur={dur}s | "
                    f"db_status={r.status} | "
                    f"created={r.created_at.isoformat() if r.created_at else '-'}"
                )
    finally:
        db.close()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--user-id", default="ae00ffd8-2ecf-4e0a-ab7d-1905b8f98b9e")
    ap.add_argument("--limit", type=int, default=3)
    args = ap.parse_args()
    asyncio.run(run(args.user_id, args.limit))
    return 0


if __name__ == "__main__":
    sys.exit(main())
