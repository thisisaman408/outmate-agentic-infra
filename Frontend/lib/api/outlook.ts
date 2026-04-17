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

export const outlookApi = {
  getProfile: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/profile`)
    if (!response.ok) {
      throw new Error("Failed to get Outlook profile")
    }
    return response.json()
  },

  getFolders: async () => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/integrations/outlook/folders`)
    if (!response.ok) {
      throw new Error("Failed to get Outlook folders")
    }
    return response.json()
  },
}
