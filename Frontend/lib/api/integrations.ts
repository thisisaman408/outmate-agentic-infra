// Mock API service for integrations - ready for backend integration
export interface Integration {
  id: string
  name: string
  category: "crm" | "communication" | "email" | "webhooks" | "data"
  icon: string
  description: string
  status: "connected" | "disconnected" | "error"
  connectedAt?: string
  config?: Record<string, any>
}

export const integrationsApi = {
  getIntegrations: async (): Promise<Integration[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const integrations: Integration[] = [
          {
            id: "1",
            name: "Salesforce",
            category: "crm",
            icon: "🔵",
            description: "Sync leads and opportunities with Salesforce CRM",
            status: "connected",
            connectedAt: "2025-01-01T00:00:00Z",
            config: {
              instanceUrl: "https://company.salesforce.com",
              syncFrequency: "real-time",
            },
          },
          {
            id: "2",
            name: "HubSpot",
            category: "crm",
            icon: "🟠",
            description: "Integrate with HubSpot CRM and marketing tools",
            status: "disconnected",
          },
          {
            id: "3",
            name: "Slack",
            category: "communication",
            icon: "💬",
            description: "Send notifications and updates to Slack channels",
            status: "connected",
            connectedAt: "2025-01-03T00:00:00Z",
            config: {
              workspaceName: "Outmate Team",
              defaultChannel: "#sales-alerts",
            },
          },
          {
            id: "4",
            name: "Gmail",
            category: "email",
            icon: "📧",
            description: "Send campaigns and track emails through Gmail",
            status: "disconnected",
          },
          {
            id: "5",
            name: "Webhooks",
            category: "webhooks",
            icon: "🔗",
            description: "Receive real-time updates via custom webhooks",
            status: "connected",
            connectedAt: "2024-12-15T00:00:00Z",
            config: {
              endpoints: 3,
            },
          },
          {
            id: "6",
            name: "Zapier",
            category: "data",
            icon: "⚡",
            description: "Connect with 5000+ apps through Zapier",
            status: "disconnected",
          },
        ]
        resolve(integrations)
      }, 1000)
    })
  },

  connectIntegration: async (integrationId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Connected integration ${integrationId}`)
        resolve()
      }, 1500)
    })
  },

  disconnectIntegration: async (integrationId: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Disconnected integration ${integrationId}`)
        resolve()
      }, 500)
    })
  },
}
