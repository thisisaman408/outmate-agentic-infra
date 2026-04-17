import { authService } from "@/lib/auth"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const fetchWithAuth = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value)
    }
  })
  return fetch(url, { ...init, headers })
}

// ── Types ────────────────────────────────────────────────────────────

export interface CalendarStatus {
  connected: boolean
  email?: string | null
  push_notifications?: {
    active: boolean
    expires_at: string | null
    channel_id: string | null
  } | null
}

export interface CalendarAttendee {
  email: string
  name: string
  response_status: string
  is_external: boolean
  is_organizer: boolean
}

export interface CalendarEvent {
  id: string
  google_event_id: string
  summary: string | null
  location: string | null
  start_time: string | null
  end_time: string | null
  status: string
  attendee_count: number
  external_attendee_count: number
  has_external_attendees: boolean
  is_large_meeting: boolean
  attendees: CalendarAttendee[]
  prep_scheduled: boolean
  prep_completed: boolean
  matched_prospects: any[]
  matched_companies: any[]
  recurring: boolean
}

export interface CalendarEventDetail extends CalendarEvent {
  description_snippet: string | null
  organizer_email: string | null
}

export interface SyncResult {
  created: number
  updated: number
  skipped: number
}

// ── API Client ───────────────────────────────────────────────────────

export const calendarApi = {
  // Status
  getStatus: async (): Promise<CalendarStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/status`)
    if (!response.ok) throw new Error("Failed to get calendar status")
    return response.json()
  },

  // Enable / Disable push notifications
  enable: async (): Promise<{ success: boolean; channel: any }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/enable`, {
      method: "POST",
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to enable calendar sync")
    }
    return response.json()
  },

  disable: async (): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/disable`, {
      method: "POST",
    })
    if (!response.ok) throw new Error("Failed to disable calendar sync")
    return response.json()
  },

  // Manual sync
  sync: async (): Promise<{ success: boolean; sync: SyncResult; preps_scheduled: number }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/sync`, {
      method: "POST",
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to sync calendar")
    }
    return response.json()
  },

  // Events
  getEvents: async (days: number = 7): Promise<{ events: CalendarEvent[]; count: number }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/events?days=${days}`)
    if (!response.ok) throw new Error("Failed to load calendar events")
    return response.json()
  },

  getEvent: async (eventId: string): Promise<CalendarEventDetail> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/events/${eventId}`)
    if (!response.ok) throw new Error("Failed to load event")
    return response.json()
  },

  // Meeting prep
  triggerPrep: async (eventId: string): Promise<{ success: boolean; task_id: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/calendar/events/${eventId}/prep`, {
      method: "POST",
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to trigger meeting prep")
    }
    return response.json()
  },
}
