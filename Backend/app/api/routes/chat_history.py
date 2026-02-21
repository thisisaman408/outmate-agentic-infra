from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.deps import get_db
from app.services.chat_history_service import ChatHistoryService

router = APIRouter(prefix="/api/chat/history", tags=["chat_history"])


class ChatHistoryPayload(BaseModel):
    user_id: str = Field(..., description="User identifier storing chat history")
    session_id: str = Field(..., description="Unique chat session identifier")
    data: Dict[str, Any] = Field(..., description="Full chat session payload")


@router.post("")
async def save_history(payload: ChatHistoryPayload, db: Session = Depends(get_db)):
    try:
        service = ChatHistoryService(db)
        session = service.upsert_session(
            payload.user_id, payload.session_id, payload.data
        )
        return {"success": True, "session": session.to_dict()}
    except ValueError as value_error:
        raise HTTPException(status_code=400, detail=str(value_error))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to persist chat: {exc}")


@router.get("")
async def list_history(user_id: str = Query(..., description="User identifier"), db: Session = Depends(get_db)):
    service = ChatHistoryService(db)
    sessions = service.list_sessions(user_id)
    return {"success": True, "sessions": sessions}
