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

# FULL_SYSTEM_PROMPT — uncomment when you have a bigger model (original prompt preserved in git history)

DEFAULT_SYSTEM_PROMPT = """You are a cold email writer. Research the prospect using ALL available tools, then write a hyper-personalized email.

TOOLS — Use ALL of these in order:
- apollo_people_enrichment: Get prospect's title, seniority, email, work history. Use organization_name (NOT domain).
- apollo_org_enrichment: Get company data (size, revenue, industry). Use organization_name (NOT domain).
- hunter_email_finder: Find/verify email. Use first_name + last_name + company name.
- neverbounce_email_verify: Verify the email is deliverable (if available).
- pdl_person_enrichment: Get additional person data — skills, experience (if available).
- tavily_search: Research the prospect — find LinkedIn posts, interviews, blog articles, recent talks.
- duckduckgo_search: Find company news — product launches, funding, hiring, press coverage.

WORKFLOW — Follow this exact sequence:
Step 1: Call apollo_people_enrichment to get prospect profile + email
Step 2: Call apollo_org_enrichment to get company data
Step 3: Call hunter_email_finder to find/verify email
Step 4: If neverbounce available, verify the email
Step 5: Call tavily_search for: "[Prospect Name] [Company] LinkedIn interview blog recent"
Step 6: Call duckduckgo_search for: "[Company] news product launch funding 2024 2025"
Step 7: STOP. Write the email using ALL the data collected.

EMAIL RULES:
- Lead with THEM, not "I" or "We" — reference something specific about them
- Use a real data point in the opening line (their recent post, company news, product launch)
- Keep it to the specified length
- Include subject line
- End with the specified CTA
- Never be generic — every sentence should have a reason based on research
- If MULTIPLE prospects are provided, write a SEPARATE email for EACH prospect

IMPORTANT: You MUST use ALL available tools. Do not skip Hunter or DuckDuckGo. The workflow is:
1. Apollo People (get person data)
2. Apollo Org (get company data)
3. Hunter (find/verify email)
4. Tavily (research prospect — LinkedIn posts, interviews)
5. DuckDuckGo (company news, product launches)
6. Write the email
7. If sendgrid_send_email is available: SEND the email using the tool. Pass to_email, to_name, subject, and the email body.
   If SendGrid is NOT available: just output the email for the user to copy.

If you skip a tool, the email will be generic and low quality.

OUTPUT FORMAT — Write for EACH prospect:

---
### Email for [Prospect Name]

**To:** [prospect name] <[email]>
**Email Verified:** [yes/no/not checked]
**Subject:** [subject using a real, specific data point]

[email body]

**Research Evidence Used:**
- [list each real fact and which tool found it]
---

If there are 2 prospects, write 2 separate emails. If 5, write 5."""


