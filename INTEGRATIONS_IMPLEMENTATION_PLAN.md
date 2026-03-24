# Outmate.Ai — Integrations Implementation Plan (Cost-Optimized)

---

## What We Already Have (From .env — Already Paying For)

| Service | Key | What It Does | Cost |
|---------|-----|-------------|------|
| **Explorium** | `EXPLORIUM_API_KEY` | Business search, enrichment, firmographics, technographics, intent, events | Per-query credits |
| **Crustdata** | `CRUSTDATA_API_KEY` | Company/prospect search, LinkedIn posts, enrichment | Per-query credits |
| **ContactOut** | `CONTACTOUT_API_KEY` | Email/phone reveal, decision makers, company enrichment | Per-query credits |
| **BetterContact** | `BETTERCONTACT_API_KEY` | Waterfall email/phone verification | Per-query credits |
| **Enrich.so** | `ENRICH_API_KEY` | LinkedIn profile enrichment | Per-query credits |
| **OpenRouter** | `OPENROUTER_API_KEY` | LLM access (Claude, GPT, etc.) | Per-token |
| **Gemini** | `GEMINI_API_KEY` | Google AI (free tier generous) | Free tier / per-token |
| **Perplexity** | `PERPLEXITY_API_KEY` | AI-powered web research | Per-query |
| **Tavily** | `TAVILY_API_KEY` | Web search API | Free 1000/mo |
| **Serper** | `SERPER_API_KEY` | Google SERP results | Free 2500/mo |
| **SEC API** | `SEC_API_KEY` | SEC filings data | Free/cheap |
| **Brightdata** | `BRIGHTDATA_API_TOKEN` | Web scraping at scale | Per-request |
| **Contextual AI** | `CONTEXTUAL_AI_API_KEY` | Contextual intelligence | Per-query |
| **IPinfo** | `IPINFO_TOKEN` | IP geolocation for visitors | Free 50k/mo |
| **Unipile** | `UNIPILE_API_KEY` | LinkedIn messaging + Email access | Monthly subscription |
| **Google OAuth** | `GOOGLE_CLIENT_ID/SECRET` | Gmail send/read (already built!) | Free |
| **Supabase** | `DATABASE_URL` | PostgreSQL database | Free tier / $25/mo |
| **Upstash Redis** | `REDIS_URL` | Caching, Celery broker | Free tier / $10/mo |

**Already partially built:** Gmail OAuth + sending, Unipile LinkedIn messaging, Slack webhook notifications from watchers, campaign draft generation via LLM.

---

## The Core Question: How to Reach 100+ Integrations Cheaply

### What Explorium/Crustdata/ContactOut CAN'T Do
These are **data providers only**. They enrich prospect/company data. They CANNOT:
- Sync with Salesforce/HubSpot CRM
- Send emails via Outlook/Gmail
- Post to Slack/Teams channels
- Export to Google Sheets
- Trigger Zapier workflows
- Connect to any third-party SaaS tool bidirectionally

### The Cost-Smart Strategy

Instead of paying for Merge.dev ($500+/mo) or Nango Cloud ($300+/mo), we use:

| Approach | Cost | Integrations It Gives Us |
|----------|------|-------------------------|
| **Zapier/Make webhook triggers+actions** | Free (users pay their own Zapier) | "5000+ apps" via ecosystem |
| **Generic Webhooks (we build)** | $0 — just code | Unlimited |
| **Public REST API (we build)** | $0 — just code | Unlimited |
| **Google APIs (OAuth already set up)** | Free | Gmail, Sheets, Calendar, Drive |
| **Microsoft Graph (free OAuth)** | Free | Outlook, Teams, Calendar, OneDrive |
| **Slack API (free bot)** | Free | Slack notifications, commands |
| **Native connectors for key tools** | Free (just API calls) | 20-30 core tools |
| **Wrap existing providers as "integrations"** | $0 — already paid | 15+ data integrations |
| **Nango OSS (self-hosted OAuth manager)** | Free | OAuth for 250+ services |

**Total cost for 100+ integrations: Nearly $0 extra beyond what we already pay.**

---

## Complete Integration List: 107 Integrations in 11 Categories

### Category 1: Data Enrichment Providers (15 integrations) — MOSTLY DONE

These are "bring your own API key" integrations. Users connect their accounts.

| # | Integration | Status | How |
|---|------------|--------|-----|
| 1 | Explorium | **Already built** | Existing service |
| 2 | Crustdata | **Already built** | Existing service |
| 3 | ContactOut | **Already built** | Existing service |
| 4 | BetterContact | **Already built** | Existing service |
| 5 | Enrich.so | **Key exists** | Wrap existing |
| 6 | Brightdata | **Key exists** | Wrap existing |
| 7 | IPinfo | **Key exists** | Wrap existing |
| 8 | Apollo.io | Build | REST API (free tier) |
| 9 | Hunter.io | Build | REST API (free 25/mo) |
| 10 | Clearbit/Breeze | Build | REST API |
| 11 | Snov.io | Build | REST API (free tier) |
| 12 | RocketReach | Build | REST API |
| 13 | Lusha | Build | REST API |
| 14 | Kaspr | Build | REST API |
| 15 | BuiltWith | Build | REST API |

**Cost: $0 extra** — Users bring their own API keys. We just build connectors.

