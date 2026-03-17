from typing import Generator
from app.db.session import SessionLocal
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a SQLAlchemy session
    and ensures it is closed after the request.
    Swallows OperationalError on close/rollback so a dead Supabase
    connection doesn't crash the entire ASGI process.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            db.close()
        except Exception:
            pass

