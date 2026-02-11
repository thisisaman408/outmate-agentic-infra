// Mock API service for signals - ready for backend integration
export interface Signal {
  id: string
  companyId: string
  companyName: string
  type: "job_posting" | "funding" | "tech_stack" | "leadership_change" | "product_launch" | "expansion"
  confidence: number
  title: string
  description: string
  source: string
  impact: "high" | "medium" | "low"
  timestamp: string
  metadata?: {
    amount?: string
    position?: string
    technology?: string
    location?: string
  }
}

export interface SignalFilters {
  type?: string
  minConfidence?: number
  companyId?: string
}

export const signalsApi = {
  getSignals: async (filters?: SignalFilters): Promise<Signal[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockSignals: Signal[] = [
          {
            id: "1",
            companyId: "1",
            companyName: "TechCorp Solutions",
            type: "job_posting",
            confidence: 92,
            title: "Hiring VP of Sales",
            description: "Posted 3 new sales leadership positions indicating expansion into enterprise segment",
            source: "LinkedIn",
            impact: "high",
            timestamp: "1 hour ago",
            metadata: {
              position: "VP of Sales, Enterprise",
            },
          },
          {
            id: "2",
            companyId: "2",
            companyName: "InnovateLabs",
            type: "funding",
            confidence: 88,
            title: "Series B Funding Announced",
            description: "Raised $50M in Series B funding led by top-tier VCs",
            source: "TechCrunch",
            impact: "high",
            timestamp: "3 hours ago",
            metadata: {
              amount: "$50M",
            },
          },
          {
            id: "3",
            companyId: "3",
            companyName: "DataDrive Inc",
            type: "tech_stack",
            confidence: 85,
            title: "Recently Adopted Snowflake",
            description: "Job postings mention Snowflake expertise, indicating recent adoption",
            source: "Job Boards",
            impact: "medium",
            timestamp: "6 hours ago",
            metadata: {
              technology: "Snowflake",
            },
          },
          {
            id: "4",
            companyId: "4",
            companyName: "CloudScale Systems",
            type: "leadership_change",
            confidence: 90,
            title: "New CRO Appointed",
            description: "Hired experienced CRO from competitor, signaling aggressive growth strategy",
            source: "Press Release",
            impact: "high",
            timestamp: "1 day ago",
            metadata: {
              position: "Chief Revenue Officer",
            },
          },
          {
            id: "5",
            companyId: "5",
            companyName: "Nexus Enterprises",
            type: "product_launch",
            confidence: 87,
            title: "New Product Line Launch",
            description: "Announced launch of new enterprise product suite targeting mid-market",
            source: "Company Website",
            impact: "high",
            timestamp: "2 days ago",
          },
          {
            id: "6",
            companyId: "1",
            companyName: "TechCorp Solutions",
            type: "expansion",
            confidence: 83,
            title: "Opening European Offices",
            description: "Job postings for multiple positions in London and Berlin offices",
            source: "LinkedIn",
            impact: "medium",
            timestamp: "3 days ago",
            metadata: {
              location: "London, Berlin",
            },
          },
        ]
        resolve(mockSignals)
      }, 1000)
    })
  },

  getSignalsByCompany: async (companyId: string): Promise<Signal[]> => {
    const allSignals = await signalsApi.getSignals()
    return allSignals.filter((signal) => signal.companyId === companyId)
  },
}
