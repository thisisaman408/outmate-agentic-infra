# OUTMATE.AI PRODUCTION DEPLOYMENT: QUICK START GUIDE

**Get Outmate.AI to production in 2 days - Complete operational overview**

---

## 📋 YOUR DEPLOYMENT DOCUMENTS

You now have 4 production-ready documents:

| Document | Purpose | Read Time | Use When |
|----------|---------|-----------|----------|
| [OUTMATE_PRODUCTION_PLAYBOOK.md](OUTMATE_PRODUCTION_PLAYBOOK.md) | **Primary Reference** - Step-by-step deployment with exact CLI commands | 45 min | Deploying to Azure |
| [LEAN_AZURE_DEPLOYMENT_PLAN.md](LEAN_AZURE_DEPLOYMENT_PLAN.md) | Architecture overview + phase breakdown | 20 min | Understanding the plan |
| [ENTERPRISE_vs_LEAN_COMPARISON.md](ENTERPRISE_vs_LEAN_COMPARISON.md) | Decision framework + cost analysis | 15 min | Choosing architecture |
| [AZURE_INFRASTRUCTURE_PLAN.md](AZURE_INFRASTRUCTURE_PLAN.md) | Enterprise reference (for future scaling) | 30 min | Adding enterprise features later |

---

## 🚀 DEPLOYMENT TIMELINE

### Day 1: Backend Deployment (6 Hours)

**Hour 1: Environment Setup**
```bash
# Install tools (15 min)
# - Azure CLI
# - Docker
# - Node.js
# - Verify all installations

# Login to Azure (5 min)
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

→ **Playbook Steps:** 0.1 to 1.2

**Hours 2-3: Azure Infrastructure (90 min)**
```bash
# Create resources (60 min)
# - Resource Group: outmate-prod
# - Container Registry: outmateacr
# - Container Apps Environment: outmate-env

# Expected time: 20-30 min for resources to be ready
```

→ **Playbook Steps:** 1.3 to 1.6

**Hour 4: Docker Build & Push (60 min)**
```bash
# Build backend image (20 min)
docker build -t outmate-api:latest Backend/

# Push to Azure Container Registry (20 min - first time slower)
docker push outmateacr.azurecr.io/outmate-api:latest

# Total: ~40 min (15-20 min after first time)
```

→ **Playbook Steps:** 2.1 to 2.4

**Hour 5: Backend Deployment (60 min)**
```bash
# Deploy to Container Apps (30 min)
az containerapp create \
  --name outmate-api \
  --resource-group outmate-prod \
  --environment outmate-env \
  --image outmateacr.azurecr.io/outmate-api:latest \
  --target-port 8000 \
  --cpu 1 --memory 2Gi \
  --min-replicas 1 --max-replicas 1 \
  --ingress external

# Configure environment variables (10 min)
az containerapp update --name outmate-api --set-env-vars ...

# Verify health endpoint (5 min)
curl https://api.outmate.ai/health
# Response: {"status": "ok", ...}
```

→ **Playbook Steps:** 3.1 to 3.6

**Hour 6: CI/CD Setup (60 min)**
```bash
# Create GitHub Actions workflow (20 min)
# - Add .github/workflows/deploy-backend.yml
# - Set GitHub secrets (AZURE_CLIENT_ID, etc.)

# Test workflow (10 min)
git push origin main
# Workflow auto-triggers and deploys

# Total: ~30 min hands-on time
```

→ **Playbook Step:** 5.1 to 5.4

**End of Day 1:**
- ✅ Backend API live at `https://api.outmate.ai/health`
- ✅ Automated CI/CD pipeline active
- ✅ Logs accessible and monitoring in place

---

### Day 2: Frontend & DNS (2-3 Hours)

