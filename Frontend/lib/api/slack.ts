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

export interface SlackStatus {
  connected: boolean
  team_name?: string
  team_domain?: string
  team_id?: string
  scope?: string
  installed_at?: string
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_member: boolean
}

export interface ChannelConfig {
  alert_type: string
  channel_id: string
  channel_name: string | null
  is_enabled: boolean
}

export interface ChannelConfigResponse {
  alert_types: string[]
  configs: ChannelConfig[]
}

export const ALERT_TYPE_LABELS: Record<string, string> = {
  pipeline_alert: "Pipeline Alerts",
  daily_brief: "Daily Briefs",
  signal_alert: "Signal Alerts",
  campaign_update: "Campaign Updates",
  visitor_alert: "Visitor Alerts",
}

// ── API Client ───────────────────────────────────────────────────────

export const slackApi = {
  // OAuth
  getAuthUrl: async (): Promise<string> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/auth-url`)
    if (!response.ok) throw new Error("Failed to get Slack auth URL")
    const data = await response.json()
    return data.auth_url
  },

  // Status
  getStatus: async (): Promise<SlackStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/status`)
    if (!response.ok) throw new Error("Failed to check Slack status")
    return response.json()
  },

  disconnect: async (): Promise<void> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/disconnect`, {
      method: "POST",
    })
    if (!response.ok) throw new Error("Failed to disconnect Slack")
  },

  // Channels
  getChannels: async (): Promise<SlackChannel[]> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/channels`)
    if (!response.ok) throw new Error("Failed to load channels")
    const data = await response.json()
    return data.channels ?? []
  },

  // Channel config
  getChannelConfig: async (): Promise<ChannelConfigResponse> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/channel-config`)
    if (!response.ok) throw new Error("Failed to load channel config")
    return response.json()
  },

  setChannelConfig: async (
    configs: Array<{
      alert_type: string
      channel_id: string
      channel_name?: string
      is_enabled?: boolean
    }>,
  ): Promise<ChannelConfig[]> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/channel-config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs }),
    })
    if (!response.ok) throw new Error("Failed to save channel config")
    const data = await response.json()
    return data.configs ?? []
  },

  // Test message
  sendTestMessage: async (channel_id: string): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/slack/test-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Test message failed")
    }
    return response.json()
  },
}
