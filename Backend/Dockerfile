# ============================================================================
# PRODUCTION-GRADE DOCKERFILE FOR OUTMATE.AI BACKEND
# ============================================================================
# Multi-stage build for optimized image size
#
# Build Stages:
# 1. base - Python slim image with system dependencies
# 2. builder - Install Python dependencies
# 3. runtime - Final production image (minimal layer)
#
# Features:
# - Non-root user for security
# - Health check endpoint
# - Signal handling for graceful shutdown
# - Optimized layer caching
#
# Build: docker build -t outmate-api:latest .
# Run:   docker run -p 8000:8000 --env-file .env outmate-api:latest
# ============================================================================

FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app


# ============================================================================
# Builder stage - Install Python dependencies
# ============================================================================
FROM base as builder

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --user --no-warn-script-location -r requirements.txt


# ============================================================================
# Runtime stage - Final production image
# ============================================================================
FROM base as runtime

# Copy only necessary Python packages from builder
COPY --from=builder --chown=appuser:appuser /root/.local /home/appuser/.local

# Add local Python packages to PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# ============================================================================
# Production startup command
# ============================================================================
# Uses Gunicorn with Uvicorn workers for production load handling
# Configured for Azure App Service deployment
#
# Parameters:
# --bind 0.0.0.0:8000 - Listen on all interfaces (required in containers)
# --workers 4 - Number of worker processes (scale with CPU cores)
# --worker-class uvicorn.workers.UvicornWorker - Async worker class
# --max-requests 1000 - Restart worker after 1000 requests (memory leak prevention)
# --max-requests-jitter 100 - Add randomness to prevent synchronized restarts
# --timeout 60 - Request timeout in seconds
# --access-logfile - - Log to stdout (container logs)
# --error-logfile - - Error log to stderr (container logs)
# ============================================================================
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app.main:app"]
