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

# FULL_SYSTEM_PROMPT — uncomment and use as DEFAULT_SYSTEM_PROMPT when you have a bigger model
# """You are an expert B2B market analyst and TAM (Total Addressable Market) strategist with access to search, enrichment, and data tools.
# Your job is to discover, map, and size a total addressable market based on ICP criteria — using REAL data from your tools.
#
# ## CRITICAL RULES
# 1. NEVER guess or fabricate company names, revenue, or employee counts. Use your tools to find real data.
# 2. ALWAYS start by searching immediately. Do NOT respond with text first.
# 3. Use MULTIPLE search queries to maximize coverage — one search is never enough.
# 4. For each company found, attempt enrichment to get verified data.
#
# ## DISCOVERY WORKFLOW
#
# ### Phase 1: Market Search (Cast a Wide Net)
# - Run 3-5 different search queries based on the ICP criteria
# - Vary search terms: industry keywords, company size descriptors, geography, funding stage
# - Example queries: "Series B fintech companies US 2024 2025", "mid-market SaaS companies healthcare", etc.
# - Extract company names and domains from search results
#
# ### Phase 2: Company Enrichment
# - For each discovered company, call enrichment tools (apollo_org_enrichment, pdl_company_enrichment) with the domain
# - Collect: employee count, revenue signals, industry, funding stage, location, tech stack
#
# ### Phase 3: ICP Scoring & Segmentation
# - Score each company against the provided ICP criteria
# - Segment into tiers:
#   - **Tier 1 (90-100):** Perfect ICP fit — prioritize for outbound
#   - **Tier 2 (70-89):** Strong fit — include in pipeline
#   - **Tier 3 (50-69):** Moderate fit — nurture
#   - **Below 50:** Exclude from TAM
#
# ### Phase 4: TAM Calculation
# - Count companies per tier
# - Estimate deal value per tier based on company size
# - Calculate:
#   - **TAM** (Total Addressable Market): All discovered companies x average deal size
#   - **SAM** (Serviceable Addressable Market): Tier 1 + Tier 2 companies x deal size
#   - **SOM** (Serviceable Obtainable Market): Tier 1 companies x deal size x realistic win rate (15-25%)
#
# ### Phase 5: Output
# Present a structured market report with:
# 1. Executive summary (TAM/SAM/SOM numbers)
# 2. Company list with enrichment data, organized by tier
# 3. Market segments and patterns identified
# 4. Recommended outbound targets (Tier 1 companies)
# 5. Data quality notes (which companies had verified vs estimated data)
#
# Be thorough — the more companies you discover and enrich, the more accurate the TAM estimate."""

DEFAULT_SYSTEM_PROMPT = """You are a TAM analyst. Find, enrich, and STRICTLY VALIDATE companies against the ICP.

CRITICAL RULES:
- You may search up to 5 times to find enough companies. Use VARIED search queries each time.
- You MUST call apollo_org_enrichment (with the company domain) for EVERY company you find. Do NOT skip enrichment.
- After enrichment, you MUST CHECK the real data against EVERY ICP constraint (employee count, funding stage, geography, industry). If a company VIOLATES any hard constraint, DISCARD it — do NOT include it in the report.
- NEVER guess or fabricate data. If enrichment returns no data, discard the company.
- If Apollo returns a wrong company (e.g. different industry, different country), discard it.
- After enrichment + validation, write your final report. Do NOT search again after that.

WORKFLOW:
1. SEARCH: Run 3-5 different search queries to find companies matching the ICP. Vary terms: try industry keywords, "Series A/B/C", employee range, geography, competitor lists, funding announcements.
2. ENRICH: For each company found, call apollo_org_enrichment with their website domain (e.g. "qualified.com"). If Apollo has no data, try pdl_company_enrichment.
3. VALIDATE: After enrichment, check EACH company against the ICP hard constraints:
   - Employee count within the specified range? If ICP says 50-500 and company has 1500 → DISCARD.
   - Funding stage matches? If ICP says Series A-C and company is Series E → DISCARD.
   - Geography matches? If ICP says US and company is in Canada → DISCARD.
   - Industry matches? If ICP says B2B SaaS and company is an agency/consultancy → DISCARD.
   Mark each company as PASS or FAIL with the reason.
4. SCORE: If UPSTREAM ICP SCORES are provided, use those scores as-is — do NOT re-score. Otherwise, score ONLY companies that PASSED validation, 0-100 against ICP fit. Tier 1: 80+, Tier 2: 60-79, Tier 3: 40-59.
5. REPORT: List all validated companies with enrichment data sorted by score. Then calculate:
   - TAM = total validated companies x deal size
   - SAM = Tier 1 + Tier 2 companies x deal size
   - SOM = Tier 1 companies x deal size x 20%
   Also list discarded companies with the reason they failed validation.

OUTPUT FORMAT:
## Validated Companies (sorted by score)
For each: Company Name | Website | Industry | Employees | Funding Stage | Location | Score | Tier

## Discarded Companies
For each: Company Name | Reason for discard

## TAM/SAM/SOM
TAM: $X (N companies x $deal_size)
SAM: $X (N Tier 1+2 x $deal_size)
SOM: $X (N Tier 1 x $deal_size x 20%)"""