### Category 2: CRM (12 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 16 | Salesforce | P0 | OAuth2 + REST API | Free (standard API) |
| 17 | HubSpot | P0 | OAuth2 + REST API | Free (public app) |
| 18 | Pipedrive | P1 | OAuth2 + REST API | Free |
| 19 | Zoho CRM | P1 | OAuth2 + REST API | Free |
| 20 | Freshsales | P2 | API Key + REST | Free |
| 21 | Close.com | P2 | API Key + REST | Free |
| 22 | Copper CRM | P2 | API Key + REST | Free |
| 23 | Monday CRM | P2 | OAuth2 + REST | Free |
| 24 | Attio | P2 | API Key + REST | Free |
| 25 | Microsoft Dynamics | P2 | OAuth2 + MS Graph | Free |
| 26 | Streak | P3 | OAuth2 + REST | Free |
| 27 | Folk CRM | P3 | API Key + REST | Free |

**Cost: $0** — All CRM APIs are free to use. We just make API calls on behalf of users.

### Category 3: Email Sending & Outreach (14 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 28 | Gmail | **Partially built** | Google OAuth (done!) | Free |
| 29 | Outlook/O365 | P0 | MS Graph OAuth | Free |
| 30 | Generic SMTP | P0 | SMTP config | Free |
| 31 | Instantly | P0 | REST API | Free |
| 32 | Lemlist | P1 | REST API | Free |
| 33 | Smartlead | P1 | REST API | Free |
| 34 | Woodpecker | P2 | REST API | Free |
| 35 | Reply.io | P2 | REST API | Free |
| 36 | Mailshake | P2 | REST API | Free |
| 37 | Salesloft | P1 | OAuth2 + REST | Free |
| 38 | Outreach.io | P1 | OAuth2 + REST | Free |
| 39 | SendGrid | P1 | API Key | Free tier |
| 40 | Mailchimp | P2 | OAuth2 + REST | Free |
| 41 | Mixmax | P3 | OAuth2 + REST | Free |

### Category 4: Communication & Messaging (10 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 42 | Slack | P0 | OAuth2 Bot (**webhook already built**) | Free |
| 43 | Microsoft Teams | P1 | MS Graph OAuth | Free |
| 44 | LinkedIn DM | **Partially built** | Via Unipile (already paid) | $0 extra |
| 45 | Twilio SMS | P1 | API Key | Users pay Twilio |
| 46 | WhatsApp Business | P2 | Meta Cloud API | Users pay Meta |
| 47 | Discord | P2 | Bot OAuth | Free |
| 48 | Intercom | P2 | OAuth2 + REST | Free |
| 49 | Drift | P3 | OAuth2 + REST | Free |
| 50 | Aircall | P3 | OAuth2 + REST | Free |
| 51 | RingCentral | P3 | OAuth2 + REST | Free |

### Category 5: Social Media & LinkedIn (8 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 52 | LinkedIn (via Unipile) | **Built** | Already have Unipile | $0 extra |
| 53 | LinkedIn Sales Nav | P1 | Extend Unipile | $0 extra |
| 54 | Twitter/X | P2 | OAuth2 + API v2 | Free (basic) |
| 55 | Facebook Business | P2 | Meta Graph API | Free |
| 56 | Instagram Business | P3 | Meta Graph API | Free |
| 57 | PhantomBuster | P2 | API Key + REST | Users pay |
| 58 | Dripify | P3 | API Key + REST | Users pay |
| 59 | Expandi | P3 | API Key + REST | Users pay |

### Category 6: Workflow Automation (8 integrations) — HIGHEST ROI

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 60 | **Zapier** | **P0** | Webhook triggers + actions | Free |
| 61 | **Make (Integromat)** | **P0** | Webhook triggers + actions | Free |
| 62 | **n8n** | P1 | Webhook triggers + actions | Free |
| 63 | **Generic Webhooks** | **P0** | Build inbound/outbound | Free |
| 64 | **Public REST API** | **P0** | API key auth | Free |
| 65 | Power Automate | P2 | Webhook triggers | Free |
| 66 | Tray.io | P3 | Webhook triggers | Free |
| 67 | Workato | P3 | Webhook triggers | Free |

**Why highest ROI:** Building Zapier + Make + Webhooks + API = users can connect to **7000+ apps**. We build it once, it works forever. Marketing can say "integrates with 7000+ tools."

### Category 7: Calendar & Meetings (6 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 68 | Google Calendar | P1 | Google OAuth (reuse Gmail!) | Free |
| 69 | Outlook Calendar | P1 | MS Graph (reuse Outlook!) | Free |
| 70 | Calendly | P1 | OAuth2 + REST | Free |
| 71 | Cal.com | P2 | API Key + REST | Free |
| 72 | Zoom | P2 | OAuth2 + REST | Free |
| 73 | Google Meet | P2 | Google API (reuse!) | Free |

### Category 8: Productivity & Storage (10 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 74 | Google Sheets | P0 | Google OAuth (reuse!) | Free |
| 75 | Airtable | P1 | API Key + REST | Free |
| 76 | Notion | P1 | OAuth2 + REST | Free |
| 77 | Google Drive | P2 | Google OAuth (reuse!) | Free |
| 78 | Dropbox | P3 | OAuth2 + REST | Free |
| 79 | OneDrive | P2 | MS Graph (reuse!) | Free |
| 80 | Jira | P2 | OAuth2 + REST | Free |
| 81 | Trello | P3 | API Key + REST | Free |
| 82 | Asana | P3 | OAuth2 + REST | Free |
| 83 | ClickUp | P3 | API Key + REST | Free |

