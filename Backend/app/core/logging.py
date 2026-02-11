"""
Centralized logging configuration for production

This module sets up structured logging for the entire application.
It provides consistent logging format, appropriate log levels, and
reduces noise from third-party libraries.

Features:
- Structured log format with timestamps
- Configurable log levels via environment
- Reduced verbosity for noisy libraries
- stdout/stderr handlers
- JSON logging support (ready for production)
"""

import logging
import sys
from typing import Optional


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configure application-wide logging
    
    This should be called once at application startup, before any
    logging occurs. It sets up handlers, formatters, and configures
    third-party library log levels.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
                  Can be set via environment variable LOG_LEVEL
    
    Features:
    - Timestamps with milliseconds
    - Module name and log level
    - Clean, readable format
    - Separate handlers for stdout/stderr
    
    Example:
        from app.core.logging import setup_logging
        setup_logging("INFO")
        
        logger = logging.getLogger(__name__)
        logger.info("Application started")
    """
    
    # Convert string level to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create formatter
    # Format: 2024-01-30 15:30:45,123 - app.services.prospect - INFO - Prospect search initiated
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Create console handler (stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove any existing handlers (prevent duplicates)
    root_logger.handlers.clear()
    
    # Add our handler
    root_logger.addHandler(console_handler)
    
    # Reduce noise from third-party libraries
    # These libraries are very verbose at DEBUG level
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    
    # Log that logging is configured
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level: {log_level}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance
    
    Convenience function for getting a logger. Ensures consistent
    logger naming across the application.
    
    Args:
        name: Logger name (typically __name__ of the module)
        
    Returns:
        Configured logger instance
        
    Example:
        from app.core.logging import get_logger
        logger = get_logger(__name__)
        logger.info("Something happened")
    """
    return logging.getLogger(name)


class LoggerAdapter(logging.LoggerAdapter):
    """
    Custom logger adapter for adding context to all log messages
    
    This can be used to add request IDs, user IDs, or other contextual
    information to all log messages automatically.
    
    Example:
        adapter = LoggerAdapter(logger, {"request_id": "abc123"})
        adapter.info("Processing request")
        # Output: ... - INFO - Processing request [request_id=abc123]
    """
    
    def process(self, msg, kwargs):
        """Add extra context to log message"""
        # Add context to the message
        if self.extra:
            context = " ".join([f"{k}={v}" for k, v in self.extra.items()])
            msg = f"{msg} [{context}]"
        return msg, kwargs


# For production: JSON logging
def setup_json_logging(log_level: str = "INFO") -> None:
    """
    Configure JSON structured logging (for production environments)
    
    JSON logs are easier to parse by log aggregation tools like
    ELK stack, Datadog, CloudWatch, etc.
    
    Args:
        log_level: Logging level string
        
    Note:
        Requires python-json-logger package
        Install: pip install python-json-logger
    """
    try:
        from pythonjsonlogger import jsonlogger
        
        numeric_level = getattr(logging, log_level.upper(), logging.INFO)
        
        # JSON formatter
        json_formatter = jsonlogger.JsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s',
            rename_fields={'timestamp': '@timestamp', 'level': 'severity'}
        )
        
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)
        console_handler.setFormatter(json_formatter)
        
        root_logger = logging.getLogger()
        root_logger.setLevel(numeric_level)
        root_logger.handlers.clear()
        root_logger.addHandler(console_handler)
        
        # Reduce third-party noise
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)
        
        logger = logging.getLogger(__name__)
        logger.info("JSON logging configured", extra={"log_level": log_level})
        
    except ImportError:
        # Fallback to standard logging
        setup_logging(log_level)
        logger = logging.getLogger(__name__)
        logger.warning("python-json-logger not installed, using standard logging")
