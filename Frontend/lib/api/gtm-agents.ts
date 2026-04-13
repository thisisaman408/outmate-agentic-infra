import { authService } from "@/lib/auth"

const API_BASE_URL = ""

export type GTMAgentId =
  | "crossfire"
  | "compliance_oracle"
  | "virality_engine"
  | "talent_radar"
  | "regime_shifter"

export interface GTMAgentRunResponse {
  result?: string
  results?: unknown
  [key: string]: any
}

async function postJson(path: string, body: unknown) {
  const authHeaders = authService.getAuthHeaders()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const payload = await res.json()
      detail = payload.detail || payload.error || detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return res.json() as Promise<GTMAgentRunResponse>
}

export const gtmAgentsApi = {
  runCrossfire: (payload: { competitor_domain: string; target_region?: string; notes?: string }) =>
    postJson("/api/v1/gtm-agents/crossfire/run", payload),

  runComplianceOracle: (payload: { message_template: string; jurisdictions?: string }) =>
    postJson("/api/v1/gtm-agents/compliance-oracle/run", payload),

  runViralityEngine: (payload: { seed_customers: string; channels?: string }) =>
    postJson("/api/v1/gtm-agents/virality-engine/run", payload),

  runTalentRadar: (payload: { accounts: string; lookback_days?: number }) =>
    postJson("/api/v1/gtm-agents/talent-radar/run", payload),

  runRegimeShifter: (payload: { geo_focus: string; scenario?: string }) =>
    postJson("/api/v1/gtm-agents/regime-shifter/run", payload),
}

