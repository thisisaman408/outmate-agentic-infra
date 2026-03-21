import os
import json
import logging
from typing import Dict, Any, List, Optional, Set, AsyncGenerator
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
    Injects feature registry for valid link generation and validates output links.
    """

    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.knowledge = KnowledgeService(db)
        self.mock = os.getenv("MOCK_LLM", "false").lower() == "true"
        self._feature_registry_text, self._valid_routes = self._load_feature_registry()

    def _load_feature_registry(self) -> tuple[str, Set[str]]:
        """Load feature registry as formatted string for prompt injection + set of valid routes."""
        registry_path = os.path.join(
            os.path.dirname(__file__), '..', '..', '..', '..', 'feature-registry.json'
        )
        try:
            with open(registry_path, 'r') as f:
                data = json.load(f)
            lines = []
            routes = set()
            for feat in data["features"]:
                lines.append(f"- {feat['name']} ({feat['id']}): {feat['description']} → {feat['route']}")
                routes.add(feat["route"])
            return "\n".join(lines), routes
        except Exception as e:
            logger.warning(f"Could not load feature registry: {e}")
            return "", {"/dashboard"}

    def _build_user_prompt(self, question: str, route: Optional[str], context_text: str) -> str:
        """Build the full user prompt with question, route, feature registry, and RAG context."""
        prompt = f"USER QUESTION: {question}\n\n"
        if route:
            prompt += f"CURRENT ROUTE: {route}\n\n"
        prompt += f"AVAILABLE FEATURES (use ONLY these routes for links):\n{self._feature_registry_text}\n\n"
        prompt += f"DOCUMENTATION SNIPPETS:\n{context_text}"
        return prompt

    def _validate_links(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Drop any related_links whose URL doesn't match a known route in the feature registry."""
        raw_links = result.get("related_links", [])
        validated_links = []
        for link in raw_links:
            url = link.get("url", "")
            if url in self._valid_routes:
                validated_links.append(link)
            else:
                logger.debug(f"Dropped invalid link: {link}")

        # If all links were invalid but LLM tried to provide some, add a safe fallback
        if not validated_links and raw_links:
            validated_links = [{"label": "Go to Dashboard", "url": "/dashboard"}]

        result["related_links"] = validated_links
        return result

    async def ask(self, question: str, route: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieves relevant documentation and calls the LLM for a grounded answer.
        """
        if self.mock:
            return {
                "answer": f"Mock response: You are currently on {route or 'the platform'}. How can I help you with Outmate?",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["general"]
            }

        # 1. Retrieve relevant documentation snippets (Hybrid) — increased from 4 to 6
        context_snippets = self.knowledge.retrieve_relevant_context(question, limit=6)
        context_text = "\n\n".join(context_snippets) if context_snippets else "No specific documentation found."

        # 2. Build the user prompt with feature registry injected
        user_prompt = self._build_user_prompt(question, route, context_text)

        # 3. Call the LLM
        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=PRODUCT_ASSISTANT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1000,
            )
            # 4. Validate links before returning
            return self._validate_links(result)
        except Exception as e:
            logger.error(f"Product Assistant error: {e}")
            return {
                "answer": "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later.",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["error"]
            }

    async def stream_ask(self, question: str, route: Optional[str] = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Retrieves context and streams the grounded answer as SSE chunks.
        Validates links in the final 'done' result.
        """
        if self.mock:
            yield {"type": "token", "content": "Mock streaming: "}
            yield {"type": "token", "content": f"You are on {route or 'the platform'}."}
            yield {"type": "done", "result": {
                "answer": f"Mock streaming: You are on {route or 'the platform'}.",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["mock"]
            }}
            return

        # 1. Retrieve relevant documentation snippets (Hybrid) — increased from 4 to 6
        context_snippets = self.knowledge.retrieve_relevant_context(question, limit=6)
        context_text = "\n\n".join(context_snippets) if context_snippets else "No specific documentation found."

        # 2. Build the user prompt with feature registry injected
        user_prompt = self._build_user_prompt(question, route, context_text)

        # 3. Call OpenRouter with structured streaming
        try:
            async for chunk in self.openrouter.chat_completion_structured_stream(
                system_prompt=PRODUCT_ASSISTANT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1000,
            ):
                # Validate links in the final done chunk
                if chunk.get("type") == "done" and "result" in chunk:
                    chunk["result"] = self._validate_links(chunk["result"])
                yield chunk
        except Exception as e:
            logger.error(f"Product Assistant streaming error: {e}")
            yield {"type": "token", "content": "I'm sorry, I encountered an error while streaming the response."}
            yield {"type": "done", "result": {
                "answer": "Error occurred.",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["error"]
            }}
