"""
FastAPI Middleware for Production-Grade Features

Includes:
- Request ID tracking for distributed tracing
- Request/response logging
- Performance monitoring
"""

import uuid
import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add unique request ID to each request.
    
    The request ID is:
    - Added to the request object (request.state.request_id)
    - Included in all logs for this request
    - Returned in response headers (X-Request-ID)
    
    Useful for tracing requests through microservices.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and add request ID
        """
        # Generate or extract request ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        
        # Store in request state
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log requests and responses.
    
    Logs:
    - Method and path
    - Response status code
    - Response time in milliseconds
    - Request ID (if available)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Log request and response information
        """
        start_time = time.time()
        
        # Get request ID if available
        request_id = getattr(request.state, "request_id", None)
        
        # Log incoming request
        logger.info(
            f"{request.method} {request.url.path}",
            extra={"request_id": request_id}
        )
        
        # Process request
        response = await call_next(request)
        
        # Calculate response time
        process_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        # Log response
        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        logger.log(
            log_level,
            f"{request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)",
            extra={"request_id": request_id}
        )
        
        # Add response time header
        response.headers["X-Process-Time"] = str(process_time)
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    
    Headers added:
    - X-Content-Type-Options: nosniff (prevent MIME sniffing)
    - X-Frame-Options: DENY (prevent clickjacking)
    - X-XSS-Protection: 1; mode=block (XSS protection)
    - Strict-Transport-Security: HSTS (for HTTPS)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Add security headers to response
        """
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response
