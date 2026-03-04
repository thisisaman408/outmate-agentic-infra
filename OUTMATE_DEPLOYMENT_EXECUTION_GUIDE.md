# OUTMATE.AI DEPLOYMENT EXECUTION GUIDE

This document walks a single developer through the final deployment of
Outmate.AI using the previously prepared V2 playbook. It assumes the codebase
is complete and the repository is configured as described below.

## 1. Project structure validation

The following files must exist in the repository; verify before proceeding.

### Backend

- `Backend/Dockerfile` ✔
- `Backend/requirements.txt` ✔
- `Backend/app/main.py` ✔
- `Backend/app/api/routes/health.py` ✔

All are present. No changes required.

*(You already added a `.dockerignore` file under Backend; ensure it's
committed.)*

### Frontend

- `Frontend/package.json` ✔
- `Frontend/next.config.mjs` ✔ (updated to use NEXT_PUBLIC_API_URL)
- `Frontend/tsconfig.json` ✔
- `Frontend/public/staticwebapp.config.json` ✔ (proxy rules)

No missing items. The Dockerfile in `Frontend/` is **unused**; Static Web
Apps builds directly from source.

## 2. Backend Dockerfile review

The `Backend/Dockerfile` meets production requirements:

- Multi‑stage build (base, builder, runtime)
- `python:3.11-slim` base image
- `WORKDIR /app` set correctly
- Dependencies installed in builder stage
- Non‑root user created and used
- Healthcheck on port 8000
- `EXPOSE 8000` added
- Gunicorn startup command with Uvicorn workers
- Usage of `.dockerignore` added (see step 1)

No further improvements necessary.

## 3. FastAPI production settings

Configuration files correctly handle environment loading via `dotenv` and
env vars. The database session factory is tuned for Supabase pooler with
connection pooling, pre‑ping, and timeouts. Redis is managed by
`RedisManager` (not shown here) which reads `REDIS_URL` from settings.

Additional items verified:

- Logging configured via `app.core.logging` and prints masked secrets.
- CORS middleware present; allow origins loaded from `settings.CORS_ALLOWED_ORIGINS`.
  Consider removing `allow_origin_regex=".*"` in future to tighten security.
- Rate limiting applied globally with `slowapi`.

No changes required for production; continue using session‑pooler URL.

## 4. Next.js build compatibility

Static Web Apps runs `pnpm build` by default, placing compiled output into
`.next`. We added `public/staticwebapp.config.json` to route `/api` and
`/health` to the API domain. The `next.config.mjs` file now uses
`process.env.NEXT_PUBLIC_API_URL` for rewrites, ensuring local dev proxies
`http://localhost:8000` and production points at `https://api.outmate.ai`.

**Environment variables:** Only client‑safe variables (prefixed with
`NEXT_PUBLIC_`) are used; e.g. `NEXT_PUBLIC_API_URL`.

No further changes needed.

## 5. GitHub Actions pipelines

Two workflows were added under `.github/workflows`:

- `deploy-backend.yml` – lints, tests, builds/pushes Docker image, deploys to
  Azure Container Apps, and performs a health check.
- `deploy-frontend.yml` – installs Node, builds the frontend, validates output,
  and dispatches to Azure Static Web Apps via the official action.

Ensure the following repository secrets are populated:

| Secret                               | Used by                      |
|--------------------------------------|------------------------------|
| `AZURE_SUBSCRIPTION_ID`              | both workflows              |
| `AZURE_CLIENT_ID`                    | deploy-backend              |
| `AZURE_TENANT_ID`                    | deploy-backend              |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`    | deploy-frontend             |

**Note:** Backend tests must pass locally before they will succeed in the
workflow. Add any missing test files as necessary.

## 6. Environment variables list

### Required secrets (store in Azure Container Apps secrets and GitHub)

- `DATABASE_URL` – Supabase session pooler connection string
- `REDIS_URL` – Upstash connection
- `JWT_SECRET` – 32‑byte random key
- `OPENROUTER_API_KEY` – external service
- `CRUSTDATA_API_KEY`
- `EXPLORIUM_API_KEY`
- `BETTERCONTACT_API_KEY`

These are added via:
```
az containerapp secret set --name outmate-api --resource-group outmate-prod \
  --secrets \
    database-url="<pooler url>" \
    redis-url="<upstash>" \
    jwt-secret="<random>" \
    openrouter-key="..." ...
```

and referenced in the app with `secretref:`.

### Runtime variables (set via `az containerapp update --set-env-vars`)

- `ENVIRONMENT` (production)
- `LOG_LEVEL` (info/debug)
- `CORS_ORIGINS` (https://app.outmate.ai)
- `RATE_LIMIT_ENABLED` (true/false)

These need **not** be secret.

### Frontend settings (Static Web Apps configuration)

- `NEXT_PUBLIC_API_URL` → `https://api.outmate.ai`

Configured via Azure portal or CLI `az staticwebapp appsettings set`.

### GitHub secrets

In addition to the Azure credentials above, store any secret values that the
CI jobs might need (none of the application secrets are needed in GitHub
workflows since the container app uses its own secrets).

## 7. Deployment execution plan

### Day 1 – Infrastructure & image push

1. Install & verify Azure CLI, Docker, Node, Git (per V2 playbook).
2. `az login` and select subscription.
3. Create resource group `outmate-prod` and location.
4. Create ACR `outmateacr` (Basic tier).
5. Create Container Apps environment `outmate-env`.
6. Build backend Docker image locally: `docker build …`.
7. Login to ACR and push the `latest` tag.
8. Add Container App secrets (database-url, redis-url, etc.).
9. Set runtime vars (ENVIRONMENT, CORS_ORIGINS, etc.).

### Day 2 – Deploy apps & DNS

1. Deploy backend with `az containerapp create …` as in Step 3 earlier.
2. Verify backend health using `curl` commands (see Section 8).
3. Create Static Web App `outmate-web` with GitHub token.
4. Configure frontend env var `NEXT_PUBLIC_API_URL`.
5. Add Cloudflare DNS records for `api.outmate.ai` and `app.outmate.ai`
   (proxied orange cloud).
6. Link custom domains to Static Web App and optionally to Container App.
7. Commit any workflow changes and push to `main` to trigger CI/CD.
8. Monitor GitHub Actions for both workflows; ensure they succeed.

### Post‑deployment validation

1. Run the verification commands below.
2. Add uptime monitors to `/health`.
3. Check Cloudflare analytics for WAF/rate‑limit hits.

## 8. Verification commands

```bash
# API health
curl -s https://api.outmate.ai/health | jq

# Database health
curl -s https://api.outmate.ai/health/db | jq

# Redis health
curl -s https://api.outmate.ai/health/redis | jq

# Frontend
curl -I https://app.outmate.ai
# Expect HTTP/2 200 OK and HTML body
```

When all four commands return successful output, the deployment is functioning.

## 9. Additional notes

- All network traffic passes through Cloudflare (WAF/DDoS/rate‑limit).
- Static Web Apps automatically deploys on every push to `main` under `Frontend/`.
- Backend images are built, pushed, and rolled out by the backend workflow.
- Rollback is accomplished by setting traffic to a previous revision as shown in
  V2 playbook Step 10.

## 10. Conclusion

This execution guide provides the checklist, validation commands, and
configuration details necessary to transition from planning to a live
production deployment of Outmate.AI. Follow the steps over two days and use the
verification commands before announcing the launch.

Good luck with the deployment!
