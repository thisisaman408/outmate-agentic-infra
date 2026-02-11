// Mock API service for settings - ready for backend integration
export interface UserProfile {
  name: string
  email: string
  role: string
  avatar?: string
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
  getUserProfile: async (): Promise<UserProfile> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          name: "John Doe",
          email: "john.doe@company.com",
          role: "Admin",
        })
      }, 500)
    })
  },

  updateUserProfile: async (profile: Partial<UserProfile>): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("Updated user profile:", profile)
        resolve()
      }, 500)
    })
  },

  getWorkspaceSettings: async (): Promise<WorkspaceSettings> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          name: "Outmate Workspace",
          plan: "pro",
          members: 5,
          billingEmail: "billing@company.com",
        })
      }, 500)
    })
  },

  updateWorkspaceSettings: async (settings: Partial<WorkspaceSettings>): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("Updated workspace settings:", settings)
        resolve()
      }, 500)
    })
  },

  getAPIKeys: async (): Promise<APIKey[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "1",
            name: "Production API Key",
            key: "om_live_xxxxxxxxxxxxxxxxxxxxxxxx",
            createdAt: "2025-01-01T00:00:00Z",
            lastUsed: "2025-01-07T10:30:00Z",
          },
          {
            id: "2",
            name: "Development API Key",
            key: "om_dev_xxxxxxxxxxxxxxxxxxxxxxxx",
            createdAt: "2024-12-15T00:00:00Z",
            lastUsed: "2025-01-05T14:20:00Z",
          },
        ])
      }, 500)
    })
  },

  createAPIKey: async (name: string): Promise<APIKey> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: Math.random().toString(36).substr(2, 9),
          name,
          key: `om_${Math.random().toString(36).substr(2, 32)}`,
          createdAt: new Date().toISOString(),
        })
      }, 500)
    })
  },

  deleteAPIKey: async (keyId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("Deleted API key:", keyId)
        resolve()
      }, 500)
    })
  },

  getNotificationSettings: async (): Promise<NotificationSettings> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          emailNotifications: true,
          slackNotifications: true,
          newLeads: true,
          campaignUpdates: true,
          signalAlerts: true,
          weeklyReport: false,
        })
      }, 500)
    })
  },

  updateNotificationSettings: async (settings: Partial<NotificationSettings>): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("Updated notification settings:", settings)
        resolve()
      }, 500)
    })
  },
}
