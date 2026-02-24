"""
PGVector database setup for vector similarity search
"""

import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

async def setup_vector_database():
    """Setup PGVector extension and create necessary tables"""
    
    db_url = os.getenv("DATABASE_URL")
    # Add connect_args with a timeout to prevent indefinite hanging
    engine = create_engine(
        db_url, 
        connect_args={"connect_timeout": 10} if "postgresql" in (db_url or "") else {}
    )
    
    try:
        # Enable pgvector extension
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print(">>> [Vector DB] Enabled pgvector extension", flush=True)
        
        # Create vector stores table
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS search_queries (
                    id SERIAL PRIMARY KEY,
                    content TEXT,
                    embedding vector(384),
                    metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()
            print(">>> [Vector DB] Created search_queries table", flush=True)
        
        # Backfill missing columns when table pre-exists with older schema
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS embedding vector(384);"))
            conn.execute(text("ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS content TEXT;"))
            conn.execute(text("ALTER TABLE search_queries ADD COLUMN IF NOT EXISTS metadata JSONB;"))
            conn.commit()
            print(">>> [Vector DB] Ensured search_queries columns", flush=True)
            
        # Create vector stores table for companies
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS company_vectors (
                    id SERIAL PRIMARY KEY,
                    company_id TEXT,
                    embedding vector(384),
                    company_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()
            print(">>> [Vector DB] Created company_vectors table", flush=True)
        
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE company_vectors ADD COLUMN IF NOT EXISTS embedding vector(384);"))
            conn.execute(text("ALTER TABLE company_vectors ADD COLUMN IF NOT EXISTS company_id TEXT;"))
            conn.execute(text("ALTER TABLE company_vectors ADD COLUMN IF NOT EXISTS company_data JSONB;"))
            conn.commit()
            print(">>> [Vector DB] Ensured company_vectors columns", flush=True)
            
        # Create indexes for performance
        with engine.connect() as conn:
            has_search_embedding = conn.execute(text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='search_queries' AND column_name='embedding'
                LIMIT 1
            """)).first()
            has_company_embedding = conn.execute(text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='company_vectors' AND column_name='embedding'
                LIMIT 1
            """)).first()

            if has_search_embedding:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_search_queries_embedding ON search_queries USING ivfflat (embedding vector_cosine_ops);"))
            if has_company_embedding:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_company_vectors_embedding ON company_vectors USING ivfflat (embedding vector_cosine_ops);"))
            conn.commit()
            print(">>> [Vector DB] Created vector indexes", flush=True)
            
        print(">>> [Vector DB] Setup complete", flush=True)
        
    except Exception as e:
        error_msg = str(e)
        if "timeout expired" in error_msg:
            print(f">>> [Vector DB] Connection TIMEOUT to database. Please check your internet connection or if Supabase is reachable.", flush=True)
            print(f">>> [Vector DB] URL used (obfuscated): {db_url.split('@')[1] if '@' in db_url else db_url}", flush=True)
        else:
            print(f">>> [Vector DB] Setup failed with error: {e}", flush=True)
        # We don't raise e here to avoid crashing the background task entirely if it's just a setup step
        # though it's already caught in main.py

if __name__ == "__main__":
    asyncio.run(setup_vector_database())
