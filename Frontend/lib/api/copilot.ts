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

export interface MeetingPrepInput {
  company_name: string
  company_domain?: string
  prospect_name?: string
  prospect_title?: string
  meeting_type?: string
  additional_context?: string
}

export interface CampaignOptimizerInput {
  subject_line: string
  email_body: string
  target_audience?: string
  campaign_id?: string
  metrics?: {
    sent?: number
    opened?: number
    replied?: number
    bounced?: number
  }
}

export interface DealInput {
  company: string
  stage: string
  last_activity: string
  value: number
}

export interface CopilotPreferences {
  daily_brief_enabled?: boolean
  daily_brief_time?: string
  daily_brief_timezone?: string
  notify_email?: boolean
  notify_slack?: boolean
  slack_webhook_url?: string
  pipeline_alerts_enabled?: boolean
  alert_severity_threshold?: string
}

export const copilotApi = {
  // Daily Brief
  getDailyBrief: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/daily-brief`)
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to fetch daily brief")
    }
    return response.json()
  },

  regenerateDailyBrief: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/daily-brief/generate`, {
      method: "POST",
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to regenerate daily brief")
    }
    return response.json()
  },

  // Meeting Prep
  generateMeetingPrep: async (data: MeetingPrepInput) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/meeting-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to generate meeting prep")
    }
    return response.json()
  },

  getMeetingPrepHistory: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/meeting-prep/history`)
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to fetch history")
    }
    return response.json()
  },

  // Campaign Optimizer
  analyzeCampaign: async (data: CampaignOptimizerInput) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/campaign-optimizer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to analyze campaign")
    }
    return response.json()
  },

  // Pipeline Alerts
  getPipelineAlerts: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/pipeline-alerts`)
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to fetch pipeline alerts")
    }
    return response.json()
  },

  scanPipeline: async (deals: DealInput[]) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/pipeline-alerts/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deals }),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to scan pipeline")
    }
    return response.json()
  },

  resolveAlert: async (alertId: string) => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/pipeline-alerts/${alertId}/resolve`,
      { method: "PUT" }
    )
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to resolve alert")
    }
    return response.json()
  },

  // Preferences
  getPreferences: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/preferences`)
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to fetch preferences")
    }
    return response.json()
  },

  updatePreferences: async (data: CopilotPreferences) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.detail || "Failed to update preferences")
    }
    return response.json()
  },
}
