# OUTMATE.AI - LEAN AZURE DEPLOYMENT PLAN

**For:** Early-Stage SaaS Startup (Single Developer)  
**Readiness Level:** MVP Production (7/10)  
**Deployment Timeline:** 1-2 Days  
**Target Audience:** Solo founder/DevOps developer  
**Cost:** ~$150-300/month  

---

## EXECUTIVE SUMMARY

This is a **minimal production deployment plan** for Outmate.AI. It skips enterprise features and focuses only on what's needed to launch an AI SaaS product.

**What you'll deploy:**
- ✅ FastAPI backend on Azure Container Apps
- ✅ Next.js frontend on Azure Static Web Apps
- ✅ Docker image registry (Azure Container Registry)
- ✅ Simple CI/CD with GitHub Actions
- ✅ Using existing Supabase database & Upstash Redis
- ✅ DNS via Cloudflare (free tier OK)

**What you'll skip (for now):**
- ❌ Azure Front Door (too expensive for MVP)
- ❌ Virtual Networks/Private Endpoints
- ❌ Azure Key Vault (use env vars in Container Apps)
- ❌ Application Insights (use free logging initially)
- ❌ Multiple resource groups (keep it simple)
- ❌ Auto-scaling rules (add later if needed)
- ❌ Disaster recovery/HA (not critical yet)

**Bottom line:** Deploy a secure, functional production environment in <2 days for <$5K setup cost.

---

## PHASE 0: ARCHITECTURE (LEAN VERSION)

### 0.1 Simplified Architecture

```
┌──────────────────────────────────────┐
│     Your Domain (app.outmate.ai)     │
│      via Cloudflare (free DNS)       │
└────────────────┬─────────────────────┘
                 │ HTTPS (managed)
        ┌────────┴─────────┐
        │                  │
   ┌────▼──────────┐  ┌───▼──────────────┐
   │ Static Web    │  │ Container Apps   │
   │ Apps          │  │ (FastAPI)        │
   │ (Next.js)     │  │ Single replica   │
   │ 50GB free     │  │ 1 vCPU, 2GB RAM  │
   │ bandwidth     │  │                  │
   └───────────────┘  └────┬─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼──────────┐  ┌───▼──────────┐  ┌──▼────────────┐
   │  Supabase     │  │  Upstash     │  │ ACR (images)  │
   │ PostgreSQL    │  │  Redis       │  │               │
   │ (existing)    │  │ (existing)   │  │               │
   └───────────────┘  └──────────────┘  └───────────────┘
```

### 0.2 Services Used

| Service | Cost | Purpose | Notes |
|---------|------|---------|-------|
| **Azure Container Apps** | ~$50/mo | Backend API execution | 1 replica, on-demand pricing |
| **Azure Static Web Apps** | $0 | Frontend hosting | Free tier (50GB bandwidth) |
| **Azure Container Registry** | ~$15/mo | Docker image storage | Basic tier |
| **Supabase** | $0-25/mo | Database (existing) | Free tier or pro |
| **Upstash Redis** | $0-20/mo | Cache/sessions | Free or pro tier |
| **Cloudflare** | $0 | DNS + SSL | Free tier |
| **GitHub Actions** | $0 | CI/CD | Free for public repos |
| **&nbsp;** | | | |
| **TOTAL** | **~$65-110/month** | | Scales as you grow |

---

## PHASE 1: PREREQUISITES (15 minutes)

### 1.1 What You Already Have
- ✅ Supabase PostgreSQL database
- ✅ Upstash Redis cache
- ✅ Docker images (built in previous phase)
- ✅ GitHub repository
- ✅ Domain name

### 1.2 What You Need to Create
- ☐ Azure subscription (free $200 credit)
- ☐ Azure CLI installed
- ☐ Cloudflare account (set up DNS)

### 1.3 Setup Commands

```bash
# 1. Create Azure subscription (use free tier)
# Go to portal.azure.com, sign up (get $200 free credit)

# 2. Install Azure CLI
# macOS/Linux:
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Windows (PowerShell as admin):
# Invoke-WebRequest -Uri https://aka.ms/installazurecliwindows -OutFile AzureCLI.msi
# Start-Process AzureCLI.msi

# 3. Login to Azure
az login

# 4. Set your subscription (optional if you have only one)
az account set --subscription "Your Subscription ID"

# 5. Create resource group (keep it simple - one group)
az group create --name outmate-prod --location eastus
```

---

