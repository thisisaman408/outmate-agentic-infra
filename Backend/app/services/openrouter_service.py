import httpx
import json
import asyncio
import time
import logging
import re
from typing import AsyncGenerator, List, Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


# System prompts per agent type
AGENT_SYSTEM_PROMPTS = {
    "sdr": """You are an expert B2B Sales Development Representative (SDR) copywriter.
Your role is to craft compelling, personalized outreach messages that:
- Reference specific company signals and achievements
- Identify the strongest value proposition
- Use professional but conversational tone
- Include clear, low-friction CTAs
- Use {{firstName}} and {{companyName}} placeholders for personalization
Keep messages concise and impactful. Never use PII beyond placeholders.""",

    "research": """You are a thorough B2B market research analyst. Your role is to:
- Synthesize company research into actionable intelligence
- Identify key decision makers and stakeholders
- Extract hiring, funding, and product signals
- Provide context on market positioning and growth
- Format findings clearly with evidence sources
Never expose full email addresses or phone numbers—use placeholders.""",

    "scoring": """You are an expert predictive lead scoring model. Your role is to:
- Analyze company attributes against ICP criteria
- Score leads 0-100 based on fit and timing
- Identify key factors driving the score
- Highlight strengths and gaps
- Provide actionable next steps
Be objective and data-driven in all assessments.""",

    "enrichment": """You are a B2B data enrichment specialist. Your role is to:
- Extract and validate company information
- Identify relevant team members and roles
- Compile market signals and growth indicators
- Structure data cleanly and comprehensively
- Flag data quality issues or missing fields
Ensure accuracy and consistency in all enrichments.""",

    "campaign": """You are an expert B2B outreach campaign strategist. Your role is to:
- Create personalized multi-touch campaign messaging
- Craft distinct email and LinkedIn touch variations
- Reference specific company data and signals
- Optimize for engagement and response
- Use {{firstName}} and {{companyName}} placeholders
Keep all messaging under 120 words per channel.""",
}


