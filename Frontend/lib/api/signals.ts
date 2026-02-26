// Signals API integration
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

export const signalsApi = {
  getSignals: async (): Promise<Signal[]> => {
    const response = await fetch("/api/signals/feed")
    if (!response.ok) throw new Error("Signals feed is unavailable")
    const data = await response.json()
    return data.feeds ?? []
  },

  getSignalsOverview: async (): Promise<{
    hero: { title: string; eyebrow: string; description: string }
    signalActions: Array<{ title: string; summary: string; badge: string }>
    jobSignals: Array<{ title: string; description: string }>
    enrichmentPillars: Array<{ title: string; description: string }>
    signalBuilder: { focus: string[]; delivery: string[] }
  }> => {
    const response = await fetch("/api/signals/overview")
    if (!response.ok) throw new Error("Signals overview is unavailable")
    return response.json()
  },

  getSignalsByCompany: async (companyId: string): Promise<Signal[]> => {
    const allSignals = await signalsApi.getSignals()
    return allSignals.filter((signal) => signal.companyId === companyId)
  },

  runSignal: async (action: string): Promise<{ signals: Signal[]; count: number }> => {
    const response = await fetch("/api/signals/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    if (!response.ok) {
      throw new Error("Signal run failed")
    }
    return response.json()
  },
}
