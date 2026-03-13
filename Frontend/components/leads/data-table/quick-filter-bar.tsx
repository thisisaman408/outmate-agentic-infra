"use client"

import { useState, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { X, Filter, Plus } from "lucide-react"

export interface QuickFilter {
    id: string
    label: string
    /** Predefined options for command list; omit for free-text input */
    options?: string[]
}

interface QuickFilterBarProps {
    filters: QuickFilter[]
    activeFilters: Record<string, string[]>
    onFilterChange: (filterId: string, values: string[]) => void
    onClearAll: () => void
}

export function QuickFilterBar({
    filters,
    activeFilters,
    onFilterChange,
    onClearAll,
}: QuickFilterBarProps) {
    const [openPopover, setOpenPopover] = useState<string | null>(null)
    const [inputValue, setInputValue] = useState("")

    const activeCount = Object.values(activeFilters).filter((v) => v.length > 0).length

    const addValue = (filterId: string, value: string) => {
        const current = activeFilters[filterId] || []
        if (!current.includes(value)) {
            onFilterChange(filterId, [...current, value])
        }
        setInputValue("")
    }

    const removeValue = (filterId: string, value: string) => {
        const current = activeFilters[filterId] || []
        onFilterChange(filterId, current.filter((v) => v !== value))
    }

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />

            {/* Active filter badges */}
            {Object.entries(activeFilters).map(([filterId, values]) =>
                values.map((value) => {
                    const filter = filters.find((f) => f.id === filterId)
                    return (
                        <Badge key={`${filterId}-${value}`} variant="secondary" className="gap-1 pr-1">
                            <span className="text-muted-foreground text-[10px]">{filter?.label}:</span>
                            <span className="text-xs">{value}</span>
                            <button
                                className="ml-1 hover:bg-muted rounded-full p-0.5"
                                onClick={() => removeValue(filterId, value)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )
                })
            )}

            {/* Filter chip popovers */}
            {filters.map((filter) => {
                const isActive = (activeFilters[filter.id] || []).length > 0

                return (
                    <Popover
                        key={filter.id}
                        open={openPopover === filter.id}
                        onOpenChange={(open) => {
                            setOpenPopover(open ? filter.id : null)
                            if (!open) setInputValue("")
                        }}
                    >
                        <PopoverTrigger asChild>
                            <Button
                                variant={isActive ? "secondary" : "outline"}
                                size="sm"
                                className="h-7 text-xs"
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                {filter.label}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[220px] p-0" align="start">
                            {filter.options ? (
                                <Command>
                                    <div className="p-2">
                                        <Input
                                            placeholder={`Search ${filter.label.toLowerCase()}...`}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    <CommandList>
                                        <CommandEmpty>No results</CommandEmpty>
                                        <CommandGroup>
                                            {filter.options
                                                .filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()))
                                                .map((option) => (
                                                    <CommandItem
                                                        key={option}
                                                        onSelect={() => {
                                                            addValue(filter.id, option)
                                                            setOpenPopover(null)
                                                        }}
                                                    >
                                                        {option}
                                                    </CommandItem>
                                                ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            ) : (
                                <div className="p-2 flex gap-1">
                                    <Input
                                        placeholder={`Enter ${filter.label.toLowerCase()}...`}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="h-8"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && inputValue.trim()) {
                                                addValue(filter.id, inputValue.trim())
                                                setOpenPopover(null)
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        size="sm"
                                        className="h-8 px-2"
                                        disabled={!inputValue.trim()}
                                        onClick={() => {
                                            if (inputValue.trim()) {
                                                addValue(filter.id, inputValue.trim())
                                                setOpenPopover(null)
                                            }
                                        }}
                                    >
                                        Add
                                    </Button>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                )
            })}

            {activeCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onClearAll}>
                    Clear all
                </Button>
            )}
        </div>
    )
}
