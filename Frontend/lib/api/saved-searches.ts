import { authService } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface SavedSearch {
  id: string
  name: string
  description?: string
  search_type: "prospect" | "company"
  filters: any
  nlp_query?: string
  created_at: string
}

const fetchWithAuth = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value)
    }
  })
  return fetch(url, { ...init, headers })
}

export const savedSearchesApi = {
  create: async (data: Omit<SavedSearch, "id" | "created_at">): Promise<SavedSearch> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/saved-searches/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(`Failed to save search: ${response.status}`)
    }

    return response.json()
  },

  list: async (searchType?: "prospect" | "company"): Promise<SavedSearch[]> => {
    const url = searchType 
      ? `${API_BASE_URL}/api/v1/saved-searches/?search_type=${searchType}`
      : `${API_BASE_URL}/api/v1/saved-searches/`
    
    const response = await fetchWithAuth(url)

    if (!response.ok) {
      throw new Error(`Failed to list saved searches: ${response.status}`)
    }

    return response.json()
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/v1/saved-searches/${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      throw new Error(`Failed to delete saved search: ${response.status}`)
    }
  },
}
