# Running LangFlow with Docker

This guide will help you get LangFlow up and running using Docker and Docker Compose.

## Prerequisites

- Docker
- Docker Compose

## Steps

1. Clone the LangFlow repository:

   ```sh
   git clone https://github.com/outmate-ai/outmate.git
   ```

2. Navigate to the `docker_example` directory:

   ```sh
   cd outmate/docker_example
   ```

3. Run the Docker Compose file:

   ```sh
   docker compose up
   ```

LangFlow will now be accessible at [http://localhost:7860/](http://localhost:7860/).

## Docker Compose Configuration

The Docker Compose configuration spins up two services: `outmate` and `postgres`.

### LangFlow Service

The `outmate` service uses the `outmateai/outmate:latest` Docker image and exposes port 7860. It depends on the `postgres` service.

Environment variables:

- `OUTMATE_DATABASE_URL`: The connection string for the PostgreSQL database.
- `OUTMATE_CONFIG_DIR`: The directory where LangFlow stores logs, file storage, monitor data, and secret keys.

Volumes:

- `outmate-data`: This volume is mapped to `/app/outmate` in the container.

### PostgreSQL Service

The `postgres` service uses the `postgres:16` Docker image and exposes port 5432.

Environment variables:

- `POSTGRES_USER`: The username for the PostgreSQL database.
- `POSTGRES_PASSWORD`: The password for the PostgreSQL database.
- `POSTGRES_DB`: The name of the PostgreSQL database.

Volumes:

- `outmate-postgres`: This volume is mapped to `/var/lib/postgresql/data` in the container.

## Switching to a Specific LangFlow Version

If you want to use a specific version of LangFlow, you can modify the `image` field under the `outmate` service in the Docker Compose file. For example, to use version 1.0-alpha, change `outmateai/outmate:latest` to `outmateai/outmate:1.0-alpha`.
