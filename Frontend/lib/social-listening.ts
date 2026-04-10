// Social Listening API client — talks to /api/v1/social/* (proxied via Next.js rewrite).
// Auth header is auto-attached by AuthProvider's window.fetch patch.

const API = "/api/v1/social"

// ---------- Types ----------

export interface SocialSearch {
  id: string
  name: string
  description: string | null
  keywords: string[]
  signal_types: string[]
  schedule: string
  max_leads: number
  status: "active" | "paused"
  total_signals: number
  enriched_signals: number
  last_synced_at: string | null
  created_at: string | null
  client_company?: string | null
  client_description?: string | null
  sender_name?: string | null
  message_type?: string | null
  tone?: string | null
}

export interface SocialSignal {
  id: string
  signal_type: string
  person_name: string | null
  person_title: string | null
  person_company: string | null
  person_email: string | null
  person_email_verified: boolean
  person_linkedin: string | null
  post_url: string | null
  post_snippet: string | null
  best_hook: string | null
  intent_score: number | null
  intent_tier: "hot" | "warm" | "cold"
  match_factors: string[]
  matched_search_ids: string[]
  matched_search_names: string[]
  discovered_at: string
  outreach_message?: string | null
  outreach_char_count?: number | null
  // Taxonomy fields from signal classifier
  signal_category?: string | null
  signal_strength?: string | null
  funnel_stage?: string | null
  trigger_type?: string | null
}

export interface SocialStats {
  total_signals: number
  total_signals_delta_pct: number
  enriched_contacts: number
  enriched_contacts_delta_pct: number
  hot_intent_leads: number
  hot_intent_leads_delta: number
  active_searches: number
  running_searches: number
}

export interface CreateSearchPayload {
  name: string
  keywords: string[]
  description?: string
  signal_types?: string[]
  schedule?: string
  max_leads?: number
  // New v2 fields
  source?: string
  boolean_query?: {
    must: string[]
    should: string[]
    must_not: string[]
  }
  filters?: {
    job_titles?: string[]
    seniority?: string[]
    industries?: string[]
    languages?: string[]
    countries?: string[]
    hide_replies?: boolean
    must_contain_links?: boolean
    exclude_sponsored?: boolean
  }
  time_frame?: string
  auto_enrich?: boolean
  auto_outreach?: boolean
  auto_crm_push?: boolean
  // Legacy fields kept for backward compat
  client_company?: string
  client_description?: string
  sender_name?: string
  message_type?: string
  tone?: string
}

// ---------- Helpers ----------

async function json<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = JSON.parse(text)
      detail = j.detail || j.error || j.message || detail
    } catch { /* use default */ }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail))
  }
  return text ? JSON.parse(text) : null
}

// ---------- Searches CRUD ----------

export async function fetchSearches(): Promise<SocialSearch[]> {
  try {
    const res = await fetch(`${API}/searches`)
    return await json<SocialSearch[]>(res)
  } catch {
    return []
  }
}

export async function createSearch(p: CreateSearchPayload): Promise<SocialSearch> {
  const res = await fetch(`${API}/searches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  })
  return json<SocialSearch>(res)
}

export async function updateSearch(id: string, p: Partial<CreateSearchPayload> & { status?: string }): Promise<SocialSearch> {
  const res = await fetch(`${API}/searches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  })
  return json<SocialSearch>(res)
}

export async function deleteSearch(id: string): Promise<void> {
  await fetch(`${API}/searches/${id}`, { method: "DELETE" })
}

export async function runSearchNow(id: string): Promise<SocialSearch> {
  const res = await fetch(`${API}/searches/${id}/run-now`, { method: "POST" })
  return json<SocialSearch>(res)
}

// ---------- Signal feed ----------

export interface SignalFeedParams {
  search_id?: string
  signal_type?: string
  min_intent?: number
  sort?: "intent" | "recent" | "engagement"
  since?: "hour" | "today" | "week" | "month" | "all"
  limit?: number
}

