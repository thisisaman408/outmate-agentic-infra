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

export interface GmailStatus {
  connected: boolean
  email: string | null
}

export interface GmailQuota {
  used: number
  limit: number
  safe_limit: number
  remaining: number
  is_workspace: boolean
  resets_at: string
}

export interface SendEmailRequest {
  to_email: string
  subject: string
  body: string
  html?: boolean
  thread_id?: string
  in_reply_to?: string
  campaign_id?: string
  prospect_id?: string
}

export interface SendEmailResult {
  success: boolean
  message_id: string
  thread_id: string
  to: string
  from: string
  quota_remaining: number
}

export interface ThreadMessage {
  id: string
  threadId: string
  snippet: string
  labelIds: string[]
  headers: Record<string, string>
}

export interface OutreachEmail {
  id: string
  gmail_message_id: string
  gmail_thread_id: string
  to_email: string
  subject: string | null
  from_email: string
  reply_status: string
  reply_detected_at: string | null
  reply_snippet: string | null
  campaign_id: string | null
  sent_at: string | null
}

export interface OutreachStats {
  total_sent: number
  awaiting: number
  replied: number
  interested: number
  not_interested: number
  out_of_office: number
  bounced: number
}

// ── API Client ───────────────────────────────────────────────────────

export const gmailApi = {
  // Account
  getStatus: async (): Promise<GmailStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/gmail/status`)
    if (!response.ok) throw new Error("Failed to check Gmail status")
    return response.json()
  },

  getAuthUrl: async (termsAccepted: boolean = true): Promise<string> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/auth/google/auth-url?terms_accepted=${termsAccepted}`,
    )
    if (!response.ok) throw new Error("Failed to get Gmail auth URL")
    const data = await response.json()
    return data.auth_url
  },

  disconnect: async (): Promise<void> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/gmail/disconnect`, {
      method: "POST",
    })
    if (!response.ok) throw new Error("Failed to disconnect Gmail")
  },

  // Quota
  getQuota: async (): Promise<GmailQuota> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/gmail/quota`)
    if (!response.ok) throw new Error("Failed to load Gmail quota")
    return response.json()
  },

  // Sending
  sendEmail: async (request: SendEmailRequest): Promise<SendEmailResult> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/gmail/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to send email")
    }
    return response.json()
  },

  // Threads
  getThread: async (threadId: string): Promise<{ thread_id: string; messages: ThreadMessage[] }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/gmail/threads/${threadId}`)
    if (!response.ok) throw new Error("Failed to load thread")
    return response.json()
  },

  // Outreach tracking
  getOutreach: async (params?: {
    status?: string
    campaign_id?: string
    limit?: number
  }): Promise<OutreachEmail[]> => {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set("status", params.status)
    if (params?.campaign_id) searchParams.set("campaign_id", params.campaign_id)
    if (params?.limit) searchParams.set("limit", String(params.limit))

    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/gmail/outreach?${searchParams.toString()}`,
    )
    if (!response.ok) throw new Error("Failed to load outreach emails")
    const data = await response.json()
    return data.emails ?? []
  },

  getOutreachStats: async (campaignId?: string): Promise<OutreachStats> => {
    const params = campaignId ? `?campaign_id=${campaignId}` : ""
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/gmail/outreach/stats${params}`)
    if (!response.ok) throw new Error("Failed to load outreach stats")
    return response.json()
  },
}
