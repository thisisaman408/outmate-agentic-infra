"""
Chat Agent Service - Conversational agent powered by Claude via OpenRouter.
Provides context-aware follow-up conversations after search results are returned.
"""

import os
import re
import json
import hashlib
import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import httpx

logger = logging.getLogger(__name__)


class ChatContext(BaseModel):
    intent: str = "prospect"
    query: str = ""
    results: List[Dict[str, Any]] = []
    signals: List[Dict[str, Any]] = []
    filters: Dict[str, Any] = {}


class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    context: ChatContext


class ChatResponse(BaseModel):
    reply: str
    action: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None


class ChatAgentService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = "anthropic/claude-3.5-haiku"

    def _format_results_summary(self, context: ChatContext) -> str:
        """Format search results into a concise summary for the system prompt."""
        if not context.results:
            return "No results available."

        lines = []
        for i, r in enumerate(context.results[:10]):
            if context.intent == "prospect":
                name = r.get("name") or r.get("full_name") or "Unknown"
                headline = r.get("headline") or ""
                title = r.get("job_title") or r.get("current_title") or ""
                company = r.get("company") or r.get("current_company") or ""
                # Try to extract from current_employers
                employers = r.get("current_employers") or []
                if employers and isinstance(employers, list) and len(employers) > 0:
                    emp = employers[0]
                    if not company:
                        company = emp.get("company_name") or emp.get("name") or ""
                    if not title:
                        title = emp.get("title") or ""
                email = ""
                emails = r.get("emails") or []
                if isinstance(emails, list) and emails:
                    email = emails[0] if isinstance(emails[0], str) else emails[0].get("email", "")
                linkedin = r.get("linkedin_profile_url") or r.get("flagship_profile_url") or ""
                # Filter out ContactOut references from headline and title
                headline = re.sub(r'\s*[-–|]\s*Founder at Contactout.*$', '', headline, flags=re.IGNORECASE).strip()
                headline = re.sub(r'\s*[-–|]\s*Contactout.*$', '', headline, flags=re.IGNORECASE).strip()
                title = re.sub(r'\s*[-–|]\s*Founder at Contactout.*$', '', title, flags=re.IGNORECASE).strip()
                title = re.sub(r'\s*[-–|]\s*Contactout.*$', '', title, flags=re.IGNORECASE).strip()
                lines.append(f"{i+1}. {name} — {title} at {company} | {headline} | Email: {email or 'N/A'} | LinkedIn: {linkedin or 'N/A'}")
            else:
                name = r.get("name") or r.get("company_name") or "Unknown"
                domain = r.get("domain") or ""
                industry = r.get("industry") or ""
                employees = r.get("employee_count_exact") or r.get("employee_count") or r.get("size") or "N/A"
                location = r.get("headquarters_city") or r.get("location") or r.get("hq_city") or ""
                country = r.get("headquarters_country") or r.get("country") or ""
                loc_str = f"{location}, {country}" if location and country else location or country or "N/A"
                revenue = r.get("revenue_exact") or r.get("revenue") or "N/A"
                lines.append(f"{i+1}. {name} ({domain}) — {industry} | Employees: {employees} | Location: {loc_str} | Revenue: {revenue}")

        return "\n".join(lines)

    def _format_signals_summary(self, signals: List[Dict[str, Any]]) -> str:
        """Format detected signals into a summary."""
        if not signals:
            return ""

        lines = ["Detected Signals:"]
        for i, s in enumerate(signals[:10]):
            sig_type = s.get("type") or s.get("signal_type") or "Unknown"
            desc = s.get("description") or s.get("summary") or ""
            tip = s.get("personalization_tip") or s.get("tip") or ""
            entity = s.get("entity_name") or s.get("company") or s.get("name") or ""
            line = f"- [{sig_type}] {entity}: {desc}"
            if tip:
                line += f" (Tip: {tip})"
            lines.append(line)

        return "\n".join(lines)

    def _build_system_prompt(self, context: ChatContext) -> str:
        """Build the system prompt with full context."""
        intent_label = "prospects" if context.intent == "prospect" else "companies"
        count = len(context.results)
        results_summary = self._format_results_summary(context)
        signals_summary = self._format_signals_summary(context.signals)
        filters_summary = json.dumps(context.filters, default=str) if context.filters else "None"

        signals_section = f"\n{signals_summary}" if signals_summary else ""

        return f"""You are a B2B sales intelligence assistant. You're helping the user analyze search results and plan outreach.

Current context:
- Search intent: {context.intent}
- Original query: "{context.query}"
- Extracted filters: {filters_summary}
- Results found: {count} {intent_label}
- Results summary:
{results_summary}
{signals_section}

Instructions:
- Answer questions about the search results, companies, or prospects
- Help the user understand patterns, suggest outreach strategies, or refine their search
- Reference specific data from the results (names, companies, industries, signals)
- Be concise and actionable
- If the user wants to run a completely new/different search, respond with your message AND include exactly this on its own line: ACTION:NEW_SEARCH|<the new query>
- If the user asks to detect signals or analyze signals, include: ACTION:DETECT_SIGNALS
- If the user asks to create a campaign or write emails, include: ACTION:GENERATE_CAMPAIGN
- Otherwise, just respond conversationally. Most messages won't need an action."""

    def _parse_action(self, text: str) -> tuple:
        """Parse ACTION lines from the LLM response. Returns (cleaned_text, action, action_data)."""
        action = None
        action_data = None
        cleaned_lines = []

        for line in text.split("\n"):
            stripped = line.strip()
            if stripped.startswith("ACTION:NEW_SEARCH|"):
                query = stripped.split("|", 1)[1].strip()
                action = "new_search"
                action_data = {"query": query}
            elif stripped == "ACTION:DETECT_SIGNALS":
                action = "detect_signals"
            elif stripped == "ACTION:GENERATE_CAMPAIGN":
                action = "generate_campaign"
            else:
                cleaned_lines.append(line)

        cleaned_text = "\n".join(cleaned_lines).strip()
        return cleaned_text, action, action_data

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """Send conversation to Claude via OpenRouter and return response."""
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not set")

        system_prompt = self._build_system_prompt(request.context)

        # Build messages array: system + conversation history
        messages = [{"role": "system", "content": system_prompt}]
        for msg in request.messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Outmate AI"
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 1000,
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if response.status_code != 200:
                    logger.error(f"OpenRouter error: {response.status_code} {response.text[:300]}")
                    raise ValueError(f"OpenRouter API error: {response.status_code}")

                data = response.json()
                raw_reply = data["choices"][0]["message"]["content"]

                # Parse actions from the reply
                cleaned_reply, action, action_data = self._parse_action(raw_reply)

                print(f">>> [ChatAgent] Reply length: {len(cleaned_reply)}, action: {action}", flush=True)

                return ChatResponse(
                    reply=cleaned_reply,
                    action=action,
                    action_data=action_data,
                )

        except httpx.TimeoutException:
            logger.error("OpenRouter request timed out")
            return ChatResponse(reply="Sorry, the request timed out. Please try again.")
        except Exception as e:
            logger.error(f"Chat agent error: {e}")
            raise


