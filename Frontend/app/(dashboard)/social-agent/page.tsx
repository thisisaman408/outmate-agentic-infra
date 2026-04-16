"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Search, Filter, Plus, Clock,
  RefreshCw, X, ChevronDown, TrendingUp,
  Users, Zap, Eye, Share2, Briefcase, Bell,
  BarChart3, ArrowUpRight, Flame, Target, UserPlus, Send,
  Activity, Mail, Shield, Layers
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  fetchSearches, fetchSignals, fetchStats, createSearch, enrichSignal, signalOutreach,
  SocialSearch, SocialSignal, SocialStats, SignalFeedParams
} from "@/lib/social-listening"

/* ─── types ─── */
interface SavedSearch {
  id: string
  name: string
  platform: "linkedin" | "x"
  frequency: string
  updatedAt: string
  keywords: string[]
  paused?: boolean
  matchCount?: number
  enrichedCount?: number
}

const SIGNAL_CATEGORIES = [
  "All Signals", "Sales-Led", "Product-Led", "Community-Led",
  "Competitor", "Technographic", "Event", "Partner"
] as const

const INTENT_OPTIONS = ["Highest Intent", "High Intent", "All Intent"] as const
const TIME_OPTIONS = ["Anytime", "Today", "This Week", "This Month"] as const
const STRENGTH_OPTIONS = ["All Strength", "High", "Medium", "Low"] as const

const SORT_OPTIONS = [
  { label: "Most Recent", value: "recent" as const },
  { label: "Highest Intent", value: "intent" as const },
  { label: "Most Engagement", value: "engagement" as const },
]

