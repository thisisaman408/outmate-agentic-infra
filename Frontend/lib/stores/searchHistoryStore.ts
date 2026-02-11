/**
 * Search History Store
 * Manages search history using localStorage for testing purposes
 */

import { ProspectProfile, ProspectSearchFilters } from "@/lib/services/prospectService"

export interface SearchHistoryItem {
    id: string
    timestamp: number
    filters: ProspectSearchFilters
    results: ProspectProfile[]
    totalCount: number
    nextCursor: string | null
    filterSummary: string
}

const STORAGE_KEY = "prospect_search_history"
const MAX_HISTORY_ITEMS = 50

/**
 * Get all search history items
 */
export function getSearchHistory(): SearchHistoryItem[] {
    if (typeof window === "undefined") return []

    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return []

        const history = JSON.parse(stored) as SearchHistoryItem[]
        return history.sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    } catch (error) {
        console.error("Failed to load search history:", error)
        return []
    }
}

/**
 * Save a new search to history
 */
export function saveSearchToHistory(
    filters: ProspectSearchFilters,
    results: ProspectProfile[],
    totalCount: number,
    nextCursor: string | null
): string {
    if (typeof window === "undefined") return ""

    try {
        const history = getSearchHistory()

        // Create filter summary
        const filterSummary = createFilterSummary(filters)

        // Create new history item
        const newItem: SearchHistoryItem = {
            id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
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
function createFilterSummary(filters: ProspectSearchFilters): string {
    const parts: string[] = []

    if (filters.current_title && filters.current_title.length > 0) {
        parts.push(filters.current_title.slice(0, 2).join(", "))
        if (filters.current_title.length > 2) {
            parts[parts.length - 1] += ` +${filters.current_title.length - 2}`
        }
    }

    if (filters.keyword) {
        parts.push(`"${filters.keyword}"`)
    }

    if (filters.location && filters.location.length > 0) {
        parts.push(filters.location.slice(0, 1).join(", "))
        if (filters.location.length > 1) {
            parts[parts.length - 1] += ` +${filters.location.length - 1}`
        }
    }

    if (filters.industry && filters.industry.length > 0) {
        parts.push(filters.industry.slice(0, 1).join(", "))
    }

    if (filters.functions && filters.functions.length > 0) {
        parts.push(filters.functions.slice(0, 1).join(", "))
    }

    if (filters.seniority_level && filters.seniority_level.length > 0) {
        const operator = filters.seniority_level_operator === "not_in" ? "NOT " : ""
        parts.push(`${operator}${filters.seniority_level.slice(0, 1).join(", ")}`)
    }

    if (parts.length === 0) {
        return "All Prospects"
    }

    return parts.join(" • ")
}