## PHASE 2: AZURE SETUP (Day 1 - 2 hours)

### 2.1 Create Container Registry

```bash
# 1. Create Azure Container Registry
az acr create \
  --resource-group outmate-prod \
  --name outmateregistry \
  --sku Basic

# Output will show:
# loginServer: outmateregistry.azurecr.io

# 2. Save this loginServer, you'll need it later
AZURE_REGISTRY=outmateregistry.azurecr.io
```

**What this does:** Creates a private Docker registry to store your backend image.

---

### 2.2 Build and Push Docker Image

```bash
# 1. Login to Azure Container Registry
az acr login --name outmateregistry

# 2. Build the backend image (from your project root)
cd Backend
docker build -t $AZURE_REGISTRY/outmate-api:latest .
docker build -t $AZURE_REGISTRY/outmate-api:v1.0.0 .

# 3. Push images to Azure
docker push $AZURE_REGISTRY/outmate-api:latest
docker push $AZURE_REGISTRY/outmate-api:v1.0.0

# 4. Verify images are in registry
az acr repository list --name outmateregistry
```

**Expected output:**
```
outmate-api
```

---

### 2.3 Create Container Apps Environment

```bash
# 1. Create Container Apps environment
# (This is required before creating individual container apps)
az containerapp env create \
  --name outmate-env \
  --resource-group outmate-prod \
  --location eastus

# This creates a managed environment where your containers will run
# No VNet, no complex networking - just a simple execution environment
```

**What this does:** Creates the managed environment for your backend container.

---

### 2.4 Deploy Backend API

```bash
# 1. Deploy the container app
az containerapp create \
  --resource-group outmate-prod \
  --name outmate-api \
  --environment outmate-env \
  --image $AZURE_REGISTRY/outmate-api:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server $AZURE_REGISTRY \
  --registry-username 00000000-0000-0000-0000-000000000000 \
  --registry-password "$(az acr login --name outmateregistry --expose-token --output tsv --query accessToken)" \
  --min-replicas 1 \
  --max-replicas 1 \
  --env-vars \
    ENVIRONMENT=production \
    LOG_LEVEL=WARNING \
    LOG_FORMAT=json

# 2. Get the FQDN (fully qualified domain name)
BACKEND_URL=$(az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo "Backend API is running at: https://$BACKEND_URL"

# 3. Test the endpoint
curl https://$BACKEND_URL/health
```

**Expected output:**
```
{
  "status": "healthy",
  "timestamp": "2024-03-04T14:32:00Z"
}
```

---

### 2.5 Add Environment Variables to Container Apps

```bash
# Add all your secrets as environment variables
# (These will be visible in Azure, so consider using Key Vault later)

az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars \
    DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/db" \
    REDIS_URL="rediss://:password@host:6380/0" \
    JWT_SECRET="your-secret-min-32-chars" \
    CRUSTDATA_API_KEY="key" \
    EXPLORIUM_API_KEY="key" \
    CONTACTOUT_API_KEY="key" \
    OPENROUTER_API_KEY="key"

# Verify updates
az containerapp show --name outmate-api --resource-group outmate-prod
```

---

## PHASE 3: FRONTEND DEPLOYMENT (Day 1 - 1 hour)

### 3.1 Create Static Web App

```bash
# 1. Create Static Web App
az staticwebapp create \
  --name outmate-web \
  --resource-group outmate-prod \
  --location eastus \
  --sku Free \
  --app-location Frontend \
  --output-location .next

# Wait 2-3 minutes for it to create
# Keep the default domain for now (e.g., outmate-web.azurestaticapps.net)
```

**What this does:**
- Creates a static hosting service for your Next.js frontend
- Automatically provisions free SSL certificate
- Includes free CDN (~50GB bandwidth/month)

---

### 3.2 Configure Frontend Environment Variables

```bash
# 1. Set the API URL to point to your backend
az staticwebapp appsettings set \
  --name outmate-web \
  --settings

# Actually, Static Web Apps uses a different method
# Edit your next.config.js to use environment variables:

# In next.config.js:
# NEXT_PUBLIC_API_URL=https://$BACKEND_URL

# Or set via GitHub Actions (see CI/CD section)
# For now, hardcode the backend URL temporarily:
# https://outmate-api.eastus.azurecontainerapps.io
```

