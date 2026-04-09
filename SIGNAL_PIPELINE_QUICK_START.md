# Signal Pipeline — Quick Start Guide

## Publishing Your First Signal

### Option 1: Via HTTP API

```bash
curl -X POST http://localhost:8000/api/v1/signals/pipeline/publish \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "signal_type": "funding",
    "source": "explorium",
    "company_domain": "acme.com",
    "company_name": "Acme Corp",
    "raw_data": {
      "funding_round": "Series B",
      "amount": 25000000
    }
  }'
```

### Option 2: Via Python (in your service)

```python
from app.services.signal_pipeline import SignalEventBus
from app.services.signal_pipeline.signal_event_bus import SignalEventPayload

# Create event bus
event_bus = SignalEventBus()

# Create signal payload
payload = SignalEventPayload(
    signal_type="job_change",
    source="crustdata",
    company_domain="newjob.com",
    company_name="New Job Inc",
    prospect_email="john@newjob.com",
    prospect_name="John Doe",
    raw_data={
        "old_company": "Old Corp",
        "title": "VP Sales"
    }
)

# Publish (async)
stream_id = await event_bus.publish_signal(payload)
print(f"Signal published: {stream_id}")
```

### Option 3: Via Signal Source Integrations

```python
from app.services.signal_pipeline.signal_source_integrations import SignalSourceIntegrations

integrations = SignalSourceIntegrations()

# Publish funding signal
await integrations.ingest_funding_from_explorium(
    company_name="TechStartup",
    company_domain="techstartup.com",
    funding_amount=10_000_000,
    funding_round="Series A"
)

# Publish hiring signal
await integrations.ingest_hiring_from_linkedin(
    company_name="GrowthCo",
    company_domain="growthco.com",
    open_positions=5,
    departments=["Sales", "Engineering"]
)

# Publish job change signal
await integrations.ingest_job_change_from_crustdata(
    prospect_email="jane@acme.com",
    prospect_name="Jane Smith",
    old_company="OldCorp",
    new_company="Acme Corp"
)
```

---

## Supported Signal Types

| Signal Type | Source | Credit Cost | Use Case |
|---|---|---|---|
| `job_change` | CrustData | 2 | Prospect moved to new company |
| `funding` | Explorium/Crunchbase | 3 | New funding round announced |
| `hiring` | LinkedIn | 2 | Company posting job openings |
| `g2_intent` | G2 | 4 | Company evaluating solutions |
| `website_visit` | Visitor tracking | 1 | Known visitor enriched |
| `email_open` | Campaign | 1 | Prospect opened email |
| `linkedin_activity` | LinkedIn | 2 | Prospect posted or engaged |

---

## Querying Signals

### Get Active Signals

```bash
curl "http://localhost:8000/api/v1/signals/pipeline/active?limit=50" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Filters:**
- `signal_type=funding` — Only funding signals
- `company_domain=acme.com` — Only Acme Corp
- `limit=100` — Max 500
- `offset=50` — Pagination

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "signal_type": "funding",
    "source": "explorium",
    "company_domain": "acme.com",
    "company_name": "Acme Corp",
    "icp_score": 87,
    "icp_match_factors": ["high_revenue", "hiring_activity"],
    "credits_consumed": 3,
    "discovered_at": "2026-03-31T10:00:00Z",
    "ingested_at": "2026-03-31T10:01:23Z"
  }
]
```

### Get Statistics

```bash
curl http://localhost:8000/api/v1/signals/pipeline/statistics \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**
```json
{
  "total_signals": 523,
  "active_signals": 412,
  "archived_signals": 111,
  "by_type": {
    "email_open": 150,
    "website_visit": 120,
    "hiring": 85,
    "job_change": 40,
    "funding": 28
  }
}
```

---

## Admin Operations

### Manually Trigger Signal Processing

```bash
curl -X POST http://localhost:8000/api/v1/signals/pipeline/admin/trigger-processing \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN"
```

### Trigger Archival Now

```bash
curl -X POST http://localhost:8000/api/v1/signals/pipeline/admin/trigger-archival \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN"
```

### Inspect Redis Stream Health

```bash
curl http://localhost:8000/api/v1/signals/pipeline/admin/event-bus-stats \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN"
```

**Response:**
```json
{
  "status": "ok",
  "stats": {
    "stream_length": 42,
    "consumer_count": 1,
    "pending_messages": 5
  }
}
```

### Peek at Co-Pilot Queue

```bash
curl "http://localhost:8000/api/v1/signals/pipeline/admin/copilot-queue-peek?limit=5" \
  -H "Authorization: Bearer $ADMIN_JWT_TOKEN"
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Sources                             │
│  (CrustData, Explorium, LinkedIn, RSS, Campaign, G2, Visitor)  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│              Signal Event Bus (Redis Streams)                   │
│       outmate:signals:stream:events (partition by time)         │
└────────────────────────┬────────────────────────────────────────┘
                         │ Consumed by Celery task (1 min interval)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            Signal Processing Pipeline                           │
