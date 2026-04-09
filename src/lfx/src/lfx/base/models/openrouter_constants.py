from .model_metadata import create_model_metadata

OPENROUTER_MODELS_DETAILED = [
    # ===== OpenAI via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="openai/gpt-4o", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="openai/gpt-4o-mini", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="openai/gpt-4-turbo", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="openai/gpt-5", icon="OpenRouter", tool_calling=True, reasoning=True),
    create_model_metadata(provider="OpenRouter", name="openai/gpt-5-mini", icon="OpenRouter", tool_calling=True, reasoning=True),
    create_model_metadata(provider="OpenRouter", name="openai/gpt-5.2", icon="OpenRouter", tool_calling=True, reasoning=True),
    create_model_metadata(provider="OpenRouter", name="openai/o1", icon="OpenRouter", tool_calling=True, reasoning=True),
    create_model_metadata(provider="OpenRouter", name="openai/o1-mini", icon="OpenRouter", tool_calling=True, reasoning=True),
    create_model_metadata(provider="OpenRouter", name="openai/o3-mini", icon="OpenRouter", tool_calling=True, reasoning=True),
    # ===== Anthropic via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="anthropic/claude-sonnet-4", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="anthropic/claude-sonnet-4.6", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="anthropic/claude-opus-4.6", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="anthropic/claude-3.5-sonnet", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="anthropic/claude-3.5-haiku", icon="OpenRouter", tool_calling=True),
    # ===== Google via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="google/gemini-2.5-pro-preview", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="google/gemini-2.5-flash-preview", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="google/gemini-2.0-flash-001", icon="OpenRouter", tool_calling=True),
    # ===== Meta Llama via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="meta-llama/llama-3.3-70b-instruct", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="meta-llama/llama-4-scout-17b-16e-instruct", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="meta-llama/llama-4-maverick-17b-128e-instruct", icon="OpenRouter", tool_calling=True),
    # ===== Mistral via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="mistralai/mistral-large-latest", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="mistralai/mistral-small-latest", icon="OpenRouter", tool_calling=True),
    # ===== DeepSeek via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="deepseek/deepseek-chat-v3-0324", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="deepseek/deepseek-r1", icon="OpenRouter", tool_calling=True, reasoning=True),
    # ===== Qwen via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="qwen/qwen-2.5-72b-instruct", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="qwen/qwen3-235b-a22b", icon="OpenRouter", tool_calling=True),
    # ===== xAI via OpenRouter =====
    create_model_metadata(provider="OpenRouter", name="x-ai/grok-3-beta", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="x-ai/grok-3-mini-beta", icon="OpenRouter", tool_calling=True),
    # ===== FREE Models (no cost, rate-limited) =====
    create_model_metadata(provider="OpenRouter", name="qwen/qwen3-coder:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="qwen/qwen3-next-80b-a3b-instruct:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="meta-llama/llama-3.3-70b-instruct:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="nvidia/nemotron-3-super-120b-a12b:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="stepfun/step-3.5-flash:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="mistralai/mistral-small-3.1-24b-instruct:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="z-ai/glm-4.5-air:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="minimax/minimax-m2.5:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="openai/gpt-oss-120b:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="google/gemma-3-27b-it:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="nvidia/nemotron-nano-12b-v2-vl:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="arcee-ai/trinity-large-preview:free", icon="OpenRouter", tool_calling=True),
    create_model_metadata(provider="OpenRouter", name="openrouter/free", icon="OpenRouter", tool_calling=True),
]
