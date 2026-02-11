# OUTMATE.AI Database Schema Documentation

## Table of Contents
- [Overview](#overview)
- [Schema Design Decisions](#schema-design-decisions)
- [Database Architecture](#database-architecture)
- [Database Finder Feature](#database-finder-feature)
- [Setup & Migration Guide](#setup--migration-guide)
- [API Integration Points](#api-integration-points)

---

## Overview

The OUTMATE.AI database schema is designed as a **comprehensive, scalable B2B data intelligence platform** supporting multi-provider data aggregation, advanced filtering, credit-based usage tracking, and intelligent caching.

### Core Capabilities
✅ **Multi-Provider Support**: Crustdata, Exellius, Apollo (extensible)  
✅ **Dynamic Filter System**: Database-driven filters without code changes  
✅ **Credit Management**: Usage tracking with transaction history  
✅ **Intelligent Caching**: Query result caching for performance optimization  
✅ **Comprehensive Logging**: API usage monitoring and analytics  
✅ **Data Enrichment**: Quality scoring and multi-source enrichment tracking  

---

## Schema Design Decisions

### 1. **Provider-Agnostic Architecture**
**Decision**: Store `provider_source` as a string instead of a foreign key relationship.

**Rationale**:
- Flexibility to work with multiple data providers without schema changes
- Companies/prospects can come from any provider or be manually added
- Simplified data model without strict referential integrity constraints
- Easier to handle provider deprecation or API changes

**Example**:
```python
company = Company(
    domain="example.com",
    provider_source="crustdata",  # String, not FK
    external_id="crustdata_12345"
)
```

### 2. **JSONB for Flexibility**
**Decision**: Use PostgreSQL JSONB columns for semi-structured data: `raw_data`, `location_data`, `technologies`, `metadata`, `configuration`.

**Rationale**:
- Provider responses vary significantly in structure
- Store complete original responses for audit/debugging
- Query nested data efficiently with GIN indexes
- No schema migrations needed when providers add new fields

**Example**:
```python
company.raw_data = {
    "original_response": {...},
    "enrichment_history": [...],
    "custom_fields": {...}
}
```

### 3. **Separate Tables for Configuration**
**Decision**: Create `available_filters` and `provider_filter_mappings` tables instead of hardcoding filters.

**Rationale**:
- Configure filters via admin UI without code deployment
- Support "locked" premium filters requiring credits
- Map provider-specific filter keys to universal filter definitions
- Enable A/B testing of filter offerings

**Example**: Industry filter works for both Crustdata (`industry`) and Exellius (`company_industry`):
```sql
INSERT INTO provider_filter_mappings (provider_id, filter_id, provider_filter_key)
VALUES 
  ('provider-1', 'filter-industry', 'industry'),
  ('provider-2', 'filter-industry', 'company_industry');
```

### 4. **Separation of Search Queries and Results**
**Decision**: `search_queries` stores query metadata, `search_results` links to actual companies/prospects.

**Rationale**:
- Track query performance independently from results
- Enable result pagination and re-sorting
- Calculate relevance scores per result
- Support saved searches and query sharing

### 5. **Credit System Design**
**Decision**: Track `credits_balance` in users table + full transaction log in `credit_transactions`.

**Rationale**:
- Fast credit checks (single row lookup)
- Complete audit trail of all transactions
- Support refunds, bonuses, and adjustments
- Link transactions to specific searches via `reference_id`

---

## Database Architecture

### Entity Relationship Overview

```
┌─────────────┐
│    USERS    │──┬──> CREDIT_TRANSACTIONS
└─────────────┘  │
                 ├──> SEARCH_QUERIES ──┬──> SEARCH_RESULTS ──┬──> COMPANIES
                 │                      │                      │
                 └──> EXPORT_JOBS       └────────────────────┴──> PROSPECTS

┌──────────────────┐
│  DATA_PROVIDERS  │──> PROVIDER_FILTER_MAPPINGS ──> AVAILABLE_FILTERS
└──────────────────┘

CACHED_QUERIES (standalone for performance)
API_USAGE_LOGS (standalone for monitoring)
```

### Table Descriptions

#### 1. **users**
Stores user accounts with subscription tiers and credit balances.

**Key Fields**:
- `subscription_tier`: `free` (100 credits), `basic`, `pro`, `enterprise`
- `credits_balance`: Current available credits (default: 100)
- `is_active`: Soft delete flag
- `last_login_at`: Activity tracking

**Indexes**: `email`, `is_active`

---

#### 2. **credit_transactions**
Immutable log of all credit purchases and usage.

**Transaction Types**:
- `purchase`: User buys credits
- `usage`: Credits deducted for search
- `refund`: Credits returned
- `bonus`: Free credits awarded

**Key Fields**:
- `amount`: Positive (purchase) or negative (usage)
- `reference_id`: Links to `search_queries.id` for usage tracking
- `metadata`: Additional context (e.g., payment details, promo codes)

**Indexes**: `user_id`, `transaction_type`, `created_at`

---

#### 3. **data_providers**
Configuration for all data providers (Crustdata, Exellius, etc.).

**Key Fields**:
- `provider_slug`: URL-safe identifier (`crustdata`, `exellius`)
- `priority`: Higher number = preferred provider
- `is_active`: Enable/disable provider without deleting
- `rate_limit_per_minute`: API throttling configuration
- `configuration`: JSONB with API keys, base URLs, custom settings

**Example**:
```json
{
  "api_key": "CRUSTDATA_KEY_123",
  "timeout_seconds": 30,
  "max_results_per_query": 1000
}
```

---

#### 4. **available_filters**
Defines all searchable filters in a database-driven manner.

**Filter Types**:
- `basic`: Free for all users (Industry, Location, Company Size)
- `advanced`: Requires credits (Technologies, Funding Stage)
- `premium`: High-value filters (Buyer Intent, Job Openings)

**Key Fields**:
- `filter_key`: Unique identifier (`industry`, `employee_count`)
- `filter_category`: `firmographic`, `technographic`, `behavioral`, `prospect`
- `data_type`: `string`, `array`, `range`, `number`, `boolean`, `object`
- `input_type`: Frontend control type (`select`, `multiselect`, `range`, `text`)
- `is_locked`: Requires premium subscription
- `credits_required`: Cost per use
- `options`: JSONB array for dropdown values

**Example**:
```json
{
  "filter_key": "industry",
  "filter_type": "basic",
  "options": ["Software", "Healthcare", "Finance", "Retail"]
}
```

---

#### 5. **provider_filter_mappings**
Maps universal filters to provider-specific implementations.

**Purpose**: 
- Crustdata might call "employee count" → `employee_range`
- Exellius might call it → `company_size`
- Our system uses → `employee_count`

**Key Fields**:
- `provider_filter_key`: Provider's actual API parameter name
- `mapping_config`: JSONB with transformation rules

**Example**:
```json
{
  "transform": "range_to_array",
  "value_mapping": {
    "1-10": "micro",
    "11-50": "small"
  }
}
```

---

#### 6. **companies**
Comprehensive company profiles from all providers.

**Data Categories**:
- **Firmographic**: Industry, revenue, employee count, company type
- **Location**: Multi-field location (country, state, city, full address)
- **Technographic**: Technologies array (["AWS", "Salesforce", "React"])
- **Funding**: Stage, total raised, last funding date
- **Social**: LinkedIn, Twitter, Facebook URLs
- **Metadata**: Provider source, enrichment status, quality score

**Key Fields**:
- `domain`: Primary unique identifier
- `employee_count_range` + `employee_count_exact`: Support both range and exact values
- `revenue_range` + `revenue_exact`: Same dual approach
- `technologies`: JSONB array for tech stack
- `data_quality_score`: 0-100 quality rating
- `enriched`: Flag indicating if data has been enhanced

**Indexes**: `domain`, `name`, `industry`, `headquarters_country`, `employee_count_range`, `provider_source`, `enriched`

---

#### 7. **prospects**
Individual contacts within companies.

**Key Fields**:
- `company_id`: Links to companies (SET NULL on delete)
- `full_name`: Computed from first + last name
- `job_title` + `seniority_level` + `department`: Role classification
- `email_verified`: Email validation status
- `data_quality_score`: Contact data reliability (0-100)

**Indexes**: `email`, `company_id`, `full_name`, `job_title`, `seniority_level`, `department`, `provider_source`

---

#### 8. **search_queries**
Records all searches performed by users.

**Search Types**:
- `companies`: Company-only search
- `prospects`: People-only search
- `combined`: Companies with associated prospects

**Key Fields**:
- `query_name`: User-assigned name for saved searches
- `query_params`: JSONB with all filter values
- `providers_used`: Array of providers queried (["crustdata", "exellius"])
- `primary_provider`: Which provider returned most results
- `execution_time_ms`: Performance tracking
- `is_saved`: Flag for saved searches
- `error_message`: Failure details for debugging

**Indexes**: `user_id`, `search_type`, `created_at`, `is_saved`

---

#### 9. **search_results**
Links search queries to individual results.

**Key Fields**:
- `result_type`: `company` or `prospect`
- `result_position`: Ordering (1, 2, 3...)
- `relevance_score`: 0-100 match quality

**Constraint**: Ensures either `company_id` or `prospect_id` is set, not both.

**Indexes**: `search_query_id`, `company_id`, `prospect_id`

---

#### 10. **cached_queries**
Performance optimization layer.

**Key Fields**:
- `query_hash`: SHA-256 of query parameters
- `results`: Cached JSONB response
- `expires_at`: TTL for cache invalidation
- `hit_count`: Track cache effectiveness

**Example**:
```sql
-- Query hash based on normalized params
SHA256({"industry": ["Software"], "country": ["United States"]}) = "abc123..."

-- Cache HIT avoids API call
SELECT results FROM cached_queries 
WHERE query_hash = 'abc123...' AND expires_at > NOW();
```

**Indexes**: `query_hash`, `expires_at`

---

#### 11. **export_jobs**
Manages asynchronous data exports.

**Export Formats**: `csv`, `xlsx`, `json`

**Key Fields**:
- `record_count`: Number of results exported
- `file_size_bytes`: Storage tracking
- `file_url`: S3/storage download link
- `expires_at`: Download link expiration (e.g., 7 days)
- `status`: `pending`, `processing`, `completed`, `failed`

**Indexes**: `user_id`, `status`

---

#### 12. **api_usage_logs**
Comprehensive API request logging.

**Key Fields**:
- `endpoint`: API route (e.g., `/api/search/companies`)
- `method`: HTTP verb (GET, POST, etc.)
- `response_time_ms`: Performance monitoring
- `status_code`: Success/error tracking
- `ip_address`: INET type for geolocation analysis
- `error_message`: Failure details

**Use Cases**:
- Rate limiting enforcement
- Performance regression detection
- User behavior analytics
- Security audit trails

**Indexes**: `user_id`, `endpoint`, `created_at`

---

## Database Finder Feature

### Overview
The **Database Finder** feature allows users to search for companies and prospects using dynamic, multi-provider filters with intelligent credit management.

### How It Works

#### 1. **Filter Discovery**
```python
# Frontend requests available filters
GET /api/filters?category=firmographic&type=basic

# Backend queries available_filters table
filters = db.query(AvailableFilter).filter(
    AvailableFilter.filter_category == 'firmographic',
    AvailableFilter.filter_type == 'basic'
).all()

# Returns dynamic filter configuration
{
  "filters": [
    {
      "key": "industry",
      "name": "Industry",
      "input_type": "multiselect",
      "options": ["Software", "Healthcare", ...],
      "credits_required": 0,
      "is_locked": false
    }
  ]
}
```

#### 2. **Query Execution Flow**

**Step 1: User Submits Search**
```json
POST /api/search/companies
{
  "filters": {
    "industry": ["Software", "Healthcare"],
    "employee_count": ["51-200", "201-500"],
    "location_country": ["United States"]
  },
  "include_prospects": true
}
```

**Step 2: Check Cache**
```python
import hashlib
query_hash = hashlib.sha256(
    json.dumps(filters, sort_keys=True).encode()
).hexdigest()

cached = db.query(CachedQuery).filter(
    CachedQuery.query_hash == query_hash,
    CachedQuery.expires_at > datetime.now()
).first()

if cached:
    cached.hit_count += 1
    return cached.results  # ⚡ Cache HIT
```

**Step 3: Credit Validation**
```python
# Calculate required credits
credits_needed = calculate_credits(filters)

user = db.query(User).filter(User.id == user_id).first()
if user.credits_balance < credits_needed:
    raise InsufficientCreditsError()
```

**Step 4: Provider Selection**
```python
# Get active providers by priority
providers = db.query(DataProvider).filter(
    DataProvider.is_active == True
).order_by(DataProvider.priority.desc()).all()

# Map filters to provider-specific keys
for provider in providers:
    provider_params = map_filters(filters, provider.id)
    results = call_provider_api(provider, provider_params)
```

**Step 5: Store Results**
```python
# Create search query record
search_query = SearchQuery(
    user_id=user_id,
    query_params=filters,
    search_type='companies',
    providers_used=['crustdata'],
    primary_provider='crustdata',
    status='completed',
    execution_time_ms=elapsed_ms
)
db.add(search_query)

# Store companies
for company_data in results:
    company = Company(
        domain=company_data['domain'],
        name=company_data['name'],
        provider_source='crustdata',
        raw_data=company_data,
        ...
    )
    db.add(company)
    
    # Link to search
    search_result = SearchResult(
        search_query_id=search_query.id,
        result_type='company',
        company_id=company.id,
        result_position=position,
        relevance_score=calculate_relevance(company_data, filters)
    )
    db.add(search_result)

# Deduct credits
deduct_credits(user_id, credits_needed, search_query.id)
```

**Step 6: Cache Results**
```python
cached_query = CachedQuery(
    query_hash=query_hash,
    search_type='companies',
    query_params=filters,
    provider_source='crustdata',
    results=results_json,
    expires_at=datetime.now() + timedelta(hours=24)
)
db.add(cached_query)
```

#### 3. **Credit Deduction Function**
```python
def deduct_credits(user_id: UUID, amount: int, search_query_id: UUID):
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    
    if user.credits_balance < amount:
        raise InsufficientCreditsError()
    
    # Update balance
    user.credits_balance -= amount
    
    # Log transaction
    transaction = CreditTransaction(
        user_id=user_id,
        amount=-amount,  # Negative for usage
        transaction_type='usage',
        reference_id=search_query_id,
        description=f"Search query {search_query_id}"
    )
    db.add(transaction)
    db.commit()
```

#### 4. **Filter Mapping Example**

**Scenario**: User selects "Employee Count: 51-200" filter

**Universal Filter**:
```json
{
  "filter_key": "employee_count",
  "value": ["51-200"]
}
```

**Provider Mapping (Crustdata)**:
```json
{
  "provider_filter_key": "employee_range",
  "mapping_config": {
    "transform": "direct",
    "value_mapping": {
      "51-200": "51-200"
    }
  }
}
```

**Provider Mapping (Exellius)**:
```json
{
  "provider_filter_key": "company_size",
  "mapping_config": {
    "transform": "range_to_enum",
    "value_mapping": {
      "51-200": "medium"
    }
  }
}
```

**API Calls**:
```python
# Crustdata API
requests.post("https://api.crustdata.com/search", json={
    "employee_range": ["51-200"]
})

# Exellius API
requests.post("https://api.exellius.com/search", json={
    "company_size": ["medium"]
})
```

---

## Setup & Migration Guide

### Prerequisites
- PostgreSQL 14+
- Python 3.9+
- Supabase account with connection URL

### Step 1: Execute Schema in Supabase

1. Open your **Supabase SQL Editor**
2. Copy the entire schema from `database_schema.sql`
3. Execute the SQL (creates all tables, indexes, triggers, and sample data)
4. Verify tables created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Should show:
-- api_usage_logs
-- available_filters
-- cached_queries
-- companies
-- credit_transactions
-- data_providers
-- export_jobs
-- prospects
-- provider_filter_mappings
-- search_queries
-- search_results
-- users
```

### Step 2: Configure Environment Variables

Create/update `.env`:
```env
# Supabase PostgreSQL Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Optional: Connection Pooling (recommended for production)
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
```

### Step 3: Verify SQLAlchemy Models

Run model verification:
```bash
cd "d:\Projects\Product 4"
python -c "from app.db.models import *; print('✅ All models imported successfully')"
```

### Step 4: Test Database Connection

```python
from app.db.session import get_db
from app.db.models import User, DataProvider

db = next(get_db())

# Test query
providers = db.query(DataProvider).all()
print(f"Found {len(providers)} providers")

# Expected: Crustdata and Exellius
```

### Step 5: Initialize Default Data (Optional)

The schema already includes:
- ✅ Sample filters (industry, employee_count, revenue_range, etc.)
- ✅ Two providers (Crustdata active, Exellius disabled)
- ✅ Test user (`test@outmate.ai` with 1000 credits)

To create your own admin user:
```python
from app.db.models import User
from app.db.session import get_db

db = next(get_db())
admin = User(
    email="admin@yourcompany.com",
    full_name="Admin User",
    subscription_tier="enterprise",
    credits_balance=10000
)
db.add(admin)
db.commit()
```

### Step 6: Alembic Migration (Optional)

If you want to use Alembic for future migrations:

```bash
# Initialize Alembic (already done if alembic.ini exists)
alembic init alembic

# Generate initial migration
alembic revision --autogenerate -m "Initial schema from Supabase"

# Review migration file in alembic/versions/

# Apply migration (if needed)
alembic upgrade head
```

**Note**: Since you're directly executing the schema in Supabase, you may skip Alembic for the initial setup.

---

## API Integration Points

### 1. **Filter Management**

**Get Available Filters**:
```python
# app/services/filter_service.py
from app.db.models import AvailableFilter

def get_filters_by_type(db: Session, filter_type: str):
    return db.query(AvailableFilter).filter(
        AvailableFilter.filter_type == filter_type
    ).order_by(AvailableFilter.display_order).all()
```

**Check Filter Credits**:
```python
def calculate_filter_credits(filters: dict) -> int:
    total_credits = 0
    for filter_key, value in filters.items():
        filter_def = db.query(AvailableFilter).filter(
            AvailableFilter.filter_key == filter_key
        ).first()
        if filter_def:
            total_credits += filter_def.credits_required
    return total_credits
```

---

### 2. **Provider Integration**

**Get Active Providers**:
```python
# app/services/provider_service.py
from app.db.models import DataProvider

def get_active_providers(db: Session):
    return db.query(DataProvider).filter(
        DataProvider.is_active == True
    ).order_by(DataProvider.priority.desc()).all()
```

**Map Filters to Provider**:
```python
from app.db.models import ProviderFilterMapping

def map_filters_to_provider(
    db: Session, 
    provider_id: UUID, 
    filters: dict
) -> dict:
    provider_params = {}
    
    for filter_key, value in filters.items():
        mapping = db.query(ProviderFilterMapping).join(
            AvailableFilter
        ).filter(
            ProviderFilterMapping.provider_id == provider_id,
            AvailableFilter.filter_key == filter_key
        ).first()
        
        if mapping and mapping.is_supported:
            provider_key = mapping.provider_filter_key
            # Apply mapping config transformations
            transformed_value = apply_mapping(value, mapping.mapping_config)
            provider_params[provider_key] = transformed_value
    
    return provider_params
```

---

### 3. **Search Execution**

**Complete Search Flow**:
```python
# app/services/search_service.py
from app.db.models import SearchQuery, SearchResult, Company, CachedQuery
import hashlib
import json

async def execute_search(
    db: Session,
    user_id: UUID,
    filters: dict,
    search_type: str = 'companies'
):
    # 1. Check cache
    query_hash = hashlib.sha256(
        json.dumps(filters, sort_keys=True).encode()
    ).hexdigest()
    
    cached = db.query(CachedQuery).filter(
        CachedQuery.query_hash == query_hash,
        CachedQuery.expires_at > datetime.now()
    ).first()
    
    if cached:
        cached.hit_count += 1
        db.commit()
        return cached.results
    
    # 2. Validate credits
    credits_needed = calculate_filter_credits(filters)
    user = db.query(User).filter(User.id == user_id).first()
    if user.credits_balance < credits_needed:
        raise HTTPException(status_code=402, detail="Insufficient credits")
    
    # 3. Execute provider search
    start_time = time.time()
    providers = get_active_providers(db)
    
    all_results = []
    for provider in providers:
        provider_params = map_filters_to_provider(db, provider.id, filters)
        results = await call_provider_api(provider, provider_params)
        all_results.extend(results)
    
    execution_time = int((time.time() - start_time) * 1000)
    
    # 4. Create search query record
    search_query = SearchQuery(
        user_id=user_id,
        search_type=search_type,
        query_params=filters,
        result_count=len(all_results),
        credits_used=credits_needed,
        providers_used=[p.provider_slug for p in providers],
        primary_provider=providers[0].provider_slug,
        execution_time_ms=execution_time,
        status='completed'
    )
    db.add(search_query)
    db.flush()
    
    # 5. Store results
    for idx, result_data in enumerate(all_results):
        company = store_company(db, result_data, providers[0].provider_slug)
        
        search_result = SearchResult(
            search_query_id=search_query.id,
            result_type='company',
            company_id=company.id,
            result_position=idx + 1,
            relevance_score=calculate_relevance(result_data, filters)
        )
        db.add(search_result)
    
    # 6. Deduct credits
    deduct_credits(db, user_id, credits_needed, search_query.id)
    
    # 7. Cache results
    cache_results(db, query_hash, search_type, filters, all_results)
    
    db.commit()
    return all_results
```

---

### 4. **Export Management**

**Create Export Job**:
```python
# app/services/export_service.py
from app.db.models import ExportJob
import uuid

def create_export_job(
    db: Session,
    user_id: UUID,
    search_query_id: UUID,
    export_format: str = 'csv'
):
    export_job = ExportJob(
        user_id=user_id,
        search_query_id=search_query_id,
        export_format=export_format,
        status='pending'
    )
    db.add(export_job)
    db.commit()
    
    # Trigger async export processing
    process_export_async.delay(export_job.id)
    
    return export_job
```

**Process Export (Background Task)**:
```python
async def process_export(export_job_id: UUID):
    db = next(get_db())
    export_job = db.query(ExportJob).filter(ExportJob.id == export_job_id).first()
    
    try:
        export_job.status = 'processing'
        db.commit()
        
        # Fetch search results
        results = db.query(SearchResult).filter(
            SearchResult.search_query_id == export_job.search_query_id
        ).all()
        
        # Generate file
        file_path = generate_export_file(results, export_job.export_format)
        file_size = os.path.getsize(file_path)
        
        # Upload to S3/storage
        file_url = upload_to_storage(file_path)
        
        # Update export job
        export_job.status = 'completed'
        export_job.record_count = len(results)
        export_job.file_size_bytes = file_size
        export_job.file_url = file_url
        export_job.expires_at = datetime.now() + timedelta(days=7)
        export_job.completed_at = datetime.now()
        
        db.commit()
        
    except Exception as e:
        export_job.status = 'failed'
        export_job.error_message = str(e)
        db.commit()
```

---

## Key Features Summary

### ✅ Multi-Provider Support
- Dynamically switch between Crustdata, Exellius, Apollo
- Provider priority-based fallback
- Provider-agnostic filter mapping

### ✅ Credit Management
- User balance tracking
- Per-filter credit requirements
- Complete transaction audit trail
- Refund/bonus support

### ✅ Performance Optimization
- Query result caching (24-hour TTL)
- Cache hit tracking
- Database indexes on frequently queried fields

### ✅ Data Quality
- Enrichment status tracking
- Data quality scoring (0-100)
- Provider source attribution

### ✅ Flexible Filtering
- Database-driven filter configuration
- Locked premium filters
- Dynamic filter options

### ✅ Comprehensive Logging
- API request/response tracking
- Performance monitoring
- Error debugging

---

## Next Steps

1. **Set Up Provider API Keys**:
   - Update `data_providers.configuration` JSONB with actual API keys
   - Configure rate limits based on provider plans

2. **Implement Filter UI**:
   - Fetch filters from `/api/filters` endpoint
   - Render dynamic filter controls based on `input_type`
   - Show locked filters for premium users

3. **Build Search API**:
   - Implement `POST /api/search/companies` endpoint
   - Integrate credit validation
   - Add caching layer

4. **Create Export System**:
   - Set up background task queue (Celery/RQ)
   - Implement CSV/XLSX generation
   - Configure S3/storage for file hosting

5. **Add Analytics Dashboard**:
   - Query `api_usage_logs` for insights
   - Track most-used filters
   - Monitor search success rates

---

## Support

For questions or issues:
- **Database Schema**: Check Supabase SQL Editor for table structure
- **Model Definitions**: Review `/app/db/models/` Python files
- **API Integration**: See `/app/services/` for service layer examples

**Database Version**: 1.0  
**Last Updated**: 2026-01-28  
**Schema Compatibility**: PostgreSQL 14+
