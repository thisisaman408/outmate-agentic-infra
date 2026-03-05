# OUTMATE.AI PRODUCTION DEPLOYMENT PLAYBOOK

**Complete operational documentation for deploying Outmate.AI to Azure production stack**

This playbook is designed for a **single developer** and covers everything needed to deploy and maintain Outmate.AI in production.

**Status:** Ready for immediate deployment  
**Timeline:** 2 days (Day 1: Backend, Day 2: Frontend & CI/CD)  
**Cost:** $75-125/month  
**Target Audience:** Solo founder / 1-2 person DevOps team  

---

## TABLE OF CONTENTS

1. [Project Stack Confirmation](#project-stack-confirmation)
2. [Architecture Diagram](#architecture-diagram)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Step 0: Environment Setup](#step-0-environment-setup)
5. [Step 1: Azure CLI & Resource Setup](#step-1-azure-cli--resource-setup)
6. [Step 2: Docker Building & Image Management](#step-2-docker-building--image-management)
7. [Step 3: Backend Deployment (Container Apps)](#step-3-backend-deployment-container-apps)
8. [Step 4: Frontend Deployment (Static Web Apps)](#step-4-frontend-deployment-static-web-apps)
9. [Step 5: CI/CD Pipeline Setup](#step-5-cicd-pipeline-setup)
10. [Step 6: Domain & DNS Configuration](#step-6-domain--dns-configuration)
11. [Step 7: Environment Variables](#step-7-environment-variables)
12. [Step 8: Monitoring & Logging](#step-8-monitoring--logging)
13. [Step 9: Scaling Strategy](#step-9-scaling-strategy)
14. [Step 10: Rollback Procedures](#step-10-rollback-procedures)
15. [Step 11: Maintenance & Operations](#step-11-maintenance--operations)
16. [Appendix: Quick Reference Commands](#appendix-quick-reference-commands)

---

## PROJECT STACK CONFIRMATION

### ✅ CONFIRMED STACK

| Component | Status | Details |
|-----------|--------|---------|
| **Backend Framework** | ✅ | FastAPI 0.104+ |
| **Backend Runtime** | ✅ | Python 3.11 |
| **Backend Deployment** | ✅ | Docker container |
| **Backend Server** | ✅ | Uvicorn + Gunicorn |
| **Frontend Framework** | ✅ | Next.js 14+ |
| **Frontend Runtime** | ✅ | Node.js 18+ |
| **Frontend Deployment** | ✅ | Docker container |
| **Package Manager** | ✅ | pnpm (frontend) / pip (backend) |
| **Database** | ✅ | Supabase PostgreSQL (existing) |
| **Cache** | ✅ | Upstash Redis (existing) |
| **Registry** | ✅ | Docker locally, Azure ACR for prod |
| **Container Orchestration** | ✅ | Azure Container Apps |
| **Static Hosting** | ✅ | Azure Static Web Apps |
| **Health Endpoints** | ✅ | /health, /health/db, /health/redis |
| **CI/CD** | ✅ | GitHub Actions (to be created) |

### ✅ KEY FILES

**Backend:**
- `Backend/Dockerfile` - Production-grade multi-stage build
- `Backend/requirements.txt` - All Python dependencies
- `Backend/app/main.py` - FastAPI application entry point
- `Backend/app/core/config.py` - Configuration management
- `Backend/app/api/routes/health.py` - Health check endpoints
- `Backend/.env.example` - Environment variable template

**Frontend:**
- `Frontend/Dockerfile` - Production-grade multi-stage build
- `Frontend/package.json` - Dependencies and build scripts
- `Frontend/next.config.mjs` - Next.js configuration
- `Frontend/.env.local` - Environment variables (development)
- `Frontend/tsconfig.json` - TypeScript configuration

---

## ARCHITECTURE DIAGRAM

### Production Architecture (Lean)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                    EXTERNAL USERS                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE (FREE)                          │
│  • DNS routing (app.outmate.ai, api.outmate.ai)               │
│  • SSL/TLS termination                                        │
│  • Free WAF + DDoS protection                                 │
│  • 197+ global edge locations                                 │
└────────────────────────────────────────────────────────────────┘
         ↓ app.outmate.ai              ↓ api.outmate.ai
         
┌─────────────────────────────┐    ┌──────────────────────────────┐
│ AZURE STATIC WEB APPS       │    │ AZURE CONTAINER APPS         │
│ (Frontend - Next.js)        │    │ (Backend - FastAPI)          │
│                             │    │                              │
│ • Free tier                 │    │ • 1 vCPU, 2GB RAM            │
│ • 50GB bandwidth            │    │ • $50/month baseline         │
│ • Auto-scaling              │    │ • Ingress endpoint: 8000     │
│ • GitHub Actions            │    │ • Warm up in 2-3 seconds     │
│ • Auto-HTTPS                │    │ • Health checks: /health     │
│ • Built-in logs             │    │ • Container logs             │
└─────────────────────────────┘    └──────────────────────────────┘
         ↓                                  ↓
         └──────────────────┬───────────────┘
                            ↓ HTTPS
         ┌──────────────────────────────────┐
         │    EXTERNAL SERVICES             │
         │                                  │
         │  • Supabase (PostgreSQL)         │
         │    - Existing DB connection      │
         │    - In-use supabase_key         │
         │    - Automatic backups           │
         │                                  │
         │  • Upstash Redis                 │
         │    - Existing Redis connection   │
         │    - In-use REDIS_URL            │
         │                                  │
         │  • OpenRouter (LLM)              │
         │    - Existing API key            │
         │    - Optional integrations       │
         │                                  │
         │  • Crustdata, Explorium APIs     │
         │    - Existing API keys           │
         │                                  │
         └──────────────────────────────────┘

STORAGE (Private Azure)
┌──────────────────────────────────┐
│ AZURE CONTAINER REGISTRY (Basic) │
│                                  │
│ • $15/month                      │
│ • Stores Docker images           │
│ • outmate-api:latest             │
│ • outmate-api:v1.0.0             │
│ • outmate-api:commit-hash        │
│                                  │
│ Images pulled by Container Apps  │
└──────────────────────────────────┘

RESOURCE GROUP (Single)
└─ outmate-prod (all resources)

OPTIONAL (Add Later - Week 2+)
┌──────────────────────────────────┐
│ APPLICATION INSIGHTS             │
│ • $30/month                      │
│ • Real-time metrics              │
│ • Custom logging                 │
│ • Distributed tracing            │
│ • Alerts and dashboards          │
└──────────────────────────────────┘
```

---

## PRE-DEPLOYMENT CHECKLIST

Before starting, verify you have:

- [ ] **Azure Account Created** - Free tier with $200 credit for 30 days
- [ ] **Azure Subscription ID** - Get from Azure Portal
- [ ] **GitHub Account** - Source code repository access
- [ ] **Cloudflare Free Account** - For DNS (create at cloudflare.com)
- [ ] **Domain Registered** - outmate.ai or similar (at Namecheap, GoDaddy, etc.)
- [ ] **Repository Connected to GitHub** - Code pushed to main branch
- [ ] **Docker Installed Locally** - For testing builds
- [ ] **Azure CLI Installed** - For infrastructure commands
- [ ] **Node.js 18+ Installed** - For frontend testing
- [ ] **Git Configured** - git config user.name and user.email
- [ ] **Environment Variables Ready** - Keys for DATABASE_URL, REDIS_URL, API keys
- [ ] **Slack/Email Monitoring Ready** - To receive deployment alerts

---

## STEP 0: ENVIRONMENT SETUP

### 0.1 Install Required Tools

**Windows:**
```powershell
# Azure CLI
# Download from: https://aka.ms/InstallAzureCliWindows
# Or use Winget:
winget install -e --id Microsoft.AzureCLI

# Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop
# Or use Winget:
winget install -e --id Docker.DockerDesktop

# Node.js (if not installed)
winget install -e --id OpenJS.NodeJS

# Visual Studio Code (optional but recommended)
winget install -e --id Microsoft.VisualStudioCode

# Git (if not installed)
winget install -e --id Git.Git
```

**macOS:**
```bash
# Using Homebrew
brew install azure-cli
brew install --cask docker
brew install node
brew install git
```

**Linux (Ubuntu/Debian):**
```bash
# Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Docker
sudo apt-get install docker.io docker-compose

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Git
sudo apt-get install git
```

### 0.2 Verify Installations

```bash
# Verify Azure CLI (should output version 2.50+)
az --version

# Verify Docker (should output Client version)
docker --version

# Verify Node.js (should output version 18.x or higher)
node --version

# Verify npm/pnpm
npm --version
pnpm --version

# Verify Git (should output git version)
git --version
```

### 0.3 Configure Git (First Time Only)

```bash
# Set your git identity (used for commits)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify configuration
git config --global user.name
git config --global user.email
```

---

## STEP 1: AZURE CLI & RESOURCE SETUP

### 1.1 Login to Azure

```bash
# Interactive login (opens browser)
az login

# Verify you're logged in (shows currently selected subscription)
az account show
```

### 1.2 Select Subscription

```bash
# List all subscriptions you have access to
az account list --output table

# Set the subscription (replace SUBSCRIPTION_ID with your actual ID)
az account set --subscription "SUBSCRIPTION_ID"

# Verify subscription is set
az account show
```

### 1.3 Create Resource Group

```bash
# Variables (customize as needed)
$resourceGroupName = "outmate-prod"
$location = "eastus"  # Free tier available in eastus

# Create resource group
az group create --name $resourceGroupName --location $location

# Verify creation
az group show --name $resourceGroupName
```

### 1.4 Create Azure Container Registry (ACR)

```bash
# Variables
$acrName = "outmateacr"  # Must be globally unique, lowercase, no hyphens
$resourceGroupName = "outmate-prod"
$location = "eastus"

# Create ACR (Basic tier = $15/month)
az acr create `
  --resource-group $resourceGroupName `
  --name $acrName `
  --sku Basic `
  --location $location

# Get ACR login server URL
az acr show --name $acrName --query loginServer --output tsv
# Output will be: outmateacr.azurecr.io

# Enable admin user for local development testing
az acr update --name $acrName --admin-enabled true

# Get credentials (for docker login)
az acr credential show --name $acrName
# Save the password for use in Step 2.3
```

### 1.5 Create Container Apps Environment

```bash
# Variables
$appEnvName = "outmate-env"
$resourceGroupName = "outmate-prod"
$location = "eastus"

# Create Container Apps environment
# This is the namespace where all containers run
az containerapp env create `
  --name $appEnvName `
  --resource-group $resourceGroupName `
  --location $location

# Verify creation
az containerapp env show `
  --name $appEnvName `
  --resource-group $resourceGroupName
```

### 1.6 Verify All Resources Created

```bash
# List all resources in the resource group
az resource list --resource-group outmate-prod --output table

# Expected output should show:
# - Container Registry (outmateacr)
# - Container Apps Environment (outmate-env)
```

---

## STEP 2: DOCKER BUILDING & IMAGE MANAGEMENT

### 2.1 Build Backend Docker Image Locally

```bash
# Navigate to backend directory
cd Backend

# Build the image with 'latest' tag
# This will take 3-5 minutes the first time
docker build -t outmate-api:latest .

# Verify the build (check image size ~800MB)
docker images | grep outmate-api

# Output should show:
# REPOSITORY     TAG       IMAGE ID      CREATED      SIZE
# outmate-api    latest    abc123...     2 min ago    850MB
```

### 2.2 Test Backend Image Locally (Optional but Recommended)

```bash
# Create a temporary .env file with test values
# (Copy from Backend/.env.example)
cp .env.example .env.test

# Edit .env.test with your actual values:
# DATABASE_URL=postgresql://...
# REDIS_URL=redis://...
# OPENROUTER_API_KEY=...

# Run the container locally to test
docker run -p 8000:8000 `
  --env-file .env.test `
  --rm `
  outmate-api:latest

# In another terminal, test the endpoint
# It should return {"status": "ok", "service": "outmate-api", "version": "1.0.0"}
curl http://localhost:8000/health

# When satisfied, press Ctrl+C to stop the container
```

### 2.3 Login to Azure Container Registry

```bash
# Variables
$acrName = "outmateacr"

# Login using Azure CLI (recommended - automatic token refresh)
az acr login --name $acrName

# Alternative: Manual login with credentials (if above fails)
# Get username and password from:
az acr credential show --name $acrName

# Then login:
docker login outmateacr.azurecr.io
# Username: outmateacr
# Password: [paste the password from above]
```

### 2.4 Tag and Push Backend Image to ACR

```bash
# Variables
$acrLoginServer = "outmateacr.azurecr.io"
$imageVersion = "v1.0.0"  # Change for each release
$commitHash = "abc1234"   # Optional: git rev-parse --short HEAD

# Tag the image for ACR
docker tag outmate-api:latest $acrLoginServer/outmate-api:latest
docker tag outmate-api:latest $acrLoginServer/outmate-api:$imageVersion
docker tag outmate-api:latest $acrLoginServer/outmate-api:$commitHash

# Push all tags to ACR (first push takes 2-3 minutes)
docker push $acrLoginServer/outmate-api:latest
docker push $acrLoginServer/outmate-api:$imageVersion
docker push $acrLoginServer/outmate-api:$commitHash

# Verify images in registry
az acr repository show-tags --name outmateacr --repository outmate-api

# Output should show:
# [
#   "abc1234",
#   "latest",
#   "v1.0.0"
# ]
```

### 2.5 Build Frontend Docker Image (Optional - Azure Static Web Apps Can Deploy Direct)

**Note:** Azure Static Web Apps can build Next.js directly from source. Container approach is optional.

```bash
# Navigate to frontend directory
cd ../Frontend

# Build the image
docker build -t outmate-web:latest .

# Verify build
docker images | grep outmate-web

# Test locally (optional)
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --rm \
  outmate-web:latest

# Visit http://localhost:3000 to test
# Then Ctrl+C to stop
```

### 2.6 Image Tagging Strategy

```
For production, use semantic versioning:

1. LATEST tag
   docker tag outmate-api:ABC1234 outmateacr.azurecr.io/outmate-api:latest
   Usage: Quick deployments, current production version

2. VERSION tag
   docker tag outmate-api:ABC1234 outmateacr.azurecr.io/outmate-api:v1.0.0
   Usage: Specific version rollbacks, version tracking

3. COMMIT HASH tag
   docker tag outmate-api:ABC1234 outmateacr.azurecr.io/outmate-api:abc1234
   Usage: CI/CD pipeline, audit trail

4. BRANCH tag (for CI/CD)
   docker tag outmate-api:ABC1234 outmateacr.azurecr.io/outmate-api:main
   Usage: Branch-specific deployments
```

---

## STEP 3: BACKEND DEPLOYMENT (CONTAINER APPS)

### 3.1 Create Container App for Backend

```bash
# Variables
$acrLoginServer = "outmateacr.azurecr.io"
$appName = "outmate-api"
$appEnvName = "outmate-env"
$resourceGroupName = "outmate-prod"
$imageName = "$acrLoginServer/outmate-api:latest"

# Create the container app
az containerapp create `
  --name $appName `
  --resource-group $resourceGroupName `
  --environment $appEnvName `
  --image $imageName `
  --target-port 8000 `
  --ingress external `
  --registry-server $acrLoginServer `
  --registry-username outmateacr `
  --registry-password [GET FROM az acr credential show] `
  --cpu 1 `
  --memory 2Gi `
  --min-replicas 1 `
  --max-replicas 1

# This command creates a container application that:
# • Pulls the image from ACR
# • Listens on port 8000
# • Exposes an ingress endpoint (publicly accessible)
# • Allocates 1 CPU and 2GB RAM
# • Starts with 1 replica (1 running container)
```

### 3.2 Configure Environment Variables

```bash
# Variables
$appName = "outmate-api"
$resourceGroupName = "outmate-prod"

# Set environment variables (max 50 per app)
# These values will be injected into the container at runtime

az containerapp update `
  --name $appName `
  --resource-group $resourceGroupName `
  --set-env-vars `
    ENVIRONMENT=production `
    LOG_LEVEL=info `
    DEBUG=false `
    DATABASE_URL="postgresql://user:pass@host/db" `
    REDIS_URL="redis://host:6379" `
    OPENROUTER_API_KEY="sk_..." `
    JWT_SECRET="[generate-random-secret]" `
    CRUSTDATA_API_KEY="[your-key]" `
    EXPLORIUM_API_KEY="[your-key]" `
    BETTERCONTACT_API_KEY="[your-key]"

# Verify environment variables
az containerapp show `
  --name $appName `
  --resource-group $resourceGroupName `
  --query "properties.template.containers[0].env" `
  --output json
```

### 3.3 Configure Health Probes

```bash
# Variables
$appName = "outmate-api"
$resourceGroupName = "outmate-prod"

# Container Apps automatically uses the /health endpoint
# but we can configure it explicitly:

az containerapp update `
  --name $appName `
  --resource-group $resourceGroupName `
  --set-env-vars HEALTH_CHECK_PATH="/health"

# Azure Container Apps will:
# • Poll /health every 10 seconds
# • Restart container if health check fails 3 times
# • Mark container as "ready" after successful health check
```

### 3.4 Get Backend Endpoint URL

```bash
# This is the public URL for your API
az containerapp show `
  --name outmate-api `
  --resource-group outmate-prod `
  --query "properties.configuration.ingress.fqdn" `
  --output tsv

# Output will be something like:
# outmate-api.agreeablebay-abc123.eastus.azurecontainerapps.io

# Test the endpoint
curl https://outmate-api.agreeablebay-abc123.eastus.azurecontainerapps.io/health

# Response should be:
# {"status": "ok", "service": "outmate-api", "version": "1.0.0"}
```

### 3.5 Configure Container Registry Credentials (for Auto-Pull)

```bash
# Get ACR credentials
$acrPassword = az acr credential show `
  --name outmateacr `
  --query "[passwords[0].value]" `
  -o tsv

# Update container app to use registry credentials
az containerapp update `
  --name outmate-api `
  --resource-group outmate-prod `
  --registry-server outmateacr.azurecr.io `
  --registry-username outmateacr `
  --registry-password $acrPassword

# Now Container Apps can automatically pull new images from ACR
```

### 3.6 Verify Deployment

```bash
# Check container app status
az containerapp show `
  --name outmate-api `
  --resource-group outmate-prod `
  --query "properties.provisioningState" `
  --output tsv

# Output: Succeeded

# Check provisioning details
az containerapp show `
  --name outmate-api `
  --resource-group outmate-prod `
  --query "properties" `
  --output json | Select -Expand "configuration.ingress"

# Check logs (last 100 lines)
az containerapp logs show `
  --name outmate-api `
  --resource-group outmate-prod `
  --follow `
  --tail 100

# If state is Failed, check the error logs above
```

---

## STEP 4: FRONTEND DEPLOYMENT (STATIC WEB APPS)

### 4.1 Create Static Web App (GitHub Connected)

**Note:** Static Web Apps requires GitHub connection for auto-deployment.

```bash
# Variables
$appName = "outmate-web"
$resourceGroupName = "outmate-prod"
$location = "eastus"
$repositoryUrl = "https://github.com/YOUR_USERNAME/outmate"
$branch = "main"
$buildOutputLocation = "out"  # Next.js statically exports to ./out

# Create Static Web App
az staticwebapp create `
  --name $appName `
  --resource-group $resourceGroupName `
  --location $location `
  --source $repositoryUrl `
  --branch $branch `
  --output-location $buildOutputLocation `
  --token [GITHUB_TOKEN]

# Get GitHub token from:
# https://github.com/settings/tokens
# Scopes needed: repo (full control), workflow (if using actions)

# Note: This creates a GitHub Actions workflow automatically
# Check .github/workflows/azure-static-web-apps-*.yml in your repo
```

### 4.2 Alternative: Create Static Web App (Manual Upload)

If you prefer not to connect GitHub:

```bash
# Create Static Web App without GitHub
az staticwebapp create `
  --name $appName `
  --resource-group $resourceGroupName `
  --location $location

# Get deployment token
$deployToken = az staticwebapp secrets list `
  --name $appName `
  --resource-group $resourceGroupName `
  --query "properties.apiKey" `
  --output tsv

# Build locally
cd Frontend
npm run build
# or
pnpm build

# Deploy manually using Azure CLI
az staticwebapp upload `
  --name $appName `
  --source-path ./out `
  --deployment-token $deployToken

# This uploads the entire ./out folder (static site)
```

### 4.3 Configure Environment Variables

```bash
# Variables
$appName = "outmate-web"
$resourceGroupName = "outmate-prod"

# Set build and runtime environment variables
az staticwebapp appsettings set `
  --name $appName `
  --resource-group $resourceGroupName `
  --setting-names `
    NEXT_PUBLIC_API_URL="https://api.outmate.ai" `
    NEXT_PUBLIC_APP_NAME="Outmate.AI" `
    NEXT_PUBLIC_LOG_LEVEL="info"
```

### 4.4 Get Static Web App URL

```bash
# Get the default Azure-provided URL
az staticwebapp show `
  --name outmate-web `
  --resource-group outmate-prod `
  --query "defaultHostname" `
  --output tsv

# Output will be something like:
# outmate-web.azurefd.net  (with custom domain disabled)
# or
# app.outmate.ai           (after configuring custom domain)

# Test the endpoint
curl https://outmate-web.azurefd.net
# Should return HTML of your Next.js homepage
```

### 4.5 Custom Domain Setup (Steps 6.2 covers this)

For now, note the default hostname. We'll add the custom domain in Step 6.

---

## STEP 5: CI/CD PIPELINE SETUP

### 5.1 Create GitHub Actions Workflow for Backend

**Location:** `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend to Azure Container Apps

on:
  push:
    branches:
      - main
    paths:
      - 'Backend/**'
      - '.github/workflows/deploy-backend.yml'

env:
  # Variables
  AZURE_SUBSCRIPTION_ID: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
  AZURE_RESOURCE_GROUP: outmate-prod
  AZURE_CONTAINER_APP: outmate-api
  AZURE_CONTAINER_REGISTRY: outmateacr
  REGISTRY_LOGIN_SERVER: outmateacr.azurecr.io
  IMAGE_NAME: outmate-api
  NODE_VERSION: '18'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      # 1. Checkout code
      - name: Checkout repository
        uses: actions/checkout@v3

      # 2. Login to Azure using Open ID Connect (no secrets needed!)
      - name: Azure Login
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      # 3. Build Docker image
      - name: Build Docker image
        run: |
          cd Backend
          docker build \
            -t ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:latest \
            -t ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            .

      # 4. Push to Azure Container Registry
      - name: Push image to ACR
        run: |
          az acr login --name ${{ env.AZURE_CONTAINER_REGISTRY }}
          docker push ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:latest
          docker push ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

      # 5. Deploy to Container Apps
      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
            --name ${{ env.AZURE_CONTAINER_APP }} \
            --image ${{ env.REGISTRY_LOGIN_SERVER }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

      # 6. Verify deployment
      - name: Wait for deployment to be ready
        run: |
          # Check that the container app is in Succeeded state
          for i in {1..30}; do
            STATE=$(az containerapp show \
              --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
              --name ${{ env.AZURE_CONTAINER_APP }} \
              --query "properties.provisioningState" \
              --output tsv)
            
            if [ "$STATE" = "Succeeded" ]; then
              echo "✅ Deployment succeeded"
              exit 0
            fi
            
            if [ "$STATE" = "Failed" ]; then
              echo "❌ Deployment failed"
              exit 1
            fi
            
            echo "⏳ Waiting for deployment... (attempt $i/30)"
            sleep 5
          done
          
          echo "❌ Deployment timeout"
          exit 1

      # 7. Test health endpoint
      - name: Test deployment
        run: |
          ENDPOINT=$(az containerapp show \
            --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
            --name ${{ env.AZURE_CONTAINER_APP }} \
            --query "properties.configuration.ingress.fqdn" \
            --output tsv)
          
          echo "Testing endpoint: https://$ENDPOINT/health"
          
          # Wait for endpoint to be ready (may take 10-30 seconds)
          for i in {1..30}; do
            RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$ENDPOINT/health)
            
            if [ "$RESPONSE" = "200" ]; then
              echo "✅ Health check passed"
              exit 0
            fi
            
            echo "⏳ Waiting for health check... (attempt $i/30, HTTP $RESPONSE)"
            sleep 2
          done
          
          echo "❌ Health check failed after 30 attempts"
          exit 1
```

### 5.2 Setup GitHub Secrets

You need to create GitHub secrets for the CI/CD pipeline.

```bash
# Option 1: Using GitHub CLI (recommended)
gh secret set AZURE_SUBSCRIPTION_ID --body "YOUR_SUBSCRIPTION_ID"
gh secret set AZURE_CLIENT_ID --body "YOUR_CLIENT_ID"
gh secret set AZURE_TENANT_ID --body "YOUR_TENANT_ID"

# Option 2: Manual setup via GitHub UI
# 1. Go to Settings → Secrets and variables → Actions
# 2. Create the following secrets:
#    - AZURE_SUBSCRIPTION_ID
#    - AZURE_CLIENT_ID
#    - AZURE_TENANT_ID

# To get these values:
az account show --query "id" --output tsv  # SUBSCRIPTION_ID

# For Client ID and Tenant ID, create a service principal:
az ad sp create-for-rbac \
  --name "outmate-ci-cd" \
  --role "Contributor" \
  --scopes "/subscriptions/YOUR_SUBSCRIPTION_ID"

# Output includes:
# "clientId": "...",
# "tenantId": "...",
```

### 5.3 Create Frontend Deployment Workflow (Optional - Auto-Deploy via Static Web Apps)

If using GitHub-connected Static Web App, it automatically creates the workflow.

If you want a custom workflow:

```yaml
# .github/workflows/deploy-frontend.yml
name: Deploy Frontend to Azure Static Web Apps

on:
  push:
    branches:
      - main
    paths:
      - 'Frontend/**'
      - '.github/workflows/deploy-frontend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        working-directory: Frontend
        run: pnpm install --frozen-lockfile

      - name: Build Next.js
        working-directory: Frontend
        run: pnpm build

      - name: Deploy to Static Web Apps
        uses: azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "upload"
          app_location: "Frontend"
          output_location: "out"
          skip_app_build: true
```

### 5.4 Test the Workflow

```bash
# Commit the workflow file
git add .github/workflows/deploy-backend.yml
git commit -m "CI/CD: Add GitHub Actions backend deployment workflow"
git push origin main

# The workflow should trigger automatically
# Check status: GitHub repo → Actions tab

# Monitor the deployment:
# 1. Check Actions tab for the running workflow
# 2. Click the workflow run to see detailed logs
# 3. Each step shows timing and status
# 4. Red ❌ means failure, green ✅ means success
```

---

## STEP 6: DOMAIN & DNS CONFIGURATION

### 6.1 Configure Cloudflare DNS (Free)

**Prerequisites:** Domain registered (outmate.ai) and Cloudflare account created

```
1. Go to Cloudflare dashboard
2. Add Site → Enter your domain (outmate.ai)
3. Cloudflare scans existing DNS records
4. Choose Free plan
5. Update your domain's nameservers to Cloudflare's:
   - ns1.cloudflare.com
   - ns2.cloudflare.com
   (Takes 24-48 hours to fully propagate)
```

### 6.2 Create DNS Records in Cloudflare

```
RECORDS TO CREATE:

1. Backend API Subdomain
   Type: CNAME
   Name: api
   Target: outmate-api.agreeablebay-abc123.eastus.azurecontainerapps.io
   Proxy: DNS only (grey cloud) - for Container Apps
   Comment: FastAPI backend

2. Frontend App Subdomain
   Type: CNAME
   Name: app
   Target: outmate-web.azurefd.net
   Proxy: Proxied (orange cloud) - for Static Web Apps
   Comment: Next.js frontend

3. Apex Domain (optional - send to app)
   Type: CNAME
   Name: @
   Target: app.outmate.ai
   Comment: Redirects root to app

4. API Record (alternative short URL)
   Type: CNAME
   Name: api.v1
   Target: api.outmate.ai
   Comment: API v1 endpoint
```

### 6.3 Link Custom Domain to Azure Static Web Apps

```bash
# Get validation DNS record from Azure
az staticwebapp show \
  --name outmate-web \
  --resource-group outmate-prod \
  --query "customDomains" \
  --output json

# Add the validation TXT record that Azure provides

# Then add custom domain to Static Web App
az staticwebapp custom-domain add \
  --name outmate-web \
  --resource-group outmate-prod \
  --domain-name app.outmate.ai

# Cloudflare SSL is automatic - no additional setup needed
```

### 6.4 Link Custom Domain to Container Apps

**Note:** Container Apps automatically generates HTTPS certificates. Just use the CNAME approach above.

### 6.5 Verify DNS Propagation

```bash
# Check if DNS records are live
nslookup api.outmate.ai
# Should return the Container Apps IP

nslookup app.outmate.ai
# Should return the Static Web Apps IP

# Or use dig (more detailed)
dig api.outmate.ai
dig app.outmate.ai

# Full propagation check:
# https://www.whatsmydns.net
# Enter api.outmate.ai
# Should show green checkmarks worldwide after 24h
```

### 6.6 Test Domains

```bash
# Test backend API
curl https://api.outmate.ai/health
# Should return: {"status": "ok", ...}

# Test frontend
curl https://app.outmate.ai
# Should return HTML content

# Test from browser
# Open https://app.outmate.ai in web browser
# Should load your Next.js application
```

---

## STEP 7: ENVIRONMENT VARIABLES

### 7.1 Backend Environment Variables (Container Apps)

```bash
# Set all environment variables in Container Apps
# (Already done in Step 3.2, but here's the complete list)

az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars \
    # Application
    ENVIRONMENT="production" \
    LOG_LEVEL="info" \
    DEBUG="false" \
    APP_NAME="Outmate.AI" \
    APP_VERSION="1.0.0" \
    \
    # Database
    DATABASE_URL="postgresql://user:password@db.supabase.co:5432/postgres" \
    \
    # Cache
    REDIS_URL="redis://:password@redis.upstash.io:6379" \
    \
    # Authentication
    JWT_SECRET="[generate-strong-random-secret]" \
    JWT_ALGORITHM="HS256" \
    JWT_EXPIRATION_HOURS="24" \
    \
    # External APIs
    OPENROUTER_API_KEY="sk_..." \
    CRUSTDATA_API_KEY="..." \
    EXPLORIUM_API_KEY="..." \
    BETTERCONTACT_API_KEY="..." \
    IPINFO_API_KEY="..." \
    \
    # CORS
    CORS_ORIGINS="https://app.outmate.ai,https://outmate.ai" \
    \
    # Rate Limiting
    RATE_LIMIT_ENABLED="true" \
    RATE_LIMIT_PER_MINUTE="60" \
    \
    # Optional Features
    ANALYTICS_ENABLED="false" \
    EMAIL_NOTIFICATIONS="true"
```

### 7.2 Frontend Environment Variables (Static Web Apps)

**Location 1: .env.local (for local development)**
```bash
# Frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Outmate.AI
NEXT_PUBLIC_LOG_LEVEL=debug
NEXT_PUBLIC_ANALYTICS_ID=
```

**Location 2: Azure Static Web Apps configuration**
```bash
# Create statichtmlconf (Azure Static Web Apps config file)
# Location: Frontend/public/staticwebapp.config.json

{
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "https://api.outmate.ai/api/*"
    },
    {
      "route": "/health",
      "rewrite": "https://api.outmate.ai/health"
    },
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "env": "production"
}
```

### 7.3 Generate Secrets

```bash
# Generate JWT_SECRET (use one of these methods)

# Method 1: OpenSSL (Linux/Mac)
openssl rand -hex 32

# Method 2: PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { 0..255 | Get-Random })) -NoNewLine

# Method 3: Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Copy the output and use as JWT_SECRET
```

### 7.4 Verify Environment Variables

```bash
# View current environment variables
az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query "properties.template.containers[0].env" \
  --output json

# Should show all set variables (values are masked for security)
```

---

## STEP 8: MONITORING & LOGGING

### 8.1 View Container App Logs

```bash
# Real-time logs (follows new output)
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --follow=true \
  --tail=50

# Output:
# 2024-03-04 10:15:30.123 INFO Starting FastAPI server
# 2024-03-04 10:15:32.456 INFO Database connection established
# 2024-03-04 10:15:33.789 INFO Redis connection established
# 2024-03-04 10:15:35.012 INFO Server ready on 0.0.0.0:8000

# Exit: Ctrl+C
```

### 8.2 Health Endpoints

The backend application includes three health check endpoints:

```bash
# Overall health status
curl https://api.outmate.ai/health
# Response:
# {
#   "status": "healthy",
#   "service": "outmate-api",
#   "version": "1.0.0",
#   "timestamp": "2024-03-04T10:15:35Z",
#   "database": { "status": "healthy" },
#   "redis": { "status": "healthy" }
# }

# Database health only
curl https://api.outmate.ai/health/db
# Response:
# {
#   "status": "healthy",
#   "service": "database",
#   "response_time_ms": 2.34
# }

# Redis health only
curl https://api.outmate.ai/health/redis
# Response:
# {
#   "status": "healthy",
#   "service": "redis",
#   "response_time_ms": 0.89
# }
```

### 8.3 Container App Execution Details

```bash
# View container app details
az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --output json | ConvertFrom-Json | Select -ExpandProperty properties

# Key information:
# - provisioningState: Should be "Succeeded"
# - runningStatus: Should be "Running"
# - replicas: Should show 1 (or more if scaled)
# - latestRevisionName: Name of current revision
# - latestRevisionTrafficWeight: Should be 100
```

### 8.4 Deployment Revisions

```bash
# List all revisions (containers deployed)
az containerapp revision list \
  --name outmate-api \
  --resource-group outmate-prod \
  --output table

# Output:
# Name                           Active    Replicas    Created
# outmate-api--abcd1234         true      1 (1/1)     2024-03-04T10:15:35Z
# outmate-api--xyz9876          false     0 (0/0)     2024-03-03T14:22:12Z
```

### 8.5 Storage - Application Logs Location

```bash
# Logs are stored locally in the container and streamed to Azure
# They are retained for 7 days

# View detailed logs with timestamps
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --tail=100

# For long-term storage, add Application Insights (optional)
# See "Optional: Add Application Insights" section below
```

### 8.6 Optional: Add Application Insights (Week 2+)

Application Insights provides advanced monitoring, but costs ~$30/month. Add it later when needed.

```bash
# Create Log Analytics Workspace
az monitor log-analytics workspace create \
  --resource-group outmate-prod \
  --workspace-name outmate-logs \
  --sku PerGB2018

# Create Application Insights
az monitor app-insights component create \
  --app outmate-insights \
  --location eastus \
  --resource-group outmate-prod \
  --workspace outmate-logs

# Get instrumentation key
$instrumentationKey = az monitor app-insights component show \
  --app outmate-insights \
  --resource-group outmate-prod \
  --query "instrumentationKey" \
  --output tsv

# Update container app with instrumentation key
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --set-env-vars \
    APPINSIGHTS_INSTRUMENTATION_KEY=$instrumentationKey \
    APPINSIGHTS_ENABLED=true
```

---

## STEP 9: SCALING STRATEGY

### 9.1 Initial Scaling Configuration (1 Replica)

**Current setup (from Step 3.1):**
- Min replicas: 1
- Max replicas: 1
- CPU: 1 vCPU
- Memory: 2GB RAM
- Monthly cost: ~$50

This configuration is ideal for:
- MVP launch
- <1,000 daily active users
- <10,000 requests per day
- Development/testing

### 9.2 Monitor Usage and Decide to Scale

```bash
# Simple metric: Check container restart count
# If you see frequent restarts, it's time to scale

az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query "properties.template.scale" \
  --output json

# If response times are slow:
# - Check logs for errors
# - Monitor with curl from different regions
# - If no errors, it's likely resource exhaustion
```

### 9.3 Scale Up: More Replicas (Week 2-3)

When you hit ~50,000 requests/day:

```bash
# Increase max replicas to 3
# Container Apps will auto-scale based on CPU usage

az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --max-replicas 3 \
  --min-replicas 1

# Add CPU scaling rule
# (When any replica reaches 70% CPU, add another replica)

# Azure Container Apps uses built-in metrics:
# - CPU: 70% threshold
# - Memory: 80% threshold
# - Concurrent requests: Custom threshold

# No additional commands needed - auto-scaling is automatic once max > 1
```

### 9.4 Scale Up: More CPU/Memory (Month 1+)

For heavy computational tasks (NLP, ML models):

```bash
# Increase CPU and Memory per replica
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --cpu 2 \
  --memory 4Gi

# Options:
# 0.25 vCPU - 0.5 Gi RAM    ($free with auto-scale, $30/mo fixed)
# 0.5 vCPU  - 1 Gi RAM      ($50/mo)
# 1 vCPU    - 2 Gi RAM      ($50/mo)  ← Current
# 2 vCPU    - 4 Gi RAM      ($100/mo)
# 4 vCPU    - 8 Gi RAM      ($200/mo)
```

### 9.5 Scaling Checklists

**When to scale replicas:**
- [ ] Average response time > 2 seconds
- [ ] Error rate > 1%
- [ ] Container restart count increasing
- [ ] Logs show "out of memory" or "CPU saturated" errors
- [ ] Monitoring shows >70% sustained CPU usage

**When to scale CPU/Memory:**
- [ ] Single replica is at 90%+ CPU consistently
- [ ] Processing large datasets
- [ ] Running ML models
- [ ] Building complex search indices

---

## STEP 10: ROLLBACK PROCEDURES

### 10.1 Understand Revisions

Container Apps keeps history of deployments automatically:

```bash
# Each deployment = new revision
# Revisions are immutable - can't be edited
# You can traffic-split between revisions

# List 5 most recent revisions
az containerapp revision list \
  --name outmate-api \
  --resource-group outmate-prod \
  --max-results 5 \
  --output table

# Output shows:
# Name                           Active    Created
# outmate-api--abd12345         true      2024-03-04T10:15:35Z
# outmate-api--def67890         false     2024-03-03T14:22:12Z
# outmate-api--ghi11111         false     2024-03-02T08:45:00Z
```

### 10.2 Rollback via CLI (Instant)

If the latest deployment has issues:

```bash
# Get the previous revision name from the list above
# Replace 'def67890' with the actual revision ID

# Option 1: Set traffic to previous revision (instant)
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --revisions outmate-api--def67890=100

# This re-routes 100% of traffic to the previous version
# Immediate effect - no new container startup needed

# Option 2: Deactivate current revision and activate previous
az containerapp revision deactivate \
  --name outmate-api \
  --resource-group outmate-prod \
  --revision outmate-api--abd12345

# Then check status
az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query "properties.latestRevisionName" \
  --output tsv
```

### 10.3 Rollback Steps (When Needed)

```bash
# 1. Identify the problem
#    - Check /health endpoint
#    - Check logs (should show errors)
#    - Get the current revision name
CURRENT_REVISION=$(az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query "properties.latestRevisionName" \
  --output tsv)
echo "Current revision: $CURRENT_REVISION"

# 2. List previous revisions
az containerapp revision list \
  --name outmate-api \
  --resource-group outmate-prod \
  --max-results 3

# 3. Rollback to previous revision
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --revisions outmate-api--PREVIOUS_REVISION_NAME=100

# 4. Verify rollback (health check)
curl https://api.outmate.ai/health
# Should return 200 OK

# 5. Check logs
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod
```

### 10.4 Canary Deployments (Traffic Split)

Instead of rolling out 100%, test the new version with 10% traffic:

```bash
# Deploy new version - it creates a new revision automatically via CI/CD

# After deployment, split traffic 90/10
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --revisions \
    outmate-api--abd12345=90 \
    outmate-api--def67890=10

# Monitor the new version for 30 minutes
# Check error rate of the 10% traffic

# To complete rollout (move remaining 10% to new version):
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --revisions outmate-api--abd12345=100

# Or rollback if issues found:
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --revisions outmate-api--def67890=100
```

---

## STEP 11: MAINTENANCE & OPERATIONS

### 11.1 Weekly Checks (Monday)

```bash
# 1. Check health endpoints
curl https://api.outmate.ai/health
curl https://app.outmate.ai

# 2. Review logs for errors
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --tail=100

# 3. Check container restarts
az containerapp show \
  --name outmate-api \
  --resource-group outmate-prod \
  --query "properties.template.containers[0].restartPolicy" \
  --output json
```

### 11.2 Monthly Maintenance

```bash
# 1. Update Docker base images
# Edit Backend/Dockerfile and Frontend/Dockerfile
# Change FROM python:3.11-slim → python:3.12-slim
# Change FROM node:18-alpine → node:20-alpine

# 2. Update dependencies
cd Backend
pip list --outdated
pip install --upgrade pip
pip install -r requirements.txt --upgrade

cd ../Frontend
npm outdated
npm update

# 3. Test locally before deploying
docker build -t outmate-api:test Backend/
docker run -p 8000:8000 --env-file Backend/.env.test outmate-api:test

# 4. Commit and push (triggers CI/CD)
git add -A
git commit -m "chore: Update dependencies and base images"
git push origin main
```

### 11.3 Troubleshooting Guide

**Problem: Container keeps restarting**
```bash
# Check logs for errors
az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod \
  --tail=50

# If error is "Connection refused" → DATABASE issue
# If error is "ModuleNotFoundError" → Missing dependency
# If error is "Port already in use" → Try different port
```

**Problem: Slow response times**
```bash
# Check logs for slow queries
grep "response_time\|duration" <(az containerapp logs show \
  --name outmate-api \
  --resource-group outmate-prod)

# Check Container App CPU usage (coming in step 9)
# If CPU at 90%+ → Increase CPU allocation
# If logs show DB slow → Optimize database query
```

**Problem: Deployment fails**
```bash
# Check GitHub Actions logs
# Go to GitHub repo → Actions tab → View the failed run

# Common issues:
# 1. Secrets not set → Add them via Settings → Secrets
# 2. Docker build error → Test locally: docker build Backend/
# 3. Registry credentials invalid → Regenerate with: az acr credential show
```

### 11.4 Monitoring Dashboard (Manual)

Create a simple HTML dashboard for monitoring:

```html
<!-- monitoring.html -->
<html>
<head>
  <title>Outmate.AI Monitoring</title>
  <style>
    body { font-family: monospace; margin: 20px; }
    .status { padding: 10px; border-radius: 5px; margin: 5px 0; }
    .healthy { background: #90EE90; }
    .unhealthy { background: #FFB6C6; }
    .unknown { background: #D3D3D3; }
  </style>
</head>
<body>
  <h1>Outmate.AI Production Status</h1>
  <div id="api" class="status unknown">Checking API...</div>
  <div id="web" class="status unknown">Checking Web...</div>
  <script>
    async function checkStatus() {
      try {
        const apiRes = await fetch('https://api.outmate.ai/health');
        document.getElementById('api').className = 
          apiRes.ok ? 'status healthy' : 'status unhealthy';
        document.getElementById('api').textContent = 
          '✓ API: ' + (apiRes.ok ? 'OK' : 'DOWN');
      } catch (e) {
        document.getElementById('api').className = 'status unhealthy';
        document.getElementById('api').textContent = '✗ API: ' + e.message;
      }

      try {
        const webRes = await fetch('https://app.outmate.ai');
        document.getElementById('web').className = 
          webRes.ok ? 'status healthy' : 'status unhealthy';
        document.getElementById('web').textContent = 
          '✓ Web: ' + (webRes.ok ? 'OK' : 'DOWN');
      } catch (e) {
        document.getElementById('web').className = 'status unhealthy';
        document.getElementById('web').textContent = '✗ Web: ' + e.message;
      }
    }

    checkStatus();
    setInterval(checkStatus, 30000);  // Check every 30 seconds
  </script>
</body>
</html>
```

---

## APPENDIX: QUICK REFERENCE COMMANDS

### Azure Management

```bash
# Login to Azure
az login

# List all container apps
az containerapp list --output table

# View container app details
az containerapp show --name outmate-api --resource-group outmate-prod

# View container app logs (real-time)
az containerapp logs show --name outmate-api --resource-group outmate-prod --follow

# Restart container app
az containerapp update --name outmate-api --resource-group outmate-prod --image $(az acr show --name outmateacr --query loginServer -o tsv)/outmate-api:latest

# Update environment variable
az containerapp update --name outmate-api --resource-group outmate-prod --set-env-vars VAR_NAME=new_value
```

### Docker Commands

```bash
# Build image
docker build -t outmate-api:latest Backend/

# Run image locally
docker run -p 8000:8000 --env-file Backend/.env.test outmate-api:latest

# List images
docker images | grep outmate

# Remove image
docker rmi outmate-api:latest

# Login to ACR
az acr login --name outmateacr

# Push image
docker push outmateacr.azurecr.io/outmate-api:latest

# Pull image
docker pull outmateacr.azurecr.io/outmate-api:latest
```

### Testing & Validation

```bash
# Test health endpoints
curl https://api.outmate.ai/health
curl https://api.outmate.ai/health/db
curl https://api.outmate.ai/health/redis

# Test DNS
nslookup api.outmate.ai
nslookup app.outmate.ai

# Test frontend
curl -s https://app.outmate.ai | head -20

# Performance test (requires hey tool)
# Install: go install github.com/rakyll/hey@latest
hey -n 1000 -c 10 https://api.outmate.ai/health
```

### Deployment

```bash
# Deploy backend image
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --image outmateacr.azurecr.io/outmate-api:latest

# Deploy frontend (if using manual method)
az staticwebapp upload \
  --name outmate-web \
  --source-path Frontend/out \
  --deployment-token $TOKEN

# Rollback to previous revision
az containerapp update \
  --name outmate-api \
  --resource-group outmate-prod \
  --revisions outmate-api--REVISION_NAME=100
```

### Cleanup & Tear Down

```bash
# Delete resource group (deletes all resources)
az group delete --name outmate-prod

# Delete only container app
az containerapp delete --name outmate-api --resource-group outmate-prod

# Delete only static web app
az staticwebapp delete --name outmate-web --resource-group outmate-prod

# Delete only container registry
az acr delete --name outmateacr
```

---

## DEPLOYMENT CHECKLIST

Use this checklist to track deployment progress:

### Pre-Deployment (Day 0)
- [ ] Azure account created
- [ ] GitHub repository ready
- [ ] Domain registered
- [ ] Cloudflare account created
- [ ] All secrets gathered (API keys, etc.)
- [ ] .env.example reviewed
- [ ] Docker tested locally
- [ ] GitHub Actions workflow file created

### Deployment Day 1 (6 hours)
- [ ] Azure CLI installed and tested
- [ ] Logged in to Azure
- [ ] Subscription selected
- [ ] Resource group created (outmate-prod)
- [ ] Container Registry created (outmateacr)
- [ ] Container Apps environment created
- [ ] Backend Docker image built locally
- [ ] Backend image pushed to ACR
- [ ] Container app deployed and running
- [ ] Container app environment variables set
- [ ] Health endpoint tested and responding
- [ ] Logs viewable and readable

### Deployment Day 2 (2-3 hours)
- [ ] Frontend build tested locally
- [ ] Static Web App created (with GitHub)
- [ ] Frontend environment variables set
- [ ] Domain added to Cloudflare
- [ ] DNS records created (api.*, app.*)
- [ ] DNS validation passed (propagation check)
- [ ] Custom domains linked to Azure services
- [ ] HTTPS working on both domains
- [ ] GitHub Actions workflow running
- [ ] CI/CD pipeline tested with a commit
- [ ] Rollback procedure tested
- [ ] Monitoring logs accessible

### Post-Deployment Week 1
- [ ] Application tested end-to-end
- [ ] API health checks configured in monitoring tool
- [ ] Team alerted to status page
- [ ] Logs reviewed for any recurring issues
- [ ] Database backups verified
- [ ] Cache performance validated
- [ ] External API integrations tested

### Ongoing Monthly
- [ ] Dependencies updated
- [ ] Base images updated
- [ ] Log retention reviewed
- [ ] Cost analysis done
- [ ] Scaling decisions made if needed

---

## COST ESTIMATE (Monthly)

| Service | SKU | Cost |
|---------|-----|------|
| Container Apps | 1 vCPU, 2GB RAM, 1 replica | $50 |
| Container Registry | Basic | $15 |
| Static Web Apps | Free tier | $0 |
| Bandwidth (both) | ~50GB/month | $0-5 |
| **Total** | | **$65-70/month** |

**Optional Additions:**
- Application Insights: +$30/month
- Key Vault: +$1/month + per-request
- Advanced scaling: +$50-100/month

**External (Already Covered):**
- Supabase PostgreSQL: Existing
- Upstash Redis: Existing
- OpenRouter: Pay per request (API usage)

---

## CONCLUSION

This playbook provides everything needed to deploy Outmate.AI to production on Azure in 2 days with minimal infrastructure. The setup is:

✅ **Cost-effective** ($70/month baseline)  
✅ **Scalable** (1-click upgrades)  
✅ **Maintainable** (single developer)  
✅ **Production-ready** (health checks, monitoring, rollback)  
✅ **Fast** (deploys in 2 days)

Next steps: Choose when to deploy and follow the playbook step-by-step.

For questions about specific steps, refer to the detailed sections above or check Azure documentation.

---

**Document Version:** 1.0  
**Last Updated:** March 4, 2026  
**Compatibility:** Azure, Cloudflare, Next.js 14+, FastAPI 0.104+  
**Status:** Ready for production deployment
