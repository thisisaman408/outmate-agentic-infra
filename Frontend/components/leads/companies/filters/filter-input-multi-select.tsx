"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface FilterInputMultiSelectProps {
    options: { label: string; value: string; count?: number }[]
    value?: string[]
    onChange: (value: string[]) => void
    searchable?: boolean
    showCount?: boolean
    operator?: 'in' | 'not_in'  // New prop for visual distinction
}

export function FilterInputMultiSelect({
    options,
    value = [],
    onChange,
    searchable = false,
    showCount = false,
    operator = 'in',  // Default to include mode
}: FilterInputMultiSelectProps) {
    const toggleOption = (optionValue: string) => {
        const newValue = value.includes(optionValue)
            ? value.filter((v) => v !== optionValue)
            : [...value, optionValue]
        onChange(newValue)
    }

    // Determine colors based on operator
    const isIncludeMode = operator === 'in'

    return (
        <div className="space-y-1">
            {options.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2 italic">No options available</div>
            ) : (
                <ScrollArea className="pr-3">
                    {options.map((option) => {
                        const isSelected = value.includes(option.value)
                        return (
                            <div
                                key={option.value}
                                onClick={() => toggleOption(option.value)}
                                className={cn(
                                    "flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors select-none group",
                                    isSelected
                                        ? isIncludeMode
                                            ? "bg-green-500/10 text-green-700 dark:text-green-400 font-medium border border-green-500/30"
                                            : "bg-red-500/10 text-red-700 dark:text-red-400 font-medium border border-red-500/30"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                            isSelected
                                                ? isIncludeMode
                                                    ? "bg-green-600 border-green-600"
                                                    : "bg-red-600 border-red-600"
                                                : "border-muted-foreground/30 group-hover:border-primary/50"
                                        )}
                                    >
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="truncate">{option.label}</span>
                                </div>
                                {/* Optional count badge or just number */}
                                {option.count !== undefined && (
                                    <span className="text-xs text-muted-foreground/60">{option.count}</span>
                                )}
                            </div>
                        )
                    })}
                </ScrollArea>
            )}
        </div>
    )
}
