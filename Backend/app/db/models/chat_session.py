import uuid
from typing import Any, Dict

from sqlalchemy import Column, String, DateTime, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.db.base import Base


class NLPChatSession(Base):
    __tablename__ = "nlp_chat_sessions"
    __table_args__ = (
        UniqueConstraint("user_id", "session_id", name="uq_nlp_chat_session_user_session"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False, index=True)
    session_id = Column(String(150), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    intent = Column(String(50), nullable=True)
    query = Column(String(1024), nullable=True)
    data = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.session_id,
            "user_id": self.user_id,
            "session_id": self.session_id,
            "title": self.title,
            "intent": self.intent,
            "query": self.query,
            "data": self.data or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
