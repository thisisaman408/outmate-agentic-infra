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
    MessageTextInput,
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message

DEFAULT_SYSTEM_PROMPT = """You are an expert B2B lead scoring analyst with access to web search and research tools.
Your job is to score leads against an Ideal Customer Profile (ICP) using REAL data — not assumptions.

You MUST use the available tools to verify information about each lead before scoring. Search for:
- The lead's company (industry, size, funding, revenue signals)
- The lead's role and seniority
- Recent company news, hiring patterns, tech stack indicators
- Any signals that match or contradict the ICP criteria

## Scoring Scale (0-100)
- 90-100: Perfect fit — matches all key ICP criteria (verified)
- 70-89: Strong fit — matches most criteria, minor gaps
- 50-69: Moderate fit — some alignment but notable mismatches
- 30-49: Weak fit — few matching criteria
- 0-29: Poor fit — does not match ICP

## For EACH lead, provide:
1. **ICP Score** (0-100)
2. **Match Factors** — what aligns with the ICP (cite sources)
3. **Mismatch Flags** — what doesn't align
4. **Recommended Action** — "Route to Sequence", "Nurture", "Deprioritize", or "Disqualify"
5. **Priority Tier** — "Hot", "Warm", or "Cold"
6. **Evidence** — what you found via search that informed the score

Sort results by score (highest first). Be rigorous — flag uncertainty when data is unavailable."""


class ICPScoringAgentComponent(LCToolsAgentComponent):
    display_name = "ICP Scoring Agent"
    description = (
        "Scores leads against your Ideal Customer Profile using web search tools to verify data. "
        "Ranks by fit, flags mismatches, and routes top leads to sequences."
    )
    icon = "target"
    name = "ICPScoringAgent"

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
            name="icp_definition",
            display_name="ICP Definition",
            info="Define your Ideal Customer Profile — industry, company size, role, tech stack, geography, etc.",
            value=(
                "Our ICP:\n"
                "- Industry: B2B SaaS, Fintech, or E-commerce\n"
                "- Company Size: 50-500 employees\n"
                "- Revenue: $5M-$100M ARR\n"
                "- Role: VP of Sales, Head of Growth, CRO, or RevOps Lead\n"
                "- Geography: US, UK, or DACH region\n"
                "- Tech Stack: Uses a CRM (Salesforce/HubSpot), has outbound tooling\n"
                "- Signals: Recently hired SDRs, raised funding in last 12 months, or expanding GTM team"
            ),
            required=True,
        ),
        MultilineInput(
            name="leads_input",
            display_name="Leads to Score",
            info="Your leads data — CSV-style, JSON, or plain text. One lead per line with name, company, role, etc.",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="score_threshold",
            display_name="Hot Lead Threshold (1-100)",
            info="Minimum score to qualify as a 'Hot' lead",
            value="70",
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the scoring behavior.",
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
        Output(display_name="Scored Leads", name="response", method="message_response"),
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

        icp_definition = self.icp_definition or ""
        leads_input = self.leads_input or ""
        threshold = getattr(self, "score_threshold", "70") or "70"

        # Pipeline mode: if leads_input is empty, use chat input as leads
        if not leads_input.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                leads_input = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                leads_input = self.input_value

        # Set the input_value so run_agent() picks it up
        self.input_value = Message(
            text=f"Score the following leads against our ICP. Hot lead threshold: {threshold}/100.\n\n"
            f"## ICP Definition\n{icp_definition}\n\n"
            f"## Leads to Score\n{leads_input}\n\n"
            f"Use your search tools to verify each lead's company, role, and signals before scoring."
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
