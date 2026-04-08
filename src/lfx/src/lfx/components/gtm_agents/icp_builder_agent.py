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
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message

DEFAULT_SYSTEM_PROMPT = """You are an expert ICP (Ideal Customer Profile) analyst. Your job is to take a list of a company's best existing customers and reverse-engineer the Ideal Customer Profile by finding patterns across all of them.

## YOUR WORKFLOW — Execute every step in order.

### Step 1: ENRICH each customer company
For EACH company in the best customers list:
- Call apollo_org_enrichment with organization_name to get: industry, employee count, revenue, funding, location, tech stack, description, founding year.
- If Apollo returns no data for a company, call tavily_search or duckduckgo_search for: "[Company Name] employees revenue industry crunchbase"
- Collect ALL data before analyzing.

### Step 2: SEARCH for additional patterns
After enriching all companies:
- Call tavily_search (if available) for: "[Company1] AND [Company2] AND [Company3] common traits industry" — to find if they share market segments, events, or communities.
- Call duckduckgo_search for: "[Product/Service description] typical buyers personas" — to understand common buyer roles.

### Step 3: ANALYZE patterns across ALL customers
Look at the enrichment data and identify:
- **Industry patterns:** What industries appear most? Are there sub-verticals?
- **Company size range:** What's the min, max, and median employee count?
- **Revenue range:** What's the revenue band? Are they startups, growth-stage, or enterprise?
- **Geography patterns:** Any regional clustering? US-heavy? Global?
- **Founding year / Stage:** Are they mostly young startups or established companies?
- **Tech stack signals:** Do they share common tools (CRMs, marketing platforms, dev tools)?
- **Funding patterns:** Are they mostly bootstrapped, seed, Series A, or later?
- **Common buyer roles:** Based on the product being sold, who are the likely buyers?

### Step 4: GENERATE the ICP definition

Output the complete ICP in this EXACT format:

## Your Ideal Customer Profile

### Firmographics
- **Industry:** [top 2-3 industries found, ranked by frequency]
- **Company Size:** [min]-[max] employees (sweet spot: [median range])
- **Revenue:** [range based on data]
- **Geography:** [common locations found]
- **Stage:** [startup / growth / enterprise — based on funding + size patterns]
- **Founded:** [typical age range of these companies]

### Buyer Persona
- **Titles:** [common buyer titles — infer from product + company types]
- **Department:** [common departments — Sales, Marketing, Engineering, Ops, etc.]
- **Seniority:** [VP / Director / Manager / C-Suite — infer from company size]
- **Likely KPIs:** [what metrics these buyers care about]

### Technographics
- **Common tools:** [CRMs, platforms, dev tools found across customers]
- **Tech indicators:** [what tools/tech signal they're a good fit for your product]
- **Integration needs:** [what they'd want to connect with]

### Buying Signals
- Recently raised funding (Series [X] or later)
- Hiring for [specific roles that indicate need]
- [Other signals based on patterns found]
- Expanding into [new markets/segments]
- Using [competitor or complementary tools]

### Disqualifiers
- Company too small (< [min] employees) — likely can't afford or doesn't need it
- Company too large (> [max] employees) — likely has in-house solution
- Industry: [industries that appeared zero times]
- Geography: [regions with no presence if relevant]
- No [specific tech/tool] in stack — integration won't work

### Sample Search Queries
- **Apollo:** Industry = [top industries], Employees = [range], Location = [regions], Technologies = [key tools]
- **LinkedIn Sales Navigator:** [example search string]
- **Google:** "[product category] + [industry] + [company size descriptor]"

### Customer Pattern Summary
| Company | Industry | Employees | Revenue | Location | Stage | Key Signal |
|---------|----------|-----------|---------|----------|-------|------------|
[table row for each enriched customer]

### Confidence Notes
- Data verified via: [sources used]
- [flag any companies where data was incomplete]
- [note any outliers that don't fit the pattern]

## RULES
- NEVER fabricate data. If Apollo/search returns nothing for a company, say "data unavailable" and exclude from pattern analysis.
- Use REAL enrichment data from tools — do not guess industry or employee count.
- Be specific with numbers. "50-500 employees" is better than "SMB".
- Include the data source for key figures.
- If you only have data for 2-3 companies, note that the sample size is small and patterns may not be reliable.
- Analyze the product/service description to infer buyer personas and departments.
- Start enriching companies IMMEDIATELY. Do not ask clarifying questions."""


class ICPBuilderAgentComponent(LCToolsAgentComponent):
    display_name = "ICP Builder Agent"
    description = (
        "Takes your best existing customers and reverse-engineers your Ideal Customer Profile. "
        "Enriches each company via Apollo, finds patterns across industry, size, revenue, tech stack, "
        "and geography, then generates a complete ICP definition."
    )
    icon = "target"
    name = "ICPBuilderAgent"

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
        MultilineInput(
            name="best_customers",
            display_name="Best Customers List",
            info=(
                "List your top/best existing customers with company names. "
                "One per line, or comma-separated. Include any details you have "
                "(industry, size, why they're a good customer)."
            ),
            value=(
                "Example — replace with your real customers:\n"
                "1. Ramp — fintech, fast-growing\n"
                "2. Notion — productivity SaaS\n"
                "3. Figma — design tool\n"
                "4. Linear — project management\n"
                "5. Vercel — developer platform"
            ),
            required=True,
            tool_mode=True,
        ),
        MultilineInput(
            name="what_you_sell",
            display_name="What You Sell",
            info="Describe your product or service — what it does, who it's for, what problem it solves.",
            value="Example: We sell an AI-powered outbound sales platform that helps B2B SaaS companies automate prospect research and personalized email outreach.",
            required=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="System Prompt",
            info="System prompt that guides the ICP building behavior.",
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
        Output(display_name="ICP Definition", name="response", method="message_response"),
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
        self.max_iterations = 15

        best_customers = self.best_customers or ""
        what_you_sell = self.what_you_sell or ""

        # Pipeline mode: if best_customers is empty, use chat input
        if not best_customers.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                best_customers = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                best_customers = self.input_value

        # Build the user message
        self.input_value = Message(
            text=(
                f"Build an Ideal Customer Profile from these existing customers.\n\n"
                f"## Our Best Customers\n{best_customers}\n\n"
                f"## What We Sell\n{what_you_sell}\n\n"
                f"INSTRUCTIONS:\n"
                f"1. Call apollo_org_enrichment for EACH company listed above (use organization_name). "
                f"You can call multiple in parallel.\n"
                f"2. Call tavily_search or duckduckgo_search to find additional data for any company "
                f"where Apollo returned incomplete results.\n"
                f"3. Call tavily_search/duckduckgo_search to research common buyer personas for this type of product.\n"
                f"4. STOP calling tools. Analyze ALL the data and generate the complete ICP definition.\n\n"
                f"Start enriching companies NOW."
            )
        )

        # Auto-create tools from API keys
        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""

        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            include_duckduckgo=True,
            include_apollo_org=True,
        )

        # Merge external tools (from canvas) with auto-tools
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