**Hour 1: Frontend Deployment (60 min)**
```bash
# Create Static Web App + GitHub connection (20 min)
az staticwebapp create \
  --name outmate-web \
  --resource-group outmate-prod \
  --source https://github.com/YOUR_USERNAME/outmate \
  --branch main \
  --output-location out

# Set environment variables (5 min)
az staticwebapp appsettings set \
  --name outmate-web \
  --setting-names NEXT_PUBLIC_API_URL=https://api.outmate.ai

# Verify deployment (10 min)
curl https://outmate-web.azurefd.net
# Response: HTML of Next.js app
```

→ **Playbook Steps:** 4.1 to 4.5

**Hour 2: Domain & DNS (30 min)**
```bash
# Create Cloudflare DNS records (15 min)
# A: api CNAME → outmate-api.[hash].eastus.azurecontainerapps.io
# A: app CNAME → outmate-web.azurefd.net

# Link custom domains to Azure (10 min)
az staticwebapp custom-domain add \
  --name outmate-web \
  --domain-name app.outmate.ai

# DNS propagation verification (5 min, may take 24h for full global)
nslookup api.outmate.ai
nslookup app.outmate.ai
```

→ **Playbook Step:** 6.0 to 6.6

**Optional Hour 3: Monitoring & Testing (if you have time)**
```bash
# Verify health endpoints
curl https://api.outmate.ai/health
curl https://api.outmate.ai/health/db
curl https://api.outmate.ai/health/redis

# Test frontend
curl https://app.outmate.ai

# View logs
az containerapp logs show --name outmate-api --follow
```

→ **Playbook Steps:** 8.1 to 8.6

**End of Day 2:**
- ✅ Frontend live at `https://app.outmate.ai`
- ✅ Backend API accessible at `https://api.outmate.ai`
- ✅ Custom domains configured (DNS propagating)
- ✅ HTTPS working on both

---

## 📝 QUICK DEPLOYMENT CHECKLIST

### Before You Start
```
[ ] Azure account created (free tier with $200 credit)
[ ] Azure subscription ready
[ ] GitHub repository code pushed to main
[ ] Domain registered (outmate.ai or similar)
[ ] Cloudflare account created
[ ] Environment variables documented (from .env.example)
[ ] Docker tested locally
[ ] All API keys gathered (OPENROUTER, CRUSTDATA, etc.)
```

### Day 1 Tasks
```
[ ] 0.1 - 0.3: Install and verify tools (30 min)
[ ] 1.1 - 1.2: Azure login and subscription (5 min)
[ ] 1.3 - 1.4: Create resource group and registry (5 min)
[ ] 1.5 - 1.6: Create Container Apps environment (10 min)
[ ] 2.1 - 2.4: Build and push Docker image (40 min)
[ ] 3.1 - 3.6: Deploy backend container app (60 min)
[ ] 5.1 - 5.4: Setup GitHub Actions CI/CD (30 min)

TOTAL DAY 1: ~180 minutes (hands-on: ~120 min)
```

### Day 2 Tasks
```
[ ] 4.1 - 4.5: Deploy frontend Static Web App (30 min)
[ ] 6.1 - 6.6: Configure Cloudflare DNS (20 min)
[ ] 7.1 - 7.4: Set environment variables (if not done) (10 min)
[ ] 8.1 - 8.6: Verify health endpoints (10 min)

TOTAL DAY 2: ~70 minutes
```

---

## 🎯 CRITICAL COMMANDS (Copy-Paste Ready)

### Login & Setup
```bash
# Login to Azure
az login

# Choose subscription
az account set --subscription "12345678-1234-1234-1234-123456789012"

# Create resource group
az group create --name outmate-prod --location eastus

# Create registry
az acr create --resource-group outmate-prod --name outmateacr --sku Basic --location eastus

# Create environment
az containerapp env create --name outmate-env --resource-group outmate-prod --location eastus
```

