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


DEFAULT_SYSTEM_PROMPT = """You are a meeting preparation analyst for B2B sales teams. Your job is to build a comprehensive meeting brief so the rep walks into every call fully prepared.

TOOL USAGE RULES:
- apollo_people_enrichment: Use first_name, last_name, and organization_name (NOT domain). Example: first_name="Sarah", last_name="Chen", organization_name="Ramp"
- apollo_org_enrichment: Use organization_name (NOT domain). Example: organization_name="Ramp"
- hunter_email_finder: Use first_name, last_name, and domain. Guess the domain from company name.
- tavily_search: Use for company news, funding, product launches, competitive intel.
- duckduckgo_search: Use for the prospect's recent activity, blog posts, podcast appearances, LinkedIn posts.

WORKFLOW — Follow this exact sequence:
Step 1: Call apollo_people_enrichment to get the prospect's profile (title, seniority, background)
Step 2: Call apollo_org_enrichment to get company data (size, revenue, industry, funding)
Step 3: Call tavily_search for: "[Company Name] news funding product launch 2024 2025"
Step 4: Call duckduckgo_search for: "[Prospect Name] [Company Name] interview podcast blog post LinkedIn"
Step 5: If Hunter key is available, call hunter_email_finder to verify their email
Step 6: STOP calling tools. Write the meeting brief.

MEETING TYPE ADAPTATION:
- Discovery Call: Focus on pain points, open-ended questions, qualification criteria
- Demo: Focus on their specific use case, features that matter, competitive positioning
- Follow-Up: Focus on previous discussion recap, next steps, objection handling
- Negotiation: Focus on decision criteria, budget signals, competitive alternatives, urgency levers
- Renewal: Focus on usage data, ROI delivered, expansion opportunities, risk signals

OUTPUT FORMAT — You MUST produce this complete brief:

## Meeting Brief: [Prospect Name] at [Company Name]
**Meeting Type:** [type]
**Prepared:** [today's date]

### 1. Prospect Snapshot
- **Name:** [full name]
- **Title:** [title]
- **Seniority:** [level]
- **Email:** [email if found]
- **LinkedIn:** [URL if available]
- **Background:** [2-3 sentence summary of career trajectory]
- **Likely Priorities:** [3-4 things they probably care about based on role]

### 2. Company Snapshot
- **Company:** [name]
- **Industry:** [industry]
- **Employees:** [count]
- **Revenue:** [if available]
- **Funding:** [stage and recent rounds]
- **Recent News:** [2-3 bullet points with sources]
- **Key Signals:** [hiring, expansion, product launches]

### 3. Talking Points
[3-5 specific talking points tailored to their situation. Reference real data points — company size, recent funding, industry challenges. NOT generic.]

### 4. Discovery Questions
[5 questions tailored to the meeting type and the prospect's specific situation. Each should uncover pain, budget, timeline, or decision process.]

### 5. Potential Objections & Rebuttals
[3-4 objections they might raise based on their company size, industry, or competitive landscape. Include a suggested response for each.]

### 6. Competitive Intel
[If they're likely evaluating alternatives, list probable competitors and key differentiators. If no competitive signals found, note that.]

### 7. Recommended Agenda
[A suggested agenda for the meeting type, with time allocations. E.g., "0-5 min: Rapport / 5-20 min: Discovery / 20-30 min: Next Steps"]

### 8. Sources
[List all data sources used: Apollo, Hunter, Tavily, DuckDuckGo — with key URLs]

CRITICAL: Never leave sections empty. If data is unavailable, note what's missing and suggest how the rep can find it. Always include the email if any tool found it."""


