"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FilterTagsDisplayProps {
    includedValues: string[]
    excludedValues: string[]
    onRemoveIncluded: (value: string) => void
    onRemoveExcluded: (value: string) => void
    getLabel: (value: string) => string
}

export function FilterTagsDisplay({
    includedValues,
    excludedValues,
    onRemoveIncluded,
    onRemoveExcluded,
    getLabel
}: FilterTagsDisplayProps) {
    const hasSelections = includedValues.length > 0 || excludedValues.length > 0

    if (!hasSelections) return null

    return (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-md border border-border/40 mb-2">
            {/* Included Tags (Green) */}
            {includedValues.map(val => (
                <Badge
                    key={`inc-${val}`}
                    variant="outline"
                    className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20 pl-2 pr-1 py-0.5 text-xs"
                >
                    <span className="mr-1">{getLabel(val)}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemoveIncluded(val)
                        }}
                        className="hover:bg-green-600/20 rounded-sm p-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}

            {/* Excluded Tags (Red) */}
            {excludedValues.map(val => (
                <Badge
                    key={`exc-${val}`}
                    variant="outline"
                    className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20 pl-2 pr-1 py-0.5 text-xs"
                >
                    <span className="mr-1">{getLabel(val)}</span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemoveExcluded(val)
                        }}
                        className="hover:bg-red-600/20 rounded-sm p-0.5"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
        </div>
    )
}