### Build & Push
```bash
# Build image
docker build -t outmate-api:latest Backend/

# Login to registry
az acr login --name outmateacr

# Tag and push
docker tag outmate-api:latest outmateacr.azurecr.io/outmate-api:latest
docker push outmateacr.azurecr.io/outmate-api:latest
```

### Deploy Backend
```bash
# Deploy container app
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

# Get endpoint URL
az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv
```

### Deploy Frontend
```bash
# Create Static Web App
az staticwebapp create \
  --name outmate-web \
  --resource-group outmate-prod \
  --location eastus \
  --source https://github.com/YOUR_USERNAME/outmate \
  --branch main \
  --output-location out \
  --token GITHUB_TOKEN
```

---

## 🔗 ARCHITECTURE AT A GLANCE

```
Users (Browser)
  ↓ (HTTPS)
Cloudflare DNS (Free)
  ├→ api.outmate.ai
  │  ↓
  │  Azure Container Apps (FastAPI Backend)
  │  • 1 vCPU, 2GB RAM
  │  • 1 replica ($50/mo)
  │  • Auto health checks
  │
  └→ app.outmate.ai
     ↓
     Azure Static Web Apps (Next.js Frontend)
     • Free tier
     • 50GB bandwidth/month
     • Auto-build from GitHub

Backend connects to:
  • Supabase PostgreSQL (existing)
  • Upstash Redis (existing)
  • External APIs (OpenRouter, Crustdata, etc.)

Storage:
  • Azure Container Registry: $15/month (image storage)
  
**Total Cost: ~$65-70/month**
```

---

## 📱 MONITORING & HEALTH

### Health Endpoints (Test These)
```bash
# Overall health
curl https://api.outmate.ai/health

# Database health
curl https://api.outmate.ai/health/db

# Redis health
curl https://api.outmate.ai/health/redis

# Frontend
curl https://app.outmate.ai
```

### View Live Logs
```bash
# Real-time logs with 50 latest lines
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --follow \
  --tail 50

# Exit: Ctrl+C
```

---

## 🔄 CI/CD WORKFLOW

Once set up, deployments are automatic:

```
1. Developer pushes to GitHub main branch
        ↓
2. GitHub Actions workflow triggers
        ↓
3. Docker image built (from Backend/Dockerfile)
        ↓
4. Image pushed to outmateacr.azurecr.io
        ↓
5. Container Apps pulls new image
        ↓
6. New revision created
        ↓
7. Health checks verify deployment
        ↓
8. Traffic routes to new revision (100%)
        ↓
9. Old revision kept for rollback

Time: 3-5 minutes per deployment
No manual intervention needed

Rollback: 1 command to revert to previous version
```

---

## 🚨 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "Command not found: az" | Install Azure CLI (Step 0.1) |
| "Login failed" | Run `az login` and check you're in correct subscription |
| "Docker image too large" | From multi-stage build - it's OK (but check if you added large files) |
| "Container app won't start" | Check logs: `az containerapp logs show --name outmate-api` |
| "Health endpoint returns 500" | Check database and Redis URLs in environment variables |
| "DNS not resolving" | Wait 24-48 hours for global propagation or use DNS checker tool |
| "Need to rollback" | See Step 10 in playbook for exact commands |

---

## 📊 COST BREAKDOWN

**Baseline (MVP):**
- Container Apps: $50/month
- Container Registry: $15/month
- Static Web Apps: Free
- Bandwidth: ~$0-5/month
- **Total: $65-70/month**

**Optional (Add Later):**
- Application Insights: +$30/month (monitoring)
- Key Vault: +$1/month (secrets management)
- Auto-scaling (2+ replicas): +$50-100/month

**External (Already Counted):**
- Supabase PostgreSQL: Your existing bill
- Upstash Redis: Your existing bill
- API calls (OpenRouter, Crustdata): Pay-per-use

---

## 📚 DOCUMENT STRUCTURE

