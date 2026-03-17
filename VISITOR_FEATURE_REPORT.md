# Outmate.ai — Visitor Identification Feature
## Complete End-to-End Analysis & Enhancement Report

> **Generated:** 2026-03-17
> **Feature Score: 6.5 / 10**
> **Status: Functional MVP — Production-ready core, several scalability and UX gaps**

---

## Table of Contents
1. [Feature Overview](#1-feature-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Infrastructure](#3-infrastructure)
4. [Backend — Complete Walkthrough](#4-backend--complete-walkthrough)
5. [Frontend — Complete Walkthrough](#5-frontend--complete-walkthrough)
6. [API Reference](#6-api-reference)
7. [Tracking Pixel (pixel.js)](#7-tracking-pixel-pixeljs)
8. [Enrichment Pipeline](#8-enrichment-pipeline)
9. [Real-time Architecture](#9-real-time-architecture)
10. [Webhook System](#10-webhook-system)
11. [Database Schema](#11-database-schema)
12. [Current Status & What Works](#12-current-status--what-works)
13. [Pros & Strengths](#13-pros--strengths)
14. [Cons, Gaps & Root Causes](#14-cons-gaps--root-causes)
15. [Risk Register](#15-risk-register)
16. [Feature Score Breakdown](#16-feature-score-breakdown)
17. [Improvements Implemented](#17-improvements-implemented)
18. [Improvement Roadmap](#18-improvement-roadmap)

---

## 1. Feature Overview

Outmate's **Visitor Identification** feature is a B2B website de-anonymisation platform — conceptually similar to RB2B, Clearbit Reveal, or Leadfeeder. It allows SaaS companies to:

- Embed a **JavaScript tracking pixel** (`pixel.js`) on their marketing website
- Identify the **company or individual** behind anonymous IP visits
- Enrich identified visitors with **firmographic, contact, and intent data**
- View real-time identified visitors in the **Outmate dashboard**
- Receive **webhook alerts** when a high-intent visitor is identified
- **Retroactively link** anonymous sessions to a person once they fill a form

**Core value proposition:** Turn anonymous website traffic into actionable sales leads.

---

## 2. Architecture & Tech Stack

### Backend
| Layer | Technology | Notes |
|-------|-----------|-------|
| API Framework | FastAPI (Python) | Async, dual router (public + auth) |
| Background Jobs | Celery + Redis | Async enrichment pipeline |
| Database | PostgreSQL (Supabase) + SQLAlchemy ORM | 3 tables: site_configs, visits, alerts |
| Cache / Dedup | Redis (Upstash) | 1-hour deduplication window |
| Real-time | Redis Pub/Sub → SSE | Per-org channels |
| IP Enrichment | IPinfo SDK | Geo + basic org |
| IP→Company | Enrich.so API | $29/mo plan |
| Person Data | Enrich.so, BetterContact, ContactOut | Cascading fallback |
| Firmographics | Explorium API | B2B company data |
| Auth | PyJWT (HS256) | JWT via header or query param |
| HTTP client | httpx | Async for all external API calls |

### Frontend
| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16 App Router | Server-side proxy to backend |
| State | React `useState` / `useEffect` | No Zustand for visitor page |
| Charts | Recharts | Timeseries + bar charts |
| UI | shadcn/ui + TailwindCSS v4 | OKLCH design tokens |
| Real-time | EventSource (SSE) | Browser-native |
| Notifications | Sonner | Toast alerts |

### Tracking Pixel
| Aspect | Details |
|--------|---------|
| Format | IIFE (Immediately Invoked Function Expression) — 119 lines |
| Distribution | Served by FastAPI at `/api/v1/visitors/pixel.js` |
| Persistence | localStorage (`outmate_visitor_id`, `outmate_visitor_email`) |
| Identity | Auto-captures emails from form submissions |
| Public API | `window.outmate.identify(email)` + `window.outmate.reset()` |
| Transport | `fetch()` with `mode: cors`, `keepalive: true` |
| SPA Support | **None currently** — only tracks page load |

---

## 3. Infrastructure

```
Customer Website
    │
    │  <script src="https://dev.outmate.ai/api/v1/visitors/pixel.js"
    │           data-pixel-key="pk_abc123">
    │
    ▼
FastAPI Backend (dev.outmate.ai)
    │
    ├── POST /api/v1/visitors/track (public, no auth)
    │       │
    │       ├── Redis: deduplication check (1h window per IP+domain)
    │       │
    │       └── Celery Task Queue (Redis broker)
    │               │
    │               ├── VisitorEnricher (IPinfo → Enrich.so → ContactOut → Explorium)
    │               │
    │               ├── PostgreSQL: INSERT visits
    │               │
    │               ├── Redis Pub/Sub: PUBLISH visitors:{org_id}
    │               │
    │               └── Webhooks: POST to customer webhook URLs
    │
    ├── GET /api/v1/visitors/stream?token=JWT (public, JWT via query param)
    │       │
    │       └── Redis Pub/Sub SUBSCRIBE visitors:{org_id}
    │               │
    │               └── SSE → Browser EventSource
    │
    └── GET/POST /api/v1/visitors/* (auth required)
            │
            └── PostgreSQL reads/writes

PostgreSQL (Supabase)
    ├── site_configs (1 per user/org)
    ├── visits (many per org)
    └── alerts (webhook audit trail)

Redis (Upstash)
    ├── Dedup keys: visits:{org_id}:{ip}:{domain} (TTL=3600s)
    ├── Celery broker queue
    └── Pub/Sub channels: visitors:{org_id}
```

---

## 4. Backend — Complete Walkthrough

### File Structure
```
Backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       └── visitors.py          ← Main API router (666 lines)
│   ├── db/
│   │   ├── models/
│   │   │   └── visitor.py           ← SQLAlchemy models (48 lines)
│   │   └── repositories/
│   │       ├── company_repository.py
│   │       └── prospect_repository.py
│   ├── services/
│   │   └── visitor_enrich.py        ← Multi-provider enrichment (295 lines)
│   ├── tasks/
│   │   └── visitors.py              ← Celery task + processing (307 lines)
│   └── static/
│       └── pixel.js                 ← Tracking pixel (119 lines)
├── alembic/versions/
│   └── ce442e5895fc_add_visitor_tracker_models.py
└── scripts/
    ├── seed_visitor_pixel.py
    └── create_test_visitor_config.py
```

### Route Registration
```python
# main.py
app.include_router(public_router)   # no JWT — /track, /pixel.js, /stream
app.include_router(router, dependencies=[Depends(get_current_user)])  # JWT required
```

### Key Design Decisions
1. **Dual router pattern** — public endpoints bypass auth middleware entirely (not just optional auth)
2. **ThreadPoolExecutor** for DB calls — all SQLAlchemy synchronous calls run in thread pool with 15s timeout
3. **Celery fallback** — if Redis/Celery unavailable, runs enrichment inline via `asyncio.create_task()`
4. **Org scoping** — all data isolated by `org_id = user.id` (1:1 user→org model)
5. **Retroactive linking** — once a visitor fills a form, all their prior anonymous visits get email-tagged via `visitor_id` + raw SQL UPDATE

### Backend Route Details

#### `POST /api/v1/visitors/track` (PUBLIC)
- Accepts JSON, form-data, or query params (ultra-robust extraction)
- Field aliases: `url`/`page_url`, `pixel_key`/`pixelKey`/`x-pixel-key` header
- Validates pixel_key against `site_configs` table
- Extracts IP from `x-forwarded-for` (proxy-aware)
- Computes intent score: 1.0 if URL contains `/pricing|/demo|/contact|/signup|/book`
- Redis deduplication: skips if same IP+domain tracked within last 3600s
- Dispatches to Celery task (`process_visitor_task.delay()`)

#### `GET /api/v1/visitors/pixel.js` (PUBLIC)
- Serves `Backend/app/static/pixel.js` as `application/javascript`

#### `GET /api/v1/visitors/stream` (PUBLIC, JWT via query param)
- Validates JWT from `?token=` or `Authorization` header
- Scopes channel to `visitors:{user_id_from_token}`
- Establishes Redis pubsub subscription
- Yields SSE messages; heartbeat every 15s

#### `GET /api/v1/visitors/site-config` (AUTH)
- Auto-creates SiteConfig if none exists for user
- Returns `pixel_key`, `domain`, `webhook_urls`, `icp_filters`

#### `POST /api/v1/visitors/site-config` (AUTH)
- Allows updating `domain`, `webhook_urls` (max 10), `icp_filters`

#### `POST /api/v1/visitors/test-hit` (AUTH)
- Fires synthetic visit using caller's real IP + their email
- Useful for verifying pipeline end-to-end

#### `GET /api/v1/visitors` (AUTH)
- Returns last 100 visits for org (hardcoded limit=100)
- No pagination, no filtering by server

#### `GET /api/v1/visitors/stats` (AUTH)
- Total/matched counts + category breakdown (sample of last 2000)

#### `GET /api/v1/visitors/analytics` (AUTH)
- `hours` param (1–744), `live_window_minutes` (1–60), `top_n` (3–50)
- Timeseries (hourly if ≤48h, daily if >48h)
- Top pages, referrers, intent distribution, geo, industry, tech

---

## 5. Frontend — Complete Walkthrough

### File Structure
```
Frontend/
└── app/
    └── (dashboard)/
        └── visitors/
            └── page.tsx             ← Main visitor page (~1100+ lines)
```

### Component Architecture
The entire visitors feature lives in a single 1100+ line `page.tsx`. No sub-components extracted.

### State Management
```typescript
// Core data state
visits: Visit[]                    // All visits fetched
stats: { total, matched, match_rate }
analytics: VisitorAnalytics | null

// UI state
activeTab: "companies" | "all" | "prospects" | "analytics"
searchQuery: string
filter: "all" | "hot" | "icp" | "new"
selectedVisit: Visit | null
selectedCompanyGroup: CompanyGroup | null
sidebarOpen: boolean
revealedContacts: Set<string>      // Tracks which contacts are "revealed"
period: 24 | 168 | 720 (hours)

// Config
siteConfig: { pixel_key, domain, org_id }
```

### Data Fetching
```typescript
// On mount: fetch visits + stats + analytics + site-config in parallel
// SSE stream: auto-connect with JWT, auto-reconnect on disconnect
// Period change: re-fetch analytics only
// Test hit: fires POST, then re-fetches after 3s
```

### Tabs
1. **Companies** — visits grouped by company/domain, shows ICP score, last seen, contacts
2. **All Visits** — raw visit table with intent badge, company, email, time
3. **Prospects** — filtered to `category === "prospect"` only
4. **Analytics** — full analytics panel with charts, timeseries, geo, industry, tech

### Analytics Charts
- **Timeseries** bar chart: total / matched / company / prospect per bucket
- **Intent distribution** bar chart: Cold (0-49) / Warm (50-69) / Hot (70-84 / 85-100)
- **Top pages** horizontal bar
- **Top referrers** horizontal bar
- **Geographic breakdown** table
- **Industry breakdown** table
- **Technology stack** badge list

### ICP Score Algorithm (client-side)
```typescript
function getIcpScore(visit: Visit): number {
    let score = 0
    if (visit.company)                              score += 25  // Company identified
    if (visit.full_name || visit.email)             score += 20  // Person identified
    if (visit.industry)                             score += 15  // Industry known
    if (visit.employee_count_range || visit.exact)  score += 15  // Company size
    if (visit.revenue_range)                        score += 10  // Revenue known
    if (visit.linkedin_url || visit.co_linkedin)    score += 10  // LinkedIn found
    if (visit.domain)                               score += 5   // Domain known
    return Math.min(score, 100)
}
```

### Real-time SSE Integration
```typescript
// Creates EventSource with JWT token in query param
const es = new EventSource(`${API_BASE}/api/v1/visitors/stream?token=${token}`)
es.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type === "visit_created") {
        setVisits(prev => [data.visit, ...prev])
    }
}
// Auto-reconnect: onclose/onerror
```

---

## 6. API Reference

### Public Endpoints (No Authentication)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/visitors/track` | Accept tracking event from pixel |
| GET | `/api/v1/visitors/pixel.js` | Serve JS tracking pixel |
| GET | `/api/v1/visitors/stream?token=JWT` | SSE real-time stream |

#### POST /api/v1/visitors/track
```json
// Request (JSON, Form, or Query Params)
{
  "url": "https://company.com/pricing",
  "referrer": "https://google.com",
  "pixel_key": "pk_abc123def456abc1",
  "email": "user@company.com",       // optional
  "visitor_id": "v_abc123def456"     // optional, from localStorage
}

// Response 200
{ "status": "queued", "queued_via": "celery", "message": "..." }

// Response 400
{ "error": "Missing url", "received_keys": [...], "content_type": "..." }

// Response 401
{ "error": "Invalid pixel key" }

// Response 503
{ "error": "Database temporarily unavailable" }
```

### Authenticated Endpoints (JWT Required: `Authorization: Bearer <token>`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/visitors/site-config` | Get pixel key + config |
| POST | `/api/v1/visitors/site-config` | Update domain/webhooks/ICP |
| POST | `/api/v1/visitors/test-hit` | Fire synthetic test visit |
| GET | `/api/v1/visitors` | List visits (last 100) |
| GET | `/api/v1/visitors/stats` | Match rate + category breakdown |
| GET | `/api/v1/visitors/analytics?hours=24` | Full analytics data |

#### GET /api/v1/visitors/analytics Response
```json
{
  "window": { "hours": 24, "since": "...", "use_daily": false },
  "live": { "window_minutes": 5, "unique_ips": 3 },
  "summary": { "total": 142, "matched": 48, "companies": 31, "prospects": 17, "match_rate": 33.8 },
  "timeseries": [{ "bucket": "2026-03-17T00:00:00", "total": 8, "matched": 3, "company": 2, "prospect": 1, "unknown": 5 }],
  "top_pages": [{ "page": "/pricing", "count": 23 }],
  "top_referrers": [{ "referrer": "google.com", "count": 41 }],
  "intent_distribution": [{ "bucket": "85-100", "count": 23 }],
  "geo_countries": [{ "country": "US", "count": 67 }],
  "geo_cities": [{ "city": "San Francisco, US", "count": 12 }],
  "industry_breakdown": [{ "industry": "Software", "count": 18 }],
  "top_technologies": [{ "tech": "React", "count": 11 }]
}
```

---

## 7. Tracking Pixel (pixel.js)

### Installation
```html
<script
  src="https://dev.outmate.ai/api/v1/visitors/pixel.js"
  data-pixel-key="pk_YOUR_KEY_HERE"
  async>
</script>
```

### Data Flow
```
Page Load
  └─ setTimeout(track, 800ms)
       └─ POST /api/v1/visitors/track
            { url, referrer, pixel_key, visitor_id }

Form Submit (capture)
  └─ findEmailInForm()
       └─ localStorage.setItem('outmate_visitor_email', email)
       └─ POST /api/v1/visitors/track
            { url, referrer, pixel_key, email, visitor_id }

Button Click (submit button)
  └─ findEmailInForm() on closest form
       └─ Same as above

window.outmate.identify(email)
  └─ localStorage.setItem('outmate_visitor_email', email)
  └─ POST /api/v1/visitors/track { ..., email }

window.outmate.reset()
  └─ localStorage.removeItem(...)
```

### Limitations
- Only tracks **page load** — no SPA route changes
- Uses **localStorage** (blocked in Safari ITP, private mode)
- No **page dwell time** tracking
- No **click / scroll** event tracking
- No retry on network failure
- 800ms delay on load may miss fast bounces

---

## 8. Enrichment Pipeline

### Multi-Provider Cascade

```
IP Address
  │
  ├─ Step 1: IPinfo SDK
  │    ├─ ASN org → company name (stripped "AS12345 " prefix)
  │    ├─ company.name + company.domain (paid IPinfo plan)
  │    ├─ hostname → reverse DNS domain
  │    ├─ Geo: city, region, country
  │    ├─ ISP/Cloud filter → if ISP keyword found, discard
  │    └─ Confidence: +0.4
  │
  ├─ Step 2: Enrich.so IP→Company
  │    ├─ companyName, domain
  │    ├─ ISP/Cloud filter again
  │    └─ Confidence: +0.7 if found
  │
  ├─ Step 2b: Enrich.so Email→Person (if email known)
  │    ├─ displayName, phone, LinkedIn URL, headline
  │    ├─ companyDomain
  │    └─ Confidence: +0.8
  │
  ├─ Step 2c: BetterContact fallback (if email + incomplete data)
  │    ├─ full_name, phone, linkedin_url, job_title
  │    └─ Confidence: +0.6
  │
  ├─ Step 2ca: ContactOut Email→Person (if email + no name)
  │    ├─ fullName, linkedinUrl, headline
  │    └─ Confidence: +0.75
  │
  ├─ Step 2d: ContactOut DM (if domain + no name)
  │    └─ Decision maker list from company domain
  │
  └─ Step 3: Explorium Firmographics
       ├─ By domain (if found) → confidence +0.9
       ├─ By company name → confidence +0.8
       └─ industry, employee_count, revenue, funding, technologies, HQ location
```

### ISP/Cloud Filter
Contains 70+ keywords: airtel, amazon, microsoft, google, cloudflare, digitalocean, azure, aws, etc.
If IP→company resolves to an ISP/cloud, the company is discarded (ip-only visit remains, but unidentified at company level).

### Categorization Logic
```
email provided AND personal domain (gmail, yahoo...) → category: "prospect"
domain OR work email → category: "company"
neither → category: "unknown"
```

### Retroactive Linking
When a visitor with a known `visitor_id` + email is identified, all prior anonymous visits sharing the same `visitor_id` get their `matched=true` and `email` field retroactively updated via a raw SQL `jsonb_set` UPDATE.

### Confidence Score Range
| Range | Meaning |
|-------|---------|
| 0.0 | Nothing found |
| 0.4 | IP geolocation only (city/country) |
| 0.5 | Email hint provided (unverified) |
| 0.6 | BetterContact verified |
| 0.7 | Enrich.so IP→Company confirmed |
| 0.75 | ContactOut person match |
| 0.8 | Enrich.so email→person confirmed |
| 0.9 | Explorium by domain (most authoritative) |

---

## 9. Real-time Architecture

```
Celery Worker
    └─ After saving Visit to DB
         └─ redis_client.publish("visitors:{org_id}", json_payload)

FastAPI SSE Handler
    ├─ Subscribes: pubsub.subscribe("visitors:{org_id}")
    ├─ Yields SSE: "data: {json}\n\n"
    └─ Heartbeat: ": heartbeat\n\n" every 15s

Browser (EventSource)
    ├─ Connects: GET /stream?token=JWT
    ├─ Receives messages → updates visits state
    └─ Auto-reconnects on close/error
```

**Channel scoping:** Channel is `visitors:{user_id_from_jwt}` — prevents cross-tenant data leakage. The `?org_id=` query param is accepted for backwards compat but overridden by the JWT sub claim.

**SSE headers:**
```
Cache-Control: no-cache
X-Accel-Buffering: no    ← disables nginx buffering
Connection: keep-alive
```

---

## 10. Webhook System

### Configuration
Stored in `site_configs.webhook_urls` (JSONB array, max 10 URLs).

### Trigger
Fires after a visit is saved and `visit.matched == True`.

### Payload
```json
{
  "event": "visitor_identified",
  "visit_id": "uuid",
  "ip": "1.2.3.4",
  "url": "https://company.com/pricing",
  "resolution": {
    "company": "Acme Inc",
    "domain": "acme.com",
    "email": "cto@acme.com",
    "full_name": "John Doe",
    "confidence": 0.9,
    "geo": { "city": "San Francisco", "country": "US" },
    "explorium": { ... }
  },
  "timestamp": "2026-03-17T10:30:00"
}
```

### Audit Trail
Every webhook delivery creates an `Alert` record with:
- `status`: "success" (2xx), "failed" (non-2xx), or "error" (exception)
- `payload`: the full payload that was sent (or error message)
- No retry logic implemented

---

## 11. Database Schema

### site_configs
```sql
CREATE TABLE site_configs (
    org_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pixel_key    VARCHAR(255) NOT NULL UNIQUE,  -- "pk_" + 16 hex chars
    domain       VARCHAR(255),
    icp_filters  JSONB DEFAULT '{}',
    webhook_urls JSONB DEFAULT '[]',
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON site_configs(pixel_key);
```

### visits
```sql
CREATE TABLE visits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID REFERENCES site_configs(org_id) ON DELETE CASCADE,
    ip           INET NOT NULL,
    url          TEXT NOT NULL,
    referrer     TEXT,
    user_agent   TEXT,
    intent_score FLOAT DEFAULT 0.5,
    resolution   JSONB,              -- all enrichment data
    matched      BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON visits(org_id, created_at DESC);
CREATE INDEX ON visits(matched);
```

### alerts
```sql
CREATE TABLE alerts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id     UUID REFERENCES visits(id) ON DELETE CASCADE,
    webhook_type VARCHAR(50),        -- "general"
    status       VARCHAR(20),        -- "success" | "failed" | "error"
    payload      JSONB,
    created_at   TIMESTAMPTZ DEFAULT now()
);
```

**Missing indexes:** `visits(ip)`, `visits(org_id, matched)` for stats queries, `visits(resolution->>'visitor_id')` for retroactive linking — raw SQL UPDATE does a full table scan.

---

## 12. Current Status & What Works

### ✅ Working / Implemented
| Feature | Status | Notes |
|---------|--------|-------|
| Tracking pixel (pixel.js) | ✅ Works | Page load + form capture |
| IP → Company via Enrich.so | ✅ Works | If API key configured |
| IP → Geo via IPinfo | ✅ Works | Free tier |
| Email → Person enrichment | ✅ Works | Via Enrich.so + BetterContact |
| Firmographics via Explorium | ✅ Works | Industry, headcount, revenue |
| Visitor deduplication (Redis) | ✅ Works | 1h window per IP+domain |
| ISP/Cloud filtering | ✅ Works | 70+ keyword list |
| Celery async processing | ✅ Works | Falls back to inline |
| SSE real-time dashboard | ✅ Works | If Redis available |
| Webhook delivery | ✅ Works | No retry |
| Retroactive visitor linking | ✅ Works | Via visitor_id localStorage |
| Visitor categorization | ✅ Works | company/prospect/unknown |
| Dashboard: Companies tab | ✅ Works | Grouped by company |
| Dashboard: Analytics tab | ✅ Works | Charts, timeseries |
| Test hit button | ✅ Works | Sends real IP |
| Pixel setup dialog | ✅ Works | Code snippet + copy |
| JWT-scoped SSE | ✅ Works | No cross-tenant leakage |
| DB timeout protection | ✅ Works | 15s hard timeout |

### ⚠️ Partially Working
| Feature | Status | Notes |
|---------|--------|-------|
| SPA tracking | ⚠️ Partial | Only page load, not route changes |
| ICP filtering | ⚠️ Partial | Config stored, not applied server-side |
| Contact reveal | ⚠️ Partial | UI has "reveal" button, no API gatekeeping |
| Webhook retry | ⚠️ None | Single attempt only |
| Pagination | ⚠️ None | Hardcoded limit=100 |
| Export | ⚠️ None | No CSV/JSON export |

### ❌ Not Yet Implemented
- Slack/Zapier webhook templates
- Session/page journey grouping (multi-page visit paths)
- Visitor notes / CRM tagging
- ICP score filtering in backend
- Rate limiting on `/track` endpoint
- Visitor blacklisting / suppression
- GDPR consent mode
- Account-level suppression (exclude own company)
- Email alert notifications
- Mobile app push notifications

---

## 13. Pros & Strengths

1. **Multi-provider enrichment cascade** — IPinfo → Enrich.so → BetterContact → ContactOut → Explorium gives high hit rates across multiple data sources with cost-efficient fallback ordering.

2. **Retroactive visitor linking** — When an anonymous visitor later fills a form, all prior sessions get de-anonymised automatically via visitor_id. This is a competitive differentiator.

3. **ISP/Cloud filtering** — 70+ keyword list prevents garbage data (AWS, Airtel, Comcast) from polluting the pipeline.

4. **Real-time SSE** — Zero-latency dashboard updates without polling. Scoped per-org to prevent data leakage.

5. **Ultra-robust tracking endpoint** — Accepts JSON, form-data, and query params. Handles field aliases. Never crashes on partial data.

6. **Celery fallback** — Graceful degradation to inline async processing when Redis/Celery is unavailable. Zero downtime.

7. **Dual router pattern** — Clean separation of public vs authenticated routes at the FastAPI router level.

8. **Confidence scoring** — 0–0.9 scale with defined increments per enrichment step. Enables quality filtering.

9. **Intent scoring** — URL-based signal (/pricing, /demo, /contact → 1.0) provides basic buying signal.

10. **ICP score algorithm (client-side)** — Weighted scoring across 7 data completeness signals.

---

## 14. Cons, Gaps & Root Causes

### 🔴 Critical Issues

#### C1. No Rate Limiting on `/track` Endpoint
**Problem:** The public `/track` endpoint has no rate limiting. Anyone can flood it with fake visits.
**Root Cause:** `slowapi` is set up for auth routes only; `public_router` has no limiter.
**Impact:** Database flooding, API cost amplification (each fake hit calls IPinfo/Enrich.so), Redis dedup exhaustion.
**Fix:** Add `slowapi` limiter per IP, max 10 req/min on `/track`.

#### C2. Error Leaks `str(e)` to Client
**Problem:** `track_visitor` and `test-hit` return `{"error": str(e)}` on generic exceptions.
**Root Cause:** Inconsistent error handling; auth routes properly sanitise, track doesn't.
**Impact:** Internal implementation details exposed to public endpoint.
**Fix:** Catch and return generic "Internal server error" for unhandled exceptions.

#### C3. No Pagination on List Visits
**Problem:** `GET /api/v1/visitors` hardcodes `limit=100`. As data grows, this becomes stale.
**Root Cause:** MVP implementation, not designed for scale.
**Impact:** Dashboard shows only 100 most recent visits regardless of total.
**Fix:** Add `offset` + `limit` query params, return `total` count + `has_more` flag.

### 🟠 High Priority Gaps

#### H1. SPA Route Change Tracking Missing
**Problem:** `pixel.js` only fires once on page load. Single-page applications (React, Vue, Angular) never fire again on route changes.
**Root Cause:** No history API monitoring or `popstate` listener.
**Impact:** For SPA websites (likely the majority of Outmate customers), visit tracking is wildly under-counted.
**Fix:** Patch `history.pushState` + `history.replaceState` + listen to `popstate` event.

#### H2. No Webhook Retry
**Problem:** If a webhook fails, no retry is attempted. Alert is logged as "failed" or "error".
**Root Cause:** Simple `httpx.post` with no retry logic.
**Impact:** Customers miss webhook notifications on transient network errors.
**Fix:** Add Celery retry with exponential backoff (3 attempts, 5/60/300s delays).

#### H3. Missing DB Indexes for Performance
**Problem:** Several frequent query patterns lack indexes:
- `visits(ip)` — used in dedup but dedup is done via Redis key; still used in analytics
- `visits(org_id, matched)` — stats query does 2 full scans
- `visits.resolution->>'visitor_id'` — retroactive linking UPDATE scans all visits
**Root Cause:** Initial migration added basic indexes but missed these.
**Fix:** Add Alembic migration with 3 new indexes + GIN index on `resolution` JSONB.

#### H4. No Export Functionality
**Problem:** No CSV/JSON export for visits or identified companies.
**Root Cause:** Not yet implemented.
**Impact:** Users can't export leads to CRM (HubSpot, Salesforce, etc.).
**Fix:** Add `GET /api/v1/visitors/export?format=csv&hours=168` endpoint.

#### H5. ICP Filters Not Applied Server-Side
**Problem:** `icp_filters` JSONB is stored and returned, but never applied during enrichment or querying.
**Root Cause:** Filter storage is implemented but filtering logic is not.
**Impact:** "ICP targeting" configuration has no actual effect.
**Fix:** Apply ICP filters in `_categorize_and_attach` or as a query filter in `list_visitors`.

### 🟡 Medium Priority Issues

#### M1. single-file Frontend (1100+ Lines)
**Problem:** Entire visitor feature in one `page.tsx` — hard to test, maintain, or lazy-load.
**Root Cause:** Fast MVP development.
**Impact:** Slow initial load, difficult to add features cleanly.
**Fix:** Extract `VisitorTable`, `CompanyCard`, `AnalyticsPanel`, `VisitorDetailSheet` as separate components.

#### M2. pixel.js Uses localStorage Only
**Problem:** Safari ITP (Intelligent Tracking Prevention) and private browsing clear localStorage, breaking visitor_id persistence.
**Root Cause:** Simple implementation using standard localStorage.
**Impact:** Each visit from Safari private mode is treated as a new visitor; no retroactive linking possible.
**Fix:** Add cookie fallback with `SameSite=None; Secure` + `__Secure-` prefix.

#### M3. Hardcoded Test Key
**Problem:** `_DEFAULT_PIXEL_KEY = "outmate_test_key_123"` is hardcoded and always seeded to `org_id = 00000...001`.
**Root Cause:** Convenience for development.
**Impact:** In production, this dead org_id accumulates visits from anyone using the test key. No real user can claim it.
**Fix:** Move test seeding to a development-only flag, or remove entirely in production.

#### M4. Webhook Payload Uses `datetime.utcnow()` (Deprecated)
**Problem:** `datetime.utcnow().isoformat()` returns a naive datetime without timezone info.
**Root Cause:** Oversight, Python 3.12 deprecated `utcnow()`.
**Fix:** Replace with `datetime.now(timezone.utc).isoformat()`.

#### M5. Analytics Query Loads up to 50,000 Rows in Python
**Problem:** `GET /api/v1/visitors/analytics` fetches up to 50,000 rows and processes them in Python (Counter, defaultdict).
**Root Cause:** Simplicity of implementation vs pushing aggregations to DB.
**Impact:** Slow response times + high memory usage for active orgs.
**Fix:** Move aggregations to PostgreSQL GROUP BY queries or add a materialized view.

---

## 15. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|-----------|
| R1 | `/track` DDoS floods Enrich.so API credits | High | High | Rate limiting per IP + per pixel_key |
| R2 | Redis outage kills SSE + dedup + Celery | Medium | High | Graceful degradation (already partially done) |
| R3 | Enrich.so API cost overrun | Medium | High | Per-org daily enrichment budget cap |
| R4 | IPinfo free tier rate limit (50k/mo) | Medium | Medium | Cache IPinfo results by IP in Redis (TTL 24h) |
| R5 | GDPR non-compliance (EU visitors) | Medium | Critical | Add consent mode, privacy policy hooks |
| R6 | Competitor scrapes pixel.js to reverse-engineer | Low | Low | Obfuscate pixel.js in production |
| R7 | visitor_id retroactive linking race condition | Low | Medium | Use DB transaction + SELECT FOR UPDATE |
| R8 | Supabase connection pool exhaustion | Medium | High | Add pgbouncer, reduce max_workers |

---

## 16. Feature Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Core Functionality | 7/10 | Pipeline works, multi-provider enrichment |
| Data Quality | 6/10 | Good ISP filtering, but no caching, dedup gaps |
| Reliability | 6/10 | Celery fallback good; no webhook retry; no rate limit |
| Performance | 5/10 | 50k row analytics fetch, no pagination, no indexes |
| Security | 6/10 | JWT scoping good; error leaks; no `/track` rate limit |
| Frontend UX | 7/10 | Feature-rich dashboard; 1100-line monolith |
| Real-time | 8/10 | SSE + Redis pubsub well implemented |
| Scalability | 5/10 | No pagination, no aggregation pushdown, single org model |
| Integration | 6/10 | Webhook exists; no Slack/Zapier templates; no export |
| SPA Support | 3/10 | Page-load only, no route change tracking |

### **Overall: 6.5 / 10**

Strong foundational architecture with a well-designed enrichment pipeline. Main gaps are in scalability (no pagination, Python-side aggregations), SPA tracking (biggest UX gap), security (no `/track` rate limiting), and completeness (no export, no webhook retry, ICP filters non-functional).

---

## 17. Improvements Implemented

The following improvements have been implemented in this session:

### 17.1 pixel.js — SPA Route Change Tracking
- History API patching (`pushState`, `replaceState`)
- `popstate` event listener
- Per-page dwell time tracking (time on current page before navigation)
- Configurable minimum dwell threshold to filter bounces

### 17.2 Backend `/track` — Rate Limiting
- Per-IP rate limiting: max 30 requests/minute
- Per-pixel-key rate limiting: max 1000 requests/minute
- Redis-backed counters with sliding window

### 17.3 Backend `/api/v1/visitors` — Pagination
- `offset` + `limit` query params (default: limit=50, max: 500)
- Returns `{ visits: [], total: N, has_more: bool, offset: N, limit: N }`

### 17.4 Backend — CSV Export Endpoint
- `GET /api/v1/visitors/export?format=csv&hours=168`
- Streams CSV with all enrichment fields
- Auth required

### 17.5 Backend — Webhook Retry with Exponential Backoff
- 3 retry attempts with 5s / 60s / 300s delays
- Celery `retry()` mechanism
- Alert status: "pending" → "success" / "failed_final"

### 17.6 Backend — Fixed `datetime.utcnow()` Deprecation
- Replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)`

### 17.7 Backend — Better Intent Scoring
- Extended URL signal patterns
- Added page count signal (3+ pages = elevated intent)
- Added time-of-day signal

### 17.8 Frontend — Export Button
- CSV export button in visitors page header
- Downloads visits as CSV file

### 17.9 Frontend — Pagination Controls
- Page navigation controls in All Visits tab
- Configurable page size

### 17.10 Missing DB Indexes
- Alembic migration adding `visits(ip)`, `visits(org_id, matched)`, `visits(created_at)` indexes

---

## 18. Improvement Roadmap

### Short Term (1–2 weeks)
- [ ] GDPR consent mode (pixel checks for consent before firing)
- [ ] Slack webhook template (formatted Slack Block Kit message)
- [ ] CRM export: HubSpot / Salesforce one-click export
- [ ] Account-level suppression (don't track your own company)
- [ ] Visitor notes / tags (CRM-lite annotations)
- [ ] Cookie fallback in pixel.js for Safari ITP

### Medium Term (1 month)
- [ ] Push analytics aggregations to PostgreSQL (GROUP BY) or materialized views
- [ ] Extract frontend components from page.tsx monolith
- [ ] Per-org enrichment budget caps (daily limit on Enrich.so calls)
- [ ] IPinfo result caching in Redis (TTL 24h) to save API credits
- [ ] Session grouping: link multiple page visits into a session
- [ ] Company journey view: timeline of all pages visited by a company

### Long Term (2–3 months)
- [ ] Heatmap integration (click/scroll tracking)
- [ ] Intent scoring ML model (replace simple URL-rule with ML)
- [ ] Slack bot for instant visit alerts with action buttons
- [ ] Multi-domain support per org
- [ ] White-label pixel (custom domain for pixel.js serving)
- [ ] Visitor segmentation: ICP match lists, audience building
- [ ] API key management (separate from JWT)
- [ ] Zapier / Make.com integration
- [ ] Chrome extension for SDR workflow

---

*Report generated by Claude Sonnet 4.6 — Outmate.ai Engineering*
