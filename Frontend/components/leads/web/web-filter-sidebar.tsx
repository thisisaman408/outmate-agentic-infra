"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SlidersHorizontal, Trash2, Calendar } from "lucide-react"
import { FilterSection } from "@/components/leads/companies/filters/filter-section"
import { FilterInputMultiSelect } from "@/components/leads/companies/filters/filter-input-multi-select"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface WebFilterSidebarProps {
    activeTab: string
}

// Search filters
const SEARCH_FILTERS = [
    {
        id: "date_range",
        label: "Date Range",
        type: "multi-select" as const,
        options: [
            { value: "today", label: "Today" },
            { value: "week", label: "Past Week" },
            { value: "month", label: "Past Month" },
            { value: "year", label: "Past Year" },
            { value: "all", label: "All Time" }
        ]
    },
    {
        id: "content_type",
        label: "Content Type",
        type: "multi-select" as const,
        options: [
            { value: "article", label: "Articles" },
            { value: "news", label: "News" },
            { value: "blog", label: "Blog Posts" },
            { value: "research", label: "Research Papers" },
            { value: "press", label: "Press Releases" },
            { value: "social", label: "Social Media" }
        ]
    },
    {
        id: "domain_filter",
        label: "Domain Filter",
        type: "multi-select" as const,
        options: [
            { value: "techcrunch.com", label: "TechCrunch" },
            { value: "bloomberg.com", label: "Bloomberg" },
            { value: "wsj.com", label: "Wall Street Journal" },
            { value: "forbes.com", label: "Forbes" },
            { value: "reuters.com", label: "Reuters" },
            { value: "ft.com", label: "Financial Times" }
        ]
    },
    {
        id: "region",
        label: "Region",
        type: "multi-select" as const,
        options: [
            { value: "us", label: "United States" },
            { value: "uk", label: "United Kingdom" },
            { value: "eu", label: "European Union" },
            { value: "asia", label: "Asia Pacific" },
            { value: "global", label: "Global" }
        ]
    },
    {
        id: "language",
        label: "Language",
        type: "multi-select" as const,
        options: [
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
            { value: "fr", label: "French" },
            { value: "de", label: "German" },
            { value: "zh", label: "Chinese" },
            { value: "ja", label: "Japanese" }
        ]
    }
]

// Fetch filters
const FETCH_FILTERS = [
    {
        id: "fetch_status",
        label: "Fetch Status",
        type: "multi-select" as const,
        options: [
            { value: "success", label: "Success" },
            { value: "failed", label: "Failed" },
            { value: "pending", label: "Pending" },
            { value: "timeout", label: "Timeout" }
        ]
    },
    {
        id: "content_format",
        label: "Content Format",
        type: "multi-select" as const,
        options: [
            { value: "html", label: "HTML" },
            { value: "text", label: "Text Only" },
            { value: "markdown", label: "Markdown" },
            { value: "json", label: "JSON" }
        ]
    },
    {
        id: "response_time",
        label: "Response Time",
        type: "multi-select" as const,
        options: [
            { value: "fast", label: "< 1 second" },
            { value: "medium", label: "1-3 seconds" },
            { value: "slow", label: "> 3 seconds" }
        ]
    }
]

export function WebFilterSidebar({ activeTab }: WebFilterSidebarProps) {
    const [filters, setFilters] = React.useState<Record<string, any>>({})
    const [saved, setSaved] = React.useState<boolean>(false)
    const [dateFrom, setDateFrom] = React.useState<string>("")
    const [dateTo, setDateTo] = React.useState<string>("")

    const handleFilterChange = (id: string, value: any) => {
        setFilters(prev => ({
            ...prev,
            [id]: value
        }))
        console.log(`Filter ${id} changed to:`, value)
    }

    const clearFilters = () => {
        setFilters({})
        setSaved(false)
        setDateFrom("")
        setDateTo("")
    }

    const getActiveFilters = () => {
        switch (activeTab) {
            case "search":
                return SEARCH_FILTERS
            case "fetch":
                return FETCH_FILTERS
            default:
                return []
        }
    }

    const activeFilterCount = Object.values(filters).filter(v => 
        (Array.isArray(v) && v.length > 0) || (v && !Array.isArray(v))
    ).length + (saved ? 1 : 0)

    return (
        <div className="w-80 flex-shrink-0 h-full flex flex-col bg-card border-r border-border shadow-sm z-10">
            {/* Header */}
            <div className="p-4 border-b border-border/40">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                        <SlidersHorizontal className="h-4 w-4" />
                        Filters
                    </h2>
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {activeFilterCount}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Scrollable Filters Area */}
            <ScrollArea className="flex-1">
                <div className="p-3 space-y-1">
                    {/* Common Filters */}
                    {activeTab === "search" && (
                        <>
                            <FilterSection
                                title="Saved Only"
                                description="Show saved results"
                                count={saved ? 1 : 0}
                                onClear={() => setSaved(false)}
                            >
                                <div className="flex items-center space-x-2 p-2">
                                    <input
                                        type="checkbox"
                                        id="saved"
                                        checked={saved}
                                        onChange={(e) => setSaved(e.target.checked)}
                                        className="rounded border-gray-300"
                                    />
                                    <Label htmlFor="saved" className="text-sm cursor-pointer">
                                        Show only saved results
                                    </Label>
                                </div>
                            </FilterSection>

                            <FilterSection
                                title="Custom Date Range"
                                description="Filter by specific dates"
                            >
                                <div className="space-y-2 p-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="dateFrom" className="text-xs">From</Label>
                                        <Input
                                            id="dateFrom"
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="dateTo" className="text-xs">To</Label>
                                        <Input
                                            id="dateTo"
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                </div>
                            </FilterSection>
                        </>
                    )}

                    {/* Tab-specific filters */}
                    {getActiveFilters().map((filter) => (
                        <FilterSection
                            key={filter.id}
                            title={filter.label}
                            count={Array.isArray(filters[filter.id]) ? filters[filter.id].length : (filters[filter.id] ? 1 : 0)}
                            onClear={() => handleFilterChange(filter.id, undefined)}
                        >
                            <FilterInputMultiSelect
                                options={filter.options}
                                value={filters[filter.id] || []}
                                onChange={(val) => handleFilterChange(filter.id, val)}
                            />
                        </FilterSection>
                    ))}
                </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="p-3 border-t border-border/40 space-y-2 bg-gradient-to-t from-background/80 to-background/20">
                <div className="text-xs text-muted-foreground px-2 py-1">
                    {activeTab === "search" && "Web search filters"}
                    {activeTab === "fetch" && "Content fetch filters"}
                </div>
                
                <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={clearFilters}
                    disabled={activeFilterCount === 0}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Filters
                </Button>
            </div>
        </div>
    )
}