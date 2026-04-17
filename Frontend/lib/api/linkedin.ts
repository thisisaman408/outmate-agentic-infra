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

export interface LinkedInAccount {
  id: string
  unipile_account_id: string
  display_name: string | null
  linkedin_profile_url: string | null
  session_status: "active" | "expired" | "error"
  session_checked_at: string | null
  daily_connection_limit: number
  created_at: string | null
}

export interface AvailableAccount {
  id: string
  type: string
  name: string | null
  provider: string | null
}

export interface RateLimitStatus {
  used: number
  limit: number
  remaining: number
  resets_at: string
}

export interface SessionStatus {
  session_status: string
  checked_at: string
  error: string | null
}

export interface ConnectionRequestResult {
  success: boolean
  provider_id: string
  prospect_linkedin_url: string
  unipile_response: Record<string, unknown>
}

export interface DirectMessageResult {
  success: boolean
  chat_id: string | null
  provider_id: string
  linkedin_url: string
}

export interface ScrapeResult {
  profile: Record<string, unknown> | null
  posts_count: number
  activities_stored: number
}

export interface ProspectActivity {
  id: string
  linkedin_url: string
  activity_type: string
  content: string | null
  metadata: Record<string, unknown>
  activity_date: string | null
  scraped_at: string | null
}

export interface Cooldown {
  id: string
  prospect_linkedin_url: string
  reason: string
  cooldown_until: string
  created_at: string | null
}

// ── API Client ───────────────────────────────────────────────────────

export const linkedinApi = {
  // Account management
  getMyAccount: async (): Promise<LinkedInAccount> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/accounts/me`)
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to load LinkedIn account")
    }
    return response.json()
  },

  getAvailableAccounts: async (): Promise<AvailableAccount[]> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/accounts/available`)
    if (!response.ok) throw new Error("Failed to load available accounts")
    const data = await response.json()
    return data.accounts ?? []
  },

  linkAccount: async (
    unipile_account_id: string,
    display_name?: string,
    linkedin_profile_url?: string,
  ): Promise<{ id: string; unipile_account_id: string; session_status: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/accounts/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unipile_account_id, display_name, linkedin_profile_url }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to link account")
    }
    return response.json()
  },

  unlinkAccount: async (): Promise<void> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/accounts/unlink`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error("Failed to unlink account")
  },

  checkSessionStatus: async (): Promise<SessionStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/accounts/session-status`)
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to check session status")
    }
    return response.json()
  },

  // Rate limits
  getRateLimitStatus: async (): Promise<RateLimitStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/rate-limit`)
    if (!response.ok) throw new Error("Failed to load rate limit status")
    return response.json()
  },

  // Actions
  sendConnectionRequest: async (
    prospect_linkedin_url: string,
    note?: string,
  ): Promise<ConnectionRequestResult> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/connections/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_linkedin_url, note }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail?.message || err?.detail || "Connection request failed")
    }
    return response.json()
  },

  sendDirectMessage: async (
    prospect_linkedin_url: string,
    message: string,
  ): Promise<DirectMessageResult> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_linkedin_url, message }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail?.message || err?.detail || "Failed to send message")
    }
    return response.json()
  },

  scrapeProfile: async (
    prospect_linkedin_url: string,
    prospect_id?: string,
  ): Promise<ScrapeResult> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/profiles/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_linkedin_url, prospect_id }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail?.message || err?.detail || "Profile scrape failed")
    }
    return response.json()
  },

  getProspectActivity: async (prospect_id: string): Promise<ProspectActivity[]> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/linkedin/profiles/${prospect_id}/activity`,
    )
    if (!response.ok) throw new Error("Failed to load prospect activity")
    const data = await response.json()
    return data.activities ?? []
  },

  // Cooldowns
  getCooldowns: async (): Promise<Cooldown[]> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/cooldowns`)
    if (!response.ok) throw new Error("Failed to load cooldowns")
    const data = await response.json()
    return data.cooldowns ?? []
  },

  logWithdrawal: async (
    prospect_linkedin_url: string,
    reason: string = "withdrawn",
  ): Promise<Cooldown> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/linkedin/cooldowns/log-withdrawal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_linkedin_url, reason }),
    })
    if (!response.ok) throw new Error("Failed to log withdrawal")
    return response.json()
  },
}
