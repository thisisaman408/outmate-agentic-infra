// Search results cache utility for optimizing credit usage
export interface CachedCompany {
  data: any
  timestamp: number
}

export interface SearchCache {
  set: (companies: any[]) => void
  get: (domain: string) => CachedCompany | null
  clear: () => void
  isExpired: (timestamp: number) => boolean
}

// Cache TTL: 30 minutes
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes in milliseconds

export const searchCache: SearchCache = {
  set: (companies: any[]) => {
    try {
      const timestamp = Date.now()
      for (const company of companies) {
        if (company?.domain) {
          const cacheKey = `search_results_${company.domain}`
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: company, timestamp }))
        }
      }
    } catch (error) {
      console.warn('Failed to cache search results:', error)
    }
  },

  get: (domain: string) => {
    try {
      const key = `search_results_${domain}`
      const cached = sessionStorage.getItem(key)
      if (cached) {
        return JSON.parse(cached) as CachedCompany
      }
      return null
    } catch (error) {
      console.warn('Failed to retrieve cached search results:', error)
      return null
    }
  },

  clear: () => {
    try {
      const keys = Object.keys(sessionStorage)
      const searchKeys = keys.filter(key => key.startsWith('search_results_'))
      searchKeys.forEach(key => sessionStorage.removeItem(key))
    } catch (error) {
      console.warn('Failed to clear search cache:', error)
    }
  },

  isExpired: (timestamp: number) => {
    return Date.now() - timestamp > CACHE_TTL
  }
}
