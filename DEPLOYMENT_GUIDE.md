# Outmate.AI - Deployment Guide

## Quick Start: Local Testing

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ (for frontend development)
- Python 3.11+

### 1. Prepare Environment

```bash
cd Backend
cp .env.example .env.development

# Edit .env.development with your development credentials
# Minimal required:
cat > .env.development << 'EOF'
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=DEBUG
DATABASE_URL=postgresql+psycopg2://postgres:postgres@postgres:5432/outmate
REDIS_URL=redis://redis:6379/0
JWT_SECRET=your-dev-secret-minimum-32-characters-long-123456
CRUSTDATA_API_KEY=test_key
EXPLORIUM_API_KEY=test_key
CONTACTOUT_API_KEY=test_key
OPENROUTER_API_KEY=test_key
EOF
```

### 2. Start Infrastructure

```bash
# From project root
docker-compose up -d

# Wait for services to be healthy
docker-compose ps

# Check logs
docker-compose logs -f postgres redis api web
```

### 3. Run Database Migrations

```bash
cd Backend
python -m alembic upgrade head
```

### 4. Test Health Endpoints

```bash
# Wait ~30 seconds for API to start
sleep 30

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8000/health/db
curl http://localhost:8000/health/redis

# Test API
curl http://localhost:8000/api/v1/users

# Test frontend
open http://localhost:3000
```

### 5. Development Iteration

```bash
# Backend logs
docker-compose logs -f api

# Frontend logs
docker-compose logs -f web

# Restart API after code changes
docker-compose restart api

# Stop everything
docker-compose down
```

---

## Production Deployment: Azure Container Instances

### 1. Create Azure Resources

```bash
# Set variables
RESOURCE_GROUP=outmate-prod
REGISTRY_NAME=outmateregistry
ACR_URL=${REGISTRY_NAME}.azurecr.io
LOCATION=eastus

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $REGISTRY_NAME \
  --sku Standard

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-db \
  --admin-user postgres \
  --admin-password "YourSecurePassword123!" \
  --location $LOCATION

# Create Redis (or use Upstash for simplicity)
az redis create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-redis \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0
```

### 2. Build and Push Images

```bash
# Build backend
cd Backend
docker build -t ${ACR_URL}/outmate-api:1.0.0 .

# Build frontend
cd ../Frontend
docker build -t ${ACR_URL}/outmate-web:1.0.0 .

# Login to registry
az acr login --name $REGISTRY_NAME

# Push images
docker push ${ACR_URL}/outmate-api:1.0.0
docker push ${ACR_URL}/outmate-web:1.0.0

# List images
az acr repository list --name $REGISTRY_NAME
```

### 3. Deploy Backend API

```bash
# Create Key Vault for secrets
az keyvault create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-kv

# Add secrets
az keyvault secret set --vault-name outmate-kv \
  --name jwt-secret \
  --value "your-generated-secret-here"

az keyvault secret set --vault-name outmate-kv \
  --name database-url \
  --value "postgresql+psycopg2://..."

az keyvault secret set --vault-name outmate-kv \
  --name redis-url \
  --value "redis://..."

# Deploy container instance
az container create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --image ${ACR_URL}/outmate-api:1.0.0 \
  --cpu 2 \
  --memory 2 \
  --port 8000 \
  --protocol TCP \
  --dns-name-label outmate-api \
  --registry-login-server ${ACR_URL} \
  --registry-username $REGISTRY_NAME \
  --registry-password "$(az acr credential show --name $REGISTRY_NAME --query passwords[0].value -o tsv)" \
  --environment-variables \
    ENVIRONMENT=production \
    LOG_LEVEL=WARNING \
  --secure-environment-variables \
    DATABASE_URL="$(az keyvault secret show --vault-name outmate-kv --name database-url --query value -o tsv)" \
    REDIS_URL="$(az keyvault secret show --vault-name outmate-kv --name redis-url --query value -o tsv)" \
    JWT_SECRET="$(az keyvault secret show --vault-name outmate-kv --name jwt-secret --query value -o tsv)"

# Get public IP
az container show --resource-group $RESOURCE_GROUP --name outmate-api --query ipAddress.fqdn
```

