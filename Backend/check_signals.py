import os
import json
from dotenv import load_dotenv
from app.db.session import SessionLocal
from sqlalchemy import text

load_dotenv()
db = SessionLocal()
try:
    # List all tables to be sure
    tables = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).fetchall()
    print(f"Tables: {[t[0] for t in tables]}")

    # Inspect site_configs columns specifically
    columns = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'site_configs'")).fetchall()
    print(f"site_configs columns: {[c[0] for c in columns]}")

    # Try to find where 'GLOBAL_SIGNALS_STORE' might be
    res = db.execute(text("SELECT * FROM site_configs")).fetchall()
    for row in res:
        # Just print the keys we found
        row_dict = dict(zip(result.keys(), row)) if 'result' in locals() else {}
        # Search for the string in any column
        for col_val in row:
            if isinstance(col_val, str) and 'GLOBAL_SIGNALS_STORE' in col_val:
                print(f"Found GLOBAL_SIGNALS_STORE in a row!")
    
    # If site_configs doesn't have it, maybe it's a different table or logic
    # Let's check if there's a 'signals' table
    if 'signals' in [t[0] for t in tables]:
        sig_count = db.execute(text("SELECT count(*) FROM signals")).scalar()
        print(f"Signals table count: {sig_count}")
        if sig_count > 0:
            sig_data = db.execute(text("SELECT * FROM signals LIMIT 1")).fetchone()
            print(f"Signal sample: {sig_data}")

        data = json.loads(res[0])
        print(json.dumps(data, indent=2))
    else:
        print("[]")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
