# Social Listening v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Social Listening from basic MVP into production-grade social monitoring with multi-step wizard, boolean queries, multi-source monitoring (CrustData primary, Apify/BrightData enhancement), signal taxonomy, and auto-actions.

**Architecture:** Frontend 3-step wizard → Backend extended criteria schema → Multi-source dispatcher (CrustData always, Apify/BrightData when available) → LLM signal classifier → Auto-action pipeline. Graceful degradation: CrustData is the backbone, optional sources enhance without breaking.

**Tech Stack:** Next.js 16 + Tailwind + Radix UI (frontend), FastAPI + SQLAlchemy (backend), CrustData API (primary), Apify/BrightData (optional), OpenRouter LLM (classifier)

---

## File Structure

### New Files
- `Frontend/app/(dashboard)/social-agent/_components/create-search-wizard.tsx` — 3-step wizard
- `Frontend/app/(dashboard)/social-agent/_components/query-builder.tsx` — Boolean AND/OR/NOT builder
- `Frontend/app/(dashboard)/social-agent/_components/source-selector.tsx` — Source radio cards
- `Backend/app/services/social_listening/sources/__init__.py`
- `Backend/app/services/social_listening/sources/linkedin_crustdata.py` — CrustData LinkedIn posts
- `Backend/app/services/social_listening/sources/linkedin_apify.py` — Apify LinkedIn (optional)
- `Backend/app/services/social_listening/sources/twitter_apify.py` — Twitter/X (optional)
- `Backend/app/services/social_listening/sources/dispatcher.py` — Route to correct source
- `Backend/app/services/social_listening/classifier.py` — LLM signal taxonomy

### Modified Files
- `Frontend/app/(dashboard)/social-agent/page.tsx` — Extract components, wire wizard
- `Frontend/lib/social-listening.ts` — Extend CreateSearchPayload + types
- `Backend/app/api/routes/social_listening.py` — Add preview endpoint, extend create
- `Backend/app/services/social_listening/service.py` — Use dispatcher instead of agentic infra
- `Backend/app/db/models/signal_event.py` — Add taxonomy columns
- `Backend/app/core/settings.py` — Add APIFY_API_TOKEN, BRIGHTDATA settings

---

## Chunk 1: Backend — Multi-Source Dispatcher + CrustData Source

### Task 1: CrustData LinkedIn source

**Files:**
- Create: `Backend/app/services/social_listening/sources/__init__.py`
- Create: `Backend/app/services/social_listening/sources/linkedin_crustdata.py`

### Task 2: Source dispatcher

**Files:**
- Create: `Backend/app/services/social_listening/sources/dispatcher.py`

### Task 3: Apify LinkedIn source (optional enhancer)

**Files:**
- Create: `Backend/app/services/social_listening/sources/linkedin_apify.py`

### Task 4: Twitter/X Apify source (optional)

**Files:**
- Create: `Backend/app/services/social_listening/sources/twitter_apify.py`

### Task 5: Wire dispatcher into service.py

**Files:**
- Modify: `Backend/app/services/social_listening/service.py`

## Chunk 2: Backend — Signal Taxonomy + Extended Schema

### Task 6: Extend signal_event model with taxonomy

**Files:**
- Modify: `Backend/app/db/models/signal_event.py`
- Create: `Backend/alembic/versions/..._add_signal_taxonomy.py`

### Task 7: LLM signal classifier

**Files:**
- Create: `Backend/app/services/social_listening/classifier.py`

### Task 8: Extend search criteria schema + preview endpoint

**Files:**
- Modify: `Backend/app/api/routes/social_listening.py`
- Modify: `Frontend/lib/social-listening.ts`

## Chunk 3: Frontend — 3-Step Create Search Wizard

### Task 9: Source selector component

**Files:**
- Create: `Frontend/app/(dashboard)/social-agent/_components/source-selector.tsx`

### Task 10: Boolean query builder component

**Files:**
- Create: `Frontend/app/(dashboard)/social-agent/_components/query-builder.tsx`

### Task 11: Full 3-step wizard

**Files:**
- Create: `Frontend/app/(dashboard)/social-agent/_components/create-search-wizard.tsx`

### Task 12: Wire wizard into page + extract components

**Files:**
- Modify: `Frontend/app/(dashboard)/social-agent/page.tsx`
