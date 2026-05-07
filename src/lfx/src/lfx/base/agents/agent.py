import re
import uuid
from abc import abstractmethod
from typing import TYPE_CHECKING, cast

from langchain.agents import AgentExecutor, BaseMultiActionAgent, BaseSingleActionAgent
from langchain.agents.agent import RunnableAgent
from langchain.callbacks.base import BaseCallbackHandler
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_core.runnables import Runnable

from lfx.base.agents.callback import AgentAsyncHandler
from lfx.base.agents.events import ExceptionWithMessageError, process_agent_events
from lfx.base.agents.utils import get_chat_output_sender_name
from lfx.custom.custom_component.component import Component, _get_component_toolkit
from lfx.field_typing import Tool
from lfx.inputs.inputs import InputTypes
from lfx.io import BoolInput, HandleInput, IntInput, MessageInput
from lfx.log.logger import logger
from lfx.memory import delete_message
from lfx.schema.content_block import ContentBlock
from lfx.schema.data import Data
from lfx.schema.log import OnTokenFunctionType
from lfx.schema.message import Message
from lfx.template.field.base import Output
from lfx.utils.constants import MESSAGE_SENDER_AI

if TYPE_CHECKING:
    from lfx.schema.log import OnTokenFunctionType, SendMessageFunctionType


DEFAULT_TOOLS_DESCRIPTION = "A helpful assistant with access to the following tools:"
DEFAULT_AGENT_NAME = "Agent ({tools_names})"


# (provider name shown to the user, regex matching the provider's auth-failure
# string). Order matters: the first match wins. Patterns are case-insensitive.
_AUTH_ERROR_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("Groq", re.compile(r"groq\.AuthenticationError|api\.groq\.com.*401|invalid_api_key.*groq", re.IGNORECASE)),
    ("OpenAI", re.compile(r"openai\.AuthenticationError|api\.openai\.com.*401|incorrect api key provided", re.IGNORECASE)),
    ("Anthropic", re.compile(r"anthropic\.AuthenticationError|api\.anthropic\.com.*401|invalid x-api-key", re.IGNORECASE)),
    ("Google", re.compile(r"google.*api[\s_-]?key|google.*authentication", re.IGNORECASE)),
    ("OpenRouter", re.compile(r"openrouter.*401|openrouter.*invalid api key", re.IGNORECASE)),
    # Generic catch-all for "401 + invalid API key" wording (must be last).
    ("Model provider", re.compile(r"401.*invalid[_\s-]*api[_\s-]*key|invalid[_\s-]*api[_\s-]*key.*401", re.IGNORECASE)),
)


def _provider_from_model_value(model_value: object) -> str | None:
    """Best-effort extraction of the provider name from the agent's `model` field.

    The component stores the user's model selection as either a list of dicts
    (modern multi-provider picker) or a string. We look for a `provider` key in
    the first dict if present.
    """
    if isinstance(model_value, list) and model_value:
        first = model_value[0]
        if isinstance(first, dict):
            provider = first.get("provider") or first.get("category")
            if isinstance(provider, str) and provider.strip():
                return provider.strip()
    return None


_TOOLCALL_FORMAT_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Groq raises this when a small model emits a malformed tool call.
    re.compile(r"failed to call a function\.\s*please adjust your prompt", re.IGNORECASE),
    re.compile(r"failed_generation", re.IGNORECASE),
    re.compile(r"tool[_ ]?call.*malformed|malformed tool[_ ]?call", re.IGNORECASE),
)


def _model_name_from_model_value(model_value: object) -> str | None:
    if isinstance(model_value, list) and model_value:
        first = model_value[0]
        if isinstance(first, dict):
            n = first.get("name") or first.get("model") or first.get("display_name")
            if isinstance(n, str) and n.strip():
                return n.strip()
    return None


