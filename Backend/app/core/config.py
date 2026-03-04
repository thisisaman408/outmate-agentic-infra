"""
Application Configuration Module - Production Ready

This module provides configuration management for the Outmate AI backend.
It uses environment variables for all secrets - no hardcoded values.

For production deployment:
- Load secrets from Azure Key Vault
- Use environment variables (Azure App Service settings)
- Set ENVIRONMENT=production for stricter checks

See app/core/settings.py for the full Settings class definition.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file for development (if it exists)
env_file_path = Path(__file__).resolve().parents[2] / ".env"
if env_file_path.exists():
    load_dotenv(env_file_path, override=True)

# Import production-ready settings
from app.core.settings import Settings, load_settings

# Create global settings instance
try:
    settings = load_settings()
except Exception as e:
    print(f"ERROR: Failed to load configuration: {e}")
    raise

# Log configuration status
print(f"Configuration loaded for environment: {settings.ENVIRONMENT}")
print(f"Database URL (masked): {settings.database_url_masked}")
print(f"Redis URL (masked): {settings.redis_url_masked}")
print(f"Debug mode: {settings.DEBUG}")

# Export individual settings for backward compatibility
DATABASE_URL = settings.DATABASE_URL
REDIS_URL = settings.REDIS_URL
CRUSTDATA_API_KEY = settings.CRUSTDATA_API_KEY
