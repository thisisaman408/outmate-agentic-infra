"""
Chat Agent API Route - Conversational follow-up after search results + LLM query parsing.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

from app.services.chat_agent_service import ChatAgentService, ChatRequest, QueryParserService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


@router.post("")
async def chat(request: ChatRequest):
    """Handle a conversational follow-up message with full context."""
    try:
        service = ChatAgentService()
        response = await service.chat(request)
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat agent error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat agent failed: {str(e)}")


class ParseQueryRequest(BaseModel):
    query: str


@router.post("/parse-query")
async def parse_query(request: ParseQueryRequest):
    """Use LLM to extract intent and structured filters from a natural language query."""
    try:
        service = QueryParserService()
        result = await service.parse(request.query)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Query parse error: {e}")
        raise HTTPException(status_code=500, detail=f"Query parsing failed: {str(e)}")
