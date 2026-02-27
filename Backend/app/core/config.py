"""
Application configuration using Pydantic BaseSettings

This module centralizes all configuration in one place with:
- Type validation
- Environment variable loading
- Default values
- Required field validation
"""

import os
from pydantic_settings import BaseSettings
from pydantic import field_validator, Field, ValidationInfo
from typing import Optional, List
from pathlib import Path

from dotenv import load_dotenv


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    
    All settings can be provided via:
    - .env file
    - Environment variables
    - System environment
    
    Pydantic will automatically load and validate these settings.
    """
    
    # Database Configuration
    DATABASE_URL: str = Field(
        ...,  # Required field
        description="PostgreSQL database connection string"
    )
    
    # Redis Configuration
    REDIS_URL: str = Field(
        "redis://localhost:6379/0",
        description="Redis connection URL"
    )
    REDIS_HOST: str = Field(
        "localhost",
        description="Redis host"
    )
    REDIS_PORT: int = Field(
        6379,
        description="Redis port"
    )
    
    # CrustData API Configuration
    CRUSTDATA_API_KEY: str = Field(
        ...,  # Required field
        description="CrustData API authentication key"
    )
    CRUSTDATA_BASE_URL: str = Field(
        "https://api.crustdata.com",
        description="CrustData API base URL"
    )
    CRUSTDATA_TIMEOUT: int = Field(
        30,
        description="CrustData API timeout in seconds"
    )
    
    # Explorium API Configuration
    EXPLORIUM_API_KEY: str = Field(
        ...,  # Required field
        description="Explorium API authentication key"
    )
    EXPLORIUM_BASE_URL: str = Field(
        "https://api.explorium.ai/v1",
        description="Explorium API base URL"
    )
    EXPLORIUM_TIMEOUT: int = Field(
        30,
        description="Explorium API timeout in seconds"
    )
    EXPLORIUM_TENANT: Optional[str] = Field(
        None,
        description="Explorium tenant ID"
    )
    
    # ContactOut API Configuration
    CONTACTOUT_API_KEY: str = Field(
        ...,  # Required field
        description="ContactOut API authentication key"
    )
    CONTACTOUT_TIMEOUT: int = Field(
        30,
        description="ContactOut API timeout in seconds"
    )

    # Visitor Tracker Configuration
    IPINFO_TOKEN: Optional[str] = Field(
        None,
        description="IPinfo API token"
    )
    ENRICH_API_KEY: Optional[str] = Field(
        None,
        description="Enrich.so API key"
    )
    VISITOR_DEDUPE_SECONDS: int = Field(
        3600,
        description="How long to deduplicate visitor hits (seconds). Set to 0 to disable."
    )

    # OpenRouter Configuration
    OPENROUTER_API_KEY: str = Field(
        ..., 
        description="OpenRouter API key for Claude access"
    )
    OPENROUTER_BASE_URL: str = Field(
        "https://openrouter.ai/api/v1",
        description="OpenRouter API base URL"
    )
    
    # Logging Configuration
    LOG_LEVEL: str = Field(
        "INFO",
        description="Application log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)"
    )
    
    # Application Configuration
    APP_NAME: str = Field(
        "Outmate AI - Backend API",
        description="Application name"
    )
    APP_VERSION: str = Field(
        "1.0.0",
        description="Application version"
    )
    ENVIRONMENT: str = Field(
        "development",
        description="Environment name (development, staging, production)"
    )
    CORS_ALLOWED_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ],
        description="Front-end origins allowed to make cross-origin requests"
    )
    
    @field_validator('CRUSTDATA_API_KEY', 'EXPLORIUM_API_KEY', 'CONTACTOUT_API_KEY')
    def validate_api_keys(cls, v, info: ValidationInfo):
        """Validate API keys are not placeholders or empty"""
        placeholders = [
            "your_api_key_here", 
            "your_crustdata_api_key_here", 
            "your_explorium_api_key_here", 
            "your_contactout_api_key_here",
            ""
        ]
        if not v or v in placeholders:
            raise ValueError(
                f"{info.field_name} must be set to a valid API key. "
                "Please add it to your .env file."
            )
        return v
    
    @field_validator('DATABASE_URL')
    def validate_database_url(cls, v):
        """Validate database URL is set"""
        if not v:
            raise ValueError("DATABASE_URL is required and cannot be empty")
        return v
    
    @field_validator('LOG_LEVEL')
    def validate_log_level(cls, v):
        """Validate log level is valid"""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(
                f"LOG_LEVEL must be one of {valid_levels}. Got: {v}"
            )
        return v_upper
    
    class Config:
        """Pydantic configuration"""
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        
        # Allow extra fields from environment (for flexibility)
        extra = "allow"


dotenv_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path, override=True)

# Create global settings instance
try:
    settings = Settings()
except Exception as e:
    print(f"ERROR: Failed to load configuration: {e}")
    print("Please ensure your .env file is properly configured.")
    raise

print(f"Loaded .env from {dotenv_path}")
print(f"Explorium key prefix used: {str(settings.EXPLORIUM_API_KEY)[:6]}****")


# Export individual settings for backward compatibility
DATABASE_URL = settings.DATABASE_URL
REDIS_URL = settings.REDIS_URL
CRUSTDATA_API_KEY = settings.CRUSTDATA_API_KEY
