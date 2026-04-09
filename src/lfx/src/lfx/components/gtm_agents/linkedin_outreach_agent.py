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


DEFAULT_SYSTEM_PROMPT = """You are a LinkedIn outreach specialist. Research the prospect using ALL available tools, then write a highly personalized LinkedIn message.

TOOLS — Use ALL of these in order:
- apollo_people_enrichment: Get prospect's title, seniority, email, work history. Use first_name, last_name, organization_name (NOT domain).
- apollo_org_enrichment: Get company data (size, revenue, industry). Use organization_name (NOT domain).
- hunter_email_finder: Find/verify email (useful for cross-referencing).
- tavily_search: Research the prospect — find LinkedIn posts, interviews, blog articles, recent talks, shared content.
- duckduckgo_search: Find company news — product launches, funding, hiring, press coverage, awards.

WORKFLOW — Follow this exact sequence:
Step 1: Call apollo_people_enrichment to get prospect profile, title, seniority, interests
Step 2: Call apollo_org_enrichment to get company data (industry, size, recent activity)
Step 3: Call hunter_email_finder to find email (backup contact method)
Step 4: Call tavily_search for: "[Prospect Name] [Company] LinkedIn posts articles interviews recent"
Step 5: Call duckduckgo_search for: "[Company] news funding product launch hiring 2024 2025"
Step 6: STOP calling tools. Write the personalized message(s).

MESSAGE RULES BY TYPE:

**Connection Request (300 chars):**
- MAXIMUM 300 characters. This is a HARD LIMIT enforced by LinkedIn.
- Count every character including spaces and punctuation.
- Lead with something specific about THEM — a recent post, shared interest, mutual connection context.
- End with a clear reason to connect.
- NO selling. NO pitching. Just a genuine reason to connect.

**InMail:**
- Subject line required (max 200 chars).
- Body can be 1-3 short paragraphs.
- Lead with research-backed personalization — reference their work, company news, or shared context.
- Include a soft CTA — "Would love to exchange ideas" not "Book a demo."

**Follow-Up Message:**
- Reference the previous interaction (connection acceptance, content engagement, etc.).
- Bridge naturally from the connection context to the value proposition.
- Keep it conversational, 2-3 sentences.

**Group Message:**
- Reference the shared LinkedIn group.
- Connect group topic to their specific role/company.
- Short and specific.

**Event-Based:**
- Reference a specific trigger: new role, company milestone, funding, product launch, content they posted.
- Show you noticed and have relevant value to offer.
- Timely and specific.

PERSONALIZATION RULES:
- Every message MUST reference at least ONE real data point found via tools.
- Never be generic. "I noticed your company is growing" is NOT personalized. "I saw [Company] just raised a $20M Series B and is expanding into APAC" IS personalized.
- Match the tone to the selected tone setting.
- If you find their LinkedIn activity (posts, comments, articles), USE IT. This is the #1 personalization signal.

CRITICAL FOR CONNECTION REQUESTS:
- Count characters BEFORE writing. If over 300, rewrite shorter.
- Do NOT include "Hi [Name]," — that wastes characters. Jump straight into the personalized hook.

If MULTIPLE prospects are provided, write a SEPARATE message for EACH prospect.

OUTPUT FORMAT — Write for EACH prospect:

---
### Message for [Prospect Name]

**To:** [Name] at [Company]
**LinkedIn URL:** [if found via Apollo or search]
**Message Type:** [Connection Request / InMail / Follow-Up / Group Message / Event-Based]
**Tone:** [selected tone]

**Message:**
[the actual message text]

**Character Count:** [X/300 for connection requests, or word count for other types]

**Personalization Evidence:**
- [list each real data point used and which tool found it]

**Email (backup):** [if found via Apollo or Hunter]
---

IMPORTANT: You MUST use ALL available tools before writing. Skipping tools = generic messages = low response rate."""