class OpenRouterService:
    def __init__(self, api_key: Optional[str] = None, user_id: Optional[str] = None, use_byok: bool = False):
        # Support BYOK (Bring Your Own Key) flow
        self.use_byok = use_byok
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.default_model = "anthropic/claude-sonnet-4.6"
        self.fallback_model = "openai/gpt-4o"
        self.max_retries = 2
        self.backoff_factor = 2
        self.max_backoff_time = 60  # Max 60 seconds between retries
        self.user_id = user_id  # For BYOK flow tracking

    # Credit consumption rates (approximate per 1K tokens)
    CREDIT_RATES = {
        "anthropic/claude-sonnet-4.6": {
            "input": 3.0,    # $3 per 1M input tokens
            "output": 15.0,  # $15 per 1M output tokens
        },
        "openai/gpt-4o": {
            "input": 2.5,    # $2.5 per 1M input tokens
            "output": 10.0,  # $10 per 1M output tokens
        }
    }

    @staticmethod
    def mask_pii(text: str) -> str:
        """Mask PII in text for logging and prompt safety.
        Replaces full email addresses and phone numbers with placeholders."""
        # Mask email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '{{EMAIL}}', text)
        # Mask phone numbers (various formats)
        text = re.sub(r'\b(\+?1?)[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b', '{{PHONE}}', text)
        return text

    @staticmethod
    def get_system_prompt(agent_type: str) -> str:
        """Get system prompt for a specific agent type."""
        return AGENT_SYSTEM_PROMPTS.get(
            agent_type.lower(),
            AGENT_SYSTEM_PROMPTS["research"]  # Default to research
        )

    @staticmethod
    def create_cache_control_header(expires_in: int = 3600) -> Dict[str, Any]:
        """Create cache control header for prompt caching.
        expires_in: seconds until cache expires (default 1 hour)"""
        return {
            "type": "ephemeral",  # Ephemeral cache for this session/request
            "expires_in": expires_in
        }

    def _calculate_credits(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate credit consumption based on token usage."""
        rates = self.CREDIT_RATES.get(model, self.CREDIT_RATES[self.fallback_model])
        input_credits = (input_tokens / 1000000) * rates["input"]
        output_credits = (output_tokens / 1000000) * rates["output"]
        return input_credits + output_credits

    def _log_token_usage(self, model: str, input_tokens: int, output_tokens: int, agent_type: str):
        """Log token usage and credit consumption."""
        credits_used = self._calculate_credits(model, input_tokens, output_tokens)

        logger.info(
            f"Token usage - Model: {model}, Agent: {agent_type}, "
            f"Input: {input_tokens}, Output: {output_tokens}, "
            f"Credits: {credits_used:.6f}, User: {self.user_id or 'system'}"
        )

        # Here you would typically save to database or send to billing system
        # For now, we'll just log it

    async def _make_request(self, payload: dict, headers: dict, timeout: int = 45, stream: bool = False) -> httpx.Response:
        """Make HTTP request with exponential backoff retry logic."""
        last_exception = None

        for attempt in range(self.max_retries + 1):  # +1 for initial attempt
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    if stream:
                        return await client.stream("POST", f"{self.base_url}/chat/completions", json=payload, headers=headers)
                    else:
                        response = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)

                    # If rate limited (429), wait and retry
                    if response.status_code == 429:
                        if attempt < self.max_retries:
                            wait_time = min(self.backoff_factor ** attempt, self.max_backoff_time)
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            raise httpx.HTTPStatusError(
                                f"429 Rate Limited after {self.max_retries} retries",
                                request=response.request,
                                response=response,
                            )

                    # Return response for non-429 errors (will be handled by caller)
                    return response

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_exception = e
                if attempt < self.max_retries:
                    wait_time = min(self.backoff_factor ** attempt, self.max_backoff_time)
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise e

        # This should never be reached, but just in case
        raise last_exception or Exception("Max retries exceeded")

    async def _try_completion_with_fallback(self, payload: dict, headers: dict, timeout: int = 45, stream: bool = False):
        """Try completion with default model, fallback to secondary model on failure."""
        # Try with default model first
        payload["model"] = self.default_model
        try:
            response = await self._make_request(payload, headers, timeout, stream)
            if stream:
                return response
            elif response.status_code < 400:
                return response
            else:
                # Check if it's a 5xx server error that should trigger fallback
                if 500 <= response.status_code < 600:
                    print(f"Primary model {self.default_model} returned {response.status_code}, trying fallback")
                else:
                    # For 4xx errors, don't fallback as they're client errors
                    return response
        except Exception as e:
            print(f"Primary model {self.default_model} failed with error: {str(e)}, trying fallback")

        # Try with fallback model
        payload["model"] = self.fallback_model
        return await self._make_request(payload, headers, timeout, stream)

    async def chat_completion(self, prompt: str) -> str:
        payload = {
            "model": self.default_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt,
                        }
                    ],
                }
            ],
            "temperature": 0.7,
            "max_tokens": 800,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
            if response.status_code >= 400:
                raise httpx.HTTPStatusError(
                    f"{response.status_code} {response.reason_phrase}: {response.text}",
                    request=response.request,
                    response=response,
                )
            data = response.json()
            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            content = message.get("content", [])
            if isinstance(content, list):
                texts = []
                for chunk in content:
                    if isinstance(chunk, dict) and "type" in chunk and chunk["type"] == "text":
                        texts.append(chunk.get("text", ""))
                return "".join(texts).strip()
            return str(content)

    async def chat_completion_text(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 2000,
        agent_type: str = "unknown",
    ) -> str:
        """Send system + user message and return plain text response."""
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        response = await self._try_completion_with_fallback(payload, headers, timeout=45)

        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"{response.status_code} {response.reason_phrase}: {response.text}",
                request=response.request,
                response=response,
            )

        data = response.json()

        if "error" in data:
            err = data["error"]
            raise ValueError(f"OpenRouter error: {err.get('message', err)}")

        choice = data.get("choices", [{}])[0]
        content = choice.get("message", {}).get("content", "")
        if isinstance(content, list):
            content = "".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")

        # Log token usage
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        model_used = payload.get("model", self.default_model)
        self._log_token_usage(model_used, input_tokens, output_tokens, agent_type)

        if not str(content).strip():
            finish_reason = choice.get("finish_reason", "unknown")
            raise ValueError(f"LLM returned empty content (finish_reason={finish_reason})")

        return str(content).strip()

    async def chat_completion_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        agent_type: str = "unknown",
    ) -> dict:
        """Send system + user message and return parsed JSON response."""
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # Only add response_format for OpenAI models — Claude handles JSON via prompt
        if "openai/" in self.default_model or "openai/" in self.fallback_model:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        response = await self._try_completion_with_fallback(payload, headers, timeout=45)

        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"{response.status_code} {response.reason_phrase}: {response.text}",
                request=response.request,
                response=response,
            )

        data = response.json()

        # OpenRouter may return a top-level error even on 200
        if "error" in data:
            err = data["error"]
            raise ValueError(f"OpenRouter error: {err.get('message', err)}")

        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = message.get("content", "")
        if isinstance(content, list):
            content = "".join(
                chunk.get("text", "") for chunk in content
                if isinstance(chunk, dict) and chunk.get("type") == "text"
            ).strip()

        # Log token usage
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        model_used = payload.get("model", self.default_model)
        self._log_token_usage(model_used, input_tokens, output_tokens, agent_type)

        if not content:
            finish_reason = choice.get("finish_reason", "unknown")
            raise ValueError(f"LLM returned empty content (finish_reason={finish_reason})")

        # Strip markdown code fences if model ignored json_object mode
        stripped = content.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            stripped = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        return json.loads(stripped)

    async def chat_completion_structured_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
        agent_type: str = "unknown",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream LLM response as SSE chunks, then yield final parsed JSON.

        Yields dicts of two kinds:
          {"type": "token", "content": "..."}   — partial text delta
          {"type": "done",  "result": {...}}     — final parsed JSON object
        """
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if "openai/" in self.default_model or "openai/" in self.fallback_model:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        accumulated = ""
        total_input_tokens = 0
        total_output_tokens = 0

        payload["model"] = self.default_model
        async with httpx.AsyncClient(timeout=45) as client:
            async with client.stream("POST", f"{self.base_url}/chat/completions", json=payload, headers=headers) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    raise httpx.HTTPStatusError(
                        f"{response.status_code}: {body.decode()}",
                        request=response.request,
                        response=response,
                    )
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        token = delta.get("content", "")
                        if token:
                            accumulated += token
                            yield {"type": "token", "content": token}
                        usage = chunk.get("usage", {})
                        if usage:
                            total_input_tokens = max(total_input_tokens, usage.get("prompt_tokens", 0))
                            total_output_tokens += usage.get("completion_tokens", 0)
                    except (json.JSONDecodeError, IndexError):
                        continue

        # Parse the accumulated JSON and yield the final result
        stripped = accumulated.strip()
        if stripped.startswith("```"):
            lines = stripped.split("\n")
            stripped = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            result = json.loads(stripped)
        except json.JSONDecodeError:
            result = {"raw_text": accumulated}

        # Log token usage for streaming
        model_used = payload.get("model", self.default_model)
        self._log_token_usage(model_used, total_input_tokens, total_output_tokens, agent_type)

        yield {"type": "done", "result": result}

    async def chat_completion_text_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 2000,
        agent_type: str = "unknown",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream plain text response with system + user messages.

        Yields dicts:
          {"type": "token", "content": "..."}   — partial text delta
          {"type": "done",  "result": "..."}     — final complete text
        """
        payload = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        accumulated = ""
        total_input_tokens = 0
        total_output_tokens = 0

        payload["model"] = self.default_model
        async with httpx.AsyncClient(timeout=45) as client:
            async with client.stream("POST", f"{self.base_url}/chat/completions", json=payload, headers=headers) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    raise httpx.HTTPStatusError(
                        f"{response.status_code}: {body.decode()}",
                        request=response.request,
                        response=response,
                    )
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        token = delta.get("content", "")
                        if token:
                            accumulated += token
                            yield {"type": "token", "content": token}
                        usage = chunk.get("usage", {})
                        if usage:
                            total_input_tokens = max(total_input_tokens, usage.get("prompt_tokens", 0))
                            total_output_tokens += usage.get("completion_tokens", 0)
                    except (json.JSONDecodeError, IndexError):
                        continue

        # Log token usage for streaming
        model_used = payload.get("model", self.default_model)
        self._log_token_usage(model_used, total_input_tokens, total_output_tokens, agent_type)

        yield {"type": "done", "result": accumulated.strip()}

    async def chat_with_tools(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> Dict[str, Any]:
        """Call Claude via OpenRouter with tool calling (OpenAI-compatible format).

        Args:
            system_prompt: System instructions for the agent
            messages: Conversation history [{"role": "user"/"assistant", "content": "..."}]
            tools: Tools in Anthropic format (with input_schema) — converted to OpenAI format internally
            temperature: Model temperature
            max_tokens: Max tokens in response

        Returns:
            Dict with "text" (assistant text), "tool_calls" (list of tool calls), "stop_reason"
        """

        # Convert Anthropic-format tools to OpenAI-compatible format
        openai_tools = []
        for tool in tools:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": tool.get("input_schema", {"type": "object", "properties": {}}),
                },
            })

        # Build messages with system as first message (OpenAI format)
        all_messages = [{"role": "system", "content": system_prompt}] + messages

        payload = {
            "messages": all_messages,
            "tools": openai_tools,
            "tool_choice": "auto",
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        response = await self._try_completion_with_fallback(payload, headers, timeout=45)

        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"{response.status_code} {response.reason_phrase}: {response.text}",
                request=response.request,
                response=response,
            )

        data = response.json()

        if "error" in data:
            err = data["error"]
            raise ValueError(f"OpenRouter error: {err.get('message', err)}")

        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        stop_reason = choice.get("finish_reason", "stop")

        # Extract text content
        text_content = message.get("content") or ""

        # Extract tool calls (OpenAI format → normalized format)
        raw_tool_calls = message.get("tool_calls") or []
        tool_calls = []
        for tc in raw_tool_calls:
            fn = tc.get("function", {})
            args_str = fn.get("arguments", "{}")
            try:
                args = json.loads(args_str)
            except json.JSONDecodeError:
                args = {"raw": args_str}
            tool_calls.append({
                "id": tc.get("id", ""),
                "name": fn.get("name", ""),
                "input": args,
            })

        # Log token usage
        usage = data.get("usage", {})
        self._log_token_usage(
            payload.get("model", self.default_model),
            usage.get("prompt_tokens", 0),
            usage.get("completion_tokens", 0),
            "automation_agent",
        )

        return {
            "text": text_content,
            "tool_calls": tool_calls,
            "stop_reason": stop_reason,
        }

    async def chat_with_tools_stream(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ):
        """Stream Claude's response with tool calling via SSE.

        Yields dicts:
          {"type": "text_delta", "text": "..."}   — incremental text from Claude
          {"type": "tool_calls", "tool_calls": [...]}  — final tool calls (all at once)

        Tool call arguments are accumulated across chunks and emitted once complete.
        """
        import json as _json

        # Convert Anthropic-format tools to OpenAI format
        openai_tools = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", {"type": "object", "properties": {}}),
                },
            }
            for t in tools
        ]

        all_messages = [{"role": "system", "content": system_prompt}] + messages

        payload = {
            "messages": all_messages,
            "tools": openai_tools,
            "tool_choice": "auto",
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        # Accumulate tool call arguments across delta chunks
        # Structure: {index: {"id": str, "name": str, "arguments": str}}
        pending_tool_calls: Dict[int, Dict[str, Any]] = {}
        finish_reason: str = "stop"

        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    raise ValueError(f"OpenRouter stream error {response.status_code}: {body.decode()}")

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = _json.loads(raw)
                    except _json.JSONDecodeError:
                        continue

                    choice = (chunk.get("choices") or [{}])[0]
                    finish_reason = choice.get("finish_reason") or finish_reason
                    delta = choice.get("delta", {})

                    # Stream text delta
                    text_piece = delta.get("content") or ""
                    if text_piece:
                        yield {"type": "text_delta", "text": text_piece}

                    # Accumulate tool call argument chunks
                    for tc_delta in delta.get("tool_calls") or []:
                        idx = tc_delta.get("index", 0)
                        if idx not in pending_tool_calls:
                            pending_tool_calls[idx] = {
                                "id": tc_delta.get("id", ""),
                                "name": tc_delta.get("function", {}).get("name", ""),
                                "arguments": "",
                            }
                        else:
                            if tc_delta.get("id"):
                                pending_tool_calls[idx]["id"] = tc_delta["id"]
                            if tc_delta.get("function", {}).get("name"):
                                pending_tool_calls[idx]["name"] = tc_delta["function"]["name"]

                        pending_tool_calls[idx]["arguments"] += (
                            tc_delta.get("function", {}).get("arguments", "")
                        )

        # Emit tool calls after stream ends
        if pending_tool_calls:
            tool_calls_out = []
            for idx in sorted(pending_tool_calls.keys()):
                tc = pending_tool_calls[idx]
                try:
                    args = _json.loads(tc["arguments"]) if tc["arguments"] else {}
                except _json.JSONDecodeError:
                    args = {"raw": tc["arguments"]}
                tool_calls_out.append({
                    "id": tc["id"] or f"tc_{idx}",
                    "name": tc["name"],
                    "input": args,
                })
            yield {"type": "tool_calls", "tool_calls": tool_calls_out}

    async def agent_call(
        self,
        user_prompt: str,
        agent_type: str = "research",
        temperature: float = 0.4,
        max_tokens: int = 2000,
        stream: bool = False,
    ) -> Any:
        """Call an agent with a proper system prompt injection.

        Args:
            user_prompt: The user's question/request
            agent_type: Type of agent (sdr, research, scoring, enrichment, campaign)
            temperature: Model temperature (0.3-0.7 recommended)
            max_tokens: Max tokens in response
            stream: Whether to stream the response

        Returns:
            String result if stream=False, AsyncGenerator if stream=True
        """
        system_prompt = self.get_system_prompt(agent_type)

        if stream:
            return self.chat_completion_text_stream(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                agent_type=agent_type,
            )
        else:
            return await self.chat_completion_text(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                agent_type=agent_type,
            )
