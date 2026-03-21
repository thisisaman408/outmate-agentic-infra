import httpx
import json
from typing import AsyncGenerator, List, Dict, Any

from app.core.config import settings


class OpenRouterService:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.model = "anthropic/claude-3.5-haiku"

    async def chat_completion(self, prompt: str) -> str:
        payload = {
            "model": self.model,
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
    ) -> str:
        """Send system + user message and return plain text response."""
        payload = {
            "model": self.model,
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
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
            if response.status_code >= 400:
                raise httpx.HTTPStatusError(
                    f"{response.status_code} {response.reason_phrase}: {response.text}",
                    request=response.request,
                    response=response,
                )
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            if isinstance(content, list):
                content = "".join(c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text")
            return str(content).strip()

    async def chat_completion_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> dict:
        """Send system + user message and return parsed JSON response."""
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        async with httpx.AsyncClient(timeout=45) as client:
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
            content = message.get("content", "")
            if isinstance(content, list):
                content = "".join(
                    chunk.get("text", "") for chunk in content
                    if isinstance(chunk, dict) and chunk.get("type") == "text"
                ).strip()
            return json.loads(content)

    async def chat_completion_structured_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream LLM response as SSE chunks, then yield final parsed JSON.

        Yields dicts of two kinds:
          {"type": "token", "content": "..."}   — partial text delta
          {"type": "done",  "result": {...}}     — final parsed JSON object
        """
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-OpenRouter-Title": "Outmate AI",
        }

        accumulated = ""
        async with httpx.AsyncClient(timeout=45) as client:
            async with client.stream(
                "POST", f"{self.base_url}/chat/completions", json=payload, headers=headers
            ) as response:
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
                    except (json.JSONDecodeError, IndexError):
                        continue

        # Parse the accumulated JSON and yield the final result
        try:
            result = json.loads(accumulated)
        except json.JSONDecodeError:
            result = {"raw_text": accumulated}
        yield {"type": "done", "result": result}
