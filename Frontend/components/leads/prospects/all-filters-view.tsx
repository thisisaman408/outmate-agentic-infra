"use client"

import * as React from "react"
import { Search, SlidersHorizontal, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ALL_FILTERS, FILTER_CATEGORIES, FilterConfig } from "./constants"
import { FilterInputText } from "@/components/leads/companies/filters/filter-input-text"
import { FilterInputMultiSelect } from "@/components/leads/companies/filters/filter-input-multi-select"
import { FilterInputDualMode } from "@/components/leads/companies/filters/filter-input-dual-mode"
import { FilterTagsDisplay } from "@/components/leads/companies/filters/filter-tags-display"
import { ProFilterLock } from "@/components/leads/companies/filters/pro-filter-lock"

interface AllFiltersViewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    filters: Record<string, any>
    onFilterChange: (id: string, value: any) => void
    onApply: (filters: any) => void
    pinnedFilters: string[]
    onPinChange: (ids: string[]) => void
    filterOperators?: Record<string, 'in' | 'not_in'>
    onOperatorChange?: (filterId: string, operator: 'in' | 'not_in') => void
    isPro?: boolean
    onProFilterClick?: (label: string) => void
}

export function AllFiltersView({ open, onOpenChange, filters, onFilterChange, onApply, pinnedFilters = [], onPinChange, filterOperators = {}, onOperatorChange, isPro = false, onProFilterClick }: AllFiltersViewProps) {
    const [activeCategory, setActiveCategory] = React.useState<string>(FILTER_CATEGORIES[0])
    const [searchQuery, setSearchQuery] = React.useState("")
    // Local state to track changes before applying
    const [localFilters, setLocalFilters] = React.useState<Record<string, any>>(filters)
    const [localOperators, setLocalOperators] = React.useState<Record<string, 'in' | 'not_in'>>(filterOperators)

    // Sync local filters and operators with props when opening
    React.useEffect(() => {
        if (open) {
            setLocalFilters(filters)
            setLocalOperators(filterOperators)
        }
    }, [open, filters, filterOperators])

    const handleLocalFilterChange = (id: string, value: any) => {
        setLocalFilters(prev => ({ ...prev, [id]: value }))
    }

    const renderFilterControl = (filter: FilterConfig, value: any, operator: 'in' | 'not_in' = 'in') => {
        if (filter.requiresPro && !isPro) {
            return <ProFilterLock label={filter.label} onUpgrade={() => onProFilterClick?.(filter.label || filter.id)} />
        }
        return renderFilterInput(filter, value, (val) => handleLocalFilterChange(filter.id, val), operator, filter.supportsOperator)
    }

    const togglePin = (id: string) => {
        if (onPinChange) {
            if (pinnedFilters.includes(id)) {
                onPinChange(pinnedFilters.filter(pid => pid !== id))
            } else {
                onPinChange([...pinnedFilters, id])
            }
        }
    }

    // Group filters by category
    const filtersByCategory = React.useMemo(() => {
        return ALL_FILTERS.reduce((acc, filter) => {
            if (!acc[filter.category]) {
                acc[filter.category] = []
            }
            acc[filter.category].push(filter)
            return acc
        }, {} as Record<string, FilterConfig[]>)
    }, [])

    // Filter categories based on search
    const filteredCategories = React.useMemo(() => {
        if (!searchQuery) return FILTER_CATEGORIES

        // Return categories that have matching filters OR match the category name
        return FILTER_CATEGORIES.filter(category => {
            const categoryMatch = category.toLowerCase().includes(searchQuery.toLowerCase())
            const filtersMatch = filtersByCategory[category]?.some(f =>
                f.label.toLowerCase().includes(searchQuery.toLowerCase())
            )
            return categoryMatch || filtersMatch
        })
    }, [searchQuery, filtersByCategory])

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            {/* WIDE SHEET IMPLEMENTATION */}
            <SheetContent side="right" className="w-full sm:max-w-[1000px] sm:w-[1000px] p-0 flex flex-col bg-background/95 backdrop-blur-xl border-l border-border/40">
                <SheetHeader className="px-6 py-4 border-b border-border/40">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-xl font-semibold flex items-center gap-2">
                            <SlidersHorizontal className="h-5 w-5 text-primary" />
                            All Filters
                        </SheetTitle>
                    </div>
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search for a filter..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-muted/40 border-border/60"
                        />
                    </div>
                </SheetHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Categories Sidebar */}
                    <div className="w-1/4 border-r border-border/40 bg-muted/10 flex flex-col">
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {filteredCategories.map((category) => {
                                    return (
                                        <button
                                            key={category}
                                            onClick={() => setActiveCategory(category)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-between group",
                                                activeCategory === category
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <span>{category}</span>
                                            {activeCategory === category && (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Filters Content */}
                    <div className="flex-1 bg-background w-3/4">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-8">
                                {searchQuery ? (
                                    filteredCategories.map(category => {
                                        const categoryFilters = filtersByCategory[category] || []
                                        if (categoryFilters.length === 0) return null
                                        return (
                                            <div key={category} className="space-y-4">
                                                <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                                                    {category}
                                                </h3>
                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Grid layout for wide view */}
                                                    {categoryFilters.map(filter => (
                                                        <div key={filter.id} className="space-y-2">
                                                            <label className="text-sm font-medium text-foreground">{filter.label}</label>
                                                            {renderFilterControl(filter, localFilters[filter.id], localOperators[filter.id] || 'in')}
                                                        </div>
                                                    ))}
                                                </div>
                                                <Separator />
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="space-y-6">
                                        <h3 className="font-semibold text-xl flex items-center gap-2">
                                            {activeCategory}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            {filtersByCategory[activeCategory]?.map((filter) => (
                                                <div key={filter.id} className="bg-card/30 p-4 rounded-lg border border-border/40 space-y-3">
                                                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                                        {filter.icon && <filter.icon className="h-4 w-4 text-muted-foreground" />}
                                                        {filter.label}
                                                    </label>
                                                    {/* Tags Display (for dual-mode filters) */}
                                                    {filter.supportsOperator && localFilters[filter.id] && typeof localFilters[filter.id] === 'object' && 'included' in localFilters[filter.id] && (
                                                        <FilterTagsDisplay
                                                            includedValues={localFilters[filter.id].included || []}
                                                            excludedValues={localFilters[filter.id].excluded || []}
                                                            onRemoveIncluded={(val) => {
                                                                const current = localFilters[filter.id]
                                                                handleLocalFilterChange(filter.id, {
                                                                    ...current,
                                                                    included: current.included.filter((v: string) => v !== val)
                                                                })
                                                            }}
                                                            onRemoveExcluded={(val) => {
                                                                const current = localFilters[filter.id]
                                                                handleLocalFilterChange(filter.id, {
                                                                    ...current,
                                                                    excluded: current.excluded.filter((v: string) => v !== val)
                                                                })
                                                            }}
                                                            getLabel={(val) => filter.options?.find(opt => opt.value === val)?.label || val}
                                                        />
                                                    )}
                                                    {filter.supportsOperator && onOperatorChange && (
                                                        <div className="flex gap-2 mb-2 p-2 bg-muted/30 rounded-md border border-border/40">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className={cn(
                                                                    "flex-1 h-8 text-xs font-medium transition-all",
                                                                    (localOperators[filter.id] || 'in') === 'in'
                                                                        ? "bg-green-600 text-white shadow-sm hover:bg-green-700"
                                                                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                )}
                                                                onClick={() => setLocalOperators(prev => ({ ...prev, [filter.id]: 'in' }))}
                                                            >
                                                                Include
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                className={cn(
                                                                    "flex-1 h-8 text-xs font-medium transition-all",
                                                                    (localOperators[filter.id] || 'in') === 'not_in'
                                                                        ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
                                                                        : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                )}
                                                                onClick={() => setLocalOperators(prev => ({ ...prev, [filter.id]: 'not_in' }))}
                                                            >
                                                                Exclude
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {renderFilterControl(filter, localFilters[filter.id], localOperators[filter.id] || 'in')}
                                                </div>
                                            ))}
                                            {(!filtersByCategory[activeCategory] || filtersByCategory[activeCategory].length === 0) && (
                                                <p className="text-muted-foreground text-sm col-span-2">No filters in this category yet.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border/40 flex items-center justify-between bg-muted/5">
                    <Button variant="ghost" onClick={() => { }} className="text-muted-foreground hover:text-foreground">
                        Clear all
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={() => {
                            onApply(localFilters)
                            // Also notify about operator changes
                            if (onOperatorChange) {
                                Object.entries(localOperators).forEach(([filterId, operator]) => {
                                    onOperatorChange(filterId, operator)
                                })
                            }
                            onOpenChange(false)
                        }} className="bg-primary text-primary-foreground shadow-md shadow-primary/20">
                            Apply Filters
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

import { FilterAutocomplete } from "@/components/leads/companies/filters/filter-autocomplete"
import { FilterInputTitle } from "./filters/filter-input-title"
import { FilterInputDepartment } from "./filters/filter-input-department"
import { FilterInputTags } from "./filters/filter-input-tags"
import { FilterInputIndustry } from "./filters/filter-input-industry"
import { FilterInputMarketSegment } from "./filters/filter-input-market-segment"
import { FilterInputTechnology } from "./filters/filter-input-technology"
import { FilterMultiLocation } from "./filters/filter-multi-location"
import { FilterInputLanguage } from "./filters/filter-input-language"
import { FilterInputSchool } from "./filters/filter-input-school"
import { FilterInputBoolean } from "./filters/filter-input-boolean"

function renderFilterInput(
    filter: FilterConfig,
    value: any,
    onChange: (value: any) => void,
    operator: 'in' | 'not_in' = 'in',
    hideTags: boolean = false
) {
    // Use DualMode component for filters with operator support
    if (filter.supportsOperator) {
        const dualValue = value && typeof value === 'object' && 'included' in value
            ? value
            : { included: Array.isArray(value) ? value : [], excluded: [] }

        return <FilterInputDualMode
            options={filter.options || []}
            value={dualValue}
            onChange={onChange}
            currentMode={operator}
            hideTags={hideTags}
        />
    }

    switch (filter.type) {
        case 'text':
            if (filter.id === 'current_title' || filter.id === 'past_title') {
                return <FilterInputTitle value={value || []} onChange={onChange} placeholder={filter.placeholder} />
            }
            if (filter.id === 'keyword') {
                return <FilterInputTags value={Array.isArray(value) ? value : []} onChange={onChange} placeholder={filter.placeholder} />
            }
            if (filter.id === 'market_segments') {
                return <FilterInputMarketSegment value={value || []} onChange={onChange} placeholder={filter.placeholder} />
            }
            return <FilterInputText value={value || ''} onChange={onChange} placeholder={filter.placeholder} />
        case 'multi-select':
        case 'select':
        case 'industry':
            if (filter.id === 'industry') {
                return <FilterInputIndustry value={value || []} onChange={onChange} placeholder={filter.placeholder} />
            }
        case 'technology':
            if (filter.id === 'technologies') {
                return <FilterInputTechnology value={value || []} onChange={onChange} placeholder={filter.placeholder} />
            }
            if (filter.id === 'function') {
                return <FilterInputDepartment value={value || []} onChange={onChange} placeholder={filter.placeholder} />
            }
            return <FilterInputMultiSelect options={filter.options || []} value={value || []} onChange={onChange} operator={operator} />
        case 'range':
            return <FilterInputMultiSelect options={filter.options || []} value={value || []} onChange={onChange} operator={operator} />
        case 'location':
            return <FilterMultiLocation value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'language':
            return <FilterInputLanguage value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'school':
            return <FilterInputSchool value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'boolean':
            return <FilterInputBoolean value={value || false} onChange={onChange} label={filter.label} />
        default:
            return <FilterInputText value={value || ''} onChange={onChange} placeholder={filter.placeholder} />
    }
}
