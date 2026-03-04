"""
Production-Grade Logging Configuration

Features:
- Structured logging with optional JSON output
- Request ID tracking for distributed tracing
- Configurable log levels
- Separate log files for different environments
- Third-party library noise suppression
- Optional python-json-logger integration
"""

import logging
import sys
import json
from typing import Optional
from datetime import datetime


class JsonFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add extra fields if present
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "endpoint"):
            log_data["endpoint"] = record.endpoint

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


class TextFormatter(logging.Formatter):
    """Custom text formatter for readable logging"""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as plain text"""
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        
        # Build base log message
        log_msg = f"{timestamp} - {record.name} - {record.levelname} - {record.getMessage()}"

        # Add request ID if present
        if hasattr(record, "request_id"):
            log_msg += f" [request_id={record.request_id}]"

        # Add exception info if present
        if record.exc_info:
            log_msg += f"\n{self.formatException(record.exc_info)}"

        return log_msg


def setup_logging(
    log_level: str = "INFO",
    log_format: str = "text",
    log_file: Optional[str] = None,
) -> None:
    """
    Configure application-wide structured logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Output format - 'text' or 'json'
        log_file: Optional file path to write logs

    Example:
        from app.core.logging import setup_logging
        setup_logging(log_level="INFO", log_format="json")
    """

    # Convert string level to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove existing handlers
    root_logger.handlers.clear()

    # Choose formatter based on format parameter
    if log_format.lower() == "json":
        formatter = JsonFormatter()
    else:
        formatter = TextFormatter()

    # Console handler (stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # File handler (optional)
    if log_file:
        try:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(numeric_level)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
        except Exception as e:
            print(f"Warning: Could not create file handler for {log_file}: {e}")

    # Suppress noise from third-party libraries
    noisy_loggers = [
        "httpx",
        "httpcore",
        "urllib3",
        "asyncio",
        "sqlalchemy.engine",
        "sqlalchemy.pool",
    ]
    for logger_name in noisy_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)

    # Log that logging is configured
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level: {log_level}, format: {log_format}")


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name
    
    Args:
        name: Logger name (typically __name__ of the module)
        
    Returns:
        Configured logger instance
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
