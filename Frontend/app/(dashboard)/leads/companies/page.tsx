"use client"

import { useState, useEffect, useMemo } from "react"
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
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { leadsApi, type Lead } from "@/lib/api/leads"
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
}

const unlockedFilters: FilterDef[] = [
  { icon: "🏢", label: "Company", expanded: true, chips: ["Stripe", "Linear", "Attio"] },
  { icon: "🏷", label: "Industry & keywords", expanded: true, chips: ["SaaS"] },
  { icon: "👥", label: "# Employees" },
  { icon: "💵", label: "Revenue range" },
  { icon: "💰", label: "Funding stage", expanded: true, chips: ["Series A", "Series B"] },
  { icon: "⚙️", label: "Technologies" },
  { icon: "⚡", label: "Signals", signalRow: true },
  { icon: "📋", label: "Job postings" },
]

const lockedFilters: FilterDef[] = [
  { icon: "📈", label: "Headcount growth", locked: true, tier: "Growth" },
  { icon: "🎯", label: "Buying intent", locked: true, tier: "Growth" },
  { icon: "💡", label: "Intent topics", locked: true, tier: "Growth" },
  { icon: "👁", label: "Website visitors", locked: true, tier: "Growth" },
  { icon: "🤖", label: "AI filters", locked: true, tier: "Growth" },
  { icon: "⭐", label: "ICP fit score", locked: true, tier: "Growth" },
  { icon: "📊", label: "Scores (composite)", locked: true, tier: "Scale" },
  { icon: "🔗", label: "Company lookalikes", locked: true, tier: "Scale" },
  { icon: "🧠", label: "Composite GTM score", locked: true, tier: "Scale" },
  { icon: "🗂", label: "SIC and NAICS", locked: true, tier: "Growth" },
  { icon: "🗺", label: "Territories", locked: true, tier: "Scale" },
  { icon: "🏦", label: "Parent accounts", locked: true, tier: "Scale" },
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

export default function CompaniesPage() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new")
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    Company: true,
    "Industry & keywords": true,
    "Funding stage": true,
  })
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    Company: ["Stripe", "Linear", "Attio"],
    "Industry & keywords": ["SaaS"],
    "Funding stage": ["Series A", "Series B"],
  })
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")

  // Real Data State
  const [companies, setCompanies] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setIsLoading(true)
    try {
      const data = await leadsApi.getLeads({
        prompt: "",
        limit: 50
      })
      setCompanies(data)
    } catch (err) {
      toast.error("Failed to load companies")
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
            ["total", "Total", "4,847"],
            ["new", "Net New", "312"],
            ["saved", "Saved", "24"],
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
                  onClick={() => (f.chips ? toggleFilter(f.label) : undefined)}
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
                  {f.chips && (
                    isExpanded ? <ChevronUp className="w-3.5 h-3.5 opacity-40" /> : <ChevronDown className="w-3.5 h-3.5 opacity-40" />
                  )}
                </button>
                {isExpanded && hasChips && (
                  <div className="px-4 pb-3 pt-1 bg-muted/20">
                    <div className="flex flex-wrap gap-1.5">
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
          <button className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">
            Clear all · {activeFilterCount}
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
              placeholder="Search across 4.8M companies..."
              className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 h-5 px-1.5 font-sans text-[10px] font-bold text-muted-foreground bg-card border border-border rounded opacity-100">
               ⌘K
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

        {/* Stats & Results Summary */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-3">
             <span className="text-[11px] font-bold text-foreground tracking-tight">
               Found <span className="text-primary">{filteredCompanies.length.toLocaleString()}</span> results
             </span>
             <Separator orientation="vertical" className="h-3" />
             <span className="text-[10px] font-bold text-muted-foreground">
               312 net new this week
             </span>
          </div>
          <div className="flex items-center gap-3">
            {selectedCount > 0 && (
              <Badge className="bg-primary text-primary-foreground font-bold px-2.5 py-1 text-[10px] shadow-sm">
                {selectedCount} Selected
              </Badge>
            )}
            <button className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
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
                           {c.companyName.toLowerCase().replace(/\s+/g, '')}.ai
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
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">Series B</Badge>
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
                    {intentDots(4)}
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
        </div>
      </div>
    </div>
  )
}
