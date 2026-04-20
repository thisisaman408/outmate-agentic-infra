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
  // Back-compat primitives (legacy UI read these; kept for stability)
  total_calls: number
  successful: number
  failed: number
  booking_rate: number
  total_credits_spent: number
  avg_duration_seconds: number
  daily_calls: { date: string; calls: number }[]
  top_companies: { company: string; calls: number }[]
  // Richer v2 fields
  outcomes: {
    booked: number
    completed: number
    no_answer: number
    failed: number
    in_progress: number
  }
  connect_rate: number
  no_answer_rate: number
  avg_connected_duration_seconds: number
  total_talk_time_seconds: number
  disconnection_breakdown: { reason: string; count: number }[]
  top_pain_points: { label: string; count: number }[]
  top_objections: { label: string; count: number }[]
  top_competitors: { label: string; count: number }[]
  top_next_steps: { label: string; count: number }[]
  hour_of_day_utc: number[]
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
  // Backfill v2-only keys with sane defaults so the UI renders even when
  // the deployed backend is still on the old analytics response shape
  // (e.g. during a rolling restart or if the user forgot to reload
  // uvicorn after pulling code).  Without this the modal crashes on
  // `analyticsData.outcomes.booked` when the field is absent.
  const raw = await apiFetch<Partial<VoiceAnalytics>>("/analytics")
  return {
    total_calls: raw.total_calls ?? 0,
    successful: raw.successful ?? 0,
    failed: raw.failed ?? 0,
    booking_rate: raw.booking_rate ?? 0,
    total_credits_spent: raw.total_credits_spent ?? 0,
    avg_duration_seconds: raw.avg_duration_seconds ?? 0,
    daily_calls: raw.daily_calls ?? [],
    top_companies: raw.top_companies ?? [],
    outcomes: raw.outcomes ?? {
      booked: 0,
      // If we're on the old shape, "successful" is the closest proxy for
      // "connected calls" — surface it under Completed so the UI isn't empty.
      completed: raw.successful ?? 0,
      no_answer: 0,
      failed: raw.failed ?? 0,
      in_progress: 0,
    },
    connect_rate: raw.connect_rate ?? 0,
    no_answer_rate: raw.no_answer_rate ?? 0,
    avg_connected_duration_seconds: raw.avg_connected_duration_seconds ?? raw.avg_duration_seconds ?? 0,
    total_talk_time_seconds: raw.total_talk_time_seconds ?? 0,
    disconnection_breakdown: raw.disconnection_breakdown ?? [],
    top_pain_points: raw.top_pain_points ?? [],
    top_objections: raw.top_objections ?? [],
    top_competitors: raw.top_competitors ?? [],
    top_next_steps: raw.top_next_steps ?? [],
    hour_of_day_utc: raw.hour_of_day_utc ?? Array(24).fill(0),
  }
}

// ---------- Call Details ----------

export interface CallDetails {
  id: string
  // Human label: "Booked" | "Completed" | "In progress" |
  //              "Timed out (no webhook)" | "Failed" | raw DB value
  status: string
  // Raw DB enum: running | success | error | queued | skipped
  raw_status?: string
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
  error_message?: string
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
