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
  linkedin?: string
  perplexityReason?: string
  perplexityDetails?: string
  perplexityReasoning?: any
  contacts?: { name?: string; title?: string; role?: string; email?: string }[]
}

export interface LookalikeResult {
  id: string
  companyName: string
  similarityScore?: number
  matchingFactors?: string[]
  industry?: string
  employees?: string
  location?: string
  revenue?: string
  website?: string
  description?: string
  similarityLabel?: string
}

export interface ResearchResult {
  companyName: string
  summary: string
  marketPosition: string | { positioning?: string; industry?: string; geographicPresence?: string }
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
  profileLink?: string
}

const API_BASE_URL = ""

function getHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('outmate_auth_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const aiAgentsApi = {
  // Agentic Search Agent
  searchProspects: async (query: string): Promise<AgenticSearchResult[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai-agents/search`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error('Failed to search prospects');
    return response.json();
  },

  // Lookalike Agent
  findLookalikeCompanies: async (seedCompanyIds: string[]): Promise<LookalikeResult[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai-agents/lookalike`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ seedCompanyIds }),
    });
    if (!response.ok) throw new Error('Failed to find lookalikes');
    return response.json();
  },

  // Research Agent
  researchCompany: async (companyName: string, depth: "quick" | "standard" | "deep"): Promise<ResearchResult> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai-agents/research`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ companyName, depth }),
    });
    if (!response.ok) throw new Error('Failed to research company');
    return response.json();
  },

  // Predictive Agent
  scoreLeads: async (company: { name: string; domain?: string; industry?: string; country?: string }): Promise<PredictiveScore[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai-agents/predictive`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ company }),
    });
    if (!response.ok) {
      let detail = `Failed to score leads (${response.status})`
      try {
        const payload = await response.json()
        detail = payload.detail || payload.error || detail
      } catch {
        // ignore parse errors
      }
      throw new Error(detail)
    }
    return response.json();
  },
  addPipelineCompany: async (payload: { companyId: string; companyName: string; contactName?: string; similarityScore?: number }) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/ai-agents/pipeline`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Failed to add company to pipeline')
    return response.json()
  },
}
