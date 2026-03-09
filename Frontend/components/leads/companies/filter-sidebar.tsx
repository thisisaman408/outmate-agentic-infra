"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SlidersHorizontal, Trash2, Search, Loader2 } from "lucide-react"
import { ALL_FILTERS, PINNED_FILTERS_DEFAULT, FilterConfig } from "./constants"
import { FilterSection } from "./filters/filter-section"
import { FilterInputText } from "./filters/filter-input-text"
import { FilterInputMultiSelect } from "./filters/filter-input-multi-select"
import { AllFiltersView } from "./all-filters-view"
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
import { ProFilterLock } from "./filters/pro-filter-lock"
import { leadsApi, type Lead } from "@/lib/api/leads"
import { useToast } from "@/hooks/use-toast"
import { useStore } from "@/lib/store"

interface FilterSidebarProps {
    onSearch?: (results: Lead[], loading: boolean, searched: boolean, filters: Record<string, any>) => void
    initialFilters?: Record<string, any>
    autoSearchOnMount?: boolean
}

export function FilterSidebar({ onSearch, initialFilters, autoSearchOnMount = false }: FilterSidebarProps) {
    const { toast } = useToast()
    const [pinnedFilterIds, setPinnedFilterIds] = React.useState<string[]>(PINNED_FILTERS_DEFAULT)
    const [showAllFilters, setShowAllFilters] = React.useState(false)
    const [filters, setFilters] = React.useState<Record<string, any>>(initialFilters || {})
    const [isSearching, setIsSearching] = React.useState(false)

    React.useEffect(() => {
        // When initialFilters change (restore), set them
        if (initialFilters) {
            setFilters(initialFilters)
        }
    }, [initialFilters])

    React.useEffect(() => {
        if (autoSearchOnMount) {
            // Trigger search automatically on mount/restore
            handleSearch().catch(() => {})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSearchOnMount])

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


    const handleSearch = async () => {
        setIsSearching(true)

        // Clean filters - remove undefined, null, empty strings, and empty arrays
        const cleanedFilters = Object.entries(filters).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '' &&
                !(Array.isArray(value) && value.length === 0)) {
                acc[key] = value
            }
            return acc
        }, {} as Record<string, any>)

        // Transform filters for backend compatibility
        const transformedFilters = { ...cleanedFilters }

        // 1. Convert founded_year from string to integer
        if (transformedFilters.founded_year) {
            const year = parseInt(transformedFilters.founded_year)
            if (!isNaN(year)) {
                transformedFilters.founded_year = year
            } else {
                delete transformedFilters.founded_year
            }
        }

        // 2. Handle location filter - break down into location_country, location_state, location_city
        if (transformedFilters.location && Array.isArray(transformedFilters.location)) {
            const locations = transformedFilters.location
            const states: string[] = []
            const cities: string[] = []
            const countries: string[] = []

            locations.forEach((loc: any) => {
                if (loc.state) states.push(loc.state)
                if (loc.city) cities.push(loc.city)
                if (loc.country) countries.push(loc.country)
            })

            delete transformedFilters.location
            if (states.length > 0) transformedFilters.location_state = states
            if (cities.length > 0) transformedFilters.location_city = cities
            if (countries.length > 0) transformedFilters.location_country = countries
        }

        onSearch?.([], true, true, transformedFilters)

        try {
            console.log('🔍 Searching with filters:', transformedFilters)

            const response = await fetch(`/api/v1/leads/search/companies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filters: transformedFilters,
                    options: {
                        limit: 3
                    }
                }),
            })

            console.log('📡 Response status:', response.status)

            if (!response.ok) {
                throw new Error('Search failed')
            }

            const result = await response.json()
            console.log('✅ Backend response:', result)

            if (!result.success) {
                throw new Error(result.error?.message || 'Search failed')
            }

            // Map ALL company fields from backend for dynamic display
            const companies = result.data.companies.map((company: any) => ({
                // Pass through ALL fields from backend response
                id: company.id,
                name: company.name,
                domain: company.domain,
                website: company.website || `https://${company.domain}`,
                logo_url: company.logo_url,
                description: company.description,

                // Firmographic
                industry: company.industry,
                sub_industry: company.sub_industry,
                linkedin_industry_category: company.linkedin_industry_category,
                employee_count_range: company.employee_range || company.employee_count_range,
                employee_count_exact: company.employee_count || company.employee_count_exact,
                revenue_range: company.revenue_range,
                revenue_exact: company.revenue || company.revenue_exact,
                company_type: company.company_type,
                founded_year: company.founded_year,

                // Location - handle both nested and flat structure
                headquarters_country: company.headquarters?.country || company.headquarters_country,
                headquarters_state: company.headquarters?.state || company.headquarters_state,
                headquarters_city: company.headquarters?.city || company.headquarters_city,
                headquarters_address: company.headquarters_address,
                zip_code: company.zip_code,
                locations: company.locations || [],
                phone: company.phone,
                email: company.email,

                // Funding
                funding_stage: company.funding_stage,
                funding_total: company.funding_total,
                last_funding_date: company.last_funding_date,
                investors: company.investors || [],
                investors_count: company.investors_count,

                // Social
                linkedin_url: company.linkedin_url,
                twitter_url: company.twitter_url,
                facebook_url: company.facebook_url,
                follower_count: company.follower_count,

                // Tech & Metrics
                technologies: company.technologies || [],
                specialties: company.specialties || [],
                is_tech_heavy: company.is_tech_heavy,
                employee_growth_6m: company.employee_growth_6m,
                employee_growth_12m: company.employee_growth_12m,
                employee_growth_6m_percent: company.employee_growth_6m_percent,
                employee_growth_12m_percent: company.employee_growth_12m_percent,
                department_headcount: company.department_headcount,
                decision_makers_count: company.decision_makers_count,
                locations_distribution_count: company.locations_distribution_count || (Array.isArray(company.locations) ? company.locations.length : 0),

                // Metadata
                provider_source: company.provider_source,
                data_quality_score: company.quality_score || company.data_quality_score,
                enriched: company.enriched,
                created_at: company.created_at,
                updated_at: company.updated_at,
                categories: company.categories,
                market_segments: company.market_segments,
                acquisition_status: company.acquisition_status,
            }))

            console.log('🏢 Mapped companies with all fields:', companies)

            onSearch?.(companies, false, true, transformedFilters)

            toast({
                title: "Success",
                description: `Found ${companies.length} companies matching your filters`,
            })
        } catch (error) {
            console.error('Search error:', error)
            onSearch?.([], false, true, transformedFilters)
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to search companies. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsSearching(false)
        }
    }


    // Memoize pinned filter configs
    const pinnedFilters = React.useMemo(() => {
        return pinnedFilterIds
            .map(id => ALL_FILTERS.find(f => f.id === id))
            .filter((f): f is FilterConfig => !!f)
    }, [pinnedFilterIds])

    const { user } = useStore()
    const isPro = user?.plan === "pro"
    const handleProFilterClick = (label: string) => {
        toast({
            title: "Pro Feature",
            description: `Only Outmate Pro users can use the ${label} filter. Upgrade to unlock precision controls.`,
        })
    }

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
                                    {renderFilterControl(filter)}
                                </FilterSection>
                            ))}
                        </div>
                    </ScrollArea>

                {/* Footer Actions */}
                <div className="p-3 border-t border-border/40 space-y-2 bg-gradient-to-t from-background/80 to-background/20">
                    <Button
                        className="w-full justify-center bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                        onClick={handleSearch}
                        disabled={isSearching}
                    >
                        {isSearching ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Searching...
                            </>
                        ) : (
                            <>
                                <Search className="mr-2 h-4 w-4" />
                                Search Companies
                            </>
                        )}
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
                        disabled={Object.keys(filters).length === 0}
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
                            isPro={isPro}
                            onProFilterClick={(label) => handleProFilterClick(label)}
                        />
        </>
    )
}

function renderFilterInput(
    filter: FilterConfig,
    value: any,
    onChange: (value: any) => void
) {
    switch (filter.type) {
        // Special case for investors using ID
        case 'text':
            if (filter.id === 'investors') {
                return <FilterInputInvestors value={value || []} onChange={onChange} placeholder={filter.placeholder} />
            }
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
        case 'technology':
            return <FilterInputMultiSelect options={filter.options || []} value={value || []} onChange={onChange} />
        case 'range':
            // Quick implementation of range using multi-select for now or specialized range component if created
            return <FilterInputMultiSelect options={filter.options || []} value={value || []} onChange={onChange} />
        case 'location':
            return <FilterMultiLocation value={value || []} onChange={onChange} placeholder={filter.placeholder} />
        default:
            return null
    }
}
