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

// ── Types ────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | "connected"
  | "not_connected"
  | "built_in"
  | "error"
  | "expired"
  | "disconnected"

export type AuthType = "oauth2" | "api_key" | "webhook" | "smtp" | "none"

export type IntegrationCategory =
  | "enrichment"
  | "crm"
  | "email"
  | "communication"
  | "social"
  | "automation"
  | "calendar"
  | "productivity"
  | "analytics"
  | "advertising"
  | "support"

export interface Integration {
  id: string
  slug: string
  name: string
  description: string | null
  short_description: string | null
  category: IntegrationCategory
  icon_url: string | null
  auth_type: AuthType
  is_active: boolean
  is_coming_soon: boolean
  is_premium: boolean
  is_built_in: boolean
  credit_cost: string | null
  setup_steps?: string[]
  features?: string[]
  // Connection
  connection_status: ConnectionStatus
  connected_at: string | null
  last_synced_at: string | null
  error_message: string | null
}

export interface IntegrationDetail extends Integration {
  supported_actions: string[]
  supported_triggers: string[]
  documentation_url: string | null
  config: Record<string, any>
}

export interface CategoryInfo {
  category: string
  count: number
}

// ── Category metadata ────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  all: "All Integrations",
  enrichment: "Data Enrichment",
  crm: "CRM",
  email: "Email & Outreach",
  communication: "Communication",
  social: "Social & LinkedIn",
  automation: "Workflow Automation",
  calendar: "Calendar & Meetings",
  productivity: "Productivity",
  analytics: "Analytics",
  advertising: "Advertising & ABM",
  support: "Customer Success",
}

export const CATEGORY_ICONS: Record<string, string> = {
  enrichment: "Database",
  crm: "Users",
  email: "Mail",
  communication: "MessageSquare",
  social: "Share2",
  automation: "Zap",
  calendar: "Calendar",
  productivity: "FolderOpen",
  analytics: "BarChart3",
  advertising: "Megaphone",
  support: "HeadphonesIcon",
}

// ── API Client ───────────────────────────────────────────────────────

export const integrationsApi = {
  getStatus: async (): Promise<{ integrations: Record<string, any> }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/catalog`)
    if (!response.ok) throw new Error("Failed to load integration status")
    const data = await response.json()
    // Convert catalog array to integrations object format for compatibility
    const integrationsObj: Record<string, any> = {}
    data.integrations.forEach((int: any) => {
      integrationsObj[int.slug] = {
        name: int.name,
        connected: int.connection_status === "connected",
        skipped: false,
      }
    })
    return { integrations: integrationsObj }
  },

  getCatalog: async (params?: {
    category?: string
    search?: string
  }): Promise<{ integrations: Integration[]; count: number }> => {
    const searchParams = new URLSearchParams()
    if (params?.category && params.category !== "all") {
      searchParams.set("category", params.category)
    }
    if (params?.search) {
      searchParams.set("search", params.search)
    }

    const qs = searchParams.toString()
    const url = `${BACKEND_BASE}/api/v1/integrations/catalog${qs ? `?${qs}` : ""}`
    const response = await fetchWithAuth(url)
    if (!response.ok) throw new Error("Failed to load integrations")
    return response.json()
  },

  getCategories: async (): Promise<CategoryInfo[]> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/catalog/categories`,
    )
    if (!response.ok) throw new Error("Failed to load categories")
    const data = await response.json()
    return data.categories
  },

  getIntegration: async (slug: string): Promise<IntegrationDetail> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/catalog/${slug}`,
    )
    if (!response.ok) throw new Error("Integration not found")
    return response.json()
  },

  connectIntegration: async (
    slug: string,
    apiKey?: string,
    config?: Record<string, any>,
  ): Promise<{ success: boolean; status: string }> => {
    const payload: Record<string, any> = {}
    if (apiKey) payload.api_key = apiKey
    if (config) payload.config = config

    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/${slug}/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    )
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to connect integration")
    }
    return response.json()
  },

  startOAuth: async (slug: string): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/oauth/${slug}/start`,
    )
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to start OAuth flow")
    }
    return response.json()
  },

  disconnectIntegration: async (slug: string): Promise<void> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/${slug}/disconnect`,
      { method: "POST" },
    )
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to disconnect integration")
    }
  },

  testIntegration: async (slug: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/${slug}/test`,
      { method: "POST" },
    )
    if (!response.ok) throw new Error("Test failed")
    return response.json()
  },

  pushData: async (
    slug: string,
    entities: any[],
    type: "lead" | "company"
  ): Promise<{ success: boolean; message: string; synced_count: number }> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/oauth/${slug}/push`,
      { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities, type })
      },
    )
    if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.detail || "Failed to push data to CRM")
    }
    return response.json()
  },

  // Legacy compat — kept for old IntegrationCard component
  getIntegrations: async (): Promise<Integration[]> => {
    const data = await integrationsApi.getCatalog()
    return data.integrations
  },

  // Test outreach connection (Instantly or Smartlead)
  testOutreach: async (params: { service: string; api_key: string }): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/test/outreach`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    )
    if (!response.ok) {
      const err = await response.json().catch(() => null)
      throw new Error(err?.detail || "Failed to test outreach connection")
    }
    return response.json()
  },

  // Skip integration
  skipIntegration: async (service: string): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(
      `${BACKEND_BASE}/api/v1/integrations/skip/${service}`,
      { method: "POST" },
    )
    if (!response.ok) {
      throw new Error("Failed to skip integration")
    }
    return response.json()
  },

  // HubSpot methods
  getHubspotAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get HubSpot auth URL")
    }
    return response.json()
  },

  hubspotDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/hubspot/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect HubSpot")
    }
    return response.json()
  },

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

  // Salesforce methods
  getSalesforceAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get Salesforce auth URL")
    }
    return response.json()
  },

  salesforceDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/salesforce/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect Salesforce")
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

  // Zoho CRM methods
  getZohoCrmAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get Zoho CRM auth URL")
    }
    return response.json()
  },

  zohoCrmDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/zoho-crm/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect Zoho CRM")
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

  // Slack methods
  getSlackAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/slack/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get Slack auth URL")
    }
    return response.json()
  },

  slackDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/slack/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect Slack")
    }
    const data = await response.json()
    return {
      success: data.success ?? true,
      message: data.message ?? "Slack disconnected successfully",
    }
  },

  // Discord methods
  getDiscordAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/discord/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get Discord auth URL")
    }
    return response.json()
  },

  discordDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/discord/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect Discord")
    }
    return response.json()
  },

  // Teams methods
  getTeamsAuthUrl: async (): Promise<{ auth_url: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/teams/auth-url`)
    if (!response.ok) {
      throw new Error("Failed to get Teams auth URL")
    }
    return response.json()
  },

  teamsDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/teams/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect Teams")
    }
    return response.json()
  },

  // WhatsApp Business methods (Unipile)
  whatsappConnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/whatsapp/connect`, {
      method: "POST",
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to connect WhatsApp" }))
      throw new Error(err.detail || `Failed to connect WhatsApp (${response.status})`)
    }
    return response.json()
  },

  whatsappDisconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/whatsapp/disconnect`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to disconnect WhatsApp")
    }
    return response.json()
  },
}