def _format_auth_failure(error_msg: str, model_value: object | None = None) -> str | None:
    """Translate a known provider failure into an actionable instruction.

    Catches two distinct categories:
      1. Auth failures (401 / invalid API key) — points the user at the
         specific Inspector field they need to fix.
      2. Tool-call format failures (Groq's `failed_generation`) — those
         almost always mean the chosen model is too small to handle the
         agent's tool schema; suggest a larger model.

    Returns a markdown string the user can act on, or None if the error
    doesn't match (in which case the caller falls back to the raw error).
    """
    if not error_msg:
        return None
    # Tool-call format failures first — they look superficially like LLM
    # errors but the fix is "pick a bigger model", not "fix the API key".
    for pattern in _TOOLCALL_FORMAT_PATTERNS:
        if pattern.search(error_msg):
            named_provider = _provider_from_model_value(model_value) or "the LLM provider"
            current_model = _model_name_from_model_value(model_value) or "the selected model"
            return (
                f"**Tool-calling failed — the model is too small for this agent.**\n\n"
                f"The agent's tool calls completed, but `{current_model}` "
                f"({named_provider}) couldn't format a follow-up tool invocation. "
                f"This is almost always a model-capability issue, not a prompt issue.\n\n"
                f"To fix:\n"
                f"1. Open this agent's Inspector → **Language Model** field\n"
                f"2. Pick a larger / more capable model. Recommended:\n"
                f"   - **Groq:** `llama-3.3-70b-versatile` or `openai/gpt-oss-120b`\n"
                f"   - **OpenAI:** `gpt-4o` or `gpt-4o-mini`\n"
                f"   - **Anthropic:** `claude-sonnet-4-6`\n"
                f"3. Click **Save**, then **Re-run**\n\n"
                f"_The data the agent already collected via tools is preserved — "
                f"only the final synthesis step needs the bigger model._"
            )
    for provider, pattern in _AUTH_ERROR_PATTERNS:
        if pattern.search(error_msg):
            # Prefer the model's declared provider over the regex-derived name
            # when available — it's friendlier ("Groq" vs "Model provider").
            named_provider = _provider_from_model_value(model_value) or provider
            return (
                f"**Missing or invalid {named_provider} API key.**\n\n"
                f"The agent's tool calls completed, but the LLM call failed because the "
                f"`API Key` field for **{named_provider}** is empty or invalid.\n\n"
                f"To fix:\n"
                f"1. Open this agent's Inspector → **API Key** field\n"
                f"2. Paste your real {named_provider} API key (replace the placeholder text if there is one)\n"
                f"3. Click **Save**, then **Re-run**\n\n"
                f"_If you don't have a {named_provider} key yet, you can get one from the provider's dashboard._"
            )
    return None