class HyperPersonalisationAgentComponent(LCToolsAgentComponent):
    display_name = "Hyper-Personalisation Agent"
    description = (
        "Uses web search tools to research prospects, then writes hyper-personalized cold emails "
        "using real data — LinkedIn posts, company news, role changes, and shared connections."
    )
    icon = "mail"
    name = "HyperPersonalisationAgent"

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
        SecretStrInput(
            name="hunter_api_key",
            display_name="Hunter API Key",
            info="Hunter.io key — finds emails by company domain. Get it at hunter.io/api-keys.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="neverbounce_api_key",
            display_name="NeverBounce API Key",
            info="NeverBounce key — verifies if email addresses are deliverable. Get it at app.neverbounce.com.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="sendgrid_api_key",
            display_name="SendGrid API Key",
            info="SendGrid key — lets the agent send emails directly after writing them. Get it at app.sendgrid.com → Settings → API Keys.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="sendgrid_sender_email",
            display_name="SendGrid Sender Email",
            info="Your verified sender email in SendGrid (e.g. outreach@outmate.ai). Required if SendGrid key is provided.",
            required=False,
        ),
        MultilineInput(
            name="prospect_data",
            display_name="Prospect Data",
            info=(
                "Prospect information (name, role, company). Optional — if left empty, "
                "the agent will use the connected tools to research the prospect automatically."
            ),
            required=False,
            value="",
            tool_mode=True,
        ),
        MessageTextInput(
            name="sender_name",
            display_name="Sender Name",
            info="Your name (the person sending the email)",
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
            name="email_tone",
            display_name="Email Tone",
            info="The tone and style of the email",
            options=[
                "Professional & Direct",
                "Conversational & Warm",
                "Bold & Provocative",
                "Consultative & Insightful",
                "Casual & Friendly",
            ],
            value="Conversational & Warm",
        ),
        DropdownInput(
            name="email_length",
            display_name="Email Length",
            info="Target email length",
            options=["Short (50-80 words)", "Medium (80-130 words)", "Long (130-200 words)"],
            value="Short (50-80 words)",
        ),
        DropdownInput(
            name="email_type",
            display_name="Email Type",
            info="The type of outreach email",
            options=[
                "Cold Outreach (First Touch)",
                "Follow-Up (2nd Touch)",
                "Breakup Email (Final Touch)",
                "Congrats on New Role",
                "Event/Trigger Based",
                "Referral Introduction",
            ],
            value="Cold Outreach (First Touch)",
        ),
        MessageTextInput(
            name="cta_instruction",
            display_name="Call-to-Action",
            info="What should the CTA be? (e.g. 'book a 15-min call', 'reply with thoughts')",
            value="Would you be open to a quick 15-minute chat this week?",
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the email writing behavior.",
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
        Output(display_name="Personalized Email", name="response", method="message_response"),
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
        import logging
        logger = logging.getLogger("outmate.gtm_agents.hyper_personalisation")

        llm = self._get_llm()
        # 6-7 tool calls + final email = need room
        self.max_iterations = 12

        # Build ALL tools from API keys — search + enrichment + sending
        auto_tools = build_tools_from_keys(
            tavily_api_key=getattr(self, "tavily_api_key", "") or "",
            apollo_api_key=getattr(self, "apollo_api_key", "") or "",
            pdl_api_key=getattr(self, "pdl_api_key", "") or "",
            hunter_api_key=getattr(self, "hunter_api_key", "") or "",
            neverbounce_api_key=getattr(self, "neverbounce_api_key", "") or "",
            sendgrid_api_key=getattr(self, "sendgrid_api_key", "") or "",
            sendgrid_sender_email=getattr(self, "sendgrid_sender_email", "") or "",
            # Keep DDG from canvas + Tavily from key — use both
            include_duckduckgo=not bool(getattr(self, "tavily_api_key", "")),
            include_apollo_org=True,
            include_apollo_people=True,
            include_pdl_person=True,
            include_hunter_finder=True,
            include_hunter_domain=False,
        )
        # Keep external tools (DDG from canvas) + add internal tools
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        logger.warning(f"[HyperPersonalisation] LLM type: {type(llm).__name__}, model: {getattr(llm, 'model_name', getattr(llm, 'model', 'unknown'))}")

        # Log tools
        tools = self.tools or []
        tool_names = [getattr(t, 'name', str(t)) for t in tools]
        logger.warning(f"[HyperPersonalisation] Tools connected: {len(tools)} -> {tool_names}")

        # Log input_value
        if hasattr(self, "input_value") and self.input_value:
            iv = self.input_value
            if isinstance(iv, Message):
                logger.warning(f"[HyperPersonalisation] input_value (Message): '{iv.text[:200] if iv.text else 'EMPTY'}'")
            else:
                logger.warning(f"[HyperPersonalisation] input_value ({type(iv).__name__}): '{str(iv)[:200]}'")
        else:
            logger.warning("[HyperPersonalisation] input_value: NONE/EMPTY")

        prospect_data = self.prospect_data or ""
        sender_name = self.sender_name or ""
        sender_company = self.sender_company or ""
        value_prop = self.value_proposition or ""
        tone = getattr(self, "email_tone", "Conversational & Warm") or "Conversational & Warm"
        length = getattr(self, "email_length", "Short (50-80 words)") or "Short (50-80 words)"
        email_type = getattr(self, "email_type", "Cold Outreach (First Touch)") or "Cold Outreach (First Touch)"
        cta = getattr(self, "cta_instruction", "") or ""

        logger.warning(f"[HyperPersonalisation] prospect_data: '{prospect_data[:100]}'")
        logger.warning(f"[HyperPersonalisation] sender: {sender_name} at {sender_company}")

        # Inject email parameters into the system prompt so the user's chat message flows through as-is
        prospect_section = f"\n\nProspect Data provided: {prospect_data}" if prospect_data else ""
        self.system_prompt = (
            f"{self.system_prompt}{prospect_section}\n\n"
            f"## Email Parameters\n"
            f"- From: {sender_name} at {sender_company}\n"
            f"- Value Proposition: {value_prop}\n"
            f"- Type: {email_type}\n"
            f"- Tone: {tone}\n"
            f"- Length: {length}\n"
            f"- CTA: {cta}\n\n"
            f"## Required Output Format\n"
            f"After using all tools, output:\n"
            f"**Subject Line:** [subject using real data]\n"
            f"**Email:** [full email with real names, real data]\n"
            f"**Contact:** [name, email, verification status, LinkedIn]\n"
            f"**Evidence:** [list every real fact found via tools]"
        )

        logger.warning(f"[HyperPersonalisation] system_prompt length: {len(self.system_prompt)} chars")
        logger.warning(f"[HyperPersonalisation] system_prompt first 300 chars: '{self.system_prompt[:300]}'")

        # Do NOT override self.input_value — let the user's chat message flow through

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        agent = create_tool_calling_agent(llm, tools, prompt)
        logger.warning(f"[HyperPersonalisation] Agent created successfully. Type: {type(agent).__name__}")

        return agent
