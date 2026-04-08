from langchain.agents import create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

from lfx.base.agents.agent import LCToolsAgentComponent
from lfx.components.gtm_agents._tool_factory import build_tools_from_keys
from lfx.base.models.unified_models import (
    get_language_model_options,
    get_llm,
    update_model_options_in_build_config,
)
from lfx.inputs.inputs import (
    DataInput,
    DropdownInput,
    MessageTextInput,
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message

# FULL_SYSTEM_PROMPT — uncomment when you have a bigger model
# DEFAULT_SYSTEM_PROMPT = """You are an expert B2B intent signal analyst with access to search and enrichment tools.
# Your job is to detect buying signals and score purchase intent for target companies — using REAL-TIME data from the web.
#
# ## CRITICAL RULES
# 1. NEVER fabricate signals. Every signal must come from a tool result with a source.
# 2. Search aggressively — use multiple queries per company to find signals.
# 3. Recency matters: signals from the last 3 months are HOT, 3-6 months are WARM, older is COLD.
# 4. Score based on evidence, not assumptions.
#
# ## BUYING SIGNALS TO DETECT
#
# ### Tier 1 — High Intent (25 points each)
# - **Funding Event:** Company raised a new round (search: "[company] raises funding 2025 2026")
# - **Leadership Hire:** Hired VP/Head of Sales, Marketing, RevOps, Growth (search: "[company] hires VP" or check job boards)
# - **Tech Stack Change:** Adopted or dropped a relevant tool (search or use enrichment data)
# - **Expansion Signal:** Opening new offices, entering new markets, international expansion
#
# ### Tier 2 — Medium Intent (15 points each)
# - **Hiring Surge:** Multiple open roles in sales, marketing, or engineering
# - **Product Launch:** New product or feature announcement
# - **Partnership/Integration:** Strategic partnership announcement
# - **Industry Event:** Speaking at or sponsoring relevant conferences
#
# ### Tier 3 — Low Intent (5 points each)
# - **Content Activity:** Publishing blog posts, case studies, thought leadership
# - **Social Activity:** Active LinkedIn posting from leadership
# - **Press Coverage:** Featured in industry publications
# - **Award/Recognition:** Named in a list or received an award
#
# ## SCORING FRAMEWORK
# - **90-100 (On Fire):** Multiple Tier 1 signals in last 3 months → IMMEDIATE outbound
# - **70-89 (Hot):** At least one Tier 1 signal + supporting signals → Priority outbound
# - **50-69 (Warm):** Multiple Tier 2 signals, no Tier 1 → Sequence & nurture
# - **30-49 (Cool):** Only Tier 3 signals → Monitor and wait
# - **0-29 (Cold):** No meaningful signals found → Deprioritize
#
# ## SOCIAL SIGNAL DETECTION (if Apify tools are connected)
# If any Apify actor tools are available (tool names starting with "apify_actor_"), use them for deeper signal detection:
#
# **LinkedIn Posts from Company Leaders:**
# - If you have an Apify LinkedIn posts scraper, scrape posts from the company's leadership
# - Call it with: `{"targetUrls": ["https://www.linkedin.com/in/CEO_USERNAME"]}` or check tool schema
# - Look for: hiring announcements, product launches, fundraising celebrations, pain point discussions
# - A CEO posting about scaling challenges = hot buying signal
#
# **LinkedIn Company Profile:**
# - If you have a LinkedIn profile scraper, pull leadership profiles
# - Look for: recent role changes, employee count growth, new hires in target departments
#
# **Instagram (for B2C/D2C companies):**
# - If you have an Instagram scraper, check company/founder accounts
# - Look for: product launches, brand campaigns, growth indicators
#
# **IMPORTANT:** Apify tools auto-discover their input schema — check each tool's description for exact field names.
# If no Apify tools are connected, rely on web search only.
#
# ## RESEARCH WORKFLOW
#
# For EACH company:
# 1. Search for recent news, funding, and announcements (multiple queries)
# 2. Search for hiring activity and leadership changes
# 3. If Apify tools are connected, scrape LinkedIn profiles/posts for real-time social signals
# 4. If enrichment tools are available, pull company data for growth signals
# 5. Search for product launches and partnerships
# 6. Score based on findings
#
# ## OUTPUT FORMAT
#
# ### Company: [Name] | Domain: [domain.com]
# **Intent Score:** [0-100] | **Rating:** [On Fire/Hot/Warm/Cool/Cold]
# **Recommended Action:** [Immediate Outbound / Priority Sequence / Nurture / Monitor / Skip]
#
# **Signals Detected:**
# | Signal | Type | Tier | Recency | Source |
# |--------|------|------|---------|--------|
# | Raised $50M Series C | Funding Event | T1 | 2 months ago | TechCrunch |
# | Hiring 5 SDRs | Hiring Surge | T2 | Current | LinkedIn |
#
# **Signal Summary:** [2-3 sentence narrative of what the signals mean for outbound timing]
#
# ---
#
# ## INTENT SUMMARY
# At the end, provide:
# - Companies analyzed: X
# - On Fire (90+): X companies → [names]
# - Hot (70-89): X companies → [names]
# - Warm (50-69): X companies → [names]
# - Cold (<50): X companies
# - Top recommendation: "Reach out to [company] first because [specific signal]"
#
# Prioritize thoroughness — missing a hot signal is worse than spending an extra search."""

DEFAULT_SYSTEM_PROMPT = """You are an intent signal analyst. Detect buying signals for target companies using your tools.

SIGNALS TO FIND (search for each company):
- Funding events (25pts), Leadership hires (25pts), Tech stack changes (25pts)
- Hiring surges (15pts), Product launches (15pts), Partnerships (15pts)
- Content activity (5pts), Press coverage (5pts)

SCORING: 90-100=On Fire, 70-89=Hot, 50-69=Warm, 30-49=Cool, 0-29=Cold
STRICT: Do NOT search more than 2 times per company. Score based on what you find.

OUTPUT per company: Intent Score, Rating, Signals found with sources, Recommended action.
End with ranked summary. Search immediately, use multiple queries per company."""


class IntentSignalAgentComponent(LCToolsAgentComponent):
    display_name = "Intent Signal Scorer"
    description = (
        "Detects real-time buying signals — funding events, leadership hires, tech stack changes, "
        "hiring surges — and scores purchase intent 0-100 to prioritize outbound timing."
    )
    icon = "Zap"
    name = "IntentSignalAgent"

    inputs = [
        *LCToolsAgentComponent.get_base_inputs(),
        ModelInput(
            name="model",
            display_name="Language Model",
            info="Select your model provider (supports OpenAI, Anthropic, Groq, Google, Ollama, etc.)",
            real_time_refresh=True,
            required=True,
        ),
        SecretStrInput(
            name="api_key",
            display_name="API Key",
            info="Model Provider API key",
            real_time_refresh=True,
            advanced=True,
        ),
        SecretStrInput(
            name="tavily_api_key",
            display_name="Tavily API Key",
            info="Tavily key — AI-powered web search for company research. Get it at tavily.com.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="apollo_api_key",
            display_name="Apollo API Key",
            info="Apollo.io key — enables people search and company enrichment. Get it at app.apollo.io → Settings → API Keys.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="firecrawl_api_key",
            display_name="Firecrawl API Key",
            info="Firecrawl key — scrapes web pages (team pages, about pages). Get it at firecrawl.dev.",
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="target_companies",
            display_name="Target Companies",
            info=(
                "Companies to analyze for buying signals. One per line with domain.\n"
                "Example:\nRamp (ramp.com)\nBrex (brex.com)\nStripe (stripe.com)"
            ),
            required=True,
            tool_mode=True,
        ),
        MultilineInput(
            name="signal_context",
            display_name="Signal Context (Optional)",
            info=(
                "What are you selling? This helps prioritize relevant signals. "
                "E.g., 'We sell sales automation software' — then hiring SDRs is a stronger signal."
            ),
            required=False,
        ),
        DropdownInput(
            name="signal_recency",
            display_name="Signal Recency Window",
            info="How far back to look for signals",
            options=["Last 30 days", "Last 90 days", "Last 6 months", "Last 12 months"],
            value="Last 90 days",
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the intent scoring behavior.",
            value=DEFAULT_SYSTEM_PROMPT,
            advanced=True,
        ),
        DataInput(
            name="chat_history",
            display_name="Chat Memory",
            is_list=True,
            advanced=True,
            info="Chat history for multi-turn conversations.",
        ),
    ]

    outputs = [
        Output(display_name="Intent Report", name="response", method="message_response"),
    ]

    def _get_llm(self):
        return get_llm(
            model=self.model,
            user_id=self.user_id,
            api_key=getattr(self, "api_key", None),
        )

    def update_build_config(self, build_config: dict, field_value: str, field_name: str | None = None) -> dict:
        def get_tool_calling_model_options(user_id=None):
            return get_language_model_options(user_id=user_id, tool_calling=True)

        return update_model_options_in_build_config(
            component=self,
            build_config=build_config,
            cache_key_prefix="language_model_options_tool_calling",
            get_options_func=get_tool_calling_model_options,
            field_name=field_name,
            field_value=field_value,
        )

    def get_chat_history_data(self) -> list[Data] | None:
        return self.chat_history

    def create_agent_runnable(self):
        llm = self._get_llm()
        self.max_iterations = 12

        target_companies = self.target_companies or ""
        signal_context = getattr(self, "signal_context", "") or ""
        recency = getattr(self, "signal_recency", "Last 90 days") or "Last 90 days"

        # Pipeline mode: if target_companies is empty, use chat input
        if not target_companies.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                target_companies = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                target_companies = self.input_value

        context_section = f"\nProduct Context: {signal_context}" if signal_context.strip() else ""

        self.input_value = Message(
            text=f"Analyze these companies for buying signals and score their purchase intent:\n\n"
            f"{target_companies}\n\n"
            f"Signal Window: {recency}{context_section}"
        )

        self.system_prompt = (
            f"{self.system_prompt}\n\n"
            f"## Configuration\n"
            f"- Signal Recency Window: {recency}\n"
            f"- Product Context: {signal_context if signal_context.strip() else 'General B2B'}\n"
        )

        # Auto-create tools from API keys provided on this component
        auto_tools = build_tools_from_keys(
            tavily_api_key=getattr(self, "tavily_api_key", "") or "",
            apollo_api_key=getattr(self, "apollo_api_key", "") or "",
            firecrawl_api_key=getattr(self, "firecrawl_api_key", "") or "",
            include_duckduckgo=True,
            include_apollo_org=True,
        )
        # Merge auto-tools into self.tools so AgentExecutor also sees them
        if auto_tools:
            self.tools = list(self.tools or []) + auto_tools

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
