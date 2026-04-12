import uuid
from sqlalchemy import create_engine, text
from app.core.config import settings

def run_manual_migrations():
    print("Connecting to database...")
    engine = create_engine(settings.DATABASE_URL)
    
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS user_role VARCHAR(100);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_data JSONB DEFAULT '{}';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS icp_config JSONB DEFAULT '{}';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS integrations JSONB DEFAULT '{}';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_access_token TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS use_byok BOOLEAN DEFAULT FALSE;",
    ]

    # 1. Force terminate other connections (best effort)
    try:
        with engine.connect() as conn:
            print("FORCE TERMINATING other connections... (best effort)")
            # This kills all other sessions to this database
            conn.execute(text("""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = current_database() AND pid <> pg_backend_pid();
            """))
            conn.commit()
            print("✓ Other connections terminated.")
    except Exception as e:
        print(f"⚠ Could not terminate other connections: {e}")
        # Connection will auto-close here, ensuring next attempt is a clean transaction

    # 2. Run migrations
    print("\nStarting migrations...")
    with engine.connect() as conn:
        for ddl in migrations:
            col_name = ddl.split("ADD COLUMN IF NOT EXISTS ")[1].split(" ")[0]
            print(f"  Adding {col_name}...", end=" ", flush=True)
            try:
                # Use a fresh transaction for each column
                with conn.begin():
                    # Fail fast if we can't get a lock (5 seconds)
                    conn.execute(text("SET lock_timeout = 5000;"))
                    conn.execute(text("SET statement_timeout = 0;"))
                    conn.execute(text(ddl))
                print("✓")
            except Exception as e:
                if "lock_timeout" in str(e).lower():
                    print("✗ Timed out waiting for table lock. Someone else is still using this table.")
                else:
                    print(f"✗ Failed: {e}")

    print("\nMigrations complete.")

if __name__ == "__main__":
    run_manual_migrations()
