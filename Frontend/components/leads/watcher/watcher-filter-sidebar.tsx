"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SlidersHorizontal, Trash2 } from "lucide-react"
import { FilterSection } from "@/components/leads/companies/filters/filter-section"
import { FilterInputMultiSelect } from "@/components/leads/companies/filters/filter-input-multi-select"
import { Badge } from "@/components/ui/badge"

export interface WatcherSidebarFilters {
  status: string[]
  [key: string]: any
}

interface WatcherFilterSidebarProps {
  activeTab: string
  onFiltersChange?: (filters: WatcherSidebarFilters) => void
}

// Event watcher filters
const EVENT_FILTERS = [
  {
    id: "event_type",
    label: "Event Type",
    type: "multi-select" as const,
    options: [
      { value: "ipo_announcement", label: "IPO Announcement" },
      { value: "new_funding_round", label: "New Funding Round" },
      { value: "new_investment", label: "New Investment" },
      { value: "merger_and_acquisitions", label: "Merger & Acquisitions" },
      { value: "cost_cutting", label: "Cost Cutting" },
      { value: "team_expansion", label: "Team Expansion" },
      { value: "team_reduction", label: "Team Reduction" },
      { value: "product_launch", label: "Product Launch" },
      { value: "acquisition", label: "Acquisition" }
    ]
  },
  {
    id: "funding_stage",
    label: "Funding Stage",
    type: "multi-select" as const,
    options: [
      { value: "seed", label: "Seed" },
      { value: "series_a", label: "Series A" },
      { value: "series_b", label: "Series B" },
      { value: "series_c", label: "Series C" },
      { value: "series_d_plus", label: "Series D+" },
      { value: "ipo", label: "IPO" }
    ]
  },
  {
    id: "job_level",
    label: "Job Level (for hiring)",
    type: "multi-select" as const,
    options: [
      { value: "c_level", label: "C-Level" },
      { value: "vp", label: "VP" },
      { value: "director", label: "Director" },
      { value: "manager", label: "Manager" },
      { value: "individual", label: "Individual Contributor" }
    ]
  },
  {
    id: "department",
    label: "Department",
    type: "multi-select" as const,
    options: [
      { value: "sales", label: "Sales" },
      { value: "marketing", label: "Marketing" },
      { value: "engineering", label: "Engineering" },
      { value: "product", label: "Product" },
      { value: "customer_success", label: "Customer Success" },
      { value: "hr", label: "HR" },
      { value: "finance", label: "Finance" }
    ]
  },
  {
    id: "company_size",
    label: "Company Size",
    type: "multi-select" as const,
    options: [
      { value: "1-10", label: "1-10" },
      { value: "11-50", label: "11-50" },
      { value: "51-200", label: "51-200" },
      { value: "201-500", label: "201-500" },
      { value: "501-1000", label: "501-1000" },
      { value: "1001-5000", label: "1001-5000" },
      { value: "5001+", label: "5001+" }
    ]
  }
]

const ACCOUNT_FILTERS = [
  {
    id: "trigger_types",
    label: "Alert Triggers",
    type: "multi-select" as const,
    options: [
      { value: "website_content_changes", label: "Website Changes" },
      { value: "funding", label: "Funding Events" },
      { value: "job_changes", label: "Job Changes" },
      { value: "technology_changes", label: "Technology Changes" },
      { value: "news_mentions", label: "News Mentions" },
      { value: "web_traffic", label: "Web Traffic Changes" }
    ]
  },
  {
    id: "account_industry",
    label: "Industry",
    type: "multi-select" as const,
    options: [
      { value: "saas", label: "SaaS" },
      { value: "fintech", label: "FinTech" },
      { value: "ecommerce", label: "E-commerce" },
      { value: "healthcare", label: "Healthcare" },
      { value: "manufacturing", label: "Manufacturing" },
      { value: "retail", label: "Retail" }
    ]
  }
]

const LEAD_FILTERS = [
  {
    id: "lead_trigger_types",
    label: "Alert Triggers",
    type: "multi-select" as const,
    options: [
      { value: "prospect_changed_role", label: "Role Change" },
      { value: "prospect_changed_company", label: "Company Change" },
      { value: "prospect_job_start_anniversary", label: "Job Anniversary" },
      { value: "content_published", label: "Content Published" },
      { value: "speaking_engagement", label: "Speaking Engagements" },
      { value: "social_activity", label: "Social Media Activity" }
    ]
  },
  {
    id: "lead_seniority",
    label: "Seniority",
    type: "multi-select" as const,
    options: [
      { value: "c_level", label: "C-Level" },
      { value: "vp", label: "VP" },
      { value: "director", label: "Director" },
      { value: "manager", label: "Manager" }
    ]
  },
  {
    id: "lead_department",
    label: "Department",
    type: "multi-select" as const,
    options: [
      { value: "sales", label: "Sales" },
      { value: "marketing", label: "Marketing" },
      { value: "engineering", label: "Engineering" },
      { value: "product", label: "Product" },
      { value: "customer_success", label: "Customer Success" }
    ]
  }
]

export function WatcherFilterSidebar({ activeTab, onFiltersChange }: WatcherFilterSidebarProps) {
  const [filters, setFilters] = React.useState<Record<string, any>>({})
  const [watcherStatus, setWatcherStatus] = React.useState<string[]>([])

  const emit = React.useCallback((newFilters: Record<string, any>, newStatus: string[]) => {
    onFiltersChange?.({ status: newStatus, ...newFilters })
  }, [onFiltersChange])

  const handleFilterChange = (id: string, value: any) => {
    const updated = { ...filters, [id]: value }
    setFilters(updated)
    emit(updated, watcherStatus)
  }

  const handleStatusChange = (val: string[]) => {
    setWatcherStatus(val)
    emit(filters, val)
  }

  const clearFilters = () => {
    setFilters({})
    setWatcherStatus([])
    emit({}, [])
  }

  const getActiveFilters = () => {
    switch (activeTab) {
      case "events":   return EVENT_FILTERS
      case "accounts": return ACCOUNT_FILTERS
      case "leads":    return LEAD_FILTERS
      default:         return []
    }
  }

  const activeFilterCount = Object.values(filters).filter(v =>
    (Array.isArray(v) && v.length > 0) || (v && !Array.isArray(v))
  ).length + watcherStatus.length

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
          {/* Watcher Status Filter */}
          <FilterSection
            title="Status"
            description="Filter by watcher status"
            count={watcherStatus.length}
            onClear={() => handleStatusChange([])}
          >
            <FilterInputMultiSelect
              options={[
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" }
              ]}
              value={watcherStatus}
              onChange={handleStatusChange}
            />
          </FilterSection>

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
          {activeTab === "events" && "Event-based discovery filters"}
          {activeTab === "accounts" && "Account monitoring filters"}
          {activeTab === "leads" && "Lead tracking filters"}
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