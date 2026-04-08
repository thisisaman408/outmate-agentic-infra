from langchain_mistralai import ChatMistralAI
from pydantic.v1 import SecretStr

from lfx.base.models.mistral_constants import MISTRAL_MODELS
from lfx.base.models.mistral_model_discovery import get_mistral_models
from lfx.base.models.model import LCModelComponent
from lfx.field_typing import LanguageModel
from lfx.io import BoolInput, DropdownInput, FloatInput, IntInput, SecretStrInput, StrInput
from lfx.log.logger import logger


class MistralAIModelComponent(LCModelComponent):
    display_name = "MistralAI"
    description = "Generates text using MistralAI LLMs."
    icon = "MistralAI"
    name = "MistralModel"

    inputs = [
        *LCModelComponent.get_base_inputs(),
        IntInput(
            name="max_tokens",
            display_name="Max Tokens",
            advanced=True,
            info="The maximum number of tokens to generate. Set to 0 for unlimited tokens.",
        ),
        DropdownInput(
            name="model_name",
            display_name="Model Name",
            info="The name of the model to use. Add your Mistral API key to access additional available models.",
            advanced=False,
            options=MISTRAL_MODELS,
            value="mistral-large-latest",
            refresh_button=True,
            combobox=True,
        ),
        StrInput(
            name="mistral_api_base",
            display_name="Mistral API Base",
            advanced=True,
            info="The base URL of the Mistral API. Defaults to https://api.mistral.ai/v1. "
            "You can change this to use other APIs like JinaChat, LocalAI and Prem.",
        ),
        SecretStrInput(
            name="api_key",
            display_name="Mistral API Key",
            info="The Mistral API Key to use for the Mistral model.",
            advanced=False,
            required=True,
            value="MISTRAL_API_KEY",
            real_time_refresh=True,
        ),
        FloatInput(
            name="temperature",
            display_name="Temperature",
            value=0.1,
            advanced=True,
        ),
        IntInput(
            name="max_retries",
            display_name="Max Retries",
            advanced=True,
            value=5,
        ),
        IntInput(
            name="timeout",
            display_name="Timeout",
            advanced=True,
            value=60,
        ),
        IntInput(
            name="max_concurrent_requests",
            display_name="Max Concurrent Requests",
            advanced=True,
            value=3,
        ),
        FloatInput(
            name="top_p",
            display_name="Top P",
            advanced=True,
            value=1,
        ),
        IntInput(
            name="random_seed",
            display_name="Random Seed",
            value=1,
            advanced=True,
        ),
        BoolInput(
            name="safe_mode",
            display_name="Safe Mode",
            advanced=True,
            value=False,
        ),
    ]

    def get_models(self) -> list[str]:
        """Get available Mistral models using the dynamic discovery system.

        This method uses the mistral_model_discovery module which:
        - Fetches models directly from Mistral API (/v1/models)
        - Caches results for 24 hours
        - Falls back to hardcoded list if API fails

        Returns:
            List of available model IDs
        """
        try:
            api_key = self.api_key if hasattr(self, "api_key") and self.api_key else None
            base_url = self.mistral_api_base or "https://api.mistral.ai"
            # Strip /v1 suffix if present since the discovery module adds it
            base_url = base_url.rstrip("/")
            if base_url.endswith("/v1"):
                base_url = base_url[:-3]

            models_metadata = get_mistral_models(api_key=api_key, base_url=base_url)

            # Filter out non-LLM models (embeddings, moderation, etc.)
            model_ids = [
                model_id for model_id, metadata in models_metadata.items() if not metadata.get("not_supported", False)
            ]

            logger.info(f"Loaded {len(model_ids)} Mistral models")
        except (ValueError, KeyError, TypeError, ImportError) as e:
            logger.exception(f"Error getting Mistral model names: {e}")
            return MISTRAL_MODELS
        else:
            return model_ids

    def update_build_config(self, build_config: dict, field_value: str, field_name: str | None = None):
        if field_name in {"mistral_api_base", "model_name", "api_key"} and field_value:
            try:
                if len(self.api_key) != 0:
                    try:
                        ids = self.get_models()
                    except (ValueError, KeyError, TypeError, ImportError) as e:
                        logger.exception(f"Error getting Mistral model names: {e}")
                        ids = MISTRAL_MODELS
                    build_config.setdefault("model_name", {})
                    build_config["model_name"]["options"] = ids
                    build_config["model_name"].setdefault("value", ids[0] if ids else "mistral-large-latest")
            except (ValueError, KeyError, TypeError, AttributeError) as e:
                msg = f"Error getting Mistral model names: {e}"
                raise ValueError(msg) from e
        return build_config

    def build_model(self) -> LanguageModel:  # type: ignore[type-var]
        try:
            return ChatMistralAI(
                model_name=self.model_name,
                mistral_api_key=SecretStr(self.api_key).get_secret_value() if self.api_key else None,
                endpoint=self.mistral_api_base or "https://api.mistral.ai/v1",
                max_tokens=self.max_tokens or None,
                temperature=self.temperature,
                max_retries=self.max_retries,
                timeout=self.timeout,
                max_concurrent_requests=self.max_concurrent_requests,
                top_p=self.top_p,
                random_seed=self.random_seed,
                safe_mode=self.safe_mode,
                streaming=self.stream,
            )
        except Exception as e:
            msg = "Could not connect to MistralAI API."
            raise ValueError(msg) from e
