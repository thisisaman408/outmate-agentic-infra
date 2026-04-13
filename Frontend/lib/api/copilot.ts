import { authService } from "@/lib/auth"

const BACKEND_BASE = ""

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

// ── Daily Brief Types ────────────────────────────────────────

export interface DailyBriefPriorityAction {
  priority: number
  tier: string
  action: string
  reason: string
  entity: string
  entity_type: string
  icp_score: number
}

export interface DailyBriefResponse {
  id: string
  brief_date: string
  greeting?: string
  summary: string
  priority_actions: DailyBriefPriorityAction[]
  new_signals: Array<{ signal_type: string; entity: string; description: string; urgency: string }>
  follow_ups: Array<{ prospect: string; company: string; last_contact: string; suggested_action: string }>
  key_metrics: { active_campaigns: number; open_rate_trend: string; new_leads_today: number; signals_detected: number }
  status: string
}

// ── Lead Copilot Types ──────────────────────────────────────

export type LeadActionType = 
  | "draft_email" 
  | "meeting_prep" 
  | "research" 
  | "find_similar" 
  | "objection_handler" 
  | "custom"
  | "crossfire"
  | "compliance"
  | "bombora_intent"
  | "talent_radar"
  | "virality"
  | "regime_shift"
  | "website_traffic"
  | "business_events"
  | "linkedin_posts"

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

export type StreamStage = "enriching" | "generating" | "token" | "complete" | "error"

export interface StreamEvent {
  stage: StreamStage
  message?: string
  content?: string
  result?: Record<string, any>
  credits_used?: number
  action_type?: string
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
  getDailyBrief: async (): Promise<DailyBriefResponse> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/daily-brief`)
    return handleResponse(response, "Failed to fetch daily brief")
  },

  regenerateDailyBrief: async (): Promise<DailyBriefResponse> => {
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

  executeLeadActionStream: async (
    data: LeadActionRequest,
    onEvent: (event: StreamEvent) => void,
  ): Promise<void> => {
    const headers = new Headers({ "Content-Type": "application/json" })
    const authHeaders = authService.getAuthHeaders()
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (value) headers.set(key, value)
    })

    const response = await fetch(`${BACKEND_BASE}/api/copilot/lead-action/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      if (response.status === 402 && error?.detail?.credits_required !== undefined) {
        throw new InsufficientCreditsError(error.detail)
      }
      throw new Error(error?.detail || "Failed to execute action")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response stream")

    const decoder = new TextDecoder()
    let buffer = ""

    // Token batching: accumulate token content and flush every 50ms
    // instead of firing a state update on every single token (~700 renders → ~15)
    let tokenBuffer = ""
    let flushTimer: ReturnType<typeof setTimeout> | null = null