### 4. Deploy Frontend

```bash
az container create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-web \
  --image ${ACR_URL}/outmate-web:1.0.0 \
  --cpu 1 \
  --memory 1 \
  --port 3000 \
  --protocol TCP \
  --dns-name-label outmate-web \
  --registry-login-server ${ACR_URL} \
  --registry-username $REGISTRY_NAME \
  --registry-password "$(az acr credential show --name $REGISTRY_NAME --query passwords[0].value -o tsv)" \
  --environment-variables \
    NEXT_PUBLIC_API_URL="http://outmate-api.<region>.azurecontainer.io:8000"
```

### 5. Configure Custom Domain (Optional)

```bash
# Get the FQDN of your container instance
API_FQDN=$(az container show --resource-group $RESOURCE_GROUP --name outmate-api --query ipAddress.fqdn -o tsv)

# In your DNS provider, create CNAME:
# api.yourdomain.com CNAME -> $API_FQDN
```

### 6. Verify Deployment

```bash
# Check API health
curl https://api.yourdomain.com/health

# Check database
curl https://api.yourdomain.com/health/db

# Check Redis
curl https://api.yourdomain.com/health/redis

# View logs
az container logs --resource-group $RESOURCE_GROUP --name outmate-api

# View container state
az container show --resource-group $RESOURCE_GROUP --name outmate-api
```

---

## Production Deployment: Azure App Service (Recommended)

### 1. Create App Service Plan

```bash
# Create App Service Plan
az appservice plan create \
  --name outmate-plan \
  --resource-group $RESOURCE_GROUP \
  --is-linux \
  --sku P1V2

# Create Web App for Backend
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan outmate-plan \
  --name outmate-api \
  --deployment-container-image-name ${ACR_URL}/outmate-api:1.0.0

# Create Web App for Frontend
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan outmate-plan \
  --name outmate-web \
  --deployment-container-image-name ${ACR_URL}/outmate-web:1.0.0
```

### 2. Configure Deployment

```bash
# Enable continuous deployment
az webapp deployment container config \
  --name outmate-api \
  --resource-group $RESOURCE_GROUP \
  --enable-cd true

# Set app settings
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --settings \
    ENVIRONMENT=production \
    LOG_LEVEL=WARNING \
    DOCKER_REGISTRY_SERVER_URL=${ACR_URL} \
    DOCKER_REGISTRY_SERVER_USERNAME=$REGISTRY_NAME \
    DOCKER_REGISTRY_SERVER_PASSWORD=$(az acr credential show --name $REGISTRY_NAME --query passwords[0].value -o tsv)

# Set connection strings
az webapp config connection-string set \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --connection-string-slots \
    DATABASE_URL="postgresql+psycopg2://..." \
    REDIS_URL="redis://..." \
  --type PostgreSQL
```

### 3. Scale Application

```bash
# Auto-scale rule: CPU > 70% -> add instance
az monitor autoscale create \
  --resource-group $RESOURCE_GROUP \
  --resource outmate-api \
  --resource-type "Microsoft.Web/serverfarms" \
  --min-count 2 \
  --max-count 10 \
  --rules "Avg CPU > 70 -> add 1 instance"

# Manual scale
az appservice plan update \
  --resource-group $RESOURCE_GROUP \
  --name outmate-plan \
  --sku P1V2 \
  --number-of-workers 3
```

---

## Kubernetes Deployment (AKS)

### Prerequisites
- AKS cluster created: `az aks get-credentials --name outmate-aks --resource-group $RESOURCE_GROUP`

### 1. Deploy to AKS

```bash
# Create namespace
kubectl create namespace outmate

# Create secrets
kubectl create secret docker-registry acr-secret \
  --docker-server=${ACR_URL} \
  --docker-username=$REGISTRY_NAME \
  --docker-password="$(az acr credential show --name $REGISTRY_NAME --query passwords[0].value -o tsv)" \
  -n outmate

# Create database secret
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgresql+psycopg2://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="your-secret" \
  -n outmate

# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml -n outmate

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml -n outmate

# Check deployment status
kubectl rollout status deployment/outmate-api -n outmate
kubectl rollout status deployment/outmate-web -n outmate
```

