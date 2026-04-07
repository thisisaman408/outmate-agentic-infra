import os
import json
import logging
import uuid
from typing import Dict, Any, List, Optional, Set, AsyncGenerator
from sqlalchemy.orm import Session
from app.services.openrouter_service import OpenRouterService
from app.services.copilot.knowledge_service import KnowledgeService
from app.services.copilot.prompts import PRODUCT_ASSISTANT_SYSTEM_PROMPT
from app.schemas.copilot import ProductAssistantResponse

logger = logging.getLogger(__name__)

# ── Intent detection prompt ───────────────────────────────────

_INTENT_PROMPT = """You are a sales-assistant intent classifier.
Given a user message, decide if it is asking to run a multi-step sales workflow
for a specific named person or company (e.g. "prepare for my call with John at Acme",
"research Jane Smith", "draft an email to the CEO of TechCorp", "run full prep for Acme").

Return ONLY valid JSON (no markdown):
{
  "is_orchestration": true|false,
  "prospect_name": "first last or empty string",
  "company": "company name or empty string",
  "task": "one-sentence description of the desired workflow"
}

If is_orchestration is false, set prospect_name, company, task to "".
"""


class ProductAssistantService:
    """
    Service for the Global Product Chatbot.
    Uses RAG (Retrieval-Augmented Generation) to answer product-related questions.
    Injects feature registry for valid link generation and validates output links.

    When a message is an orchestration request (e.g. "prepare for my call with John"),
    yields an extra 'orchestrate_intent' SSE event before the normal chat answer so
    the frontend can render an inline OrchestrateCard.
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

        if not validated_links and raw_links:
            validated_links = [{"label": "Go to Dashboard", "url": "/dashboard"}]

        result["related_links"] = validated_links
        return result

    # ── Orchestration intent detection ────────────────────────

    async def _detect_orchestrate_intent(self, question: str) -> Dict[str, Any]:
        """
        Fast check: is this message asking to run a workflow for a named person/company?
        Returns {is_orchestration, prospect_name, company, task}.
        """
        # Quick keyword pre-filter to skip the LLM call for obvious non-orchestration messages
        orch_keywords = [
            "prepare", "prep for", "prep me", "research", "meeting brief",
            "draft email", "write email", "cold email", "outreach",
            "full prep", "run prep", "call with", "meeting with",
        ]
        lower = question.lower()
        has_keyword = any(kw in lower for kw in orch_keywords)
        # Also need to mention a name or company (heuristic: contains a capital word that's not a sentence start)
        words = question.split()
        has_proper_noun = any(
            w[0].isupper() and i > 0
            for i, w in enumerate(words)
            if w and w[0].isalpha()
        )

        if not (has_keyword and has_proper_noun):
            return {"is_orchestration": False, "prospect_name": "", "company": "", "task": ""}

        if self.mock:
            return {
                "is_orchestration": True,
                "prospect_name": "John Smith",
                "company": "Acme Corp",
                "task": "Prepare for call with John Smith at Acme Corp",
            }

        try:
            raw = await self.openrouter.chat_completion_text(
                system_prompt=_INTENT_PROMPT,
                user_prompt=question,
                max_tokens=150,
                temperature=0.0,
            )
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            return json.loads(raw)
        except Exception as exc:
            logger.debug("Intent detection failed (non-blocking): %s", exc)
            return {"is_orchestration": False, "prospect_name": "", "company": "", "task": ""}

    async def _resolve_prospect(
        self, user_id: str, prospect_name: str, company: str
    ) -> Dict[str, Any]:
        """
        Try to find the prospect:
          1. DB ILIKE match on full_name (+ optional company join)
          2. CrustData search fallback
        Returns a dict with source, prospect_id, name, title, company (or empty on failure).
        """
        # ── DB search ─────────────────────────────────────────
        try:
            from app.db.models.prospect import Prospect
            from app.db.models.company import Company

            uid = uuid.UUID(str(user_id))
            query = self.db.query(Prospect).filter(
                Prospect.user_id == uid,
                Prospect.full_name.ilike(f"%{prospect_name}%"),
            )
            if company:
                # Join Company and filter by name
                query = query.join(
                    Company, Prospect.company_id == Company.id, isouter=True
                ).filter(Company.name.ilike(f"%{company}%"))

            row = query.first()
            if row:
                comp_name = company
                if row.company_id:
                    comp = self.db.query(Company).filter(Company.id == row.company_id).first()
                    if comp:
                        comp_name = comp.name or company
                return {
                    "source": "db",
                    "prospect_id": str(row.id),
                    "prospect_name": row.full_name or prospect_name,
                    "prospect_title": row.job_title or "",
                    "prospect_company": comp_name,
                    "context_overrides": None,
                }
        except Exception as exc:
            logger.debug("DB prospect search failed: %s", exc)

        # ── CrustData fallback ────────────────────────────────
        try:
            from app.core.config import settings
            from app.services.crustdata.prospect_search_service import ProspectSearchService

            api_key = getattr(settings, "CRUSTDATA_API_KEY", "")
            if api_key and api_key not in ("", "placeholder_for_dev"):
                svc = ProspectSearchService(api_key)
                name_parts = prospect_name.strip().split()
                first = name_parts[0] if name_parts else prospect_name
                last = name_parts[-1] if len(name_parts) > 1 else ""
                result = await svc.search(
                    name=prospect_name,
                    company=company or None,
                    limit=1,
                )
                profiles = result.get("profiles") or result.get("people") or []
                if profiles:
                    p = profiles[0]
                    raw_id = (
                        p.get("person_id") or p.get("linkedin_profile_urn")
                        or p.get("id") or ""
                    )
                    employer = (p.get("current_employers") or [{}])[0] or {}
                    return {
                        "source": "crustdata",
                        "prospect_id": str(raw_id),
                        "prospect_name": p.get("name") or p.get("full_name") or prospect_name,
                        "prospect_title": p.get("job_title") or p.get("headline") or "",
                        "prospect_company": employer.get("name") or company or "",
                        "context_overrides": {
                            "prospect": {
                                "id": str(raw_id),
                                "name": p.get("name") or prospect_name,
                                "title": p.get("job_title") or "",
                                "company": employer.get("name") or company or "",
                                "email": p.get("email") or None,
                                "linkedin_url": p.get("flagship_profile_url") or p.get("linkedin_url") or None,
                            },
                            "company": {
                                "name": employer.get("name") or company or "",
                                "domain": employer.get("company_website_domain") or None,
                            },
                        },
                    }
        except Exception as exc:
            logger.debug("CrustData prospect search failed: %s", exc)

        # Not found anywhere
        return {
            "source": "not_found",
            "prospect_id": "",
            "prospect_name": prospect_name,
            "prospect_title": "",
            "prospect_company": company,
            "context_overrides": None,
        }

    # ── Main methods ──────────────────────────────────────────

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

        snippet_limit = 3 if len(question) < 30 else 6
        context_snippets = await self.knowledge.retrieve_relevant_context(question, limit=snippet_limit)
        context_text = "\n\n".join(context_snippets) if context_snippets else "No specific documentation found."
        user_prompt = self._build_user_prompt(question, route, context_text)

        try:
            result = await self.openrouter.chat_completion_structured(
                system_prompt=PRODUCT_ASSISTANT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1000,
            )
            return self._validate_links(result)
        except Exception as e:
            logger.error(f"Product Assistant error: {e}")
            return {
                "answer": "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later.",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["error"]
            }

    async def stream_ask(
        self,
        question: str,
        route: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Retrieves context and streams the grounded answer as SSE chunks.

        When the message is an orchestration request AND a user_id is provided,
        yields an extra 'orchestrate_intent' event before the normal answer so
        the frontend can render an inline OrchestrateCard.
        """
        if self.mock:
            yield {"type": "token", "content": "Mock streaming: "}
            yield {"type": "token", "content": f"You are on {route or 'the platform'}."}
            if user_id:
                yield {
                    "type": "orchestrate_intent",
                    "data": {
                        "source": "db",
                        "prospect_id": "mock-prospect-id",
                        "prospect_name": "John Smith",
                        "prospect_title": "VP Sales",
                        "prospect_company": "Acme Corp",
                        "task": "Prepare for call with John Smith at Acme Corp",
                        "estimated_credits": 6,
                        "context_overrides": None,
                    },
                }
            yield {"type": "done", "result": {
                "answer": f"Mock streaming: You are on {route or 'the platform'}.",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["mock"]
            }}
            return

        # ── Step 1: Check for orchestration intent ────────────
        intent = None
        if user_id:
            intent = await self._detect_orchestrate_intent(question)

        # ── Step 2: Resolve prospect if orchestration detected ─
        orchestrate_data = None
        if intent and intent.get("is_orchestration") and intent.get("prospect_name"):
            prospect = await self._resolve_prospect(
                user_id=user_id,
                prospect_name=intent["prospect_name"],
                company=intent.get("company", ""),
            )
            task = intent.get("task") or f"Prepare for my next interaction with {intent['prospect_name']}"
            orchestrate_data = {
                **prospect,
                "task": task,
                "estimated_credits": 6,  # Conservative default estimate
            }
            yield {"type": "orchestrate_intent", "data": orchestrate_data}

        # ── Step 3: Build chat answer (confirms what was found) ─
        snippet_limit = 3 if len(question) < 30 else 6
        context_snippets = await self.knowledge.retrieve_relevant_context(question, limit=snippet_limit)
        context_text = "\n\n".join(context_snippets) if context_snippets else "No specific documentation found."

        # Augment the question with orchestration context for a better answer
        augmented_question = question
        if orchestrate_data and orchestrate_data.get("source") != "not_found":
            augmented_question = (
                f"{question}\n\n"
                f"[Context: Found prospect {orchestrate_data['prospect_name']} "
                f"at {orchestrate_data['prospect_company']} in the database. "
                f"An orchestration card has been shown to the user.]"
            )
        elif orchestrate_data and orchestrate_data.get("source") == "not_found":
            augmented_question = (
                f"{question}\n\n"
                f"[Context: Could not find {orchestrate_data['prospect_name']} "
                f"at {orchestrate_data['prospect_company']} in the contacts database. "
                f"Tell the user you couldn't find this prospect and suggest they "
                f"check the Leads section or use the Orchestrate page directly.]"
            )

        user_prompt = self._build_user_prompt(augmented_question, route, context_text)

        try:
            async for chunk in self.openrouter.chat_completion_structured_stream(
                system_prompt=PRODUCT_ASSISTANT_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=1000,
            ):
                if chunk.get("type") == "done" and "result" in chunk:
                    chunk["result"] = self._validate_links(chunk["result"])
                    # Inject orchestrate link into related_links if found
                    if orchestrate_data and orchestrate_data.get("prospect_id") and orchestrate_data.get("source") != "not_found":
                        pid = orchestrate_data["prospect_id"]
                        task_enc = orchestrate_data.get("task", "")
                        orch_link = {
                            "label": f"Open Orchestrate for {orchestrate_data['prospect_name']}",
                            "url": f"/copilot/orchestrate",
                        }
                        links = chunk["result"].get("related_links", [])
                        if not any(l["url"] == "/copilot/orchestrate" for l in links):
                            chunk["result"]["related_links"] = [orch_link] + links
                yield chunk
        except Exception as e:
            logger.error(f"Product Assistant streaming error: {e}")
            yield {"type": "token", "content": "I'm sorry, I encountered an error while streaming the response."}
            yield {"type": "done", "result": {
                "answer": "Error occurred.",
                "related_links": [{"label": "Go to Dashboard", "url": "/dashboard"}],
                "feature_tags": ["error"]
            }}
