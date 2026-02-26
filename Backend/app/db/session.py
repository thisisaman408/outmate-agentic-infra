from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import DATABASE_URL

# Use NullPool to avoid connection pooling issues with remote databases.
# Each request gets a fresh connection that is closed when done.
# This prevents pool_pre_ping from hanging when the DB is unreachable.
engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    connect_args={
        "sslmode": "require",
        "connect_timeout": 3,
        "options": "-c statement_timeout=5000"
    }
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
