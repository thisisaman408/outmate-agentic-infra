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

// ── Visitor Intelligence types ────────────────────────────────────────────
export interface VisitorIntelligence {
  realtime_visitors: number
  icp_traffic_ratio: number
  company_id_rate: number
  person_id_rate: number
  total_visitors: number
  icp_fit_count: number
  company_matched_count: number
  person_matched_count: number
  top_pages_by_icp: { page: string; icp_visitors: number }[]
  traffic_trend: {
    date: string
    date_raw: string
    visitors: number
    matched: number
    icp_fit: number
  }[]
  period_days: number
}

export interface RealtimeHeartbeat {
  realtime_visitors: number
}

// ── Sequence Analytics types ─────────────────────────────────────────────
export interface SequenceRow {
  id: string
  name: string
  status: string
  channel: string
  sent: number
  opened: number
  replied: number
  bounced: number
  meetings_booked: number
  open_rate: number
  reply_rate: number
  meeting_booked_rate: number
  bounce_rate: number
}

export interface ChannelBreakdown {
  channel: string
  sent: number
  opened: number
  replied: number
  meetings: number
  open_rate: number
  reply_rate: number
  meeting_rate: number
}

export interface ABTestVariant {
  label: string
  subject: string
  sent: number
  open_rate: number
  reply_rate: number
}

export interface ABTestResult {
  group: string
  status: "winner_declared" | "insufficient_data" | "no_significant_difference"
  winner: string | null
  confidence: number
  min_sends_required: number
  variants: ABTestVariant[]
}

export interface BenchmarkComparison {
  your_rate: number
  platform_avg: number
  difference: number
  status: "above" | "below" | "at_average"
}

export interface SequenceTrendPoint {
  date: string
  date_raw: string
  sent: number
  opened: number
  replied: number
  meetings: number
}

export interface SequenceAnalytics {
  sequences: SequenceRow[]
  channel_breakdown: ChannelBreakdown[]
  ab_tests: ABTestResult[]
  trend: SequenceTrendPoint[]
  benchmarks: {
    open_rate: BenchmarkComparison
    reply_rate: BenchmarkComparison
    meeting_booked_rate: BenchmarkComparison
  }
  period_days: number
  total_sequences: number
  data_freshness: {
    last_sync: string | null
    note: string
  }
  warnings: string[]
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

  // ── Visitor Intelligence ────────────────────────────────────────────────
  getVisitorIntelligence: async (days: number = 7): Promise<VisitorIntelligence> => {
    const response = await fetchWithAuth(`/api/v1/dashboard/visitor-intelligence?days=${days}`)
    return parseJson<VisitorIntelligence>(response)
  },

  getRealtimeHeartbeat: async (): Promise<RealtimeHeartbeat> => {
    const response = await fetchWithAuth("/api/v1/dashboard/visitor-heartbeat", { method: "POST" })
    return parseJson<RealtimeHeartbeat>(response)
  },

  // ── Sequence Analytics ──────────────────────────────────────────────────
  getSequenceAnalytics: async (days: number = 7): Promise<SequenceAnalytics> => {
    const response = await fetchWithAuth(`/api/v1/dashboard/sequence-analytics?days=${days}`)
    return parseJson<SequenceAnalytics>(response)
  },

  // ── Revenue Analytics ───────────────────────────────────────────────────
  getRevenueAnalytics: async (days: number = 30): Promise<RevenueAnalytics> => {
    const response = await fetchWithAuth(`/api/v1/dashboard/revenue-analytics?days=${days}`)
    return parseJson<RevenueAnalytics>(response)
  },
}

export interface RevenueAnalytics {
  sql_count: number
  cac: number
  deal_velocity: number
  revenue_influenced: number
  funnel: {
    stage: string
    count: number
    drop_off_pct: number
  }[]
  trends: {
    date: string
    revenue: number
    sqls: number
  }[]
  attribution_type: string
  last_sync: string
  currency: string
}
