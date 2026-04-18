// Voice Campaigns API client — talks to /api/v1/voice-campaigns/*
// Auth header is auto-attached by AuthProvider's window.fetch patch.

const API = "/api/v1/voice-campaigns"

// ---------- Types ----------

export type CampaignSourceType = "manual" | "csv" | "hubspot" | "hot_signals"
export type CampaignStatus = "queued" | "running" | "paused" | "completed" | "cancelled" | "error"
export type ProspectStatus = "queued" | "calling" | "success" | "error" | "skipped"

export interface ManualProspect {
  prospect_name: string
  prospect_phone: string
  prospect_company?: string
  prospect_role?: string
  prospect_city?: string
  prospect_industry?: string
  context?: string
}

export interface CreateCampaignRequest {
  name: string
  call_objective?: string
  source_type: CampaignSourceType
  source_params?: Record<string, unknown>
  max_calls_per_day?: number
  manual_prospects?: ManualProspect[]
}

export interface Campaign {
  id: string
  name: string
  call_objective: string
  source_type: CampaignSourceType
  source_params: Record<string, unknown>
  max_calls_per_day: number
  status: CampaignStatus
  error_message: string | null
  total_prospects: number
  calls_made: number
  calls_booked: number
  calls_failed: number
  created_at: string | null
  started_at: string | null
  finished_at: string | null
}

export interface CampaignProspect {
  id: string
  prospect_name: string
  prospect_phone: string
  prospect_company: string
  prospect_role: string
  status: ProspectStatus
  error_message: string | null
  attempted_at: string | null
  finished_at: string | null
  agent_run_id: string | null
}

export interface CampaignDetail extends Campaign {
  prospects: CampaignProspect[]
}

export interface HubSpotList {
  list_id: string
  name: string
  size: number | null
}

export interface PreviewResult {
  total: number
  preview: ManualProspect[]
}

// ---------- API functions ----------

async function fetchJson<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Campaigns API ${res.status}: ${body}`)
  }
  return res.json()
}

export const listCampaigns = () => fetchJson<Campaign[]>("")
export const getCampaign = (id: string) => fetchJson<CampaignDetail>(`/${id}`)

export const createCampaign = (req: CreateCampaignRequest) =>
  fetchJson<Campaign>("", { method: "POST", body: JSON.stringify(req) })

export const pauseCampaign = (id: string) =>
  fetchJson<Campaign>(`/${id}/pause`, { method: "POST" })

export const resumeCampaign = (id: string) =>
  fetchJson<Campaign>(`/${id}/resume`, { method: "POST" })

export const cancelCampaign = (id: string) =>
  fetchJson<Campaign>(`/${id}/cancel`, { method: "POST" })

export const previewSource = (
  source_type: "hot_signals" | "hubspot",
  source_params: Record<string, unknown>,
) => fetchJson<PreviewResult>("/preview", {
  method: "POST",
  body: JSON.stringify({ source_type, source_params }),
})

export const getHubSpotLists = () => fetchJson<HubSpotList[]>("/hubspot-lists")