│   ┌─────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐     │
│   │ Dedup Check │→│ Enrichment│→│ICP Score │→│Credits   │     │
│   │ (24hr TTL)  │ │(Company)  │ │ (0-100)  │ │Deduction │     │
│   └─────────────┘ └───────────┘ └──────────┘ └──────────┘     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    ↓         ↓
            ┌───────────┐  ┌─────────────────┐
            │ Persistence   │ Co-Pilot Queue  │
            │ (PostgreSQL)  │  (Redis List)   │
            │signal_events  │copilot:queue    │
            └───────────┘  └─────────────────┘
                    ↓
            ┌───────────────────┐
            │ Active Feed       │
            │ (Non-archived)    │
            └───────────────────┘
```

---

## Scheduled Tasks

### Every minute: Process Signals
```
celery: process_signal_events_task
├ Consume up to 100 signals from stream
├ Ingest → Dedup → Enrich → Score → Co-Pilot
└ Acknowledge processed signals
```

### Daily at 02:00 UTC: Archive Stale Signals
```
celery: archive_stale_signals_task
├ Find signals > 7 days old
├ Mark is_archived = true
└ Remove from active feeds
```

---

## Example: Integrating CrustData Job Changes

```python
# In your CrustData webhook handler

from app.services.signal_pipeline.signal_source_integrations import SignalSourceIntegrations

async def handle_job_change_webhook(crustdata_event):
    """Process CrustData job change webhook."""
    integrations = SignalSourceIntegrations()

    # Extract data from CrustData
    prospect_email = crustdata_event['email']
    prospect_name = crustdata_event['full_name']
    new_company_domain = crustdata_event['new_company_domain']
    new_company_name = crustdata_event['new_company_name']

    # Publish signal
    stream_id = await integrations.ingest_job_change_from_crustdata(
        prospect_email=prospect_email,
        prospect_name=prospect_name,
        old_company=crustdata_event['old_company_name'],
        new_company=new_company_name,
        new_company_domain=new_company_domain,
        raw_data=crustdata_event
    )

    logger.info(f"Job change signal published: {stream_id}")
    return {"status": "accepted", "stream_id": stream_id}
```

---

## Monitoring

### View Celery Task Logs

```bash
docker-compose logs -f celery-worker | grep "signal"
```

### Check Redis Streams

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# View stream info
XINFO STREAM outmate:signals:stream:events

# View dedup cache size
DBSIZE  # Total keys (includes everything)

# View specific fingerprint TTL
TTL outmate:signals:dedup:24h:abc123def456
```

### Check Database

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d outmate

# View signal counts
SELECT signal_type, COUNT(*) FROM signal_events
WHERE is_archived = false
GROUP BY signal_type;

# View recent signals
SELECT id, signal_type, company_domain, icp_score, ingested_at
FROM signal_events
ORDER BY ingested_at DESC
LIMIT 10;

# View credit consumption
SELECT signal_type, SUM(credits_consumed)
FROM signal_events
GROUP BY signal_type;
```

---

## Troubleshooting

### Signals not appearing in active feed

**Check:**
1. Signal was published: `curl http://localhost:8000/api/v1/signals/pipeline/admin/event-bus-stats`
2. Celery worker is running: `docker-compose logs celery-worker`
3. Database connection: `curl http://localhost:8000/health/db`

### High CPU/Memory usage

**Likely cause:** Processing stalled, stream backlog growing
**Solution:**
1. Restart Celery worker: `docker-compose restart celery-worker`
2. Check Redis memory: `redis-cli INFO memory`
3. Check database connections: Monitor active connections

### Deduplication not working

**Check:**
1. Fingerprints are consistent: Same signal should produce same hash
2. Redis connection: `redis-cli ping`
3. Debug by adding log: `logger.debug(f"Fingerprint: {fingerprint}")`

---

## Credit Management

### Check User Credits

```python
from app.services.signal_pipeline import SignalCreditManager
from sqlalchemy.orm import Session

db = Session()
credit_mgr = SignalCreditManager(db)

credits = await credit_mgr.get_user_credits(user_id)
print(f"User has {credits} credits")
```

### Add Credits (Admin)

```python
from app.db.models.credit import CreditTransaction
from app.db.models.user import User

user = db.query(User).get(user_id)
user.credits_balance += 100

transaction = CreditTransaction(
    user_id=user_id,
    amount=100,
    transaction_type="refund",
    description="Admin credit adjustment"
)
db.add(transaction)
db.commit()
```

---

## Production Checklist

- [ ] Celery worker running and healthy
- [ ] Celery beat (scheduler) running
- [ ] Redis cluster/instance available
- [ ] PostgreSQL connection pooling configured
- [ ] Signal type credit costs reviewed
- [ ] ICP scoring criteria customized (if needed)
- [ ] Dedup window (24hr) appropriate for your data
- [ ] Archival task scheduled (02:00 UTC)
- [ ] Log level set appropriately
- [ ] Monitoring/alerting configured for signal backlog
- [ ] Co-Pilot consumers ready to process signal queue
