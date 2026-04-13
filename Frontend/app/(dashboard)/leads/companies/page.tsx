"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Search,
  Command,
  Bot,
  Zap,
  Bookmark,
  Star,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  Plus,
  Building2,
  Globe,
  MoreVertical,
  ArrowUpDown,
  Filter,
  Download,
  MapPin,
  Loader2,
  Sparkles,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { leadsApi, type Lead } from "@/lib/api/leads"
import { NlpSearchBar } from "@/components/leads/nlp-search-bar"
import { authService } from "@/lib/auth"
import { toast } from "sonner"

/* ─── filter data ─── */

interface FilterDef {
  icon: string
  label: string
  locked?: boolean
  tier?: "Growth" | "Scale"
  signalRow?: boolean
  chips?: string[]
  expanded?: boolean
  filterKey?: string // maps to backend filter key
  addable?: boolean  // whether user can add chips
  options?: string[] // predefined options/ranges
}

const unlockedFilters: FilterDef[] = [
  { icon: "\u{1F3E2}", label: "Company", expanded: true, chips: [], filterKey: "name", addable: true },
  { 
    icon: "\u{1F3F7}", label: "Industry & keywords", expanded: true, chips: [], filterKey: "industry", addable: true,
    options: ["Software", "SaaS", "E-commerce", "Healthcare", "Fintech", "Manufacturing", "Education", "Real Estate"]
  },
  { 
    icon: "\u{1F465}", label: "# Employees", filterKey: "company_size", addable: true,
    options: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "10001+"]
  },
  { 
    icon: "\u{1F4B5}", label: "Revenue range", filterKey: "revenue_range", addable: true,
    options: ["$0-$1M", "$1M-$10M", "$10M-$50M", "$50M-$100M", "$100M-$500M", "$500M-$1B", "$1B+"]
  },
  { 
    icon: "\u{1F4B0}", label: "Funding stage", expanded: true, chips: [], filterKey: "funding_stage", addable: true,
    options: ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "IPO", "Acquired"]
  },
  { icon: "\u2699\uFE0F", label: "Technologies", filterKey: "technologies", addable: true },
  { icon: "\u26A1", label: "Signals", signalRow: true },
  { icon: "\u{1F4CB}", label: "Job postings" },
]

const lockedFilters: FilterDef[] = [
  { icon: "\u{1F4C8}", label: "Headcount growth", locked: true, tier: "Growth" },
  { icon: "\u{1F3AF}", label: "Buying intent", locked: true, tier: "Growth" },
  { icon: "\u{1F4A1}", label: "Intent topics", locked: true, tier: "Growth" },
  { icon: "\u{1F441}", label: "Website visitors", locked: true, tier: "Growth" },
  { icon: "\u{1F916}", label: "AI filters", locked: true, tier: "Growth" },
  { icon: "\u2B50", label: "ICP fit score", locked: true, tier: "Growth" },
  { icon: "\u{1F4CA}", label: "Scores (composite)", locked: true, tier: "Scale" },
  { icon: "\u{1F517}", label: "Company lookalikes", locked: true, tier: "Scale" },
  { icon: "\u{1F9E0}", label: "Composite GTM score", locked: true, tier: "Scale" },
  { icon: "\u{1F5C2}", label: "SIC and NAICS", locked: true, tier: "Growth" },
  { icon: "\u{1F5FA}", label: "Territories", locked: true, tier: "Scale" },
  { icon: "\u{1F3E6}", label: "Parent accounts", locked: true, tier: "Scale" },
]

/* ─── helpers ─── */

const tierPill = (tier: "Growth" | "Scale") => {
  const cls = tier === "Growth" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"
  return <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider", cls)}>{tier}</span>
}

const scoreBar = (score: number) => (
  <div className="flex items-center gap-1.5">
    <div className="w-[44px] h-[4px] rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
    </div>
    <span className="text-[10px] font-bold text-foreground">{score}</span>
  </div>
)

const intentDots = (n: number) => (
  <div className="flex items-center gap-[3px]">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className={cn("w-[6px] h-[6px] rounded-full", i <= n ? "bg-primary" : "bg-muted")} />
    ))}
  </div>
)

/* ─── build backend filters from chips ─── */
function buildFiltersFromChips(chips: Record<string, string[]>): Record<string, any> {
  const filters: Record<string, any> = {}
  const filterKeyMap: Record<string, string> = {
    "Company": "name",
    "Industry & keywords": "industry",
    "# Employees": "company_size",
    "Revenue range": "revenue_range",
    "Funding stage": "funding_stage",
    "Technologies": "technologies",
  }
  for (const [label, values] of Object.entries(chips)) {
    if (values.length === 0) continue
    const key = filterKeyMap[label]
    if (!key) continue
    filters[key] = values.length === 1 ? values[0] : values
  }
  return filters
}

