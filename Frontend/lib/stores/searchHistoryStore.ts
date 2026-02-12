/**
 * Search History Store
 * Manages search history using localStorage for testing purposes
 */

export interface SearchHistoryItem {
    id: string
    timestamp: number
    type: 'prospects' | 'companies'
    route: string
    filters: Record<string, any>
    results: any[]
    totalCount: number
    nextCursor: string | null
    filterSummary: string
}

const STORAGE_KEY_LEGACY = "prospect_search_history"
const STORAGE_KEY = "search_history"
const MAX_HISTORY_ITEMS = 50

/**
 * Get all search history items
 */
export function getSearchHistory(): SearchHistoryItem[] {
    if (typeof window === "undefined") return []

    try {
        // Load new storage
        const stored = localStorage.getItem(STORAGE_KEY)
        let history: SearchHistoryItem[] = stored ? JSON.parse(stored) as SearchHistoryItem[] : []

        // Migrate legacy prospect-only history if present
        const legacy = localStorage.getItem(STORAGE_KEY_LEGACY)
        if (legacy) {
            try {
                const legacyItems = JSON.parse(legacy) as any[]
                const migrated: SearchHistoryItem[] = legacyItems.map((it) => ({
                    id: it.id,
                    timestamp: it.timestamp,
                    type: 'prospects',
                    route: '/leads/prospects',
                    filters: it.filters || {},
                    results: it.results || [],
                    totalCount: it.totalCount || (it.results?.length || 0),
                    nextCursor: it.nextCursor ?? null,
                    filterSummary: it.filterSummary || 'Prospects search'
                }))
                history = [...migrated, ...history]
                // Clear legacy to avoid duplicates after first migration
                localStorage.removeItem(STORAGE_KEY_LEGACY)
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
            } catch (e) {
                console.warn('Failed to migrate legacy prospect history', e)
            }
        }

        return history.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
        console.error("Failed to load search history:", error)
        return []
    }
}

/**
 * Save a new search to history
 */
export function saveSearchToHistory(
    filters: Record<string, any>,
    results: any[],
    totalCount: number,
    nextCursor: string | null,
    type: 'prospects' | 'companies' = 'prospects',
    route: string = type === 'companies' ? '/leads/companies/search' : '/leads/prospects'
): string {
    if (typeof window === "undefined") return ""

    try {
        const history = getSearchHistory()

        // Create filter summary
        const filterSummary = createFilterSummaryGeneric(filters, type)

        // Create new history item
        const newItem: SearchHistoryItem = {
            id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            type,
            route,
            filters,
            results,
            totalCount,
            nextCursor,
            filterSummary,
        }

        // Add to history (at beginning for newest first)
        const updatedHistory = [newItem, ...history]

        // Keep only last MAX_HISTORY_ITEMS
        const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_ITEMS)

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedHistory))

        return newItem.id
    } catch (error) {
        console.error("Failed to save search history:", error)
        return ""
    }
}

/**
 * Get a specific search history item by ID
 */
export function getSearchHistoryItem(id: string): SearchHistoryItem | null {
    const history = getSearchHistory()
    return history.find(item => item.id === id) || null
}

/**
 * Delete a specific search history item
 */
export function deleteSearchHistoryItem(id: string): void {
    if (typeof window === "undefined") return

    try {
        const history = getSearchHistory()
        const updatedHistory = history.filter(item => item.id !== id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory))
    } catch (error) {
        console.error("Failed to delete search history item:", error)
    }
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
    if (typeof window === "undefined") return

    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
        console.error("Failed to clear search history:", error)
    }
}

/**
 * Create a human-readable summary of filters
 */
function createFilterSummaryGeneric(filters: Record<string, any>, type: 'prospects' | 'companies'): string {
    const parts: string[] = []

    if (type === 'prospects') {
        const titles = filters.current_title as string[] | undefined
        if (titles?.length) {
            parts.push(titles.slice(0, 2).join(", ") + (titles.length > 2 ? ` +${titles.length - 2}` : ''))
        }
        if (filters.keyword) parts.push(`"${filters.keyword}"`)
        const loc = filters.location as string[] | undefined
        if (loc?.length) parts.push(loc[0] + (loc.length > 1 ? ` +${loc.length - 1}` : ''))
        const ind = filters.industry as string[] | undefined
        if (ind?.length) parts.push(ind[0])
        const funcs = filters.functions as string[] | undefined
        if (funcs?.length) parts.push(funcs[0])
        if (filters.seniority_level?.length) {
            const operator = filters.seniority_level_operator === 'not_in' ? 'NOT ' : ''
            parts.push(`${operator}${filters.seniority_level[0]}`)
        }
        return parts.length ? parts.join(' • ') : 'All Prospects'
    }

    // companies
    if (filters.name) parts.push(filters.name)
    if (filters.domain) parts.push(filters.domain)
    const ind = filters.industry as string[] | undefined
    if (ind?.length) parts.push(ind[0])
    const emp = filters.employee_count as string[] | undefined
    if (emp?.length) parts.push(emp.join(', '))
    return parts.length ? parts.join(' • ') : 'All Companies'
}
