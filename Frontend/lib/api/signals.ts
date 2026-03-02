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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    try {
      const response = await fetch("/api/signals/feed", {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) throw new Error("Signals feed is unavailable")
      const data = await response.json()
      return data.feeds ?? []
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.')
      }
      throw error
    }
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
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    try {
      const response = await fetch("/api/signals/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = "Signal run failed"
        try {
          const errData = await response.json()
          if (errData?.detail) {
            errorMessage = errData.detail
          }
        } catch (_) {}
        throw new Error(errorMessage)
      }
      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.')
      }
      throw error
    }
  },

  searchEntitySignals: async (type: string, name: string, domain: string): Promise<Signal[]> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    try {
      const response = await fetch("/api/signals/entity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, domain }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) throw new Error("Entity signals unavailable")
      const data = await response.json()
      return data.feeds ?? []
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.')
      }
      throw error
    }
  },

  autocomplete: async (query: string): Promise<string[]> => {
    try {
      const response = await fetch(`/api/signals/autocomplete?query=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error("Autocomplete unavailable")
      const data = await response.json()
      return data.suggestions ?? []
    } catch (error) {
      throw error
    }
  },
}
