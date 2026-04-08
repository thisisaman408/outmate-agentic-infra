from .model_metadata import create_model_metadata

# Unified model metadata for Mistral AI
#
# NOTE: This file serves as a FALLBACK when the dynamic model discovery system
# (mistral_model_discovery.py) cannot fetch fresh data from the Mistral API.
#
# The dynamic system is the PRIMARY source and will:
# - Fetch available models directly from Mistral API (/v1/models)
# - Cache results for 24 hours
# - Always provide up-to-date model lists
#
# This fallback list should contain:
# - Current production models with their aliases
# - Deprecated models for backwards compatibility
#
# Last manually updated: 2026-03-17
#
MISTRAL_MODELS_DETAILED = [
    # ===== CURRENT PRODUCTION MODELS =====
    create_model_metadata(
        provider="MistralAI", name="mistral-large-latest", icon="MistralAI", tool_calling=True, default=True
    ),
    create_model_metadata(
        provider="MistralAI", name="mistral-small-latest", icon="MistralAI", tool_calling=True
    ),
    create_model_metadata(
        provider="MistralAI", name="mistral-medium-latest", icon="MistralAI", tool_calling=True
    ),
    create_model_metadata(
        provider="MistralAI", name="codestral-latest", icon="MistralAI", tool_calling=True
    ),
    # ===== REASONING MODELS =====
    create_model_metadata(
        provider="MistralAI", name="magistral-medium-latest", icon="MistralAI", reasoning=True
    ),
    create_model_metadata(
        provider="MistralAI", name="magistral-small-latest", icon="MistralAI", reasoning=True
    ),
    # ===== DEPRECATED / RETIRED MODELS =====
    # Keep these for backwards compatibility - users may have flows using them
    create_model_metadata(  # Retired March 2025
        provider="MistralAI", name="open-mixtral-8x7b", icon="MistralAI", deprecated=True
    ),
    create_model_metadata(  # Retired March 2025
        provider="MistralAI", name="open-mixtral-8x22b", icon="MistralAI", deprecated=True
    ),
]

# Generate backwards-compatible lists from the metadata
MISTRAL_PRODUCTION_MODELS = [
    metadata["name"]
    for metadata in MISTRAL_MODELS_DETAILED
    if not metadata.get("deprecated", False) and not metadata.get("not_supported", False)
]

DEPRECATED_MISTRAL_MODELS = [
    metadata["name"] for metadata in MISTRAL_MODELS_DETAILED if metadata.get("deprecated", False)
]

# Combined list of all current models for backward compatibility
MISTRAL_MODELS = MISTRAL_PRODUCTION_MODELS

# For reverse compatibility
MODEL_NAMES = MISTRAL_MODELS
