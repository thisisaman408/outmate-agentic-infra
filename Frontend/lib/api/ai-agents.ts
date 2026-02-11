// Mock API service for AI agents - ready for backend integration
export interface AgentResult {
  id: string
  timestamp: string
  data: any
}

export interface AgenticSearchResult {
  id: string
  companyName: string
  score: number
  reason: string
  industry: string
  employees: string
  location: string
  contactName: string
  title: string
  email: string
}

export interface LookalikeResult {
  id: string
  companyName: string
  similarityScore: number
  matchingFactors: string[]
  industry: string
  employees: string
  location: string
  revenue?: string
}

export interface ResearchResult {
  companyName: string
  summary: string
  marketPosition: string
  keyInsights: string[]
  opportunities: string[]
  risks: string[]
  competitors: string[]
  recentNews: string[]
}

export interface PredictiveScore {
  companyId: string
  companyName: string
  conversionLikelihood: number
  confidence: number
  reasons: {
    factor: string
    impact: "positive" | "negative" | "neutral"
    weight: number
  }[]
  recommendation: string
}

export const aiAgentsApi = {
  // Agentic Search Agent
  searchProspects: async (query: string): Promise<AgenticSearchResult[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const results: AgenticSearchResult[] = [
          {
            id: "1",
            companyName: "TechVenture Solutions",
            score: 95,
            reason: "Perfect fit: Recently raised Series B, hiring sales team, using competitor tools",
            industry: "SaaS",
            employees: "100-500",
            location: "San Francisco, CA",
            contactName: "Jennifer Martinez",
            title: "VP of Revenue Operations",
            email: "j.martinez@techventure.com",
          },
          {
            id: "2",
            companyName: "CloudCore Industries",
            score: 92,
            reason: "Strong match: Expanding to enterprise, posted job for GTM leader",
            industry: "Cloud Infrastructure",
            employees: "200-1000",
            location: "Seattle, WA",
            contactName: "Robert Chen",
            title: "Chief Growth Officer",
            email: "r.chen@cloudcore.io",
          },
          {
            id: "3",
            companyName: "DataFlow Analytics",
            score: 88,
            reason: "Good fit: Growing fast, recently adopted similar stack",
            industry: "Data Analytics",
            employees: "50-100",
            location: "Austin, TX",
            contactName: "Amanda Williams",
            title: "Head of Sales",
            email: "awilliams@dataflow.ai",
          },
          {
            id: "4",
            companyName: "Innovate Labs",
            score: 85,
            reason: "Potential fit: New funding round, targeting similar market segment",
            industry: "AI/ML",
            employees: "100-500",
            location: "Boston, MA",
            contactName: "Michael Lee",
            title: "Director of Business Development",
            email: "m.lee@innovatelabs.com",
          },
        ]
        resolve(results)
      }, 2000)
    })
  },

  // Lookalike Agent
  findLookalikeCompanies: async (seedCompanyIds: string[]): Promise<LookalikeResult[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const results: LookalikeResult[] = [
          {
            id: "1",
            companyName: "SimilarTech Corp",
            similarityScore: 94,
            matchingFactors: ["Industry", "Company Size", "Tech Stack", "Growth Stage", "Revenue"],
            industry: "SaaS",
            employees: "100-500",
            location: "San Francisco, CA",
            revenue: "$10M-$50M",
          },
          {
            id: "2",
            companyName: "ParallelSoft Inc",
            similarityScore: 91,
            matchingFactors: ["Industry", "Company Size", "Funding Stage", "Market"],
            industry: "Enterprise Software",
            employees: "200-500",
            location: "New York, NY",
            revenue: "$20M-$50M",
          },
          {
            id: "3",
            companyName: "MatchPoint Systems",
            similarityScore: 87,
            matchingFactors: ["Tech Stack", "Growth Stage", "Employee Count"],
            industry: "SaaS",
            employees: "100-200",
            location: "Austin, TX",
            revenue: "$5M-$20M",
          },
          {
            id: "4",
            companyName: "EchoScale Solutions",
            similarityScore: 84,
            matchingFactors: ["Industry", "Revenue Range", "Market Segment"],
            industry: "Cloud Services",
            employees: "150-300",
            location: "Seattle, WA",
            revenue: "$10M-$30M",
          },
        ]
        resolve(results)
      }, 2500)
    })
  },

  // Research Agent
  researchCompany: async (companyName: string, depth: "quick" | "standard" | "deep"): Promise<ResearchResult> => {
    return new Promise((resolve) => {
      setTimeout(
        () => {
          const result: ResearchResult = {
            companyName,
            summary: `${companyName} is a rapidly growing B2B SaaS company specializing in enterprise solutions. Founded in 2020, they've raised $75M in funding and serve over 500 enterprise customers across North America and Europe.`,
            marketPosition:
              "Mid-market leader with strong growth trajectory. Positioned between established players and emerging startups, focusing on ease of use and integration capabilities.",
            keyInsights: [
              "Recently expanded into European market with new London office",
              "Product roadmap includes AI-powered features launching Q2 2025",
              "Customer retention rate of 95%, above industry average",
              "Strong partnerships with major cloud providers",
              "Leadership team has successful exits in similar companies",
            ],
            opportunities: [
              "Gap in their current tech stack that our solution addresses",
              "Hiring 10+ sales roles indicating expansion phase",
              "Recent funding provides budget for new tools",
              "Current solution limitations mentioned in reviews",
            ],
            risks: [
              "Recently signed with competitor 6 months ago",
              "Complex procurement process typical for enterprise",
              "Budget allocated primarily to Q1 and Q4",
            ],
            competitors: ["CompetitorA", "CompetitorB", "CompetitorC"],
            recentNews: [
              "Announced Series C funding of $50M - TechCrunch, 2 weeks ago",
              "Launched new product line targeting mid-market - Press Release, 1 month ago",
              "Hired former CompetitorA VP as new CRO - LinkedIn, 3 weeks ago",
            ],
          }
          resolve(result)
        },
        depth === "quick" ? 1500 : depth === "standard" ? 2500 : 4000,
      )
    })
  },

  // Predictive Agent
  scoreLeads: async (leadIds: string[]): Promise<PredictiveScore[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const scores: PredictiveScore[] = [
          {
            companyId: "1",
            companyName: "TechCorp Solutions",
            conversionLikelihood: 87,
            confidence: 92,
            reasons: [
              { factor: "Recent funding", impact: "positive", weight: 25 },
              { factor: "Active hiring", impact: "positive", weight: 20 },
              { factor: "Similar tech stack", impact: "positive", weight: 18 },
              { factor: "Strong buying signals", impact: "positive", weight: 22 },
              { factor: "Budget timing", impact: "neutral", weight: 15 },
            ],
            recommendation:
              "High priority - Engage within 48 hours. Strong buying signals and ideal customer profile match.",
          },
          {
            companyId: "2",
            companyName: "DataDrive Inc",
            conversionLikelihood: 72,
            confidence: 85,
            reasons: [
              { factor: "Company size match", impact: "positive", weight: 20 },
              { factor: "Industry alignment", impact: "positive", weight: 15 },
              { factor: "Recent competitor adoption", impact: "negative", weight: -12 },
              { factor: "Growth trajectory", impact: "positive", weight: 18 },
              { factor: "Decision maker accessible", impact: "positive", weight: 12 },
            ],
            recommendation: "Medium priority - Good fit but may need longer nurture cycle. Focus on differentiation.",
          },
        ]
        resolve(scores)
      }, 2000)
    })
  },
}