### Category 9: Analytics & Tracking (8 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 84 | Segment | P1 | API Key (track calls) | Free tier |
| 85 | Google Analytics | P2 | Google OAuth (reuse!) | Free |
| 86 | Mixpanel | P2 | API Key | Free tier |
| 87 | PostHog | P2 | API Key | Free (self-host or cloud) |
| 88 | Amplitude | P3 | API Key | Free tier |
| 89 | Heap | P3 | API Key | Free tier |
| 90 | Hotjar | P3 | API Key | Free tier |
| 91 | Google Tag Manager | P3 | Google API | Free |

### Category 10: Advertising & ABM (10 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 92 | Google Ads | P2 | OAuth2 + Ads API | Free |
| 93 | LinkedIn Ads | P2 | OAuth2 + Marketing API | Free |
| 94 | Meta/Facebook Ads | P2 | OAuth2 + Marketing API | Free |
| 95 | Twitter/X Ads | P3 | OAuth2 + Ads API | Free |
| 96 | RollWorks | P3 | API Key + REST | Free |
| 97 | Demandbase | P3 | API Key + REST | Free |
| 98 | 6sense | P3 | API Key + REST | Free |
| 99 | Bombora | P3 | API Key + REST | Free |
| 100 | Terminus | P3 | API Key + REST | Free |
| 101 | Metadata.io | P3 | API Key + REST | Free |

### Category 11: Customer Success & Support (6 integrations)

| # | Integration | Priority | How | Cost |
|---|------------|----------|-----|------|
| 102 | Zendesk | P2 | OAuth2 + REST | Free |
| 103 | Freshdesk | P3 | API Key + REST | Free |
| 104 | Gong | P2 | OAuth2 + REST | Free |
| 105 | Chorus.ai | P3 | OAuth2 + REST | Free |
| 106 | Gainsight | P3 | API Key + REST | Free |
| 107 | ChurnZero | P3 | API Key + REST | Free |

---

## Backend Architecture: What to Build

### Database Schema (New Tables)

```sql
-- 1. Master catalog of all integrations
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,         -- "salesforce", "hubspot"
    name VARCHAR(255) NOT NULL,                -- "Salesforce"
    description TEXT,
    short_description VARCHAR(500),
    category VARCHAR(50) NOT NULL,             -- "crm", "email", "enrichment"
    icon_url VARCHAR(500),                     -- "/icons/salesforce.svg"
    auth_type VARCHAR(50) NOT NULL,            -- "oauth2", "api_key", "webhook", "smtp", "none"
    auth_config JSONB DEFAULT '{}',            -- OAuth URLs, scopes, redirect paths
    is_active BOOLEAN DEFAULT true,
    is_coming_soon BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    supported_actions JSONB DEFAULT '[]',      -- ["push_contacts","pull_deals","send_email"]
    supported_triggers JSONB DEFAULT '[]',     -- ["new_deal","contact_updated"]
    default_field_mappings JSONB DEFAULT '{}', -- sensible defaults per entity
    documentation_url VARCHAR(500),
    rate_limit_per_minute INT DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Per-user connected integrations
CREATE TABLE user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES integrations(id),
    status VARCHAR(20) DEFAULT 'connected',    -- connected, disconnected, error, expired
    credentials_encrypted TEXT,                 -- AES-256-GCM encrypted JSON blob
    config JSONB DEFAULT '{}',                 -- sync frequency, custom settings
    metadata JSONB DEFAULT '{}',               -- instance_url, workspace_name, etc.
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ,
    token_expires_at TIMESTAMPTZ,              -- for OAuth token refresh scheduling
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, integration_id)
);

-- 3. Field mappings (Outmate field <-> External field)
CREATE TABLE integration_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    outmate_entity VARCHAR(50) NOT NULL,       -- "prospect", "company"
    outmate_field VARCHAR(100) NOT NULL,       -- "email", "company_name"
    external_entity VARCHAR(100) NOT NULL,     -- "Contact", "Account"
    external_field VARCHAR(100) NOT NULL,      -- "Email", "Name"
    direction VARCHAR(10) DEFAULT 'both',      -- "push", "pull", "both"
    transform JSONB,                           -- optional transform rules
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sync audit log
CREATE TABLE integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    sync_type VARCHAR(20) NOT NULL,            -- "push", "pull", "webhook", "full_sync"
    entity_type VARCHAR(50),
    records_total INT DEFAULT 0,
    records_succeeded INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    status VARCHAR(20) NOT NULL,               -- "running", "completed", "failed", "partial"
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT
);

-- 5. Webhook subscriptions (inbound + outbound)
CREATE TABLE integration_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_integration_id UUID REFERENCES user_integrations(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,            -- "inbound" or "outbound"
    event_type VARCHAR(100) NOT NULL,          -- "prospect.created", "deal.won"
    webhook_url VARCHAR(500),                  -- for outbound: where to POST
    webhook_secret VARCHAR(255),               -- HMAC signing secret
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    failure_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. API keys for public REST API
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(64) NOT NULL,             -- SHA-256 hash of the key
    key_prefix VARCHAR(10) NOT NULL,           -- "outm_" + first 6 chars (for display)
    name VARCHAR(255),                         -- "My Zapier Key"
    scopes JSONB DEFAULT '["read","write"]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Backend File Structure (New Files)

```
Backend/app/
│
├── api/routes/
│   ├── integrations.py                  # NEW — all /api/v1/integrations/* routes
│   └── webhooks.py                      # NEW — /api/v1/webhooks/* routes
│
├── db/models/
│   ├── integration.py                   # NEW — Integration + UserIntegration models
│   ├── integration_sync_log.py          # NEW — SyncLog model
│   ├── integration_webhook.py           # NEW — Webhook model
│   └── api_key.py                       # NEW — API key model
│
├── services/
│   ├── integration_engine/              # NEW — Core integration framework
│   │   ├── __init__.py
│   │   ├── registry.py                  # Loads all connectors, returns catalog
│   │   ├── auth_manager.py              # OAuth2 flows + API key validation
│   │   ├── credential_vault.py          # AES-256-GCM encrypt/decrypt credentials
│   │   ├── sync_engine.py               # Push/pull data between Outmate <-> external
│   │   ├── webhook_engine.py            # Fire outbound webhooks, receive inbound
│   │   ├── field_mapper.py              # Map + transform fields between systems
│   │   └── token_refresher.py           # Celery beat task to refresh OAuth tokens
│   │
│   ├── connectors/                      # NEW — One file per integration
│   │   ├── base.py                      # BaseConnector abstract class
│   │   ├── crm/
│   │   │   ├── salesforce.py
│   │   │   ├── hubspot.py
│   │   │   ├── pipedrive.py
│   │   │   └── ... (10 more, same pattern)
│   │   ├── email/
│   │   │   ├── gmail.py                 # Wraps existing gmail_service.py
│   │   │   ├── outlook.py
│   │   │   ├── smtp_generic.py
│   │   │   ├── instantly.py
│   │   │   └── ... (10 more)
│   │   ├── communication/
│   │   │   ├── slack.py
│   │   │   ├── teams.py
│   │   │   └── ... (8 more)
│   │   ├── enrichment/
│   │   │   ├── explorium_connector.py   # Wraps existing explorium_service.py
│   │   │   ├── crustdata_connector.py   # Wraps existing crustdata_service.py
│   │   │   ├── contactout_connector.py  # Wraps existing contactout_service.py
│   │   │   ├── bettercontact_conn.py    # Wraps existing bettercontact_service.py
│   │   │   └── ... (10 more)
│   │   ├── automation/
│   │   │   ├── zapier.py                # Trigger definitions + action handlers
│   │   │   ├── make.py
│   │   │   └── webhooks_generic.py
│   │   ├── productivity/
│   │   │   ├── google_sheets.py
│   │   │   ├── airtable.py
│   │   │   ├── notion.py
│   │   │   └── ... (7 more)
│   │   ├── social/
│   │   │   ├── linkedin.py              # Wraps existing unipile_service.py
│   │   │   └── twitter.py
│   │   ├── calendar/
│   │   │   ├── google_calendar.py
│   │   │   ├── outlook_calendar.py
│   │   │   └── calendly.py
│   │   ├── analytics/
│   │   │   ├── segment.py
│   │   │   └── ... (7 more)
│   │   ├── ads/
│   │   │   └── ... (10 connectors)
│   │   └── support/
│   │       └── ... (6 connectors)
│   │
│   ├── gmail_service.py                 # KEEP — existing (wrap in connector)
│   ├── unipile_service.py               # KEEP — existing (wrap in connector)
│   ├── explorium_service.py             # KEEP — existing (wrap in connector)
│   ├── crustdata_service.py             # KEEP — existing (wrap in connector)
│   ├── contactout_service.py            # KEEP — existing (wrap in connector)
│   └── bettercontact_service.py         # KEEP — existing (wrap in connector)
```

### BaseConnector Interface

```python
# Backend/app/services/connectors/base.py

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from enum import Enum

