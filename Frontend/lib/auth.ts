// Auth service integrating with Backend API
// Proxied via next.config.mjs: /api/:path* → NEXT_PUBLIC_API_URL/api/:path*
const API_URL = "/api/v1/auth"

export interface User {
  id: string
  email: string
  name: string
  workspace: string
  credits: number
  plan?: "basic" | "pro"
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const AUTH_KEY = "outmate_auth_token"
const USER_KEY = "outmate_user_data"

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.message || "Login failed")
      }

      const data = await response.json()

      // Store token and user
      localStorage.setItem(AUTH_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))

      return data.user
    } catch (error) {
      console.error("Login service error:", error)
      throw error
    }
  },

  signup: async (email: string, password: string, name: string, workspace?: string): Promise<User> => {
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, workspace }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.message || "Signup failed")
      }

      const data = await response.json()

      // After registration, immediately log in to obtain the auth token
      const loginResponse = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (loginResponse.ok) {
        const loginData = await loginResponse.json()
        localStorage.setItem(AUTH_KEY, loginData.token)
        localStorage.setItem(USER_KEY, JSON.stringify(loginData.user))
        return loginData.user
      }

      return data.user
    } catch (error) {
      console.error("Signup service error:", error)
      throw error
    }
  },

  logout: async (): Promise<void> => {
    const token = localStorage.getItem(AUTH_KEY)
    // Revoke the JWT server-side (adds jti to Redis denylist)
    if (token) {
      try {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      } catch {
        // Non-fatal — local session is cleared regardless
      }
    }
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(USER_KEY)
  },

  getCurrentUser: (): User | null => {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  },

  getToken: (): string | null => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(AUTH_KEY)
  },

  // Helper to get headers with token
  getAuthHeaders: () => {
    const token = localStorage.getItem(AUTH_KEY)
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    // Placeholder - Backend endpoint for reset not implemented yet
    console.log("Password reset requested for:", email)
    return Promise.resolve()
  },
}