### 2. Set Up Ingress

```bash
# Install nginx ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace kube-system \
  --set controller.service.loadBalancerIP=<your-static-ip>

# Apply ingress configuration
kubectl apply -f k8s/ingress.yaml -n outmate
```

---

## Monitoring & Alerts

### Enable Application Insights

```bash
# Create Application Insights
az monitor app-insights component create \
  --app outmate-insights \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --type web

# Link to App Service
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --app-insights-key "$(az monitor app-insights component show --app outmate-insights --resource-group $RESOURCE_GROUP --query instrumentationKey -o tsv)"
```

### Create Alerts

```bash
# Alert on high error rate
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group $RESOURCE_GROUP \
  --scopes /subscriptions/<id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/outmate-api \
  --condition "avg RequestsFailed > 100" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "$(az monitor action-group show --name alerts --resource-group $RESOURCE_GROUP)"

# Alert on high response time
az monitor metrics alert create \
  --name "High Response Time" \
  --resource-group $RESOURCE_GROUP \
  --scopes /subscriptions/<id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/outmate-api \
  --condition "avg ResponseTime > 5000" \
  --window-size 5m \
  --evaluation-frequency 1m
```

---

## Backup & Recovery

### Database Backup

```bash
# Enable automated backups (7 days retention)
az postgres flexible-server parameter set \
  --resource-group $RESOURCE_GROUP \
  --server-name outmate-db \
  --name backup_retention_days \
  --value 7

# Manual backup
az postgres flexible-server backup create \
  --resource-group $RESOURCE_GROUP \
  --server-name outmate-db \
  --backup-name manual-backup-$(date +%s)

# List backups
az postgres flexible-server backup list \
  --resource-group $RESOURCE_GROUP \
  --server-name outmate-db
```

### Restore from Backup

```bash
# Create new server from backup
az postgres flexible-server restore \
  --resource-group $RESOURCE_GROUP \
  --server-name outmate-db-restored \
  --source-server /subscriptions/<id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DBforPostgreSQL/flexibleServers/outmate-db \
  --backup outmate-db-backup-12345
```

---

## Rollback Procedure

### If Deployment Fails

```bash
# Check current deployments
az container list --resource-group $RESOURCE_GROUP

# Redeploy previous version
az container create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --image ${ACR_URL}/outmate-api:0.9.0 \
  # ... (same parameters as before)

# Or with App Service slots
az webapp deployment slot create \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --slot staging

# Deploy to staging first
az webapp deployment container config \
  --name outmate-api \
  --resource-group $RESOURCE_GROUP \
  --slot staging \
  --enable-cd true

# Swap slots when ready
az webapp deployment slot swap \
  --resource-group $RESOURCE_GROUP \
  --name outmate-api \
  --slot staging
```

---

## Performance Tuning

### Database Optimization

```bash
# Check slow queries
az postgres flexible-server server-logs download \
  --resource-group $RESOURCE_GROUP \
  --server-name outmate-db \
  --name "postgresql-2024-03-04_*.log" \
  --output-folder ./logs

# Enable query insights
az postgres flexible-server parameter set \
  --resource-group $RESOURCE_GROUP \
  --server-name outmate-db \
  --name log_min_duration_statement \
  --value 1000  # Log queries > 1 second
```

### Redis Optimization

```bash
# Check Redis metrics
az redis export \
  --name outmate-redis \
  --resource-group $RESOURCE_GROUP

# Increase maxmemory policy
az redis update \
  --name outmate-redis \
  --resource-group $RESOURCE_GROUP \
  --set maxmemory_policy="allkeys-lru"
```

---

## Support Resources

- [Azure Container Instances Docs](https://docs.microsoft.com/azure/container-instances/)
- [Azure App Service Docs](https://docs.microsoft.com/azure/app-service/)
- [Azure Kubernetes Service Docs](https://docs.microsoft.com/azure/aks/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Need Help?**

1. Check `PRODUCTION_READINESS_REPORT.md` for detailed architecture
2. Review application logs: `docker-compose logs api`
3. Test health endpoints: `curl http://localhost:8000/health`
4. Check Azure portal: Check resource group for errors
