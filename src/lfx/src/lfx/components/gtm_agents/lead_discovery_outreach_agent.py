"""Lead Discovery & Outreach Agent — Deterministic Pipeline.

Architecture: 5-phase pipeline where the LLM is called exactly ONCE (to write messages).
Everything else — search, filter, sort, enrich — is deterministic Python code.

BYOK (Bring Your Own Key) — the pipeline adapts to whatever keys the user provides:
  Search:   Tavily → DuckDuckGo (free) → FAIL
  Profile:  BrightData → Apollo → extract from search snippet
  Email:    BrightData email → Apollo email → Hunter → skip
  Messages: LLM (always available via model selector)
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime

import httpx
from langchain_core.messages import HumanMessage, SystemMessage

from lfx.base.agents.agent import LCToolsAgentComponent
from lfx.components.gtm_agents._tool_factory import _guess_domains
from lfx.base.models.unified_models import (
    get_language_model_options,
    get_llm,
    update_model_options_in_build_config,
)
from lfx.inputs.inputs import (
    DataInput,
    DropdownInput,
    IntInput,
    MessageTextInput,
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message
import structlog

logger = structlog.get_logger("lead_discovery")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_USERNAME_RE = re.compile(r"linkedin\.com/posts/([a-zA-Z0-9_-]+?)(?:_|%)")
_COMPANY_PAGE_RE = re.compile(r"linkedin\.com/(?:company|showcase)/", re.I)
_TITLE_SUFFIXES = {"mba", "phd", "pmp", "cpa", "cfa", "md", "dds", "esq", "jr", "sr", "ii", "iii"}


def _extract_username(url: str) -> str:
    m = _USERNAME_RE.search(url)
    return m.group(1) if m else ""


def _is_company_page(url: str) -> bool:
    return bool(_COMPANY_PAGE_RE.search(url))


def _is_likely_company_username(username: str) -> bool:
    """LinkedIn personal profiles almost always have a numeric suffix (e.g. 'john-doe-12345').
    Company accounts don't (e.g. 'smartlead-ai', 'hubspot'). Use this as a heuristic."""
    parts = username.split("-")
    has_numeric = any(p.isdigit() for p in parts)
    if has_numeric:
        return False  # Has digits → likely a person
    # Common company-name patterns
    company_suffixes = {"ai", "io", "hq", "inc", "labs", "tech", "app", "dev", "co", "global", "group", "software"}
    if parts[-1].lower() in company_suffixes and len(parts) <= 3:
        return True
    # Single word or two word usernames without digits are suspicious
    if len(parts) <= 1:
        return True
    return False


def _username_to_name(username: str) -> str:
    parts = username.split("-")
    cleaned = [p for p in parts if not p.isdigit() and p.lower() not in _TITLE_SUFFIXES]
    if not cleaned:
        cleaned = parts[:2]
    return " ".join(w.capitalize() for w in cleaned)


def _extract_company_from_snippet(text: str) -> str:
    for pat in [
        # "at TechCorp" — most common LinkedIn format
        r"\bat\s+([A-Z][\w\s&.\'-]{1,30})",
        # "CEO of TechCorp", "Founder, TechCorp", "VP @ TechCorp"
        r"(?:CEO|CTO|VP|Founder|Co-?founder|Director|Head|President|CMO|COO|CFO|SVP|EVP|Manager)\s+(?:of\s+)?(?:at|@|,)\s*([A-Z][\w\s&.\'-]{1,30})",
        # "Name - Title | Company" (LinkedIn title format in search results)
        r"\|\s*([A-Z][\w\s&.\'-]{2,30}?)(?:\s*\||$)",
        # "We at Company" or "our team at Company"
        r"(?:we|our\s+team)\s+at\s+([A-Z][\w\s&.\'-]{1,30})",
    ]:
        m = re.search(pat, text)
        if m:
            company = m.group(1).strip().rstrip(".,;:|")
            # Filter out generic words that aren't companies
            if company.lower() not in ("linkedin", "the", "a", "an", "this", "that", "my", "our"):
                return company
    return ""


def _extract_title_from_snippet(text: str) -> str:
    for pat in [
        r"((?:CEO|CTO|VP|Founder|Co-?founder|Director|Head|President|CMO|COO|CFO|SVP|EVP|Manager|Lead|Engineer|Architect)[\w\s,&/of-]{0,30})",
    ]:
        m = re.search(pat, text, re.I)
        if m:
            result = m.group(1).strip().rstrip(".,;:|")
            if len(result) < 60:
                return result
    return ""


# ---------------------------------------------------------------------------
# Component
# ---------------------------------------------------------------------------

