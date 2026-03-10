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

class InsufficientCreditsError extends Error {
  credits_required: number
  credits_remaining: number
  constructor(detail: { message: string; credits_required: number; credits_remaining: number }) {
    super(detail.message)
    this.name = "InsufficientCreditsError"
    this.credits_required = detail.credits_required
    this.credits_remaining = detail.credits_remaining
  }
}

async function handleResponse(response: Response, fallbackMsg: string) {
  if (response.ok) return response.json()
  const error = await response.json().catch(() => null)
  if (response.status === 402 && error?.detail?.credits_required !== undefined) {
    throw new InsufficientCreditsError(error.detail)
  }
  throw new Error(error?.detail || fallbackMsg)
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

export interface EmailOptimizerInput {
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
  lead_name?: string
  lead_company?: string
  lead_role?: string
  lead_domain?: string
  lead_linkedin_url?: string
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

// ── Lead Copilot Types ──────────────────────────────────────

export type LeadActionType = "draft_email" | "meeting_prep" | "research" | "find_similar" | "objection_handler" | "custom"

export interface LeadActionRequest {
  prospect_id: string
  action_type: LeadActionType
  prompt?: string
  context_overrides?: Record<string, any>
}

export interface LeadContextProspect {
  id: string
  name?: string
  title?: string
  company?: string
  email?: string
  phone?: string
  linkedin_url?: string
  location?: string
  seniority?: string
  department?: string
  data_quality_score?: number
}

export interface LeadContextCompany {
  id?: string
  name?: string
  domain?: string
  industry?: string
  employee_count?: number
  revenue_range?: string
  funding_stage?: string
  funding_total?: number
  technologies?: string[]
  headquarters?: string
  employee_growth_6m_percent?: number
}

export interface LeadSignal {
  signal_type: string
  description: string
  urgency: string
  detected_at?: string
}

export interface LeadContextData {
  prospect: LeadContextProspect
  company?: LeadContextCompany
  signals: LeadSignal[]
  enrichment_status: {
    emails_revealed: boolean
    phones_revealed: boolean
    company_enriched: boolean
    last_enriched_at?: string
  }
}

export interface AnnotatedEmailSegment {
  text: string
  tag: "PERSONALIZATION" | "RELEVANCE" | "TIMING" | "VALUE_PROP" | "CTA"
  source?: string
  source_url?: string
  why?: string
}

export interface AnnotatedEmailDraft {
  subject_line: string
  segments: AnnotatedEmailSegment[]
  full_text: string
  enrichment_sources_used: string[]
}

export interface LeadActionResponse {
  action_type: string
  result: Record<string, any>
  suggestions: Record<string, any>[]
  credits_used: number
}

export interface LeadSuggestion {
  icon: string
  title: string
  description: string
  action_type?: string
  priority: string
}

export interface LeadSuggestionsResponse {
  suggestions: LeadSuggestion[]
  signals_detected: number
}

export { InsufficientCreditsError }

export const copilotApi = {
  // Daily Brief
  getDailyBrief: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/daily-brief`)
    return handleResponse(response, "Failed to fetch daily brief")
  },

  regenerateDailyBrief: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/daily-brief/generate`, {
      method: "POST",
    })
    return handleResponse(response, "Failed to regenerate daily brief")
  },

  // Meeting Prep
  generateMeetingPrep: async (data: MeetingPrepInput) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/meeting-prep`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "Failed to generate meeting prep")
  },

  getMeetingPrepHistory: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/meeting-prep/history`)
    return handleResponse(response, "Failed to fetch history")
  },

  // Campaign Optimizer
  analyzeCampaign: async (data: CampaignOptimizerInput) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/campaign-optimizer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "Failed to analyze campaign")
  },

  // Email Optimizer
  optimizeEmail: async (data: EmailOptimizerInput) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/email-optimizer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "Failed to optimize email")
  },

  // Pipeline Alerts
  getPipelineAlerts: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/pipeline-alerts`)
    return handleResponse(response, "Failed to fetch pipeline alerts")
  },

  scanPipeline: async (deals: DealInput[]) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/pipeline-alerts/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deals }),
    })
    return handleResponse(response, "Failed to scan pipeline")
  },

  resolveAlert: async (alertId: string) => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/pipeline-alerts/${encodeURIComponent(alertId)}/resolve`,
      { method: "PUT" }
    )
    return handleResponse(response, "Failed to resolve alert")
  },

  // Preferences
  getPreferences: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/preferences`)
    return handleResponse(response, "Failed to fetch preferences")
  },

  updatePreferences: async (data: CopilotPreferences) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "Failed to update preferences")
  },

  // Credits
  getCredits: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/credits`)
    return handleResponse(response, "Failed to fetch credits")
  },

  // Lead Copilot
  getLeadContext: async (prospectId: string): Promise<LeadContextData> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/lead-context/${encodeURIComponent(prospectId)}`
    )
    return handleResponse(response, "Failed to fetch lead context")
  },

  executeLeadAction: async (data: LeadActionRequest): Promise<LeadActionResponse> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/lead-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return handleResponse(response, "Failed to execute action")
  },

  getLeadSuggestions: async (prospectId: string): Promise<LeadSuggestionsResponse> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/lead-suggestions/${encodeURIComponent(prospectId)}`
    )
    return handleResponse(response, "Failed to load suggestions")
  },
}
