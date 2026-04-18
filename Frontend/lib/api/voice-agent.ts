// Voice AI Agent API client — talks to /api/v1/voice-agent/*
// Auth header is auto-attached by AuthProvider's window.fetch patch.

const API = "/api/v1/voice-agent"

// ---------- Types ----------

export interface SignalTrigger {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface CrmSettings {
  auto_create_hubspot: boolean
  log_transcript: boolean
  send_followup_email: boolean
  slack_booked_alert: boolean
}

export interface CallScript {
  opening: string
  objection_handling: string
  closing: string
}

export interface VoiceAgentConfig {
  status: "active" | "paused"
  voice_persona: string
  call_objective: string
  max_calls_per_day: number
  fallback_action: string
  call_list_source: string
  icp_filter: string
  signal_triggers: SignalTrigger[]
  call_script: CallScript
  crm_settings: CrmSettings
}

export interface VoiceAgentStats {
  calls_made: number
  calls_today: number
  meetings_booked: number
  booking_rate: number
  avg_call_duration: string
  signal_triggered: number
  signal_triggered_pct: number
  connected_rate: number
  voicemail_rate: number
  no_answer_rate: number
  in_queue: number
}

export interface RecentCall {
  id: string
  initials: string
  name: string
  company: string
  signal_type: string
  status: "Booked" | "Call back" | "Voicemail" | "No answer"
  duration: string
  timestamp?: string
}

export interface TriggerCallRequest {
  prospect_name: string
  prospect_phone: string
  prospect_company?: string
  prospect_role?: string
  prospect_city?: string
  prospect_industry?: string
  call_objective?: string
  context?: string
}

// ---------- API functions ----------

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Voice agent API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function fetchVoiceAgentConfig(): Promise<VoiceAgentConfig> {
  return apiFetch<VoiceAgentConfig>("/config")
}

export async function updateVoiceAgentConfig(config: VoiceAgentConfig): Promise<VoiceAgentConfig> {
  return apiFetch<VoiceAgentConfig>("/config", {
    method: "PUT",
    body: JSON.stringify(config),
  })
}

export async function fetchVoiceAgentStats(): Promise<VoiceAgentStats> {
  return apiFetch<VoiceAgentStats>("/stats")
}

export async function fetchRecentCalls(): Promise<RecentCall[]> {
  return apiFetch<RecentCall[]>("/calls")
}

export async function triggerVoiceCall(req: TriggerCallRequest) {
  return apiFetch("/trigger-call", {
    method: "POST",
    body: JSON.stringify(req),
  })
}

export async function pauseAgent(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/pause", { method: "POST" })
}

export async function aiRewriteScript(
  section: string,
  current_text: string,
  tone: string = "professional"
): Promise<{ rewritten: string }> {
  return apiFetch<{ rewritten: string }>("/ai-rewrite", {
    method: "POST",
    body: JSON.stringify({ section, current_text, tone }),
  })
}

// ---------- Upload & Analytics ----------

export interface UploadResult {
  uploaded: number
  skipped: number
  filename: string
  contacts_preview: { name: string; phone: string; company: string; role: string; email: string }[]
}

export interface VoiceAnalytics {
  total_calls: number
  successful: number
  failed: number
  booking_rate: number
  total_credits_spent: number
  avg_duration_seconds: number
  daily_calls: { date: string; calls: number }[]
  top_companies: { company: string; calls: number }[]
}

export async function uploadContactList(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API}/upload-list`, {
    method: "POST",
    body: formData,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Upload failed ${res.status}: ${body}`)
  }
  return res.json()
}

export async function fetchContactList(): Promise<{ contacts: any[]; total: number }> {
  return apiFetch("/contact-list")
}

export async function fetchVoiceAnalytics(): Promise<VoiceAnalytics> {
  return apiFetch<VoiceAnalytics>("/analytics")
}

// ---------- Call Details ----------

export interface CallDetails {
  id: string
  status: string
  created_at: string | null
  duration: string
  duration_ms: number
  prospect: {
    name: string
    phone: string
    company: string
    role: string
    city: string
    industry: string
  }
  call_objective: string
  context: string
  transcript: string
  extracted_variables: {
    name: string
    pain_points: string
    current_tools: string
    budget_mentioned: string
    decision_maker: string
    next_steps: string
    objections: string
    competitor_mentioned: string
    timeline: string
    key_quotes: string
  }
  call_analysis: Record<string, any>
  disconnection_reason: string
  credits_used: number
}

export async function fetchCallDetails(runId: string): Promise<CallDetails> {
  return apiFetch<CallDetails>(`/call-details/${runId}`)
}

// ---------- Constants ----------

export const VOICE_PERSONAS = [
  "Alex (Neutral EN-US)",
  "Sarah (Professional EN-US)",
  "James (British EN-GB)",
  "Emma (Australian EN-AU)",
]

export const CALL_OBJECTIVES = [
  "Book discovery call",
  "Intro demo",
  "Nurture relationship",
  "Follow up",
  "Closing",
]

export const FALLBACK_ACTIONS = [
  "Leave voicemail + send follow-up email",
  "Leave voicemail only",
  "Send follow-up email only",
  "Skip — move to next contact",
]

export const CALL_LIST_SOURCES = [
  "Outmate Database — live segment",
  "Uploaded CSV",
  "HubSpot list",
]