export default function SocialAgentPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [signals, setSignals] = useState<SocialSignal[]>([])
  const [stats, setStats] = useState<SocialStats>({
    total_signals: 0, total_signals_delta_pct: 0,
    enriched_contacts: 0, enriched_contacts_delta_pct: 0,
    hot_intent_leads: 0, hot_intent_leads_delta: 0,
    active_searches: 0, running_searches: 0,
  })
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)
  const [view, setView] = useState<"feed" | "builder">("feed")
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newSearchName, setNewSearchName] = useState("")
  const [newSearchKeywords, setNewSearchKeywords] = useState("")

  // Filters
  const [activeCategory, setActiveCategory] = useState("All Signals")
  const [intentFilter, setIntentFilter] = useState<typeof INTENT_OPTIONS[number]>("Highest Intent")
  const [timeFilter, setTimeFilter] = useState<typeof TIME_OPTIONS[number]>("Anytime")
  const [strengthFilter, setStrengthFilter] = useState<typeof STRENGTH_OPTIONS[number]>("All Strength")
  const [enrichedOnly, setEnrichedOnly] = useState(false)
  const [hotOnly, setHotOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"recent" | "intent" | "engagement">("recent")
  const [enrichingId, setEnrichingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [searchData, statsData] = await Promise.all([fetchSearches(), fetchStats()])
      setSearches(searchData.map(s => ({
        id: s.id, name: s.name, platform: "linkedin" as const,
        frequency: s.schedule,
        updatedAt: s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "Never",
        keywords: s.keywords, paused: s.status === "paused",
        matchCount: s.total_signals, enrichedCount: s.enriched_signals
      })))
      setStats(statsData)
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSignals = useCallback(async () => {
    const params: SignalFeedParams = {
      search_id: selectedSearchId || undefined,
      signal_type: activeCategory === "All Signals" ? undefined : activeCategory,
      sort: sortBy,
      limit: 50,
      enriched_only: enrichedOnly || undefined,
      hot_only: hotOnly || undefined,
      strength: strengthFilter === "All Strength" ? undefined : strengthFilter,
      since: timeFilter === "Anytime" ? undefined
        : timeFilter === "Today" ? "today"
        : timeFilter === "This Week" ? "week"
        : timeFilter === "This Month" ? "month" : undefined,
      min_intent: intentFilter === "Highest Intent" ? 80
        : intentFilter === "High Intent" ? 60 : undefined,
    }
    try {
      const data = await fetchSignals(params)
      setSignals(data)
    } catch (error) {
      console.error("Failed to load signals:", error)
    }
  }, [selectedSearchId, activeCategory, sortBy, enrichedOnly, hotOnly, strengthFilter, timeFilter, intentFilter])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadSignals() }, [loadSignals])

  async function handleCreateSearch() {
    if (!newSearchName.trim() || !newSearchKeywords.trim()) return
    setCreating(true)
    try {
      const keywords = newSearchKeywords.split(',').map(k => k.trim()).filter(k => k)
      await createSearch({ name: newSearchName, keywords, schedule: "daily", max_leads: 10, source: "linkedin_posts" })
      setNewSearchName(""); setNewSearchKeywords("")
      await loadAll()
      setView('feed')
    } catch (error) {
      console.error("Failed to create search:", error)
    } finally {
      setCreating(false)
    }
  }

  async function handleEnrich(signalId: string) {
    setEnrichingId(signalId)
    try {
      await enrichSignal(signalId)
      await loadSignals()
      await fetchStats().then(setStats)
    } catch (e) { console.error("Enrich failed:", e) }
    finally { setEnrichingId(null) }
  }

  async function handleRefresh() {
    setLoading(true)
    await Promise.all([loadAll(), loadSignals()])
    setLoading(false)
  }

  const statCards = [
    { label: "Total Signals", value: stats.total_signals, delta: `${stats.total_signals_delta_pct >= 0 ? '+' : ''}${stats.total_signals_delta_pct}%`, icon: Activity, color: "text-indigo-500 bg-indigo-500/10" },
    { label: "Enriched Contacts", value: stats.enriched_contacts, delta: `${stats.enriched_contacts_delta_pct >= 0 ? '+' : ''}${stats.enriched_contacts_delta_pct}%`, icon: Mail, color: "text-emerald-500 bg-emerald-500/10" },
    { label: "Hot Intent Leads", value: stats.hot_intent_leads, delta: `+${stats.hot_intent_leads_delta} today`, icon: Flame, color: "text-orange-500 bg-orange-500/10" },
    { label: "Active Searches", value: stats.active_searches, delta: `${stats.running_searches} running`, icon: Search, color: "text-blue-500 bg-blue-500/10" },
  ]

  return (
    <div className="flex h-full bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] border-r border-border bg-card flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground">All Searches</h2>
          <Button onClick={() => setView('builder')} variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-primary/10 text-primary">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
            <Input placeholder="Filter searches..." className="pl-9 h-9 text-[11px] font-medium bg-muted/20 border-border/50 rounded-xl" />
          </div>
        </div>
        <div className="px-3 pb-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
          {searches.length} results
        </div>
        <div className="flex-1 overflow-auto no-scrollbar px-3 space-y-1">
          {searches.map(s => (
            <button
              key={s.id}
              onClick={() => { setSelectedSearchId(s.id); setView('feed') }}
              className={cn("w-full text-left p-3 rounded-2xl border transition-all group",
                selectedSearchId === s.id && view === 'feed' ? "bg-primary/5 border-primary/20" : "bg-transparent border-transparent hover:bg-muted/30")}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {s.platform === 'linkedin'
                    ? <div className="w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center text-[10px] text-white font-bold">in</div>
                    : <div className="w-5 h-5 rounded bg-black flex items-center justify-center text-[10px] text-white font-bold">𝕏</div>}
                  <span className={cn("text-[11px] font-black uppercase tracking-tight truncate max-w-[130px]", selectedSearchId === s.id ? "text-primary" : "text-foreground")}>{s.name}</span>
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase border-border/50 text-muted-foreground/40">{s.frequency}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-muted-foreground/40">{s.matchCount} Signals</span>
                <span className="text-[10px] font-bold text-emerald-500">{s.enrichedCount} Enriched</span>
              </div>
            </button>
          ))}
          {searches.length === 0 && !loading && (
            <div className="text-center py-8 text-[11px] text-muted-foreground/40">No searches yet</div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-muted/5">
        {view === 'feed' ? (
          <>
            {/* Stats Cards */}
            <div className="px-6 pt-5 pb-3">
              <div className="grid grid-cols-4 gap-4">
                {statCards.map(card => (
                  <div key={card.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.color)}>
                      <card.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                        <span className="text-[9px] font-bold text-emerald-500">{card.delta}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3 flex items-center gap-2 flex-wrap">
              {/* Intent dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1 border-border/50">
                    {intentFilter} <ChevronDown className="w-3 h-3 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="start">
                  {INTENT_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setIntentFilter(opt)}
                      className={cn("w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50", intentFilter === opt && "bg-primary/10 text-primary font-bold")}>
                      {opt}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Time dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1 border-border/50">
                    {timeFilter} <ChevronDown className="w-3 h-3 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1" align="start">
                  {TIME_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setTimeFilter(opt)}
                      className={cn("w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50", timeFilter === opt && "bg-primary/10 text-primary font-bold")}>
                      {opt}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Strength dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1 border-border/50">
                    {strengthFilter} <ChevronDown className="w-3 h-3 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40 p-1" align="start">
                  {STRENGTH_OPTIONS.map(opt => (
                    <button key={opt} onClick={() => setStrengthFilter(opt)}
                      className={cn("w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50", strengthFilter === opt && "bg-primary/10 text-primary font-bold")}>
                      {opt}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Separator orientation="vertical" className="h-5 mx-1" />

              {/* Toggle filters */}
              <Button variant={enrichedOnly ? "default" : "outline"} size="sm"
                onClick={() => setEnrichedOnly(!enrichedOnly)}
                className={cn("h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider border-border/50", enrichedOnly && "bg-emerald-500 hover:bg-emerald-600 border-emerald-500")}>
                Enriched only
              </Button>
              <Button variant={hotOnly ? "default" : "outline"} size="sm"
                onClick={() => setHotOnly(!hotOnly)}
                className={cn("h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider border-border/50", hotOnly && "bg-orange-500 hover:bg-orange-600 border-orange-500")}>
                Hot leads
              </Button>

              <div className="flex-1" />

              {/* Refresh */}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}
                className="h-8 rounded-xl text-[10px] font-bold uppercase tracking-wider gap-1 border-border/50">
                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> Refresh
              </Button>
            </div>

            {/* Signal Category Tabs */}
            <div className="px-6 pb-3">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {SIGNAL_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    )}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal Feed */}
            <div className="flex-1 overflow-auto px-6 pb-6 space-y-4 no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground/40" />
                </div>
              ) : signals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/10 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground/50">No signals yet</p>
                  <p className="text-xs text-muted-foreground/30 mt-1">Create a search to start monitoring</p>
                </div>
              ) : (
                signals.map(signal => (
                  <div key={signal.id} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/20 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-sm font-black text-primary">
                          {signal.person_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'NA'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[13px] font-bold text-foreground">{signal.person_name || 'Unknown'}</h3>
                            <div className="w-4 h-4 rounded bg-[#0A66C2] flex items-center justify-center text-[8px] text-white font-bold">in</div>
                            {signal.signal_category && (
                              <Badge variant="secondary" className="text-[9px]">{signal.signal_category}</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {signal.person_title || 'Unknown'} @ <span className="text-primary font-medium">{signal.person_company || 'Unknown'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {signal.intent_score != null && signal.intent_score >= 80 && (
                          <div className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                            <Flame className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Hot · {signal.intent_score}</span>
                          </div>
                        )}
                        {signal.intent_score != null && signal.intent_score >= 60 && signal.intent_score < 80 && (
                          <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            <TrendingUp className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Warm · {signal.intent_score}</span>
                          </div>
                        )}
                        {signal.signal_strength && (
                          <Badge variant="outline" className="text-[8px] uppercase">{signal.signal_strength}</Badge>
                        )}
                        <span className="text-[9px] text-muted-foreground/40">{new Date(signal.discovered_at).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="text-[12px] text-foreground/80 leading-relaxed mb-4">
                      {signal.post_snippet || signal.best_hook || 'No content available'}
                    </div>

                    {signal.match_factors?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {signal.match_factors.map((f, i) => (
                          <Badge key={i} variant="outline" className="text-[9px] border-border/50 text-muted-foreground/60">{f}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        {signal.matched_search_names?.map(name => (
                          <Badge key={name} variant="outline" className="text-[9px] font-bold border-border/50 text-muted-foreground/40">{name}</Badge>
                        ))}
                        {signal.funnel_stage && (
                          <Badge variant="secondary" className="text-[9px]">{signal.funnel_stage}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {signal.person_email ? (
                          <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 bg-emerald-50">
                            <Mail className="w-3 h-3 mr-1" />{signal.person_email}
                          </Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleEnrich(signal.id)}
                            disabled={enrichingId === signal.id}
                            className="h-7 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1 text-primary border-primary/20 bg-primary/5">
                            {enrichingId === signal.id
                              ? <><RefreshCw className="w-3 h-3 animate-spin" />Enriching...</>
                              : <><UserPlus className="w-3 h-3" />Enrich Contact</>}
                          </Button>
                        )}
                        {signal.person_linkedin && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-[#0A66C2]" asChild>
                            <a href={signal.person_linkedin} target="_blank" rel="noopener noreferrer">
                              <Share2 className="w-3.5 h-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm"
                          className="h-7 rounded-lg text-[10px] font-bold uppercase tracking-wider gap-1">
                          <Send className="w-3 h-3" /> Draft Outreach
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
            <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mb-8">
              <Target className="w-10 h-10 text-primary" strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-black tracking-tighter text-foreground mb-4">Signal Intelligence Builder</h1>
            <p className="max-w-md text-[13px] font-medium text-muted-foreground/60 leading-relaxed mb-12">
              Configure your autonomous social listening agent to identify high-intent prospects based on real-time activity across LinkedIn and X.
            </p>

            <div className="w-full max-w-xl mx-auto space-y-4">
              <div className="bg-card border border-border rounded-3xl p-8 shadow-xl shadow-black/[0.02]">
                <div className="space-y-6 text-left">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Agent Name</label>
                    <Input
                      value={newSearchName}
                      onChange={(e) => setNewSearchName(e.target.value)}
                      placeholder="e.g. Founder Intent Radar"
                      className="h-12 text-sm font-medium bg-muted/20 border-border/50 rounded-2xl px-5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Keywords to Monitor</label>
                    <Input
                      value={newSearchKeywords}
                      onChange={(e) => setNewSearchKeywords(e.target.value)}
                      placeholder="e.g. hiring, series A, struggling with enrichment"
                      className="h-12 text-sm font-medium bg-muted/20 border-border/50 rounded-2xl px-5"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <Button onClick={() => setView('feed')} variant="ghost" className="flex-1 h-14 rounded-3xl text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 border border-border">Cancel</Button>
                <Button
                  onClick={handleCreateSearch}
                  disabled={creating || !newSearchName.trim() || !newSearchKeywords.trim()}
                  className="flex-1 h-14 rounded-3xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all border-none"
                >
                  {creating ? 'Creating...' : 'Launch Agent'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
