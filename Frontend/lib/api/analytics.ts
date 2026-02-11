// Mock API service for analytics - ready for backend integration
export interface LeadFunnelData {
  stage: string
  count: number
  percentage: number
}

export interface SignalsCorrelation {
  signalType: string
  conversions: number
  conversionRate: number
}

export interface CampaignMetrics {
  campaignName: string
  leads: number
  conversions: number
  revenue: number
}

export interface AgentEffectiveness {
  agentType: string
  tasksCompleted: number
  successRate: number
  avgTime: string
}

export const analyticsApi = {
  getLeadFunnel: async (): Promise<LeadFunnelData[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { stage: "Generated", count: 1247, percentage: 100 },
          { stage: "Contacted", count: 892, percentage: 71.5 },
          { stage: "Engaged", count: 456, percentage: 36.6 },
          { stage: "Qualified", count: 234, percentage: 18.8 },
          { stage: "Converted", count: 89, percentage: 7.1 },
        ])
      }, 800)
    })
  },

  getSignalsCorrelation: async (): Promise<SignalsCorrelation[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { signalType: "Job Posting", conversions: 45, conversionRate: 28.5 },
          { signalType: "Funding", conversions: 38, conversionRate: 32.1 },
          { signalType: "Tech Stack", conversions: 32, conversionRate: 24.8 },
          { signalType: "Leadership Change", conversions: 28, conversionRate: 31.2 },
          { signalType: "Product Launch", conversions: 22, conversionRate: 26.7 },
        ])
      }, 850)
    })
  },

  getCampaignMetrics: async (): Promise<CampaignMetrics[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { campaignName: "Q1 Enterprise", leads: 450, conversions: 67, revenue: 234500 },
          { campaignName: "Product Launch", leads: 320, conversions: 45, revenue: 156200 },
          { campaignName: "Webinar Follow-up", leads: 180, conversions: 23, revenue: 78900 },
          { campaignName: "Cold Outreach", leads: 620, conversions: 38, revenue: 125600 },
        ])
      }, 900)
    })
  },

  getAgentEffectiveness: async (): Promise<AgentEffectiveness[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { agentType: "Research Agent", tasksCompleted: 342, successRate: 87.5, avgTime: "2.3 min" },
          { agentType: "Lookalike Agent", tasksCompleted: 156, successRate: 92.1, avgTime: "1.8 min" },
          { agentType: "Predictive Agent", tasksCompleted: 489, successRate: 84.3, avgTime: "0.9 min" },
          { agentType: "Agentic Search", tasksCompleted: 567, successRate: 89.7, avgTime: "1.2 min" },
        ])
      }, 950)
    })
  },
}
