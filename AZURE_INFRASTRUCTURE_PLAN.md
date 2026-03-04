# OUTMATE.AI - AZURE PRODUCTION INFRASTRUCTURE PLAN

**Architect:** Senior Cloud Architect, Microsoft Azure Specialist  
**Date:** March 4, 2026  
**Project:** Outmate.AI - AI-Powered B2B Outreach Platform  
**Readiness Level:** Production-Ready (8.5/10)  
**Target Environment:** Azure (Public Cloud, US East Region)  

---

## EXECUTIVE SUMMARY

This document provides a complete Azure infrastructure plan for Outmate.AI, designed to support:
- **Scalability:** 0-100,000 API requests per day
- **Security:** Enterprise-grade with Key Vault, Virtual Networks, Private Endpoints
- **Cost Efficiency:** Auto-scaling, reserved instances, serverless components
- **High Availability:** Multi-replica deployments, geo-redundancy ready
- **Observability:** Application Insights, Log Analytics, custom metrics

**Target Deployment:** Week 1-2 of April 2026

---

## 1. AZURE RESOURCE ARCHITECTURE

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AZURE FRONT DOOR (CDN + WAF)                 │
│                     (Global entry point, SSL termination)            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
   │   Static Web │  │ Container Apps │  │   Static Web   │
   │   Apps (CDN) │  │  (Backend API) │  │   Apps (Images)│
   │ Next.js Web  │  │  (FastAPI)     │  │                │
   └──────────────┘  └────────┬───────┘  └────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼──────────┐  ┌───────▼────────┐  ┌───────▼────────┐
   │ Key Vault     │  │   PostgreSQL   │  │  Redis Cache   │
   │ (Secrets)     │  │  Flexible Srv  │  │  (Upstash)     │
   │               │  │   (HA Mode)    │  │  (TLS)         │
   └───────────────┘  └────────────────┘  └────────────────┘
        │
   ┌────▼──────────────────────────────────────────┐
   │     Azure Container Registry (ACR)            │
   │  Private registry for Docker images           │
   │  - outmate-api:stable, :v1.0.0               │
   │  - outmate-web:stable, :v1.0.0               │
   └───────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────┐
   │    Azure Application Insights + Log Analytics │
   │  Complete observability & monitoring          │
   └───────────────────────────────────────────────┘
        │
   ┌────▼──────────────────────────────────────────┐
   │    Azure Blob Storage (Logs, Backups)         │
   │  Long-term retention of audit trails          │
   └───────────────────────────────────────────────┘
```

### 1.2 Core Components

#### **1. Azure Front Door (Global CDN + WAF)**
- **Purpose:** Global load balancing, DDoS protection, WAF, SSL/TLS termination
- **Configuration:**
  - SKU: Premium (includes advanced WAF)
  - Origin groups: API origin (Container Apps) + Web origin (Static Web Apps)
  - WAF Policy: OWASP 3.1 rule set, custom rules for rate limiting
  - TLS Version: 1.2+ only
  - Certificate: Azure-managed SSL

#### **2. Azure Container Apps (Backend API)**
- **Purpose:** Run FastAPI backend with auto-scaling, built-in traffic splitting
- **Configuration:**
  - Name: `outmate-api-prod`
  - Image: `myregistry.azurecr.io/outmate-api:stable`
  - CPU: 1.0 vCPU per replica
  - Memory: 2 GB per replica
  - Min Replicas: 2 (production baseline)
  - Max Replicas: 10 (under high load)
  - Ingress: Enabled, traffic weight 100%
  - Health check: `/health/ready` probe
  - Timeout: 60 seconds

#### **3. Azure Static Web Apps (Frontend)**
- **Purpose:** Serve Next.js frontend with built-in CI/CD, free SSL
- **Configuration:**
  - Name: `outmate-web-prod`
  - Build preset: Next.js
  - Build output location: `.next`
  - API backend link: Container Apps FQDN
  - Staging slots: Available for pre-launch testing
  - Certificate: 100% managed by Azure

#### **4. Azure PostgreSQL Flexible Server**
- **Purpose:** Primary transactional database
- **Configuration:**
  - Name: `outmate-postgres-prod`
  - SKU: Standard_D4s_v3 (4 vCPU, 16 GB RAM)
  - HA: Enabled (provides automatic failover)
  - Backup: 7-day retention, geo-redundant
  - SSL Mode: Enforce TLS 1.2+
  - VNet Integration: Private endpoint
  - Replication: Can enable read replicas in US West (future scale-out)
  - Monitoring: Server logs, slow query log

#### **5. Azure Redis Cache**
- **Purpose:** Session store, caching, Celery broker (alternative)
- **Configuration:**
  - Provider: Upstash (managed Redis via Microsoft partnership)
  - Tier: Premium (for TLS + HA)
  - Size: 6 GB (handles 50K+ requests/day)
  - TLS: Enabled (port 6380)
  - Eviction Policy: allkeys-lru
  - Backup: Daily snapshots
  - Replication: Multi-AZ available

#### **6. Azure Container Registry (ACR)**
- **Purpose:** Private Docker image registry
- **Configuration:**
  - Name: `outmateregistry` (globally unique)
  - SKU: Premium (webhook support, geo-replication ready)
  - Authentication: Service principal with pull-only permissions for prod
  - Image retention: 90 days for untagged images
  - Scanning: Trivy security scanning on each push
  - Replication: Can replicate to secondary region (US West)

#### **7. Azure Key Vault**
- **Purpose:** Centralized secret management
- **Configuration:**
  - Name: `outmate-kv-prod`
  - SKU: Standard
  - Access: Azure RBAC (role-based access control)
  - Secrets stored:
    - database-url (PostgreSQL connection)
    - redis-url (Redis/Upstash connection)
    - jwt-secret (JWT signing key)
    - api-keys (CrustData, Explorium, ContactOut, OpenRouter)
  - References: Managed identity authentication from Container Apps
  - Audit: All access logged to Log Analytics

#### **8. Azure Application Insights**
- **Purpose:** Full-stack application monitoring and tracing
- **Configuration:**
  - Workspace-based model
  - Linked to Log Analytics workspace
  - Sampling: Adaptive (100% for errors, 10-20% for successes)
  - Retention: 30 days (Standard), 90 days (Premium archive)
  - Custom metrics: API latency, error rates, cache hit rate
  - Alerts: PagerDuty integration for critical incidents

#### **9. Azure Blob Storage**
- **Purpose:** Long-term log retention, audit trails, backups
- **Configuration:**
  - Account: `outmatestorageacctprod`
  - Replication: Geo-redundant storage (GRS)
  - Containers:
    - `logs-archive/` - JSON logs (30-day retention)
    - `backups/` - Database backups (90-day retention)
    - `audit-trails/` - Security and access logs
  - Lifecycle policies: Move to cool/archive tier after 30/90 days

---

## 2. RESOURCE GROUP STRUCTURE

### 2.1 Resource Groups Organization

#### **Resource Group: `outmate-prod-core`**
**Region:** East US  
**Purpose:** Production application workload

**Contents:**
```
Azure Container Apps
├── outmate-api-prod (FastAPI Backend)
└── Health probes + auto-scaling

Azure Static Web Apps
├── outmate-web-prod (Next.js Frontend)
└── CI/CD pipeline triggered

Azure Container Registry
├── outmate-api container images
└── outmate-web container images

Azure Front Door
├── Global load balancing
└── WAF rules + DDoS protection
```

**RBAC Roles:**
- DevOps: Contributor
- Developers: Contributor
- Security: Reader

---

#### **Resource Group: `outmate-prod-data`**
**Region:** East US  
**Purpose:** Data persistence layer

**Contents:**
```
Azure PostgreSQL Flexible Server
├── outmate-postgres-prod
├── Automated backups
└── VNet private endpoint

Azure Redis Cache
├── Upstash Redis (via Azure)
├── TLS endpoint
└── Replication enabled

Azure Blob Storage
├── logs-archive container
├── backups container
└── audit-trails container

Backup Vault
├── PostgreSQL automated backups
└── Long-term retention policies
```

**RBAC Roles:**
- Database Admin: Contributor
- Backup Operator: Operator
- Security: Reader

---

#### **Resource Group: `outmate-prod-security`**
**Region:** East US  
**Purpose:** Security and identity management

**Contents:**
```
Azure Key Vault
├── database-url secret
├── redis-url secret
├── jwt-secret secret
├── api-keys (CrustData, Explorium, etc)
└── service principal credentials

