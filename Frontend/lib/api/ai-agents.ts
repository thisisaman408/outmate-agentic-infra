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
  id: string
  companyId: string
  companyName: string
  contactName: string
  title: string
  email: string
  score: number
  conversionLikelihood: number
  confidence: number
  prediction: "High" | "Medium" | "Low"
  factors: {
    name: string
    impact: "positive" | "negative"
  }[]
  guidance: string
  recommendation: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const aiAgentsApi = {
  // Agentic Search Agent
  searchProspects: async (query: string): Promise<AgenticSearchResult[]> => {
    const response = await fetch(`${API_BASE_URL}/api/ai-agents/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error('Failed to search prospects');
    return response.json();
  },

  // Lookalike Agent
  findLookalikeCompanies: async (seedCompanyIds: string[]): Promise<LookalikeResult[]> => {
    const response = await fetch(`${API_BASE_URL}/api/ai-agents/lookalike`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedCompanyIds }),
    });
    if (!response.ok) throw new Error('Failed to find lookalikes');
    return response.json();
  },

  // Research Agent
  researchCompany: async (companyName: string, depth: "quick" | "standard" | "deep"): Promise<ResearchResult> => {
    const response = await fetch(`${API_BASE_URL}/api/ai-agents/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, depth }),
    });
    if (!response.ok) throw new Error('Failed to research company');
    return response.json();
  },

  // Predictive Agent
  scoreLeads: async (leadIds: string[]): Promise<PredictiveScore[]> => {
    const response = await fetch(`${API_BASE_URL}/api/ai-agents/predictive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds }),
    });
    if (!response.ok) throw new Error('Failed to score leads');
    return response.json();
  },
}
