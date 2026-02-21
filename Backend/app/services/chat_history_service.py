from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.db.models.chat_session import NLPChatSession


class ChatHistoryService:
    def __init__(self, db: Session):
        self.db = db

    def list_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        if not user_id:
            return []
        rows = (
            self.db.query(NLPChatSession)
            .filter(NLPChatSession.user_id == user_id)
            .order_by(NLPChatSession.updated_at.desc())
            .all()
        )
        return [row.to_dict() for row in rows]

    def upsert_session(self, user_id: str, session_id: str, payload: Dict[str, Any]) -> NLPChatSession:
        if not user_id or not session_id:
            raise ValueError("user_id and session_id are required")

        existing = (
            self.db.query(NLPChatSession)
            .filter(
                NLPChatSession.user_id == user_id,
                NLPChatSession.session_id == session_id,
            )
            .one_or_none()
        )

        if existing is None:
            record = NLPChatSession(
                user_id=user_id,
                session_id=session_id,
                title=payload.get("title"),
                intent=payload.get("intent"),
                query=payload.get("query"),
                data=payload,
            )
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
            return record

        existing.title = payload.get("title") or existing.title
        existing.intent = payload.get("intent") or existing.intent
        existing.query = payload.get("query") or existing.query
        existing.data = payload
        self.db.commit()
        self.db.refresh(existing)
        return existing
