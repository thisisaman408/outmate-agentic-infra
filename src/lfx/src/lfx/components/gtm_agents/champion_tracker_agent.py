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


DEFAULT_SYSTEM_PROMPT = """You are a champion tracking analyst for B2B sales teams. Your job is to monitor key contacts ("champions") who previously bought from or advocated for our product, and detect when they change jobs so we can follow them to their new company.

TOOL USAGE RULES:
- apollo_people_enrichment: Use first_name, last_name, and organization_name (the LAST KNOWN company). Example: first_name="Sarah", last_name="Chen", organization_name="Ramp"
- apollo_org_enrichment: Use organization_name (NOT domain). Only call this for NEW companies (when a champion has moved). Example: organization_name="Stripe"
- tavily_search: Best for finding job change announcements. Search: "[Name] [Last Company] new role OR joined OR appointed OR hired 2024 2025"
- duckduckgo_search: Best for LinkedIn-style results. Search: "[Name] [Last Company] OR [Name] new position"

WORKFLOW — For EACH champion in the list:
Step 1: Call tavily_search for: "[Name] [Last Known Company] new role OR left OR joined 2024 2025"
Step 2: Call apollo_people_enrichment with first_name, last_name, organization_name=[Last Known Company]
Step 3: Compare the Apollo result with the last known role/company:
  - If Apollo shows a DIFFERENT company → the champion has moved!
  - If Apollo shows the SAME company but a different title → they got promoted
  - If Apollo shows the same role and company → no change detected
Step 4: If the champion CHANGED companies, call apollo_org_enrichment for the NEW company to assess fit
Step 5: If you need more context, call duckduckgo_search: "[Name] [New Company] announcement"

IMPORTANT:
- Process ALL champions in the list. Do not stop after the first one.
- You can batch similar searches if it saves tool calls (e.g., search for multiple names in one query).
- If Apollo returns no data for a person, rely on search results.
- Be conservative with status — only mark CHANGED_COMPANY if you have strong evidence.

STATUS DEFINITIONS:
- SAME_ROLE: Still at the same company in the same (or very similar) role. No action needed.
- PROMOTED: Same company but a more senior title. Good signal — they have more buying power now.
- CHANGED_COMPANY: Confirmed at a new company. High priority — reach out immediately.
- LEFT: Evidence they left the old company but no confirmed new role. Monitor.

ICP FIT ASSESSMENT (for job changers):
When a champion moves to a new company, assess whether the new company is a good fit:
- Company size (employees)
- Industry relevance
- Funding stage
- Geography
Rate as: Strong Fit / Moderate Fit / Weak Fit / Unknown

OUTPUT FORMAT:
## Champion Tracking Report

### Summary
- **Total Champions Tracked:** [count]
- **Job Changes Detected:** [count]
- **Promotions Detected:** [count]
- **Immediate Outreach Recommended:** [count]

---

### [Champion Name]
- **Status:** [SAME_ROLE / CHANGED_COMPANY / PROMOTED / LEFT]
- **Previous:** [role] at [company]
- **Current:** [role] at [company]
- **Evidence:** [what data source confirmed this]
- **New Company Fit:** [Strong Fit / Moderate Fit / Weak Fit / N/A] (only if changed)
- **Recommended Action:** [Reach Out / Monitor / Skip / Congratulate on Promotion]
- **Suggested Opener:** [A personalized message referencing the move or promotion]
- **Sources:** [Apollo, Tavily, DuckDuckGo — note which data came from where]

---

[Repeat for each champion]

### Action Items
[Prioritized list of recommended actions across all champions]

CRITICAL: Process EVERY champion in the list. Never skip one. If you cannot find data, say so — do not make up information."""


class ChampionTrackerAgentComponent(LCToolsAgentComponent):
    display_name = "Champion Tracker Agent"
    description = (
        "Tracks when key contacts change jobs so you can follow them to their new company. "
        "Detects job changes, promotions, and departures, then assesses new company fit."
    )
    icon = "users"
    name = "ChampionTrackerAgent"

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
            name="champions_list",
            display_name="Champions List",
            info=(
                "List of champions to track. One per line, format: Name, Last Known Company, Last Known Role. "
                "Example:\nSarah Chen, Ramp, VP of Sales\nJohn Smith, Stripe, Head of Growth"
            ),
            required=True,
            tool_mode=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent's tracking behavior.",
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
        Output(display_name="Tracking Report", name="response", method="message_response"),
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
        # Multiple champions to check: search + people enrichment per champion + org enrichment for changers
        self.max_iterations = 15

        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""

        # Build internal tools from API keys
        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            include_duckduckgo=not bool(tavily_key),
            include_apollo_org=True,
            include_apollo_people=True,
        )

        # Merge external tools (from canvas) with internal auto_tools
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        champions_list = self.champions_list or ""

        # Parse champions to build tool hints
        champions = []
        for line in champions_list.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 2:
                champions.append({
                    "name": parts[0],
                    "company": parts[1],
                    "role": parts[2] if len(parts) > 2 else "",
                })

        # Build tool hints for first few champions
        tool_hints = []
        for champ in champions[:5]:
            name_parts = champ["name"].split()
            first = name_parts[0] if name_parts else ""
            last = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
            if tavily_key:
                tool_hints.append(
                    f'- tavily_search(query="\\"{champ["name"]}\\" \\"{champ["company"]}\\" '
                    f'new role OR left OR joined 2024 2025")'
                )
            else:
                tool_hints.append(
                    f'- duckduckgo_search(query="\\"{champ["name"]}\\" \\"{champ["company"]}\\" '
                    f'new role OR left OR joined")'
                )
            if apollo_key:
                tool_hints.append(
                    f'- apollo_people_enrichment(first_name="{first}", last_name="{last}", '
                    f'organization_name="{champ["company"]}")'
                )

        hints_text = "\n".join(tool_hints) if tool_hints else "(Use available search and enrichment tools)"

        self.input_value = Message(
            text=f"Track the following champions and detect any job changes, promotions, or departures.\n\n"
            f"## Champions to Track\n{champions_list}\n\n"
            f"Suggested tool calls for the first champions:\n{hints_text}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. For EACH champion: search for their name + last known company to detect changes\n"
            f"2. Use Apollo people enrichment to verify current role and company\n"
            f"3. If they CHANGED companies, call apollo_org_enrichment on the NEW company\n"
            f"4. Compare current data vs last known data to determine status\n"
            f"5. After processing ALL champions, write the complete Champion Tracking Report\n"
            f"6. Prioritize outreach recommendations for job changers"
        )

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
