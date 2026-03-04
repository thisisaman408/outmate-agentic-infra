from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings

# Production-grade connection pool for Supabase Session Pooler
# QueuePool: appropriate for remote managed databases with timeouts/recycling
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,              # number of connections to keep in pool
    max_overflow=10,          # max additional connections beyond pool_size
    pool_timeout=30,          # timeout when all connections are checked out
    pool_recycle=1800,        # recycle connections after 30 minutes (Supabase limit)
    pool_pre_ping=True,       # verify connection before use
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000"
    }
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=True
)