class LCAgentComponent(Component):
    trace_type = "agent"
    _base_inputs: list[InputTypes] = [
        MessageInput(
            name="input_value",
            display_name="Input",
            info="The input provided by the user for the agent to process.",
            tool_mode=True,
        ),
        BoolInput(
            name="handle_parsing_errors",
            display_name="Handle Parse Errors",
            value=True,
            advanced=True,
            info="When ON, the agent automatically recovers from errors instead of crashing. Keep this ON for best results.",
        ),
        BoolInput(
            name="verbose",
            display_name="Verbose",
            value=True,
            advanced=True,
            info="When ON, shows detailed step-by-step logs of what the agent is doing. Useful for debugging, turn OFF for cleaner output.",
        ),
        IntInput(
            name="max_iterations",
            display_name="Max Iterations",
            value=15,
            advanced=True,
            info="How many steps the agent can take before stopping. Higher = more thorough but slower. 15 is a good default, increase to 25+ for complex research tasks.",
        ),
    ]

    outputs = [
        Output(display_name="Response", name="response", method="message_response"),
        Output(display_name="Agent", name="agent", method="build_agent", tool_mode=False),
    ]

    # Get shared callbacks for tracing and save them to self.shared_callbacks
    def _get_shared_callbacks(self) -> list[BaseCallbackHandler]:
        if not hasattr(self, "shared_callbacks"):
            self.shared_callbacks = self.get_langchain_callbacks()
        return self.shared_callbacks

    @abstractmethod
    def build_agent(self) -> AgentExecutor:
        """Create the agent."""

    async def message_response(self) -> Message:
        """Run the agent and return the response."""
        agent = self.build_agent()
        message = await self.run_agent(agent=agent)

        # Final safety net: NEVER return an empty message
        if message and (not message.text or not message.text.strip()):
            tool_names = []
            if hasattr(message, "content_blocks") and message.content_blocks:
                for block in message.content_blocks:
                    if hasattr(block, "contents"):
                        for c in block.contents:
                            if hasattr(c, "header") and c.header:
                                tool_names.append(str(c.header.get("title", "")))
            if tool_names:
                message.text = (
                    f"Agent made {len(tool_names)} tool calls: {', '.join(tool_names[:5])}. "
                    "But the model could not generate a final report (likely hit token or iteration limits). "
                    "Expand the tool calls above to see the raw data collected."
                )
            else:
                message.text = (
                    "Agent stopped without producing output. "
                    "Try using a stronger model with higher token limits."
                )

        self.status = message
        return message

    def _validate_outputs(self) -> None:
        required_output_methods = ["build_agent"]
        output_names = [output.name for output in self.outputs]
        for method_name in required_output_methods:
            if method_name not in output_names:
                msg = f"Output with name '{method_name}' must be defined."
                raise ValueError(msg)
            if not hasattr(self, method_name):
                msg = f"Method '{method_name}' must be defined."
                raise ValueError(msg)

    def get_agent_kwargs(self, *, flatten: bool = False) -> dict:
        base = {
            "handle_parsing_errors": self.handle_parsing_errors,
            "verbose": self.verbose,
            "allow_dangerous_code": True,
        }
        agent_kwargs = {
            "handle_parsing_errors": self.handle_parsing_errors,
            "max_iterations": self.max_iterations,
            "early_stopping_method": "force",
        }
        if flatten:
            return {
                **base,
                **agent_kwargs,
            }
        return {**base, "agent_executor_kwargs": agent_kwargs}

    def get_chat_history_data(self) -> list[Data] | None:
        # might be overridden in subclasses
        return None

    def _data_to_messages_skip_empty(self, data: list[Data]) -> list[BaseMessage]:
        """Convert data to messages, filtering only empty text while preserving non-text content.

        Note: added to fix issue with certain providers failing when given empty text as input.
        """
        messages = []
        for value in data:
            # Only skip if the message has a text attribute that is empty/whitespace
            text = getattr(value, "text", None)
            if isinstance(text, str) and not text.strip():
                # Skip only messages with empty/whitespace-only text strings
                continue

            lc_message = value.to_lc_message()
            messages.append(lc_message)

        return messages

    async def run_agent(
        self,
        agent: Runnable | BaseSingleActionAgent | BaseMultiActionAgent | AgentExecutor,
    ) -> Message:
        if isinstance(agent, AgentExecutor):
            runnable = agent
        else:
            # note the tools are not required to run the agent, hence the validation removed.
            handle_parsing_errors = hasattr(self, "handle_parsing_errors") and self.handle_parsing_errors
            verbose = hasattr(self, "verbose") and self.verbose
            max_iterations = hasattr(self, "max_iterations") and self.max_iterations
            runnable = AgentExecutor.from_agent_and_tools(
                agent=agent,
                tools=self.tools or [],
                handle_parsing_errors=handle_parsing_errors,
                verbose=verbose,
                max_iterations=max_iterations,
                early_stopping_method="force",
            )
        # Convert input_value to proper format for agent
        lc_message = None
        if isinstance(self.input_value, Message):
            lc_message = self.input_value.to_lc_message()
            # Extract text content from the LangChain message for agent input
            # Agents expect a string input, not a Message object
            if hasattr(lc_message, "content"):
                if isinstance(lc_message.content, str):
                    input_dict: dict[str, str | list[BaseMessage] | BaseMessage] = {"input": lc_message.content}
                elif isinstance(lc_message.content, list):
                    # For multimodal content, extract text parts
                    text_parts = [item.get("text", "") for item in lc_message.content if item.get("type") == "text"]
                    input_dict = {"input": " ".join(text_parts) if text_parts else ""}
                else:
                    input_dict = {"input": str(lc_message.content)}
            else:
                input_dict = {"input": str(lc_message)}
        else:
            input_dict = {"input": self.input_value}

        # Ensure input_dict is initialized
        if "input" not in input_dict:
            input_dict = {"input": self.input_value}

        # Use enhanced prompt if available (set by IBM Granite handler), otherwise use original
        system_prompt_to_use = getattr(self, "_effective_system_prompt", None) or getattr(self, "system_prompt", None)
        if system_prompt_to_use and system_prompt_to_use.strip():
            input_dict["system_prompt"] = system_prompt_to_use

        if hasattr(self, "chat_history") and self.chat_history:
            if isinstance(self.chat_history, Data):
                input_dict["chat_history"] = self._data_to_messages_skip_empty([self.chat_history])
            elif all(hasattr(m, "to_data") and callable(m.to_data) and "text" in m.data for m in self.chat_history):
                input_dict["chat_history"] = self._data_to_messages_skip_empty(self.chat_history)
            elif all(isinstance(m, Message) for m in self.chat_history):
                input_dict["chat_history"] = self._data_to_messages_skip_empty([m.to_data() for m in self.chat_history])

        # Handle multimodal input (images + text)
        # Note: Agent input must be a string, so we extract text and move images to chat_history
        if lc_message is not None and hasattr(lc_message, "content") and isinstance(lc_message.content, list):
            # Extract images and text from the text content items
            # Support both "image" (legacy) and "image_url" (standard) types
            image_dicts = [item for item in lc_message.content if item.get("type") in ("image", "image_url")]
            text_content = [item for item in lc_message.content if item.get("type") not in ("image", "image_url")]

            text_strings = [
                item.get("text", "")
                for item in text_content
                if item.get("type") == "text" and item.get("text", "").strip()
            ]

            # Set input to concatenated text or empty string
            input_dict["input"] = " ".join(text_strings) if text_strings else ""

            # If input is still a list or empty, provide a default
            if isinstance(input_dict["input"], list) or not input_dict["input"]:
                input_dict["input"] = "Process the provided images."

            if "chat_history" not in input_dict:
                input_dict["chat_history"] = []

            if isinstance(input_dict["chat_history"], list):
                input_dict["chat_history"].extend(HumanMessage(content=[image_dict]) for image_dict in image_dicts)
            else:
                input_dict["chat_history"] = [HumanMessage(content=[image_dict]) for image_dict in image_dicts]

        # Final safety check: ensure input is never empty (prevents Anthropic API errors)
        current_input = input_dict.get("input", "")
        if isinstance(current_input, list):
            current_input = " ".join(map(str, current_input))
        elif not isinstance(current_input, str):
            current_input = str(current_input)

        if not current_input.strip():
            input_dict["input"] = "Continue the conversation."
        else:
            input_dict["input"] = current_input

        if hasattr(self, "graph"):
            session_id = self.graph.session_id
        elif hasattr(self, "_session_id"):
            session_id = self._session_id
        else:
            session_id = None

        sender_name = get_chat_output_sender_name(self) or self.display_name or "AI"
        agent_message = Message(
            sender=MESSAGE_SENDER_AI,
            sender_name=sender_name,
            properties={"icon": "Bot", "state": "partial"},
            content_blocks=[ContentBlock(title="Agent Steps", contents=[])],
            session_id=session_id or uuid.uuid4(),
        )

        # Create token callback if event_manager is available
        # This wraps the event_manager's on_token method to match OnTokenFunctionType Protocol
        on_token_callback: OnTokenFunctionType | None = None
        if self._event_manager:
            on_token_callback = cast("OnTokenFunctionType", self._event_manager.on_token)

        try:
            result = await process_agent_events(
                runnable.astream_events(
                    input_dict,
                    # here we use the shared callbacks because the AgentExecutor uses the tools
                    config={"callbacks": [AgentAsyncHandler(self.log), *self._get_shared_callbacks()]},
                    version="v2",
                ),
                agent_message,
                cast("SendMessageFunctionType", self.send_message),
                on_token_callback,
            )
        except ExceptionWithMessageError as e:
            logger.error(f"ExceptionWithMessageError: {e}")
            error_msg = str(e.message) if hasattr(e, "message") else str(e)
            # If the underlying failure is "no/invalid API key", surface an
            # actionable instruction naming the provider and the field the
            # user needs to fill, instead of the raw provider JSON.
            friendly = _format_auth_failure(error_msg, getattr(self, "model", None))
            text = friendly or (
                f"**Agent encountered an error:** {error_msg[:300]}\n\n"
                "The tool calls above completed successfully — expand them to see the data collected. "
                "To get the full synthesized report, use a model with higher token limits."
            )
            error_result = await Message.create(
                text=text,
                sender=MESSAGE_SENDER_AI,
                sender_name=sender_name,
                session_id=session_id or uuid.uuid4(),
            )
            if self._event_manager:
                self.status = error_result
            return error_result
        except Exception as e:
            logger.error(f"Error: {e}")
            raise

        self.status = result
        return result

    @abstractmethod
    def create_agent_runnable(self) -> Runnable:
        """Create the agent."""

    def validate_tool_names(self) -> None:
        """Validate tool names to ensure they match the required pattern."""
        pattern = re.compile(r"^[a-zA-Z0-9_-]+$")
        if hasattr(self, "tools") and self.tools:
            for tool in self.tools:
                if not pattern.match(tool.name):
                    msg = (
                        f"Invalid tool name '{tool.name}': must only contain letters, numbers, underscores, dashes,"
                        " and cannot contain spaces."
                    )
                    raise ValueError(msg)


