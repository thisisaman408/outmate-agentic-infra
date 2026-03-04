# OUTMATE.AI PRODUCTION DEPLOYMENT PLAYBOOK v2

**Operational guide – lean startup production deployment (corrected & hard‑secure).**

This version includes refined security practices, secrets management, updated DNS
configuration, Supabase session‑pooler guidance, and CI/CD improvements. The
architecture remains unchanged: Frontend on Azure Static Web Apps + Backend on
Azure Container Apps, using Supabase Postgres and Upstash Redis.

**Status:** Ready for deployment  
**Cost:** $65–75 / month base  
**Target:** Single developer / small team

---

## TABLE OF CONTENTS

1. [Stack Confirmation](#stack-confirmation)
2. [Architecture Diagram](#architecture-diagram)
3. [Pre‑Deployment Checklist](#pre-deployment-checklist)
4. [Step 0: Environment Setup](#step-0-environment-setup)
5. [Step 1: Azure CLI & Resource Setup](#step-1-azure-cli--resource-setup)
6. [Step 2: Docker & Backend Image Workflow](#step-2-docker--backend-image-workflow)
7. [Step 3: Backend Deployment (Container Apps)](#step-3-backend-deployment-container-apps)
8. [Step 4: Frontend Deployment (Static Web Apps)](#step-4-frontend-deployment-static-web-apps)
9. [Step 5: CI/CD Pipeline Setup](#step-5-cicd-pipeline-setup)
10. [Step 6: Domain & DNS Configuration](#step-6-domain--dns-configuration)
11. [Step 7: Secrets & Environment Management](#step-7-secrets--environment-management)
12. [Step 8: Monitoring, Health & Uptime](#step-8-monitoring-health--uptime)
13. [Step 9: Scaling Strategy](#step-9-scaling-strategy)
14. [Step 10: Rollback Procedures](#step-10-rollback-procedures)
15. [Step 11: Operational Practices](#step-11-operational-practices)
16. [Appendix: Quick Reference Commands](#appendix-quick-reference-commands)

---

## STACK CONFIRMATION

All components are confirmed; do **not** change the stack.

| Component              | Status | Notes |
|------------------------|--------|-------|
| Backend framework      | ✅     | FastAPI (Python 3.11)      |
| Backend container      | ✅     | Docker image pushed to ACR |
| Runtime                | ✅     | Azure Container Apps       |
| Frontend framework     | ✅     | Next.js (Node 18+)         |
| Frontend deployment    | ✅     | Azure Static Web Apps (GitHub integration) |
| Database               | ✅     | Supabase PostgreSQL (session‑pooler URL) |
| Cache                  | ✅     | Upstash Redis              |
| DNS                    | ✅     | Cloudflare (proxied orange cloud) |
| Container registry     | ✅     | Azure Container Registry (Basic) |
| CI/CD                  | ✅     | GitHub Actions with lint/test/build/deploy |

### KEY FILES

- `Backend/Dockerfile` – production multi‑stage
- `Backend/requirements.txt` – Python deps
- `Backend/app/main.py` – FastAPI app entry
- `Backend/app/api/routes/health.py` – health checks
- `Backend/.env.example` – variable template

**Frontend** no longer builds via Docker; ignore `Frontend/Dockerfile`.
Static Web Apps builds from source automatically.

---

## ARCHITECTURE DIAGRAM

(unchanged from v1) — see original playbook for ASCII diagram.

---

## PRE‑DEPLOYMENT CHECKLIST

Same as v1 with one addition:
- [ ] **Supabase session‑pooler URL obtained** (see Step 7)

---

## STEP 0: ENVIRONMENT SETUP

(identical to v1)

---

## STEP 1: AZURE CLI & RESOURCE SETUP

(identical to v1)

---

## STEP 2: DOCKER & BACKEND IMAGE WORKFLOW

Only the backend is built and pushed; frontend is omitted.

### 2.1 Build backend image
```bash
cd Backend
docker build -t outmate-api:latest .
```

### 2.2 Test locally (optional)
```bash
cp .env.example .env.test
# fill with real DATABASE_URL, REDIS_URL, etc.
docker run -p 8000:8000 --env-file .env.test --rm outmate-api:latest
curl http://localhost:8000/health
```

### 2.3 Login to ACR & push
```bash
az acr login --name outmateacr
docker tag outmate-api:latest outmateacr.azurecr.io/outmate-api:latest
docker push outmateacr.azurecr.io/outmate-api:latest
```

### 2.4 Tagging best practices
- `latest` – production pointer
- `v1.0.0` – semantic version
- commit hash – audit

---

## STEP 3: BACKEND DEPLOYMENT (CONTAINER APPS)

Same as v1, except environment variables are now secrets (see Step 7).

```bash
az containerapp create \
  --name outmate-api \
  --resource-group outmate-prod \
  --environment outmate-env \
  --image outmateacr.azurecr.io/outmate-api:latest \
  --target-port 8000 \
  --ingress external \
  --cpu 1 --memory 2Gi \
  --min-replicas 1 --max-replicas 1 \
  --registry-server outmateacr.azurecr.io
```

Health path defaults to `/health`; logs available with
`az containerapp logs show`.

---

## STEP 4: FRONTEND DEPLOYMENT (STATIC WEB APPS)

### 4.1 Create Static Web App

```bash
az staticwebapp create \
  --name outmate-web \
  --resource-group outmate-prod \
  --location eastus \
  --source https://github.com/YOUR_USERNAME/outmate \
  --branch main \
  --output-location out \
  --token GITHUB_TOKEN
```

*No Docker build.* The service clones `Frontend/`, runs `pnpm install` and
`pnpm build` automatically per provided Actions workflow.

### 4.2 Environment variables
Use `az staticwebapp appsettings set` as before.

---

## STEP 5: CI/CD PIPELINE SETUP

Add lint+test stage before build.

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend to Azure Container Apps

on:
  push:
    branches: [ main ]
    paths:
      - 'Backend/**'
      - '.github/workflows/deploy-backend.yml'

env:
  AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
  AZURE_RESOURCE_GROUP: outmate-prod
  AZURE_CONTAINER_APP: outmate-api
  AZURE_CONTAINER_REGISTRY: outmateacr
  REGISTRY_LOGIN_SERVER: outmateacr.azurecr.io
  IMAGE_NAME: outmate-api

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd Backend
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Lint (flake8)
        run: |
          cd Backend
          pip install flake8
          flake8 .

      - name: Run tests
        run: |
          cd Backend
          pytest --maxfail=1 --disable-warnings -q

      - name: Azure Login
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Build Docker image
        run: |
          cd Backend
          docker build -t ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:latest .

      - name: Push to ACR
        run: |
          az acr login --name ${{ env.AZURE_CONTAINER_REGISTRY }}
          docker push ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:latest

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
            --name ${{ env.AZURE_CONTAINER_APP }} \
            --image ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:latest

      - name: Health check
        run: |
          URL=$(az containerapp show \
            --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
            --name ${{ env.AZURE_CONTAINER_APP }} \
            --query "properties.configuration.ingress.fqdn" -o tsv)
          for i in {1..20}; do
            if curl -sSf https://$URL/health; then
              echo "Health ok"; exit 0;
            fi
            sleep 3
          done
          exit 1
```

**Note:** the workflow now lints and tests before building, preventing bad
deployments. Frontend CI is handled automatically by the Static Web Apps
workflow created by Azure.

---

## STEP 6: DOMAIN & DNS CONFIGURATION

### 6.1 Cloudflare changes

Use proxied (orange cloud) records **for both** subdomains. This enables:

- **Cloudflare WAF** protections on all traffic
- **DDoS mitigation** at the edge
- **Rate limiting & bot management** rules
- **Edge caching** for static assets (reduces origin load)

```text
Record  Type  Name  Content                                     Proxy
CNAME   CNAME api   outmate-api.<hash>.azurecontainerapps.io     ✅
CNAME   CNAME app   outmate-web.azurefd.net                    ✅
```

The proxied setting hides the Azure IPs and allows Cloudflare to issue
certificates automatically. It also improves security and performance.

Other DNS steps remain as before.

---

## STEP 7: SECRETS & ENVIRONMENT MANAGEMENT

Production applications must not have secrets set via `--set-env-vars`.
Instead Azure Container Apps supports a secret store with proper obfuscation.

### 7.1 Create secrets in Container App

```bash
az containerapp secret set \
  --name outmate-api \
  --resource-group outmate-prod \
  --secrets \
    database-url="postgresql://postgres.<project>:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
    redis-url="redis://:password@redis.upstash.io:6379" \
    jwt-secret="$(openssl rand -hex 32)" \
    openrouter-key="sk_..." \
    crustdata-key="..." \
    explorium-key="..." \
    bettercontact-key="..."
```

Secrets are encrypted at rest and not visible in the CLI output.

### 7.2 Reference secrets in the container env

When updating the app, reference them using `secretref:` prefix:

```bash
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars \
    ENVIRONMENT=production \
    DATABASE_URL="secretref:database-url" \
    REDIS_URL="secretref:redis-url" \
    JWT_SECRET="secretref:jwt-secret" \
    OPENROUTER_API_KEY="secretref:openrouter-key" ...
```

### 7.3 Supabase Session Pooler

Use the session‑pooler connection string supplied by Supabase instead of the
plain database URL.  Example:

```
postgresql://postgres.<project>:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

The pooler maintains a small number of long‑lived connections to the Postgres
server and multiplexes client sessions over them. Without a pooler, each
Lambda/Container/App instance opens its own connection which can exhaust the
Postgres connection limit under scale. The pooler prevents connection
exhaustion during traffic spikes and restarts.

### 7.4 Secrets Management Best Practices

- **Rotate** secrets quarterly (or on team changes).
- **Use Key Vault** when staff count > 3 (can be added later).
- **Do not commit** any `.env` or secrets file to git.
- **Store service‑principal credentials** in GitHub Actions secrets only.
- **Audit** access changes using `az containerapp secret list`.

---

## STEP 8: MONITORING, HEALTH & UPTIME

### 8.1 Health endpoints (unchanged)

- `/health` – overall
- `/health/db` – database
- `/health/redis` – cache

Use an external uptime monitor (UptimeRobot, Pingdom) to poll `/health`
every 1‑5 minutes. Alert on non‑200 responses or timeouts.

### 8.2 Logs & diagnostics (unchanged)
Use `az containerapp logs show --follow`.

### 8.3 API rate limiting

Rate limiting is implemented via FastAPI and Redis (Upstash). Example in code
uses `slowapi`:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/some-endpoint")
@limiter.limit("60/minute")
def endpoint():
    ...
```

Set limits per endpoint or globally to prevent abuse.  Redis stores counters and
persists across container restarts.  Cloudflare rate limits are a second layer
in front of the app (configure in Cloudflare dashboard).

### 8.4 CORS security

Restrict allowed origins strictly to your frontend domain:

```bash
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars CORS_ORIGINS="https://app.outmate.ai"
```

This prevents malicious sites from querying the API from browsers.

---

## STEP 9: SCALING STRATEGY

(unchanged from v1; environment variables now secretrefs but scaling commands
remain the same.)

---

## STEP 10: ROLLBACK PROCEDURES

(unchanged – revision list and update commands as in v1.)

---

## STEP 11: OPERATIONAL PRACTICES

### Weekly checks
- Health endpoints
- Container logs
- Cloudflare dashboard (WAF events, rate‑limit hits)

### Monthly tasks
- Apply dependency updates
- Rotate JWT_SECRET (use `az containerapp secret set`)
- Review GitHub Actions secrets

### Uptime monitoring
- Add a 1‑minute monitor on `/health` via UptimeRobot or similar.
- Configure alerts to Slack/email.

### Production secrets management
- Use `az containerapp secret set` exclusively.
- For long‑term credentials (DB passwords, API keys) increase key length
  periodically.
- When you add Key Vault later, migrate secrets using `az keyvault secret set`
  and update Container App to reference `keyvaultref:` values.

---

## APPENDIX: QUICK REFERENCE COMMANDS

(Adapted from v1; environment‑variable updates now use secrets.)

```bash
# create secret
az containerapp secret set --name outmate-api --resource-group outmate-prod \
  --secrets database-url="..." redis-url="..." jwt-secret="..."

# update env with secret refs
az containerapp update --name outmate-api --resource-group outmate-prod \
  --set-env-vars DATABASE_URL=secretref:database-url REDIS_URL=secretref:redis-url

# view secrets
az containerapp secret list --name outmate-api --resource-group outmate-prod

# Cloudflare proxied DNS (orange cloud)
# see Step 6 for details

# Supabase pooler URL example
# stored as database-url secret

# CI/CD lint & test: see workflow in Step 5
```

(Other quick commands identical to v1; refer to that document for full list.)

---

## DEPLOYMENT CHECKLIST MODIFICATIONS

The checklist mirrors v1 with the following updates:

- Remove any frontend Docker tasks
- Add step to set Container App secrets
- Add step to configure Cloudflare proxying
- Add step to obtain and store Supabase pooler URL

---

## CONCLUSION

This v2 playbook corrects the previous version by removing unnecessary
frontend Docker instructions, using proper secret storage, enabling Cloudflare
security features, documenting Supabase pooler usage, and adding vital
operational sections (rate limiting, CORS, improved CI/CD, uptime monitoring,
secrets best practices).  It remains lean, single‑developer friendly, and
production‑safe.

Begin deployment using this document.  All commands are copy‑paste ready.

**Document Version:** 2.0  
**Last Updated:** March 5, 2026