**Create a staticwebapp.config.json in Frontend root:**

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "*.{css,scss,jpg,jpeg,png,gif,ico,svg}"]
  },
  "globalHeaders": [
    {
      "match": "/*",
      "headers": {
        "Content-Security-Policy": "default-src 'self' https:",
        "X-Content-Type-Options": "nosniff"
      }
    }
  ]
}
```

---

### 3.3 Deploy Frontend via GitHub Actions

**Create `.github/workflows/deploy-static-web-app.yml`:**

```yaml
name: Deploy Static Web App

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true

      - name: Build and Deploy
        id: deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "Frontend"
          output_location: ".next"
```

**Get the deployment token:**

```bash
# 1. Go to Azure Portal
# 2. Find "outmate-web" Static Web App
# 3. Click "Manage deployment token"
# 4. Copy the token
# 5. Add to GitHub repository Settings → Secrets → AZURE_STATIC_WEB_APPS_API_TOKEN
```

---

## PHASE 4: DOMAIN & DNS (Day 1 - 30 minutes)

### 4.1 Set Up Cloudflare DNS (Free)

**Why Cloudflare?**
- Free DNS with auto-renewal
- Free SSL/TLS (even auto-upgrade to full SSL)
- Free CDN for static assets
- DDoS protection included

**Steps:**

```bash
# 1. Sign up at cloudflare.com (free)

# 2. Add your domain to Cloudflare
# Domain → Cloudflare → Update nameservers at your registrar

# 3. Create DNS records:

# For backend API:
# Type: CNAME
# Name: api
# Target: outmate-api.eastus.azurecontainerapps.io
# TTL: Auto

# For frontend:
# Type: CNAME  
# Name: app
# Target: outmate-web.azurestaticapps.net
# TTL: Auto

# 4. Set SSL/TLS to "Flexible" in Cloudflare (minimum)
# Or "Full" if you want end-to-end encryption
```

**Result:**
- `api.outmate.ai` → Your backend
- `app.outmate.ai` → Your frontend

---

### 4.2 Test DNS Resolution

```bash
# Wait 5-10 minutes for DNS to propagate

# 1. Check API
curl https://api.outmate.ai/health

# 2. Check frontend
curl https://app.outmate.ai

# Both should respond successfully
```

---

## PHASE 5: CI/CD PIPELINE (Day 1 - 1 hour)

### 5.1 Simple GitHub Actions for Backend

**Create `.github/workflows/deploy-backend.yml`:**

```yaml
name: Deploy Backend to Production

on:
  push:
    branches: [main]
    paths:
      - 'Backend/**'
  workflow_dispatch:

env:
  REGISTRY: outmateregistry.azurecr.io
  IMAGE_NAME: outmate-api

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to ACR
        run: |
          az acr login --name outmateregistry

      - name: Build image
        run: |
          docker build -t $REGISTRY/$IMAGE_NAME:${{ github.sha }} ./Backend
          docker build -t $REGISTRY/$IMAGE_NAME:latest ./Backend

      - name: Push image
        run: |
          docker push $REGISTRY/$IMAGE_NAME:${{ github.sha }}
          docker push $REGISTRY/$IMAGE_NAME:latest

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name outmate-api \
            --resource-group outmate-prod \
            --image $REGISTRY/$IMAGE_NAME:latest

      - name: Test endpoint
        run: |
          sleep 10
          curl https://api.outmate.ai/health
```

### 5.2 GitHub Secrets Setup

```bash
# 1. Create Azure Service Principal
az ad sp create-for-rbac \
  --name "github-actions-outmate" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID

# Output:
# {
#   "clientId": "...",
#   "clientSecret": "...",
#   "subscriptionId": "...",
#   "tenantId": "..."
# }

# 2. Create JSON from output
cat > azure-credentials.json << 'EOF'
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "subscriptionId": "your-subscription-id",
  "tenantId": "your-tenant-id"
}
EOF

# 3. Add to GitHub (Settings → Secrets → New repository secret)
# Name: AZURE_CREDENTIALS
# Value: (paste entire JSON)
```

---

## PHASE 6: ENVIRONMENT VARIABLES (Day 1 - 30 minutes)

### 6.1 Backend Required Variables

```bash
# These go into Container Apps
# Use: az containerapp update --set-env-vars

# Database (from Supabase)
DATABASE_URL=postgresql+psycopg2://user:password@host.supabase.co:5432/postgres

# Cache (from Upstash)
REDIS_URL=rediss://:password@host.upstash.io:6380/0

# JWT (generate new, min 32 chars)
JWT_SECRET=your_random_secret_minimum_32_characters_long_1234567890