class AuthType(str, Enum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    WEBHOOK = "webhook"
    SMTP = "smtp"
    NONE = "none"        # For existing providers using our global keys

class BaseConnector(ABC):
    """Every integration connector implements this."""

    # Metadata — override in subclass
    slug: str = ""
    name: str = ""
    category: str = ""
    auth_type: AuthType = AuthType.API_KEY
    supported_entities: List[str] = []   # ["prospect", "company", "deal"]

    @abstractmethod
    async def validate_credentials(self, credentials: dict) -> bool:
        """Test if the provided credentials work."""
        pass

    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """Return OAuth authorization URL. Override for OAuth integrations."""
        raise NotImplementedError("This integration doesn't use OAuth")

    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> dict:
        """Exchange OAuth code for tokens. Override for OAuth integrations."""
        raise NotImplementedError("This integration doesn't use OAuth")

    async def refresh_token(self, credentials: dict) -> dict:
        """Refresh expired OAuth token. Override for OAuth integrations."""
        raise NotImplementedError("This integration doesn't use OAuth")

    async def push_records(self, credentials: dict, entity: str,
                           records: List[dict], field_mapping: dict) -> dict:
        """Push records FROM Outmate TO external tool."""
        raise NotImplementedError(f"{self.name} doesn't support push")

    async def pull_records(self, credentials: dict, entity: str,
                           filters: dict, field_mapping: dict) -> List[dict]:
        """Pull records FROM external tool INTO Outmate."""
        raise NotImplementedError(f"{self.name} doesn't support pull")

    async def handle_webhook(self, payload: dict, headers: dict) -> dict:
        """Process incoming webhook from this integration."""
        raise NotImplementedError(f"{self.name} doesn't support webhooks")

    def get_default_field_mappings(self) -> dict:
        """Sensible default field mappings per entity."""
        return {}

    def get_config_schema(self) -> dict:
        """JSON Schema for user-facing configuration options."""
        return {}
```

### API Routes

```
GET    /api/v1/integrations                        → List all integrations (with user status)
GET    /api/v1/integrations/:slug                   → Get integration details
POST   /api/v1/integrations/:slug/connect           → Connect (API key or start OAuth)
GET    /api/v1/integrations/:slug/oauth/callback     → OAuth callback handler
DELETE /api/v1/integrations/:slug/disconnect         → Disconnect
GET    /api/v1/integrations/:slug/status             → Health check
PUT    /api/v1/integrations/:slug/config             → Update config/field mappings
POST   /api/v1/integrations/:slug/sync               → Trigger manual sync
GET    /api/v1/integrations/:slug/sync-history        → View sync logs
POST   /api/v1/integrations/:slug/test               → Test connection

POST   /api/v1/webhooks/outbound                    → Register outbound webhook
GET    /api/v1/webhooks/outbound                    → List registered webhooks
DELETE /api/v1/webhooks/outbound/:id                → Remove webhook
POST   /api/v1/webhooks/inbound/:slug               → Receive inbound webhook

POST   /api/v1/api-keys                            → Create API key
GET    /api/v1/api-keys                            → List API keys
DELETE /api/v1/api-keys/:id                        → Revoke API key
```

### Credential Encryption (Using What We Have)

No extra cost. Use Python `cryptography` library (free) with a master key from env:

```python
# Backend/app/services/integration_engine/credential_vault.py

from cryptography.fernet import Fernet
import json, os

# Add to .env: CREDENTIAL_ENCRYPTION_KEY=<Fernet.generate_key()>
ENCRYPTION_KEY = os.getenv("CREDENTIAL_ENCRYPTION_KEY")
fernet = Fernet(ENCRYPTION_KEY)

def encrypt_credentials(creds: dict) -> str:
    return fernet.encrypt(json.dumps(creds).encode()).decode()

def decrypt_credentials(encrypted: str) -> dict:
    return json.loads(fernet.decrypt(encrypted.encode()).decode())
```

---

## Frontend: What to Build

### Updated File Structure

```
Frontend/
├── app/(dashboard)/integrations/
│   ├── page.tsx                         # UPDATE — real API, 11 categories, search
│   ├── [slug]/
│   │   └── page.tsx                     # NEW — integration detail + config
│   └── marketplace/
│       └── page.tsx                     # NEW — browse all 107, filterable grid
│
├── components/integrations/
│   ├── integration-card.tsx             # UPDATE — add "coming soon", premium badge
│   ├── integration-detail-panel.tsx     # NEW — side panel with config
│   ├── field-mapping-editor.tsx         # NEW — map Outmate fields to external
│   ├── oauth-connect-button.tsx         # NEW — "Connect with Salesforce" button
│   ├── api-key-input.tsx               # NEW — secure key input + validate
│   ├── sync-status-badge.tsx           # NEW — real-time sync status
│   ├── sync-history-table.tsx          # NEW — sync log viewer
│   ├── webhook-config-panel.tsx        # NEW — manage webhook URLs
│   ├── api-key-manager.tsx             # NEW — create/revoke API keys
│   └── category-filter-bar.tsx         # NEW — filter by 11 categories
│
├── lib/api/
│   └── integrations.ts                 # UPDATE — replace mocks with real API
```

### Key UI Flows

**Flow A: API Key Integration (e.g., Instantly, Airtable)**
```
User clicks "Connect" → Modal asks for API key →
POST /integrations/instantly/connect {api_key: "..."} →
Backend validates key → Stores encrypted → Shows "Connected ✓"
```

**Flow B: OAuth Integration (e.g., Salesforce, HubSpot)**
```
User clicks "Connect with Salesforce" →
GET /integrations/salesforce/connect → Returns OAuth URL →
Redirect to Salesforce login → User authorizes →
Redirect back to /integrations/salesforce/oauth/callback →
Backend exchanges code for tokens → Stores encrypted → Redirects to UI → "Connected ✓"
```

**Flow C: Webhook/Automation (e.g., Zapier)**
```
User goes to Webhooks section → Sees unique webhook URL per event →
Copies URL into Zapier trigger → Outmate fires POST to URL on events →
Also: Zapier can POST to our inbound webhook URL to create/update records
```

**Flow D: Data Enrichment (e.g., Explorium — already connected)**
```
Shows as "Built-in" → Always connected → Config allows enable/disable per workflow →
Users can also add their own keys for Apollo, Hunter, etc.
```

---

## Step-by-Step Implementation: 5 Phases

### Phase 1: Foundation (Week 1-3) — $0 Cost

**Week 1: Database + Models + Core Engine**

Step 1.1 — Create Alembic migration for all 6 new tables
```bash
cd Backend
alembic revision --autogenerate -m "add_integration_tables"
alembic upgrade head
```

Step 1.2 — Create SQLAlchemy models:
- `app/db/models/integration.py` → Integration + UserIntegration
- `app/db/models/integration_sync_log.py` → SyncLog
- `app/db/models/integration_webhook.py` → Webhook
- `app/db/models/api_key.py` → ApiKey

Step 1.3 — Build core engine:
- `app/services/integration_engine/credential_vault.py` → encrypt/decrypt
- `app/services/integration_engine/registry.py` → auto-discover connectors from `connectors/` folder
- `app/services/connectors/base.py` → BaseConnector abstract class

Step 1.4 — Seed integration catalog:
- Write a seed script that inserts all 107 integration rows into `integrations` table
- For unbuilt ones: `is_coming_soon = true`
- For existing ones: `is_active = true`
- Store icon SVGs in `Frontend/public/icons/integrations/`

**Week 2: Auth Manager + API Routes**

Step 2.1 — Build `auth_manager.py`:
- Generic OAuth2 authorization code flow (works for any provider)
- API key validation (call `connector.validate_credentials()`)
- Token storage via `credential_vault`
- Token refresh scheduling (register with Celery beat)

Step 2.2 — Build `app/api/routes/integrations.py`:
- All routes listed above
- Auth-protected (reuse existing JWT auth dependency)
- Returns integration list with per-user status from `user_integrations` table

Step 2.3 — Build `app/api/routes/webhooks.py`:
- Outbound webhook registration (user picks events, provides URL)
- Inbound webhook receiver (with HMAC signature verification)

**Week 3: Webhook Engine + Sync Engine + Token Refresher**

Step 3.1 — Build `webhook_engine.py`:
- `fire_webhook(event_type, payload, user_id)` → finds all registered webhooks for this event → POSTs payload with HMAC signature
- Events to support: `prospect.created`, `prospect.updated`, `prospect.enriched`, `company.created`, `company.updated`, `deal.created`, `deal.updated`, `campaign.sent`, `campaign.replied`

Step 3.2 — Build `sync_engine.py`:
- `sync_push(user_integration_id, entity, records)` → calls `connector.push_records()`
- `sync_pull(user_integration_id, entity, filters)` → calls `connector.pull_records()`
- Logs everything to `integration_sync_logs`
- Runs as Celery tasks for async processing

Step 3.3 — Build `token_refresher.py`:
- Celery beat task (every 15 min)
- Queries `user_integrations` where `token_expires_at < now() + 30 minutes`
- Calls `connector.refresh_token()` for each
- Updates encrypted credentials
- Marks status = "error" if refresh fails 3 times

Step 3.4 — Build `field_mapper.py`:
- Takes Outmate record + field mapping config → transforms to external format
- Handles: field rename, type conversion, value mapping
- Reversible (for pull operations)

---

### Phase 2: Wrap Existing + Webhooks + API (Week 4-5) — $0 Cost

**Week 4: Wrap all existing services as connectors**

Step 4.1 — Create wrapper connectors (no code changes to existing services):
- `connectors/enrichment/explorium_connector.py` → imports and delegates to `explorium_service.py`
- `connectors/enrichment/crustdata_connector.py` → imports and delegates to `crustdata_service.py`
- `connectors/enrichment/contactout_connector.py` → delegates to `contactout_service.py`
- `connectors/enrichment/bettercontact_connector.py` → delegates to `bettercontact_service.py`
- `connectors/enrichment/enrich_connector.py` → wraps Enrich.so API (key already in .env)
- `connectors/email/gmail_connector.py` → wraps existing `gmail_service.py`
- `connectors/social/linkedin_connector.py` → wraps existing `unipile_service.py`

Step 4.2 — These show as "Built-in" integrations in the UI (always connected via platform keys)

Step 4.3 — Also allow users to add their OWN keys for these providers (for higher rate limits or separate billing)

**Week 5: Generic Webhooks + Public REST API**

Step 5.1 — Generic Outbound Webhooks:
- User configures: event type + destination URL + optional secret
- On any Outmate event → `webhook_engine.fire_webhook()` → POST with HMAC-SHA256 signature in `X-Outmate-Signature` header
- Retry: 3 attempts with exponential backoff (1s, 5s, 30s)
- Auto-disable after 10 consecutive failures

Step 5.2 — Generic Inbound Webhooks:
- Each user gets a unique inbound URL: `POST /api/v1/webhooks/inbound/{user_webhook_id}`
- Accepts JSON payload → creates/updates prospects or companies
- Validates HMAC signature if secret is configured

Step 5.3 — Public REST API:
- API key management (create, list, revoke)
- Key format: `outm_` + 32 random chars
- Store SHA-256 hash in DB (never store raw key)
- Rate limit: 100 req/min per key
- Endpoints mirror internal API: prospects, companies, campaigns
- Swagger docs auto-generated from FastAPI

Step 5.4 — Zapier/Make "integration":
- Not a Zapier app (that requires Zapier partner approval — do later)
- Instead: document how users use our webhooks + API with Zapier
- Provide pre-built Zapier templates (just URL configs)
- This is how Clay, Instantly, and others started

**Integrations live after Phase 2:**
- 7 built-in data providers (Explorium, Crustdata, ContactOut, BetterContact, Enrich, Gmail, LinkedIn)
- Generic Webhooks (unlimited connections)
- Public REST API (unlimited connections)
- Zapier/Make/n8n via webhooks
- **Marketable as: "10+ native integrations + connect to 7000+ apps via Zapier/webhooks"**

---

### Phase 3: Core Native Integrations — P0 (Week 6-9) — $0 Cost

**Week 6: Salesforce + HubSpot (The Must-Haves)**

Step 6.1 — Salesforce Connector:
- Register Outmate as a Salesforce Connected App (free, one-time setup)
- OAuth2 Web Server Flow with PKCE
- Scopes: `api refresh_token offline_access`
- Entity mapping:
  - Outmate `prospect` ↔ Salesforce `Lead` or `Contact`
  - Outmate `company` ↔ Salesforce `Account`
- Push: When prospect is enriched → create/update Lead in Salesforce
- Pull: Import Leads/Contacts from Salesforce as prospects
- Sync: Celery task runs every 15/30/60 min (user configurable)
- Default field mappings:
  ```json
  {
    "prospect_to_lead": {
      "first_name": "FirstName",
      "last_name": "LastName",
      "email": "Email",
      "phone": "Phone",
      "company_name": "Company",
      "title": "Title",
      "linkedin_url": "LinkedIn_Profile__c"
    }
  }
  ```

Step 6.2 — HubSpot Connector:
- Register Outmate as HubSpot public app (free, one-time setup)
- OAuth2 Flow
- Scopes: `crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write`
- Same entity mapping pattern as Salesforce
- HubSpot webhook subscriptions for real-time updates (free)

**Week 7: Gmail (complete) + Outlook + Slack**

Step 7.1 — Gmail Connector (upgrade existing):
- Current `gmail_service.py` stores tokens in memory → move to `user_integrations` table (encrypted)
- Add: email open tracking (via tracking pixel), reply detection (polling Gmail API)
- Add: Google Sheets export (reuse same Google OAuth, just add `spreadsheets` scope)
- Add: Google Calendar (reuse same OAuth, add `calendar` scope)
- **One Google OAuth connection = 4 integrations (Gmail, Sheets, Calendar, Drive)**

Step 7.2 — Outlook/Microsoft Connector:
- Register app in Azure AD (free)
- OAuth2 via MSAL library (free, `pip install msal`)
- MS Graph API for: Mail, Calendar, OneDrive, Teams
- Scopes: `Mail.Send Mail.Read Calendars.ReadWrite Files.ReadWrite`
- **One Microsoft OAuth = 4 integrations (Outlook, Calendar, Teams, OneDrive)**

Step 7.3 — Slack Connector (upgrade existing):
- Current: webhook-only notifications from watchers
- Upgrade to: Slack Bot with OAuth2
- Create Slack App (free): bot token scopes `chat:write channels:read`
- Features: post to channels, DM alerts, slash command `/outmate search <company>`
- No cost — Slack API is free for bots

**Week 8: Instantly + Google Sheets + Calendly**

Step 8.1 — Instantly Connector:
- API Key auth (user provides their Instantly API key)
- Push: send prospect lists to Instantly campaigns
- Pull: get campaign analytics (open rates, replies)
- API docs: https://developer.instantly.ai

Step 8.2 — Google Sheets Connector:
- Already have Google OAuth from Gmail!
- Just add `https://www.googleapis.com/auth/spreadsheets` scope
- Features:
  - Export prospect/company lists to a new sheet
  - Import from sheet (user pastes sheet URL)
  - Scheduled sync (keep sheet updated every hour)

Step 8.3 — Calendly Connector:
- OAuth2 Flow (free to build)
- Pull: see scheduled meetings
- Trigger: webhook when meeting is booked (match to prospect)

**Week 9: Remaining P0 wrap-up + testing**

Step 9.1 — Finish Pipedrive, Zoho CRM (same pattern as Salesforce/HubSpot)
Step 9.2 — Finish Lemlist, SendGrid (API key connectors, same pattern as Instantly)
Step 9.3 — Integration testing for all P0 connectors
Step 9.4 — Error handling: auto-disconnect on persistent auth failures, user notifications

**Integrations live after Phase 3:**
- 7 built-in + 12 P0 native + Webhooks + API
- Google OAuth covers: Gmail, Sheets, Calendar, Drive (4 integrations, 1 OAuth)
- Microsoft OAuth covers: Outlook, Calendar, Teams, OneDrive (4 integrations, 1 OAuth)
- **Total: ~25 active + 80 "coming soon" in marketplace**

---

### Phase 4: P1 Integrations + "BYOK" Enrichment (Week 10-14) — $0 Cost

**Week 10-11: P1 CRMs + Outreach Tools**

All follow the same connector pattern established in Phase 3:
- Freshsales, Close.com, Monday CRM (API key connectors — simple)
- Salesloft, Outreach.io (OAuth2 — same pattern as Salesforce)
- Woodpecker, Smartlead, Reply.io (API key connectors)

**Week 12: "Bring Your Own Key" Enrichment Providers**

For Apollo, Hunter, Clearbit, Snov, RocketReach, Lusha, Kaspr, etc.:
- User provides their own API key
- We build a thin connector that calls their API
- All follow same pattern:
  ```python
  class ApolloConnector(BaseConnector):
      slug = "apollo"
      auth_type = AuthType.API_KEY

      async def validate_credentials(self, creds):
          # Call Apollo /health or /me endpoint
          resp = await httpx.get("https://api.apollo.io/v1/auth/health",
                                  headers={"X-Api-Key": creds["api_key"]})
          return resp.status_code == 200

      async def pull_records(self, creds, entity, filters, mapping):
          # Search Apollo for people/companies
          ...
  ```
- Each takes 2-4 hours to build (they're simple REST wrappers)
- **15 enrichment connectors × 3 hours avg = ~45 hours = ~1 week**

**Week 13: Social, Calendar, Communication**
- Microsoft Teams (already have MS Graph OAuth from Outlook)
- Twilio SMS (API key, simple REST)
- Twitter/X (OAuth2 + API v2)
- Airtable, Notion (simple REST APIs)
- Segment (just POST track events — trivial)

**Week 14: Testing + Polish**
- Integration test suite
- Sync reliability testing
- Error recovery testing
- Rate limit handling

**Integrations live after Phase 4: ~60 active**

---

### Phase 5: P2/P3 + Marketplace + Polish (Week 15-20) — $0 Cost

**Week 15-17: Build remaining P2/P3 connectors**

At this point, we have the framework. Each new connector is just:
1. Create `connectors/<category>/<name>.py` extending `BaseConnector`
2. Add row to `integrations` seed data
3. Add icon to `Frontend/public/icons/integrations/`

Each simple API key connector: ~2-3 hours
Each OAuth connector: ~4-6 hours

Batch build: Ads platforms, analytics tools, support tools, remaining CRMs

**Week 18-19: Marketplace UI + Advanced Features**

Step 18.1 — Marketplace page:
- Searchable grid of all 107 integrations
- Filter by: category, status (connected/available/coming_soon), auth type
- Sort by: popular, recently added, alphabetical
- Each card shows: icon, name, category, short description, status badge

Step 18.2 — "Request an Integration" feature:
- Simple form: integration name, use case, upvote count
- Stored in DB, admin dashboard to see most-requested
- Costs $0, helps prioritize what to build next

Step 18.3 — Integration Health Dashboard:
- Per-user view of all connected integrations
- Sync status (last sync time, records synced, errors)
- Token expiry warnings
- One-click re-authenticate for expired OAuth

**Week 20: Zapier Native App (Optional)**

If we want to officially be in the Zapier marketplace:
- Apply to Zapier Partner Program (free)
- Build Zapier app using Zapier Developer Platform
- Define triggers: New Prospect, Prospect Enriched, Campaign Sent, etc.
- Define actions: Create Prospect, Enrich Company, Add to Campaign, etc.
- This makes us searchable inside Zapier's marketplace (free marketing)

**Integrations live after Phase 5: 107 active in marketplace**

---

## Cost Summary

| Item | Cost |
|------|------|
| Explorium, Crustdata, ContactOut, BetterContact, etc. | **Already paying** (no change) |
| Unipile (LinkedIn + Email) | **Already paying** (no change) |
| Supabase PostgreSQL | **Already paying** (no change) |
| Upstash Redis | **Already paying** (no change) |
| OpenRouter / Gemini | **Already paying** (no change) |
| Salesforce Connected App registration | **Free** |
| HubSpot Public App registration | **Free** |
| Google Cloud OAuth App (Gmail, Sheets, Calendar) | **Free** |
| Azure AD App (Outlook, Teams, Calendar) | **Free** |
| Slack App registration | **Free** |
| Zapier Partner Program | **Free** |
| Python `cryptography` library | **Free** |
| Python `msal` library (Microsoft auth) | **Free** |
| All third-party API calls | **Users' own API keys** |
| Nango OSS (if we want managed OAuth) | **Free** (self-hosted) |
| **TOTAL ADDITIONAL COST** | **$0/month** |

The only costs are developer time and the services we're already paying for.

---

## Priority Matrix: What to Build When

```
IMMEDIATE VALUE (Week 1-5):
┌────────────────────────────────────────────────────┐
│ Integration Engine + Webhooks + API                 │
│ → Unlocks "connect to 7000+ apps" story            │
│ → Users can integrate with Zapier/Make immediately  │
│ → Public API lets technical users build anything    │
└────────────────────────────────────────────────────┘

HIGH VALUE (Week 6-9):
┌────────────────────────────────────────────────────┐
│ Salesforce + HubSpot + Gmail + Outlook + Slack     │
│ → Every B2B buyer expects these 5                   │
│ → Google OAuth = 4 integrations in 1                │
│ → Microsoft OAuth = 4 integrations in 1             │
└────────────────────────────────────────────────────┘

GROWTH (Week 10-14):
┌────────────────────────────────────────────────────┐
│ 15 BYOK enrichment providers + outreach tools       │
│ → Users can bring Apollo, ZoomInfo, etc. keys       │
│ → Outreach tool sync (Instantly, Lemlist, etc.)     │
│ → "Works with your existing stack" positioning      │
└────────────────────────────────────────────────────┘

COMPLETENESS (Week 15-20):
┌────────────────────────────────────────────────────┐
│ Remaining 50 connectors + Marketplace UI            │
│ → Full competitive parity with Apollo               │
│ → Marketplace browsing experience                   │
│ → "Request integration" community feature           │
└────────────────────────────────────────────────────┘
```

---

## Security Checklist

- [ ] All credentials AES-256-GCM encrypted at rest (never plaintext in DB)
- [ ] `CREDENTIAL_ENCRYPTION_KEY` in env vars (never in code)
- [ ] OAuth tokens refreshed automatically before expiry
- [ ] Webhook payloads signed with HMAC-SHA256
- [ ] API keys hashed with SHA-256 (raw key shown once, never stored)
- [ ] Rate limiting per integration per user
- [ ] Row-level security (User A can't see User B's connections)
- [ ] Scopes: request minimum OAuth permissions needed
- [ ] Token revocation on disconnect (call provider's revoke endpoint)
- [ ] Audit logging for all connection/sync/disconnect events
- [ ] No credentials in logs (mask in structured logging)

---

## Summary

| Metric | Value |
|--------|-------|
| Total integrations | **107** |
| Already built / partially built | **7** (Explorium, Crustdata, ContactOut, BetterContact, Gmail, LinkedIn, Slack webhook) |
| Extra monthly cost | **$0** (all third-party APIs are free to call, users bring own keys) |
| Total build time | **~20 weeks** (1 senior backend + 1 frontend dev) |
| Time to first "100+ integrations" claim | **Week 5** (with webhooks + Zapier/Make ecosystem) |
| Time to 25 native integrations | **Week 9** |
| Time to all 107 | **Week 20** |
| External tools needed | **None** (or optionally Nango OSS — free, self-hosted) |
