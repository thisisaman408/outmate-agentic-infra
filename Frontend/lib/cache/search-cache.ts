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
      const cacheKey = `search_results_${Date.now()}`
      const cacheData: CachedCompany = {
        data: companies,
        timestamp: Date.now()
      }
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
    } catch (error) {
      console.warn('Failed to cache search results:', error)
    }
  },

  get: (domain: string) => {
    try {
      const keys = Object.keys(sessionStorage)
      const searchKeys = keys.filter(key => key.startsWith('search_results_'))
      
      // Find the most recent cache entry
      let latestCache: CachedCompany | null = null
      let latestTimestamp = 0
      
      for (const key of searchKeys) {
        const cached = sessionStorage.getItem(key)
        if (cached) {
          const parsed = JSON.parse(cached) as CachedCompany
          if (parsed.timestamp > latestTimestamp) {
            latestTimestamp = parsed.timestamp
            latestCache = parsed
          }
        }
      }
      
      return latestCache
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
