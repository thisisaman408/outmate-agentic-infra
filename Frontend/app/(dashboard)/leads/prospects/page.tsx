"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search,
  Plus,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  Bot,
  Bookmark,
  Star,
  Play,
  Settings,
  Mic,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  UserCircle,
  Building2,
  Mail,
  Linkedin,
  MapPin,
  Briefcase,
  Sparkles,
  Download,
  Zap,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { searchProspects, type ProspectProfile, type ProspectSearchFilters } from "@/lib/services/prospectService"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"

/* ─── types ─── */

interface FilterDef {
  label: string
  locked?: boolean
  tier?: "Starter" | "Growth" | "Scale"
  signalRow?: boolean
  chips?: string[]
  expanded?: boolean
  options?: string[]
  category?: string
  advancedOptions?: { label: string; description: string }[]
}

/* ─── filter data ─── */

const unlockedFilters: FilterDef[] = [
  /* ── Identity ── */
  {
    label: "Current title",
    category: "Identity",
    options: [
      "VP Sales",
      "Head of Growth",
      "CRO",
      "Director of Sales",
      "Account Executive",
      "SDR Manager",
      "CMO",
      "Head of Marketing",
      "RevOps Lead",
      "BDR Manager",
    ],
    advancedOptions: [
      { label: "Include similar titles", description: "Match related job titles automatically" },
      { label: "Exclude past titles", description: "Don't match on previous positions" },
    ],
  },
  {
    label: "Seniority level",
    category: "Identity",
    options: ["C-suite", "VP", "Director", "Senior IC", "Manager", "IC", "Founder"],
    advancedOptions: [{ label: "Include one level up/down", description: "Broaden to adjacent seniority" }],
  },
  {
    label: "Function / department",
    category: "Identity",
    options: ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "Customer Success", "Design"],
  },

  /* ── Location ── */
  {
    label: "Location",
    category: "Location",
    options: ["United States", "United Kingdom", "Germany", "France", "Canada", "Australia", "India", "New York", "San Francisco", "London"],
    advancedOptions: [{ label: "Include remote", description: "Include remote workers based in region" }],
  },

  /* ── Company ── */
  {
    label: "Company",
    category: "Company",
    options: [],
    advancedOptions: [{ label: "Include subsidiaries", description: "Match parent and subsidiary companies" }],
  },
  {
    label: "# Employees",
    category: "Company",
    options: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "10001+"],
  },
]

const signalFilters: FilterDef[] = [
  { label: "Signals", signalRow: true, expanded: true, chips: ["Job change", "Promotion", "New hire"] },
  { label: "Job change signal", signalRow: true },
  { label: "Promotion signal", signalRow: true },
  { label: "New hire signal", signalRow: true },
]

const lockedFilters: FilterDef[] = [
  { label: "Buying intent", locked: true, tier: "Growth" },
  { label: "Website visitors", locked: true, tier: "Growth" },
  { label: "ICP fit score", locked: true, tier: "Growth" },
  { label: "Composite GTM score", locked: true, tier: "Scale" },
  { label: "Territories", locked: true, tier: "Scale" },
]

/* ─── helpers ─── */

const tierPill = (tier: "Starter" | "Growth" | "Scale") => {
  const cls =
    tier === "Starter" ? "bg-amber-500/20 text-amber-600" : tier === "Growth" ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-600"
  return <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider", cls)}>{tier}</span>
}

