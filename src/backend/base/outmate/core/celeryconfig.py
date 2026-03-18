# celeryconfig.py
import os

outmate_redis_host = os.environ.get("OUTMATE_REDIS_HOST")
outmate_redis_port = os.environ.get("OUTMATE_REDIS_PORT")
# broker default user

if outmate_redis_host and outmate_redis_port:
    broker_url = f"redis://{outmate_redis_host}:{outmate_redis_port}/0"
    result_backend = f"redis://{outmate_redis_host}:{outmate_redis_port}/0"
else:
    # RabbitMQ
    mq_user = os.environ.get("RABBITMQ_DEFAULT_USER", "outmate")
    mq_password = os.environ.get("RABBITMQ_DEFAULT_PASS", "outmate")
    broker_url = os.environ.get("BROKER_URL", f"amqp://{mq_user}:{mq_password}@localhost:5672//")
    result_backend = os.environ.get("RESULT_BACKEND", "redis://localhost:6379/0")
# tasks should be json or pickle
accept_content = ["json", "pickle"]
