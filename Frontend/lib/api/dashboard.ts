import { authService } from "@/lib/auth"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
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
  status: "running" | "paused" | "completed" | "draft"
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

const fetchWithAuth = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers ?? {})
  const authHeaders = authService.getAuthHeaders()
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value)
    }
  })
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers })
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const dashboardApi = {
  getKPIs: async (): Promise<KPIData> => {
    const response = await fetchWithAuth("/api/v1/dashboard/kpis")
    return parseJson<KPIData>(response)
  },

  getRecentLeads: async (): Promise<RecentLead[]> => {
    const response = await fetchWithAuth("/api/v1/dashboard/recent-leads?limit=5")
    return parseJson<RecentLead[]>(response)
  },

  getActiveSignals: async (): Promise<Signal[]> => {
    const response = await fetchWithAuth("/api/v1/dashboard/active-signals?limit=3")
    return parseJson<Signal[]>(response)
  },

  getCampaignPerformance: async (): Promise<CampaignPerformance[]> => {
    const response = await fetchWithAuth("/api/v1/dashboard/campaign-performance?limit=3")
    return parseJson<CampaignPerformance[]>(response)
  },

  getAIAgentActivity: async (): Promise<AIAgentActivity[]> => {
    const response = await fetchWithAuth("/api/v1/dashboard/ai-activity?limit=3")
    return parseJson<AIAgentActivity[]>(response)
  },

  getTimeSeriesData: async (): Promise<TimeSeriesData[]> => {
    const response = await fetchWithAuth("/api/v1/dashboard/time-series?days=7")
    return parseJson<TimeSeriesData[]>(response)
  },
}
