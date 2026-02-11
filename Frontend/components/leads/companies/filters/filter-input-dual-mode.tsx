"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DualModeValue {
    included: string[]
    excluded: string[]
}

interface FilterInputDualModeProps {
    options: { label: string; value: string; count?: number }[]
    value?: DualModeValue
    onChange: (value: DualModeValue) => void
    currentMode: 'in' | 'not_in'  // Which mode is active
    hideTags?: boolean  // Hide internal tags display (for external rendering)
}

export function FilterInputDualMode({
    options,
    value = { included: [], excluded: [] },
    onChange,
    currentMode,
    hideTags = false,
}: FilterInputDualModeProps) {

    const handleOptionClick = (optionValue: string) => {
        if (currentMode === 'in') {
            // Toggle in included list
            const newIncluded = value.included.includes(optionValue)
                ? value.included.filter(v => v !== optionValue)
                : [...value.included, optionValue]

            onChange({ ...value, included: newIncluded })
        } else {
            // Toggle in excluded list
            const newExcluded = value.excluded.includes(optionValue)
                ? value.excluded.filter(v => v !== optionValue)
                : [...value.excluded, optionValue]

            onChange({ ...value, excluded: newExcluded })
        }
    }

    const removeIncluded = (optionValue: string) => {
        onChange({
            ...value,
            included: value.included.filter(v => v !== optionValue)
        })
    }

    const removeExcluded = (optionValue: string) => {
        onChange({
            ...value,
            excluded: value.excluded.filter(v => v !== optionValue)
        })
    }

    const getOptionLabel = (optionValue: string) => {
        return options.find(opt => opt.value === optionValue)?.label || optionValue
    }

    const hasSelections = value.included.length > 0 || value.excluded.length > 0

    return (
        <div className="space-y-2">
            {/* Tags Display - No scrollbar, expands as needed */}
            {!hideTags && hasSelections && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-md border border-border/40">
                    {/* Included Tags (Green) */}
                    {value.included.map(val => (
                        <Badge
                            key={`inc-${val}`}
                            variant="outline"
                            className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 hover:bg-green-500/20 pl-2 pr-1 py-0.5 text-xs"
                        >
                            <span className="mr-1">{getOptionLabel(val)}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    removeIncluded(val)
                                }}
                                className="hover:bg-green-600/20 rounded-sm p-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}

                    {/* Excluded Tags (Red) */}
                    {value.excluded.map(val => (
                        <Badge
                            key={`exc-${val}`}
                            variant="outline"
                            className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20 pl-2 pr-1 py-0.5 text-xs"
                        >
                            <span className="mr-1">{getOptionLabel(val)}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    removeExcluded(val)
                                }}
                                className="hover:bg-red-600/20 rounded-sm p-0.5"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Options List - With visible scrollbar */}
            {options.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2 italic">No options available</div>
            ) : (
                <ScrollArea className="h-64 pr-3">
                    {options.map((option) => {
                        const isIncluded = value.included.includes(option.value)
                        const isExcluded = value.excluded.includes(option.value)
                        const isSelected = currentMode === 'in' ? isIncluded : isExcluded

                        // Determine visual state
                        let itemClass = "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                        let checkboxClass = "border-muted-foreground/30 group-hover:border-primary/50"

                        if (isIncluded) {
                            itemClass = "bg-green-500/10 text-green-700 dark:text-green-400 font-medium border border-green-500/30"
                            checkboxClass = "bg-green-600 border-green-600"
                        } else if (isExcluded) {
                            itemClass = "bg-red-500/10 text-red-700 dark:text-red-400 font-medium border border-red-500/30"
                            checkboxClass = "bg-red-600 border-red-600"
                        }

                        return (
                            <div
                                key={option.value}
                                onClick={() => handleOptionClick(option.value)}
                                className={cn(
                                    "flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors select-none group",
                                    itemClass
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className={cn(
                                            "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                            checkboxClass
                                        )}
                                    >
                                        {(isIncluded || isExcluded) && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="truncate">{option.label}</span>
                                </div>
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
