"""
Production-Grade Settings Module

This module provides centralized configuration management with:
- Environment-based configuration
- Secret validation
- Type safety with Pydantic
- Azure KeyVault integration ready
- Comprehensive documentation

No hardcoded secrets - all come from environment variables.
"""

import os
import json
from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, ValidationInfo
from dotenv import load_dotenv


class Settings(BaseSettings):
    """
    Application Settings - Production Ready
    
    All configuration comes from environment variables. No hardcoded values.
    
    Priority order:
    1. Environment variables
    2. .env file (development only)
    3. Default values (for optional settings only)
    
    For Azure deployment:
    - Load secrets from Azure Key Vault
    - Use Managed Identity for authentication
    - Never store secrets in code or config files
    """

    # ========================================================================
    # REQUIRED CONFIGURATION (Must be provided in environment)
    # ========================================================================

    # Database
    DATABASE_URL: str = Field(
        ...,  # Required - must be provided
        description="PostgreSQL connection string with credentials"
    )

    # Redis/Cache
    REDIS_URL: str = Field(
        "redis://localhost:6379/0",
        description="Redis connection URL"
    )

    # Authentication
    JWT_SECRET: str = Field(
        ...,
        description="JWT signing secret (32+ bytes, cryptographically strong)"
    )
    JWT_EXPIRES_IN: str = Field(
        "24h",
        description="JWT token expiration time"
    )

    # API Keys - Core Services
    CRUSTDATA_API_KEY: str = Field(
        ...,
        description="CrustData API key for prospect/company search"
    )
    EXPLORIUM_API_KEY: str = Field(
        ...,
        description="Explorium API key for business intelligence"
    )
    CONTACTOUT_API_KEY: str = Field(
        ...,
        description="ContactOut API key for email enrichment"
    )
    OPENROUTER_API_KEY: str = Field(
        ...,
        description="OpenRouter API key for LLM access"
    )

    # ========================================================================
    # OPTIONAL CONFIGURATION (Defaults provided, can be overridden)
    # ========================================================================

    # Application Settings
    APP_NAME: str = Field(
        "Outmate AI - Backend API",
        description="Application name"
    )
    APP_VERSION: str = Field(
        "1.0.0",
        description="Application semantic version"
    )
    ENVIRONMENT: str = Field(
        "development",
        description="Runtime environment: development, staging, production"
    )
    DEBUG: bool = Field(
        False,
        description="Enable debug mode (disable in production)"
    )

    # Logging
    LOG_LEVEL: str = Field(
        "INFO",
        description="Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL"
    )
    LOG_FORMAT: str = Field(
        "text",
        description="Logging format: text or json (use json for production)"
    )

    # Database Connection Pool
    DATABASE_POOL_SIZE: int = Field(
        5,
        description="Number of database connections to keep in pool"
    )
    DATABASE_MAX_OVERFLOW: int = Field(
        10,
        description="Maximum additional connections when pool exhausted"
    )
    DATABASE_POOL_TIMEOUT: int = Field(
        30,
        description="Timeout in seconds when all connections checked out"
    )
    DATABASE_POOL_RECYCLE: int = Field(
        1800,
        description="Recycle database connections after N seconds (Supabase: 1800)"
    )

    # Redis/Celery
    REDIS_HOST: str = Field(
        "localhost",
        description="Redis host"
    )
    REDIS_PORT: int = Field(
        6379,
        description="Redis port"
    )

    # CORS Configuration
    CORS_ALLOWED_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://outmate-signal-craft.lovable.app",
        ],
        description="Frontend origins allowed for CORS"
    )

    # API Configuration
    API_BASE_URL: str = Field(
        "http://localhost:8000",
        description="Backend API base URL"
    )
    APP_WEBHOOK_URL: str = Field(
        "http://localhost:3000",
        description="Webhook callback URL"
    )

    # Service Configuration
    CRUSTDATA_BASE_URL: str = Field(
        "https://api.crustdata.com",
        description="CrustData API base URL"
    )
    CRUSTDATA_TIMEOUT: int = Field(
        30,
        description="CrustData timeout in seconds"
    )

    EXPLORIUM_BASE_URL: str = Field(
        "https://api.explorium.ai/v1",
        description="Explorium API base URL"
    )
    EXPLORIUM_TIMEOUT: int = Field(
        30,
        description="Explorium timeout in seconds"
    )
    EXPLORIUM_TENANT: Optional[str] = Field(
        None,
        description="Explorium tenant ID (optional)"
    )

    CONTACTOUT_TIMEOUT: int = Field(
        30,
        description="ContactOut timeout in seconds"
    )

    OPENROUTER_BASE_URL: str = Field(
        "https://openrouter.ai/api/v1",
        description="OpenRouter API base URL"
    )

    # Optional API Keys
    GEMINI_API_KEY: Optional[str] = Field(
        None,
        description="Google Gemini API key (optional)"
    )
    PERPLEXITY_API_KEY: Optional[str] = Field(
        None,
        description="Perplexity AI API key (optional)"
    )
    SERPER_API_KEY: Optional[str] = Field(
        None,
        description="Serper search API key (optional)"
    )
    SEC_API_KEY: Optional[str] = Field(
        None,
        description="SEC API key for financial data (optional)"
    )
    TAVILY_API_KEY: Optional[str] = Field(
        None,
        description="Tavily search API key (optional)"
    )
    IPINFO_TOKEN: Optional[str] = Field(
        None,
        description="IPinfo API token (optional)"
    )
    ENRICH_API_KEY: Optional[str] = Field(
        None,
        description="Enrich.so API key (optional)"
    )
    BRIGHTDATA_API_TOKEN: Optional[str] = Field(
        None,
        description="Brightdata API token (optional)"
    )
    CONTEXTUAL_AI_API_KEY: Optional[str] = Field(
        None,
        description="Contextual AI API key (optional)"
    )

    # OpenAI Configuration (routed through OpenRouter)
    OPENAI_API_KEY: Optional[str] = Field(
        None,
        description="OpenAI API key (can use OpenRouter key)"
    )
    OPENAI_API_BASE: Optional[str] = Field(
        None,
        description="OpenAI API base URL (for OpenRouter compatibility)"
    )

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = Field(
        None,
        description="Google OAuth Client ID"
    )
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(
        None,
        description="Google OAuth Client Secret"
    )
    GOOGLE_REDIRECT_URI: Optional[str] = Field(
        None,
        description="Google OAuth redirect URI"
    )

    # Unipile Email Configuration
    UNIPILE_API_KEY: Optional[str] = Field(
        None,
        description="Unipile API key for email integration"
    )
    UNIPILE_DSN: Optional[str] = Field(
        None,
        description="Unipile DSN endpoint"
    )

    # Visitor Tracking
    VISITOR_DEDUPE_SECONDS: int = Field(
        3600,
        description="Visitor deduplication window in seconds"
    )

    # ========================================================================
    # VALIDATORS - Ensure configuration is valid
    # ========================================================================

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Ensure environment is a valid value"""
        valid_envs = {"development", "staging", "production"}
        if v.lower() not in valid_envs:
            raise ValueError(
                f"ENVIRONMENT must be one of {valid_envs}, got: {v}"
            )
        return v.lower()

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Ensure log level is valid"""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if v.upper() not in valid_levels:
            raise ValueError(
                f"LOG_LEVEL must be one of {valid_levels}, got: {v}"
            )
        return v.upper()

    @field_validator("LOG_FORMAT")
    @classmethod
    def validate_log_format(cls, v: str) -> str:
        """Ensure log format is valid"""
        valid_formats = {"text", "json"}
        if v.lower() not in valid_formats:
            raise ValueError(
                f"LOG_FORMAT must be one of {valid_formats}, got: {v}"
            )
        return v.lower()

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Ensure JWT secret is cryptographically strong"""
        if not v or len(v) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters. "
                "Generate with: openssl rand -hex 32"
            )
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure database URL is valid"""
        if not v or not v.startswith(("postgresql://", "postgresql+psycopg2://")):
            raise ValueError(
                "DATABASE_URL must be a valid PostgreSQL connection string"
            )
        return v

    @field_validator(
        "CRUSTDATA_API_KEY",
        "EXPLORIUM_API_KEY",
        "CONTACTOUT_API_KEY",
        "OPENROUTER_API_KEY",
    )
    @classmethod
    def validate_api_keys(cls, v: str, info: ValidationInfo) -> str:
        """Ensure required API keys are not placeholders"""
        if not v:
            raise ValueError(
                f"{info.field_name} is required and cannot be empty"
            )
        placeholders = {
            "your_api_key_here",
            "your_crustdata_api_key_here",
            "your_explorium_api_key_here",
            "your_contactout_api_key_here",
            "sk-or-v1-your_openrouter_api_key_here",
        }
        if v in placeholders:
            raise ValueError(
                f"{info.field_name} is still set to placeholder value. "
                f"Please provide actual API key."
            )
        return v

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Allow comma-separated string or list for CORS origins"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # ========================================================================
    # COMPUTED PROPERTIES
    # ========================================================================

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == "development"

    @property
    def is_staging(self) -> bool:
        """Check if running in staging"""
        return self.ENVIRONMENT == "staging"

    @property
    def database_url_masked(self) -> str:
        """Return database URL with password masked for logging"""
        if "://" in self.DATABASE_URL:
            parts = self.DATABASE_URL.split("://")
            protocol = parts[0]
            rest = parts[1]
            if "@" in rest:
                creds, host = rest.rsplit("@", 1)
                username = creds.split(":")[0]
                return f"{protocol}://{username}:****@{host}"
            return self.DATABASE_URL
        return "****"

    @property
    def redis_url_masked(self) -> str:
        """Return Redis URL with password masked for logging"""
        if "://" in self.REDIS_URL:
            parts = self.REDIS_URL.split("://")
            protocol = parts[0]
            rest = parts[1]
            if "@" in rest:
                creds, host = rest.rsplit("@", 1)
                return f"{protocol}://****:****@{host}"
            return self.REDIS_URL
        return "****"

    # ========================================================================
    # PYDANTIC CONFIGURATION
    # ========================================================================

    class Config:
        """Pydantic configuration"""
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"  # Allow extra fields from environment


