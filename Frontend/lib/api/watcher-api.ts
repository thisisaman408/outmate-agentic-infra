/**
 * WATCHER API CLIENT
 * Real fetch implementations for all watcher endpoints.
 * Backend base: /api/v1/watchers/
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token') || localStorage.getItem('token')
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Watcher API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─────────────────────────────────────────────
// Types (mirror backend CreateWatcherRequest)
// ─────────────────────────────────────────────

export interface EventWatcherPayload {
  name: string
  description?: string
  type: 'event'
  criteria: {
    event_type?: string[]
    funding_stage?: string[]
    min_funding_amount?: number
    max_funding_amount?: number
    job_level?: string[]
    department?: string[]
    company_size?: string[]
    industry?: string[]
    location?: string[]
    keywords?: string[]
    technology_category?: string[]
  }
  notificationSettings?: {
    email: boolean
    slack?: string
  }
}

export interface AccountWatcherPayload {
  name: string
  description?: string
  type: 'account'
  accountName: string
  accountDomain: string
  triggers: string[]
  notificationSettings?: {
    email: boolean
    slack?: string
  }
}

export interface LeadWatcherPayload {
  name: string
  description?: string
  type: 'lead'
  leadName: string
  leadTitle?: string
  leadCompany: string
  leadEmail?: string
  triggers: string[]
  notificationSettings?: {
    email: boolean
  }
}

export interface WatcherRecord {
  id: string
  name: string
  description: string | null
  type: 'event' | 'account' | 'lead'
  status: 'active' | 'paused' | 'draft'
  criteria?: Record<string, unknown>
  account_name?: string
  account_domain?: string
  lead_name?: string
  lead_title?: string
  lead_company?: string
  lead_email?: string
  triggers?: string[]
  matches?: unknown[]
  recent_updates?: unknown[]
  match_count?: string
  last_triggered_at?: string
  new_matches_count?: number
  notification_settings?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SyncResult {
  watcher_id: string
  match_count: number
  new_matches_count: number
  last_synced_at: string
  matches?: unknown[]
  recent_updates?: unknown[]
  message?: string
}

// ─────────────────────────────────────────────
// API Methods
// ─────────────────────────────────────────────

/** List all watchers, optionally filtered by type */
export async function listWatchers(type?: 'event' | 'account' | 'lead'): Promise<WatcherRecord[]> {
  const q = type ? `?type=${type}` : ''
  return apiFetch<WatcherRecord[]>(`/api/v1/watchers/${q}`)
}

/** Get a single watcher with full details and matches */
export async function getWatcher(id: string): Promise<WatcherRecord> {
  return apiFetch<WatcherRecord>(`/api/v1/watchers/${id}`)
}

/** Create an Event Watcher */
export async function createEventWatcher(payload: EventWatcherPayload): Promise<WatcherRecord> {
  return apiFetch<WatcherRecord>('/api/v1/watchers/event', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Create an Account Watcher */
export async function createAccountWatcher(payload: AccountWatcherPayload): Promise<WatcherRecord> {
  return apiFetch<WatcherRecord>('/api/v1/watchers/account', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Create a Lead Watcher */
export async function createLeadWatcher(payload: LeadWatcherPayload): Promise<WatcherRecord> {
  return apiFetch<WatcherRecord>('/api/v1/watchers/lead', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** Toggle watcher status between active and paused */
export async function toggleWatcherStatus(id: string): Promise<WatcherRecord> {
  return apiFetch<WatcherRecord>(`/api/v1/watchers/${id}/toggle`, { method: 'POST' })
}

/** Trigger a sync to fetch the latest matches/updates for a watcher */
export async function syncWatcher(id: string): Promise<SyncResult> {
  return apiFetch<SyncResult>(`/api/v1/watchers/${id}/sync`, { method: 'POST' })
}

/** Delete a watcher permanently */
export async function deleteWatcher(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/watchers/${id}`, { method: 'DELETE' })
}
