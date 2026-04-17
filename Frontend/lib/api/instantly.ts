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

export const instantlyApi = {
  getAnalyticsOverview: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/instantly/analytics`)
    if (!response.ok) {
      throw new Error("Failed to get Instantly analytics")
    }
    return response.json()
  },

  getSuppressionList: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/instantly/suppression`)
    if (!response.ok) {
      throw new Error("Failed to get Instantly suppression list")
    }
    return response.json()
  },

  setupWebhooks: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/instantly/webhooks`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to setup Instantly webhooks")
    }
    return response.json()
  },

  syncBlockList: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/instantly/sync-blocklist`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to sync Instantly block list")
    }
    return response.json()
  },
}
