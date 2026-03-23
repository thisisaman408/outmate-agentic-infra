# Integrations — Quick Reference Sheet

## Tech Stack

| Layer | Technology | Already Have? |
|-------|-----------|---------------|
| Backend Framework | FastAPI (Python 3.11) | Yes |
| Database | Supabase PostgreSQL + pgcrypto | Yes |
| Cache / Queue Broker | Upstash Redis | Yes |
| Background Tasks | Celery + Redis | Yes |
| OAuth Management | Custom auth_manager.py (or Nango OSS — free) | Build |
| Credential Encryption | Python `cryptography` (Fernet/AES-256-GCM) | Build |
| HTTP Client | httpx (async) | Yes |
| Webhook Signing | HMAC-SHA256 (Python `hmac` stdlib) | Build |
| Token Refresh | Celery Beat (scheduled task every 15 min) | Build |
| Microsoft Auth | `msal` library (free) | Install |
| Frontend | Next.js 16 + React 19 + Tailwind + Radix UI | Yes |
| State Management | Zustand | Yes |
| Icons | Lucide React + SVG icons per integration | Partial |

**New pip packages needed:** `cryptography`, `msal` — both free.
**New npm packages needed:** None.

---

## New Database Tables (6 tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `integrations` | Master catalog (107 rows) | slug, name, category, auth_type, is_coming_soon |
| `user_integrations` | Per-user connections | user_id, integration_id, status, credentials_encrypted |
| `integration_field_mappings` | Field mapping config | outmate_field ↔ external_field, direction |
| `integration_sync_logs` | Audit trail | sync_type, records_succeeded/failed, duration_ms |
| `integration_webhooks` | Webhook subscriptions | event_type, webhook_url, webhook_secret, direction |
| `api_keys` | Public API keys | key_hash (SHA-256), scopes, expires_at |

---

## New Backend Files

| File | Purpose |
|------|---------|
| `api/routes/integrations.py` | REST endpoints for connect/disconnect/sync/config |
| `api/routes/webhooks.py` | Inbound/outbound webhook endpoints |
| `db/models/integration.py` | Integration + UserIntegration ORM models |
| `db/models/api_key.py` | API key ORM model |
| `services/integration_engine/registry.py` | Auto-discover & load all connectors |
| `services/integration_engine/auth_manager.py` | OAuth2 flows + API key validation |
| `services/integration_engine/credential_vault.py` | AES-256 encrypt/decrypt credentials |
| `services/integration_engine/sync_engine.py` | Push/pull data via Celery tasks |
| `services/integration_engine/webhook_engine.py` | Fire outbound + receive inbound webhooks |
| `services/integration_engine/field_mapper.py` | Transform fields between systems |
| `services/integration_engine/token_refresher.py` | Celery beat: auto-refresh expiring tokens |
| `services/connectors/base.py` | BaseConnector abstract class |
| `services/connectors/<category>/<name>.py` | One file per integration (107 total) |

---

## Connector Auth Patterns (3 types — covers all 107)

| Pattern | How It Works | Used By |
|---------|-------------|---------|
| **OAuth2** | Redirect → authorize → callback → store tokens → auto-refresh | Salesforce, HubSpot, Gmail, Outlook, Slack, Zoom, etc. |
| **API Key** | User pastes key → validate via test call → store encrypted | Instantly, Airtable, Apollo, Hunter, SendGrid, Twilio, etc. |
| **Webhook** | Generate unique URL → user pastes in external tool → receive POSTs | Zapier, Make, n8n, generic webhooks |

---

## Key Workflows

### Workflow 1: User Connects an OAuth Integration
```
Frontend                    Backend                         External (e.g. Salesforce)
   │                          │                                    │
   ├─ Click "Connect" ──────►├─ GET /integrations/sf/connect      │
   │                          ├─ Generate state token              │
   │                          ├─ Return OAuth URL ────────────────►│
   │◄─ Redirect to SF login ─┤                                    │
   │                          │                        User logs in│
   │                          │◄──── Redirect with code ───────────┤
   │                          ├─ POST token exchange ─────────────►│
   │                          │◄──── Access + refresh tokens ──────┤
   │                          ├─ Encrypt & store in DB             │
   │◄─ "Connected ✓" ────────┤                                    │
```

### Workflow 2: User Connects an API Key Integration
```
Frontend                    Backend
   │                          │
   ├─ Enter API key ─────────►├─ POST /integrations/instantly/connect
   │                          ├─ Call connector.validate_credentials()
   │                          ├─ If valid: encrypt & store in DB
   │◄─ "Connected ✓" ────────┤
   │                          ├─ If invalid: return 400
   │◄─ "Invalid key" ────────┤
```

