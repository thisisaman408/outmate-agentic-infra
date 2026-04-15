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

export interface IntegrationStatus {
  name: string
  connected: boolean
  skipped: boolean
  priority: "must-have" | "recommended"
}

export interface IntegrationsStatus {
  integrations: Record<string, IntegrationStatus>
  connected_count: number
  total_count: number
}

export interface TestOutreachRequest {
  service: "instantly" | "smartlead"
  api_key: string
}

export interface TestOutreachResponse {
  success: boolean
  message: string
}

export const integrationsApi = {
  getStatus: async (): Promise<IntegrationsStatus> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/status`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to fetch integrations" }))
      throw new Error(err.detail || `Failed to fetch integrations (${response.status})`)
    }
    return response.json()
  },

  testOutreach: async (request: TestOutreachRequest): Promise<TestOutreachResponse> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/test/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Test failed" }))
      throw new Error(err.detail || `Test failed (${response.status})`)
    }
    return response.json()
  },

  skipIntegration: async (service: string): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to skip integration" }))
      throw new Error(err.detail || `Failed to skip integration (${response.status})`)
    }
    return response.json()
  },

  skipAllIntegrations: async (): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/skip-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to skip integrations" }))
      throw new Error(err.detail || `Failed to skip integrations (${response.status})`)
    }
    return response.json()
  },

  // Legacy mock interface mappings for compatibility
  getIntegrations: async () => {
    const status = await integrationsApi.getStatus()
    // Transform to legacy format for compatibility
    return Object.entries(status.integrations).map(([id, int]) => ({
      id,
      name: int.name,
      category: id === "gmail" || id === "outreach" ? "email" : id === "slack" ? "communication" : "crm",
      icon: id === "gmail" ? "✉" : id === "slack" ? "#" : id === "hubspot" ? "⊞" : id === "salesforce" ? "☁" : "◈",
      description: int.name,
      status: int.connected ? "connected" : "disconnected",
      connectedAt: int.connected ? new Date().toISOString() : undefined,
    }))
  },

  connectIntegration: async (integrationId: string) => {
    // This would initiate OAuth flow in a real implementation
    console.log(`Connect ${integrationId} - OAuth flow not implemented`)
  },

  disconnectIntegration: async (integrationId: string) => {
    // This would disconnect the integration
    console.log(`Disconnect ${integrationId} - Not implemented`)
  },
}
