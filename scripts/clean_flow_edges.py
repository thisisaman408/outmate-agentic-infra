"""One-shot cleanup: strip malformed edge handles from every flow in the DB.

Langflow's frontend calls JSON.parse() on each edge's sourceHandle and
targetHandle when loading a flow. If a handle is a plain string like "tool"
or "tools" (not JSON), the parse throws and the canvas can't render.

Earlier "Connect as tool" actions wrote such bad handles. This script removes
those edges in-place from every flow.

Usage:
    cd /Users/thisisaman408/Downloads/outmate-agentic
    uv run python scripts/clean_flow_edges.py
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

CANDIDATE_DB_PATHS = [
    "src/backend/base/outmate/outmate.db",
    "src/backend/outmate/outmate.db",
    "src/backend/base/outmate/langflow.db",
    os.path.expanduser("~/.outmate/outmate.db"),
]


def is_valid_handle(h):
    """Return True if `h` is null/empty/non-string OR a JSON-parseable string."""
    if h is None or h == "":
        return True
    if not isinstance(h, str):
        return True
    s = h.strip()
    if not (s.startswith("{") or s.startswith("[")):
        return False
    try:
        json.loads(s)
        return True
    except Exception:
        return False


def clean_flow_data(data):
    """Returns (cleaned_data_or_None, num_removed).

    None if nothing changed; new dict + count if edges were removed.
    """
    if not isinstance(data, dict):
        return None, 0
    edges = data.get("edges")
    if not isinstance(edges, list):
        return None, 0
    safe = [
        e
        for e in edges
        if isinstance(e, dict)
        and is_valid_handle(e.get("sourceHandle"))
        and is_valid_handle(e.get("targetHandle"))
    ]
    if len(safe) == len(edges):
        return None, 0
    new_data = dict(data)
    new_data["edges"] = safe
    return new_data, len(edges) - len(safe)


def main():
    db_path = None
    for p in CANDIDATE_DB_PATHS:
        if Path(p).is_file():
            db_path = p
            break
    if db_path is None:
        print("No outmate.db found in any expected location:")
        for p in CANDIDATE_DB_PATHS:
            print(f"  - {p}")
        raise SystemExit(1)

    print(f"Using DB: {db_path}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id, name, data FROM flow")
    rows = cur.fetchall()
    print(f"Found {len(rows)} flow(s) to inspect")

    total_removed = 0
    flows_updated = 0
    for fid, name, raw in rows:
        if raw is None:
            continue
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            print(f"  SKIP {fid} ({name}): data is not parseable JSON")
            continue
        cleaned, removed = clean_flow_data(data)
        if cleaned is None:
            continue
        cur.execute(
            "UPDATE flow SET data = ? WHERE id = ?",
            (json.dumps(cleaned), fid),
        )
        flows_updated += 1
        total_removed += removed
        print(f"  CLEANED {fid} ({name}): removed {removed} bad edge(s)")

    if flows_updated == 0:
        print("No bad edges found. DB is already clean.")
    else:
        conn.commit()
        print(f"\nUpdated {flows_updated} flow(s), removed {total_removed} edge(s) total.")
    conn.close()


if __name__ == "__main__":
    main()