class LeadDiscoveryOutreachAgentComponent(LCToolsAgentComponent):
    display_name = "Lead Discovery & Outreach Agent"
    description = (
        "Find people actively posting about any topic, scrape their latest LinkedIn posts and tweets, "
        "then write hyper-personalized outreach messages that reference what they posted today — not months ago. "
        "Perfect for warm intros like 'Saw your post about X — would love to chat about Y.'"
    )
    icon = "Crosshair"
    name = "LeadDiscoveryOutreachAgent"

    inputs = [
        *LCToolsAgentComponent.get_base_inputs(),
        # --- LLM ---
        ModelInput(
            name="model",
            display_name="Language Model",
            info="LLM for writing personalized messages (OpenRouter recommended — GPT-4o or Claude Sonnet)",
            real_time_refresh=True,
            required=True,
        ),
        SecretStrInput(
            name="api_key",
            display_name="Model API Key",
            info="API key for the selected model provider",
            real_time_refresh=True,
            advanced=True,
        ),
        # --- Core Inputs ---
        MessageTextInput(
            name="keyword",
            display_name="Keyword / Topic",
            info="The keyword or topic to find leads for (e.g., 'AI native development', 'sales automation SaaS')",
            required=True,
            tool_mode=True,
        ),
        IntInput(
            name="max_leads",
            display_name="Max Leads",
            info="Number of leads to discover and process.",
            value=3,
            required=True,
        ),
        MultilineInput(
            name="prospect_data",
            display_name="Known Prospects (Optional)",
            info="Pre-known company names or prospect names, one per line.",
            required=False,
            value="",
            tool_mode=True,
        ),
        # --- Client Context ---
        MessageTextInput(
            name="client_company",
            display_name="Your Company Name",
            info="The company you represent. This is who the outreach is FROM.",
            required=True,
        ),
        MultilineInput(
            name="client_description",
            display_name="Your Company Description / Value Prop",
            info="What your company does and the value it offers.",
            required=True,
        ),
        MessageTextInput(
            name="sender_name",
            display_name="Sender Name",
            info="Your name — the person sending the LinkedIn messages",
            required=True,
        ),
        # --- Message Config ---
        DropdownInput(
            name="message_type",
            display_name="Message Type",
            info="Type of LinkedIn message. Connection Requests have a 300-character hard limit.",
            options=["Connection Request (300 chars)", "InMail", "Follow-Up Message"],
            value="Connection Request (300 chars)",
            required=True,
        ),
        DropdownInput(
            name="tone",
            display_name="Tone",
            info="Tone and style of the LinkedIn messages",
            options=["Professional", "Casual & Friendly", "Thought Leadership", "Bold & Direct"],
            value="Professional",
        ),
        # --- API Keys ---
        SecretStrInput(name="tavily_api_key", display_name="Tavily API Key", info="Search for recent posts. Falls back to DuckDuckGo (free) if empty. Get at tavily.com.", required=False, advanced=True),
        SecretStrInput(name="brightdata_api_key", display_name="BrightData API Token", info="LinkedIn profile scraper — best source for titles, companies, bios. Get at brightdata.com.", required=False, advanced=True),
        SecretStrInput(name="apify_api_key", display_name="Apify API Key", info="Alternative LinkedIn scraper if BrightData unavailable. Get at apify.com.", required=False, advanced=True),
        SecretStrInput(name="apollo_api_key", display_name="Apollo API Key", info="Profile enrichment + email. Get at app.apollo.io.", required=False, advanced=True),
        SecretStrInput(name="hunter_api_key", display_name="Hunter API Key", info="Email finder by company domain. Get at hunter.io.", required=False, advanced=True),
        SecretStrInput(name="firecrawl_api_key", display_name="Firecrawl API Key", info="Scrape company pages/blogs for extra context. Get at firecrawl.dev.", required=False, advanced=True),
        # --- Advanced ---
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="Extra instructions for the LLM when writing outreach messages. The LLM gets lead data + these instructions.",
            value="",
            advanced=True,
        ),
        DataInput(name="chat_history", display_name="Chat Memory", is_list=True, advanced=True, info="Chat history for multi-turn conversations."),
    ]

    outputs = [
        Output(display_name="Outreach Messages", name="response", method="message_response"),
    ]

    def _validate_outputs(self) -> None:
        pass

    def create_agent_runnable(self):
        raise NotImplementedError("Deterministic pipeline — no agent runnable")

    def build_agent(self):
        raise NotImplementedError("Deterministic pipeline — no AgentExecutor")

    def _get_llm(self):
        return get_llm(model=self.model, user_id=self.user_id, api_key=getattr(self, "api_key", None), max_tokens=16384)

    def update_build_config(self, build_config: dict, field_value: str, field_name: str | None = None) -> dict:
        return update_model_options_in_build_config(
            component=self, build_config=build_config,
            cache_key_prefix="language_model_options_tool_calling",
            get_options_func=lambda user_id=None: get_language_model_options(user_id=user_id, tool_calling=True),
            field_name=field_name, field_value=field_value,
        )

    def get_chat_history_data(self) -> list[Data] | None:
        return getattr(self, "chat_history", None)

    # ===================================================================
    # BYOK — resolve which services are available
    # ===================================================================

    def _resolve_keys(self) -> dict[str, str]:
        """Return a dict of available API keys (non-empty only)."""
        keys = {}
        for name in ("tavily_api_key", "apollo_api_key", "hunter_api_key", "brightdata_api_key", "apify_api_key", "firecrawl_api_key"):
            val = (getattr(self, name, "") or "").strip()
            if val:
                keys[name] = val
        return keys

    # ===================================================================
    # MAIN PIPELINE
    # ===================================================================

    async def message_response(self) -> Message:
        keyword = (self.keyword or "").strip()
        max_leads = int(getattr(self, "max_leads", 3) or 3)
        client_company = (self.client_company or "").strip()
        client_description = (self.client_description or "").strip()
        sender_name = (self.sender_name or "").strip()
        message_type = getattr(self, "message_type", "Connection Request (300 chars)") or "Connection Request (300 chars)"
        tone = getattr(self, "tone", "Professional") or "Professional"
        prospect_data = (getattr(self, "prospect_data", "") or "").strip()

        if not keyword:
            return self._msg("Please provide a keyword or topic to search for.")

        # ---------------------------------------------------------------
        # FOLLOW-UP Q&A: if the user typed a question in chat (not the
        # canonical "Run the agent for: …" string from the Run button),
        # try to answer it from the previous run's output instead of
        # re-running the entire pipeline.
        # ---------------------------------------------------------------
        followup = self._extract_followup_question()
        if followup:
            prior_output = await self._find_prior_output()
            if prior_output:
                logger.info(f"[LeadDiscovery] Detected follow-up question: '{followup[:80]}'")
                return await self._answer_followup(followup, prior_output)
            logger.info(
                f"[LeadDiscovery] Follow-up '{followup[:80]}' detected but no prior output in chat history — running fresh search"
            )

        keys = self._resolve_keys()
        tips: list[str] = []  # Upgrade tips shown at the end

        available_services = [k.replace("_api_key", "").replace("_", " ").title() for k in keys]
        logger.info(f"[LeadDiscovery] Starting pipeline: keyword='{keyword}', max_leads={max_leads}, services={available_services}")

        # ---------------------------------------------------------------
        # PHASE 1: SEARCH — Tavily → DuckDuckGo → FAIL
        # ---------------------------------------------------------------
        if "tavily_api_key" in keys:
            logger.info("[LeadDiscovery] Phase 1: Searching via Tavily (time_range=day)")
            raw_results = await self._search_tavily(keyword, max_leads, keys["tavily_api_key"], prospect_data)
            search_source = "Tavily"
        else:
            logger.info("[LeadDiscovery] Phase 1: No Tavily key — falling back to DuckDuckGo (free)")
            raw_results = await self._search_duckduckgo(keyword, max_leads, prospect_data)
            search_source = "DuckDuckGo"
            tips.append("Add a **Tavily API Key** for much better search results with time filtering (tavily.com)")

        logger.info(f"[LeadDiscovery] Phase 1 complete: {len(raw_results)} raw post results via {search_source}")

        if not raw_results:
            return self._msg(
                f"No recent LinkedIn posts found for '{keyword}' via {search_source}. "
                "Try a broader keyword or check your API key."
            )

        # ---------------------------------------------------------------
        # PHASE 2: SELECT — deterministic filter + sort
        # ---------------------------------------------------------------
        candidates = self._phase_select(raw_results, max_leads, client_company)
        logger.info(f"[LeadDiscovery] Phase 2 complete: {len(candidates)} unique leads selected (from {len(raw_results)} results)")
        for c in candidates:
            logger.info(f"  → {c['name_guess']} ({c['username']}) score={c['score']:.2f}")

        if not candidates:
            return self._msg(f"Found posts but none from individual people outside {client_company}. Try a different keyword.")

        # ---------------------------------------------------------------
        # PHASE 3: ENRICH — BrightData → Apify → Apollo → Hunter → snippet
        # ---------------------------------------------------------------
        has_brightdata = "brightdata_api_key" in keys
        has_apify = "apify_api_key" in keys
        has_apollo = "apollo_api_key" in keys
        has_hunter = "hunter_api_key" in keys

        enrichment_chain = []
        if has_brightdata: enrichment_chain.append("BrightData")
        if has_apify: enrichment_chain.append("Apify")
        if has_apollo: enrichment_chain.append("Apollo")
        if has_hunter: enrichment_chain.append("Hunter")
        logger.info(f"[LeadDiscovery] Phase 3: Enrichment chain: {' → '.join(enrichment_chain) or 'NONE (snippet only)'}")

        enriched = await self._phase_enrich(
            candidates, keys,
            has_brightdata=has_brightdata,
            has_apify=has_apify,
            has_apollo=has_apollo,
            has_hunter=has_hunter,
        )

        # Log enrichment results
        emails_found = sum(1 for e in enriched if e.get("email"))
        titles_found = sum(1 for e in enriched if e.get("title"))
        companies_found = sum(1 for e in enriched if e.get("company"))
        logger.info(f"[LeadDiscovery] Phase 3 complete: {emails_found} emails, {titles_found} titles, {companies_found} companies found")
        for e in enriched:
            logger.info(f"  → {e.get('name', '?')}: title='{e.get('title', '')}' company='{e.get('company', '')}' email='{e.get('email', '')}' ")

        # Collect tips for missing enrichment keys
        if not has_brightdata and not has_apify and not has_apollo:
            tips.append("Add a **BrightData**, **Apify**, or **Apollo API Key** to get real job titles, company names, and richer lead profiles")
        if not has_hunter and not has_apollo:
            tips.append("Add a **Hunter** or **Apollo API Key** to find email addresses for your leads")

        # ---------------------------------------------------------------
        # PHASE 4: WRITE MESSAGES — single LLM call
        # ---------------------------------------------------------------
        logger.info("[LeadDiscovery] Phase 4: Writing messages via LLM (single call)")
        custom_instructions = (getattr(self, "system_prompt", "") or "").strip()
        leads = await self._phase_write_messages(
            enriched, keyword, client_company, client_description,
            sender_name, message_type, tone, custom_instructions,
        )
        logger.info(f"[LeadDiscovery] Phase 4 complete: {sum(1 for l in leads if l.get('message_text'))} messages written")

        # ---------------------------------------------------------------
        # PHASE 5: FORMAT OUTPUT — deterministic
        # ---------------------------------------------------------------
        output_text = self._phase_format_output(leads, message_type, tone, tips)
        logger.info(f"[LeadDiscovery] Phase 5 complete: output formatted ({len(output_text)} chars)")

        message = Message(text=output_text)
        self.status = message
        return message

    def _msg(self, text: str) -> Message:
        m = Message(text=text)
        self.status = m
        return m

    # ===================================================================
    # FOLLOW-UP Q&A
    # ===================================================================

    def _extract_followup_question(self) -> str:
        """Return the user's chat input only if it looks like a follow-up
        question (i.e. NOT the canonical 'Run the agent for: ...' string the
        Play panel sends when the user clicks the Run button).
        """
        raw = getattr(self, "input_value", None)
        if raw is None:
            return ""
        if isinstance(raw, Message):
            text = (raw.text or "").strip()
        else:
            text = str(raw).strip()
        if not text:
            return ""
        # The Play panel sends "Run the agent for: <keyword>" or
        # "Run the agent with the configured inputs" when the Run button is
        # clicked. Anything else came from the chat follow-up box.
        if text.lower().startswith("run the agent"):
            return ""
        return text

    async def _find_prior_output(self) -> str:
        """Find the most recent agent response that contains formatted lead
        blocks. Tries the wired chat_history input first, then falls back to
        the chat session messages table.
        """
        # 1) Try the explicit chat_history input (if upstream wired it).
        chat = getattr(self, "chat_history", None) or []
        if not isinstance(chat, list):
            chat = [chat]
        for entry in reversed(chat):
            text = ""
            t = getattr(entry, "text", None)
            if isinstance(t, str):
                text = t
            elif hasattr(entry, "data") and isinstance(entry.data, dict):
                text = entry.data.get("text") or entry.data.get("message") or ""
            if isinstance(text, str) and "Lead Profile:" in text:
                return text

        # 2) Fall back to fetching the session's chat messages from the
        # messages table — this is where the Play panel's chat goes.
        session_id = None
        graph = getattr(self, "graph", None)
        if graph is not None:
            session_id = getattr(graph, "session_id", None)
        if not session_id:
            session_id = getattr(self, "_session_id", None)
        if not session_id:
            return ""
        try:
            from lfx.memory import aget_messages
        except Exception as e:
            logger.warning(f"[LeadDiscovery] Could not import aget_messages: {e}")
            return ""
        try:
            messages = await aget_messages(
                session_id=str(session_id), order="DESC", limit=20
            )
        except Exception as e:
            logger.warning(f"[LeadDiscovery] aget_messages failed for session {session_id}: {e}")
            return ""
        for m in messages or []:
            text = getattr(m, "text", "") or ""
            if "Lead Profile:" in text:
                return text
        return ""

    async def _answer_followup(self, question: str, prior_output: str) -> Message:
        """Answer a follow-up question using the previous run's lead output as
        context. Single LLM call, no pipeline."""
        try:
            llm = self._get_llm()
        except Exception as e:
            logger.warning(f"[LeadDiscovery] Follow-up: LLM unavailable: {e}")
            return self._msg(
                "I can't answer follow-up questions right now (LLM unavailable). "
                "Update the keyword field and click Run Agent to search again."
            )

        system = (
            "You are a research assistant. The user just ran a Lead Discovery search and got the "
            "report below. Answer their follow-up question concisely and ground your answer ONLY "
            "in the report — never invent details. If the answer isn't in the report, say so plainly."
        )
        user = (
            f"PREVIOUS LEAD DISCOVERY REPORT:\n{prior_output}\n\n"
            f"USER QUESTION: {question}\n\n"
            "Answer in markdown. Be specific — cite names, titles, and companies from the report."
        )
        try:
            response = await llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user)])
            content = response.content if hasattr(response, "content") else str(response)
            if isinstance(content, list):
                content = " ".join(str(c) for c in content)
            answer = (content or "").strip()
            if not answer:
                answer = "I couldn't generate an answer. Try rephrasing the question."
        except Exception as e:
            logger.warning(f"[LeadDiscovery] Follow-up LLM call failed: {e}")
            answer = (
                "I hit an error while answering the follow-up question. "
                f"Details: {e}. Please try again or click Run Agent for a fresh search."
            )
        return self._msg(answer)

    # ===================================================================
    # PHASE 1: SEARCH
    # ===================================================================

    async def _search_tavily(self, keyword: str, max_leads: int, api_key: str, prospect_data: str) -> list[dict]:
        queries = [
            f"{keyword} LinkedIn post",
            f"{keyword} founder CEO posted",
            f"{keyword} thought leadership insights",
            f"{keyword} VP director sales marketing",
            f"{keyword} shared insights today",
        ]
        if prospect_data:
            for line in prospect_data.strip().splitlines():
                name = line.strip()
                if name:
                    queries.append(f"{name} {keyword} LinkedIn post")

        num_queries = max(3, min(len(queries), max_leads + 2))
        queries = queries[:num_queries]
        all_results: list[dict] = []

        async with httpx.AsyncClient(timeout=90.0) as client:
            # Try time_range='day' first
            tasks = [self._tavily_query(client, q, api_key, "day") for q in queries]
            batch = await asyncio.gather(*tasks, return_exceptions=True)
            for r in batch:
                if isinstance(r, list):
                    all_results.extend(r)

            # Fallback to 'week' if too few
            if len(all_results) < max_leads * 2:
                fallback = [self._tavily_query(client, q, api_key, "week") for q in queries[:3]]
                batch2 = await asyncio.gather(*fallback, return_exceptions=True)
                for r in batch2:
                    if isinstance(r, list):
                        all_results.extend(r)

        return all_results

    async def _tavily_query(self, client: httpx.AsyncClient, query: str, api_key: str, time_range: str) -> list[dict]:
        payload: dict = {
            "query": query, "max_results": 10, "search_depth": "basic",
            "include_answer": False, "include_domains": ["linkedin.com"],
        }
        if time_range:
            payload["time_range"] = time_range

        try:
            resp = await client.post(
                "https://api.tavily.com/search", json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
        except Exception:
            return []

        results = []
        for r in data.get("results", []):
            url = r.get("url", "")
            if "linkedin.com/posts/" not in url or _is_company_page(url):
                continue
            username = _extract_username(url)
            if not username or len(username) < 3:
                continue
            results.append({
                "url": url, "title": r.get("title", ""),
                "content": r.get("content", "")[:500],
                "score": r.get("score", 0), "username": username,
            })
        return results

    async def _search_duckduckgo(self, keyword: str, max_leads: int, prospect_data: str) -> list[dict]:
        """Fallback search using DuckDuckGo (free, no API key)."""
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            return []

        queries = [
            f"{keyword} site:linkedin.com/posts",
            f"{keyword} LinkedIn post today",
        ]
        if prospect_data:
            for line in prospect_data.strip().splitlines()[:3]:
                if line.strip():
                    queries.append(f"{line.strip()} {keyword} site:linkedin.com/posts")

        all_results: list[dict] = []
        ddgs = DDGS()
        for query in queries[:3]:
            try:
                for r in ddgs.text(query, max_results=10):
                    url = r.get("href", "")
                    if "linkedin.com/posts/" not in url or _is_company_page(url):
                        continue
                    username = _extract_username(url)
                    if not username or len(username) < 3:
                        continue
                    all_results.append({
                        "url": url, "title": r.get("title", ""),
                        "content": r.get("body", "")[:500],
                        "score": 0.5, "username": username,
                    })
            except Exception:
                continue

        return all_results

    # ===================================================================
    # PHASE 2: SELECT
    # ===================================================================

    def _phase_select(self, raw_results: list[dict], max_leads: int, client_company: str) -> list[dict]:
        by_user: dict[str, dict] = {}
        for r in raw_results:
            user = r["username"].lower()
            if user not in by_user or r["score"] > by_user[user]["score"]:
                by_user[user] = r

        candidates = list(by_user.values())

        # Filter out company accounts (no numeric suffix in username)
        people_only = [c for c in candidates if not _is_likely_company_username(c["username"])]
        if people_only:
            candidates = people_only
        else:
            logger.warning("[LeadDiscovery] All results look like company pages — keeping them as fallback")

        if client_company:
            cc_lower = client_company.lower()
            candidates = [
                c for c in candidates
                if cc_lower not in c.get("title", "").lower()
                and cc_lower not in c.get("content", "").lower()
                and cc_lower not in c["username"].lower()
            ]

        candidates.sort(key=lambda x: x["score"], reverse=True)

        for c in candidates[:max_leads]:
            c["name_guess"] = _username_to_name(c["username"])
            c["linkedin"] = f"https://www.linkedin.com/in/{c['username']}"

        return candidates[:max_leads]

    # ===================================================================
    # PHASE 3: ENRICH — smart BYOK fallback chain
    # ===================================================================
    #
    # Profile data (name, title, company):
    #   BrightData → Apollo → extract from search snippet
    #
    # Email:
    #   BrightData (if returned) → Apollo (if returned) → Hunter → skip
    #
    # Circuit breaker: if a service fails once, skip it for ALL remaining leads.
    #

    async def _phase_enrich(
        self, candidates: list[dict], keys: dict[str, str], *,
        has_brightdata: bool, has_apify: bool, has_apollo: bool, has_hunter: bool,
    ) -> list[dict]:
        bd_dead = False
        apify_dead = False
        apollo_dead = False
        sem = asyncio.Semaphore(3)

        def _apply_profile(lead_name: str, data: dict, name: str, title: str, company: str, email: str, about: str):
            """Merge profile data into existing fields (only fill gaps)."""
            name = data.get("name") or name
            title = data.get("position") or data.get("title") or title
            about = data.get("about") or about
            email = data.get("email") or data.get("email_address") or email
            comp = data.get("current_company") or data.get("company")
            if isinstance(comp, dict):
                company = comp.get("name", "") or company
            elif isinstance(comp, str) and comp:
                company = comp or company
            if data.get("name") and len(data["name"]) > len(lead_name):
                name = data["name"]
            return name, title, company, email, about

        async def enrich_one(lead: dict) -> dict:
            nonlocal bd_dead, apify_dead, apollo_dead

            lead_label = lead["name_guess"]
            name = lead["name_guess"]
            title = ""
            company = ""
            email = ""
            about = ""

            # --- Strategy 1: BrightData (best LinkedIn profile data) ---
            if has_brightdata and not bd_dead:
                logger.info(f"  [{lead_label}] Trying BrightData profile...")
                try:
                    bd = await self._brightdata_profile(keys["brightdata_api_key"], lead["linkedin"])
                    if bd.get("_dead"):
                        bd_dead = True
                        logger.warning(f"  [{lead_label}] BrightData DEAD — circuit breaker tripped, skipping for all leads")
                    else:
                        name, title, company, email, about = _apply_profile(name, bd, name, title, company, email, about)
                        logger.info(f"  [{lead_label}] BrightData → name='{name}' title='{title}' company='{company}' email='{email}'")
                except Exception as e:
                    logger.warning(f"  [{lead_label}] BrightData error, disabling: {e}")
                    bd_dead = True
            elif has_brightdata and bd_dead:
                logger.info(f"  [{lead_label}] BrightData SKIPPED (dead)")

            # --- Strategy 2: Apify LinkedIn profile (alternative to BrightData) ---
            if has_apify and not apify_dead and not title:
                logger.info(f"  [{lead_label}] Trying Apify profile (no title yet)...")
                try:
                    ap_data = await self._apify_profile(keys["apify_api_key"], lead["linkedin"], lead["username"])
                    if ap_data.get("_dead"):
                        apify_dead = True
                        logger.warning(f"  [{lead_label}] Apify DEAD — circuit breaker tripped, skipping for all leads")
                    elif ap_data:
                        name, title, company, email, about = _apply_profile(name, ap_data, name, title, company, email, about)
                        logger.info(f"  [{lead_label}] Apify → name='{name}' title='{title}' company='{company}'")
                except Exception as e:
                    logger.warning(f"  [{lead_label}] Apify error, disabling: {e}")
                    apify_dead = True
            elif has_apify and apify_dead:
                logger.info(f"  [{lead_label}] Apify SKIPPED (dead)")

            # --- Strategy 3: Apollo enrichment (profile + email) ---
            if has_apollo and not apollo_dead and (not title or not email):
                logger.info(f"  [{lead_label}] Trying Apollo enrichment (title={'✓' if title else '✗'} email={'✓' if email else '✗'})...")
                try:
                    ap = await self._apollo_enrich(keys["apollo_api_key"], name, company, lead["linkedin"])
                    if ap.get("_dead"):
                        apollo_dead = True
                        logger.warning(f"  [{lead_label}] Apollo DEAD — circuit breaker tripped, skipping for all leads")
                    else:
                        if not title and ap.get("title"):
                            title = ap["title"]
                        if not company and ap.get("company"):
                            company = ap["company"]
                        if not email and ap.get("email"):
                            email = ap["email"]
                        if ap.get("name") and len(ap.get("name", "")) > len(name):
                            name = ap["name"]
                except Exception as e:
                    logger.warning(f"  [{lead_label}] Apollo error, disabling: {e}")
                    apollo_dead = True
            elif has_apollo and apollo_dead:
                logger.info(f"  [{lead_label}] Apollo SKIPPED (dead)")

            # --- Snippet fallback: extract BEFORE Hunter so it has data to work with ---
            snippet_text = lead.get("title", "") + " " + lead.get("content", "")
            if not title:
                title = _extract_title_from_snippet(snippet_text)
                if title:
                    logger.info(f"  [{lead_label}] Snippet → title='{title}'")
            if not company:
                company = _extract_company_from_snippet(snippet_text)
                if company:
                    logger.info(f"  [{lead_label}] Snippet → company='{company}'")

            # --- Strategy 4: Hunter email (needs company name) ---
            email_unverified = False
            if has_hunter and not email:
                if company:
                    logger.info(f"  [{lead_label}] Trying Hunter email: name='{name}' company='{company}'")
                    parts = name.split(None, 1)
                    first = parts[0] if parts else ""
                    last = parts[1] if len(parts) > 1 else ""
                    h_email, h_conf = await self._hunter_email(keys["hunter_api_key"], first, last, company)
                    if h_email:
                        email = h_email
                        email_unverified = h_conf < 30
                        tag = " (unverified)" if email_unverified else f" (confidence={h_conf})"
                        logger.info(f"  [{lead_label}] Hunter → email='{email}'{tag}")
                    else:
                        logger.info(f"  [{lead_label}] Hunter → no email found for {company}")
                else:
                    logger.info(f"  [{lead_label}] Hunter SKIPPED (no company name in snippet)")

            logger.info(f"  [{lead_label}] FINAL: name='{name}' title='{title}' company='{company}' email='{email or 'not found'}'")

            lead["name"] = name
            lead["title"] = title
            lead["company"] = company
            lead["email"] = email
            lead["email_unverified"] = email_unverified
            lead["about"] = about[:200] if about else ""
            return lead

        async def limited(lead: dict) -> dict:
            async with sem:
                return await enrich_one(lead)

        return list(await asyncio.gather(*[limited(c) for c in candidates]))

    # --- BrightData ---

    async def _brightdata_profile(self, token: str, profile_url: str) -> dict:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.brightdata.com/datasets/v3/trigger",
                params={"dataset_id": "gd_l1viktl72bvl7bjuj0", "format": "json", "uncompressed_webhook": "true"},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json=[{"url": profile_url}],
            )
            if resp.status_code in (400, 401, 402, 403):
                return {"_dead": True}
            if resp.status_code not in (200, 201):
                return {}

            data = resp.json()

            if isinstance(data, dict) and data.get("snapshot_id"):
                snapshot_id = data["snapshot_id"]
                for _ in range(30):
                    await asyncio.sleep(5)
                    pr = await client.get(
                        f"https://api.brightdata.com/datasets/v3/progress/{snapshot_id}",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if pr.status_code == 200:
                        info = pr.json()
                        if info.get("status") == "ready":
                            rr = await client.get(
                                f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}",
                                params={"format": "json"},
                                headers={"Authorization": f"Bearer {token}"},
                            )
                            if rr.status_code == 200:
                                items = rr.json()
                                return items[0] if isinstance(items, list) and items else {}
                            return {}
                        if info.get("status") in ("failed", "error"):
                            return {}
                return {}

            if isinstance(data, list) and data:
                return data[0]
            return {}

    # --- Apify (LinkedIn posts → extract author profile data) ---

    async def _apify_profile(self, api_key: str, profile_url: str, expected_username: str) -> dict:
        """Use Apify LinkedIn posts actor to get author info from their recent posts."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.post(
                    "https://api.apify.com/v2/acts/apimaestro~linkedin-profile-posts/runs",
                    params={"token": api_key},
                    json={"profileUrls": [profile_url], "maxPosts": 3},
                )
                if resp.status_code in (402, 403):
                    return {"_dead": True}
                if resp.status_code not in (200, 201):
                    return {}

                run_data = resp.json().get("data", {})
                run_id = run_data.get("id")
                dataset_id = run_data.get("defaultDatasetId")
                status = run_data.get("status", "RUNNING")

                for _ in range(30):
                    if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                        break
                    await asyncio.sleep(4)
                    check = await client.get(
                        f"https://api.apify.com/v2/actor-runs/{run_id}",
                        params={"token": api_key},
                    )
                    if check.status_code == 200:
                        info = check.json().get("data", {})
                        status = info.get("status", "RUNNING")
                        dataset_id = info.get("defaultDatasetId", dataset_id)

                if status != "SUCCEEDED":
                    return {}

                items_resp = await client.get(
                    f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                    params={"token": api_key, "format": "json", "limit": 5},
                )
                if items_resp.status_code != 200:
                    return {}

                items = items_resp.json()
                if not items:
                    return {}

                # Validate: check if the data is for the right person
                if expected_username:
                    matched = False
                    for item in items[:3]:
                        for field in ("postUrl", "url", "shareUrl", "authorProfileUrl", "profileUrl"):
                            if expected_username.lower() in (item.get(field) or "").lower():
                                matched = True
                                break
                        if matched:
                            break
                    if not matched:
                        return {"_dead": True}  # Wrong profile — kill Apify

                # Extract author info from the first post
                post = items[0]
                result: dict = {}
                author_name = post.get("authorName") or post.get("fullName") or post.get("author", "")
                if author_name:
                    result["name"] = author_name
                author_title = post.get("authorTitle") or post.get("headline") or post.get("title", "")
                if author_title:
                    result["position"] = author_title
                    # Try to extract company from title
                    comp = _extract_company_from_snippet(author_title)
                    if comp:
                        result["company"] = comp
                return result

            except Exception:
                return {}

    # --- Apollo ---

    async def _apollo_enrich(self, api_key: str, name: str, company: str, linkedin_url: str) -> dict:
        parts = name.split(None, 1)
        first = parts[0] if parts else ""
        last = parts[1] if len(parts) > 1 else ""

        params: dict = {}
        if first:
            params["first_name"] = first
        if last:
            params["last_name"] = last
        if company:
            params["organization_name"] = company
            guesses = _guess_domains(company)
            if guesses:
                params["domain"] = guesses[0]
        if linkedin_url:
            params["linkedin_url"] = linkedin_url

        if not params:
            return {}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.apollo.io/api/v1/people/match",
                headers={"Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": api_key},
                json=params,
            )
            if resp.status_code in (402, 403):
                return {"_dead": True}
            if resp.status_code != 200:
                return {}

            person = resp.json().get("person", {})
            if not person:
                return {}

            result: dict = {}
            fn = person.get("first_name", "")
            ln = person.get("last_name", "")
            if fn or ln:
                result["name"] = f"{fn} {ln}".strip()
            if person.get("title"):
                result["title"] = person["title"]
            if person.get("email"):
                result["email"] = person["email"]
            if person.get("organization", {}).get("name"):
                result["company"] = person["organization"]["name"]
            if person.get("linkedin_url"):
                result["linkedin"] = person["linkedin_url"]
            return result

    # --- Hunter ---

    async def _hunter_email(
        self, api_key: str, first_name: str, last_name: str, company: str
    ) -> tuple[str, int]:
        """Return (email, confidence). Empty string + 0 if not found.

        Confidence is Hunter's 0-100 score. We accept any email Hunter returns
        (even confidence=0 guesses) — the caller decides whether to flag it as
        unverified in the output.
        """
        domains = _guess_domains(company)
        if not domains:
            logger.info(f"    Hunter: no domain guesses for company='{company}'")
            return "", 0

        logger.info(f"    Hunter: trying domains={domains[:3]} for {first_name} {last_name}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            best_email = ""
            best_confidence = -1
            for domain in domains[:3]:
                # Try email-finder first (needs name + domain)
                if first_name or last_name:
                    params = {"api_key": api_key, "domain": domain}
                    if first_name:
                        params["first_name"] = first_name
                    if last_name:
                        params["last_name"] = last_name
                    try:
                        resp = await client.get("https://api.hunter.io/v2/email-finder", params=params)
                        if resp.status_code == 200:
                            data = resp.json().get("data", {})
                            email = data.get("email", "")
                            confidence = data.get("confidence", 0) or 0
                            if email and confidence > best_confidence:
                                best_email, best_confidence = email, confidence
                                # Short-circuit on a high-confidence hit
                                if confidence >= 30:
                                    logger.info(
                                        f"    Hunter: found {email} (confidence={confidence}) via {domain}"
                                    )
                                    return email, confidence
                    except Exception:
                        continue
            if best_email:
                logger.info(
                    f"    Hunter: returning best guess {best_email} (confidence={best_confidence}, unverified)"
                )
                return best_email, max(best_confidence, 0)
        return "", 0

    # ===================================================================
    # PHASE 4: WRITE MESSAGES (single LLM call)
    # ===================================================================

    async def _phase_write_messages(
        self, leads: list[dict], keyword: str, client_company: str,
        client_description: str, sender_name: str, message_type: str, tone: str,
        custom_instructions: str = "",
    ) -> list[dict]:
        leads_for_prompt = []
        for i, lead in enumerate(leads):
            leads_for_prompt.append({
                "index": i,
                "name": lead.get("name", lead.get("name_guess", "")),
                "title": lead.get("title", ""),
                "company": lead.get("company", ""),
                "post_url": lead.get("url", ""),
                "post_snippet": lead.get("content", "")[:300],
                "about": lead.get("about", ""),
            })

        system_msg = (
            "You are a senior B2B sales copywriter. You write hyper-personalized LinkedIn outreach "
            "messages that sound like a real human wrote them — natural, grammatical, never awkward. "
            "You MUST respond with a valid JSON array and NOTHING else. No markdown, no explanation."
        )
        if custom_instructions:
            system_msg += f"\n\nAdditional instructions from the user:\n{custom_instructions}"
        is_short = "300" in message_type
        length_rule = (
            "HARD 300-character limit (count carefully). No greeting like 'Hi NAME'. "
            "Open with a specific reference to their post, then bridge to your offer in one line."
            if is_short
            else "Subject line + 2 short paragraphs (max 120 words total). Conversational, specific, no fluff."
        )
        user_msg = (
            f"Write a personalized {message_type} for each lead below.\n"
            f"Tone: {tone}\n"
            f"You represent: {sender_name} at {client_company}\n"
            f"{client_company} does: {client_description}\n"
            f"Searched topic: {keyword}\n\n"
            f"WRITING RULES (follow strictly):\n"
            f"- {length_rule}\n"
            f"- Reference what THIS specific lead said or shared in their post. Use their actual words/ideas.\n"
            f"- If their post quotes or shares another person's content, frame it as 'your post sharing X's thoughts on Y' or 'your repost about Y' — NEVER write awkward phrasings like 'your post WITH [other person's name]'.\n"
            f"- If the post snippet is about a topic UNRELATED to '{keyword}', focus on the actual post content rather than forcing the keyword in.\n"
            f"- Bridge to {client_company}'s value in one specific sentence — no generic 'we help companies grow' fluff.\n"
            f"- No emojis. No exclamation marks unless the tone is genuinely excited.\n"
            f"- Use the lead's first name only if known and natural; do NOT prefix with title placeholders.\n"
            f"- Every message must be grammatically correct English. Read it back to yourself before submitting.\n\n"
            f"LEADS:\n{json.dumps(leads_for_prompt, indent=2)}\n\n"
            f"Respond with a JSON array where each element has:\n"
            f'- "index": (matching the lead index above — every lead must get exactly one entry)\n'
            f'- "message": the outreach message text (must be NON-EMPTY)\n'
            f'- "best_hook": 1-sentence explanation of why this specific lead is relevant given their post\n'
            f'- "char_count": exact character count of the message\n\n'
            f"RESPOND WITH ONLY THE JSON ARRAY. Include all {len(leads_for_prompt)} leads."
        )

        try:
            llm = self._get_llm()
            response = await llm.ainvoke([SystemMessage(content=system_msg), HumanMessage(content=user_msg)])
            content = response.content if hasattr(response, "content") else str(response)
            messages = self._parse_llm_json(content)
        except Exception as e:
            logger.warning(f"LLM call failed, using fallback messages: {e}")
            messages = []

        msg_by_idx = {m["index"]: m for m in messages if isinstance(m, dict) and "index" in m}

        for i, lead in enumerate(leads):
            m = msg_by_idx.get(i, {})
            # NOTE: use `or` (not dict.get default) so empty/None messages also fall back —
            # the LLM occasionally returns "" or null for the message field.
            msg_text = (m.get("message") or "").strip()
            if not msg_text:
                msg_text = self._fallback_message(lead, keyword, client_company, sender_name)
            lead["message_text"] = msg_text
            lead["best_hook"] = (m.get("best_hook") or "").strip() or f"Recent post about {keyword}"
            lead["char_count"] = m.get("char_count") or len(msg_text)

        return leads

    def _parse_llm_json(self, content: str) -> list:
        for attempt in [
            lambda: json.loads(content),
            lambda: json.loads(re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", content).group(1)),
            lambda: json.loads(re.search(r"\[[\s\S]*\]", content).group(0)),
        ]:
            try:
                result = attempt()
                if isinstance(result, list):
                    return result
            except Exception:
                continue
        return []

    def _fallback_message(self, lead: dict, keyword: str, client_company: str, sender_name: str) -> str:
        return (
            f"Saw your recent post about {keyword} — resonates with the work "
            f"we're doing at {client_company}. Would love to connect. — {sender_name}"
        )

    # ===================================================================
    # PHASE 5: FORMAT OUTPUT
    # ===================================================================

    def _phase_format_output(self, leads: list[dict], message_type: str, tone: str, tips: list[str]) -> str:
        blocks = []
        for lead in leads:
            name = lead.get("name", lead.get("name_guess", "Unknown"))
            title = lead.get("title", "")
            company = lead.get("company", "")
            raw_email = lead.get("email", "")
            unverified = lead.get("email_unverified", False)
            if raw_email:
                email = f"{raw_email} (unverified)" if unverified else raw_email
            else:
                email = "not found"
            linkedin = lead.get("linkedin", "")
            post_url = lead.get("url", "")
            snippet = (lead.get("content", "") or "")[:150]
            best_hook = lead.get("best_hook", "")
            message_text = lead.get("message_text", "")
            char_count = lead.get("char_count", len(message_text))

            title_line = f"{title} at {company}" if title and company else title or company or ""
            char_limit = 300 if "300" in message_type else 1000

            blocks.append(
                f"---\n"
                f"## Lead Profile: {name}\n"
                f"**Title:** {title_line}\n"
                f"**Email:** {email}\n"
                f"**LinkedIn:** {linkedin}\n"
                f"\n"
                f"### Recent Posts:\n"
                f"1. [{snippet[:80] or 'Recent post'}]({post_url}) — \"{snippet[:100]}\" — Today\n"
                f"\n"
                f"### Best Hook:\n"
                f"- {best_hook}\n"
                f"\n"
                f"### LinkedIn Message for {name}\n"
                f"**To:** {name}, {title_line}\n"
                f"**Type:** {message_type} | **Tone:** {tone}\n"
                f"\n"
                f"**Message:**\n"
                f"{message_text}\n"
                f"\n"
                f"**Character Count:** {char_count}/{char_limit}\n"
                f"\n"
                f"**Personalization Sources:**\n"
                f"- Referenced post: [{snippet[:60] or 'Post'}]({post_url}) — {snippet[:80]}\n"
                f"\n"
                f"**Contact Info:**\n"
                f"- Email: {email}\n"
                f"- LinkedIn: {linkedin}\n"
                f"---"
            )

        output = "\n\n".join(blocks)

        # Add upgrade tips if any enrichment was missing
        if tips:
            output += "\n\n---\n### Upgrade Tips\n"
            for tip in tips:
                output += f"- {tip}\n"

        return output
