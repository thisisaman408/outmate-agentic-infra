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

export const mailchimpApi = {
  getAudiences: async (limit: number = 10) => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/mailchimp/audiences?limit=${limit}`)
    if (!response.ok) {
      throw new Error("Failed to get Mailchimp audiences")
    }
    return response.json()
  },

  getAnalyticsOverview: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/mailchimp/analytics`)
    if (!response.ok) {
      throw new Error("Failed to get Mailchimp analytics")
    }
    return response.json()
  },
}