class MeetingPrepAgentComponent(LCToolsAgentComponent):
    display_name = "Meeting Prep Agent"
    description = (
        "Preps sales reps for every call with a complete meeting brief: prospect snapshot, company intel, "
        "talking points, discovery questions, objection rebuttals, and a recommended agenda."
    )
    icon = "calendar"
    name = "MeetingPrepAgent"

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
            name="hunter_api_key",
            display_name="Hunter API Key",
            info="Hunter.io key — finds emails by company domain. Get it at hunter.io/api-keys.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="prospect_name",
            display_name="Prospect Name",
            info="Full name of the person you're meeting with.",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="company_name",
            display_name="Company Name",
            info="Company the prospect works at.",
            required=True,
            tool_mode=True,
        ),
        DropdownInput(
            name="meeting_type",
            display_name="Meeting Type",
            info="Type of meeting — adjusts the brief's focus and recommended agenda.",
            options=["Discovery Call", "Demo", "Follow-Up", "Negotiation", "Renewal"],
            value="Discovery Call",
        ),
        MultilineInput(
            name="your_product",
            display_name="Your Product/Service",
            info="What you sell — used to tailor talking points, objection rebuttals, and competitive positioning.",
            required=True,
        ),
        MultilineInput(
            name="previous_notes",
            display_name="Notes from Previous Interactions",
            info="Any context from earlier calls, emails, or CRM notes.",
            required=False,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent's research and brief-writing behavior.",
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
        Output(display_name="Meeting Brief", name="response", method="message_response"),
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
        # People + org + hunter + 2 searches + final answer, with buffer
        self.max_iterations = 12

        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""
        hunter_key = getattr(self, "hunter_api_key", "") or ""

        # Build internal tools from API keys
        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            hunter_api_key=hunter_key,
            include_duckduckgo=not bool(tavily_key),
            include_apollo_org=True,
            include_apollo_people=True,
            include_hunter_finder=True,
        )

        # Merge external tools (from canvas) with internal auto_tools
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        # Build the user query from inputs
        prospect_name = self.prospect_name or ""
        company_name = self.company_name or ""
        meeting_type = getattr(self, "meeting_type", "Discovery Call") or "Discovery Call"
        your_product = getattr(self, "your_product", "") or ""
        previous_notes = getattr(self, "previous_notes", "") or ""

        # Split name for tool hints
        name_parts = prospect_name.strip().split()
        first_name = name_parts[0] if name_parts else ""
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        notes_section = ""
        if previous_notes.strip():
            notes_section = f"\n\n## Notes from Previous Interactions\n{previous_notes}"

        # Build available tools list for the prompt
        available_tools = []
        if apollo_key:
            available_tools.append(
                f'- apollo_people_enrichment(first_name="{first_name}", last_name="{last_name}", '
                f'organization_name="{company_name}")'
            )
            available_tools.append(f'- apollo_org_enrichment(organization_name="{company_name}")')
        if hunter_key:
            available_tools.append(
                f'- hunter_email_finder(first_name="{first_name}", last_name="{last_name}", '
                f'company="{company_name}")'
            )
        if tavily_key:
            available_tools.append(
                f'- tavily_search(query="\\"{company_name}\\" news funding product launch 2024 2025")'
            )
        available_tools.append(
            f'- duckduckgo_search(query="\\"{prospect_name}\\" \\"{company_name}\\" interview podcast blog")'
        )

        tools_hint = "\n".join(available_tools)

        self.input_value = Message(
            text=f"Prepare a complete meeting brief for an upcoming {meeting_type}.\n\n"
            f"## Meeting Details\n"
            f"- **Prospect:** {prospect_name}\n"
            f"- **Company:** {company_name}\n"
            f"- **Meeting Type:** {meeting_type}\n"
            f"- **Our Product/Service:** {your_product}{notes_section}\n\n"
            f"Call these tools in order (copy the exact parameters):\n{tools_hint}\n\n"
            f"IMPORTANT:\n"
            f"- Tailor the brief specifically for a {meeting_type}\n"
            f"- Include the prospect's EMAIL if any tool finds it\n"
            f"- Make talking points specific to their company situation, not generic\n"
            f"- After all tool calls complete, write the full Meeting Brief"
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