const scoreBar = (score: number) => (
  <div className="flex items-center gap-1.5">
    <div className="w-[38px] h-[4px] rounded-full bg-muted overflow-hidden">
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

/* ─── Filter Panel ─── */

function UnlockedFilterPanel({
  filter,
  isExpanded,
  chips,
  onToggle,
  onAddChip,
  onRemoveChip,
}: {
  filter: FilterDef
  isExpanded: boolean
  chips: string[]
  onToggle: () => void
  onAddChip: (val: string) => void
  onRemoveChip: (chip: string) => void
}) {
  const [search, setSearch] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const hasChips = chips.length > 0
  const options = filter.options || []
  const advOpts = filter.advancedOptions || []

  const filtered = useMemo(() => {
    const available = options.filter((o) => !chips.includes(o))
    if (!search.trim()) return available
    return available.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
  }, [options, chips, search])

  const addOption = (val: string) => {
    if (!chips.includes(val)) onAddChip(val)
    setSearch("")
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 h-11 text-left transition-all hover:bg-muted/30",
          hasChips ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="flex-1 text-[12px] font-bold tracking-tight">{filter.label}</span>
        {hasChips && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">{chips.length}</span>}
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1.5 bg-muted/20">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border mb-3 focus-within:border-primary/50 transition-all">
            <Search className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={2.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Quick search...`}
              className="flex-1 bg-transparent text-[11px] font-bold text-foreground placeholder:text-muted-foreground/40 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  addOption(search.trim())
                }
              }}
            />
          </div>

          {hasChips && (
            <div className="mb-3">
              <div className="text-[9px] uppercase font-black tracking-widest mb-2 text-muted-foreground/50">Active</div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                  >
                    {c}
                    <button onClick={() => JSON.stringify(onRemoveChip(c))} className="opacity-60 hover:opacity-100">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-0.5">
              {filtered.map((opt) => (
                <button
                  key={opt}
                  onClick={() => addOption(opt)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 text-left text-[11px] font-bold text-foreground/70 rounded-lg hover:bg-card hover:text-primary transition-all group"
                >
                  <div className="w-4 h-4 rounded border border-border group-hover:border-primary/30 flex items-center justify-center shrink-0">
                    <Plus className="w-2.5 h-2.5 opacity-30 group-hover:opacity-100" />
                  </div>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {advOpts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors w-full"
              >
                <SlidersHorizontal className="w-3 h-3" strokeWidth={2.5} />
                <span>Advanced</span>
                {showAdvanced ? (
                  <ChevronUp className="w-3 h-3 ml-auto opacity-40" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-auto opacity-40" />
                )}
              </button>
              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  {advOpts.map((ao) => (
                    <label
                      key={ao.label}
                      className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-card cursor-pointer transition-all border border-transparent hover:border-border/50"
                    >
                      <input type="checkbox" className="mt-0.5 w-3.5 h-3.5 rounded border-muted accent-primary" />
                      <div>
                        <div className="text-[11px] font-black text-foreground/80">{ao.label}</div>
                        <div className="text-[9px] text-muted-foreground font-bold mt-0.5 leading-relaxed">{ao.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export default function PeoplePage() {
  const [view, setView] = useState<"nlp" | "results">("nlp")
  const [nlpQuery, setNlpQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new")
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    "Current title": true,
    "Seniority level": true,
  })
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    "Current title": ["VP Sales", "Head of Growth"],
    "Seniority level": ["VP", "C-suite"],
  })
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [activeSignals, setActiveSignals] = useState<Record<string, boolean>>({
    "Job change signal": false,
    "Promotion signal": false,
    "New hire signal": false,
  })
  const [pendingChange, setPendingChange] = useState(false)

  // Real Data State
  const [prospects, setProspects] = useState<ProspectProfile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const toggleFilter = (label: string) => setExpandedFilters((p) => ({ ...p, [label]: !p[label] }))
  const removeChip = (filter: string, chip: string) => {
    setFilterChips((p) => ({ ...p, [filter]: (p[filter] || []).filter((c) => c !== chip) }))
    setPendingChange(true)
  }
  const toggleRow = (id: string) => setSelectedRows((p) => ({ ...p, [id]: !p[id] }))
  const selectedCount = Object.values(selectedRows).filter(Boolean).length
  const activeFilterCount = Object.values(filterChips).filter((v) => v.length > 0).length
    + Object.values(activeSignals).filter(Boolean).length

  const handleSearch = async (query?: string) => {
    setIsLoading(true)
    setView("results")
    setPendingChange(false)
    try {
      const filters: ProspectSearchFilters = {
        keyword: query || nlpQuery || undefined,
        current_title: filterChips["Current title"]?.length ? filterChips["Current title"] : undefined,
        seniority_level: filterChips["Seniority level"]?.length ? filterChips["Seniority level"] : undefined,
        functions: filterChips["Function / department"]?.length ? filterChips["Function / department"] : undefined,
        location: filterChips["Location"]?.length ? filterChips["Location"] : undefined,
        company: filterChips["Company"]?.[0] || undefined,
        employees: filterChips["# Employees"]?.length ? filterChips["# Employees"] : undefined,
        // Signal filters — map toggle state to boolean
        recently_changed_jobs: activeSignals["Job change signal"] ? true : undefined,
        limit: 50,
      }
      const res = await searchProspects(filters)
      setProspects(res.profiles)
      setTotalCount(res.total_count)
    } catch (err) {
      toast.error("Failed to fetch prospects")
    } finally {
      setIsLoading(false)
    }
  }

  const exampleChips = ["VP Sales at Series A SaaS", "CRO in recently funded fintech", "Founders at AI startups (NY)", "RevOps leads using HubSpot"]

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Filter Sidebar */}
      <aside className="w-[260px] min-w-[260px] h-full flex flex-col bg-card border-r border-border shadow-sm">
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Search filters..."
              className="pl-9 h-9 bg-muted/40 border-transparent focus:bg-background transition-all text-xs font-medium rounded-lg"
            />
          </div>
        </div>

        <div className="flex border-b border-border px-2">
          {([
            ["total", "128K", "Total"],
            ["new", "2,847", "New"],
            ["saved", "12", "Saved"],
          ] as const).map(([key, num, label]) => (
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
              {activeTab === key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {(() => {
            const categories = [...new Set(unlockedFilters.map((f) => f.category))]
            return categories.map((cat) => (
              <div key={cat}>
                <div className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/30 mt-2">{cat}</div>
                {unlockedFilters
                  .filter((f) => f.category === cat)
                  .map((f) => (
                    <UnlockedFilterPanel
                      key={f.label}
                      filter={f}
                      isExpanded={!!expandedFilters[f.label]}
                      chips={filterChips[f.label] || []}
                      onToggle={() => toggleFilter(f.label)}
                      onAddChip={(val) => {
                setFilterChips((p) => ({ ...p, [f.label]: [...(p[f.label] || []), val] }))
                setPendingChange(true)
              }}
                      onRemoveChip={(chip) => removeChip(f.label, chip)}
                    />
                  ))}
              </div>
            ))
          })()}

          <div className="mx-4 my-4 border-t border-border/50" />

          {signalFilters.filter(f => f.label !== "Signals").map((f) => {
            const isActive = activeSignals[f.label]
            return (
              <div key={f.label} className="transition-all">
                <button
                  onClick={() => {
                    setActiveSignals(p => ({ ...p, [f.label]: !p[f.label] }))
                    setPendingChange(true)
                    // removed auto re-search; user should click Apply
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 h-11 text-left transition-all",
                    isActive ? "bg-orange-500/10" : "opacity-70 hover:opacity-100"
                  )}
                >
                  <Sparkles className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-orange-500" : "text-orange-500/30")} />
                  <span className={cn("flex-1 text-[12px] font-bold tracking-tight", isActive ? "text-orange-500" : "text-orange-500/70")}>
                    {f.label}
                  </span>
                  <div className={cn(
                    "w-8 h-4 rounded-full relative transition-all shrink-0",
                    isActive ? "bg-orange-500" : "bg-muted"
                  )}>
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all",
                      isActive ? "left-4" : "left-0.5"
                    )} />
                  </div>
                </button>
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
              <PopoverContent side="right" className="w-[240px] shadow-2xl rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold">Requires {f.tier}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium mb-3">
                  Find high-potential prospects using advanced {f.label.toLowerCase()} intelligence.
                </p>
                <Button className="w-full h-8 text-xs font-bold">Upgrade Now</Button>
              </PopoverContent>
            </Popover>
          ))}
        </div>

        <div className="flex flex-col gap-2 px-4 py-3 border-t border-border bg-card">
          {/* Apply filters CTA */}
          <button
            onClick={() => handleSearch()}
            className={cn(
              "w-full h-10 rounded-xl font-black text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg",
              pendingChange
                ? "bg-primary text-primary-foreground shadow-primary/30 animate-pulse"
                : "bg-primary text-primary-foreground shadow-primary/20 hover:bg-primary/90"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            Apply Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary-foreground/20 text-primary-foreground text-[9px] font-black px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Clear / Advanced row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setFilterChips({})
                setActiveSignals({ "Job change signal": false, "Promotion signal": false, "New hire signal": false })
                setPendingChange(true)
              }}
              className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] font-black">{activeFilterCount}</Badge>
              )}
            </button>
            <button className="text-[10px] font-black text-primary hover:underline">Advanced</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl">
            <Button variant="ghost" size="sm" className={cn("h-8 px-4 text-[11px] font-black uppercase tracking-wider rounded-lg", view === "results" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}>
              Find People
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/leads/companies"} className="h-8 px-4 text-[11px] font-black uppercase tracking-wider text-muted-foreground rounded-lg">
              Find Companies
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9 px-4 gap-2 text-[11px] font-bold border-border/50 hover:bg-muted transition-all">
              <Plus className="w-3.5 h-3.5" /> Save List
            </Button>
            <Button className="h-9 px-4 gap-2 text-[11px] font-black bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
              <Sparkles className="w-4 h-4" /> Research with AI
            </Button>
          </div>
        </div>

        {/* NLP Search Land */}
        {view === "nlp" && (
          <div className="flex-1 flex flex-col items-center justify-center px-8 bg-gradient-to-b from-background to-muted/10">
            <div className="w-full max-w-[720px] -mt-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-8 shadow-inner">
                <Bot className="w-8 h-8 text-primary" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-foreground mb-4">
                Who are you looking for today?
              </h1>
              <p className="text-muted-foreground font-medium text-sm mb-10 max-w-md mx-auto leading-relaxed opacity-60">
                 Search 128M+ decision makers worldwide across 20M+ companies with natural language.
              </p>

              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                <div className="relative flex items-center gap-2 p-3 rounded-2xl bg-card border border-border shadow-2xl focus-within:border-primary transition-all">
                  <Search className="w-5 h-5 ml-2 text-muted-foreground/30" />
                  <input
                    value={nlpQuery}
                    onChange={(e) => setNlpQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. VP Sales at Series A SaaS in US who changed jobs recently..."
                    className="flex-1 bg-transparent text-base font-bold text-foreground placeholder:text-muted-foreground/30 outline-none px-2"
                  />
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground/50 hover:bg-muted rounded-xl">
                    <Mic className="w-5 h-5" />
                  </Button>
                  <Button onClick={() => handleSearch()} className="h-11 px-6 font-black bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">
                    Search
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-8 opacity-80">
                {exampleChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => { setNlpQuery(chip); handleSearch(chip); }}
                    className="text-[11px] font-bold text-muted-foreground px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:text-primary transition-all shadow-sm"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Page */}
        {view === "results" && (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Stats Bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
               <div className="flex items-center gap-3">
                 <span className="text-[11px] font-bold text-foreground tracking-tight">
                   Found <span className="text-primary">{totalCount.toLocaleString()}</span> results
                 </span>
                 <Separator orientation="vertical" className="h-3" />
                 <span className="text-[10px] font-bold text-muted-foreground">
                   {activeFilterCount} active filters
                 </span>
               </div>
               <div className="flex items-center gap-3">
                 {selectedCount > 0 && <Badge className="font-bold">{selectedCount} Selected</Badge>}
                 <button className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
                   <Download className="w-3.5 h-3.5" /> Export CSV
                 </button>
                 <Button size="sm" className="h-8 px-4 font-black bg-indigo-500 text-white shadow-xl shadow-indigo-500/20">
                   <Zap className="w-3.5 h-3.5 fill-current mr-1.5" /> Run Outreach
                 </Button>
               </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto no-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead className="sticky top-0 z-20 bg-card/95 backdrop-blur-md">
                   <tr className="border-b border-border shadow-sm">
                     <th className="w-14 px-6 py-4">
                        <input type="checkbox" className="w-4 h-4 rounded-md accent-primary" />
                     </th>
                     {[
                       { label: "Person", w: "280px" },
                       { label: "Title", w: "220px" },
                       { label: "Company", w: "220px" },
                       { label: "Seniority", w: "130px" },
                       { label: "Location", w: "180px" },
                       { label: "Email", w: "140px" },
                       { label: "ICP Score", w: "120px" },
                       { label: "Intent", w: "100px" },
                       { label: "Action", w: "100px" }
                     ].map(h => (
                       <th key={h.label} className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50" style={{ width: h.w }}>
                         {h.label}
                       </th>
                     ))}
                   </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    Array.from({ length: 12 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                         <td className="px-6 py-5"><div className="w-4 h-4 rounded bg-muted mx-auto" /></td>
                         <td className="px-4 py-5"><div className="flex items-center gap-3.5"><div className="w-10 h-10 rounded-full bg-muted" /><div className="w-32 h-4 rounded bg-muted" /></div></td>
                         <td className="px-4 py-5"><div className="w-40 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-32 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-20 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-24 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-20 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-20 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-12 h-4 rounded bg-muted" /></td>
                         <td className="px-4 py-5"><div className="w-10 h-4 rounded bg-muted" /></td>
                      </tr>
                    ))
                  ) : (
                    prospects.map((p) => {
                       const employer = p.current_employers?.[0]
                       return (
                        <tr
                          key={p.person_id}
                          className={cn(
                            "group transition-all hover:bg-muted/30 border-l-2 border-transparent",
                            selectedRows[p.person_id] && "bg-primary/5 border-primary border-l-4"
                          )}
                          onClick={() => toggleRow(String(p.person_id))}
                        >
                          <td className="px-6 py-5 align-middle" onClick={e => e.stopPropagation()}>
                             <input
                               type="checkbox"
                               checked={!!selectedRows[p.person_id]}
                               onChange={() => toggleRow(String(p.person_id))}
                               className="w-4 h-4 rounded-md accent-primary"
                             />
                          </td>
                          <td className="px-4 py-5">
                             <div className="flex items-center gap-3.5">
                               <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-[10px] font-black shadow-sm shrink-0 overflow-hidden relative">
                                  {p.profile_picture_url ? (
                                    <img src={p.profile_picture_url} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <span className="opacity-40">{p.name.charAt(0)}</span>
                                  )}
                               </div>
                               <div className="min-w-0">
                                 <div className="text-[13px] font-black text-foreground hover:text-primary transition-colors cursor-pointer truncate">{p.name}</div>
                                 <div className="flex items-center gap-2 mt-0.5">
                                    <Linkedin className="w-3 h-3 text-[#0A66C2]" />
                                    <span className="text-[9px] text-muted-foreground font-bold tracking-tight opacity-50 truncate">{p.linkedin_profile_url.split('/in/')[1]}</span>
                                 </div>
                               </div>
                             </div>
                          </td>
                          <td className="px-4 py-5">
                             <span className="text-[11px] font-bold text-foreground/80 leading-relaxed block truncate">{p.headline}</span>
                          </td>
                          <td className="px-4 py-5">
                             <div className="flex items-center gap-2 max-w-[200px]">
                                <div className="w-6 h-6 rounded bg-card border border-border flex items-center justify-center shrink-0">
                                  <Building2 className="w-3 h-3 text-muted-foreground/40" />
                                </div>
                                <span className="text-[11px] font-bold text-foreground/80 truncate">{employer?.name || "Unknown"}</span>
                             </div>
                          </td>
                          <td className="px-4 py-5">
                             <Badge variant="outline" className="text-[9px] font-black bg-muted/30 border-border/50 uppercase tracking-widest">{p.seniority_level || "VP"}</Badge>
                          </td>
                          <td className="px-4 py-5">
                             <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 opacity-30 shrink-0" />
                                {p.location_details.city}, {p.location_details.country}
                             </div>
                          </td>
                          <td className="px-4 py-5">
                             <div className="flex items-center gap-1.5">
                                <Mail className={cn("w-3.5 h-3.5", p.emails?.length > 0 ? "text-green-500" : "text-muted-foreground/30")} />
                                <span className={cn("text-[10px] font-black uppercase tracking-widest", p.emails?.length > 0 ? "text-green-600" : "text-muted-foreground/50")}>
                                   {p.emails?.length > 0 ? "Verified" : "Missing"}
                                </span>
                             </div>
                          </td>
                          <td className="px-4 py-5">
                             {scoreBar(p._icpScore?.score || 85)}
                          </td>
                          <td className="px-4 py-5">
                             {intentDots(4)}
                          </td>
                          <td className="px-4 py-5 text-right">
                             <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                                  <Star className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                                  <ArrowRight className="w-4 h-4" />
                                </Button>
                             </div>
                          </td>
                        </tr>
                       )
                    })
                  )}
                </tbody>
              </table>
              
              {!isLoading && prospects.length > 0 && (
                <div className="p-8 flex justify-center border-t border-border bg-muted/5">
                  <Button variant="outline" className="h-11 px-10 rounded-xl font-bold text-xs gap-3 border-border/60 hover:border-primary hover:bg-primary/5 transition-all group">
                     Load more prospects
                     <ChevronDown className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