# API Keys
CRUSTDATA_API_KEY=your_key
EXPLORIUM_API_KEY=your_key
CONTACTOUT_API_KEY=your_key
OPENROUTER_API_KEY=your_key

# Application
ENVIRONMENT=production
LOG_LEVEL=WARNING
LOG_FORMAT=json
```

### 6.2 Frontend Required Variables

```bash
# These go into next.config.js or .env.production

NEXT_PUBLIC_API_URL=https://api.outmate.ai
NEXT_PUBLIC_APP_NAME=Outmate
NEXT_PUBLIC_APP_ENV=production

# During build (in GitHub Actions):
# Can pass as --build-arg or via .env file
```

### 6.3 Update Container App

```bash
# Update all env vars at once
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars \
    ENVIRONMENT=production \
    LOG_LEVEL=WARNING \
    DATABASE_URL="postgresql://..." \
    REDIS_URL="rediss://..." \
    JWT_SECRET="..." \
    CRUSTDATA_API_KEY="..." \
    EXPLORIUM_API_KEY="..." \
    CONTACTOUT_API_KEY="..." \
    OPENROUTER_API_KEY="..."
```

---

## PHASE 7: MONITORING & TESTING (Day 2 - 1 hour)

### 7.1 Quick Health Checks

```bash
# 1. Backend health
curl -v https://api.outmate.ai/health
curl https://api.outmate.ai/health/db
curl https://api.outmate.ai/health/redis

# 2. Frontend
curl -v https://app.outmate.ai

# 3. Container logs (if something fails)
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --follow
```

### 7.2 Manual Testing Checklist

```
□ Backend API responds
□ Database connection works
□ Redis connection works
□ Frontend loads
□ API calls from frontend work
□ Rate limiting is active
□ Logs are in JSON format
□ Health endpoints return correct status
```

### 7.3 Simple Monitoring (Free)

```bash
# 1. View container metrics
az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query properties.runningStatus

# 2. Check recent logs
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --tail 50

# 3. (Optional) Enable built-in monitoring
az containerapp dapr enable \
  --name outmate-api \
  --resource-group outmate-prod \
  --dapr-app-id outmate-api
```

---

## DEPLOYMENT TIMELINE

### **DAY 1 (6 hours)**

| Time | Task | Duration |
|------|------|----------|
| 9:00 AM | Prerequisites + Azure setup | 45 min |
| 9:45 AM | Build & push Docker image | 30 min |
| 10:15 AM | Deploy Container Apps | 45 min |
| 11:00 AM | _Break_ | 15 min |
| 11:15 AM | Create Static Web App | 20 min |
| 11:35 AM | Configure frontend | 25 min |
| 12:00 PM | Setup Cloudflare DNS | 30 min |
| **12:30 PM** | **LAUNCH LIVE** | |
| 1:00 PM | Basic monitoring setup | 30 min |
| 1:30 PM | **END OF DAY 1** | |

### **DAY 2 (2-3 hours)**

| Time | Task | Duration |
|------|------|----------|
| 9:00 AM | Set up CI/CD pipeline | 45 min |
| 9:45 AM | GitHub Actions testing | 30 min |
| 10:15 AM | Full end-to-end testing | 45 min |
| 11:00 AM | Documentation + handoff | 30 min |
| **11:30 AM** | **FULLY AUTOMATED** | |

**Total: ~10 hours of actual work**

---

## QUICK REFERENCE COMMANDS

### Deploy Backend Update

```bash
# 1. Build image
docker build -t outmateregistry.azurecr.io/outmate-api:latest Backend/

# 2. Push  
docker push outmateregistry.azurecr.io/outmate-api:latest

# 3. Update Container App
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --image outmateregistry.azurecr.io/outmate-api:latest
```

### View Logs

```bash
# Real-time logs
az containerapp logs show --name outmate-api --resource-group outmate-prod --follow