# ============================================================================
# INITIALIZATION & VALIDATION
# ============================================================================

def load_settings() -> Settings:
    """
    Load and validate settings from environment.
    
    This should be called once at application startup.
    
    Raises:
        ValueError: If required environment variables are missing or invalid
    """
    # Load .env file for development (if it exists)
    env_file_path = Path(__file__).resolve().parents[2] / ".env"
    if env_file_path.exists():
        load_dotenv(env_file_path, override=True)

    try:
        settings = Settings()
        return settings
    except Exception as e:
        error_msg = (
            f"\n{'='*70}\n"
            f"CONFIGURATION ERROR: Failed to load settings\n"
            f"{'='*70}\n"
            f"{str(e)}\n\n"
            f"Ensure all required environment variables are set:\n"
            f"  - DATABASE_URL\n"
            f"  - JWT_SECRET (min 32 characters)\n"
            f"  - CRUSTDATA_API_KEY\n"
            f"  - EXPLORIUM_API_KEY\n"
            f"  - CONTACTOUT_API_KEY\n"
            f"  - OPENROUTER_API_KEY\n\n"
            f"For development, copy '.env.example' to '.env' and fill in values.\n"
            f"For production, use Azure Key Vault or environment variables.\n"
            f"{'='*70}\n"
        )
        print(error_msg)
        raise


# Create global settings instance
try:
    settings = load_settings()
except Exception:
    raise


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = ["Settings", "settings", "load_settings"]