### Workflow 3: Data Sync (Push to CRM)
```
Celery Task                 Backend                         Salesforce
   │                          │                                │
   ├─ Scheduled sync ────────►├─ Load user_integration         │
   │                          ├─ Decrypt credentials           │
   │                          ├─ Load field mappings           │
   │                          ├─ Fetch Outmate prospects       │
   │                          ├─ Transform via field_mapper    │
   │                          ├─ connector.push_records() ────►│
   │                          │◄──── Success/failure ──────────┤
   │                          ├─ Log to sync_logs table        │
   │                          ├─ Update last_synced_at         │
```

### Workflow 4: Outbound Webhook (Zapier/Make)
```
Outmate Event               Webhook Engine                  Zapier/Make
   │                          │                                │
   ├─ prospect.created ──────►├─ Find all webhooks for event   │
   │                          ├─ Sign payload (HMAC-SHA256)    │
   │                          ├─ POST to webhook_url ─────────►│
   │                          │◄──── 200 OK ───────────────────┤
   │                          ├─ Log success                   │
   │                          │                                │
   │                          ├─ If fails: retry 3x            │
   │                          ├─ If 10 consecutive fails:      │
   │                          │   auto-disable webhook         │
```

### Workflow 5: Inbound Webhook (External → Outmate)
```
External Tool               Backend                         Database
   │                          │                                │
   ├─ POST /webhooks/inbound/►├─ Verify HMAC signature         │
   │    {prospect data}       ├─ Parse payload                 │
   │                          ├─ Map fields to Outmate schema  │
   │                          ├─ Create/update prospect ──────►│
   │                          ├─ Fire internal events          │
   │◄──── 200 OK ────────────┤                                │
```

### Workflow 6: Token Auto-Refresh
```
Celery Beat (every 15 min)  Backend                         OAuth Provider
   │                          │                                │
   ├─ Query expiring tokens ─►├─ WHERE token_expires_at        │
   │    (< now + 30 min)      │   < NOW() + 30 min            │
   │                          ├─ For each:                     │
   │                          │   ├─ Decrypt refresh_token     │
   │                          │   ├─ POST token refresh ──────►│
   │                          │   │◄── New access_token ───────┤
   │                          │   ├─ Re-encrypt & save         │
   │                          │   └─ Update expires_at         │
   │                          ├─ If refresh fails 3x:          │
   │                          │   └─ Set status = "expired"    │
   │                          │   └─ Notify user               │
```

---

## Integration Count by Category

| Category | Count | Already Built | To Build |
|----------|-------|---------------|----------|
| Data Enrichment | 15 | 5 | 10 |
| CRM | 12 | 0 | 12 |
| Email & Outreach | 14 | 1 (Gmail partial) | 13 |
| Communication | 10 | 2 (Slack partial, LinkedIn) | 8 |
| Social Media | 8 | 1 (LinkedIn) | 7 |
| Workflow Automation | 8 | 0 | 8 |
| Calendar & Meetings | 6 | 0 | 6 |
| Productivity | 10 | 0 | 10 |
| Analytics | 8 | 0 | 8 |
| Advertising & ABM | 10 | 0 | 10 |
| Support & Success | 6 | 0 | 6 |
| **TOTAL** | **107** | **9** | **98** |

---

## Build Timeline

| Phase | Weeks | What | Result |
|-------|-------|------|--------|
| 1 — Foundation | 1-3 | Engine, DB, auth, webhooks, sync | Framework ready |
| 2 — Wrap + API | 4-5 | Wrap 7 existing + webhooks + REST API | 10 live + "7000+ via Zapier" |
| 3 — Big 5 | 6-9 | Salesforce, HubSpot, Gmail, Outlook, Slack | ~25 live |
| 4 — P1 Batch | 10-14 | 15 enrichment BYOK + outreach + social | ~60 live |
| 5 — P2/P3 + Marketplace | 15-20 | Remaining connectors + marketplace UI | **107 live** |

---

## Cost: $0 Extra

| What | Why Free |
|------|----------|
| All third-party API calls | Users bring their own API keys |
| OAuth app registrations | Salesforce, HubSpot, Google, Microsoft, Slack — all free |
| New Python packages | `cryptography`, `msal` — open source |
| Webhook infrastructure | Built on existing Celery + Redis (already paid) |
| Database tables | Existing Supabase instance (already paid) |
