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
    MessageTextInput,
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message


DEFAULT_SYSTEM_PROMPT = """You are a B2B prospect research analyst. Your job is to collect data using the available tools, then write a polished prospect brief.

TOOL USAGE RULES:
- apollo_people_enrichment: Use first_name, last_name, and organization_name (NOT domain). Example: first_name="Vidit", last_name="Paliwal", organization_name="BigStep Technologies"
- apollo_org_enrichment: Use organization_name (NOT domain). Example: organization_name="BigStep Technologies"
- hunter_email_finder: Use first_name, last_name, and domain. Guess the domain from company name (e.g. "bigsteptech.com" for BigStep Technologies).
- Search tools: You may have BOTH tavily_search AND duckduckgo_search. Use them for DIFFERENT queries. ALWAYS use the FULL company name in quotes.
- Call each enrichment tool AT MOST once. You may call search tools TWICE total (one query each, or two on one tool).

WORKFLOW — Follow this exact sequence:
Step 1: Call apollo_people_enrichment to get the prospect's profile
Step 2: Call apollo_org_enrichment to get company data
Step 3: Call hunter_email_finder to verify/find their email
Step 4: Call tavily_search (if available) for: "[Company Name] revenue employees crunchbase tracxn zoominfo" — to VERIFY Apollo's data
Step 5: Call duckduckgo_search (if available) for: "[Company Name] news acquisitions 2024 2025" — for recent signals
  (If only one search tool is available, call it twice with both queries)
Step 6: STOP calling tools. Write the brief below.

IMPORTANT DATA RULES:
- ALWAYS include the prospect's email in the brief. If Apollo found it, use it. If Hunter found it, use it. Include BOTH if different.
- If search results show different revenue/employee numbers than Apollo, mention BOTH and note the discrepancy.
- Apollo data can be outdated — always cross-reference with search results.
- Include LinkedIn URL if found.

MANDATORY OUTPUT — After steps 1-5, you MUST write this as your final message:

## Prospect Brief: [Full Name]

### 1. Role Context
- **Name:** [full name]
- **Email:** [email from Apollo or Hunter — NEVER omit this]
- **LinkedIn:** [URL if available]
- **Title:** [title]
- **Location:** [city, state, country]
- **Department:** [department]
- **Likely KPIs:** [infer 3-4 KPIs from their role]

### 2. Company Overview
- **Company:** [name]
- **Website:** [url]
- **Industry:** [industry]
- **Employees:** [count — note if sources disagree]
- **Founded:** [year]
- **Revenue:** [amount — note source and if sources disagree]
- **Funding:** [stage and details]
- **Description:** [2-3 sentence overview]

### 3. Pain Points & Challenges
[3-5 bullet points — specific to their industry, company size, and role]

### 4. Recent Activity & Signals
[Any news, acquisitions, funding, product launches, hiring signals from search results. Include source URLs.]

### 5. Conversation Starters (Top 5)
[5 personalized openers referencing real data points — be specific, not generic]

### 6. Sources & Confidence
- Person data: [source]
- Company data: [source] — note if cross-verified
- Email: [source and confidence]
- News: [source with URLs]
- ⚠️ Flag any data that could not be verified or where sources disagree

CRITICAL: Never leave the output empty. Never omit the email. Always write the full brief with sources."""


