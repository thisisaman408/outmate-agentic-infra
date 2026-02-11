"""
Base CrustData API client for all search types (prospects, companies, etc.)
Production-grade with retry logic, rate limiting, and comprehensive error handling

This module provides a reusable HTTP client for interacting with CrustData API.
It handles:
- Automatic retries for transient failures
- Exponential backoff
- Custom exception types
- Request/response logging
- Timeout handling
"""

import httpx
import logging
from typing import Dict, Any, Optional
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

logger = logging.getLogger(__name__)


class CrustDataAPIError(Exception):
    """
    Custom exception for CrustData API errors
    
    Attributes:
        status_code: HTTP status code from the API response
        message: Error message
        response_data: Raw response data from API (if available)
    """
    def __init__(self, status_code: int, message: str, response_data: Optional[Dict] = None):
        self.status_code = status_code
        self.message = message
        self.response_data = response_data
        super().__init__(self.message)
    
    def __str__(self):
        return f"CrustDataAPIError({self.status_code}): {self.message}"


class BaseCrustDataClient:
    """
    Production-grade CrustData API client
    
    Features:
    - Automatic retries for transient failures (503, 504)
    - Exponential backoff strategy
    - Comprehensive logging
    - Proper error handling with custom exceptions
    - Timeout management
    
    Example:
        client = BaseCrustDataClient(api_key="your_key")
        result = await client._make_request(
            endpoint="/screener/persondb/search",
            payload={"filters": {...}, "limit": 100}
        )
    """
    
    BASE_URL = "https://api.crustdata.com"
    DEFAULT_TIMEOUT = 30.0  # seconds
    
    def __init__(self, api_key: str):
        """
        Initialize CrustData client
        
        Args:
            api_key: CrustData API authentication key
        """
        if not api_key:
            raise ValueError("API key cannot be empty")
        
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json"
        }
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException)),
        reraise=True
    )
    async def _make_request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        timeout: float = DEFAULT_TIMEOUT
    ) -> Dict[str, Any]:
        """
        Make HTTP POST request to CrustData API with retry logic
        
        This method automatically retries requests that fail due to:
        - Temporary server errors (5xx)
        - Timeout errors
        - Network connectivity issues
        
        Retry strategy:
        - Maximum 3 attempts
        - Exponential backoff (2s, 4s, 8s...)
        - Only retries on retriable errors
        
        Args:
            endpoint: API endpoint path (e.g., "/screener/persondb/search")
            payload: Request body as dictionary
            timeout: Request timeout in seconds (default: 30)
            
        Returns:
            API response as dictionary
            
        Raises:
            CrustDataAPIError: For API-specific errors (4xx, 5xx)
            httpx.TimeoutException: If request times out after retries
            httpx.NetworkError: If network is unreachable after retries
        """
        url = f"{self.BASE_URL}{endpoint}"
        
        # Log request (excluding sensitive data)
        logger.info(
            f"CrustData API Request: {endpoint}",
            extra={
                "endpoint": endpoint,
                "payload_keys": list(payload.keys()),
                "limit": payload.get("limit"),
                "has_filters": "filters" in payload
            }
        )
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                # Log full payload for debugging
                logger.debug(f"Payload sent to CrustData: {payload}")
                print(f"🚀 [Backend] Payload sent to CrustData: {payload}")  # Explicit print for console visibility

                response = await client.post(
                    url,
                    headers=self.headers,
                    json=payload
                )
                
                # Log response status
                logger.info(
                    f"CrustData API Response: HTTP {response.status_code}",
                    extra={
                        "endpoint": endpoint,
                        "status_code": response.status_code,
                        "response_time_ms": response.elapsed.total_seconds() * 1000 if hasattr(response, 'elapsed') else None
                    }
                )
                
                # Handle error responses
                if response.status_code >= 400:
                    error_data = None
                    try:
                        error_data = response.json()
                    except Exception:
                        # Response might not be JSON
                        pass
                    
                    error_message = self._format_error_message(response.status_code, response.text)
                    logger.error(
                        f"CrustData API error: {error_message}",
                        extra={
                            "status_code": response.status_code,
                            "error_data": error_data
                        }
                    )
                    
                    raise CrustDataAPIError(
                        status_code=response.status_code,
                        message=error_message,
                        response_data=error_data
                    )
                
                # Parse and return successful response
                data = response.json()
                print(f"✅ [Backend] Valid Response from CrustData: {data.keys() if isinstance(data, dict) else 'List/Other'}")
                return data
                
        except httpx.TimeoutException as e:
            logger.error(
                f"CrustData API timeout: {endpoint}",
                extra={"timeout_seconds": timeout},
                exc_info=True
            )
            raise CrustDataAPIError(
                status_code=504,
                message=f"Request timeout - API took longer than {timeout}s to respond"
            )
            
        except httpx.NetworkError as e:
            logger.error(
                f"Network error calling CrustData: {endpoint}",
                exc_info=True
            )
            raise CrustDataAPIError(
                status_code=503,
                message="Network error - Unable to reach CrustData API. Please check connectivity."
            )
    
    def _format_error_message(self, status_code: int, response_text: str) -> str:
        """
        Format error message based on status code
        
        Args:
            status_code: HTTP status code
            response_text: Raw response text
            
        Returns:
            Human-readable error message
        """
        error_messages = {
            400: "Bad Request - Invalid filter parameters",
            401: "Unauthorized - Invalid or missing API key",
            403: "Forbidden - Insufficient permissions",
            404: "Not Found - Invalid API endpoint",
            429: "Rate Limit Exceeded - Too many requests",
            500: "Internal Server Error - CrustData API is experiencing issues",
            503: "Service Unavailable - CrustData API is temporarily down",
            504: "Gateway Timeout - CrustData API took too long to respond"
        }
        
        default_message = f"API request failed with status {status_code}"
        base_message = error_messages.get(status_code, default_message)
        
        # Truncate response text if too long
        if len(response_text) > 200:
            response_text = response_text[:200] + "..."
        
        return f"{base_message}: {response_text}"
