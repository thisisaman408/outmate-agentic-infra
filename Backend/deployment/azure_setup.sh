#!/bin/bash

# Azure Setup Script for Outmate.ai Production Deployment
# This script creates all necessary Azure resources for lean deployment

set -e

# Configuration
RESOURCE_GROUP="outmate-prod"
LOCATION="eastus"
ACR_NAME="outmateregistry"
CONTAINER_APP_ENV="outmate-env"
CONTAINER_APP_NAME="outmate-api"
STATIC_WEB_APP_NAME="outmate-web"
IMAGE_NAME="outmate-api"

echo "🚀 Setting up Azure resources for Outmate.ai..."

# Create resource group
echo "📁 Creating resource group: $RESOURCE_GROUP"
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
echo "🐳 Creating Azure Container Registry: $ACR_NAME"
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Create Container Apps environment
echo "🌐 Creating Container Apps environment: $CONTAINER_APP_ENV"
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Build and push Docker image
echo "🏗️ Building and pushing Docker image..."
./build_and_push.sh

# Deploy Container App
echo "🚀 Deploying Container App: $CONTAINER_APP_NAME"
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:latest \
  --target-port 8000 \
  --ingress external \
  --cpu 0.5 \
  --memory 1.0Gi \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-scale \
  --scale-rule-http-concurrency 10 \
  --env-vars \
    ENVIRONMENT=production \
    LOG_LEVEL=WARNING \
  --secrets \
    database-url="DATABASE_URL_PLACEHOLDER" \
    redis-url="REDIS_URL_PLACEHOLDER" \
    jwt-secret="JWT_SECRET_PLACEHOLDER" \
    crustdata-api-key="CRUSTDATA_API_KEY_PLACEHOLDER" \
    explorium-api-key="EXPLORIUM_API_KEY_PLACEHOLDER" \
    contactout-api-key="CONTACTOUT_API_KEY_PLACEHOLDER" \
    openrouter-api-key="OPENROUTER_API_KEY_PLACEHOLDER" \
    serper-api-key="SERPER_API_KEY_PLACEHOLDER" \
    tavily-api-key="TAVILY_API_KEY_PLACEHOLDER" \
    ipinfo-token="IPINFO_TOKEN_PLACEHOLDER"

# Create Static Web App for Frontend
echo "🌐 Creating Static Web App: $STATIC_WEB_APP_NAME"
az staticwebapp create \
  --name $STATIC_WEB_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --source https://github.com/YOUR_USERNAME/outmate \
  --branch outmate \
  --app-location "Frontend" \
  --output-location ".next" \
  --login-with-github

echo "✅ Azure setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update secrets in Azure Container App with real values"
echo "2. Configure custom domains in Azure Static Web App"
echo "3. Set up DNS records as per deployment/domain_setup.md"
echo "4. Test the deployment"