Azure Policy
├── Enforce encryption at rest
├── Enforce TLS 1.2+
├── Enforce network policies
└── Audit IAM changes

Application Gateway
├── SSL/TLS termination
├── Rate limiting (future WAF)
└── API certificate management

Network Security Groups
├── Allow Container Apps traffic
├── Deny all other inbound
└── Allow outbound to approved IPs
```

**RBAC Roles:**
- Security Admin: Contributor
- Vault Operator: Key Vault Secrets Officer
- Auditor: Reader

---

#### **Resource Group: `outmate-prod-monitoring`**
**Region:** East US  
**Purpose:** Observability and alerting

**Contents:**
```
Azure Application Insights
├── Backend API instrumentation
├── Custom metrics
├── Performance counters
└── Dependency tracking

Log Analytics Workspace
├── Centralized logging
├── KQL (Kusto Query Language) queries
├── Saved searches
└── Alert rules

Azure Monitor Alerts
├── High error rate alert (> 5%)
├── High response time alert (p99 > 5s)
├── Database connection exhaustion
├── Redis memory pressure
└── Storage quota warnings

Azure Dashboard
├── KPIs: Req/sec, error rate, latency
├── Resource health
├── Cost tracking
└── Security posture

Azure DevOps (optional)
├── Build pipelines
└── Release pipelines
```

**RBAC Roles:**
- Monitoring Admin: Contributor
- SOC Analyst: Reader
- Incident Commander: Contributor

---

#### **Resource Group: `outmate-prod-networking`** (Optional, for future scale)
**Region:** East US  
**Purpose:** Network isolation and connectivity

**Contents:**
```
Azure Virtual Network
├── Subnet for Container Apps
├── Subnet for PostgreSQL
└── Subnet for Redis

Private Endpoints
├── PostgreSQL private endpoint
├── Blob Storage private endpoint
└── Key Vault private endpoint

Network Security Groups
├── Inbound rules
└── Outbound rules

Azure Firewall (Future)
├── Centralized firewall management
└── Threat intelligence
```

**RBAC Roles:**
- Network Admin: Contributor

---

### 2.2 Resource Group Creation Order

```bash
# 1. Create core resource group
az group create --name outmate-prod-core --location eastus

# 2. Create data resource group
az group create --name outmate-prod-data --location eastus

# 3. Create security resource group
az group create --name outmate-prod-security --location eastus

# 4. Create monitoring resource group
az group create --name outmate-prod-monitoring --location eastus

# 5. (Optional) Create networking resource group
az group create --name outmate-prod-networking --location eastus
```

---

## 3. DOCKER IMAGE STRATEGY

### 3.1 Image Repository Structure in ACR

```
myregistry.azurecr.io/
├── outmate-api/
│   ├── tags:
│   │   ├── stable        (latest production release)
│   │   ├── v1.0.0        (semantic version)
│   │   ├── v1.0.1
│   │   ├── staging       (staging environment)
│   │   ├── develop       (development builds)
│   │   └── sha-a1b2c3d   (git commit-based)
│   │
│   └── metadata:
│       ├── Labels: app=outmate-api, tier=backend
│       └── Description: FastAPI backend service
│
└── outmate-web/
    ├── tags:
    │   ├── stable        (latest production release)
    │   ├── v1.0.0        (semantic version)
    │   ├── v1.0.1
    │   ├── staging       (staging environment)
    │   ├── develop       (development builds)
    │   └── sha-a1b2c3d   (git commit-based)
    │
    └── metadata:
        ├── Labels: app=outmate-web, tier=frontend
        └── Description: Next.js frontend application
```

### 3.2 Tagging Strategy

#### **Production Tags**
```
outmate-api:stable
  ↓ (points to latest production)
outmate-api:v1.0.0
  ↓ (semantic version in production)
```

**When to use:**
- Deployed to production Container Apps
- Used by Azure Front Door
- Manually promoted from staging after QA

#### **Staging Tags**
```
outmate-api:staging
  ↓ (points to latest staging release candidate)
outmate-api:v1.0.0-rc.1
  ↓ (release candidate for testing)
```

**When to use:**
- Deployed to staging Container Apps
- Used for pre-release QA
- Automatically created from `develop` branch

#### **Development Tags**
```
outmate-api:develop
  ↓ (latest development build)
outmate-api:sha-abc123def
  ↓ (git commit-specific build)
```

**When to use:**
- Deployed to local dev environment
- Pushed on every commit to `develop` branch
- Used for internal testing

#### **Semantic Versioning**
```
outmate-api:v1.0.0
  │
  ├─ Major (1): Breaking changes
  ├─ Minor (0): New features, backward compatible
  └─ Patch (0): Bug fixes only
```

### 3.3 Image Build and Push Strategy

**Build triggers in ACR:**
```
Branch: main
  ↓ Trigger: On commit push
  ├─ Build image: outmate-api:v1.x.x
  ├─ Build image: outmate-web:v1.x.x
  ├─ Tag as: stable
  └─ Tag as: latest-main

Branch: develop
  ↓ Trigger: On commit push
  ├─ Build image: outmate-api:develop
  ├─ Build image: outmate-web:develop
  ├─ Tag with: git commit SHA
  └─ Scan for vulnerabilities

Branch: staging
  ↓ Trigger: On commit push
  ├─ Build image: outmate-api:staging
  ├─ Build image: outmate-web:staging
  ├─ Tag as: rc (release candidate)
  └─ Trigger: Deploy to staging environment
```

### 3.4 Image Retention and Cleanup Policy

```yaml
# ACR Cleanup Policy
untagged-images:
  retention-days: 30  # Delete untagged images after 30 days
  
tagged-images:
  develop: retain 5 most recent
  staging: retain 10 most recent
  production: retain all (indefinite)
  
storage-limit: 100 GB (upgrade to Premium if needed)
```

### 3.5 Image Security Scanning

**Microsoft Defender for Container Registries:**
- ✅ Scan on push: Automatic Trivy scanning
- ✅ Scan on import: Images checked when imported
- ✅ Vulnerability assessment: Severity levels (Critical, High, Medium, Low)
- ✅ Quarantine policy: Block deployment of critical vulnerabilities

**Example scan results:**
```
Image: outmate-api:v1.0.0
Scan Time: 2024-03-04T14:32:00Z
Status: PASSED ✅

Vulnerabilities Found: 0 Critical, 1 High, 3 Medium
  - CVE-2024-1234: python package xyz (MEDIUM)
  - CVE-2024-5678: system library abc (HIGH)

Remediation: Update dependencies in next release
```

---

## 4. ENVIRONMENT VARIABLES FOR AZURE

### 4.1 Container Apps Environment Variables

#### **Backend (FastAPI) Container App**

**Configuration Reference in Key Vault:**

```yaml
# Container Apps: outmate-api-prod
Environment Variables:

# Direct environment variables (non-sensitive)
ENVIRONMENT: production
LOG_LEVEL: WARNING
LOG_FORMAT: json
DEBUG: false

# Application settings
APP_NAME: Outmate AI Backend
APP_VERSION: 1.0.0
API_TITLE: Outmate API v1

# Database configuration
DATABASE_POOL_SIZE: 10
DATABASE_MAX_OVERFLOW: 20
DATABASE_POOL_TIMEOUT: 30
DATABASE_POOL_RECYCLE: 1800

# Redis configuration
REDIS_CACHE_TTL: 3600

# CORS settings
CORS_ALLOWED_ORIGINS: https://app.outmate.ai,https://www.outmate.ai

# Optional services
GEMINI_API_KEY: (null if not enabled)

