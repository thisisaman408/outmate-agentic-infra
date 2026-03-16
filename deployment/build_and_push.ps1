# ============================================================================
# Build and Push Docker Image Script for Windows (PowerShell)
# ============================================================================
# Run this from the project root directory
# IMPORTANT: Build for linux/amd64 platform for Azure Container Apps compatibility
#
# Usage:
#   .\deployment\build_and_push.ps1
#
# Prerequisites:
#   - Docker Desktop installed and running
#   - Azure CLI installed (az)
#   - Logged into Azure (az login)
# ============================================================================

$ErrorActionPreference = "Stop"

$ACR_NAME = "outmateregistry"
$IMAGE_NAME = "outmate-api"
$RESOURCE_GROUP = "outmate-prod"
$PLATFORM = "linux/amd64"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building and Pushing Docker Image" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
$dockerStatus = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "Docker is running" -ForegroundColor Green

# Check if Azure CLI is installed
Write-Host "Checking Azure CLI..." -ForegroundColor Yellow
$azVersion = az --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Azure CLI is not installed." -ForegroundColor Red
    exit 1
}
Write-Host "Azure CLI is installed" -ForegroundColor Green

# Build Docker image with explicit platform
Write-Host ""
Write-Host "Building Docker image for platform: $PLATFORM" -ForegroundColor Yellow

# Change to Backend directory where Dockerfile is located
$backendPath = Join-Path $PSScriptRoot "..\Backend"
if (-not (Test-Path (Join-Path $backendPath "Dockerfile"))) {
    $backendPath = Join-Path $PSScriptRoot "Backend"
}
if (-not (Test-Path (Join-Path $backendPath "Dockerfile"))) {
    $backendPath = "Backend"
}

Write-Host "Building from: $backendPath" -ForegroundColor Cyan

Push-Location $backendPath
try {
    docker build --platform $PLATFORM -t $IMAGE_NAME:latest .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "Docker image built successfully" -ForegroundColor Green
} finally {
    Pop-Location
}

# Login to Azure Container Registry
Write-Host ""
Write-Host "Logging into Azure Container Registry..." -ForegroundColor Yellow
az acr login --name $ACR_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Azure login failed." -ForegroundColor Red
    exit 1
}
Write-Host "Login succeeded" -ForegroundColor Green

# Tag and push image
Write-Host ""
Write-Host "Tagging and pushing image..." -ForegroundColor Yellow

$fullImageName = "$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"
docker tag $IMAGE_NAME:latest $fullImageName

docker push $fullImageName
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker push failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Image pushed successfully!" -ForegroundColor Green
Write-Host "Image: $fullImageName" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green

