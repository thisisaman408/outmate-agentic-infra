import { authService } from "@/lib/auth"

export interface Campaign {
  id: string
  name: string
  type: "email" | "slack" | "multi-channel"
  status: "draft" | "running" | "paused" | "completed"
  objective: string
  message: string
  leads: string[]
  leadsCount: number
  stats: {
    sent: number
    opened: number
    replied: number
    bounced: number
    openRate: number
    replyRate: number
  }
  schedule?: {
    startDate: string
    endDate?: string
    frequency?: string
  }
  createdAt: string
  updatedAt: string
}

export interface CreateCampaignRequest {
  name: string
  objective: string
  leads: string[]
  schedule?: Campaign["schedule"]
}

export interface GenerateMessageRequest {
  objective: string
  leads: string[]
  signals?: string[]
}

export interface GeneratedMessage {
  subject: string
  email_body: string
  linkedin_message: string
  raw?: string
}
const BACKEND_BASE = ""

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

export const campaignsApi = {
  getCampaigns: async (): Promise<Campaign[]> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/campaigns`)
    if (!response.ok) {
      throw new Error("Failed to load campaigns")
    }
    const data = await response.json()
    return data.campaigns ?? []
  },

  getCampaign: async (id: string): Promise<Campaign | null> => {
    const campaigns = await campaignsApi.getCampaigns()
    return campaigns.find((c) => c.id === id) || null
  },

  createCampaign: async (request: CreateCampaignRequest): Promise<Campaign> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to create campaign")
    }
    const data = await response.json()
    return data.campaign
  },

  updateCampaignStatus: async (id: string, status: Campaign["status"]): Promise<Campaign> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/campaigns/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      throw new Error("Updating campaign status failed")
    }
    const data = await response.json()
    return data.campaign
  },

  generateMessage: async (request: GenerateMessageRequest): Promise<GeneratedMessage> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/generate-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to generate message")
    }
    const data = await response.json()
    return {
      subject: data.subject ?? data.email_subject ?? "",
      email_body: data.email_body ?? data.body ?? "",
      linkedin_message: data.linkedin_message ?? data.linkedin ?? "",
      raw: data.raw,
    }
  },

  getDashboardSequences: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/sequences`)
    if (!response.ok) throw new Error("Sequences unavailable")
    const data = await response.json()
    return data.sequences ?? []
  },

  triggerGlobalInbox: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/global-inbox`, {
      method: "POST",
    })
    if (!response.ok) throw new Error("Unable to refresh Global Inbox")
    return response.json()
  },

  triggerGlobalAnalytics: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/global-analytics`, {
      method: "POST",
    })
    if (!response.ok) throw new Error("Unable to refresh Global Analytics")
    return response.json()
  },

  getDashboardGlobalStatus: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/global-status`)
    if (!response.ok) throw new Error("Global status unavailable")
    return response.json()
  },

  getGlobalInboxFeed: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/global-inbox-feed`)
    if (!response.ok) throw new Error("Inbox feed unavailable")
    const data = await response.json()
    return data.items ?? []
  },

  getGlobalAnalyticsFeed: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/global-analytics-feed`)
    if (!response.ok) throw new Error("Analytics feed unavailable")
    const data = await response.json()
    return data.items ?? []
  },

  getEmailAccounts: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/email-accounts`)
    if (!response.ok) throw new Error("Email accounts unavailable")
    const data = await response.json()
    return data.accounts ?? []
  },

  addEmailAccount: async (email: string, provider: string) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/email-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, provider }),
    })
    if (!response.ok) throw new Error("Failed to add email account")
    return response.json()
  },

  getBlocklist: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/blocklist`)
    if (!response.ok) throw new Error("Blocklist unavailable")
    const data = await response.json()
    return data.entries ?? []
  },

  addBlocklistEntry: async (domain: string, reason: string) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/campaigns/dashboard/blocklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, reason }),
    })
    if (!response.ok) throw new Error("Failed to add blocklist entry")
    return response.json()
  },
}