class ProspectResearchAgentComponent(LCToolsAgentComponent):
    display_name = "Prospect Research Agent"
    description = (
        "Given a prospect name and company, uses web search tools to build a comprehensive "
        "prospect brief: role context, pain points, recent activity, tech stack, and conversation starters."
    )
    icon = "search"
    name = "ProspectResearchAgent"

    # Render order in the side panel: keys → prospect inputs → behavior.
    # Anything not listed here is appended at the bottom.
    field_order = [
        # 1. Provider + API keys (top — set these first)
        "model",
        "api_key",
        "tavily_api_key",
        "apollo_api_key",
        "hunter_api_key",
        # 2. Prospect inputs (what the agent works on)
        "prospect_name",
        "company_name",
        "prospect_role",
        "additional_context",
        # 3. Agent behavior (advanced tuning)
        "system_prompt",
        "input_value",
        "max_iterations",
        "tools",
        # Hidden / advanced niceties
        "handle_parsing_errors",
        "verbose",
        "chat_history",
    ]

    inputs = [
        ModelInput(
            name="model",
            display_name="Language Model",
            info="Select your model provider (supports OpenAI, Anthropic, Groq, Google, Ollama, etc.)",
            real_time_refresh=True,
            required=True,
        ),
        SecretStrInput(
            name="api_key",
            display_name="Model Provider API Key",
            info="API key for the selected model provider (OpenAI / Anthropic / etc.). Required.",
            real_time_refresh=True,
            required=True,
        ),
        SecretStrInput(
            name="tavily_api_key",
            display_name="Tavily API Key (optional)",
            info="Enables AI-powered web search for company research. Get it at tavily.com.",
            required=False,
        ),
        SecretStrInput(
            name="apollo_api_key",
            display_name="Apollo API Key (optional)",
            info="Enables people search + company enrichment. Get it at app.apollo.io → Settings → API Keys.",
            required=False,
        ),
        SecretStrInput(
            name="hunter_api_key",
            display_name="Hunter API Key (optional)",
            info="Finds emails by company domain. Get it at hunter.io/api-keys.",
            required=False,
        ),
        MessageTextInput(
            name="prospect_name",
            display_name="Prospect Name",
            info="Full name of the prospect. Leave empty in pipeline mode (reads from upstream agent).",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="company_name",
            display_name="Company Name",
            info="Company the prospect works at. Leave empty in pipeline mode (reads from upstream agent).",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="prospect_role",
            display_name="Prospect Role (optional)",
            info="Known job title or role, if available.",
            required=False,
            tool_mode=True,
        ),
        MultilineInput(
            name="additional_context",
            display_name="Additional Context (optional)",
            info="Any extra info: LinkedIn URL, recent news, industry vertical, etc.",
            required=False,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent. Uses {prospect_name}, {company_name}, {prospect_role}, {additional_context} variables.",
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
        *LCToolsAgentComponent.get_base_inputs(),
    ]

    outputs = [
        Output(display_name="Prospect Brief", name="response", method="message_response"),
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
        # 5 tool calls (people + org + hunter + 2 searches) + final answer, with buffer
        self.max_iterations = 12

        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""
        hunter_key = getattr(self, "hunter_api_key", "") or ""

        # Build internal tools from API keys
        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            hunter_api_key=hunter_key,
            # Only add DDG if no Tavily key AND no external search tool on canvas
            include_duckduckgo=not bool(tavily_key),
            include_apollo_org=True,
            include_apollo_people=True,
            include_hunter_finder=True,
        )

        # Merge external tools (from canvas) with internal auto_tools.
        # Keep BOTH search tools if available — DDG for one task, Tavily for another.
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        # Build the user query from the prospect inputs
        prospect_name = self.prospect_name or ""
        company_name = self.company_name or ""
        prospect_role = getattr(self, "prospect_role", "") or ""
        additional_context = getattr(self, "additional_context", "") or ""

        # Standalone mode: specific prospect provided
        if prospect_name.strip() or company_name.strip():
            # Split name for tool hints
            name_parts = prospect_name.strip().split()
            first_name = name_parts[0] if name_parts else ""
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

            role_line = f"\n- Role: {prospect_role}" if prospect_role.strip() else ""
            context_line = f"\n- Additional Context: {additional_context}" if additional_context.strip() else ""

            # Build available tools list for the prompt — use both search tools
            available_tools = []
            if apollo_key:
                available_tools.append(f"- apollo_people_enrichment(first_name=\"{first_name}\", last_name=\"{last_name}\", organization_name=\"{company_name}\")")
                available_tools.append(f"- apollo_org_enrichment(organization_name=\"{company_name}\")")
            if hunter_key:
                available_tools.append(f"- hunter_email_finder(first_name=\"{first_name}\", last_name=\"{last_name}\", company=\"{company_name}\")")
            # Use Tavily for data verification, DDG for news (or vice versa)
            if tavily_key:
                available_tools.append(f'- tavily_search(query="\"{company_name}\" revenue employees funding crunchbase tracxn zoominfo")')
            available_tools.append(f'- duckduckgo_search(query="\"{company_name}\" news acquisitions funding 2024 2025")')

            tools_hint = "\n".join(available_tools)

            self.input_value = Message(
                text=f"Research this prospect and write a complete prospect brief:\n"
                f"- Name: {prospect_name}\n"
                f"- Company: {company_name}{role_line}{context_line}\n\n"
                f"Call these tools in order (copy the exact parameters):\n{tools_hint}\n\n"
                f"IMPORTANT: Include the prospect's EMAIL in the brief (from Apollo or Hunter). "
                f"Cross-verify Apollo's revenue data with search results — if they disagree, note both figures. "
                f"After all tool calls complete, write the full Prospect Brief."
            )
        # Pipeline mode: don't override input_value — let upstream scored leads flow through

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