```
├── OUTMATE_PRODUCTION_PLAYBOOK.md (← MAIN REFERENCE)
│   ├── Steps 0-11: Exactly what to do
│   ├── 600+ lines of copy-paste commands
│   └── Troubleshooting guide
│
├── LEAN_AZURE_DEPLOYMENT_PLAN.md
│   ├── Phase-by-phase breakdown
│   └── Alternative detailed timeline
│
├── ENTERPRISE_vs_LEAN_COMPARISON.md
│   ├── Cost analysis
│   ├── Feature comparison
│   └── Upgrade path
│
└── AZURE_INFRASTRUCTURE_PLAN.md (for future scaling)
    ├── Enterprise approach
    └── 8-week timeline reference
```

---

## ✅ SUCCESS CRITERIA

After following this guide, you should have:

- [ ] ✅ Backend API responding at `https://api.outmate.ai/health` (HTTP 200)
- [ ] ✅ Frontend loaded at `https://app.outmate.ai` (displays homepage)
- [ ] ✅ Database connected (`/health/db` returns healthy)
- [ ] ✅ Redis connected (`/health/redis` returns healthy)
- [ ] ✅ GitHub Actions workflow running on every push
- [ ] ✅ Health checks configured and passing
- [ ] ✅ Logs accessible via Azure CLI
- [ ] ✅ Rollback procedure tested
- [ ] ✅ Cost under $100/month
- [ ] ✅ Single developer can maintain it

---

## 🎬 NEXT STEPS

### Immediate (Now)
1. **Read** [OUTMATE_PRODUCTION_PLAYBOOK.md](OUTMATE_PRODUCTION_PLAYBOOK.md) (the main reference)
2. **Prepare** Azure account, GitHub, domain, Cloudflare
3. **Reserve** 2 days in your calendar

### Day 1
1. Complete Step 0-5 from the playbook (environment → CI/CD)
2. Verify backend is live
3. Test health endpoints

### Day 2
1. Complete Step 4-6 (frontend → DNS)
2. Verify frontend is live
3. Test end-to-end flow

### Week 1
1. Monitor logs and health checks
2. Test all API endpoints
3. Verify database connections
4. Check email notifications

### Month 1+
1. Optimize based on usage patterns
2. Add Application Insights if needed
3. Plan scaling if you have >10K daily users
4. Update dependencies

---

## 🤝 SUPPORT & DEBUGGING

**Can't find something?**
- Search the playbook for the component name
- Check the "Quick Reference Commands" section (Appendix)
- See the "Troubleshooting Guide" (Step 11.3)

**Need to scale?**
- See Step 9 in the playbook
- Cost increases with usage, not fixed

**Want to rollback?**
- See Step 10 in the playbook
- Takes 1 command, 30 seconds

---

## 📞 OPERATING THE SYSTEM

Once live, weekly maintenance is minimal:

```bash
# Weekly (Monday morning)
curl https://api.outmate.ai/health  # Verify it's up

# Monthly
git pull && git push  # Trigger CI/CD, pulls latest

# Quarterly
docker build Backend/
# Build new image, push, deploy (automatic via CI/CD)
```

---

## 🎓 LEARNING RESOURCES

If you're new to any of these technologies:

- **Azure Container Apps:** https://learn.microsoft.com/azure/container-apps
- **GitHub Actions:** https://docs.github.com/actions
- **FastAPI:** https://fastapi.tiangolo.com
- **Next.js:** https://nextjs.org
- **Docker:** https://docs.docker.com
- **Cloudflare:** https://developers.cloudflare.com

---

**Status:** Ready to deploy  
**Estimated Time:** 8-10 hours over 2 days  
**Difficulty:** Intermediate (following a playbook)  
**Support:** All commands are copy-paste ready

---

**Start with:** [OUTMATE_PRODUCTION_PLAYBOOK.md](OUTMATE_PRODUCTION_PLAYBOOK.md) (Step 0: Environment Setup)

Good luck! 🚀