export default function CompaniesPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new")
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    Company: true,
    "Industry & keywords": true,
    "Funding stage": true,
  })
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    Company: [],
    "Industry & keywords": [],
    "Funding stage": [],
  })
  const [chipInputs, setChipInputs] = useState<Record<string, string>>({})
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")

  // Real Data State
  const [companies, setCompanies] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const searchWithFilters = useCallback(async (filters: Record<string, any>) => {
    if (Object.keys(filters).length === 0) return
    setIsLoading(true)
    setHasSearched(true)
    try {
      const data = await leadsApi.generateLeads({
        prompt: "",
        filters: filters as any,
        limit: 50,
      })
      setCompanies(data)
    } catch (err: any) {
      toast.error(err.message || "Search failed")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Search when filter chips change
  useEffect(() => {
    const filters = buildFiltersFromChips(filterChips)
    if (Object.keys(filters).length > 0) {
      searchWithFilters(filters)
    }
  }, [filterChips, searchWithFilters])

  // NLP search handler
  const handleNlpSearch = async (filters: Record<string, any>) => {
    setIsLoading(true)
    setHasSearched(true)
    setCompanies([])
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      }
      const response = await fetch("/api/v1/leads/search/companies", {
        method: "POST",
        headers,
        body: JSON.stringify({ filters, options: { limit: 50 } }),
      })
      if (!response.ok) throw new Error(`Search failed: ${response.status}`)
      const result = await response.json()
      if (!result.success) throw new Error(result.error?.message || "Search failed")

      const rawCompanies = result.data?.companies || []
      // Transform to Lead format
      const { transformCompanyToLead } = await import("@/lib/api/leads")
      const leads = rawCompanies.map(transformCompanyToLead)
      setCompanies(leads)
    } catch (e: any) {
      toast.error(e.message || "AI Search failed")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFilter = (label: string) => {
    setExpandedFilters((p) => ({ ...p, [label]: !p[label] }))
  }

  const removeChip = (filter: string, chip: string) => {
    setFilterChips((p) => ({ ...p, [filter]: (p[filter] || []).filter((c) => c !== chip) }))
  }

  const addChip = (filter: string, chip: string) => {
    if (!chip.trim()) return
    setFilterChips((p) => {
      const existing = p[filter] || []
      if (existing.includes(chip.trim())) return p
      return { ...p, [filter]: [...existing, chip.trim()] }
    })
    setChipInputs((p) => ({ ...p, [filter]: "" }))
  }

  const toggleRow = (id: string) => {
    setSelectedRows((p) => ({ ...p, [id]: !p[id] }))
  }

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies
    return companies.filter(c =>
      c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [companies, searchQuery])

  const handleExport = () => {
    if (filteredCompanies.length === 0) return
    const headers = ["Company", "Industry", "Employees", "Location", "Score", "Email", "LinkedIn"]
    const rows = filteredCompanies.map((c) => [
      c.companyName, c.industry, c.employees, c.location, String(c.score), c.email, c.linkedin || ""
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `companies_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredCompanies.length} companies to CSV`)
  }

  const selectedCount = Object.values(selectedRows).filter(Boolean).length
  const activeFilterCount = Object.values(filterChips).filter((v) => v.length > 0).length

  if (!mounted) return null

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Filter Sidebar */}
      <aside className="w-[260px] min-w-[260px] h-full flex flex-col bg-card border-r border-border shadow-sm">
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Filter companies..."
              className="pl-9 h-9 bg-muted/40 border-transparent focus:bg-background transition-all text-xs font-medium rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-2">
          {([
            ["total", "Total", companies.length > 0 ? companies.length.toLocaleString() : "0"],
            ["new", "Net New", hasSearched ? filteredCompanies.length.toLocaleString() : "0"],
            ["saved", "Saved", "0"],
          ] as const).map(([key, label, num]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={cn(
                "flex-1 flex flex-col items-center py-3 relative transition-all",
                activeTab === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-[14px] font-bold tracking-tight">{num}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">{label}</span>
              {activeTab === key && (
                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Filters Scroll Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {unlockedFilters.map((f) => {
            const isExpanded = expandedFilters[f.label]
            const chips = filterChips[f.label] || []
            const hasChips = chips.length > 0
            return (
              <div key={f.label} className="border-b border-border/40 last:border-0">
                <button
                  onClick={() => f.addable ? toggleFilter(f.label) : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 h-11 text-left transition-all hover:bg-muted/30",
                    f.signalRow ? "text-orange-500" : hasChips ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className="flex-1 text-[12px] font-bold tracking-tight">{f.label}</span>
                  {hasChips && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                      {chips.length}
                    </span>
                  )}
                  {f.addable && (
                    isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-40" /> : <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                  )}
                </button>
                {isExpanded && f.addable && (
                  <div className="px-4 pb-3 pt-1 bg-muted/20">
                    {/* Predefined Options / Ranges */}
                    {f.options && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {f.options.map(opt => {
                          const isSelected = chips.includes(opt)
                          return (
                            <button
                              key={opt}
                              onClick={() => isSelected ? removeChip(f.label, opt) : addChip(f.label, opt)}
                              className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-md border transition-all",
                                isSelected 
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
                              )}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {hasChips && !f.options && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {chips.map((c) => (
                          <span
                            key={c}
                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                          >
                            {c}
                            <button onClick={() => removeChip(f.label, c)} className="hover:text-foreground">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex gap-1">
                      <Input
                        placeholder={`Add ${f.label.toLowerCase()}...`}
                        className="h-7 text-[10px] bg-background"
                        value={chipInputs[f.label] || ""}
                        onChange={(e) => setChipInputs((p) => ({ ...p, [f.label]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addChip(f.label, chipInputs[f.label] || "")
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => addChip(f.label, chipInputs[f.label] || "")}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 mt-4">Locked Filters</div>
          {lockedFilters.map((f) => (
            <Popover key={f.label}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center gap-3 px-4 h-11 text-left opacity-60 hover:opacity-100 transition-opacity grayscale hover:grayscale-0">
                  <span className="flex-1 text-[12px] font-bold tracking-tight text-muted-foreground">{f.label}</span>
                  <Lock className="w-3.5 h-3.5 opacity-30" />
                  {f.tier && tierPill(f.tier)}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-[240px] p-4 shadow-2xl border-border rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-bold tracking-tight">Requires {f.tier} plan</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed mb-4">
                  Unlock advanced {f.label.toLowerCase()} filtering to identify your most profitable accounts.
                </p>
                <Button className="w-full h-9 text-[11px] font-bold bg-primary text-primary-foreground">Upgrade Portfolio</Button>
              </PopoverContent>
            </Popover>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-4 border-t border-border bg-card">
          <button
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setFilterChips({})
              setCompanies([])
              setHasSearched(false)
            }}
          >
            Clear all {activeFilterCount > 0 ? `\u00B7 ${activeFilterCount}` : ""}
          </button>
          <button className="text-[11px] font-black text-primary hover:underline">Advanced</button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Action Bar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card">
          <div className="flex-1 flex items-center gap-3 px-4 py-2 rounded-xl bg-muted/50 border border-border/50 group focus-within:border-primary/50 transition-all">
            <Search className="w-4 h-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
            <input
              placeholder="Search across companies..."
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 h-5 px-1.5 font-sans text-[10px] font-bold text-muted-foreground bg-card border border-border rounded opacity-100">
               \u2318K
            </kbd>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all">
              <Bot className="w-4 h-4" /> AI Research
            </Button>
            <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-[11px] font-bold hover:bg-primary/5 hover:text-primary transition-all">
              <Zap className="w-4 h-4" /> Workflows
            </Button>
            <Button className="h-10 px-5 gap-2 text-[11px] font-black bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95">
              <Play className="w-4 h-4 fill-current" /> Run Agent
            </Button>
          </div>
        </div>

        {/* NLP Search Bar */}
        <div className="px-6 py-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Search</span>
            <span className="text-xs text-muted-foreground">Describe the companies you&apos;re looking for in plain English</span>
          </div>
          <NlpSearchBar intent="company" onFiltersExtracted={handleNlpSearch} />
        </div>

        {/* Stats & Results Summary */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-3">
             <span className="text-[11px] font-bold text-foreground tracking-tight">
               {isLoading ? (
                 <span className="flex items-center gap-1.5">
                   <Loader2 className="w-3 h-3 animate-spin" /> Searching...
                 </span>
               ) : (
                 <>Found <span className="text-primary">{filteredCompanies.length.toLocaleString()}</span> results</>
               )}
             </span>
             {!isLoading && hasSearched && (
               <>
                 <Separator orientation="vertical" className="h-3" />
                 <span className="text-[10px] font-bold text-muted-foreground">
                   {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} applied
                 </span>
               </>
             )}
          </div>
          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <Badge className="bg-primary text-primary-foreground font-bold px-2.5 py-1 text-[10px] shadow-sm">
                {selectedCount} Selected
              </Badge>
            )}
            <button
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              onClick={handleExport}
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">CRM Sync</button>
             <button className="text-[11px] font-bold text-primary px-3 py-1 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
               + Add AI Column
             </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto no-scrollbar">
          {!hasSearched && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">Search for companies</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Use the filters on the left or the AI search bar above to find companies matching your criteria.
              </p>
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur-md">
                  <tr className="border-b border-border shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    <th className="w-14 px-6 py-4 align-middle">
                       <div className="flex items-center justify-center">
                         <input type="checkbox" className="w-4 h-4 rounded-md accent-primary border-muted" />
                       </div>
                    </th>
                    {[
                      { label: "Company", width: "220px" },
                      { label: "Industry", width: "160px" },
                      { label: "Employees", width: "120px" },
                      { label: "Funding", width: "120px" },
                      { label: "Location", width: "160px" },
                      { label: "ICP Score", width: "120px" },
                      { label: "Intent", width: "100px" },
                      { label: "Action", width: "100px" }
                    ].map((h) => (
                      <th key={h.label} className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50" style={{ width: h.width }}>
                        <div className="flex items-center gap-1.5 group cursor-pointer hover:text-foreground transition-colors">
                          {h.label}
                          <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-5"><div className="w-4 h-4 rounded bg-muted mx-auto" /></td>
                        <td className="px-4 py-5 font-medium"><div className="w-32 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-24 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-16 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-20 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-28 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-20 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-16 h-4 rounded bg-muted" /></td>
                        <td className="px-4 py-5 text-sm"><div className="w-12 h-4 rounded bg-muted" /></td>
                      </tr>
                    ))
                  ) : filteredCompanies.map((c) => (
                    <tr
                      key={c.id}
                      className={cn(
                        "group transition-all hover:bg-muted/30 border-l-2 border-transparent",
                        selectedRows[c.id] && "bg-primary/5 border-primary border-l-4"
                      )}
                      onClick={() => toggleRow(c.id)}
                    >
                      <td className="px-6 py-5 align-middle" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                         <input
                            type="checkbox"
                            checked={!!selectedRows[c.id]}
                            onChange={() => toggleRow(c.id)}
                            className="w-4 h-4 rounded-md accent-primary"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-xs font-black shadow-sm group-hover:border-primary/30 transition-all overflow-hidden shrink-0">
                            <Building2 className="w-5 h-5 text-muted-foreground/30" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-black text-foreground hover:text-primary transition-colors cursor-pointer truncate">{c.companyName}</div>
                            <div className="text-[10px] text-muted-foreground font-bold tracking-tight mt-0.5 truncate flex items-center gap-1.5 opacity-60">
                               <Globe className="w-3 h-3 text-primary/40 truncate shrink-0" />
                               {c.linkedin ? new URL(c.linkedin).pathname.split('/').filter(Boolean).pop() : c.companyName.toLowerCase().replace(/\s+/g, '')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-[11px] font-bold text-muted-foreground truncate block">{c.industry}</span>
                      </td>
                      <td className="px-4 py-5">
                        <span className="text-[11px] font-black text-foreground">{c.employees}</span>
                      </td>
                      <td className="px-4 py-5">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                          {c.fundingStage || "N/A"}
                        </Badge>
                      </td>
                      <td className="px-4 py-5">
                        <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 truncate">
                           <MapPin className="w-3 h-3 opacity-40 shrink-0" />
                           {c.location.split(',')[0]}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        {scoreBar(c.score)}
                      </td>
                      <td className="px-4 py-5">
                        {intentDots(Math.min(5, Math.max(1, Math.round(c.signalsCount / 2))))}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                           <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary">
                             <Star className="w-4 h-4" />
                           </Button>
                           <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary">
                             <MoreVertical className="w-4 h-4" />
                           </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Load More */}
              {!isLoading && filteredCompanies.length > 0 && (
                 <div className="p-8 flex justify-center border-t border-border bg-muted/5">
                    <Button variant="outline" className="h-10 px-8 rounded-xl font-bold text-xs gap-2 border-border/60 hover:border-primary transition-all">
                       Show more companies <ChevronDown className="w-4 h-4 opacity-40" />
                    </Button>
                 </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
