"""
Advanced NLP Service using LangGraph, LangChain, and PGVector
Implements intelligent query categorization with vector similarity search
"""

import os
import json
import asyncio
import re
from typing import Dict, Any, List, Optional
from fastapi import HTTPException
import httpx

# LangChain imports
# LangChain Community imports
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import PGVector
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

# LangGraph imports
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

# PostgreSQL connection
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

class AdvancedNLPService:
    _shared_embeddings = None
    _ALLOWED_FILTER_KEYS = {"industry", "location", "company_size", "current_title", "keywords"}

    def __init__(self):
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        self.db_url = os.getenv("DATABASE_URL")
        if AdvancedNLPService._shared_embeddings is None:
            AdvancedNLPService._shared_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.embeddings = AdvancedNLPService._shared_embeddings
        
        # Initialize LangGraph workflow
        self.workflow = self._create_nlp_workflow()
        
    def _create_nlp_workflow(self):
        """Create LangGraph workflow for NLP processing"""
        
        # Define the state
        class NLPState:
            query: str
            intent: Optional[str]
            filters: Dict[str, Any]
            confidence: float
            similar_queries: List[str]
            
        # Define nodes
        async def categorize_query(state: NLPState):
            """Categorize query using OpenRouter"""
            return await self._categorize_with_openrouter(state["query"])
            
        async def extract_filters(state: NLPState):
            """Extract filters using LangChain"""
            return await self._extract_filters_with_langchain(state["query"])
            
        async def find_similar_queries(state: NLPState):
            """Find similar queries using vector search"""
            return await self._find_similar_queries_vector(state["query"])
            
        async def synthesize_results(state: NLPState):
            """Synthesize all results into final response"""
            return self._synthesize_final_response(state)
            
        # Build the graph
        workflow = StateGraph(NLPState)
        workflow.add_node("categorize", categorize_query)
        workflow.add_node("extract_filters", extract_filters)
        workflow.add_node("find_similar", find_similar_queries)
        workflow.add_node("synthesize", synthesize_results)
        
        # Define edges
        workflow.set_entry_point("categorize")
        workflow.add_edge("categorize", "extract_filters")
        workflow.add_edge("extract_filters", "find_similar")
        workflow.add_edge("find_similar", "synthesize")
        workflow.add_edge("synthesize", END)
        
        return workflow.compile(checkpointer=MemorySaver())

    def _infer_intent_from_query(self, query: str) -> str:
        """Heuristic fallback for intent when model output is weak/ambiguous."""
        q = (query or "").lower()
        prospect_markers = [
            "manager", "managers", "director", "directors", "vp", "head of",
            "chief", "cmo", "cto", "ceo", "founder", "recruiter", "marketer",
            "engineer", "sales rep", "prospect", "people", "person", "contacts",
            "titles", "job title"
        ]
        company_markers = [
            "companies", "company", "businesses", "firms", "startups", "accounts"
        ]
        if any(m in q for m in prospect_markers):
            return "prospect"
        if any(m in q for m in company_markers):
            return "company"
        return "company"

    @staticmethod
    def _unique_preserve(values: List[str]) -> List[str]:
        seen = set()
        out: List[str] = []
        for v in values:
            if not isinstance(v, str):
                continue
            cleaned = v.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(cleaned)
        return out

    @staticmethod
    def _normalize_industry_term(value: str) -> str:
        aliases = {
            # B2B SaaS specific mappings
            "b2b": "Technology",
            "b2b saas": "Software Development", 
            "b2b software": "Software Development",
            "business software": "Software Development",
            "saas": "Software Development",
            "software": "Software Development",
            "software development": "Software Development",
            "software as a service": "Software Development",
            "cloud software": "Software Development",
            "enterprise software": "Software Development",
            "tech": "Technology",
            "technology": "Technology",
            "fintech": "Financial Services",
            "financial services": "Financial Services",
            "healthtech": "Healthcare",
            "healthcare": "Healthcare",
            "edtech": "Education",
            "education": "Education",
            "martech": "Marketing and Advertising",
            "marketing": "Marketing and Advertising",
            "advertising": "Marketing and Advertising",
            "ecommerce": "E-Commerce",
            "e-commerce": "E-Commerce",
            "retail tech": "Retail",
            "retail technology": "Retail",
            "insurtech": "Insurance",
            "insurance technology": "Insurance",
            "realestate tech": "Real Estate",
            "real estate technology": "Real Estate",
        }
        v = (value or "").strip().lower()
        if not v:
            return ""
        return aliases.get(v, value.strip().title())

    @staticmethod
    def _normalize_location_term(value: str) -> str:
        aliases = {
            "usa": "United States",
            "us": "United States",
            "u.s.": "United States",
            "united states": "United States",
            "united states of america": "United States",
            "america": "United States",
            "north america": "United States",
            "canada": "Canada",
            "mexico": "Mexico",
            "uk": "United Kingdom",
            "u.k.": "United Kingdom",
            "england": "United Kingdom",
            "britain": "United Kingdom",
        }
        v = (value or "").strip().lower()
        if not v:
            return ""
        return aliases.get(v, value.strip().title())

    def _extract_title_terms(self, query: str) -> List[str]:
        q = (query or "").strip()
        if not q:
            return []

        role_markers = [
            "manager", "managers", "director", "directors", "engineer", "engineers",
            "recruiter", "recruiters", "marketer", "marketers", "sales rep", "sales reps",
            "vp", "head of", "chief", "founder"
        ]
        q_lower = q.lower()
        if not any(m in q_lower for m in role_markers):
            return []

        candidates: List[str] = []

        # Common pattern: "<title phrase> in <industry/location>"
        if " in " in q_lower:
            left = q[:q_lower.index(" in ")].strip(" ,.")
            if left:
                candidates.append(left)

        patterns = [
            r"\b(vp of [a-zA-Z\s&/-]+?)(?=\s+in\s+|$)",
            r"\b(head of [a-zA-Z\s&/-]+?)(?=\s+in\s+|$)",
            r"\b(chief [a-zA-Z\s&/-]+?)(?=\s+in\s+|$)",
            r"\b([a-zA-Z\s&/-]+ managers?)(?=\s+in\s+|$)",
            r"\b([a-zA-Z\s&/-]+ directors?)(?=\s+in\s+|$)",
            r"\b([a-zA-Z\s&/-]+ engineers?)(?=\s+in\s+|$)",
        ]
        for pattern in patterns:
            m = re.search(pattern, q, re.IGNORECASE)
            if not m:
                continue
            val = m.group(1).strip(" ,.")
            if val:
                candidates.append(val)

        normalized: List[str] = []
        for c in candidates:
            t = c.strip()
            # Strip common command prefixes from extracted titles.
            t = re.sub(r"^(find|show|get|give|list)\s+(me\s+)?", "", t, flags=re.IGNORECASE).strip()
            # Ensure trailing "in <...>" fragment is not part of title.
            t = re.sub(r"\s+in\s+.+$", "", t, flags=re.IGNORECASE).strip()
            lower = t.lower()
            if not t:
                continue
            # Singularize common plural role endings to improve exact matching.
            if lower.endswith(" managers"):
                t = t[:-1]
            elif lower.endswith(" directors"):
                t = t[:-1]
            elif lower.endswith(" engineers"):
                t = t[:-1]
            normalized.append(t.title())

        return self._unique_preserve(normalized)
    
    async def _categorize_with_openrouter(self, query: str) -> Dict[str, Any]:
        """Categorize query using OpenRouter API"""
        if not self.openrouter_api_key:
            raise HTTPException(status_code=500, detail="OpenRouter API key is required")
            
        prompt = f"""
        You are an intent router and filter mapper for B2B sales search.
        Analyze this query and return ONLY valid JSON.

        Query: "{query}"

        Return object with exact keys:
        {{
          "intent": "prospect" | "company",
          "is_relevant": boolean,
          "reason": string,
          "confidence": number 0-100,
          "filters": {{
            "industry": string[],
            "location": string[],
            "company_size": string[],
            "current_title": string[],
            "keywords": string[]
          }}
        }}

        Rules for Intent:
        - If the query mentions finding PEOPLE, ROLES, TITLES, PROFESSIONALS, or "DECISION MAKERS", use intent="prospect".
        - If the query focuses on finding COMPANIES, AGENCIES, FIRMS, or businesses, BUT NOT specific roles or people, use intent="company".
        - Example: "Find Marketing decision makers at digital agencies" MUST BE intent="prospect".
        - Example: "Find digital agencies in Texas" MUST BE intent="company".

        Rules for Filters:
        - Remove command phrases from titles (e.g., "find me", "show me", "get me").
        - For prospect searches, extract role titles into current_title (e.g., "Marketing Manager", "VP").
        - Map industry terms SPECIFICALLY:
          - "b2b saas" -> ["Software Development"]
          - "saas" -> ["Software Development"]
          - "digital agencies" -> ["Advertising Services", "Marketing Services"]
          - "agencies" -> ["Advertising Services", "Marketing Services"]
          - "tech" -> ["Software Development"]
          - "fintech" -> ["Financial Services"]
          - "software" -> ["Software Development"]
        - Map location terms:
          - "north america" -> ["United States", "Canada", "Mexico"]
          - "usa/us/u.s." -> ["United States"]
          - "america" -> ["United States"]
        - For B2B SaaS queries, add company_size filter: ["1-1000", "11-50", "51-200", "201-500"] to exclude mega-corporations
        - If "1 to 50 employees" is mentioned, use company_size: ["1-10", "11-50"].
        - Add keywords to be more specific: ["b2b", "software", "saas", "subscription", "business"]
        - Keep only the five allowed filter keys above.
        - If unknown, return empty arrays for that filter key.
        - IMPORTANT: Be very specific and restrictive to avoid broad results like Google, Amazon, etc.
        """

        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Outmate AI"
        }
        
        payload = {
            "model": "anthropic/claude-3.5-haiku",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 500,
            "response_format": {"type": "json_object"}
        }
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    print(f">>> [Advanced NLP] Raw LLM Response: {content}", flush=True)
                    
                    # Extract JSON from response
                    parsed = self._try_parse_json(content)
                    if isinstance(parsed, dict):
                        normalized_filters = self._normalize_model_filters(parsed.get("filters", {}))
                        normalized_intent = str(parsed.get("intent", "")).strip().lower()
                        if normalized_intent not in ("prospect", "company"):
                            normalized_intent = ""
                        try:
                            confidence = float(parsed.get("confidence", 0))
                        except Exception:
                            confidence = 0.0
                        is_relevant = parsed.get("is_relevant", True)
                        if not isinstance(is_relevant, bool):
                            is_relevant = True
                        reason = str(parsed.get("reason", "")).strip()
                        print(f">>> [Advanced NLP] OpenRouter categorized: {parsed}", flush=True)
                        return {
                            "intent": normalized_intent,
                            "filters": normalized_filters,
                            "confidence": confidence,
                            "is_relevant": is_relevant,
                            "reason": reason
                        }
                    # Fallback if model response is non-JSON
                    return {
                        "intent": "",
                        "filters": {},
                        "confidence": 0,
                        "is_relevant": True,
                        "reason": "Model returned non-JSON output"
                    }
                else:
                    raise HTTPException(status_code=500, detail=f"OpenRouter API error: {response.status_code}")
        except Exception as e:
            print(f">>> [Advanced NLP] OpenRouter request failed: {e}", flush=True)
            raise HTTPException(status_code=500, detail=f"NLP service failed: {str(e)}")

    def _try_parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        if not isinstance(content, str) or not content.strip():
            return None

        # 1) Direct JSON
        try:
            parsed = json.loads(content)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

        # 2) ```json ... ``` fenced block
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.IGNORECASE)
        if fenced:
            try:
                parsed = json.loads(fenced.group(1).strip())
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                pass

        # 3) First JSON object in text (multiline-safe)
        obj_match = re.search(r"\{[\s\S]*\}", content)
        if obj_match:
            try:
                parsed = json.loads(obj_match.group(0))
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                return None
        return None

    def _normalize_model_filters(self, filters: Any) -> Dict[str, List[str]]:
        if not isinstance(filters, dict):
            return {}

        normalized: Dict[str, List[str]] = {}
        for key, value in filters.items():
            if key not in self._ALLOWED_FILTER_KEYS:
                continue

            values = value if isinstance(value, list) else ([value] if value is not None else [])
            cleaned: List[str] = []
            for raw in values:
                if not isinstance(raw, str):
                    continue
                v = raw.strip()
                if not v:
                    continue
                if key == "industry":
                    v = self._normalize_industry_term(v)
                elif key == "location":
                    v = self._normalize_location_term(v)
                elif key == "current_title":
                    v = re.sub(r"^(find|show|get|give|list)\s+(me\s+)?", "", v, flags=re.IGNORECASE).strip()
                    v = re.sub(r"\s+in\s+.+$", "", v, flags=re.IGNORECASE).strip()
                    v = v.title()
                cleaned.append(v)

            deduped = self._unique_preserve(cleaned)
            if deduped:
                normalized[key] = deduped

        return normalized
    
    async def _extract_filters_with_langchain(self, query: str) -> Dict[str, Any]:
        """Extract filters using LangChain text processing"""
        try:
            # Create text splitter
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            
            # Create documents
            doc = Document(page_content=query)
            texts = text_splitter.split_documents([doc])
            
            # Extract entities and keywords using LangChain
            filters = {}
            
            # Industry extraction
            industries = ["software", "saas", "b2b", "b2b saas", "b2b software", "tech", "healthcare", "finance", "banking", "retail", "fintech", "martech"]
            query_lower = query.lower()
            
            for industry in industries:
                if industry in query_lower:
                    filters.setdefault("industry", []).append(self._normalize_industry_term(industry))
            
            # Location extraction
            locations = ["usa", "us", "united states", "america", "europe", "uk", "germany", "france"]
            for location in locations:
                if location in query_lower:
                    filters.setdefault("location", []).append(self._normalize_location_term(location))
            
            # Company size extraction
            sizes = ["startup", "small", "medium", "large", "enterprise"]
            for size in sizes:
                if size in query_lower:
                    filters.setdefault("company_size", []).append(size.title())

            # Prospect title/keyword extraction for person intent queries.
            extracted_titles = self._extract_title_terms(query)
            if extracted_titles:
                filters["current_title"] = extracted_titles
                filters.setdefault("keywords", []).extend(extracted_titles)

            # Generic keyword fallback from the non-location/industry side of "X in Y".
            if "keywords" not in filters and " in " in query_lower:
                left = query[:query_lower.index(" in ")].strip(" ,.")
                if left:
                    filters["keywords"] = [left]

            # Deduplicate list-like filter values.
            for key, value in list(filters.items()):
                if isinstance(value, list):
                    filters[key] = self._unique_preserve([str(v) for v in value])
            
            print(f">>> [Advanced NLP] LangChain extracted filters: {filters}", flush=True)
            return filters
            
        except Exception as e:
            print(f">>> [Advanced NLP] LangChain filter extraction failed: {e}", flush=True)
            return {}
    
    async def _find_similar_queries_vector(self, query: str) -> List[str]:
        """Find similar queries using vector search"""
        try:
            # Initialize PGVector connection
            engine = create_engine(self.db_url)
            
            # Create vector store
            vector_store = PGVector(
                embedding_function=self.embeddings,
                collection_name="search_queries",
                connection_string=self.db_url
            )
            
            # Search for similar queries
            similar_docs = vector_store.similarity_search(
                query,
                k=5,
                filter={"type": "user_query"}
            )
            
            similar_queries = [doc.page_content for doc in similar_docs]
            print(f">>> [Advanced NLP] Found similar queries: {similar_queries}", flush=True)
            
            return similar_queries
            
        except Exception as e:
            print(f">>> [Advanced NLP] Vector search failed: {e}", flush=True)
            return []
    
    def _synthesize_final_response(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Synthesize final response from all processing steps"""
        return {
            "intent": state.get("intent", "company"),
            "filters": state.get("filters", {}),
            "confidence": state.get("confidence", 0),
            "similar_queries": state.get("similar_queries", []),
            "processing_method": "langgraph_workflow"
        }
    
    async def process_query(self, query: str) -> Dict[str, Any]:
        """Process query using consolidated analysis and redirect to appropriate service"""
        try:
            # 1) Use consolidate analyze_query for all metadata (intent, filters, relevance)
            # This avoids redundant calls and ensures all guardrails are applied.
            analysis_result = await self.analyze_query(query)
            
            intent = analysis_result.get("intent", "company")
            filters = analysis_result.get("filters", {})
            confidence = analysis_result.get("confidence", 0)
            is_relevant = analysis_result.get("is_relevant", True)
            reason = analysis_result.get("reason", "")
            similar_queries = analysis_result.get("similar_queries", [])

            if not bool(is_relevant):
                final_result = {
                    "intent": intent,
                    "filters": {},
                    "confidence": confidence,
                    "is_relevant": False,
                    "reason": reason or "Query is not relevant for search.",
                    "similar_queries": similar_queries,
                    "processing_method": "langgraph_workflow",
                    "results": {"data": [], "total_results": 0}
                }
                print(f">>> [Advanced NLP] Final result (irrelevant): {final_result}", flush=True)
                return final_result
            
            # 2) Call existing service based on intent using the merged & enhanced filters
            service_result = await self.call_existing_service(intent, filters)
            
            # 3) Synthesize final response
            final_result = {
                "intent": intent,
                "filters": filters,
                "confidence": confidence,
                "similar_queries": similar_queries,
                "processing_method": "langgraph_workflow",
                "service_results": service_result,
                "results": {
                    "data": service_result.get("results", []),
                    "total_results": service_result.get("total_count", 0)
                }
            }
            
            print(f">>> [Advanced NLP] Final result ({intent}): {len(final_result['results']['data'])} results found", flush=True)
            return final_result
            
        except Exception as e:
            print(f">>> [Advanced NLP] Workflow failed: {e}", flush=True)
            raise HTTPException(status_code=500, detail=f"Advanced NLP processing failed: {str(e)}")

    async def analyze_query(self, query: str) -> Dict[str, Any]:
        """Analyze and clarify intent/filters without executing provider search."""
        await self._store_query_vector(query)

        categorization_result = await self._categorize_with_openrouter(query)
        if not isinstance(categorization_result, dict):
            categorization_result = {"intent": "", "filters": {}, "confidence": 0, "is_relevant": True, "reason": ""}

        filter_result = await self._extract_filters_with_langchain(query)
        if not isinstance(filter_result, dict):
            filter_result = {}

        similar_queries = await self._find_similar_queries_vector(query)

        # LLM is primary source. LangChain only fills missing keys as fallback.
        merged_filters: Dict[str, Any] = {}
        model_filters = categorization_result.get("filters") or {}
        if isinstance(model_filters, dict):
            merged_filters.update(model_filters)
            
        # Fallback to internal extraction for missing keys
        for k, v in filter_result.items():
            if k not in merged_filters or not merged_filters[k]:
                merged_filters[k] = v

        model_intent = categorization_result.get("intent")
        confidence = categorization_result.get("confidence", 0) or 0
        is_relevant = bool(categorization_result.get("is_relevant", True))
        reason = categorization_result.get("reason", "")
        
        # Determine intent (LLM result preferred if confident)
        if model_intent in ("prospect", "company") and float(confidence) >= 60:
            intent = model_intent
        else:
            intent = self._infer_intent_from_query(query)

        # Guardrail: presence of person roles/titles ALWAYS force prospect intent
        prospect_indicators = ["current_title", "seniority_level", "job_function", "name"]
        if any(merged_filters.get(key) for key in prospect_indicators):
            print(f">>> [Advanced NLP] Person filters detected. Overriding intent to 'prospect'", flush=True)
            intent = "prospect"
            
        # One last check on raw query text for "prospect" intent keywords
        prospect_keywords = ["decision maker", "people", "person", "contact", "email", "phone"]
        if any(kw in query.lower() for kw in prospect_keywords):
            print(f">>> [Advanced NLP] Prospect keywords detected in query. Overriding intent to 'prospect'", flush=True)
            intent = "prospect"

        # 4) Final step: Enhance filters with autocomplete lookup
        enhanced_filters = await self._enhance_filters_with_autocomplete(merged_filters)

        return {
            "intent": intent,
            "filters": enhanced_filters,
            "confidence": confidence,
            "is_relevant": is_relevant,
            "reason": reason,
            "similar_queries": similar_queries,
            "processing_method": "langgraph_workflow",
        }
    
    def _get_service_urls(self, intent: str, filters: Dict[str, Any]) -> Dict[str, str]:
        """Generate API URLs for existing services based on intent and filters"""
        base_url = "http://localhost:8000"
        
        if intent == "prospect":
            # API endpoint for prospects service
            prospect_url = f"{base_url}/api/prospects/search"
            return {"api_url": prospect_url, "service": "prospects"}
            
        elif intent == "company":
            # API endpoint for companies service
            company_url = f"{base_url}/api/leads/search/companies"
            return {"api_url": company_url, "service": "companies"}
        
        else:
            # Default fallback
            return {"api_url": None, "service": None}
    
    async def call_existing_service(self, intent: str, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Call existing prospect or company service with extracted filters"""
        service_info = self._get_service_urls(intent, filters)
        
        if not service_info["api_url"]:
            raise HTTPException(status_code=400, detail="Invalid search intent")
        
        try:
            # Prepare request payload for existing service
            if service_info["service"] == "prospects":
                def _normalize_prospect_response(result: Dict[str, Any]) -> Dict[str, Any]:
                    raw_profiles = result.get("profiles", [])
                    if isinstance(raw_profiles, dict):
                        raw_profiles = list(raw_profiles.values())
                    elif not isinstance(raw_profiles, list):
                        raw_profiles = []

                    total_count = result.get("total_count", 0)
                    if not isinstance(total_count, int):
                        try:
                            total_count = int(total_count)
                        except Exception:
                            total_count = 0
                    if total_count == 0 and raw_profiles:
                        total_count = len(raw_profiles)

                    return {
                        "profiles": raw_profiles,
                        "total_count": total_count,
                        "next_cursor": result.get("next_cursor")
                    }

                # Call prospects API with filters
                payload = {"filters": filters, "limit": 3}
                if "industry" in filters:
                    payload["industry"] = filters["industry"]
                if "location" in filters:
                    payload["location"] = filters["location"]
                if "current_title" in filters and isinstance(filters["current_title"], list):
                    payload["current_title"] = [str(x).strip() for x in filters["current_title"] if str(x).strip()]

                keywords = filters.get("keywords")
                # Only send keyword when title is not available; keyword forces realtime endpoint.
                if not payload.get("current_title"):
                    if isinstance(keywords, list):
                        kw = " ".join([str(x) for x in keywords if str(x).strip()]).strip()
                        if kw:
                            payload["keyword"] = kw
                    elif isinstance(keywords, str) and keywords.strip():
                        payload["keyword"] = keywords.strip()
                
                async with httpx.AsyncClient(timeout=90) as client:
                    response = await client.post(
                        service_info["api_url"],
                        json=payload,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        normalized = _normalize_prospect_response(result)
                        profiles = normalized["profiles"]
                        total_count = normalized["total_count"]

                        # Fallback 1: if no results, retry without industry (industry labels can be provider-specific).
                        if len(profiles) == 0 and payload.get("industry"):
                            retry_payload = dict(payload)
                            retry_payload.pop("industry", None)
                            print(">>> [Advanced NLP] Prospects retry without industry filter", flush=True)
                            retry_response = await client.post(
                                service_info["api_url"],
                                json=retry_payload,
                                headers={"Content-Type": "application/json"}
                            )
                            if retry_response.status_code == 200:
                                retry_result = _normalize_prospect_response(retry_response.json())
                                profiles = retry_result["profiles"]
                                total_count = retry_result["total_count"]
                                normalized = retry_result

                        # Fallback 2: if still empty, use keyword search (realtime endpoint path in prospects service).
                        if len(profiles) == 0 and payload.get("current_title") and not payload.get("keyword"):
                            title_values = payload.get("current_title") or []
                            keyword_value = " ".join([str(x).strip() for x in title_values if str(x).strip()]).strip()
                            if keyword_value:
                                retry_payload = {"limit": payload.get("limit", 3), "keyword": keyword_value}
                                # Keep retry payload keyword-only to avoid mixed Realtime/In-DB filter formats.
                                print(f">>> [Advanced NLP] Prospects retry with keyword: {keyword_value}", flush=True)
                                retry_response = await client.post(
                                    service_info["api_url"],
                                    json=retry_payload,
                                    headers={"Content-Type": "application/json"}
                                )
                                if retry_response.status_code == 200:
                                    retry_result = _normalize_prospect_response(retry_response.json())
                                    profiles = retry_result["profiles"]
                                    total_count = retry_result["total_count"]
                                    normalized = retry_result

                        print(f">>> [Advanced NLP] Prospects service returned {len(profiles)} results", flush=True)
                        return {
                            "service": "prospects",
                            "results": profiles,
                            "total_count": total_count,
                            "next_cursor": normalized.get("next_cursor")
                        }
                    else:
                        raise HTTPException(status_code=500, detail="Prospects service error")
            
            elif service_info["service"] == "companies":
                # Call companies API with actual extracted filters
                # The companies search endpoint transforms these to Explorium/ContactOut format
                payload = {
                    "filters": {
                        "industry": filters.get("industry") or [],
                        "location": filters.get("location") or [],
                        "employee_count": filters.get("company_size") or [],
                        "keywords": filters.get("keywords") or []
                    },
                    "options": {
                        "limit": 3,
                        "enrich": True
                    }
                }
                
                print(f">>> [Advanced NLP] Companies API payload: {payload}", flush=True)
                
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(
                        service_info["api_url"],
                        json=payload,
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        company_data = result.get("data", {})
                        companies = company_data.get("companies", [])
                        print(f">>> [Advanced NLP] Companies service returned {len(companies)} results", flush=True)
                        return {
                            "service": "companies",
                            "results": companies,
                            "total_count": company_data.get("total_count", len(companies))
                        }
                    else:
                        error_detail = response.text
                        try:
                            error_detail = response.json().get("detail", response.text)
                        except: pass
                        raise HTTPException(status_code=500, detail=f"Companies service error: {error_detail}")
                        
        except Exception as e:
            print(f">>> [Advanced NLP] Service call failed: {e}", flush=True)
            raise HTTPException(status_code=500, detail=f"Service call failed: {str(e)}")
    
    async def _get_autocomplete_suggestions(self, field: str, query: str) -> List[str]:
        """Get autocomplete suggestions from Explorium API"""
        try:
            headers = {
                "API_KEY": os.getenv("EXPLORIUM_API_KEY", ""),
                "Content-Type": "application/json"
            }
            
            url = f"https://api.explorium.ai/v1/businesses/autocomplete"
            params = {
                "field": field,
                "query": query,
                "semantic_search": "true"
            }
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(url, headers=headers, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    suggestions = data.get("suggestions", [])
                    # Return top 5 suggestions
                    return [s.get("value", "") for s in suggestions[:5] if s.get("value")]
                    
        except Exception as e:
            print(f">>> [Advanced NLP] Autocomplete failed for {field}: {e}", flush=True)
            
        return []

    async def _enhance_filters_with_autocomplete(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Enhance filters using autocomplete API for better accuracy"""
        enhanced_filters = filters.copy()
        
        # Enhance industry with autocomplete
        if "industry" in enhanced_filters and enhanced_filters["industry"]:
            for i, industry in enumerate(enhanced_filters["industry"]):
                if industry.lower() in ["saas", "b2b saas", "software development"]:
                    suggestions = await self._get_autocomplete_suggestions("industry", "software")
                    if suggestions:
                        # Use the most relevant software-related suggestion
                        enhanced_filters["industry"][i] = suggestions[0]
                        print(f">>> [Advanced NLP] Enhanced industry: {industry} -> {suggestions[0]}", flush=True)
        
        # Enhance location with autocomplete
        if "location" in enhanced_filters and enhanced_filters["location"]:
            for i, location in enumerate(enhanced_filters["location"]):
                if location.lower() in ["united states", "usa", "north america"]:
                    suggestions = await self._get_autocomplete_suggestions("country", "united states")
                    if suggestions:
                        enhanced_filters["location"][i] = suggestions[0]
                        print(f">>> [Advanced NLP] Enhanced location: {location} -> {suggestions[0]}", flush=True)
        
        return enhanced_filters

    async def _store_query_vector(self, query: str):
        try:
            engine = create_engine(self.db_url)
            vector_store = PGVector(
                embedding_function=self.embeddings,
                collection_name="search_queries",
                connection_string=self.db_url
            )
            
            # Store the query
            doc = Document(
                page_content=query,
                metadata={"type": "user_query", "timestamp": str(asyncio.get_event_loop().time())}
            )
            
            vector_store.add_documents([doc])
            print(f">>> [Advanced NLP] Stored query in vector DB: {query}", flush=True)
            
        except Exception as e:
            print(f">>> [Advanced NLP] Failed to store query: {e}", flush=True)