# Key Vault references (injected as secrets)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/database-url/)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/redis-url/)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/jwt-secret/)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/crustdata-api-key/)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/explorium-api-key/)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/contactout-api-key/)
@Microsoft.KeyVault(SecretUri=https://outmate-kv-prod.vault.azure.net/secrets/openrouter-api-key/)
```

**Container App Configuration Template:**

```json
{
  "properties": {
    "environmentId": "/subscriptions/xxx/resourceGroups/outmate-prod-core/providers/Microsoft.App/managedEnvironments/outmate-env",
    "configuration": {
      "ingress": {
        "external": true,
        "targetPort": 8000,
        "traffic": [{"latestRevision": true, "weight": 100}]
      },
      "registries": [
        {
          "server": "myregistry.azurecr.io",
          "username": "<service-principal-id>",
          "passwordSecretRef": "registry-password"
        }
      ],
      "secrets": [
        {
          "name": "registry-password",
          "value": "<service-principal-password>"
        },
        {
          "name": "database-url",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/database-url/"
        },
        {
          "name": "redis-url",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/redis-url/"
        },
        {
          "name": "jwt-secret",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/jwt-secret/"
        },
        {
          "name": "crustdata-api-key",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/crustdata-api-key/"
        },
        {
          "name": "explorium-api-key",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/explorium-api-key/"
        },
        {
          "name": "contactout-api-key",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/contactout-api-key/"
        },
        {
          "name": "openrouter-api-key",
          "keyVaultUrl": "https://outmate-kv-prod.vault.azure.net/secrets/openrouter-api-key/"
        }
      ]
    },
    "template": {
      "containers": [
        {
          "image": "myregistry.azurecr.io/outmate-api:stable",
          "name": "outmate-api",
          "resources": {
            "cpu": 1.0,
            "memory": "2.0Gi"
          },
          "env": [
            {"name": "ENVIRONMENT", "value": "production"},
            {"name": "LOG_LEVEL", "value": "WARNING"},
            {"name": "LOG_FORMAT", "value": "json"},
            {"name": "DATABASE_URL", "secretRef": "database-url"},
            {"name": "REDIS_URL", "secretRef": "redis-url"},
            {"name": "JWT_SECRET", "secretRef": "jwt-secret"},
            {"name": "CRUSTDATA_API_KEY", "secretRef": "crustdata-api-key"},
            {"name": "EXPLORIUM_API_KEY", "secretRef": "explorium-api-key"},
            {"name": "CONTACTOUT_API_KEY", "secretRef": "contactout-api-key"},
            {"name": "OPENROUTER_API_KEY", "secretRef": "openrouter-api-key"}
          ],
          "probes": [
            {
              "type": "ReadinessProbe",
              "httpGet": {
                "path": "/health/ready",
                "port": 8000,
                "scheme": "HTTP"
              },
              "initialDelaySeconds": 15,
              "periodSeconds": 10,
              "failureThreshold": 3
            },
            {
              "type": "LivenessProbe",
              "httpGet": {
                "path": "/health/live",
                "port": 8000,
                "scheme": "HTTP"
              },
              "initialDelaySeconds": 30,
              "periodSeconds": 30,
              "failureThreshold": 3
            }
          ]
        }
      ],
      "scale": {
        "minReplicas": 2,
        "maxReplicas": 10,
        "rules": [
          {
            "name": "cpu-scale-rule",
            "custom": {
              "metadata": {
                "type": "cpu",
                "value": "70"
              }
            }
          }
        ]
      }
    }
  }
}
```

---

#### **Frontend (Next.js) Static Web App**

**Configuration (via Azure Portal or IaC):**

```yaml
# Static Web App: outmate-web-prod
Environment Variables:

# Build time variables
BUILD_PRESET: next.js
BUILD_OUTPUT_LOCATION: .next

# Runtime environment variables
NEXT_PUBLIC_API_URL: https://api.outmate.ai
NEXT_PUBLIC_APP_ENVIRONMENT: production
NEXT_PUBLIC_ANALYTICS_KEY: (Google Analytics or similar)

# Optional: OAuth configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID: (from Key Vault if needed)
NEXT_PUBLIC_AUTH0_DOMAIN: (if using Auth0)

# Redirect rules (in staticwebapp.config.json)
navigationFallback:
  rewrite: index.html
  exclude:
    - /api/*
    - /assets/*
```

**staticwebapp.config.json:**

```json
{
  "navigationFallback": {
    "rewrite": "index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "index.html",
      "statusCode": 200
    }
  },
  "globalHeaders": [
    {
      "match": "/*",
      "headers": {
        "Content-Security-Policy": "default-src 'self' https:",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block"
      }
    }
  ],
  "routes": [
    {
      "route": "/api/*",
      "rewrite": "http://outmate-api-prod.eastus.azurecontainerapps.io/*"
    }
  ]
}
```

---

### 4.2 Key Vault Secret Structure

```
Vault: outmate-kv-prod

Secrets:
├── database-url
│   ├── Value: postgresql+psycopg2://user:password@outmate-postgres-prod.postgres.database.azure.com:5432/outmate
│   ├── Content Type: database/postgresql
│   ├── Tags: tier=data, environment=production
│   └── Rotation: Manual (30-day reminder)
│
├── redis-url
│   ├── Value: rediss://:password@outmate-redis-prod.redis.cache.windows.net:6380/0
│   ├── Content Type: cache/redis
│   ├── Tags: tier=cache, environment=production
│   └── Rotation: Manual (30-day reminder)
│
├── jwt-secret
│   ├── Value: (random 64-char string)
│   ├── Content Type: security/jwt
│   ├── Tags: tier=security, environment=production
│   └── Rotation: Every 90 days (automated)
│
├── crustdata-api-key
│   ├── Value: (from CrustData dashboard)
│   ├── Content Type: api/crustdata
│   ├── Tags: api=crustdata, environment=production
│   └── Rotation: As needed
│
├── explorium-api-key
│   ├── Value: (from Explorium dashboard)
│   ├── Content Type: api/explorium
│   ├── Tags: api=explorium, environment=production
│   └── Rotation: As needed
│
├── contactout-api-key
│   ├── Value: (from ContactOut dashboard)
│   ├── Content Type: api/contactout
│   ├── Tags: api=contactout, environment=production
│   └── Rotation: As needed
│
└── openrouter-api-key
    ├── Value: (from OpenRouter dashboard)
    ├── Content Type: api/openrouter
    ├── Tags: api=openrouter, environment=production
    └── Rotation: As needed

Access Policies:
├── Service Principal (Container Apps): Get, List
├── Managed Identity (Backend): Get
├── DevOps Team: Get, Set, Delete
└── Security Team: List, Audit
```

---

### 4.3 Setting Secrets in Key Vault (Commands)

```bash
# Set database URL secret
az keyvault secret set \
  --vault-name outmate-kv-prod \
  --name database-url \
  --value "postgresql+psycopg2://user:password@outmate-postgres-prod.postgres.database.azure.com:5432/outmate"

# Set Redis URL secret
az keyvault secret set \
  --vault-name outmate-kv-prod \
  --name redis-url \
  --value "rediss://:password@outmate-redis-prod.redis.cache.windows.net:6380/0" \
  --tags tier=cache environment=production

# Set JWT secret (generate random 64-char string)
az keyvault secret set \
  --vault-name outmate-kv-prod \
  --name jwt-secret \
  --value "$(openssl rand -base64 48)"

# Set API keys
az keyvault secret set --vault-name outmate-kv-prod --name crustdata-api-key --value "your-key"
az keyvault secret set --vault-name outmate-kv-prod --name explorium-api-key --value "your-key"
az keyvault secret set --vault-name outmate-kv-prod --name contactout-api-key --value "your-key"
az keyvault secret set --vault-name outmate-kv-prod --name openrouter-api-key --value "your-key"

# Verify secrets
az keyvault secret list --vault-name outmate-kv-prod
```

---

## 5. CI/CD PIPELINE - GitHub Actions Workflow

### 5.1 Complete GitHub Actions Workflow

**File: `.github/workflows/deploy-production.yml`**

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
    tags:
      - 'v*'
  workflow_dispatch:  # Manual trigger

env:
  REGISTRY: myregistry.azurecr.io
  BACKEND_IMAGE_NAME: outmate-api
  FRONTEND_IMAGE_NAME: outmate-web
  AZURE_RESOURCE_GROUP: outmate-prod-core
  AZURE_CONTAINER_APP_BACKEND: outmate-api-prod
  AZURE_CONTAINER_APP_FRONTEND: outmate-web-prod
  AZURE_LOCATION: eastus

jobs:
  # ────────────────────────────────────────────────────────────
  # BUILD BACKEND IMAGE
  # ────────────────────────────────────────────────────────────
  build-backend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Azure Login (OIDC)
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Login to Azure Container Registry
        run: |
          az acr login --name myregistry

      - name: Extract metadata
        id: meta
        run: |
          if [[ "${{ github.ref }}" == refs/tags/* ]]; then
            VERSION="${{ github.ref_name }}"
          else
            VERSION="develop"
          fi
          echo "tags=$REGISTRY/$BACKEND_IMAGE_NAME:$VERSION" >> $GITHUB_OUTPUT
          echo "tags=$REGISTRY/$BACKEND_IMAGE_NAME:latest" >> $GITHUB_OUTPUT

      - name: Build and push backend image
        uses: docker/build-push-action@v5
        with:
          context: ./Backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.BACKEND_IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.BACKEND_IMAGE_NAME }}:stable
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.BACKEND_IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.BACKEND_IMAGE_NAME }}:buildcache,mode=max

      - name: Scan image with Microsoft Defender
        run: |
          az acr scan \
            --registry myregistry \
            --image "$BACKEND_IMAGE_NAME:stable" \
            --query "[].{Severity:policyRule}" \
            --output table

  # ────────────────────────────────────────────────────────────
  # BUILD FRONTEND IMAGE
  # ────────────────────────────────────────────────────────────
  build-frontend:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Azure Login (OIDC)
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Login to Azure Container Registry
        run: |
          az acr login --name myregistry

      - name: Extract metadata
        id: meta
        run: |
          if [[ "${{ github.ref }}" == refs/tags/* ]]; then
            VERSION="${{ github.ref_name }}"
          else
            VERSION="develop"
          fi
          echo "tags=$REGISTRY/$FRONTEND_IMAGE_NAME:$VERSION" >> $GITHUB_OUTPUT
          echo "tags=$REGISTRY/$FRONTEND_IMAGE_NAME:latest" >> $GITHUB_OUTPUT

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./Frontend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}:stable
          cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}:buildcache
          cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.FRONTEND_IMAGE_NAME }}:buildcache,mode=max

      - name: Scan image with Microsoft Defender
        run: |
          az acr scan \
            --registry myregistry \
            --image "$FRONTEND_IMAGE_NAME:stable" \
            --query "[].{Severity:policyRule}" \
            --output table

  # ────────────────────────────────────────────────────────────
  # DEPLOY TO STAGING (First)
  # ────────────────────────────────────────────────────────────
  deploy-staging:
    needs: [build-backend, build-frontend]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    environment:
      name: staging
      url: https://staging.outmate.ai
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy to Container Apps (Staging Slot)
        run: |
          # Update backend container app (staging slot)
          az containerapp update \
            --name $AZURE_CONTAINER_APP_BACKEND \
            --resource-group $AZURE_RESOURCE_GROUP-staging \
            --image "$REGISTRY/$BACKEND_IMAGE_NAME:stable" \
            --set-env-vars LOG_LEVEL=DEBUG

          # Update frontend container app (staging slot)
          az containerapp update \
            --name $AZURE_CONTAINER_APP_FRONTEND \
            --resource-group $AZURE_RESOURCE_GROUP-staging \
            --image "$REGISTRY/$FRONTEND_IMAGE_NAME:stable"

      - name: Run smoke tests against staging
        run: |
          echo "Testing health endpoint..."
          curl -f https://staging-api.outmate.ai/health || exit 1
          curl -f https://staging-api.outmate.ai/health/db || exit 1
          echo "✅ Staging deployment successful"

  # ────────────────────────────────────────────────────────────
  # SMOKE TESTS
  # ────────────────────────────────────────────────────────────
  smoke-tests:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Run health checks
        run: |
          # Health endpoint
          curl -f https://staging-api.outmate.ai/health
          echo "✅ Overall health check passed"
          
          # Database health
          curl -f https://staging-api.outmate.ai/health/db
          echo "✅ Database health check passed"
          
          # Redis health
          curl -f https://staging-api.outmate.ai/health/redis
          echo "✅ Redis health check passed"

      - name: Run API tests (optional)
        continue-on-error: true
        run: |
          # Example: Test a public endpoint
          curl -X GET "https://staging-api.outmate.ai/api/v1/health" \
            -H "Content-Type: application/json" \
            -w "\nHTTP Status: %{http_code}\n"

  # ────────────────────────────────────────────────────────────
  # DEPLOY TO PRODUCTION (After approval or auto-trigger)
  # ────────────────────────────────────────────────────────────
  deploy-production:
    needs: [build-backend, build-frontend]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    environment:
      name: production
      url: https://app.outmate.ai
    if: github.ref == 'refs/heads/main'  # Only deploy from main branch
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Create backup of current production
        run: |
          echo "Creating pre-deployment backup snapshot..."
          az containerapp revision list \
            --name $AZURE_CONTAINER_APP_BACKEND \
            --resource-group $AZURE_RESOURCE_GROUP \
            > /tmp/pre-deploy-backup.json
          echo "✅ Backup created"

      - name: Deploy backend to Production
        run: |
          az containerapp update \
            --name $AZURE_CONTAINER_APP_BACKEND \
            --resource-group $AZURE_RESOURCE_GROUP \
            --image "$REGISTRY/$BACKEND_IMAGE_NAME:stable" \
            --set-env-vars \
              LOG_LEVEL=WARNING \
              ENVIRONMENT=production

      - name: Deploy frontend to Production
        run: |
          az containerapp update \
            --name $AZURE_CONTAINER_APP_FRONTEND \
            --resource-group $AZURE_RESOURCE_GROUP \
            --image "$REGISTRY/$FRONTEND_IMAGE_NAME:stable" \
            --set-env-vars \
              NEXT_PUBLIC_API_URL=https://api.outmate.ai

      - name: Wait for deployment
        run: |
          # Wait for new revision to become active
          timeout 5m bash -c 'until curl -f https://api.outmate.ai/health; do sleep 10; done'
          echo "✅ Production deployment is healthy"

      - name: Run production smoke tests
        run: |
          echo "Testing production health endpoints..."
          
          HEALTH=$(curl -s https://api.outmate.ai/health)
          echo "Health Status: $HEALTH"
          
          if [[ $HEALTH == *"healthy"* ]]; then
            echo "✅ Production health check passed"
          else
            echo "❌ Production health check failed"
            exit 1
          fi

      - name: Notify deployment success
        if: success()
        run: |
          echo "✅ Production deployment completed successfully"
          echo "Version: ${{ github.sha }}"
          echo "Time: $(date)"

      - name: Rollback on failure
        if: failure()
        run: |
          echo "⚠️ Deployment failed, initiating rollback..."
          az containerapp revision activate \
            --name $AZURE_CONTAINER_APP_BACKEND \
            --resource-group $AZURE_RESOURCE_GROUP \
            --revision $(az containerapp revision list \
              --name $AZURE_CONTAINER_APP_BACKEND \
              --resource-group $AZURE_RESOURCE_GROUP \
              --query "[-2].name" -o tsv)
          echo "✅ Rollback to previous revision completed"

  # ────────────────────────────────────────────────────────────
  # PERFORMANCE BENCHMARKING (Optional)
  # ────────────────────────────────────────────────────────────
  performance-test:
    needs: deploy-production
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - name: Install Apache Bench
        run: |
          apt-get update && apt-get install -y apache2-utils

      - name: Run load test
        run: |
          echo "Running baseline performance tests..."
          ab -n 100 -c 10 https://api.outmate.ai/health
          echo "✅ Performance test completed"

  # ────────────────────────────────────────────────────────────
  # NOTIFY STAKEHOLDERS
  # ────────────────────────────────────────────────────────────
  notify:
    needs: [deploy-production]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deployment ${{ job.status }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Outmate.AI Production Deployment*\nStatus: ${{ job.status }}\nCommit: ${{ github.sha }}\nBranch: ${{ github.ref_name }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

### 5.2 Prerequisite Setup

**Configure GitHub Environment Secrets:**

```bash
# Add to GitHub repository Settings → Environments → Production

Secrets:
├── AZURE_CLIENT_ID          (Service Principal Client ID)
├── AZURE_TENANT_ID          (Azure AD Tenant ID)
├── AZURE_SUBSCRIPTION_ID    (Azure Subscription ID)
├── SLACK_WEBHOOK_URL        (Slack notification webhook)
└── ACR_REGISTRY_LOGIN       (Optional, for advanced scenarios)

Environment-specific Variables (not secrets):
├── AZURE_RESOURCE_GROUP     (outmate-prod-core)
├── AZURE_LOCATION           (eastus)
└── REGISTRY                 (myregistry.azurecr.io)
```

**Create Azure Service Principal for CI/CD:**

```bash
# 1. Create Service Principal
az ad sp create-for-rbac \
  --name "ghactions-outmate-prod" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/outmate-prod-core

# Output:
# {
#   "clientId": "...",
#   "clientSecret": "...",
#   "subscriptionId": "...",
#   "tenantId": "..."
# }

# 2. Save these values as GitHub Secrets:
# AZURE_CLIENT_ID = clientId
# AZURE_TENANT_ID = tenantId
# AZURE_SUBSCRIPTION_ID = subscriptionId

# 3. For passwordless authentication (OIDC - recommended):
# Ask GitHub to configure the trust relationship instead of password
```

---

## 6. SCALING CONFIGURATION

### 6.1 Backend API Auto-Scaling Rules

#### **Azure Container Apps Auto-Scaling**

```yaml
# Container App: outmate-api-prod

Scale Settings:
  Min Replicas: 2
  Max Replicas: 10
  
Scale Rules:

  Rule 1: CPU Scaling
  ─────────────────
  Metric: CPU Utilization
  Threshold: 70%
  Cool-down: 300 seconds
  Scale Out (add replica):
    - When CPU > 70%
    - Add 1 replica (max every 5 min)
  Scale In (remove replica):
    - When CPU < 30% for 10 minutes
    - Remove 1 replica
  Expected Behavior:
    - 100 req/sec → 2 replicas (low)
    - 500 req/sec → 5 replicas (medium)
    - 1000 req/sec → 8 replicas (high)

  Rule 2: Memory Scaling
  ─────────────────────
  Metric: Memory Usage
  Threshold: 80%
  Cool-down: 300 seconds
  Action: Scale out by 1 replica
  Keep replicas: 10 (max)
  
  Rule 3: Request Count (Optional Advanced)
  ──────────────────────────────────────────
  Metric: HTTP Request Rate
  Threshold: 1000 req/sec
  Cool-down: 60 seconds
  Scale Out: +1 replica per 200 req/sec spike
```

**Azure CLI Configuration:**

```bash
# Update Container App with scale rules
az containerapp create \
  --name outmate-api-prod \
  --resource-group outmate-prod-core \
  --environment outmate-env \
  --image myregistry.azurecr.io/outmate-api:stable \
  --target-port 8000 \
  --ingress external \
  --min-replicas 2 \
  --max-replicas 10 \
  --scale-rule-name cpu-rule \
  --scale-rule-type cpu \
  --scale-rule-metadata type=Utilization value=70
```

### 6.2 Frontend Static Web App Scaling

**Azure Static Web Apps Auto-Scaling:**

(Automatically handled by Azure - no configuration needed)

```yaml
# Static Web App: outmate-web-prod

Auto-scaling:
  - Built-in to Azure Static Web Apps
  - CDN handles global distribution
  - No manual configuration required
  - Scales automatically based on demand

Caching Strategy:
  - Static assets: Cache-Control: max-age=31536000 (1 year)
  - HTML files: Cache-Control: max-age=0, must-revalidate
  - API responses: Cache-Control: no-cache (or per-endpoint)
```

### 6.3 Database Scaling Strategy

**PostgreSQL Flexible Server:**

```yaml
# Initial Tier: Standard_D4s_v3
# Metrics to monitor:
# - CPU: Target < 70%
# - Memory: Target < 85%
# - Connections: Target < 80 of max (100)
# - Storage: Target < 80% of provisioned

Scaling Plan:
  Phase 1 (0-10K API req/day):
    SKU: Standard_D2s_v3 (2 vCPU, 8GB RAM)
    Connections: 100
    Storage: 32 GB
    
  Phase 2 (10K-50K API req/day):
    SKU: Standard_D4s_v3 (4 vCPU, 16GB RAM)  ← Current
    Connections: 200
    Storage: 64 GB
    Scaling: Manual via portal or IaC
    
  Phase 3 (50K-100K API req/day):
    SKU: Standard_D8s_v3 (8 vCPU, 32GB RAM)
    Connections: 300
    Storage: 256 GB
    Scaling: Manual with brief downtime (5-10 min)
    Alternative: Read replicas for query offloading

Scaling Commands:
  # Monitor current utilization
  az postgres flexible-server show \
    --name outmate-postgres-prod \
    --resource-group outmate-prod-data
  
  # Scale up SKU
  az postgres flexible-server update \
    --name outmate-postgres-prod \
    --resource-group outmate-prod-data \
    --sku-name Standard_D8s_v3
  
  # Add read replica (for queries)
  az postgres flexible-server replica create \
    --master-server outmate-postgres-prod \
    --name outmate-postgres-read-01 \
    --resource-group outmate-prod-data
```

### 6.4 Redis Cache Scaling Strategy

**Upstash Redis via Azure:**

```yaml
# Initial: Premium_P1 (6 GB)
# Recommendations:

Scaling Plan:
  Phase 1 (0-100K req/day):
    Tier: Premium_P1
    Size: 6 GB
    Eviction: allkeys-lru (least recently used)
    Throughput: 30K ops/sec
    
  Phase 2 (100K-500K req/day):
    Tier: Premium_P2
    Size: 13 GB
    Eviction: allkeys-lru
    Throughput: 50K ops/sec
    
  Phase 3 (500K+ req/day):
    Tier: Premium_P3
    Size: 26 GB
    Eviction: allkeys-lru
    Throughput: 100K ops/sec
    
  Optimization: Implement cache sharding (Redis Cluster)
```

**Upstash Commands:**

```bash
# Monitor Redis metrics
redis-cli -u $REDIS_URL INFO stats

# Check memory usage
redis-cli -u $REDIS_URL INFO memory

# Monitor key count
redis-cli -u $REDIS_URL DBSIZE

# Clear expired keys (automatic)
redis-cli -u $REDIS_URL EVICT

# Scale tier (manual via Upstash console)
# 1. Go to Upstash.com
# 2. Select database
# 3. Click "Upgrade" or "Scale"
```

### 6.5 Monitoring and Alerting for Scaling

**Azure Monitor Metrics:**

```yaml
# Key Metrics to Track

1. Backend API (Container Apps)
   ├── CPU Percentage (Target: 50-70%)
   ├── Memory Percentage (Target: 60-80%)
   ├── Request Count (per second)
   ├── Response Time (p50, p99)
   ├── Error Rate (%)
   └── Replica Count (active)

2. Database (PostgreSQL)
   ├── CPU Percentage (Target: < 70%)
   ├── Memory Percentage (Target: < 85%)
   ├── Connection Count (Monitor: > 80)
   ├── Disk Usage (%)
   └── Query Performance (slow queries)

3. Cache (Redis)
   ├── Memory Usage (%)
   ├── Key Count
   ├── Hit Rate (Target: > 80%)
   ├── Eviction Count
   └── Commands/sec

Alert Thresholds:
├── CPU > 80% → Page on-call (scale out)
├── Memory > 85% → Warning (check for leaks)
├── Error rate > 5% → Investigation
├── Response time p99 > 5s → Investigate bottleneck
├── Database connections > 80 → Add connection pool
├── Cache evictions > 100/sec → Increase size
└── Storage > 90% → Cleanup old data
```

---

## 7. SECURITY MODEL

### 7.1 Network Isolation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AZURE FRONT DOOR                     │
│              (Global entry point, WAF, DDoS)             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS/TLS 1.2+ only
                         │
    ┌────────────────────┴────────────────────┐
    │                                         │
┌───▼─────────────────────────────────┐  ┌──▼──────────────────────────────┐
│  Azure Container Apps (Ingress)     │  │  Static Web Apps (CDN)           │
│  - Rate limiting via Front Door WAF │  │  - Managed HTTPS                 │
│  - DDoS protection                  │  │  - Global distribution           │
└───┬─────────────────────────────────┘  └──┬──────────────────────────────┘
    │                                       │
    │ Virtual Network Integration          │ (No direct network)
    │                                       │
    ▼                                       │
┌────────────────────────────────────┐     │
│  Virtual Network (10.0.0.0/16)     │     │
│                                    │     │
│  ┌──────────────────────────────┐  │     │
│  │ Subnet: Container Apps       │  │     │
│  │ (10.0.1.0/24)               │  │     │
│  │ ├─ outmate-api-prod         │  │     │
│  │ └─ outmate-api-staging      │  │     │
│  └──────────────────────────────┘  │     │
│                                    │     │
│  ┌──────────────────────────────┐  │     │
│  │ Subnet: Databases            │  │     │
│  │ (10.0.2.0/24)               │  │     │
│  │ ├─ PostgreSQL               │  │     │
│  │ └─ Managed endpoints        │  │     │
│  └──────────────────────────────┘  │     │
│                                    │     │
│  ┌──────────────────────────────┐  │     │
│  │ Network Security Groups      │  │     │
│  │ ├─ Allow App → DB (5432)    │  │     │
│  │ ├─ Allow App → Redis (6380) │  │     │
│  │ ├─ Allow App → KV (443)     │  │     │
│  │ └─ Deny all other inbound   │  │     │
│  └──────────────────────────────┘  │     │
└────────────────────────────────────┘     │
                                            │
    ┌───────────────────────────────────────┘
    │ Private Endpoints
    │
    ▼
┌──────────────────────────────────────┐
│  Azure Key Vault (Private)           │
│  └─ Only accessible via private link │
└──────────────────────────────────────┘
```

### 7.2 Firewall and Network Security Rules

#### **Network Security Groups (NSG)**

**NSG: App-to-Database**

```yaml
Name: outmate-app-nsg
Inbound Rules:
  - Allow: HTTPS (443) from Front Door [Priority: 100]
  - Allow: HTTP (8000) from Front Door [Priority: 110]
  - Deny: All other inbound [Priority: 4096]

Outbound Rules:
  - Allow: PostgreSQL (5432) to Database subnet [Priority: 100]
  - Allow: Redis (6380) to Redis endpoint [Priority: 110]
  - Allow: HTTPS (443) to Azure services [Priority: 120]
  - Allow: DNS (53) for name resolution [Priority: 130]
  - Deny: All else [Priority: 4096]
```

**NSG: Database-to-VNet**

```yaml
Name: outmate-database-nsg
Inbound Rules:
  - Allow: PostgreSQL (5432) from App subnet [Priority: 100]
  - Deny: All other inbound [Priority: 4096]

Outbound Rules:
  - Allow: All to App subnet [Priority: 100]
  - Allow: HTTPS (443) to storage [Priority: 110]
  - Deny: All else [Priority: 4096]
```

### 7.3 API Rate Limiting Strategy

#### **Layer 1: Azure Front Door WAF**

```yaml
# Front Door WAF Policy (OWASP 3.1)

Rule Set: OWASP_3.1
Action: Block (violations)

Custom Rules:
  Rule 1: IP Reputation
    - Block: IPs from threat intelligence
    - Action: Block
    
  Rule 2: GeoBlocking (Optional)
    - Block: Requests from specific countries
    - Countries: (based on business needs)
    
  Rule 3: Rate Limiting
    - Threshold: 2000 requests per minute per IP
    - Window: 1 minute
    - Action: Block (429 Too Many Requests)
    
  Rule 4: Bot Protection
    - Detect: Known bot patterns
    - Action: Challenge (CAPTCHA) or Block
    
  Rule 5: SQL Injection Detection
    - Detect: Malicious SQL patterns
    - Action: Block
    
  Rule 6: XSS Detection
    - Detect: Script injection attempts
    - Action: Block
```

#### **Layer 2: API-Level Rate Limiting**

(Already implemented in Backend via slowapi)

```python
# Backend/app/core/rate_limiting.py

Environment-based limits:

DEVELOPMENT:
  - Default: 1000 requests/minute
  - Search: 500 requests/minute
  - Auth: 200 requests/minute

PRODUCTION:
  - Default: 60 requests/minute
  - Search: 30 requests/minute
  - Auth: 10 requests/minute

Implementation:
  @limiter.limit("60/minute")
  async def get_health(request: Request):
      return {"status": "ok"}
```

### 7.4 Secret Management (Azure Key Vault)

#### **Credential Rotation Policy**

```yaml
Secrets Requiring Rotation:

1. JWT_SECRET
   - Rotation: Every 90 days
   - Method: Automated via Azure Automation
   - Impact: New tokens required, existing ones honored for grace period
   
2. Database Password
   - Rotation: Every 180 days
   - Method: Via Azure Portal + connection string update
   - Impact: Brief downtime (update connection string, restart apps)
   
3. API Keys (CrustData, Explorium, etc.)
   - Rotation: As per vendor policy
   - Method: Manual via vendor dashboards, update in Key Vault
   - Impact: Zero downtime (live API key update)
   
4. Service Principal Credentials
   - Rotation: Every 365 days
   - Method: Generate new credentials, update GitHub secrets
   - Impact: Zero downtime (used by CI/CD)

Automated Rotation Script:
  - Use: Azure Functions + Key Vault REST API
  - Trigger: Timer-based (monthly check)
  - Notification: Alert team 30 days before expiry
```

#### **Access Control (RBAC)**

```yaml
Key Vault: outmate-kv-prod

Roles:

1. Subscription Admin
   Permissions: Full access
   Who: Cloud architect, security team lead
   
2. DevOps Engineer
   Permissions: Get, List, Set, Delete secrets
   Who: CI/CD service principal, DevOps team
   Scoping: Specific resource group
   
3. Application Service
   Permissions: Get secrets only (read-only)
   Who: Container Apps managed identity
   Scoping: Read only (no delete, no set)
   
4. Security Auditor
   Permissions: List, GetMetadata only
   Who: Security team (audit access)
   Scoping: No read of secret values
   
5. Backup Operator
   Permissions: Backup and restore only
   Who: Backup automation
   Scoping: System managed

Access Policy Commands:

  # Grant Container Apps access
  az keyvault set-policy \
    --name outmate-kv-prod \
    --object-id <container-app-managed-identity> \
    --secret-permissions get list

  # Grant DevOps access
  az keyvault set-policy \
    --name outmate-kv-prod \
    --spn <devops-service-principal> \
    --secret-permissions get list set delete
```

### 7.5 Data Encryption

#### **Encryption at Rest**

```yaml
Component: Encryption Key

PostgreSQL:
  - Method: Transparent Data Encryption (TDE)
  - Status: Enabled by default
  - Key Management: Microsoft-managed (or customer-managed via BYOK)
  
Redis:
  - Method: AES-256 encryption at rest (Upstash)
  - Status: Enabled by default
  - Key: Managed by Upstash
  
Blob Storage:
  - Method: Storage Service Encryption (SSE)
  - Status: Enabled by default
  - Key: Microsoft-managed or customer-managed
  
Key Vault:
  - Method: Built-in encryption
  - Status: All secrets encrypted at rest
  - Key: HSM-protected (Premium tier)
```

#### **Encryption in Transit**

```yaml
Component: Protocol

Frontend to Users:
  - Protocol: HTTPS/TLS 1.2+
  - Certificate: Azure-managed (Static Web Apps)
  
Frontend to Backend API:
  - Protocol: HTTPS/TLS 1.2+
  - Certificate: Azure-managed (App Service)
  - Hostname verification: Enabled
  
Backend to Database:
  - Protocol: SSL (port 5432)
  - Parameter: sslmode=require
  - Certificate verification: Enabled
  
Backend to Redis:
  - Protocol: TLS (port 6380)
  - Parameter: ssl=True
  - Certificate verification: Enabled
  
Backend to Key Vault:
  - Protocol: HTTPS/TLS 1.2+
  - Endpoint: Private (via private link)
```

### 7.6 Regular Security Audits

```yaml
Frequency: Monthly

Checklist:
  □ Review Key Vault access logs
  □ Check NSG rule changes
  □ Audit IP firewall rules
  □ Review managed identities
  □ Scan ACR images for vulnerabilities
  □ Check TLS certificate expiry
  □ Review secrets rotation status
  □ Verify backup integrity
  □ Check data export logs
  □ Review Azure Policy violations

Tools:
  - Microsoft Defender for Cloud
  - Azure Policy Compliance
  - Azure Security Center
  - Access Reviews (Azure AD)
```

---

## 8. COST ESTIMATION

### 8.1 Detailed Cost Breakdown

#### **STARTUP STAGE** (0-5,000 API requests/day)

| Service | SKU | Monthly Cost | Notes |
|---------|-----|--------------|-------|
| **Container Apps** | Consumption | $36 | 2 replicas, 1 vCPU, 2GB RAM |
| **Static Web Apps** | Free | $0 | No cost for traffic |
| **Application Gateway** | - | $0 | Replaced by Front Door |
| **PostgreSQL** | B_Standard_B1ms | $49 | Burstable, 1 vCPU, 2GB RAM |
| **Redis** | Upstash Free | $0 | Free tier for development |
| **Front Door** | Standard | $0.6 | Minimal requests |
| **Key Vault** | Standard | $1 | 1,000 ops free, overage minimal |
| **Application Insights** | Pay-per-GB | $5 | 1GB data ingestion |
| **Blob Storage** | Standard/LRS | $2 | 100GB storage |
| **Bandwidth (egress)** | - | $0.12 | 1GB per month |
| **&nbsp;** | | | |
| **TOTAL** | | **~$93/month** | **~$1,116/year** |

---

#### **GROWTH STAGE** (5,000-50,000 API requests/day)

| Service | SKU | Monthly Cost | Notes |
|---------|-----|--------------|-------|
| **Container Apps** | Consumption | $180 | 3-5 replicas, auto-scaling |
| **Static Web Apps** | Free | $0 | No cost |
| **PostgreSQL** | Standard_D2s_v3 | $280 | 2 vCPU, 8GB RAM, HA |
| **Redis** | Upstash Premium_P1 | $200 | 6GB, 30K ops/sec |
| **Front Door** | Premium** | $200 | Enhanced WAF, advanced rules |
| **Key Vault** | Standard | $1 | Minimal overage |
| **Application Insights** | Pay-per-GB | $20 | 3GB data ingestion |
| **Blob Storage** | Standard/GRS | $10 | 500GB geo-redundant |
| **Bandwidth (egress)** | - | $50 | 5GB per month US→Global |
| **Log Analytics** | Pay-per-GB | $15 | Logs retention + analysis |
| **&nbsp;** | | | |
| **TOTAL** | | **~$956/month** | **~$11,472/year** |

---

#### **SCALE STAGE** (50,000-500,000 API requests/day)

| Service | SKU | Monthly Cost | Notes |
|---------|-----|--------------|-------|
| **Container Apps** | Consumption | $500 | 8-10 replicas, consistent load |
| **Static Web Apps** | Free | $0 | CDN included |
| **PostgreSQL** | Standard_D4s_v3 | $560 | 4 vCPU, 16GB RAM, HA |
| **PostgreSQL Read Replica** | Standard_D4s_v3 | $560 | Geo-redundancy + query distribution |
| **Redis** | Upstash Premium_P2 | $400 | 13GB, 50K ops/sec |
| **Front Door** | Premium | $300 | Higher request volume discounts |
| **Key Vault** | Standard | $1 | Minimal overage |
| **Application Insights** | Commitment Tier | $100 | 100GB/month commitment |
| **Blob Storage** | Standard/GRS | $50 | 2TB geo-redundant |
| **Bandwidth (egress)** | - | $200 | 20GB per month US→Global |
| **Log Analytics** | Commitment Tier | $100 | 100GB/month commitment |
| **Azure Backup Vault** | Standard | $50 | Daily backup + retention |
| **Azure Firewall** (optional) | Standard | $1.30 | Network segmentation |
| **&nbsp;** | | | |
| **TOTAL** | | **~$3,721/month** | **~$44,652/year** |

---

### 8.2 Reserved Instance Discounts (Cost Optimization)

**Purchase 1-year or 3-year reservations for predictable workloads:**

```yaml
Eligible Services:
  - PostgreSQL Flexible Server: 30% discount
  - Static Web Apps: No reservation available
  - Container Apps: No reservation available

Example Savings:
  PostgreSQL Reserved (1-year):
    On-Demand: $560/month
    Reserved: $391/month (30% discount)
    Savings: $169/month × 12 = $2,028/year
```

### 8.3 Cost Optimization Strategies

```yaml
1. Right-sizing
   ├─ Monitor actual CPU/memory usage
   ├─ Scale down if under-utilized
   └─ Potential Saving: 20-30%

2. Spot Instances (Azure Spot VMs)
   ├─ For non-critical workloads
   ├─ Up to 90% discount
   └─ Not applicable to Container Apps (always on-demand)

3. Reserved Instances
   ├─ PostgreSQL: 30% discount for 1-year commitment
   ├─ Storage: Reserved capacity for 1-year commitment
   └─ Potential Saving: 25-30%

4. Auto-shutdown (non-production)
   ├─ Shutdown staging/dev environments at 6 PM
   ├─ Restart at 8 AM
   └─ Potential Saving: 33%

5. Data Transfer Optimization
   ├─ Cache frequently accessed data (Redis)
   ├─ Use CDN for static assets
   ├─ Compress responses (gzip)
   └─ Potential Saving: 20-40%

6. Storage Tier Optimization
   ├─ Hot tier: Logs < 30 days
   ├─ Cool tier: Logs 30-90 days
   ├─ Archive tier: Logs > 90 days
   └─ Potential Saving: 40-70%

Total Optimization Potential: 30-50% of costs
```

### 8.4 Monthly Cost Tracking & Budgets

**Azure Cost Management:**

```bash
# Set budget alert
az costmanagement budget create \
  --name "Outmate-Monthly-Budget" \
  --scope /subscriptions/$SUBSCRIPTION_ID \
  --amount 5000 \
  --time-grain Monthly \
  --time-period "2024-03-01" to "2024-03-31"

# Get current costs
az costmanagement query create \
  --scope /subscriptions/$SUBSCRIPTION_ID \
  --timeframe MonthToDate \
  --type Usage
```

---

## 9. DEPLOYMENT ROADMAP

### 9.1 Week-by-Week Deployment Plan

#### **WEEK 1: Foundation & Authentication**

**Days 1-2: Azure Account Setup**
```
☐ Create Azure subscription
☐ Create 5 resource groups (core, data, security, monitoring, networking)
☐ Configure Azure AD tenant
☐ Enable Multi-Factor Authentication (MFA)
☐ Create Service Principal for CI/CD
```

**Days 3-4: Key Vault & Secrets**
```
☐ Create Azure Key Vault
☐ Set up RBAC policies
☐ Add all secrets (database password, JWT secret, API keys)
☐ Enable Key Vault audit logging
☐ Test secret retrieval
```

**Day 5: Networking**
```
☐ Create Virtual Network (10.0.0.0/16)
☐ Create subnets (Container Apps, Database)
☐ Create Network Security Groups with rules
☐ Create private endpoints for PostgreSQL, Key Vault
☐ Test network connectivity
```

---

#### **WEEK 2: Data Layer**

**Days 1-2: PostgreSQL Setup**
```
☐ Create PostgreSQL Flexible Server
☐ Enable HA and backups
☐ Configure SSL/TLS enforcement
☐ Create database and schema (run migrations)
☐ Set up private endpoint
☐ Configure firewall rules
☐ Test connectivity from local machine
```

**Days 3-4: Redis Cache**
```
☐ Set up Upstash Redis account
☐ Create Premium tier database
☐ Enable TLS (port 6380)
☐ Configure eviction policy
☐ Test connectivity
```

**Day 5: Monitoring Setup**
```
☐ Create Log Analytics workspace
☐ Create Application Insights instance
☐ Link Application Insights to Log Analytics
☐ Test logging pipeline
```

---

#### **WEEK 3: Container Infrastructure**

**Days 1-2: Container Registry**
```
☐ Create Azure Container Registry (Premium)
☐ Configure authentication (Service Principal)
☐ Set up image scanning (Trivy)
☐ Create image retention policies
☐ Tag existing Docker images
☐ Push images to ACR
```

**Days 3-5: Container Apps**
```
☐ Create Container Apps environment
☐ Deploy backend (FastAPI)
  ├─ Create ingress
  ├─ Configure environment variables
  ├─ Link Key Vault secrets
  ├─ Set health probes
  ├─ Configure auto-scaling (2-10 replicas)
  └─ Test endpoints

☐ Deploy frontend (Next.js)
  ├─ (Optional) Can use Static Web Apps instead
  ├─ Configure environment variables
  ├─ Link API backend URL
  └─ Test health check

☐ Test inter-service communication
```

---

#### **WEEK 4: Front-End, Routing & CI/CD**

**Days 1-2: Azure Static Web Apps (if using)**
```
☐ Create Static Web App for frontend
☐ Configure build settings (Next.js)
☐ Link GitHub repository
☐ Enable CI/CD pipeline
☐ Deploy staging slot
☐ Run smoke tests
```

**Days 3-4: Azure Front Door**
```
☐ Create Front Door (Standard or Premium)
☐ Configure origins (Container Apps + Static Web Apps)
☐ Enable WAF with OWASP 3.1 rules
☐ Set up rate limiting (2000 req/min)
☐ Enable DDoS protection
☐ Configure SSL/TLS enforcement
☐ Create custom domain (app.outmate.ai)
☐ Configure DNS CNAME
☐ Test global load balancing
```

**Day 5: CI/CD Pipeline**
```
☐ Set up GitHub repository secrets
☐ Create GitHub Actions workflows
  ├─ Build backend image
  ├─ Build frontend image
  ├─ Push to ACR
  ├─ Deploy to staging
  ├─ Run smoke tests
  └─ Deploy to production

☐ Test manual trigger
☐ Test push to main branch
```

---

#### **WEEK 5: Monitoring & Security**

**Days 1-2: Application Insights & Alerts**
```
☐ Configure Application Insights SDK
☐ Set up custom metrics
  ├─ API latency
  ├─ Error rate
  ├─ Cache hit rate
  └─ Database query time

☐ Create alert rules
  ├─ High error rate (> 5%)
  ├─ High response time (p99 > 5s)
  ├─ Database connection issues
  └─ Storage quota warnings

☐ Create dashboards
└─ Test alerting mechanisms
```

**Days 3-4: Security Hardening**
```
☐ Enable Azure Policy compliance
☐ Configure firewall rules
☐ Set up VNet flow logs
☐ Enable Network Watcher
☐ Configure DDoS protection settings
☐ Review and lock down IAM permissions
☐ Run security recommendations from Defender
```

**Day 5: Backup & Disaster Recovery**
```
☐ Configure PostgreSQL automated backups
☐ Test backup restoration
☐ Set up Blob Storage lifecycle policies
☐ Document recovery procedures
☐ Schedule disaster recovery drill (monthly)
```

---

#### **WEEK 6: Testing & Optimization**

**Days 1-2: Load Testing**
```
☐ Install load testing tool (Apache JMeter or k6)
☐ Create load test script
  ├─ Health endpoint
  ├─ API endpoints
  └─ Database queries

☐ Run baseline test
  ├─ 100 concurrent users
  ├─ 10 minutes duration
  └─ Record metrics

☐ Analyze results
  ├─ Response times
  ├─ Error rates
  ├─ Throughput
  └─ Resource utilization

☐ Optimize based on findings
```

**Days 3-4: Performance Tuning**
```
☐ Optimize database queries
  ├─ Add indexes if needed
  ├─ Review slow query logs
  └─ Optimize connection pooling

☐ Optimize caching strategy
  ├─ Review cache hit rate
  ├─ Adjust TTLs
  └─ Implement cache warming

☐ Optimize API responses
  ├─ Enable gzip compression
  ├─ Implement pagination
  └─ Review payload sizes
```

**Day 5: Documentation & Knowledge Transfer**
```
☐ Document deployment procedures
☐ Create runbooks for common tasks
  ├─ Scale up/down
  ├─ Secret rotation
  ├─ Emergency rollback
  └─ Database maintenance

☐ Conduct knowledge transfer session
├─ Demo deployment process
├─ Explain scaling triggers
├─ Review alert procedures
└─ Q&A with team
```

---

#### **WEEK 7: Pre-Launch & Staging**

**Days 1-3: Final Testing**
```
☐ Smoke tests
  ├─ Health endpoints
  ├─ API endpoints
  ├─ Database connectivity
  └─ Cache functionality

☐ End-to-end tests
  ├─ User signup
  ├─ User authentication
  ├─ API calls with authentication
  └─ Data persistence

☐ Security tests
  ├─ Rate limiting works
  ├─ WAF blocks malicious requests
  ├─ HTTPS enforcement
  └─ Secret rotation
```

**Days 4-5: Staging Environment**
```
☐ Deploy to staging environment
☐ Run full test suite
☐ Get stakeholder approval
☐ Create rollback plan
☐ Brief customer support team
☐ Schedule on-call rotation
```

---

#### **WEEK 8: Production Launch**

**Days 1-2: Pre-Launch Checklist**
```
☐ Create deployment ticket
☐ Get final approvals
☐ Notify team and stakeholders
☐ Prepare monitoring dashboards
☐ Brief DevOps team
☐ Set up on-call rotation
☐ Enable extra logging for first 24 hours
```

**Days 3-5: Deployment**
```
☐ Day 3 @ 10 AM: Deploy to production
  ├─ Backend API
  ├─ Frontend
  ├─ Update DNS (if needed)
  └─ Verify endpoints

☐ Monitor closely
  ├─ Check health endpoints every 5 minutes
  ├─ Watch Application Insights
  ├─ Monitor error rates
  └─ Monitor resource utilization

☐ Post-deployment
  ├─ Run final smoke tests
  ├─ Get user feedback
  ├─ Address any critical issues
  └─ Create post-launch report
```

### 9.2 Deployment Command Reference

```bash
# ────────────────────────────────────────────────────────────
# SETUP PHASE
# ────────────────────────────────────────────────────────────

# 1. Login to Azure
az login

# 2. Create resource groups
az group create --name outmate-prod-core --location eastus
az group create --name outmate-prod-data --location eastus
az group create --name outmate-prod-security --location eastus
az group create --name outmate-prod-monitoring --location eastus

# 3. Create Key Vault
az keyvault create \
  --name outmate-kv-prod \
  --resource-group outmate-prod-security \
  --location eastus

# 4. Add secrets
az keyvault secret set --vault-name outmate-kv-prod \
  --name database-url \
  --value "postgresql+psycopg2://..."

# ────────────────────────────────────────────────────────────
# DATA LAYER SETUP
# ────────────────────────────────────────────────────────────

# 5. Create PostgreSQL
az postgres flexible-server create \
  --name outmate-postgres-prod \
  --resource-group outmate-prod-data \
  --location eastus \
  --admin-user postgres \
  --admin-password $DB_PASSWORD \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose \
  --storage-size 32768

# 6. Create Redis
# (Use Upstash console or Azure CLI for Azure Cache for Redis)

# ────────────────────────────────────────────────────────────
# CONTAINER SETUP
# ────────────────────────────────────────────────────────────

# 7. Create Container Registry
az acr create \
  --resource-group outmate-prod-core \
  --name myregistry \
  --sku Premium

# 8. Build and push images
docker build -t myregistry.azurecr.io/outmate-api:stable ./Backend
docker push myregistry.azurecr.io/outmate-api:stable

# 9. Create Container Apps environment
az containerapp env create \
  --name outmate-env \
  --resource-group outmate-prod-core \
  --location eastus

# 10. Deploy backend
az containerapp create \
  --name outmate-api-prod \
  --resource-group outmate-prod-core \
  --environment outmate-env \
  --image myregistry.azurecr.io/outmate-api:stable \
  --target-port 8000 \
  --ingress external

# ────────────────────────────────────────────────────────────
# MONITORING
# ────────────────────────────────────────────────────────────

# 11. Create Application Insights
az monitor app-insights component create \
  --app outmate-insights \
  --location eastus \
  --resource-group outmate-prod-monitoring \
  --kind web \
  --application-type web

# ────────────────────────────────────────────────────────────
# DEPLOYMENT
# ────────────────────────────────────────────────────────────

# 12. Update container app with new image
az containerapp update \
  --name outmate-api-prod \
  --resource-group outmate-prod-core \
  --image myregistry.azurecr.io/outmate-api:stable

# 13. Verify deployment
curl https://api.outmate.ai/health
```

---

## SUMMARY

This comprehensive Azure infrastructure plan provides:

✅ **Complete Architecture Design** - All components interconnected  
✅ **Resource Organization** - 5 resource groups for separation of concerns  
✅ **Security Model** - Network isolation, encryption, RBAC, secret management  
✅ **Scalability** - Auto-scaling rules for all layers  
✅ **Cost Optimization** - Detailed breakdown + strategies  
✅ **CI/CD Pipeline** - GitHub Actions with staging gates  
✅ **Monitoring & Alerting** - Application Insights + custom metrics  
✅ **8-Week Deployment Roadmap** - Week-by-week execution plan  

**Ready for enterprise-grade production deployment on Azure!**

---

**Document Version:** 1.0  
**Last Updated:** March 4, 2026  
**Status:** Ready for Implementation
