# PRD: Explorium Events → Signal Cards Integration

**Branch:** `signals`
**Status:** Implemented
**Date:** 2026-03-18

---

## 1. Overview

Surface Explorium Business Events and Prospect Events as structured signal cards in the Signals → Events tab, with full enrollment management (subscribe, update, delete, list) and real-time event feeds.

---

## 2. Problem Statement

The signals branch had partial Explorium scaffolding (`fetch_business_events`, `fetch_prospect_events` in `explorium_service.py`) but no dedicated UI, no enrollment CRUD, and the existing `events/page.tsx` only filtered RSS/social signals — it had no awareness of Explorium events.

---

## 3. Goals

- Wire all 10 Explorium event endpoints (5 for businesses, 5 for prospects)
- Map every event type to a structured, colour-coded signal card
- Build a dedicated Events dashboard with tabs, filters, and enrollment management
- Maintain backward compatibility — no changes to existing signal endpoints

---

## 4. Event Types

### Business Event Types

| Key | Display Name | Category | Impact |
|-----|-------------|----------|--------|
| `ipo_announcement` | IPO Announcement | Growth | High |
| `new_funding_round` | New Funding Round | Growth | High |
| `new_investment` | New Investment | Growth | Medium |
| `merger_and_acquisitions` | M&A Activity | Corporate | High |
| `cost_cutting` | Cost Cutting | Risk | High |
| `increase_in_all_departments` | Workforce Expansion | Growth | Medium |
| `decrease_in_all_departments` | Workforce Reduction | Risk | High |
| `new_partnership` | New Partnership | Corporate | Medium |
| `product_launch` | Product Launch | Growth | Medium |
| `office_opening` | Office Opening | Growth | Low |
| `awards` | Award / Recognition | Growth | Low |
| `security_breach` | Security Breach | Risk | High |
| `lawsuit` | Legal / Lawsuit | Risk | High |

### Prospect Event Types

| Key | Display Name | Impact |
|-----|-------------|--------|
| `prospect_changed_company` | Company Switch | High |
| `prospect_changed_role` | Role Change | Medium |
| `prospect_job_start_anniversary` | Work Anniversary | Low |

---

## 5. Signal Card Schema

```typescript
interface ExploriumEventCard {
  id: string              // "{entity_id}-{event_name}-{timestamp}"
  entityId: string        // business_id or prospect_id
  entityName: string      // company name or prospect name
  entityType: "business" | "prospect"
  eventType: string       // raw Explorium event key
  eventLabel: string      // display name
  category: string        // "Growth" | "Risk" | "Corporate" | "Prospect"
  timestamp: string       // ISO 8601 datetime
  description: string     // human-readable summary built from event fields
  sourceUrl?: string      // link to source article if available
  impact: "high" | "medium" | "low"
  metadata: Record<string, any>  // full raw event payload
}
```

---

## 6. API Endpoints

All under `/api/v1/events`, JWT required.

### Business Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/businesses/events` | Fetch events → normalised signal cards |
| `POST` | `/businesses/enrollments` | Subscribe businesses to event monitoring |
| `PATCH` | `/businesses/enrollments` | Update event types for an enrollment |
| `DELETE` | `/businesses/enrollments` | Remove a business from monitoring |
| `GET` | `/businesses/enrollments` | List all active business enrollments |

### Prospect Events

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/prospects/events` | Fetch events → normalised signal cards |
| `POST` | `/prospects/enrollments` | Subscribe prospects to event monitoring |
| `PATCH` | `/prospects/enrollments` | Update event types for an enrollment |
| `DELETE` | `/prospects/enrollments` | Remove a prospect from monitoring |
| `GET` | `/prospects/enrollments` | List all active prospect enrollments |

### Utility

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/metadata` | Returns all event type keys, labels, impacts, categories |

---

## 7. Files Changed

| File | Action |
|------|--------|
| `Backend/app/services/explorium_service.py` | Added 7 methods: `get_business_enrollments`, `update_business_enrollment`, `delete_business_enrollment`, `enroll_prospect_events`, `get_prospect_enrollments`, `update_prospect_enrollment`, `delete_prospect_enrollment` |
| `Backend/app/api/routes/events_routes.py` | Created — 11 endpoints + event-to-card normalizers |
| `Backend/app/main.py` | Registered `events_routes.router` at `/api/v1/events` |
| `Frontend/lib/api/events.ts` | Created — typed API client |
| `Frontend/components/signals/explorium-event-card.tsx` | Created — event signal card component |
| `Frontend/app/(dashboard)/signals/events/page.tsx` | Rewritten — full Explorium events dashboard |

---

## 8. Verification Steps

1. Start backend: `cd Backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
2. Check `GET /docs` → confirm `/api/v1/events/*` endpoints appear
3. Test `GET /api/v1/events/metadata` → returns business + prospect event type lists
4. Test `POST /api/v1/events/businesses/enrollments` with a real `business_id`
5. Test `GET /api/v1/events/businesses/enrollments` → returns enrolled entity
6. Test `POST /api/v1/events/businesses/events` → returns normalised signal cards
7. Navigate to `http://localhost:3000/signals/events` → Business/Prospect tabs visible
8. Add a business enrollment → verify it appears in the Enrollments panel
9. Edit enrollment event types → verify PATCH updates correctly
10. Delete enrollment → entity disappears from panel
