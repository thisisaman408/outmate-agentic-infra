import { authService } from "@/lib/auth"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const fetchWithAuth = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) headers.set(key, value)
  })
  return fetch(url, { ...init, headers })
}

// ── Types ──────────────────────────────────────────────────────────────

export interface Signal {
  title: string
  url: string
  content: string
  score: string
  source: string
}

export interface DatabaseLead {
  // Identity (9)
  id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  linkedin_url: string
  twitter_url: string
  website: string
  // Professional (10)
  title: string
  seniority_level: string
  department: string
  organization_name: string
  company_domain: string
  company_linkedin_url: string
  industry: string
  education: string
  education_degree: string
  summary: string
  // Skills (1)
  skills: string[]
  // Location (5)
  location: string
  city: string
  state: string
  country: string
  profile_language: string
  // Network (3)
  connections_count: number
  followers_count: number
  mutual_connections: number
  // Signals (6)
  signals_count: number
  signals_summary: string
  company_signals: Signal[]
  person_signals: Signal[]
  recent_activity: string
  engagement_score: number
  // Metadata (5)
  source: string
  search_query: string
  quality_score: number
  discovered_at: string
  data_completeness: number
  // Status (3)
  status: string
  enrichment_status: string
  is_decision_maker: boolean
}

export interface SearchMeta {
  total_results: number
  returned_results: number
  execution_time_ms: number
  query: string
  location: string
}

export interface SearchResponse {
  success: boolean
  data: {
    leads: DatabaseLead[]
    meta: SearchMeta
  }
}

export interface ServiceStatus {
  zenrows_configured: boolean
  tavily_configured: boolean
  ready: boolean
}

// ── API ────────────────────────────────────────────────────────────────

export const databaseFinderApi = {
  search: async (
    query: string,
    location: string = "United States",
    limit: number = 20,
    includeSignals: boolean = true
  ): Promise<SearchResponse> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/database/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        location,
        limit,
        include_signals: includeSignals,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Search failed" }))
      throw new Error(err.detail || `Search failed (${response.status})`)
    }
    return response.json()
  },

  enrich: async (linkedinUrl: string): Promise<{ success: boolean; data: DatabaseLead }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/database/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: linkedinUrl }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Enrichment failed" }))
      throw new Error(err.detail || `Enrichment failed (${response.status})`)
    }
    return response.json()
  },

  getStatus: async (): Promise<ServiceStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/database/status`)
    if (!response.ok) throw new Error("Failed to check service status")
    return response.json()
  },

  predictEmail: async (
    firstName: string,
    lastName: string,
    domain: string
  ): Promise<{ success: boolean; email?: string; message?: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/database/predict-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        domain,
      }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Prediction failed" }))
      throw new Error(err.detail || `Prediction failed (${response.status})`)
    }
    return response.json()
  },
}
