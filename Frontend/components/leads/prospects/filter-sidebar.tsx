import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SlidersHorizontal, Trash2, Search } from "lucide-react"
import { ALL_FILTERS, PINNED_FILTERS_DEFAULT, FilterConfig } from "./constants"
import { FilterSection } from "@/components/leads/companies/filters/filter-section" // Reusing
import { FilterInputText } from "@/components/leads/companies/filters/filter-input-text" // Reusing
import { FilterInputMultiSelect } from "@/components/leads/companies/filters/filter-input-multi-select" // Reusing
import { FilterInputDualMode } from "@/components/leads/companies/filters/filter-input-dual-mode"
import { FilterTagsDisplay } from "@/components/leads/companies/filters/filter-tags-display"
import { AllFiltersView } from "./all-filters-view"
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
import { ProFilterLock } from "@/components/leads/companies/filters/pro-filter-lock"
import { useToast } from "@/hooks/use-toast"
import { useStore } from "@/lib/store"

interface FilterSidebarProps {
    onApplyFilters?: (filters: Record<string, any>) => void
    filterOperators?: Record<string, 'in' | 'not_in'>
    onOperatorChange?: (filterId: string, operator: 'in' | 'not_in') => void
    externalFilters?: Record<string, any>
}

export function FilterSidebar({ onApplyFilters, filterOperators = {}, onOperatorChange, externalFilters }: FilterSidebarProps) {
    const [pinnedFilterIds, setPinnedFilterIds] = React.useState<string[]>(PINNED_FILTERS_DEFAULT)
    const [showAllFilters, setShowAllFilters] = React.useState(false)
    const [filters, setFilters] = React.useState<Record<string, any>>({})

    // Sync copilot-injected filters into local sidebar state
    React.useEffect(() => {
        if (!externalFilters || Object.keys(externalFilters).length === 0) return
        setFilters(prev => ({ ...prev, ...externalFilters }))
    }, [externalFilters])

    const handleFilterChange = (id: string, value: any) => {
        setFilters(prev => ({
            ...prev,
            [id]: value
        }))
        console.log(`Filter ${id} changed to:`, value)
    }

    const clearFilters = () => {
        setFilters({})
    }

    const applyFilters = () => {
        onApplyFilters?.(filters)
    }

    const { toast } = useToast()
    const { user } = useStore()
    const isPro = user?.plan === "pro"

    const handleProFilterClick = (label: string) => {
        toast({
            title: "Upgrade to Pro",
            description: `Unlock the ${label} filter by upgrading to Outmate Pro.`,
            variant: "destructive"
        })
    }

    // Memoize pinned filter configs
    const pinnedFilters = React.useMemo(() => {
        return pinnedFilterIds
            .map(id => ALL_FILTERS.find(f => f.id === id))
            .filter((f): f is FilterConfig => !!f)
    }, [pinnedFilterIds])

    const renderFilterControl = (filter: FilterConfig) => {
        if (filter.requiresPro && !isPro) {
            return <ProFilterLock label={filter.label} onUpgrade={() => handleProFilterClick(filter.label)} />
        }
        return renderFilterInput(filter, filters[filter.id], (val) => handleFilterChange(filter.id, val))
    }

    return (
        <>
            <div className="w-80 flex-shrink-0 h-full flex flex-col bg-card border-r border-border shadow-sm z-10">
                {/* Header */}
                <div className="p-4 border-b border-border/40">
                    <h2 className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                    </h2>
                </div>

                {/* Scrollable Filters Area */}
                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-1">
                        {pinnedFilters.map((filter) => (
                            <FilterSection
                                key={filter.id}
                                title={filter.label}
                                description={filter.description}
                                count={Array.isArray(filters[filter.id]) ? filters[filter.id].length : (filters[filter.id] ? 1 : 0)}
                                onClear={() => handleFilterChange(filter.id, undefined)}
                            >
                                {/* Tags Display (for dual-mode filters) */}
                                {filter.supportsOperator && filters[filter.id] && typeof filters[filter.id] === 'object' && 'included' in filters[filter.id] && (
                                    <FilterTagsDisplay
                                        includedValues={filters[filter.id].included || []}
                                        excludedValues={filters[filter.id].excluded || []}
                                        onRemoveIncluded={(val) => {
                                            const current = filters[filter.id]
                                            handleFilterChange(filter.id, {
                                                ...current,
                                                included: current.included.filter((v: string) => v !== val)
                                            })
                                        }}
                                        onRemoveExcluded={(val) => {
                                            const current = filters[filter.id]
                                            handleFilterChange(filter.id, {
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
                                                (filterOperators[filter.id] || 'in') === 'in'
                                                    ? "bg-green-600 text-white shadow-sm hover:bg-green-700"
                                                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                            onClick={() => onOperatorChange(filter.id, 'in')}
                                        >
                                            Include
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className={cn(
                                                "flex-1 h-8 text-xs font-medium transition-all",
                                                (filterOperators[filter.id] || 'in') === 'not_in'
                                                    ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
                                                    : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                            onClick={() => onOperatorChange(filter.id, 'not_in')}
                                        >
                                            Exclude
                                        </Button>
                                    </div>
                                )}
                                {renderFilterControl(filter)}
                            </FilterSection>
                        ))}
                    </div>
                </ScrollArea>

                {/* Footer Actions */}
                <div className="p-3 border-t border-border/40 space-y-2 bg-gradient-to-t from-background/80 to-background/20">
                    <Button
                        className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                        onClick={applyFilters}
                    >
                        <Search className="h-4 w-4" />
                        Apply Filters
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full justify-start text-muted-foreground hover:text-foreground border-dashed border-border hover:border-primary/50"
                        onClick={() => setShowAllFilters(true)}
                    >
                        <SlidersHorizontal className="mr-2 h-4 w-4" />
                        More Filters
                    </Button>

                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={clearFilters}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All
                    </Button>
                </div>
            </div>

            <AllFiltersView
                open={showAllFilters}
                onOpenChange={setShowAllFilters}
                filters={filters}
                onFilterChange={handleFilterChange}
                onApply={(newFilters) => {
                    setFilters(newFilters)
                    setShowAllFilters(false)
                }}
                pinnedFilters={pinnedFilterIds}
                onPinChange={setPinnedFilterIds}
                filterOperators={filterOperators}
                onOperatorChange={onOperatorChange}
                isPro={isPro}
                onProFilterClick={(label) => handleProFilterClick(label)}
            />
        </>
    )
}

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
        case 'location':
            return <FilterMultiLocation value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'language':
            return <FilterInputLanguage value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'school':
            return <FilterInputSchool value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        case 'boolean':
            return <FilterInputBoolean value={value || false} onChange={onChange} label={filter.label} />
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
            return <FilterAutocomplete field="hq_location" value={value || ""} onChange={onChange} placeholder={filter.placeholder} />
        default:
            return null
    }
}