# Last 50 lines
az containerapp logs show --name outmate-api --resource-group outmate-prod --tail 50
```

### Update Environment Variables

```bash
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars LOG_LEVEL=DEBUG
```

### Restart Container

```bash
# There's no direct restart, but you can force redeploy
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --image outmateregistry.azurecr.io/outmate-api:latest
```

---

## COST ESTIMATE

### Monthly Breakdown (Startup Phase)

| Service | Cost | Notes |
|---------|------|-------|
| Container Apps | $50 | 1 vCPU, 2GB, 100K requests |
| Container Registry | $15 | 1GB storage |
| Static Web Apps | $0 | Free tier (50GB/month) |
| Supabase | $0-25 | Free tier OK |
| Upstash Redis | $0-20 | Free tier OK |
| Cloudflare | $0 | Free tier |
| Domain | $10-15 | Registrar cost |
| **TOTAL** | **$75-125/month** | All inclusive |

### Cost Scaling

```
0-1000 API calls/day:     $75/month
1K-10K API calls/day:     $100/month (same Container Apps tier)
10K-50K API calls/day:    $150/month (upgrade Container Apps)
50K-100K API calls/day:   $200/month (multiple replicas)
```

---

## WHAT TO SKIP FOR NOW

- ❌ **Azure Front Door** - Use Cloudflare instead (free)
- ❌ **Virtual Networks** - Add later if needed
- ❌ **Azure Key Vault** - Use environment variables for now
- ❌ **Application Insights** - Use container logs initially
- ❌ **Auto-scaling** - Not needed for MVP (~$50 just runs, scales up if needed)
- ❌ **Multiple resource groups** - Keep everything in `outmate-prod`
- ❌ **Private endpoints** - Not critical for MVP
- ❌ **Backup strategy** - Supabase has automated backups
- ❌ **Advanced monitoring** - Monitor via logs initially

---

## WHAT TO ADD LATER (SCALE STAGE)

When you hit 10K+ API requests/day:

1. **Enable auto-scaling** (Container Apps)
   ```bash
   az containerapp update --name outmate-api --max-replicas 5
   ```

2. **Add Application Insights** (free tier)
   - Better dashboard than logs
   - Performance monitoring
   - Error tracking

3. **Upgrade to Premium Cloudflare** ($20/mo)
   - Advanced WAF
   - Advanced DDoS
   - Page Rules for optimization

4. **Add Azure CDN** (optional)
   - Cache static assets
   - Better geographic distribution

5. **Implement secrets rotation**
   - Add Azure Key Vault
   - Rotate API keys every 90 days

---

## TROUBLESHOOTING

### Container won't start

```bash
# 1. Check logs
az containerapp logs show --name outmate-api --resource-group outmate-prod

# 2. Check image exists
az acr repository list --name outmateregistry

# 3. Re-push image
docker push outmateregistry.azurecr.io/outmate-api:latest

# 4. Force redeploy
az containerapp update --name outmate-api --resource-group outmate-prod \
  --image outmateregistry.azurecr.io/outmate-api:latest
```

### Frontend not loading API

```bash
# 1. Verify NEXT_PUBLIC_API_URL is correct
# Check in: Frontend/.env.production or next.config.js

# 2. Verify CORS is enabled in backend
# Check: Backend/app/main.py for CORSMiddleware

# 3. Check network tab in browser
# Ensure requests go to correct URL
```

### DNS not resolving

```bash
# Check propagation
nslookup api.outmate.ai
nslookup app.outmate.ai

# If not working:
# 1. Wait 5-10 minutes
# 2. Check Cloudflare DNS records
# 3. Verify nameservers at domain registrar
```

---

## FINAL CHECKLIST

- [ ] Azure subscription created
- [ ] Container Registry created + image pushed
- [ ] Container Apps deployed + responding
- [ ] Static Web Apps deployed + responding
- [ ] Cloudflare DNS configured
- [ ] Backend environment variables set
- [ ] Frontend API URL configured
- [ ] Health endpoints verified working
- [ ] GitHub Actions configured
- [ ] CI/CD pipeline tested
- [ ] All 3 health checks pass (health, health/db, health/redis)
- [ ] Frontend loads and makes API calls
- [ ] Custom domain working (api.outmate.ai, app.outmate.ai)

---

## SUMMARY

**This is a lean, realistic production deployment for early-stage SaaS.**

✅ **What you get:**
- Secure, scalable backend (Container Apps)
- Fast, free frontend hosting (Static Web Apps)
- Automated CI/CD (GitHub Actions)
- Custom domain + SSL (Cloudflare)
- Under $150/month

✅ **What you don't get:**
- Enterprise monitoring (add later)
- Advanced security (add later)
- Multi-region redundancy (add later)
- Auto-scaling (add when needed)

✅ **Timeline:**
- Day 1: Deploy to production (6 hours)
- Day 2: Finalize CI/CD (2-3 hours)

✅ **Team size:** 1 person

**You're ready to launch! 🚀**

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Estimated Setup Cost:** $0 (use Azure free $200 credit)  
**Estimated Monthly Cost:** $75-125
