"use client"

import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { ALL_FILTERS } from "./constants"

interface AppliedFiltersDisplayProps {
    filters: Record<string, any>
    onRemoveFilter: (filterId: string) => void
}

export function AppliedFiltersDisplay({ filters, onRemoveFilter }: AppliedFiltersDisplayProps) {
    const appliedFilters = Object.entries(filters).filter(([_, value]) => {
        if (value === undefined || value === null || value === '') return false
        if (Array.isArray(value) && value.length === 0) return false
        return true
    })

    if (appliedFilters.length === 0) {
        return null
    }

    const getFilterLabel = (filterId: string) => {
        const filter = ALL_FILTERS.find(f => f.id === filterId)
        return filter?.label || filterId
    }

    const formatFilterValue = (filterId: string, value: any): string => {
        if (Array.isArray(value)) {
            return value.join(', ')
        }
        if (typeof value === 'object' && value !== null) {
            // Handle complex objects like revenue ranges, growth ranges, etc.
            const parts = []
            if (value.min !== undefined) parts.push(`Min: ${value.min}`)
            if (value.max !== undefined) parts.push(`Max: ${value.max}`)
            if (value.department) parts.push(value.department)
            return parts.join(', ') || JSON.stringify(value)
        }
        return String(value)
    }

    return (
        <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg border border-border/40">
            <span className="text-sm font-medium text-muted-foreground">Applied Filters:</span>
            {appliedFilters.map(([filterId, value]) => (
                <Badge
                    key={filterId}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 gap-1 bg-primary/10 border-primary/20 hover:bg-primary/20"
                >
                    <span className="text-xs">
                        <strong>{getFilterLabel(filterId)}:</strong> {formatFilterValue(filterId, value)}
                    </span>
                    <button
                        onClick={() => onRemoveFilter(filterId)}
                        className="ml-1 rounded-full hover:bg-primary/30 p-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
        </div>
    )
}
