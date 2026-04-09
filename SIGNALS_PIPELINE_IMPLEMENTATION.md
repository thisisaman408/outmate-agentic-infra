# Signals Pipeline Implementation Plan

## 1. Current State Analysis

### ✅ Already Implemented

1. **Signal Detection Service** (`signal_detection_service.py`)
   - Uses CrustData API for prospect signals (job history, LinkedIn posts)
   - Uses Explorium API for company signals (business challenges, hiring, technology)
   - Detects: funding, hiring trends, tech adoption, growth indicators, news

2. **Signal Fetcher Service** (`signal_fetcher_service.py`)
   - Google News RSS search
   - X/Twitter mentions via RSS
   - LinkedIn posts via RSS
   - Multi-query dedup by MD5 fingerprint
   - Recency filtering (7-day default)

3. **Infrastructure**
   - Redis (async client with TLS support + retry logic)
   - Celery (task queue with Beat scheduler already installed)
   - PostgreSQL + SQLAlchemy ORM
   - Credit transaction tracking (`CreditTransaction` model)
   - Data providers management (`DataProvider` model)

4. **Signal API Routes** (`signals.py`)
   - Endpoints for signal detection, search by filters
   - LinkedIn posts, websites signals
   - Results returned as unstructured JSON

### ❌ NOT Implemented

1. **Signal Event Bus**
   - No Redis Streams or Kafka integration
   - No structured event ingestion pipeline
   - No real-time event processing

2. **Signal Types**
   - No unified signal type taxonomy with 7 types
   - No type-specific enrichment
   - No type-specific credit costs

3. **Signal Model (Database)**
   - No `Signal` or `SignalEvent` table to persist ingested signals
   - No signal deduplication tracking
   - No freshness tracking (archived signals)
   - No ICP score storage

4. **Enrichment Pipeline**
   - No per-signal company domain resolution
   - No ICP scoring at ingestion time
   - No contact matching

5. **Co-Pilot Integration**
   - No structured event queue for Co-Pilot
   - No Co-Pilot signal routing

6. **Deduplication**
   - Fingerprinting exists but only in memory/RSS fetches
   - No persistent 24-hour dedup window

7. **Credit Management**
   - Credit transactions exist but no signal-triggered deductions
   - No signal-type-specific credit costs

8. **Freshness Management**
   - No archival process for signals older than 7 days
   - No query filters to exclude stale signals

---

## 2. Foundation Required

### 2.1 Signal Database Model

```python
# Backend/app/db/models/signal_event.py

class SignalEvent(Base):
    __tablename__ = "signal_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Core signal data
    signal_type = Column(String(50), nullable=False, index=True)
    # Types: "job_change", "funding", "hiring", "g2_intent", "website_visit", "email_open", "linkedin_activity"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), index=True)
    company_domain = Column(String(255), nullable=True, index=True)
    company_name = Column(String(500), nullable=True)

    prospect_id = Column(UUID(as_uuid=True), ForeignKey("prospects.id", ondelete="SET NULL"), nullable=True, index=True)
    prospect_email = Column(String(255), nullable=True)
    prospect_name = Column(String(500), nullable=True)

    # Data source & original context
    source = Column(String(100), nullable=False)  # "crustdata", "explorium", "rss", "webhook", "g2"
    raw_data = Column(JSONB, default={})  # Original API response / event data

    # Enrichment
    icp_score = Column(Integer, nullable=True)  # 0-100
    icp_match_factors = Column(JSONB, default=[])  # Why it matched ICP

    # Deduplication & freshness
    fingerprint = Column(String(32), nullable=True, index=True)  # MD5(source+company+type+key_fields)
    is_archived = Column(Boolean, default=False, index=True)  # Older than 7 days
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # Credit tracking
    credits_consumed = Column(Integer, default=0)

    # Routing
    sent_to_copilot = Column(Boolean, default=False)
    copilot_queue_id = Column(String(255), nullable=True)

    # Metadata
    discovered_at = Column(DateTime(timezone=True), nullable=False, default=func.now())  # When signal occurred
    ingested_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)  # When we received it
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("fingerprint", "company_domain", "ingested_at", name="uq_signal_fingerprint_dedup"),
    )
```

### 2.2 Signal Dedup Tracker (Redis)

