"""
Rate Limiting Configuration for Production

Implements request rate limiting to prevent:
- DDoS attacks
- API abuse
- Resource exhaustion

Uses slowapi library for rate limiting.
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request, HTTPException, status

DEFAULT_RATE_LIMIT = "60/minute"
import logging


logger = logging.getLogger(__name__)


# Create rate limiter instance
limiter = Limiter(key_func=get_remote_address)


def setup_rate_limiting(app: FastAPI, environment: str = "development") -> None:
    """
    Setup rate limiting for the FastAPI application.
    
    Args:
        app: FastAPI application instance
        environment: Environment name (development, staging, production)
    
    Limits are adaptive based on environment:
    - development: 1000 requests/minute (lenient for testing)
    - staging: 100 requests/minute (standard)
    - production: 60 requests/minute (strict)
    """
    
    # Add rate limiter to app
    app.state.limiter = limiter
    app.add_exception_handler(
        RateLimitExceeded,
        _rate_limit_exceeded_handler
    )
    
    # Determine rate limits based on environment
    if environment == "production":
        # Strict limits for production
        default_limit = DEFAULT_RATE_LIMIT
        search_limit = "30/minute"
        auth_limit = "10/minute"
    elif environment == "staging":
        # Standard limits for staging
        default_limit = "100/minute"
        search_limit = "50/minute"
        auth_limit = "20/minute"
    else:
        # Lenient limits for development
        default_limit = "1000/minute"
        search_limit = "500/minute"
        auth_limit = "200/minute"
    
    logger.info(
        f"Rate limiting configured for {environment}: "
        f"default={default_limit}, search={search_limit}, auth={auth_limit}"
    )


def get_rate_limit_headers(limits_str: str = DEFAULT_RATE_LIMIT) -> dict:
    """
    Get rate limit information for documenting in API responses.
    
    Args:
        limits_str: Rate limit string (e.g., "60/minute")
        
    Returns:
        Dictionary with limit information
    """
    # Parse limit string
    if "/" in limits_str:
        count, period = limits_str.split("/")
        return {
            "X-RateLimit-Limit": count,
            "X-RateLimit-Period": period
        }
    return {}


# Rate limit decorators for common endpoints
class RateLimits:
    """Common rate limits for different endpoint types"""
    
    # General API endpoint
    DEFAULT = DEFAULT_RATE_LIMIT
    
    # Search endpoints (more expensive)
    SEARCH = "30/minute"
    
    # Authentication endpoints
    AUTH = "10/minute"
    
    # Export/generation endpoints (very expensive)
    EXPORT = "10/hour"
    
    # Health check endpoints
    HEALTH = "1000/minute"
    
    # Copilot lead action endpoints
    COPILOT_LEAD_ACTION = "20/minute"
    COPILOT_LEAD_SUGGESTIONS = "30/minute"