export async function fetchSignals(params: SignalFeedParams = {}): Promise<SocialSignal[]> {
  try {
    const sp = new URLSearchParams()
    if (params.search_id) sp.set("search_id", params.search_id)
    if (params.signal_type && params.signal_type !== "all") sp.set("signal_category", params.signal_type)
    if (params.min_intent != null) sp.set("min_intent", String(params.min_intent))
    if (params.sort) sp.set("sort", params.sort)
    if (params.since) sp.set("since", params.since)
    if (params.limit) sp.set("limit", String(params.limit))
    const res = await fetch(`${API}/signals?${sp}`)
    return await json<SocialSignal[]>(res)
  } catch {
    return []
  }
}

// ---------- Stats ----------

export async function fetchStats(): Promise<SocialStats> {
  try {
    const res = await fetch(`${API}/stats`)
    return await json<SocialStats>(res)
  } catch {
    return {
      total_signals: 0,
      total_signals_delta_pct: 0,
      enriched_contacts: 0,
      enriched_contacts_delta_pct: 0,
      hot_intent_leads: 0,
      hot_intent_leads_delta: 0,
      active_searches: 0,
      running_searches: 0,
    }
  }
}

// ---------- Per-signal actions ----------

export async function enrichSignal(id: string) {
  const res = await fetch(`${API}/signals/${id}/enrich`, { method: "POST" })
  return json<any>(res)
}

export async function signalOutreach(id: string) {
  const res = await fetch(`${API}/signals/${id}/outreach`, { method: "POST" })
  return json<any>(res)
}

export async function signalCrmPush(id: string) {
  const res = await fetch(`${API}/signals/${id}/crm-push`, { method: "POST" })
  return json<any>(res)
}

// ---------- Constants ----------

export const SIGNAL_TYPE_OPTIONS = [
  { value: "all", label: "All Signals" },
  { value: "Sales-Led", label: "Sales-Led" },
  { value: "Product-Led", label: "Product-Led" },
  { value: "Community-Led", label: "Community-Led" },
  { value: "Competitor", label: "Competitor" },
  { value: "System", label: "Technographic" },
  { value: "Event", label: "Event" },
  { value: "Partner", label: "Partner" },
]

export const SORT_OPTIONS = [
  { value: "intent", label: "Highest Intent" },
  { value: "recent", label: "Most Recent" },
  { value: "engagement", label: "Most Engaged" },
]

export const SINCE_OPTIONS = [
  { value: "all", label: "Anytime" },
  { value: "hour", label: "Last hour" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
]

export const SCHEDULE_OPTIONS = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "manual", label: "Manual only" },
]

// ---------- Integrations ----------

export interface IntegrationStatus {
  email: { provider: string; connected: boolean; email: string | null }
  linkedin: { provider: string; connected: boolean }
  crm: { provider: string; connected: boolean; portal_id?: string | null; available?: boolean; status?: string }
}

export async function fetchIntegrations(): Promise<IntegrationStatus> {
  try {
    const res = await fetch(`${API}/integrations`)
    return await json<IntegrationStatus>(res)
  } catch {
    return {
      email: { provider: "gmail", connected: false, email: null },
      linkedin: { provider: "unipile", connected: false },
      crm: { provider: "hubspot", connected: false, status: "not_configured" },
    }
  }
}

export async function getHubSpotAuthUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/hubspot/auth-url`)
    const data = await json<{ url: string }>(res)
    return data.url
  } catch {
    return null
  }
}

export async function getHubSpotStatus(): Promise<{ connected: boolean; portal_id?: string; available?: boolean }> {
  try {
    const res = await fetch(`${API}/hubspot/status`)
    return await json<any>(res)
  } catch {
    return { connected: false }
  }
}

export async function disconnectHubSpot(): Promise<void> {
  await fetch(`${API}/hubspot/disconnect`, { method: "POST" })
}
