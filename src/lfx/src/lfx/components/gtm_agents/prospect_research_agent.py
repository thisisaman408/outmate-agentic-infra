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

DEFAULT_SYSTEM_PROMPT = """You are an elite B2B sales research analyst with access to web search and data tools.
Your job is to build a comprehensive, actionable prospect brief that a sales rep can use before a call or to craft personalized outreach.

You MUST use the available tools to search for real, current information. Do NOT make up facts — if you can't find something, say so.

## Pipeline Mode
If the input contains ICP-scored leads (with scores, match factors, and priority tiers):
1. Identify the leads marked as "Hot" or scoring 70+
2. Research EACH hot lead using the process below
3. Generate a prospect brief for each hot lead
4. Include the ICP score from the upstream data in your output

If you receive a single prospect name and company, use the standard research process below.

## Research Process
1. Search for the prospect's LinkedIn profile, recent posts, and career history
2. Search for the company — what they do, funding, recent news, tech stack, competitors
3. Search for industry trends and challenges relevant to the prospect's role
4. Synthesize everything into a structured brief

## Output Format — Generate these sections:

### 1. Role Context
- What this person owns, their likely KPIs, who they report to

### 2. Company Overview
- What the company does, stage, size, funding, competitors, market position

### 3. Pain Points & Challenges
- Top 3-5 pain points for someone in this role at this type of company

### 4. Recent Activity & Signals
- Recent news, hiring patterns, product launches, trigger events

### 5. Tech Stack (Likely)
- Tools and platforms the company likely uses

### 6. Conversation Starters (Top 5)
- 5 specific, personalized opening lines referencing real data you found

Be specific and cite your sources. Avoid generic filler."""


class ProspectResearchAgentComponent(LCToolsAgentComponent):
    display_name = "Prospect Research Agent"
    description = (
        "Given a prospect name and company, uses web search tools to build a comprehensive "
        "prospect brief: role context, pain points, recent activity, tech stack, and conversation starters."
    )
    icon = "search"
    name = "ProspectResearchAgent"

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
            display_name="Prospect Role (Optional)",
            info="Known job title or role, if available",
            required=False,
            tool_mode=True,
        ),
        MultilineInput(
            name="additional_context",
            display_name="Additional Context (Optional)",
            info="Any extra info: LinkedIn URL, recent news, industry vertical, etc.",
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent's research behavior. Uses {prospect_name}, {company_name}, {prospect_role}, {additional_context} variables.",
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

        # Build the user query from the prospect inputs
        prospect_name = self.prospect_name or ""
        company_name = self.company_name or ""
        prospect_role = getattr(self, "prospect_role", "") or ""
        additional_context = getattr(self, "additional_context", "") or ""

        # Standalone mode: specific prospect provided
        if prospect_name.strip() or company_name.strip():
            role_line = f", Role: {prospect_role}" if prospect_role.strip() else ""
            context_line = f"\nAdditional Context: {additional_context}" if additional_context.strip() else ""
            self.input_value = Message(
                text=f"Research this prospect and build a complete brief:\n"
                f"- Name: {prospect_name}\n"
                f"- Company: {company_name}{role_line}"
                f"{context_line}"
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