Using Redis Streams for event bus:
```python
# Key: outmate:signals:stream:events
# Each entry: { type, company_domain, contact_email, fingerprint, score, context }

# Dedup check (Redis key):
# outmate:signals:dedup:{domain}:{signal_type} = last_fingerprint (24hr TTL)

# Co-Pilot queue (Redis list):
# outmate:signals:copilot:queue = [{ type, company, contact, score, ... }]
```

---

## 3. Implementation Plan

### Phase 1: Foundation (Files & Models)

**New Files:**
1. `Backend/app/db/models/signal_event.py` — Signal model
2. `Backend/app/services/signal_pipeline/` package:
   - `__init__.py`
   - `signal_ingester.py` — Ingest signals from various sources
   - `signal_enricher.py` — Resolve company domain, score ICP
   - `signal_deduplicator.py` — Check 24hr dedup window
   - `signal_archiver.py` — Mark 7-day-old signals as archived
   - `icp_signal_scorer.py` — Score signal against user's ICP
   - `signal_event_bus.py` — Redis Streams event bus orchestrator

**Modified Files:**
1. `Backend/app/db/models/__init__.py` — Add `SignalEvent` import
2. `Backend/alembic/versions/` — Create migration for signal_events table

### Phase 2: Event Bus & Ingestion

**Files:**
1. `Backend/app/services/signal_pipeline/signal_event_bus.py`

```python
class SignalEventBus:
    """Redis Streams-based event bus for signal ingestion.

    - Stream: outmate:signals:stream:events
    - Consumer group: signal-processors
    - Publish rate: 10k+ events/min capable
    """

    async def publish_signal(self, event: SignalEventPayload):
        """Ingest a raw signal event (from CrustData, RSS, webhook, etc.)"""

    async def consume_signals(self, batch_size: int = 100):
        """Pull events from stream for enrichment & dedup"""

    async def publish_to_copilot_queue(self, enriched_signal: EnrichedSignal):
        """Write de-duped, enriched signal to Co-Pilot queue"""
```

### Phase 3: Enrichment

**File:** `Backend/app/services/signal_pipeline/signal_enricher.py`

```python
class SignalEnricher:
    """Enrich raw signals with company domain, ICP score, and contact matching."""

    async def enrich(self, raw_signal: dict) -> EnrichedSignal:
        # 1. Resolve company domain (via Prospect lookup or Explorium)
        # 2. Resolve company_id (query Company table)
        # 3. If prospect mention: resolve prospect_id & contact
        # 4. Call ICP scorer
        # 5. Return enriched signal
```

### Phase 4: ICP Scoring

**File:** `Backend/app/services/signal_pipeline/icp_signal_scorer.py`

```python
class ICPSignalScorer:
    """Score signal against user's Ideal Customer Profile."""

    async def score_signal(self, signal: dict, user_id: UUID) -> tuple[int, list]:
        # Get user's ICP criteria from copilot_user_preferences
        # Match signal to ICP:
        #   - Company firmographics (size, revenue, industry)
        #   - Company signals (recent hiring, funding)
        #   - Contact seniority/function
        # Return (score: 0-100, matching_factors: ["hiring_activity", ...])
```

### Phase 5: Deduplication

**File:** `Backend/app/services/signal_pipeline/signal_deduplicator.py`

```python
class SignalDeduplicator:
    """Suppress duplicate signals within 24hr window."""

    async def should_suppress(self, signal: EnrichedSignal) -> bool:
        # Check Redis: outmate:signals:dedup:{domain}:{type}
        # If exists and within 24hr: return True (suppress)
        # Else: set new key with 24hr TTL, return False (process)

    async def mark_processed(self, signal: EnrichedSignal):
        # Set Redis dedup key with 24hr TTL
```

### Phase 6: Credit Consumption

**File:** `Backend/app/services/signal_pipeline/signal_credits.py`

```python
SIGNAL_CREDIT_COSTS = {
    "job_change": 2,
    "funding": 3,
    "hiring": 2,
    "g2_intent": 4,
    "website_visit": 1,
    "email_open": 1,
    "linkedin_activity": 2,
}

async def deduct_signal_credits(user_id: UUID, signal_type: str):
    cost = SIGNAL_CREDIT_COSTS.get(signal_type, 2)
    # Deduct from user.credits_balance (or fail if insufficient)
    # Log CreditTransaction with reference_id = signal_event.id
```