class TAMDiscoveryAgentComponent(LCToolsAgentComponent):
    display_name = "TAM Discovery Agent"
    description = (
        "Discovers and maps your Total Addressable Market — searches for companies matching your ICP, "
        "enriches them with real data, segments into tiers, and calculates TAM/SAM/SOM."
    )
    icon = "Globe"
    name = "TAMDiscoveryAgent"

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
            name="pdl_api_key",
            display_name="PDL API Key",
            info="People Data Labs key — enriches contacts with phone numbers and emails from 2.8B+ profiles. Get it at dashboard.peopledatalabs.com.",
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="icp_criteria",
            display_name="ICP Criteria",
            info="Define your Ideal Customer Profile for TAM discovery — industry, company size, geography, funding stage, tech stack, etc.",
            value=(
                "Industry: B2B SaaS\n"
                "Company Size: 50-500 employees\n"
                "Funding Stage: Series A to Series C\n"
                "Geography: United States\n"
                "Signals: Recently hired sales/marketing roles, using CRM tools"
            ),
            required=True,
        ),
        MessageTextInput(
            name="average_deal_size",
            display_name="Average Deal Size ($)",
            info="Estimated average annual contract value for TAM calculation",
            value="25000",
            required=True,
        ),
        DropdownInput(
            name="market_scope",
            display_name="Market Scope",
            info="How broad should the search be?",
            options=["Focused (20-30 companies)", "Standard (30-50 companies)", "Broad (50-100 companies)"],
            value="Standard (30-50 companies)",
        ),
        MultilineInput(
            name="upstream_icp_scores",
            display_name="ICP Scores (from upstream agent)",
            info=(
                "Optional — connect ICP Scoring Agent's output here. "
                "If provided, TAM Discovery skips its own scoring and uses these scores directly."
            ),
            required=False,
            tool_mode=True,
        ),
        MultilineInput(
            name="exclusions",
            display_name="Exclusions (Optional)",
            info="Companies or segments to exclude from TAM analysis",
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the TAM discovery behavior.",
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
        Output(display_name="TAM Report", name="response", method="message_response"),
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
        self.max_iterations = 12  # GTM agents need more steps for search → enrich → score pipeline

        icp_criteria = self.icp_criteria or ""
        deal_size = self.average_deal_size or "25000"
        scope = getattr(self, "market_scope", "Standard (30-50 companies)") or "Standard (30-50 companies)"
        exclusions = getattr(self, "exclusions", "") or ""
        upstream_scores = getattr(self, "upstream_icp_scores", "") or ""

        exclusion_section = f"\n\nExclusions: {exclusions}" if exclusions.strip() else ""

        if upstream_scores.strip():
            score_section = (
                f"\n\n## UPSTREAM ICP SCORES (from ICP Scoring Agent)\n"
                f"An upstream ICP Scoring Agent has already scored and validated these companies. "
                f"DO NOT re-score them. Use these scores as-is for tiering and TAM calculation. "
                f"Only enrich companies that are missing data.\n\n{upstream_scores}"
            )
        else:
            score_section = ""

        self.system_prompt = (
            f"{self.system_prompt}{exclusion_section}{score_section}\n\n"
            f"## TAM Parameters\n"
            f"- Average Deal Size: ${deal_size}/year\n"
            f"- Market Scope: {scope}\n"
            f"- ICP Criteria:\n{icp_criteria}\n"
        )

        # Auto-create tools from API keys provided on this component
        auto_tools = build_tools_from_keys(
            tavily_api_key=getattr(self, "tavily_api_key", "") or "",
            apollo_api_key=getattr(self, "apollo_api_key", "") or "",
            pdl_api_key=getattr(self, "pdl_api_key", "") or "",
            include_duckduckgo=True,
            include_apollo_org=True,
            include_pdl_company=True,
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
