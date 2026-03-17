// Auth service — integrates with Backend API via Next.js proxy
const API_URL = "/api/v1/auth"

export interface User {
  id: string
  email: string
  name: string
  workspace: string
  credits: number
  plan?: "free" | "basic" | "pro" | "enterprise"
  is_email_verified?: boolean
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

const AUTH_KEY = "outmate_auth_token"
const USER_KEY = "outmate_user_data"

export const authService = {
  login: async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Login failed")
    }

    const data = await response.json()
    localStorage.setItem(AUTH_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

  signup: async (
    email: string,
    password: string,
    name: string,
    workspace?: string,
    termsAccepted = false,
  ): Promise<User> => {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, workspace, terms_accepted: termsAccepted }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Signup failed")
    }

    // Registration succeeded — user still needs OTP verification; don't auto-login
    const data = await response.json()
    return data.user
  },

  googleLogin: async (credential: string, termsAccepted = false): Promise<User> => {
    const response = await fetch(`${API_URL}/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, terms_accepted: termsAccepted }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Google sign-in failed")
    }

    const data = await response.json()
    localStorage.setItem(AUTH_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

  sendOtp: async (email: string): Promise<void> => {
    const response = await fetch(`${API_URL}/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Failed to send verification code")
    }
  },

  verifyOtp: async (email: string, otp: string): Promise<User> => {
    const response = await fetch(`${API_URL}/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "Invalid verification code")
    }

    const data = await response.json()
    localStorage.setItem(AUTH_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

  logout: async (): Promise<void> => {
    const token = localStorage.getItem(AUTH_KEY)
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

  getAuthHeaders: () => {
    const token = typeof window !== "undefined" ? localStorage.getItem(AUTH_KEY) : null
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    }
  },

  resetPassword: async (_email: string): Promise<void> => {
    // TODO: implement password reset endpoint
    return Promise.resolve()
  },
}
