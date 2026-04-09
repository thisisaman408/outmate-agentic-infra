"""Dynamic Mistral AI model discovery.

This module fetches available models directly from the Mistral API
and caches the results, eliminating the need for manual metadata updates.
"""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

from lfx.log.logger import logger


class MistralModelDiscovery:
    """Discovers and caches Mistral model capabilities dynamically."""

    # Cache file location - use local cache directory within models
    CACHE_FILE = Path(__file__).parent / ".cache" / "mistral_models_cache.json"
    CACHE_DURATION = timedelta(hours=24)  # Refresh cache every 24 hours

    # Models to skip from LLM list (embedding, moderation, OCR-only models)
    SKIP_PATTERNS = ["embed", "moderation", "guard"]

    def __init__(self, api_key: str | None = None, base_url: str = "https://api.mistral.ai"):
        """Initialize discovery with optional API key.

        Args:
            api_key: Mistral API key. If None, only cached data will be used.
            base_url: Mistral API base URL
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def get_models(self, *, force_refresh: bool = False) -> dict[str, dict[str, Any]]:
        """Get available models with their capabilities.

        Args:
            force_refresh: If True, bypass cache and fetch fresh data

        Returns:
            Dictionary mapping model IDs to their metadata:
            {
                "model-id": {
                    "name": "model-id",
                    "provider": "MistralAI",
                    "not_supported": True/False,
                    "last_tested": "2026-03-17T10:30:00"
                }
            }
        """
        # Try to load from cache first
        if not force_refresh:
            cached = self._load_cache()
            if cached:
                logger.info("Using cached Mistral model metadata")
                return cached

        # Fetch fresh data from API
        if not self.api_key:
            logger.warning("No API key provided, using minimal fallback list")
            return self._get_fallback_models()

        try:
            models_metadata = {}

            # Fetch list of available models from Mistral API
            available_models = self._fetch_available_models()
            logger.info(f"Found {len(available_models)} models from Mistral API")

            # Categorize models
            for model_id in available_models:
                is_non_llm = any(pattern in model_id.lower() for pattern in self.SKIP_PATTERNS)
                models_metadata[model_id] = {
                    "name": model_id,
                    "provider": "MistralAI",
                    "not_supported": is_non_llm,
                    "last_tested": datetime.now(timezone.utc).isoformat(),
                }

            # Save to cache
            self._save_cache(models_metadata)

        except (requests.RequestException, KeyError, ValueError, ImportError) as e:
            logger.exception(f"Error discovering Mistral models: {e}")
            return self._get_fallback_models()
        else:
            return models_metadata

    def _fetch_available_models(self) -> list[str]:
        """Fetch list of available models from Mistral API."""
        url = f"{self.base_url}/v1/models"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        model_list = response.json()
        # Use direct access to raise KeyError if 'data' is missing
        return [model["id"] for model in model_list["data"]]

    def _load_cache(self) -> dict[str, dict] | None:
        """Load cached model metadata if it exists and is fresh."""
        if not self.CACHE_FILE.exists():
            return None

        try:
            with self.CACHE_FILE.open() as f:
                cache_data = json.load(f)

            # Check cache age
            cache_time = datetime.fromisoformat(cache_data["cached_at"])
            if datetime.now(timezone.utc) - cache_time > self.CACHE_DURATION:
                logger.info("Mistral cache expired, will fetch fresh data")
                return None

            return cache_data["models"]

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.warning(f"Invalid Mistral cache file: {e}")
            return None

    def _save_cache(self, models_metadata: dict[str, dict]) -> None:
        """Save model metadata to cache."""
        try:
            cache_data = {"cached_at": datetime.now(timezone.utc).isoformat(), "models": models_metadata}

            self.CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with self.CACHE_FILE.open("w") as f:
                json.dump(cache_data, f, indent=2)

            logger.info(f"Cached {len(models_metadata)} Mistral models to {self.CACHE_FILE}")

        except (OSError, TypeError, ValueError) as e:
            logger.warning(f"Failed to save Mistral cache: {e}")

    def _get_fallback_models(self) -> dict[str, dict]:
        """Return minimal fallback list when API is unavailable."""
        return {
            "mistral-large-latest": {
                "name": "mistral-large-latest",
                "provider": "MistralAI",
            },
            "mistral-small-latest": {
                "name": "mistral-small-latest",
                "provider": "MistralAI",
            },
            "mistral-medium-latest": {
                "name": "mistral-medium-latest",
                "provider": "MistralAI",
            },
            "codestral-latest": {
                "name": "codestral-latest",
                "provider": "MistralAI",
            },
            "magistral-medium-latest": {
                "name": "magistral-medium-latest",
                "provider": "MistralAI",
            },
            "magistral-small-latest": {
                "name": "magistral-small-latest",
                "provider": "MistralAI",
            },
        }


# Convenience function for use in other modules
def get_mistral_models(
    api_key: str | None = None, base_url: str = "https://api.mistral.ai", *, force_refresh: bool = False
) -> dict[str, dict]:
    """Get Mistral models with their capabilities.

    Args:
        api_key: Optional API key for fetching. If None, uses cached data.
        base_url: Mistral API base URL.
        force_refresh: If True, bypass cache and fetch fresh data.

    Returns:
        Dictionary of model metadata
    """
    discovery = MistralModelDiscovery(api_key=api_key, base_url=base_url)
    return discovery.get_models(force_refresh=force_refresh)