### Phase 7: Freshness & Archival

**File:** `Backend/app/services/signal_pipeline/signal_archiver.py`

Celery task (runs daily):
```python
@celery_app.task
async def archive_stale_signals_task():
    # Query signals where:
    #   discovered_at < now() - 7 days AND is_archived = False
    # Bulk update: is_archived = True, archived_at = now()
    # Log count archived
```

### Phase 8: Celery Tasks & Scheduling

**Files:**
1. `Backend/app/tasks/signal_tasks.py` — New task file

```python
@celery_app.task
async def ingest_and_process_signals_task():
    """Continuous signal ingestion from event bus."""
    # Called every 30 seconds by beat schedule
    # Consumes signals from event bus
    # Enriches, dedupes, scores
    # Writes to Co-Pilot queue

@celery_app.task
async def archive_stale_signals_task():
    """Mark signals older than 7 days as archived."""
    # Called once daily at 02:00 UTC

beat_schedule = {
    "ingest-signals": {
        "task": "app.tasks.signal_tasks.ingest_and_process_signals_task",
        "schedule": crontab(minute="*/1"),  # Every minute (batches internally)
    },
    "archive-signals": {
        "task": "app.tasks.signal_tasks.archive_stale_signals_task",
        "schedule": crontab(hour=2, minute=0),  # 02:00 UTC daily
    },
}
```

### Phase 9: Ingestion Hooks (Existing Services)

Modify existing services to publish to signal event bus:

1. **SignalDetectionService** → Publish Explorium/CrustData signals
2. **SignalFetcherService** → Publish RSS signals
3. **VisitorsService** → Publish website visit signals
4. **EmailCampaignService** → Publish email-open signals

Example:
```python
# In signal_detection_service.py
async def detect_signals(...):
    signals = await self.explorium.search_companies(...)

    # Publish each to event bus
    for signal in signals:
        await signal_event_bus.publish_signal({
            "type": "hiring",  # or "funding", etc.
            "source": "explorium",
            "company": signal["company"],
            "raw_data": signal,
            "discovered_at": datetime.now(),
        })

    return signals
```

### Phase 10: API Routes for Signal Management

**File:** `Backend/app/api/routes/signals.py` (extends existing)

New endpoints:
```python
GET  /api/v1/signals                     # Active signals grouped by type/company
GET  /api/v1/signals/{signal_id}         # Single signal detail
GET  /api/v1/signals/stats               # Signal stats + fresh vs archived counts
GET  /api/v1/signals/dedup-window        # Check if company+type would be deduped
POST /api/v1/signals/archive-manual      # Manually archive a signal
POST /api/v1/signals/copilot-queue       # Peek at Co-Pilot queue
DELETE /api/v1/signals/{signal_id}       # Soft-delete (mark as archived)
```

---

## 4. Signal Type Details

### Job Change (from Explorium/CrustData)
- Use: Explorium "people changes" API if available, else CrustData job history
- Trigger: When prospect's job_title changes or company changes in enrichment
- ICP relevance: Are they now at a target company? Is their new title in our persona?
- Credit cost: 2

### Funding (from Explorium + RSS)
- Use: Explorium company funding data + Google News RSS for "funding round"
- Trigger: New funding record detected via API or news mention
- ICP relevance: Company at target stage? New capital = hiring budget
- Credit cost: 3

### Hiring (from Explorium + LinkedIn)
- Use: Explorium "job openings" data + LinkedIn job posts via RSS
- Trigger: Company has open positions > baseline
- ICP relevance: Growing headcount = sales opportunity
- Credit cost: 2

### G2 Intent (from RSS or webhook)
- Use: Google News RSS for "G2 review G2.com"
- Trigger: Prospect/company mentioned in G2 reviews
- ICP relevance: Considering competitors or similar solutions
- Credit cost: 4 (variable, higher value)

### Website Visit (from Visitors tracking)
- Use: `visitors.py` tasks — IP resolution already exists
- Trigger: Anonymous visitor enriched to person + company
- ICP relevance: Company visiting = inbound intent
- Credit cost: 1 (low — we control sourcing)

### Email Open (from campaign tracking)
- Use: Campaign service email open events
- Trigger: Prospect opened email from user's campaign
- ICP relevance: Engagement signal
- Credit cost: 1 (low — we control sourcing)