class LCToolsAgentComponent(LCAgentComponent):
    _base_inputs = [
        HandleInput(
            name="tools",
            display_name="Tools",
            input_types=["Tool"],
            is_list=True,
            required=False,
            info="These are the tools that the agent can use to help with tasks.",
        ),
        *LCAgentComponent.get_base_inputs(),
    ]

    def build_agent(self) -> AgentExecutor:
        self.validate_tool_names()
        agent = self.create_agent_runnable()
        return AgentExecutor.from_agent_and_tools(
            agent=RunnableAgent(runnable=agent, input_keys_arg=["input"], return_keys_arg=["output"]),
            tools=self.tools or [],
            **self.get_agent_kwargs(flatten=True),
        )

    @abstractmethod
    def create_agent_runnable(self) -> Runnable:
        """Create the agent."""

    def get_tool_name(self) -> str:
        return self.display_name or "Agent"

    def get_tool_description(self) -> str:
        return DEFAULT_TOOLS_DESCRIPTION

    def _build_tools_names(self):
        tools_names = ""
        if self.tools:
            tools_names = ", ".join([tool.name for tool in self.tools])
        return tools_names

    # Set shared callbacks for tracing
    def set_tools_callbacks(self, tools_list: list[Tool], callbacks_list: list[BaseCallbackHandler]):
        """Set shared callbacks for tracing to the tools.

        If we do not pass down the same callbacks to each tool
        used by the agent, then each tool will instantiate a new callback.
        For some tracing services, this will cause
        the callback handler to lose the id of its parent run (Agent)
        and thus throw an error in the tracing service client.

        Args:
            tools_list: list of tools to set the callbacks for
            callbacks_list: list of callbacks to set for the tools
        Returns:
            None
        """
        for tool in tools_list or []:
            if hasattr(tool, "callbacks"):
                tool.callbacks = callbacks_list

    async def _get_tools(self) -> list[Tool]:
        component_toolkit = _get_component_toolkit()
        tools_names = self._build_tools_names()
        description = f"{DEFAULT_TOOLS_DESCRIPTION}{tools_names}"

        tools = component_toolkit(component=self).get_tools(
            tool_name=self.get_tool_name(),
            tool_description=description,
            # here we do not use the shared callbacks as we are exposing the agent as a tool
            callbacks=self.get_langchain_callbacks(),
        )
        if hasattr(self, "tools_metadata"):
            tools = component_toolkit(component=self, metadata=self.tools_metadata).update_tools_metadata(tools=tools)

        return tools
