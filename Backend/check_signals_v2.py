import os
import json
from dotenv import load_dotenv
from app.db.session import SessionLocal
from sqlalchemy import text

load_dotenv()
db = SessionLocal()
try:
    # Check CachedQuery table
    res = db.execute(text("SELECT query_hash, results FROM cached_queries WHERE query_hash IN ('GLOBAL_SIGNALS_STORE', 'GLOBAL_SIGNAL_RESULTS_STORE')")).fetchall()
    print("Found in cached_queries:")
    for row in res:
        # Results is often stored as JSONB or JSON in Postgres
        data = row[1]
        print(f"Key: {row[0]}, Results Length: {len(json.dumps(data)) if data else 0}")
        if row[0] == 'GLOBAL_SIGNALS_STORE' and data:
            print("--- GLOBAL_SIGNALS_STORE CONTENT ---")
            print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
