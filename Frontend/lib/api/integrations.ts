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

  // HubSpot OAuth
  getHubspotAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/auth-url`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to get auth URL" }))
      throw new Error(err.detail || `Failed to get auth URL (${response.status})`)
    }
    return response.json()
  },

  hubspotCallback: async (code: string, state: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Callback failed" }))
      throw new Error(err.detail || `Callback failed (${response.status})`)
    }
    return response.json()
  },

  hubspotDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Disconnect failed" }))
      throw new Error(err.detail || `Disconnect failed (${response.status})`)
    }
    return response.json()
  },

  // Salesforce OAuth
  getSalesforceAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/auth-url`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to get auth URL" }))
      throw new Error(err.detail || `Failed to get auth URL (${response.status})`)
    }
    return response.json()
  },

  salesforceCallback: async (code: string, state: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Callback failed" }))
      throw new Error(err.detail || `Callback failed (${response.status})`)
    }
    return response.json()
  },

  salesforceDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Disconnect failed" }))
      throw new Error(err.detail || `Disconnect failed (${response.status})`)
    }
    return response.json()
  },

  // Zoho CRM OAuth
  getZohoCrmAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/auth-url`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to get auth URL" }))
      throw new Error(err.detail || `Failed to get auth URL (${response.status})`)
    }
    return response.json()
  },

  zohoCrmCallback: async (code: string, state: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Callback failed" }))
      throw new Error(err.detail || `Callback failed (${response.status})`)
    }
    return response.json()
  },

  zohoCrmDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Disconnect failed" }))
      throw new Error(err.detail || `Disconnect failed (${response.status})`)
    }
    return response.json()
  },

  // API Key Configuration
  hubspotStoreApiKey: async (apiKey: string, description: string = ""): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, description }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to store API key" }))
      throw new Error(err.detail || `Failed to store API key (${response.status})`)
    }
    return response.json()
  },

  salesforceStoreApiKey: async (apiKey: string, description: string = "", instanceUrl: string = ""): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, description, instance_url: instanceUrl }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to store API key" }))
      throw new Error(err.detail || `Failed to store API key (${response.status})`)
    }
    return response.json()
  },

  zohoCrmStoreApiKey: async (apiKey: string, description: string = "", apiDomain: string = ""): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, description, api_domain: apiDomain }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to store API key" }))
      throw new Error(err.detail || `Failed to store API key (${response.status})`)
    }
    return response.json()
  },

  // Add to CRM methods
  hubspotAddContacts: async (contacts: any[]): Promise<{ success: boolean; total: number; successful: number; results: any[] }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/add-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to add contacts to HubSpot" }))
      throw new Error(err.detail || `Failed to add contacts to HubSpot (${response.status})`)
    }
    return response.json()
  },

  salesforceAddContacts: async (contacts: any[]): Promise<{ success: boolean; total: number; successful: number; results: any[] }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/add-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to add contacts to Salesforce" }))
      throw new Error(err.detail || `Failed to add contacts to Salesforce (${response.status})`)
    }
    return response.json()
  },

  zohoCrmAddContacts: async (contacts: any[]): Promise<{ success: boolean; total: number; successful: number; results: any[] }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/add-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to add contacts to Zoho CRM" }))
      throw new Error(err.detail || `Failed to add contacts to Zoho CRM (${response.status})`)
    }
    return response.json()
  },

  // Outlook methods
  getOutlookAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get Outlook auth URL")
    }
    return response.json()
  },

  outlookCallback: async (code: string, state: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to connect Outlook" }))
      throw new Error(err.detail || "Failed to connect Outlook")
    }
    return response.json()
  },

  outlookDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect Outlook")
    }
    return response.json()
  },

  outlookStoreApiKey: async (apiKey: string, description: string = ""): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, description }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to store API key" }))
      throw new Error(err.detail || `Failed to store API key (${response.status})`)
    }
    return response.json()
  },

  outlookSendEmail: async (toEmail: string, subject: string, body: string, htmlBody?: string): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: toEmail, subject, body, html_body: htmlBody }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to send email" }))
      throw new Error(err.detail || `Failed to send email (${response.status})`)
    }
    return response.json()
  },

  outlookGetEmails: async (limit: number = 10): Promise<any> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/emails?limit=${limit}`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to get emails" }))
      throw new Error(err.detail || `Failed to get emails (${response.status})`)
    }
    return response.json()
  },
}
