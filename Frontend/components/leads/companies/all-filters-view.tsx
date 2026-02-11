"use client"

import * as React from "react"
import { Search, X, SlidersHorizontal, ChevronRight, Pin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ALL_FILTERS, FILTER_CATEGORIES, FilterConfig } from "./constants"
import { FilterSection } from "./filters/filter-section"
import { FilterInputText } from "./filters/filter-input-text"
import { FilterInputMultiSelect } from "./filters/filter-input-multi-select"

interface AllFiltersViewProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    filters: Record<string, any>
    onFilterChange: (id: string, value: any) => void
    onApply: (filters: any) => void
    pinnedFilters: string[]
    onPinChange: (ids: string[]) => void
}

export function AllFiltersView({ open, onOpenChange, filters, onFilterChange, onApply, pinnedFilters = [], onPinChange }: AllFiltersViewProps) {
    const [activeCategory, setActiveCategory] = React.useState<string>(FILTER_CATEGORIES[0])
    const [searchQuery, setSearchQuery] = React.useState("")
    // Local state to track changes before applying
    const [localFilters, setLocalFilters] = React.useState<Record<string, any>>(filters)

    // Sync local filters with props when opening
    React.useEffect(() => {
        if (open) {
            setLocalFilters(filters)
        }
    }, [open, filters])

    const handleLocalFilterChange = (id: string, value: any) => {
        setLocalFilters(prev => ({ ...prev, [id]: value }))
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
                                {filteredCategories.map((category) => (
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
                                ))}
                                {filteredCategories.length === 0 && (
                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                        No matching categories
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Filters Content */}
                    <div className="flex-1 bg-background w-3/4">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-8">
                                {/* If searching, show all matching filters. If not, show active category */}
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
                                                    {categoryFilters.map(filter => (
                                                        <div key={filter.id} className="bg-card/30 p-4 rounded-lg border border-border/40 space-y-3 relative group">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-sm font-medium text-foreground">{filter.label}</label>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={cn("h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity", pinnedFilters.includes(filter.id) && "opacity-100 text-primary")}
                                                                    onClick={() => togglePin(filter.id)}
                                                                >
                                                                    <Pin className={cn("h-3.5 w-3.5", pinnedFilters.includes(filter.id) && "fill-current")} />
                                                                </Button>
                                                            </div>
                                                            {renderFilterInput(filter, localFilters[filter.id], (val) => handleLocalFilterChange(filter.id, val))}
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
                                                <div key={filter.id} className="bg-card/30 p-4 rounded-lg border border-border/40 space-y-3 relative group">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm font-medium text-foreground flex items-center gap-2">
                                                            {filter.icon && <filter.icon className="h-4 w-4 text-muted-foreground" />}
                                                            {filter.label}
                                                        </label>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className={cn("h-6 w-6 ml-auto opacity-0 group-hover:opacity-100 transition-opacity", pinnedFilters.includes(filter.id) && "opacity-100 text-primary")}
                                                            onClick={() => togglePin(filter.id)}
                                                        >
                                                            <Pin className={cn("h-3.5 w-3.5", pinnedFilters.includes(filter.id) && "fill-current")} />
                                                        </Button>
                                                    </div>
                                                    {renderFilterInput(filter, localFilters[filter.id], (val) => handleLocalFilterChange(filter.id, val))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border/40 flex items-center justify-between bg-muted/5">
                    <Button variant="ghost" onClick={() => setLocalFilters({})} className="text-muted-foreground hover:text-foreground">
                        Clear all
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={() => onApply(localFilters)} className="bg-primary text-primary-foreground shadow-md shadow-primary/20">
                            Apply Filters
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

import { FilterMultiLocation } from "./filters/filter-multi-location"
import { FilterMultiIndustry } from "./filters/filter-multi-industry"
import { FilterMultiCategory } from "./filters/filter-multi-category"
import { FilterMultiMarketSegment } from "./filters/filter-multi-market-segment"
import { FilterMultiCompanyType } from "./filters/filter-multi-company-type"
import { FilterInputYear } from "./filters/filter-input-year"
import { FilterInputCountry } from "./filters/filter-input-country"
import { FilterRevenue } from "./filters/filter-revenue"
import { FilterInputDate } from "./filters/filter-input-date"
import { FilterInputInvestors } from "./filters/filter-input-investors"
import { FilterInputGrowthRange } from "./filters/filter-input-growth-range"
import { FilterInputEmployeeGrowth } from "./filters/filter-input-employee-growth"
import { FilterInputDepartmentRange } from "./filters/filter-input-department-range"

// ... (existing code)

function renderFilterInput(
    filter: FilterConfig,
    value: any,
    onChange: (value: any) => void
) {
    // Logic to render different input types
    if (filter.id === 'investors') {
        return <FilterInputInvestors value={value || []} onChange={onChange} placeholder={filter.placeholder} />
    }
    switch (filter.type) {
        case 'text':
            return <FilterInputText value={value || ''} onChange={onChange} placeholder={filter.placeholder} />
        case 'multi-select':
        case 'select':
            return <FilterInputMultiSelect options={filter.options || []} value={value || []} onChange={onChange} />
        case 'industry':
            return <FilterMultiIndustry value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'category':
            return <FilterMultiCategory value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'market_segment':
            return <FilterMultiMarketSegment value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'company_type':
            return <FilterMultiCompanyType value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'year':
            return <FilterInputYear value={value || ""} onChange={onChange} placeholder={filter.placeholder} />
        case 'country':
            return <FilterInputCountry value={value || ""} onChange={onChange} placeholder={filter.placeholder} />
        case 'revenue':
            return <FilterRevenue value={value} onChange={onChange} />
        case 'growth_range':
            return <FilterInputGrowthRange value={value} onChange={onChange} />
        case 'employee_growth':
            const isFollowerGrowth = filter.id === 'follower_metrics.growth_6m'
            return (
                <FilterInputEmployeeGrowth
                    value={value}
                    onChange={onChange}
                    label={filter.label}
                    helperText={isFollowerGrowth ? "Enter count (e.g., 1000 for +1k followers)" : undefined}
                />
            )
        case 'department_range':
            return <FilterInputDepartmentRange value={value} onChange={onChange} mode="count" />
        case 'department_growth':
            return <FilterInputDepartmentRange value={value} onChange={onChange} mode="growth" />
        case 'date':
            return <FilterInputDate value={value || ""} onChange={onChange} placeholder={filter.placeholder} />
        case 'range':
            // If options are provided, use MultiSelect (e.g., scores, employees_by_dept)
            if (filter.options && filter.options.length > 0) {
                return <FilterInputMultiSelect options={filter.options} value={value || []} onChange={onChange} />
            }
            // Fallback for range without options (not used yet but safe)
            return <FilterInputText value={value || ''} onChange={onChange} placeholder={filter.placeholder} />
        case 'date-range':
            // Fallback to text input for now
            return <FilterInputText value={value || ''} onChange={onChange} placeholder={filter.placeholder || "Select date..."} />
        case 'location':
            return <FilterMultiLocation value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        default:
            // Generic fallback
            return <FilterInputText value={value || ''} onChange={onChange} placeholder={filter.placeholder} />
    }
}
