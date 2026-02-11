// Mock API service for campaigns - ready for backend integration
export interface Campaign {
  id: string
  name: string
  type: "email" | "slack" | "multi-channel"
  status: "draft" | "running" | "paused" | "completed"
  objective: string
  message: string
  leads: string[]
  leadsCount: number
  stats: {
    sent: number
    opened: number
    replied: number
    bounced: number
    openRate: number
    replyRate: number
  }
  schedule?: {
    startDate: string
    endDate?: string
    frequency?: string
  }
  createdAt: string
  updatedAt: string
}

export interface CreateCampaignRequest {
  name: string
  type: Campaign["type"]
  objective: string
  leads: string[]
  schedule?: Campaign["schedule"]
}

export const campaignsApi = {
  getCampaigns: async (): Promise<Campaign[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockCampaigns: Campaign[] = [
          {
            id: "1",
            name: "Q1 Enterprise Outreach",
            type: "email",
            status: "running",
            objective: "Introduce our new enterprise features to qualified leads",
            message:
              "Hi {{firstName}},\n\nI noticed your company is growing rapidly. Our platform can help you scale your GTM operations...",
            leads: ["1", "2", "3"],
            leadsCount: 450,
            stats: {
              sent: 450,
              opened: 234,
              replied: 67,
              bounced: 8,
              openRate: 52.0,
              replyRate: 14.9,
            },
            schedule: {
              startDate: "2025-01-01",
              frequency: "daily",
            },
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-07T00:00:00Z",
          },
          {
            id: "2",
            name: "Product Launch Campaign",
            type: "multi-channel",
            status: "running",
            objective: "Announce new AI features to existing customers",
            message: "Exciting news! We've just launched our new AI-powered research agent...",
            leads: ["4", "5"],
            leadsCount: 320,
            stats: {
              sent: 320,
              opened: 198,
              replied: 45,
              bounced: 5,
              openRate: 61.9,
              replyRate: 14.1,
            },
            schedule: {
              startDate: "2025-01-05",
              endDate: "2025-01-20",
            },
            createdAt: "2025-01-05T00:00:00Z",
            updatedAt: "2025-01-07T00:00:00Z",
          },
          {
            id: "3",
            name: "Webinar Follow-up",
            type: "email",
            status: "paused",
            objective: "Follow up with webinar attendees",
            message: "Thanks for attending our webinar! Here are the key takeaways...",
            leads: [],
            leadsCount: 180,
            stats: {
              sent: 180,
              opened: 95,
              replied: 23,
              bounced: 3,
              openRate: 52.8,
              replyRate: 12.8,
            },
            schedule: {
              startDate: "2024-12-15",
            },
            createdAt: "2024-12-15T00:00:00Z",
            updatedAt: "2025-01-03T00:00:00Z",
          },
          {
            id: "4",
            name: "Cold Outreach - SaaS",
            type: "email",
            status: "draft",
            objective: "Reach out to SaaS companies with 100-500 employees",
            message: "Hi {{firstName}},\n\nI came across {{companyName}} and was impressed by...",
            leads: [],
            leadsCount: 0,
            stats: {
              sent: 0,
              opened: 0,
              replied: 0,
              bounced: 0,
              openRate: 0,
              replyRate: 0,
            },
            createdAt: "2025-01-06T00:00:00Z",
            updatedAt: "2025-01-06T00:00:00Z",
          },
        ]
        resolve(mockCampaigns)
      }, 1000)
    })
  },

  getCampaign: async (id: string): Promise<Campaign | null> => {
    const campaigns = await campaignsApi.getCampaigns()
    return campaigns.find((c) => c.id === id) || null
  },

  createCampaign: async (request: CreateCampaignRequest): Promise<Campaign> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newCampaign: Campaign = {
          id: Math.random().toString(36).substr(2, 9),
          name: request.name,
          type: request.type,
          status: "draft",
          objective: request.objective,
          message: "",
          leads: request.leads,
          leadsCount: request.leads.length,
          stats: {
            sent: 0,
            opened: 0,
            replied: 0,
            bounced: 0,
            openRate: 0,
            replyRate: 0,
          },
          schedule: request.schedule,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        resolve(newCampaign)
      }, 1000)
    })
  },

  updateCampaignStatus: async (id: string, status: Campaign["status"]): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Updated campaign ${id} to status ${status}`)
        resolve()
      }, 500)
    })
  },

  generateMessage: async (objective: string, leads: string[]): Promise<string> => {
    // Mock AI message generation
    return new Promise((resolve) => {
      setTimeout(() => {
        const message = `Hi {{firstName}},

I hope this email finds you well. I noticed that {{companyName}} has been making impressive strides in your industry.

${objective}

I'd love to show you how our platform can help you achieve your goals. Would you be open to a quick 15-minute call next week?

Best regards,
Your name`
        resolve(message)
      }, 1500)
    })
  },
}
