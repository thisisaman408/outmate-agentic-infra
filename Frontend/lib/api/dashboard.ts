// Mock API service for dashboard data - ready for backend integration
export interface KPIData {
  totalLeads: number
  activeSignals: number
  runningCampaigns: number
  conversionRate: number
  changePercentage: {
    totalLeads: number
    activeSignals: number
    runningCampaigns: number
    conversionRate: number
  }
}

export interface RecentLead {
  id: string
  companyName: string
  contactName: string
  title: string
  industry: string
  signalsCount: number
  addedAt: string
}

export interface Signal {
  id: string
  companyName: string
  type: string
  confidence: number
  description: string
  timestamp: string
}

export interface CampaignPerformance {
  id: string
  name: string
  status: "running" | "paused" | "completed"
  sent: number
  opened: number
  replied: number
  openRate: number
  replyRate: number
}

export interface AIAgentActivity {
  id: string
  agentType: string
  action: string
  result: string
  timestamp: string
}

export interface TimeSeriesData {
  date: string
  leads: number
  signals: number
  campaigns: number
}

export const dashboardApi = {
  getKPIs: async (): Promise<KPIData> => {
    // Mock data - replace with actual API call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          totalLeads: 1247,
          activeSignals: 342,
          runningCampaigns: 8,
          conversionRate: 23.5,
          changePercentage: {
            totalLeads: 12.5,
            activeSignals: 8.3,
            runningCampaigns: -2.1,
            conversionRate: 3.2,
          },
        })
      }, 800)
    })
  },

  getRecentLeads: async (): Promise<RecentLead[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "1",
            companyName: "TechCorp Solutions",
            contactName: "Sarah Johnson",
            title: "VP of Sales",
            industry: "SaaS",
            signalsCount: 5,
            addedAt: "2 hours ago",
          },
          {
            id: "2",
            companyName: "InnovateLabs",
            contactName: "Michael Chen",
            title: "CTO",
            industry: "AI/ML",
            signalsCount: 3,
            addedAt: "5 hours ago",
          },
          {
            id: "3",
            companyName: "DataDrive Inc",
            contactName: "Emily Rodriguez",
            title: "Head of Marketing",
            industry: "Analytics",
            signalsCount: 7,
            addedAt: "1 day ago",
          },
          {
            id: "4",
            companyName: "CloudScale Systems",
            contactName: "David Kim",
            title: "Director of Engineering",
            industry: "Cloud Infrastructure",
            signalsCount: 4,
            addedAt: "1 day ago",
          },
          {
            id: "5",
            companyName: "Nexus Enterprises",
            contactName: "Lisa Wang",
            title: "CEO",
            industry: "Enterprise Software",
            signalsCount: 6,
            addedAt: "2 days ago",
          },
        ])
      }, 900)
    })
  },

  getActiveSignals: async (): Promise<Signal[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "1",
            companyName: "TechCorp Solutions",
            type: "Job Posting",
            confidence: 92,
            description: "Hiring for VP of Sales - expansion signal",
            timestamp: "1 hour ago",
          },
          {
            id: "2",
            companyName: "InnovateLabs",
            type: "Funding",
            confidence: 88,
            description: "Series B funding announced - $50M",
            timestamp: "3 hours ago",
          },
          {
            id: "3",
            companyName: "DataDrive Inc",
            type: "Tech Stack",
            confidence: 85,
            description: "Recently adopted similar tools",
            timestamp: "6 hours ago",
          },
        ])
      }, 850)
    })
  },

  getCampaignPerformance: async (): Promise<CampaignPerformance[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "1",
            name: "Q1 Enterprise Outreach",
            status: "running",
            sent: 450,
            opened: 234,
            replied: 67,
            openRate: 52,
            replyRate: 14.9,
          },
          {
            id: "2",
            name: "Product Launch Campaign",
            status: "running",
            sent: 320,
            opened: 198,
            replied: 45,
            openRate: 61.9,
            replyRate: 14.1,
          },
          {
            id: "3",
            name: "Webinar Follow-up",
            status: "paused",
            sent: 180,
            opened: 95,
            replied: 23,
            openRate: 52.8,
            replyRate: 12.8,
          },
        ])
      }, 950)
    })
  },

  getAIAgentActivity: async (): Promise<AIAgentActivity[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            id: "1",
            agentType: "Research Agent",
            action: "Analyzed TechCorp Solutions",
            result: "High-fit prospect identified",
            timestamp: "30 min ago",
          },
          {
            id: "2",
            agentType: "Lookalike Agent",
            action: "Found 12 similar companies",
            result: "Added to pipeline",
            timestamp: "1 hour ago",
          },
          {
            id: "3",
            agentType: "Predictive Agent",
            action: "Scored 45 leads",
            result: "15 high-probability conversions",
            timestamp: "2 hours ago",
          },
        ])
      }, 900)
    })
  },

  getTimeSeriesData: async (): Promise<TimeSeriesData[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { date: "Jan 1", leads: 120, signals: 45, campaigns: 5 },
          { date: "Jan 8", leads: 145, signals: 52, campaigns: 6 },
          { date: "Jan 15", leads: 178, signals: 68, campaigns: 7 },
          { date: "Jan 22", leads: 195, signals: 75, campaigns: 8 },
          { date: "Jan 29", leads: 210, signals: 82, campaigns: 8 },
          { date: "Feb 5", leads: 245, signals: 95, campaigns: 9 },
          { date: "Feb 12", leads: 267, signals: 103, campaigns: 10 },
        ])
      }, 1000)
    })
  },
}
