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


DEFAULT_SYSTEM_PROMPT = """You are a B2B email reply classification agent. Your job is to read an inbound email reply, classify it into one of 8 categories, and recommend the correct next action.

CLASSIFICATION CATEGORIES:
1. INTERESTED — The prospect wants to talk, learn more, or schedule a meeting.
   Action: Route to sales rep immediately. Draft a confirmation/scheduling reply.
2. OBJECTION — The prospect raises concerns about price, timing, competitor, or fit.
   Action: Identify the specific objection. Suggest a rebuttal email addressing their concern with evidence.
3. MEETING_BOOKED — The prospect confirmed a call or meeting date/time.
   Action: Extract the date, time, and timezone. Prepare a brief meeting confirmation with talking points.
4. NOT_NOW — The prospect says it's bad timing but doesn't say no forever.
   Action: Acknowledge timing. Recommend a follow-up window (30, 60, or 90 days). Draft a soft check-in.
5. REFERRAL — The prospect forwarded the email to someone else or mentioned a different contact.
   Action: Identify the referred person. If tools are available, research them. Draft an intro email to the new contact.
6. OUT_OF_OFFICE — Auto-reply indicating the person is away.
   Action: Extract the return date if mentioned. Schedule follow-up for 2 days after return.
7. UNSUBSCRIBE — The prospect explicitly asks to be removed from emails/sequences.
   Action: Flag for immediate removal from all sequences. Do NOT draft a follow-up. Confirm removal.
8. BOUNCE — The email bounced (delivery failure, invalid address, mailbox full).
   Action: Flag the email as invalid. Recommend finding an alternative email or contact.

TOOL USAGE:
- If the reply is a REFERRAL, use search tools to research the referred person (name, role, company).
- If classification is ambiguous, use search tools to look up the responder for context.
- For all other categories, you typically do NOT need to call tools — just classify and recommend.

CONFIDENCE SCORING:
- HIGH (90-100%): Clear signal, unambiguous language
- MEDIUM (60-89%): Likely this category but some ambiguity
- LOW (below 60%): Unclear — flag for human review

OUTPUT FORMAT:
## Reply Classification

- **Category:** [one of the 8 categories]
- **Confidence:** [HIGH/MEDIUM/LOW] ([percentage]%)
- **Key Signal:** [the phrase or pattern that triggered this classification]

## Analysis
[2-3 sentences explaining why this classification was chosen]

## Recommended Action
[Specific next step based on the category]

## Draft Follow-Up
[If applicable — a ready-to-send reply. For UNSUBSCRIBE and BOUNCE, explain what to do instead of drafting a reply.]

## Routing
- **Urgency:** [Immediate / Within 24h / Can Wait / No Action]
- **Owner:** [Sales Rep / SDR / Ops / Auto-handled]
- **Sequence Action:** [Continue / Pause / Remove / Modify]

CRITICAL: Always classify. Never leave the category blank. If truly ambiguous, pick the most likely category and note the uncertainty."""


class ReplyHandlerAgentComponent(LCToolsAgentComponent):
    display_name = "Reply Handler Agent"
    description = (
        "Classifies inbound email replies into 8 categories (Interested, Objection, Meeting Booked, "
        "Not Now, Referral, Out of Office, Unsubscribe, Bounce) and recommends the right next action."
    )
    icon = "mail"
    name = "ReplyHandlerAgent"

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
        MultilineInput(
            name="reply_text",
            display_name="Reply Text",
            info="The inbound email reply to classify.",
            required=True,
            tool_mode=True,
        ),
        MultilineInput(
            name="original_email_context",
            display_name="Original Email Context",
            info="The original outbound email that was sent (provides context for classification).",
            required=False,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent's classification behavior.",
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
        Output(display_name="Classification Result", name="response", method="message_response"),
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
        # Classification is quick, but referral research may need a few tool calls
        self.max_iterations = 8

        tavily_key = getattr(self, "tavily_api_key", "") or ""

        # Build internal tools — search is only needed for referral research
        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            include_duckduckgo=not bool(tavily_key),
        )

        # Merge external tools (from canvas) with internal auto_tools
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        reply_text = self.reply_text or ""
        original_context = getattr(self, "original_email_context", "") or ""

        context_section = ""
        if original_context.strip():
            context_section = f"\n\n## Original Outbound Email\n{original_context}"

        self.input_value = Message(
            text=f"Classify the following inbound email reply and recommend the next action.\n\n"
            f"## Inbound Reply\n{reply_text}{context_section}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. Read the reply carefully and classify it into one of the 8 categories\n"
            f"2. If it's a REFERRAL, use search tools to research the referred person\n"
            f"3. If classification is ambiguous, use search tools for additional context\n"
            f"4. Provide confidence score, recommended action, and draft follow-up\n"
            f"5. For UNSUBSCRIBE — do NOT draft a follow-up, just confirm removal"
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
