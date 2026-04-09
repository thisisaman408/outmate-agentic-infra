import requests
from pydantic.v1 import SecretStr
from typing_extensions import override

from lfx.base.models.model import LCModelComponent
from lfx.field_typing import LanguageModel
from lfx.field_typing.range_spec import RangeSpec
from lfx.inputs.inputs import DropdownInput, IntInput, SecretStrInput, SliderInput, StrInput

KIMI_MODELS = ["moonshot-v1-auto", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"]


class KimiModelComponent(LCModelComponent):
    display_name = "Kimi"
    description = "Generate text using Moonshot AI Kimi models."
    icon = "Moon"
    name = "KimiModel"

    inputs = [
        *LCModelComponent.get_base_inputs(),
        DropdownInput(
            name="model_name",
            display_name="Model Name",
            info="Moonshot AI Kimi model to use",
            options=KIMI_MODELS,
            value="moonshot-v1-auto",
            refresh_button=True,
            combobox=True,
        ),
        SecretStrInput(
            name="api_key",
            display_name="Moonshot API Key",
            info="The Moonshot AI API Key",
            advanced=False,
            required=True,
        ),
        StrInput(
            name="api_base",
            display_name="Moonshot API Base",
            advanced=True,
            info="Base URL for API requests. Defaults to https://api.moonshot.cn/v1",
            value="https://api.moonshot.cn/v1",
        ),
        SliderInput(
            name="temperature",
            display_name="Temperature",
            info="Controls randomness in responses",
            value=0.3,
            range_spec=RangeSpec(min=0, max=1, step=0.01),
            advanced=True,
        ),
        IntInput(
            name="max_tokens",
            display_name="Max Tokens",
            advanced=True,
            info="Maximum number of tokens to generate.",
        ),
        IntInput(
            name="seed",
            display_name="Seed",
            info="The seed controls the reproducibility of the job.",
            advanced=True,
        ),
    ]

    def get_models(self) -> list[str]:
        if not self.api_key:
            return KIMI_MODELS

        url = f"{self.api_base}/models"
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            model_list = response.json()
            return [model["id"] for model in model_list.get("data", [])]
        except requests.RequestException as e:
            self.status = f"Error fetching models: {e}"
            return KIMI_MODELS

    @override
    def update_build_config(self, build_config: dict, field_value: str, field_name: str | None = None):
        if field_name in {"api_key", "api_base", "model_name"}:
            models = self.get_models()
            build_config["model_name"]["options"] = models
        return build_config

    def build_model(self) -> LanguageModel:
        try:
            from langchain_openai import ChatOpenAI
        except ImportError as e:
            msg = "langchain-openai not installed. Please install with `pip install langchain-openai`"
            raise ImportError(msg) from e

        output = ChatOpenAI(
            model=self.model_name,
            api_key=SecretStr(self.api_key),
            base_url=self.api_base,
            temperature=self.temperature,
            max_tokens=self.max_tokens or None,
            seed=self.seed or None,
        )

        return output

    def _get_exception_message(self, e: Exception):
        """Get message from Moonshot AI API exception."""
        try:
            from openai import BadRequestError

            if isinstance(e, BadRequestError):
                message = e.body.get("message")
                if message:
                    return message
        except ImportError:
            pass
        return None
