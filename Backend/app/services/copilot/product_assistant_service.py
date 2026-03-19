import os
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
from sqlalchemy.orm import Session
from app.services.openrouter_service import OpenRouterService
from app.services.copilot.knowledge_service import KnowledgeService
from app.services.copilot.prompts import PRODUCT_ASSISTANT_SYSTEM_PROMPT
from app.schemas.copilot import ProductAssistantResponse

logger = logging.getLogger(__name__)

class ProductAssistantService:
    """
    Service for the Global Product Chatbot.
    Uses RAG (Retrieval-Augmented Generation) to answer product-related questions.
    """

    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.knowledge = KnowledgeService(db)
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"

    async def ask(self, question: str, route: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves relevant documentation and calls the LLM for a grounded answer.
        """
        if self.mock:
            return {
                "answer": f"Mock response: You are currently on {route or 'the platform'}. How can I help you with Outmate?",
                "related_links": [{"label": "Go to Campaigns", "url": "/campaigns"}],
                "feature_tags": ["general"]
            }

        # 1. Retrieve relevant documentation snippets (Hybrid)
        context_snippets = self.knowledge.retrieve_relevant_context(question, limit=4)
        context_text = "\n\n".join(context_snippets) if context_snippets else "No specific documentation found."

        # 2. Build the user prompt
        user_prompt = f"USER QUESTION: {question}\n\n"
        if route:
            user_prompt += f"CURRENT ROUTE: {route}\n\n"
        
        user_prompt += "DOCUMENTATION SNIPPETS:\n"
        user_prompt += context_text

        # 3. Call the LLM
        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=PRODUCT_ASSISTANT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1000,
            )
            return result
        except Exception as e:
            logger.error(f"Product Assistant error: {e}")
            return {
                "answer": "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later.",
                "related_links": [],
                "feature_tags": ["error"]
            }

    async def stream_ask(self, question: str, route: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Retrieves context and streams the grounded answer as SSE chunks.
        """
        if self.mock:
            yield {"type": "token", "content": "Mock streaming: "}
            yield {"type": "token", "content": f"You are on {route or 'the platform'}."}
            yield {"type": "done", "result": {
                "answer": f"Mock streaming: You are on {route or 'the platform'}.",
                "related_links": [{"label": "Go to Campaigns", "url": "/campaigns"}],
                "feature_tags": ["mock"]
            }}
            return

        # 1. Retrieve relevant documentation snippets (Hybrid)
        context_snippets = self.knowledge.retrieve_relevant_context(question, limit=4)
        context_text = "\n\n".join(context_snippets) if context_snippets else "No specific documentation found."

        # 2. Build the user prompt
        user_prompt = f"USER QUESTION: {question}\n\n"
        if route:
            user_prompt += f"CURRENT ROUTE: {route}\n\n"
        user_prompt += "DOCUMENTATION SNIPPETS:\n" + context_text

        # 3. Call OpenRouter with structured streaming
        try:
            async for chunk in self.openrouter.chat_completion_structured_stream(
                system_prompt=PRODUCT_ASSISTANT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1000,
            ):
                yield chunk
        except Exception as e:
            logger.error(f"Product Assistant streaming error: {e}")
            yield {"type": "token", "content": "I'm sorry, I encountered an error while streaming the response."}
            yield {"type": "done", "result": {
                "answer": "Error occurred.",
                "related_links": [],
                "feature_tags": ["error"]
            }}