class LinkedInOutreachAgentComponent(LCToolsAgentComponent):
    display_name = "LinkedIn Outreach Agent"
    description = (
        "Researches prospects via Apollo, web search, and Hunter, then writes personalized "
        "LinkedIn connection requests, InMails, and follow-up messages using real data."
    )
    icon = "Linkedin"
    name = "LinkedInOutreachAgent"

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
        MultilineInput(
            name="prospect_data",
            display_name="Prospect Data",
            info=(
                "Prospect information: name, company, role, LinkedIn URL if known. "
                "Can include multiple prospects (one per line or structured text)."
            ),
            required=True,
            tool_mode=True,
        ),
        DropdownInput(
            name="message_type",
            display_name="Message Type",
            info="Type of LinkedIn message to write. Connection Requests are limited to 300 characters.",
            options=[
                "Connection Request (300 chars)",
                "InMail",
                "Follow-Up Message",
                "Group Message",
                "Event-Based",
            ],
            value="Connection Request (300 chars)",
            required=True,
        ),
        MessageTextInput(
            name="sender_name",
            display_name="Sender Name",
            info="Your name (the person sending the message)",
            required=True,
        ),
        MessageTextInput(
            name="sender_company",
            display_name="Sender Company",
            info="Your company name",
            required=True,
        ),
        MultilineInput(
            name="value_proposition",
            display_name="Value Proposition",
            info="What does your product/service do? What problem does it solve for this prospect?",
            required=True,
        ),
        DropdownInput(
            name="tone",
            display_name="Tone",
            info="The tone and style of the LinkedIn message.",
            options=[
                "Professional",
                "Casual & Friendly",
                "Mutual Connection Reference",
                "Thought Leadership",
            ],
            value="Professional",
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the LinkedIn outreach writing behavior.",
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
        Output(display_name="LinkedIn Message", name="response", method="message_response"),
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

        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""
        hunter_key = getattr(self, "hunter_api_key", "") or ""

        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            hunter_api_key=hunter_key,
            include_duckduckgo=not bool(tavily_key),
            include_apollo_org=True,
            include_apollo_people=True,
            include_hunter_finder=True,
        )

        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        prospect_data = self.prospect_data or ""
        sender_name = self.sender_name or ""
        sender_company = self.sender_company or ""
        value_prop = self.value_proposition or ""
        message_type = getattr(self, "message_type", "Connection Request (300 chars)") or "Connection Request (300 chars)"
        tone = getattr(self, "tone", "Professional") or "Professional"

        # Inject message parameters into the system prompt
        prospect_section = f"\n\nProspect Data provided: {prospect_data}" if prospect_data else ""
        char_limit_warning = ""
        if "Connection Request" in message_type:
            char_limit_warning = (
                "\n\nCRITICAL REMINDER: Connection Request messages have a HARD LIMIT of 300 characters. "
                "Count characters carefully. If your message exceeds 300 characters, rewrite it shorter. "
                "Do NOT include greetings like 'Hi [Name],' — go straight to the personalized hook."
            )

        self.system_prompt = (
            f"{self.system_prompt}{prospect_section}\n\n"
            f"## Message Parameters\n"
            f"- From: {sender_name} at {sender_company}\n"
            f"- Value Proposition: {value_prop}\n"
            f"- Message Type: {message_type}\n"
            f"- Tone: {tone}\n"
            f"{char_limit_warning}"
        )

        # Build user query if prospect data is provided
        if prospect_data.strip():
            self.input_value = Message(
                text=f"Research the following prospect(s) and write personalized LinkedIn {message_type} message(s).\n\n"
                f"Prospect Data:\n{prospect_data}\n\n"
                f"From: {sender_name} at {sender_company}\n"
                f"Value Proposition: {value_prop}\n"
                f"Tone: {tone}\n\n"
                f"Use ALL available tools to research each prospect before writing. "
                f"Every message must include at least one real, specific data point from the research."
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
