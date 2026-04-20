# Celery in production — must-read before deploying

The FastAPI container on its own is not enough. Features that call
`.delay()` or `.apply_async()` **require a Celery worker process to be
running somewhere** that reads the same Redis broker. Without it, every
`VoiceCampaign`, daily brief, signal re-score, and scheduled job sits in
Redis forever and the feature silently fails.

Three long-running processes exist in this codebase:

| Process | Command | Purpose | Scale signal |
|---|---|---|---|
| `api` | `gunicorn ... app.main:app` | HTTP requests | CPU, p95 latency |
| `celery-worker` | `celery -A app.core.celery_app worker` | Background tasks (voice campaigns, enrichment, CRM sync, briefs) | Redis queue depth, task throughput |
| `celery-beat` | `celery -A app.core.celery_app beat` | Fires scheduled tasks (exactly one instance, ever) | n/a — singleton |

Any hosting platform that runs Docker containers works. The reference config
already lives in `docker-compose.yml` at repo root — three services pointed
at the same Redis.

---

## Platform cheat sheets

### Azure Container Apps (recommended — matches the existing Dockerfile)

Three separate Container Apps inside the same environment, same image, same
env vars. Only the `command` differs.

```bash
# 1. Web (already in your plan)
az containerapp create --name outmate-api \
  --resource-group outmate-rg --environment outmate-env \
  --image <acr>.azurecr.io/outmate-backend:<tag> \
  --target-port 8000 --ingress external \
  --min-replicas 1 --max-replicas 5 \
  --env-vars @envs.yaml

# 2. Worker — NEW, the piece your plan is missing
az containerapp create --name outmate-worker \
  --resource-group outmate-rg --environment outmate-env \
  --image <acr>.azurecr.io/outmate-backend:<tag> \
  --command "celery" --args "-A app.core.celery_app worker --loglevel=info --concurrency=4" \
  --min-replicas 1 --max-replicas 3 \
  --env-vars @envs.yaml
  # NOTE: no --ingress. Worker takes no HTTP traffic.

# 3. Beat — NEW, MUST be exactly one replica
az containerapp create --name outmate-beat \
  --resource-group outmate-rg --environment outmate-env \
  --image <acr>.azurecr.io/outmate-backend:<tag> \
  --command "celery" --args "-A app.core.celery_app beat --loglevel=info" \
  --min-replicas 1 --max-replicas 1 \
  --env-vars @envs.yaml
  # Two beat instances fire every schedule twice. Enforce min=max=1.
```

### Azure App Service (Web Apps for Containers)

App Service doesn't natively support sidecar containers per app. Run one
Web App for the API and **separate App Services** for the worker + beat,
all on the same Linux plan. For worker/beat, set:

- **Always On** = On (otherwise App Service idles them and Celery dies).
- **Startup Command** = one of the `celery -A app.core.celery_app ...` lines above.
- **No public ingress** — you can still give them a URL, just don't route
  traffic. Or use WebJobs if you want to keep it to one App Service.

### Plain Docker / VPS / EC2

Your `docker-compose.yml` at repo root already does this correctly:

```bash
docker-compose up -d              # spins up api + celery-worker + celery-beat
docker-compose logs -f celery-worker
```

### ECS / Fargate / Cloud Run

Three services, same image, different `command`. Same env vars pointing at
the same Redis (Elasticache / Memorystore / Upstash).

### Render / Railway / Fly.io

Each supports "Background Worker" services in addition to Web services.
Create one Worker service per command (worker + beat). Same repo, same
Dockerfile, just a different start command per service.

---

## Env vars the worker needs (same as api)

Copy the exact same `.env` / key-vault references you give `api`. Critical:

- `DATABASE_URL`
- `REDIS_URL` (broker + result backend)
- Every provider key the workers' task code touches:
  `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_FROM_NUMBER`,
  `OPENROUTER_API_KEY`, `BETTERCONTACT_API_KEY`, `CRUSTDATA_API_KEY`,
  `EXPLORIUM_API_KEY`, `HUBSPOT_*`, `TAVILY_API_KEY`, `SERPER_API_KEY`,
  Gmail tokens, etc.

If you miss a key the corresponding task just fails with a provider 401 —
visible in the worker's stdout/stderr.

---

## Scaling & health

**Worker count:** scale horizontally. Each worker replica processes
`--concurrency` tasks in parallel; go wider (more replicas) before going
deeper (higher concurrency per worker). Rule of thumb: 1 replica per
~50 queued tasks/min, concurrency 2–4.

**Beat:** always exactly one replica. Multiple beat instances cause double
scheduling. Enforce `min_replicas = max_replicas = 1`.

**Health probes:**

- For `api`: HTTP `GET /health` (already implemented).
- For `celery-worker`: no HTTP. Use either:
  - `celery -A app.core.celery_app inspect ping` as liveness (returns 0 if
    any worker answers), OR
  - nothing; rely on queue-depth alerting in Redis + restart policy.
- For `celery-beat`: same — monitor "last scheduled tick" rather than HTTP.

**Graceful shutdown:** workers respect `SIGTERM` (waits for in-flight tasks
up to `--time-limit`). Give platforms at least 30-60 sec grace period.

---

## Common first-deploy failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Web 200s but tasks never run | No worker deployed | Deploy worker container |
| Tasks run but scheduled ones don't | No beat deployed | Deploy beat container (min=max=1) |
| Tasks run 2× at every schedule | Multiple beat replicas | Cap beat to 1 replica |
| Worker restarts every few minutes | Idle-sleep on App Service | Enable "Always On" |
| Provider 401s inside tasks | Worker missing API key env vars | Mirror env from api container |
| `ConnectionError` to Redis | Worker can't reach broker | Check VNet / security group rules |

---

## Local dev shortcut

Don't run three terminals. Use:

```bash
cd Backend && ./start-dev.sh
```

Spawns api + worker + beat in one foreground shell, Ctrl-C cleans up all
three. Flags: `--no-beat`, `--no-worker`, `--purge`.
