#!/bin/bash

# Build and Push Docker Image Script
# Run this from the project root directory
# IMPORTANT: Build for linux/amd64 platform for Azure Container Apps compatibility

set -e

ACR_NAME="outmateregistry"
IMAGE_NAME="outmate-api"
RESOURCE_GROUP="outmate-prod"
PLATFORM="linux/amd64"

echo "🏗️ Building Docker image for platform: $PLATFORM..."
cd Backend
docker build --platform $PLATFORM -t $IMAGE_NAME:latest .

echo "🔐 Logging into Azure Container Registry..."
az acr login --name $ACR_NAME

echo "📤 Tagging and pushing image..."
docker tag $IMAGE_NAME:latest $ACR_NAME.azurecr.io/$IMAGE_NAME:latest
docker push $ACR_NAME.azurecr.io/$IMAGE_NAME:latest

echo "✅ Image pushed successfully!"
echo "Image: $ACR_NAME.azurecr.io/$IMAGE_NAME:latest"
