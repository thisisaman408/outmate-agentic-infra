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

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  createdAt?: string
}

export interface WorkspaceSettings {
  name: string
  plan: "free" | "pro" | "enterprise"
  members: number
  billingEmail: string
}

export interface APIKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed?: string
}

export interface NotificationSettings {
  emailNotifications: boolean
  slackNotifications: boolean
  newLeads: boolean
  campaignUpdates: boolean
  signalAlerts: boolean
  weeklyReport: boolean
}

export const settingsApi = {
  // Get current user profile from /auth/me endpoint
  getUserProfile: async (): Promise<UserProfile> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/auth/me`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to fetch profile" }))
      throw new Error(err.detail || `Failed to fetch profile (${response.status})`)
    }
    const data = await response.json()
    return {
      id: data.id,
      name: data.name || data.email?.split("@")[0] || "User",
      email: data.email,
      role: data.user_role || "Member",
      avatar: data.avatar,
      createdAt: data.created_at,
    }
  },

  // Update user profile
  updateUserProfile: async (profile: Partial<UserProfile>): Promise<void> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/auth/update-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to update profile" }))
      throw new Error(err.detail || `Failed to update profile (${response.status})`)
    }
  },

  // Get workspace settings (from user integrations/onboarding data)
  getWorkspaceSettings: async (): Promise<WorkspaceSettings> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/auth/me`)
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to fetch workspace" }))
      throw new Error(err.detail || `Failed to fetch workspace (${response.status})`)
    }
    const data = await response.json()
    return {
      name: data.org_name || "Outmate Workspace",
      plan: data.plan || "pro",
      members: data.team_size || 1,
      billingEmail: data.billing_email || data.email,
    }
  },

  // Update workspace settings
  updateWorkspaceSettings: async (settings: Partial<WorkspaceSettings>): Promise<void> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/auth/update-workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to update workspace" }))
      throw new Error(err.detail || `Failed to update workspace (${response.status})`)
    }
  },

  // Get API keys (mock for now - would need dedicated endpoint)
  getAPIKeys: async (): Promise<APIKey[]> => {
    // Return empty array - API keys would need a dedicated backend endpoint
    return []
  },

  // Create API key (mock for now)
  createAPIKey: async (name: string): Promise<APIKey> => {
    throw new Error("API key creation not implemented on backend")
  },

  // Delete API key (mock for now)
  deleteAPIKey: async (keyId: string): Promise<void> => {
    throw new Error("API key deletion not implemented on backend")
  },

  // Get notification settings (from user preferences)
  getNotificationSettings: async (): Promise<NotificationSettings> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/auth/me`)
    if (!response.ok) {
      // Return defaults on error
      return {
        emailNotifications: true,
        slackNotifications: true,
        newLeads: true,
        campaignUpdates: true,
        signalAlerts: true,
        weeklyReport: false,
      }
    }
    const data = await response.json()
    const prefs = data.notification_preferences || {}
    return {
      emailNotifications: prefs.email ?? true,
      slackNotifications: prefs.slack ?? true,
      newLeads: prefs.newLeads ?? true,
      campaignUpdates: prefs.campaigns ?? true,
      signalAlerts: prefs.signals ?? true,
      weeklyReport: prefs.weeklyReport ?? false,
    }
  },

  // Update notification settings
  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<void> => {
    const response = await fetchWithAuth(`${BACKEND_BASE}/api/v1/auth/update-notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Failed to update notifications" }))
      throw new Error(err.detail || `Failed to update notifications (${response.status})`)
    }
  },
}
