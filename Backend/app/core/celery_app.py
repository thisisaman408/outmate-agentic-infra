from celery import Celery
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

celery_app = Celery(
    "outmate_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.visitors", "app.tasks.copilot_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    # Production settings for Azure with Upstash
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=3,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    # SSL/TLS for Upstash
    broker_use_ssl=True,
    redis_backend_use_ssl=True,
)

logger.info("Celery configured with broker: %s (using TLS)", settings.REDIS_URL.split('@')[1] if '@' in settings.REDIS_URL else 'redacted')
