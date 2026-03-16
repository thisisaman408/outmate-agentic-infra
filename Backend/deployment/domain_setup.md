# Domain Configuration for Outmate.ai

## Overview

Outmate.ai uses the following domain structure:

- **Landing site**: https://outmate.ai (existing, do not modify)
- **SaaS app**: https://app.outmate.ai
- **Backend API**: https://api.outmate.ai
- **Development**: https://dev.outmate.ai

## DNS Configuration (Hostinger)

### Step 1: Access Hostinger DNS Management
1. Log into Hostinger control panel
2. Go to Domain → DNS Zone
3. Select the `outmate.ai` domain

### Step 2: Add CNAME Records

Add the following CNAME records:

```
Type: CNAME
Name: app
Target: [Azure Static Web App URL]
TTL: 3600

Type: CNAME
Name: api
Target: [Azure Container App FQDN]
TTL: 3600

Type: CNAME
Name: dev
Target: [Development Static Web App URL]
TTL: 3600
```

### Step 3: Get Azure URLs

**Static Web App URL** (for app.outmate.ai):
```bash
az staticwebapp show --name outmate-web --resource-group outmate-prod --query defaultHostname -o tsv
```

**Container App FQDN** (for api.outmate.ai):
```bash
az containerapp show --name outmate-api --resource-group outmate-prod --query properties.configuration.ingress.fqdn -o tsv
```

### Step 4: Verify DNS Propagation

After adding records, verify with:
```bash
nslookup app.outmate.ai
nslookup api.outmate.ai
```

## Azure Custom Domain Setup

### Static Web App (app.outmate.ai)
```bash
az staticwebapp hostname set \
  --name outmate-web \
  --resource-group outmate-prod \
  --domain app.outmate.ai
```

### Container App (api.outmate.ai)
```bash
az containerapp hostname set \
  --name outmate-api \
  --resource-group outmate-prod \
  --hostname api.outmate.ai
```

## SSL Certificates

Azure automatically provisions SSL certificates for custom domains. No additional configuration needed.

## Important Notes

- **Do not modify the root domain** `outmate.ai` - it points to the existing landing site
- DNS propagation can take 24-48 hours
- Ensure Azure resources are created before setting up custom domains
- Test all endpoints after DNS propagation completes
