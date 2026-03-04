"""
Simple script to test Redis and Postgres (Supabase) connections using project config.
Run: python scripts/test_connections.py
"""
import os
import sys
import json

from dotenv import load_dotenv
from pathlib import Path

# Load project .env
ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

# Ensure project root is on sys.path so imports succeed
# Add Backend directory to sys.path so `import app` resolves
sys.path.insert(0, str(ROOT / "Backend"))

# Import settings and DB/session
try:
    from app.core.config import settings
    from app.db.session import SessionLocal
except Exception as e:
    print("Failed to import project modules:", e)
    sys.exit(2)

results = {"redis": None, "supabase": None}

# Check Redis (sync)
try:
    import redis as sync_redis
    r = sync_redis.from_url(settings.REDIS_URL, socket_timeout=3)
    pong = r.ping()
    results["redis"] = {"ok": bool(pong)}
    print("Redis ping:", pong)
except Exception as e:
    results["redis"] = {"ok": False, "error": str(e)}
    print("Redis error:", e)

# Check Supabase/Postgres
try:
    from sqlalchemy import text
    db = SessionLocal()
    try:
        v = db.execute(text("SELECT 1"))
        _ = v.fetchone()
        results["supabase"] = {"ok": True}
        print("Supabase/Postgres query successful")
    finally:
        db.close()
except Exception as e:
    results["supabase"] = {"ok": False, "error": str(e)}
    print("Supabase error:", e)

print('\nSUMMARY:')
print(json.dumps(results, indent=2))

# exit non-zero if any check failed
if not (results["redis"]["ok"] and results["supabase"]["ok"]):
    sys.exit(1)

sys.exit(0)
