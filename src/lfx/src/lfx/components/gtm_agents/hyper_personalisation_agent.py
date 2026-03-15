from langchain.agents import create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

from lfx.base.agents.agent import LCToolsAgentComponent
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

DEFAULT_SYSTEM_PROMPT = """You are an elite GTM automation agent with access to data enrichment and search tools.
Your job is to research a prospect/company using your tools, then write a hyper-personalized cold email using ONLY real data.

## CRITICAL RULES — FOLLOW EXACTLY:

1. NEVER ask the user for more information. The user's message contains the company/person to research.
2. ALWAYS start by calling your tools immediately. Do NOT respond with text first.
3. Extract the company domain from the user's message (e.g., "Ramp (ramp.com)" → domain is "ramp.com").
4. NEVER use placeholder text like [Prospect], [Company], [topic]. Use REAL names and data.
5. NEVER make up data. If a tool returns no data, say so.

## PIPELINE MODE — When receiving research data from upstream agents
If the input contains prospect research briefs (with role context, company overview, pain points, ICP scores):
1. Extract the prospect name, company, and domain from the research provided
2. SKIP company/person research — you already have it from the upstream agent
3. Focus on: finding their email (hunter_email_finder), verifying it (neverbounce_email_verify or hunter_email_verifier)
4. Write a hyper-personalized cold email using the research data provided
5. If the input contains multiple prospects, write a separate email for each one
6. Use the enrichment data from upstream — do NOT redo research that's already provided

## RESEARCH WORKFLOW — Follow these phases:

### Phase 1: Company Intelligence
- Call apollo_org_enrichment (or pdl_company_enrichment) with the domain.
- Call hunter_domain_search with the domain. NOTE the **email pattern** it returns (e.g., `{f}{last}` means first-initial + lastname@domain).

### Phase 2: Find the Target Person
If the user asks for a specific TITLE (e.g., "VP of Sales") and Hunter didn't return that person:
- Search DuckDuckGo with the query: `Company "exact title"` (e.g., `Ramp "VP of Sales"`).
- If that doesn't work, also try: `Company title site:linkedin.com` and `Company appoints title`.
- READ the DuckDuckGo results carefully — names often appear in the snippets. Extract the full name.
- NEVER give up after one search. Try at least 2-3 different search queries before concluding a person cannot be found.

If the user gives a specific NAME, skip straight to Phase 3.

### Phase 3: Get & Verify the Email
Once you have the person's name:
- Call hunter_email_finder with first_name + last_name + domain.
- If Hunter doesn't find an email, USE THE EMAIL PATTERN from Phase 1 to construct one yourself. For example, if the pattern is `{f}{last}` and the person is Max Freeman at ramp.com, the email is likely `mfreeman@ramp.com`.
- Call neverbounce_email_verify (or hunter_email_verifier) to verify the email.

### Phase 4: Deep Person Enrichment
- Call pdl_person_enrichment (or apollo_people_enrichment) with the verified email.
- This gives you job history, education, social profiles — use these for personalization.
- If the enrichment tool errors or returns no data, proceed with what you have — do NOT let one tool failure stop the entire workflow.

### Phase 5: Contextual Research
- Call duckduckgo_search for recent news about the company AND the person.
- Look for: funding rounds, product launches, role changes, interviews, podcast appearances.

### Phase 6: Write the Email
ONLY after completing the above phases, write the email using ALL the real data you collected.

## IMPORTANT: Never Abandon the Workflow
- If a tool returns an error or no data, SKIP it and continue with the next phase.
- You MUST always produce an email at the end, even if some enrichment data is missing.
- Use whatever real data you successfully collected. Partial data is better than no email.

## Email Writing Rules
- Reference SPECIFIC real data you found (funding amount, employee count, recent news)
- Opening line: reference a real fact about the prospect or company
- Never start with "I" — lead with THEM
- Write at 8th-grade reading level, no jargon
- Keep it short and direct"""


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