class QueryParserService:
    """Uses LLM to extract intent and structured filters from a natural language query."""

    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.model = "anthropic/claude-3.5-haiku"

    async def parse(self, query: str) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not set")

        # --- Redis cache check ---
        normalized_query = query.strip().lower()
        query_hash = hashlib.sha256(normalized_query.encode()).hexdigest()
        cache_key = f"parse_query:{query_hash}"

        try:
            from app.services.redis_service import RedisService
            redis_svc = RedisService()
            cached = await redis_svc.get_cached_filter_result(cache_key)
            if cached is not None:
                logger.info(f"Cache HIT for query: {query[:60]}...")
                return cached
        except Exception as exc:
            logger.warning(f"Redis cache lookup failed (non-fatal): {exc}")

        prompt = f"""You are an intent router and filter mapper for B2B sales search.
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
- If the query mentions finding PEOPLE, ROLES, TITLES, PROFESSIONALS, "DECISION MAKERS", or "DECISIONS" (short for decision makers), use intent="prospect".
- If the query focuses on finding COMPANIES, AGENCIES, FIRMS, or businesses, BUT NOT specific roles or people, use intent="company".
- If the query is about finding COMPANIES that are hiring for roles (e.g., "find companies hiring for CTOs"), keep intent="company" and capture the roles as filters/keywords.
- BUT if the query is about finding specific PEOPLE/ROLES at companies (e.g., "Find CTO at companies hiring for AI" or "Find Head of Tech at those companies"), use intent="prospect" — the user wants to find the PEOPLE, not the companies.
- Users often have typos or use shorthand. Interpret the MEANING, not exact spelling:
  - "marketting" = "marketing", "enginneering" = "engineering", "decisions" = "decision makers", "descision makers" = "decision makers"
  - "company of 100" = company with ~100 employees, "company size 100" = same thing
- Example: "Find Marketing decision makers at digital agencies" MUST BE intent="prospect".
- Example: "Find digital agencies in Texas" MUST BE intent="company".
- Example: "Find data decision makers" MUST BE intent="prospect" with current_title=["Data Analyst", "Data Engineer", "Data Scientist", "Head of Data", "VP of Data", "Chief Data Officer"].
- Example: "Find me the marketing decisions for a company of 100 in GTM" MUST BE intent="prospect" with current_title=["VP of Marketing", "CMO", "Head of Marketing", "Marketing Director", "Head of GTM", "VP of GTM", "GTM Manager", "Director of Growth Marketing"], company_size=["51-200"].

Rules for Filters:
- Remove command phrases from titles (e.g., "find me", "show me", "get me").
- For prospect searches, extract role titles into current_title. Be smart about it:
  - "data decision makers" -> ["Head of Data", "VP of Data", "Chief Data Officer", "Data Director"]
  - "marketing leaders" -> ["VP of Marketing", "CMO", "Head of Marketing", "Marketing Director"]
  - "engineering leaders" -> ["VP of Engineering", "CTO", "Head of Engineering", "Engineering Director"]
  - Always expand vague role descriptions into specific job titles.
- Map industry terms to EXACT LinkedIn industry category names. Common mappings:
  - "fintech" -> ["Financial Services"]
  - "saas" / "software" -> ["Software Development"]
  - "digital agencies" -> ["Advertising Services", "Marketing Services"]
  - "healthcare" -> ["Hospitals and Health Care"]
  - "e-commerce" -> ["Retail", "E-Learning Providers"]
  - "ai" / "artificial intelligence" -> ["Technology, Information and Internet"]
  - "consulting" -> ["Business Consulting and Services"]
  - "manufacturing" -> ["Manufacturing"]
  - "real estate" -> ["Real Estate"]
  - NEVER use made-up industry names like "Financial Technology" or "Fintech" — always use the LinkedIn standard name.
- Map location terms to SPECIFIC country or state names that CrustData recognizes. NEVER use macro-regions like "European Union", "Europe", "Asia Pacific", "APAC", "North America", "LATAM", "MENA", "Nordics", "DACH", or "Benelux" — always expand them into individual countries. Examples:
  - "EU" or "Europe" -> ["Germany", "France", "Netherlands", "Spain", "Italy", "United Kingdom", "Ireland", "Sweden"]
  - "APAC" or "Asia" -> ["India", "China", "Singapore", "Japan", "Australia"]
  - "North America" -> ["United States", "Canada"]
  - "DACH" -> ["Germany", "Austria", "Switzerland"]
  - "Nordics" -> ["Sweden", "Norway", "Denmark", "Finland"]
  - "Middle East" -> ["United Arab Emirates", "Saudi Arabia", "Israel"]
  - US states should be written as "Texas", "California", "New York" (not abbreviated).
- For company_size: ONLY use these exact CrustData-compatible ranges: "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+".
  - "100 employees" or "company size 100" -> ["51-200"] (pick the range that contains that number)
  - "100 to 1000 employees" -> ["51-200", "201-500", "501-1000"]
  - "50 employees" -> ["11-50"]
  - "500 employees" -> ["201-500"]
  - NEVER invent ranges like "101-200" or "51-100" — only use the exact ranges listed above.
- Extract technology/tool names (like "Snowflake", "Salesforce", "HubSpot") into keywords.
- Do NOT put qualifiers like "verified emails", "contact information", "with emails" into keywords — these are not searchable terms.
- Understand common B2B abbreviations and map them correctly:
  - "GTM" (Go-to-Market) -> for prospect searches, add to current_title: ["GTM Manager", "Head of GTM", "VP of GTM", "GTM Lead", "GTM Strategist", "Go-to-Market Manager", "Director of GTM"]. Also add to keywords: ["GTM", "go-to-market"].
  - "RevOps" -> current_title: ["Revenue Operations Manager", "Head of RevOps", "VP Revenue Operations", "RevOps Director"]
  - "SDR" -> current_title: ["Sales Development Representative", "SDR Manager", "SDR Lead"]
  - "BDR" -> current_title: ["Business Development Representative", "BDR Manager"]
  - "AE" -> current_title: ["Account Executive", "Senior Account Executive"]
  - "CS" (Customer Success) -> current_title: ["Customer Success Manager", "Head of Customer Success", "VP Customer Success"]
  - "PLG" (Product-Led Growth) -> keywords: ["product-led growth", "PLG"]
  - "ABM" (Account-Based Marketing) -> keywords: ["account-based marketing", "ABM"]
- When a query combines a domain like "GTM" with "decision makers" or "leaders", expand to senior titles in that domain:
  - "Marketing Decision Makers in GTM" -> current_title: ["VP of Marketing", "CMO", "Head of Marketing", "Marketing Director", "Head of GTM", "VP of GTM", "GTM Manager", "Director of Growth Marketing"]
- If roles like "CTO", "Head of Tech", or "IT Procurement" are explicitly mentioned, prefer those titles and DO NOT replace them with unrelated roles like HR.
- IMPORTANT: "CXO" means "Chief Experience Officer" — it is a SPECIFIC title, NOT a shorthand for "all C-suite executives". When user says "CXO", use current_title=["CXO", "Chief Experience Officer"]. Do NOT include CEO, CTO, CFO, CMO, CIO, COO, or other C-level titles unless they are explicitly mentioned. The seniority level "CXO" in databases includes all C-level, but the user means the specific CXO role.
- Keep only the five allowed filter keys above.
- If unknown, return empty arrays for that filter key.
- IMPORTANT: Be very specific and restrictive to avoid broad results like Google, Amazon, etc."""

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Outmate AI"
        }

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 1000,
            "response_format": {"type": "json_object"}
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if response.status_code != 200:
                    logger.error(f"OpenRouter parse error: {response.status_code} {response.text[:300]}")
                    raise ValueError(f"LLM query parse failed: {response.status_code}")

                data = response.json()
                content = data["choices"][0]["message"]["content"]
                print(f">>> [QueryParser] Raw LLM Response: {content}", flush=True)

                # Parse JSON from response
                parsed = json.loads(content)
                intent = parsed.get("intent", "prospect")
                if intent not in ("prospect", "company"):
                    intent = "prospect"

                filters = parsed.get("filters", {})
                # Ensure all filter keys exist
                for key in ("industry", "location", "company_size", "current_title", "keywords"):
                    if key not in filters:
                        filters[key] = []

                # --- Post-process: enforce role intent for company hiring queries ---
                query_lower = query.lower()
                role_titles: List[str] = []

                if re.search(r"\bcto\b|chief technology officer", query_lower):
                    role_titles.extend(["CTO", "Chief Technology Officer"])
                if "head of tech" in query_lower or "head of technology" in query_lower:
                    role_titles.extend(["Head of Tech", "Head of Technology"])
                if "it procurement" in query_lower or ("procurement" in query_lower and "it" in query_lower):
                    role_titles.extend(["IT Procurement", "Head of IT Procurement", "IT Procurement Manager", "Director of IT Procurement"])
                # CXO = Chief Experience Officer (specific title, NOT all C-suite)
                if re.search(r"\bcxo\b|chief experience officer", query_lower):
                    role_titles.extend(["CXO", "Chief Experience Officer"])
                    # Remove any other C-suite titles the LLM may have incorrectly added
                    other_c_suite = {"ceo", "cfo", "cmo", "cio", "coo", "chief marketing officer",
                                     "chief financial officer", "chief operating officer",
                                     "chief information officer"}
                    current_titles = filters.get("current_title") or []
                    filters["current_title"] = [
                        t for t in current_titles
                        if t.lower() not in other_c_suite
                    ]

                # Deduplicate while preserving order
                seen = set()
                role_titles = [t for t in role_titles if not (t in seen or seen.add(t))]

                if role_titles:
                    # Determine if query is about finding companies or finding people
                    # "Find companies hiring for CTO" → company intent (roles are the object)
                    # "Find CTO at companies hiring for AI" → prospect intent (roles are the subject)
                    # Pattern: if role titles appear BEFORE "at/in/for" + "company/companies", it's prospect
                    has_company_word = bool(re.search(r"\bcompan(y|ies)\b", query_lower))
                    has_hiring_word = "hiring" in query_lower
                    # Check if query structure suggests finding people AT companies
                    # e.g. "Find CTO at those companies" or "Head of Tech... at companies"
                    roles_before_company = bool(re.search(
                        r"\b(cto|head of tech|it procurement|chief technology)\b.*\b(at|in|for|from)\s+(those|these|the)?\s*compan",
                        query_lower
                    ))
                    # Only switch to company intent if it's truly about finding companies
                    # (e.g. "find companies that are hiring CTOs") AND the LLM also chose company
                    if has_company_word and has_hiring_word and not roles_before_company and intent == "company":
                        pass  # keep company intent from LLM
                    elif roles_before_company or intent == "prospect":
                        intent = "prospect"

                    current_titles = filters.get("current_title") or []
                    current_titles_str = " ".join([str(t).lower() for t in current_titles])
                    has_role_titles = any(rt.lower() in current_titles_str for rt in ["cto", "head of tech", "head of technology", "it procurement"])
                    has_hr_titles = any(re.search(r"\bhr\b|human resources|people", str(t).lower()) for t in current_titles)

                    # Override incorrect HR titles or empty titles
                    if not current_titles or has_hr_titles or not has_role_titles:
                        filters["current_title"] = role_titles

                    # For company intent, add role titles to keywords too
                    if intent == "company":
                        keywords = filters.get("keywords") or []
                        for rt in role_titles:
                            if rt not in keywords:
                                keywords.append(rt)
                        filters["keywords"] = keywords

                result = {
                    "intent": intent,
                    "is_relevant": parsed.get("is_relevant", True),
                    "reason": parsed.get("reason", ""),
                    "confidence": parsed.get("confidence", 80),
                    "filters": filters,
                }

                # --- Cache the parsed result in Redis (1-hour TTL) ---
                try:
                    await redis_svc.set_cached_filter_result(cache_key, result, ttl=3600)
                    logger.info(f"Cached parse result for query: {query[:60]}...")
                except Exception as exc:
                    logger.warning(f"Redis cache store failed (non-fatal): {exc}")

                return result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM JSON: {e}")
            raise ValueError(f"LLM returned invalid JSON: {e}")
        except httpx.TimeoutException:
            logger.error("OpenRouter query parse timed out")
            raise ValueError("Query parsing timed out. Please try again.")
