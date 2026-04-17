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

export const smartleadApi = {
  refreshWarmup: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/smartlead/warmup`, {
      method: "POST",
    })
    if (!response.ok) {
      throw new Error("Failed to refresh Smartlead warmup")
    }
    return response.json()
  },
}
