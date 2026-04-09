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
# DEFAULT_SYSTEM_PROMPT = """You are an AI voice outreach coordinator that prepares and triggers AI-powered sales calls.
# Your job is to take enriched prospect data, prepare optimal call context, and trigger voice calls via the OutMate Voice Agent API.
#
# ## CRITICAL RULES
# 1. NEVER trigger a call without a valid phone number.
# 2. ALWAYS prepare rich context before calling — the voice agent performs better with more context.
# 3. If prospect data is thin, use your search/enrichment tools to fill gaps BEFORE triggering the call.
# 4. Summarize what you know into a concise call briefing for the voice agent.
#
# ## PIPELINE MODE
# When receiving data from upstream agents (Waterfall Enrichment, Intent Signals, etc.):
# 1. Extract the prospect's name, phone, company, role, and all available context
# 2. Synthesize intent signals, enrichment data, and research into a call briefing
# 3. Identify the best call objective based on the data:
#    - Hot intent (90+) → "intro_demo" (push for a demo)
#    - Warm intent (70-89) → "discovery" (learn about their needs)
#    - Moderate intent (50-69) → "nurture" (share value, build rapport)
# 4. Trigger the call with full context
#
# ## CALL PREPARATION WORKFLOW
#
# ### Phase 1: Data Validation
# - Verify phone number exists and looks valid
# - Check for enriched data: name, company, role, pain points
# - If data is incomplete, use search/enrichment tools to fill gaps
#
# ### Phase 2: Context Synthesis
# Build a call briefing from all available data:
# - Company overview (what they do, size, funding)
# - Prospect role and likely priorities
# - Pain points and challenges
# - Recent signals (funding, hiring, product launches)
# - Conversation starters and hooks
#
# ### Phase 3: Trigger the Call
# - Call the outmate_voice_call tool with:
#   - name, phone, company, role
#   - Synthesized context as a structured string
#   - Appropriate call_objective
# - Report the call status back
#
# ### Phase 4: Post-Call Summary
# - Confirm the call was initiated
# - Summarize what context was passed to the voice agent
# - Note any data gaps that should be addressed
#
# ## OUTPUT FORMAT
#
# ### Voice Call: [Prospect Name] at [Company]
# **Phone:** [number] | **Call Objective:** [objective]
#
# **Call Briefing Sent to Voice Agent:**
# - Company: [overview]
# - Role Context: [what they own, their KPIs]
# - Pain Points: [identified challenges]
# - Recent Signals: [what triggered this outreach]
# - Talking Points: [key hooks for the conversation]
#
# **Call Status:** [initiated/failed/error]
# **Call ID:** [if available]
#
# Always prepare the richest possible context — the voice agent's performance directly depends on the quality of the briefing you provide."""

DEFAULT_SYSTEM_PROMPT = """You are a voice outreach coordinator. Prepare context and trigger AI voice calls.

WORKFLOW:
1. Validate: Check prospect has name and phone number
2. Research: If data is thin, search for more context about them and their company
3. Prepare briefing: Summarize company, role, pain points, signals, talking points
4. Trigger call: Use outmate_voice_call tool with name, phone, company, role, context, call_objective
5. Report: Confirm call status and what context was sent

Choose call_objective based on intent: Hot=intro_demo, Warm=discovery, Cool=nurture.
Start immediately."""


class VoiceOutreachAgentComponent(LCToolsAgentComponent):
    display_name = "AI Voice Outreach Agent"
    description = (
        "Prepares enriched call context and triggers AI-powered voice calls via the OutMate Voice Agent. "
        "Synthesizes upstream data into optimal call briefings for autonomous phone outreach."
    )
    icon = "Phone"
    name = "VoiceOutreachAgent"

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
                "Prospect information for voice outreach. Include name, phone, company, role, and any context.\n"
                "Can receive enriched data from upstream Waterfall Enrichment or Intent Signal agents."
            ),
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="voice_agent_url",
            display_name="Voice Agent URL",
            info="URL of the OutMate Voice Agent server (e.g., http://localhost:8000)",
            value="http://localhost:8000",
            required=True,
        ),
        DropdownInput(
            name="call_objective",
            display_name="Default Call Objective",
            info="Default objective for the voice call (can be overridden per-prospect based on intent score)",
            options=["intro_demo", "discovery", "nurture", "follow_up", "closing"],
            value="intro_demo",
        ),
        MessageTextInput(
            name="client_id",
            display_name="Client Profile ID",
            info="Which client profile to use from the voice agent (defines agent personality and company info)",
            value="client_1",
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the voice outreach behavior.",
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
        Output(display_name="Call Status", name="response", method="message_response"),
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

        prospect_data = self.prospect_data or ""
        voice_url = self.voice_agent_url or "http://localhost:8000"
        objective = getattr(self, "call_objective", "intro_demo") or "intro_demo"
        client_id = getattr(self, "client_id", "client_1") or "client_1"

        # Pipeline mode: if prospect_data is empty, use chat input
        if not prospect_data.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                prospect_data = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                prospect_data = self.input_value

        self.input_value = Message(
            text=f"Prepare and trigger voice outreach for these prospects:\n\n{prospect_data}\n\n"
            f"Default Call Objective: {objective}"
        )

        self.system_prompt = (
            f"{self.system_prompt}\n\n"
            f"## Voice Agent Configuration\n"
            f"- Voice Agent URL: {voice_url}\n"
            f"- Default Call Objective: {objective}\n"
            f"- Client Profile: {client_id}\n\n"
            f"## HOW TO TRIGGER A CALL\n"
            f"Use the outmate_voice_call tool with these parameters:\n"
            f"- name: prospect's full name\n"
            f"- phone: prospect's phone number (with country code)\n"
            f"- company: prospect's company name\n"
            f"- role: prospect's job title\n"
            f"- context: JSON string with pain_points, company_size, recent_intel, etc.\n"
            f"- call_objective: one of intro_demo, discovery, nurture, follow_up, closing\n"
            f"- voice_agent_url: {voice_url}\n"
            f"- client_id: {client_id}\n"
        )

        # Auto-create tools (DuckDuckGo for research)
        auto_tools = build_tools_from_keys(include_duckduckgo=True)
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