    const flushTokens = () => {
      if (tokenBuffer) {
        onEvent({ stage: "token", content: tokenBuffer })
        tokenBuffer = ""
      }
      flushTimer = null
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data: ")) continue
        try {
          const event: StreamEvent = JSON.parse(trimmed.slice(6))
          if (event.stage === "token" && event.content) {
            // Buffer tokens — flush on timer
            tokenBuffer += event.content
            if (!flushTimer) {
              flushTimer = setTimeout(flushTokens, 50)
            }
          } else {
            // Non-token event: flush pending tokens first, then pass through immediately
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
            if (tokenBuffer) { onEvent({ stage: "token", content: tokenBuffer }); tokenBuffer = "" }
            onEvent(event)
          }
        } catch {
          // skip unparseable lines
        }
      }
    }

    // Flush any remaining tokens at end of stream
    if (flushTimer) clearTimeout(flushTimer)
    if (tokenBuffer) onEvent({ stage: "token", content: tokenBuffer })

    // Process any remaining buffer
    if (buffer.trim().startsWith("data: ")) {
      try {
        const event: StreamEvent = JSON.parse(buffer.trim().slice(6))
        onEvent(event)
      } catch {
        // skip
      }
    }
  },

  getLeadSuggestions: async (prospectId: string): Promise<LeadSuggestionsResponse> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/lead-suggestions/${encodeURIComponent(prospectId)}`
    )
    return handleResponse(response, "Failed to load suggestions")
  },

  // Prospect search
  searchProspects: async (q: string): Promise<{ id: string; name: string; title: string; company: string }[]> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/prospect-search?q=${encodeURIComponent(q)}`
    )
    return handleResponse(response, "Failed to search prospects")
  },

  // ── Orchestrator ──────────────────────────────────────────────

  orchestrate: async (
    prospectId: string,
    task: string,
    onEvent: (event: OrchestratorEvent) => void,
    signal?: AbortSignal,
    contextOverrides?: Record<string, unknown> | null,
  ): Promise<void> => {
    const authHeaders = authService.getAuthHeaders()
    const response = await fetch(`${BACKEND_BASE}/api/copilot/orchestrate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ prospect_id: prospectId, task, context_overrides: contextOverrides ?? null }),
      signal,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      if (response.status === 402 && error?.detail?.credits_required !== undefined) {
        throw new InsufficientCreditsError(error.detail)
      }
      throw new Error(error?.detail || "Orchestration failed")
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event: OrchestratorEvent = JSON.parse(line.slice(6))
            onEvent(event)
          } catch {
            // skip malformed
          }
        }
      }
    }
  },

  invalidateContext: async (prospectId: string): Promise<void> => {
    await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/context/invalidate/${encodeURIComponent(prospectId)}`,
      { method: "DELETE" },
    )
  },

  // ── Audit Log ─────────────────────────────────────────────────

  getAuditLog: async (limit = 50, offset = 0): Promise<AuditLogEntry[]> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/audit-log?limit=${limit}&offset=${offset}`
    )
    return handleResponse(response, "Failed to load audit log")
  },

  getAuditLogEntry: async (id: string): Promise<AuditLogEntryFull> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/audit-log/${encodeURIComponent(id)}`
    )
    return handleResponse(response, "Failed to load audit log entry")
  },

  // ── Signal Drafts ──────────────────────────────────────────────

  getSignalDrafts: async (status = "shown", limit = 20): Promise<unknown[]> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/signal-drafts?status=${status}&limit=${limit}`
    )
    return handleResponse(response, "Failed to load signal drafts")
  },

  updateSignalDraft: async (id: string, action: string, campaignName?: string): Promise<unknown> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/copilot/signal-drafts/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, campaign_name: campaignName }),
      }
    )
    return handleResponse(response, "Failed to update signal draft")
  },
}

// ── Orchestrator types ────────────────────────────────────────

export type OrchestratorEvent =
  | { type: "context_loading" }
  | { type: "planning" }
  | { type: "plan_ready"; data: { intent: string; steps: PlanStep[]; estimated_credits: number } }
  | { type: "steps_starting"; data: { steps: string[] } }
  | { type: "step_complete"; data: { step_id: string; label: string; result: unknown; credits: number } }
  | { type: "merging" }
  | { type: "complete"; data: OrchestratorArtifact }
  | { type: "error"; data: { message: string; step_id?: string } }

export interface PlanStep {
  step_id: string
  action: string
  label: string
  depends_on: string[]
  input_from: string[]
  extra_instruction?: string
}

export interface ArtifactSection {
  step_id: string
  label: string
  action: string
  result: Record<string, unknown>
}

export interface OrchestratorArtifact {
  intent: string
  summary: string
  steps_completed: string[]
  sections: ArtifactSection[]
  credits_used: number
  duration_ms: number
}

// ── Audit log types ───────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  action_type: string
  user_prompt?: string
  prospect_id?: string
  company_name?: string
  status: string
  credits_used: number
  duration_ms?: number
  created_at?: string
}

export interface AuditLogEntryFull extends AuditLogEntry {
  plan?: Record<string, unknown>
  steps_run?: Record<string, unknown>[]
  output?: Record<string, unknown>
  enrichment_sources?: string[]
}

// ── Champion Alerts ───────────────────────────────────────────────────────────

export interface ChampionChangeEvent {
  id: string
  watcher_id: string
  contact_name: string | null
  contact_linkedin: string | null
  prev_company: string | null
  prev_title: string | null
  new_company: string | null
  new_title: string | null
  change_type: 'left_account' | 'joined_account' | 'promoted'
  draft_email: string | null
  status: 'pending' | 'acted' | 'dismissed'
  is_read: boolean
  detected_at: string
  suggested_action: string
}

export async function getChampionAlerts(unreadOnly = false): Promise<ChampionChangeEvent[]> {
  const url = `${BACKEND_BASE}/api/copilot/champion-alerts?unread_only=${unreadOnly}`
  const res = await fetchWithAuth(url)
  return handleResponse(res, 'Failed to fetch champion alerts')
}

export async function markChampionAlertRead(eventId: string): Promise<void> {
  const res = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/champion-alerts/${eventId}/mark-read`, {
    method: 'POST',
  })
  await handleResponse(res, 'Failed to mark alert read')
}

export async function updateChampionAlertStatus(
  eventId: string,
  status: 'acted' | 'dismissed' | 'pending',
): Promise<void> {
  const res = await fetchWithAuth(`${BACKEND_BASE}/api/copilot/champion-alerts/${eventId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  await handleResponse(res, 'Failed to update alert status')
}