### LinkedIn Activity (from RSS feeds)
- Use: Google News RSS for LinkedIn posts by person/company
- Trigger: New post or high-engagement post detected
- ICP relevance: Thought leadership, expansion, product launches
- Credit cost: 2

---

## 5. File-by-File Checklist

### Backend — New Files

| # | File | Purpose |
|---|------|---------|
| 1  | `app/db/models/signal_event.py` | SignalEvent model (persist all signals) |
| 2  | `app/services/signal_pipeline/__init__.py` | Package init |
| 3  | `app/services/signal_pipeline/signal_event_bus.py` | Redis Streams orchestrator |
| 4  | `app/services/signal_pipeline/signal_ingester.py` | Ingest from various sources |
| 5  | `app/services/signal_pipeline/signal_enricher.py` | Resolve company domain, contact |
| 6  | `app/services/signal_pipeline/signal_deduplicator.py` | 24hr dedup check + enforcement |
| 7  | `app/services/signal_pipeline/signal_credits.py` | Credit deduction logic |
| 8  | `app/services/signal_pipeline/icp_signal_scorer.py` | Score signal vs user's ICP |
| 9  | `app/services/signal_pipeline/signal_archiver.py` | Archive signals >7 days old |
| 10 | `app/tasks/signal_tasks.py` | Celery tasks for signal processing |
| 11 | `alembic/versions/xxx_add_signal_events_table.py` | Database migration |

### Backend — Modified Files

| # | File | Change |
|---|------|--------|
| 1  | `app/db/models/__init__.py` | Import `SignalEvent` |
| 2  | `app/main.py` | No change needed (Celery already running) |
| 3  | `app/services/signal_detection_service.py` | Publish signals to event bus on detection |
| 4  | `app/services/signal_fetcher_service.py` | Wrap RSS results in event format |
| 5  | `app/api/routes/signals.py` | Add new /api/v1/signals/* endpoints for queue mgmt |
| 6  | `app/tasks/copilot_tasks.py` | Add Co-Pilot queue consumption task |

### Frontend — Modified (Optional, for signal dashboard)

| # | File | Change |
|---|------|--------|
| 1  | `app/(dashboard)/signals/page.tsx` | Show signal type filters, ICP scores, freshness status |
| 2  | `components/signals/signal-card.tsx` | Display signal with type badge, ICP score, archived status |

---

## 6. Implementation Order

**Week 1:**
- Phase 1–2: Database model + event bus infrastructure
- Phase 3–4: Enrichment + ICP scoring
- Phase 5–6: Deduplication + credit consumption

**Week 2:**
- Phase 7–8: Freshness mgmt + Celery tasks
- Phase 9: Hook into existing services
- Phase 10: API routes + testing

**Week 3:**
- Refinement, tuning, and production readiness
- Load testing (10k events/minute simulation)
- Frontend dashboard updates

---

## 7. Performance Targets

- **Event bus throughput:** 10k+ signals/minute (Redis Streams native capability)
- **Enrichment latency:** < 500ms per signal (batched)
- **Dedup check latency:** < 50ms per signal (Redis mem ops)
- **ICP score latency:** < 200ms per signal (mock scoring)
- **Daily archival time:** < 5 min for 1M signals

---

## 8. Testing Strategy

1. **Unit tests:** Each service (enricher, deduplicator, scorer)
2. **Integration tests:** Full pipeline from ingestion to Co-Pilot queue
3. **Load test:** Simulate 10k events/min for 10 min
4. **Dedup test:** Inject same signal 50x in 24hr → verify 49 suppressed
5. **Credit test:** Verify correct deductions by type
6. **Freshness test:** Verify 7-day archival works
7. **End-to-end:** Trace one signal from ingestion to Co-Pilot co-pilot webhook

---

## 9. Monitoring & Observability

Add Prometheus metrics:
- `signals_ingested_total` (by type)
- `signals_deduplicated_total` (by type)
- `signals_icp_score` (histogram)
- `signals_credits_consumed_total` (by type)
- `signals_event_bus_lag_seconds` (Celery task lag)
- `signals_archived_total` (by day)

Add structured logging:
- Every ingest: type, source, company, score, credits
- Every dedup suppress: reason, domain, type, last_seen
- Every archival batch: count, time taken
