"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Search,
  Plus,
  RefreshCw,
  Flame,
  Users,
  Zap,
  Target,
  Linkedin,
  ExternalLink,
  Pause,
  Play,
  Trash2,
  Sparkles,
  Mail,
  Send,
  ArrowUpRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  fetchSearches,
  createSearch,
  updateSearch,
  deleteSearch,
  runSearchAndWait,
  fetchSignals,
  fetchStats,
  enrichSignal,
  signalOutreach,
  signalCrmPush,
  fetchIntegrations,
  getHubSpotAuthUrl,
  SIGNAL_TYPE_OPTIONS,
  SORT_OPTIONS,
  SINCE_OPTIONS,
  STRENGTH_OPTIONS,
  type SocialSearch,
  type SocialSignal,
  type SocialStats,
  type SignalFeedParams,
  type CreateSearchPayload,
  type IntegrationStatus,
} from "@/lib/social-listening"
import { CreateSearchWizard } from "./_components/create-search-wizard"

// ============================================================================
// Page
// ============================================================================

export default function SocialListeningPage() {
  const [searches, setSearches] = useState<SocialSearch[]>([])
  const [signals, setSignals] = useState<SocialSignal[]>([])
  const [stats, setStats] = useState<SocialStats | null>(null)
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null)
  const [feedParams, setFeedParams] = useState<SignalFeedParams>({
    sort: "intent",
    since: "all",
    signal_type: "all",
  })
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, st] = await Promise.all([fetchSearches(), fetchStats()])
      setSearches(s)
      setStats(st)
    } catch {
      // Auth not ready or backend unavailable — page renders with empty state
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSignals = useCallback(async () => {
    const params: SignalFeedParams = { ...feedParams }
    if (activeSearchId) params.search_id = activeSearchId
    const sigs = await fetchSignals(params)
    setSignals(sigs)
  }, [feedParams, activeSearchId])

  useEffect(() => {
    setMounted(true)
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (mounted) loadSignals()
  }, [mounted, loadSignals])

  const handleCreateSearch = async (payload: CreateSearchPayload) => {
    const s = await createSearch(payload)
    setSearches((prev) => [s, ...prev])
    setActiveSearchId(s.id)
    setShowCreateDialog(false)
    // Auto-run the search immediately after creation
    handleRunNow(s.id)
  }

  const handleRunNow = async (id: string) => {
    setRunning(id)
    try {
      // Auto-resume paused searches so the run button always works.
      const search = searches.find((s) => s.id === id)
      if (search?.status === "paused") {
        const resumed = await updateSearch(id, { status: "active" })
        setSearches((prev) => prev.map((s) => (s.id === id ? resumed : s)))
      }
      // Background run — survives tab close.  Polls for completion every 3s.
      const updated = await runSearchAndWait(id, {
        onProgress: (s) => {
          if (s.status === "running" || s.status === "queued") {
            // Keep the running indicator visible; could expose s.leads_count later.
          }
        },
      })
      setSearches((prev) => prev.map((s) => (s.id === id ? updated : s)))
      await Promise.all([loadSignals(), fetchStats().then(setStats)])
    } catch {
      // Silently handle — the UI already shows the running state reset.
    } finally {
      setRunning(null)
    }
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active"
    const updated = await updateSearch(id, { status: newStatus })
    setSearches((prev) => prev.map((s) => (s.id === id ? updated : s)))
  }

  const handleDelete = async (id: string) => {
    await deleteSearch(id)
    setSearches((prev) => prev.filter((s) => s.id !== id))
    if (activeSearchId === id) setActiveSearchId(null)
  }

  const handleRefresh = async () => {
    await Promise.all([loadSignals(), fetchStats().then(setStats)])
  }

  if (!mounted) return null

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0">
      {/* Left Rail */}
      <SearchSidebar
        searches={searches}
        activeSearchId={activeSearchId}
        runningId={running}
        onSelect={(id) => setActiveSearchId(activeSearchId === id ? null : id)}
        onRunNow={handleRunNow}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onCreate={() => setShowCreateDialog(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <KPIRow stats={stats} />
        <FilterBar
          params={feedParams}
          onChange={(p) => setFeedParams({ ...feedParams, ...p })}
          onRefresh={handleRefresh}
          onRunNow={activeSearchId ? () => handleRunNow(activeSearchId) : undefined}
          activeSearchName={
            activeSearchId
              ? searches.find((s) => s.id === activeSearchId)?.name ?? "All Searches"
              : "All Searches"
          }
          totalResults={signals.length}
          isRunning={!!running}
        />
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="animate-spin mr-2 size-5" />
                Loading signals...
              </div>
            ) : signals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Search className="size-10 mb-3 opacity-30" />
                <p className="text-lg font-medium">No signals yet</p>
                <p className="text-sm mt-1">
                  {searches.length === 0
                    ? "Create a search to start monitoring"
                    : "Run a search to discover signals"}
                </p>
              </div>
            ) : (
              signals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  expanded={expandedSignal === signal.id}
                  onToggle={() =>
                    setExpandedSignal(expandedSignal === signal.id ? null : signal.id)
                  }
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {showCreateDialog && (
        <CreateSearchWizard
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreateSearch}
        />
      )}
    </div>
  )
}

// ============================================================================
// Search Sidebar
// ============================================================================

function SearchSidebar({
  searches,
  activeSearchId,
  runningId,
  onSelect,
  onRunNow,
  onToggle,
  onDelete,
  onCreate,
}: {
  searches: SocialSearch[]
  activeSearchId: string | null
  runningId: string | null
  onSelect: (id: string) => void
  onRunNow: (id: string) => void
  onToggle: (id: string, status: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  const totalSignals = searches.reduce((s, w) => s + w.total_signals, 0)
  return (
    <div className="w-72 border-r flex flex-col bg-card/50">
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">Social Listening</h2>
        <Button size="icon" className="size-8 rounded-full" onClick={onCreate}>
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="p-3 border-b">
        <div
          className={cn(
            "rounded-lg px-3 py-2.5 cursor-pointer transition-colors",
            !activeSearchId ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
          )}
          onClick={() => onSelect("")}
        >
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <span className="font-medium text-sm">All searches</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {searches.length} active · {totalSignals} signals
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1.5">
          {searches.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group rounded-lg px-3 py-2.5 cursor-pointer transition-all border",
                activeSearchId === s.id
                  ? "bg-primary/5 border-primary/40"
                  : "border-transparent hover:bg-muted hover:border-border/60"
              )}
              onClick={() => onSelect(s.id)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Linkedin className="size-3.5 text-blue-400 shrink-0" />
                    <p className="font-medium text-sm truncate">{s.name}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-green-400 inline-block" />
                      {s.schedule === "manual" ? "Manual" : s.schedule}
                    </span>
                    <span className="font-medium text-foreground/80">{s.total_signals} signals</span>
                    <span>{s.enriched_signals} enriched</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {s.keywords.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    className={cn("p-1 rounded hover:bg-primary/20", runningId === s.id ? "text-primary" : "text-muted-foreground hover:text-primary")}
                    title={runningId === s.id ? "Running..." : "Run now"}
                    onClick={(e) => { e.stopPropagation(); if (runningId !== s.id) onRunNow(s.id) }}
                  >
                    {runningId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                  </button>
                  <button
                    className="p-1 rounded hover:bg-muted-foreground/20"
                    title={s.status === "active" ? "Pause" : "Resume"}
                    onClick={(e) => { e.stopPropagation(); onToggle(s.id, s.status) }}
                  >
                    {s.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </button>
                  <button
                    className="p-1 rounded hover:bg-destructive/20 hover:text-destructive"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ============================================================================
// KPI Row
// ============================================================================

function KPIRow({ stats }: { stats: SocialStats | null }) {
  const cards = [
    { label: "Total Signals", value: stats?.total_signals ?? 0, delta: stats ? `${stats.total_signals_delta_pct >= 0 ? "+" : ""}${stats.total_signals_delta_pct}%` : "", positive: (stats?.total_signals_delta_pct ?? 0) >= 0, icon: Zap, color: "text-violet-400" },
    { label: "Enriched Contacts", value: stats?.enriched_contacts ?? 0, delta: stats ? `${stats.enriched_contacts_delta_pct >= 0 ? "+" : ""}${stats.enriched_contacts_delta_pct}%` : "", positive: (stats?.enriched_contacts_delta_pct ?? 0) >= 0, icon: Users, color: "text-emerald-400" },
    { label: "Hot Intent Leads", value: stats?.hot_intent_leads ?? 0, delta: stats ? `+${stats.hot_intent_leads_delta} today` : "", positive: true, icon: Flame, color: "text-orange-400" },
    { label: "Active Searches", value: stats?.active_searches ?? 0, delta: stats ? `${stats.running_searches} running` : "", positive: true, icon: Target, color: "text-sky-400" },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 p-4 pb-0">
      {cards.map((c) => (
        <Card key={c.label} className="border-border/60">
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div>
              <p className="text-3xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              {c.delta && (
                <p className={cn("text-xs font-medium mt-0.5", c.positive ? "text-emerald-400" : "text-red-400")}>{c.delta}</p>
              )}
            </div>
            <c.icon className={cn("size-8 opacity-40", c.color)} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================================
// Filter Bar + Activity Tabs
// ============================================================================

function FilterBar({
  params,
  onChange,
  onRefresh,
  onRunNow,
  activeSearchName,
  totalResults,
  isRunning,
}: {
  params: SignalFeedParams
  onChange: (p: Partial<SignalFeedParams>) => void
  onRefresh: () => void
  onRunNow?: () => void
  activeSearchName: string
  totalResults: number
  isRunning?: boolean
}) {
  return (
    <div className="px-4 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-base">{activeSearchName}</h3>
          <Badge variant="secondary" className="text-xs">{totalResults} results</Badge>
        </div>
        <div className="flex items-center gap-2">
          <select value={params.sort || "intent"} onChange={(e) => onChange({ sort: e.target.value as any })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={params.since || "all"} onChange={(e) => onChange({ since: e.target.value as any })} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {SINCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={params.strength || "all"}
            onChange={(e) => onChange({ strength: e.target.value === "all" ? undefined : e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {STRENGTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => onChange({ enriched_only: !params.enriched_only })}
            className={cn(
              "h-9 px-3 rounded-md text-sm font-medium border transition-colors whitespace-nowrap",
              params.enriched_only
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "border-input bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Mail className="size-3.5 inline-block mr-1.5 -mt-0.5" />
            Enriched only
          </button>
          <button
            onClick={() => onChange({ hot_only: !params.hot_only })}
            className={cn(
              "h-9 px-3 rounded-md text-sm font-medium border transition-colors whitespace-nowrap",
              params.hot_only
                ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                : "border-input bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Flame className="size-3.5 inline-block mr-1.5 -mt-0.5" />
            Hot leads
          </button>
          {onRunNow && (
            <Button size="sm" onClick={onRunNow} disabled={isRunning}>
              {isRunning ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="size-3.5 mr-1.5" />}
              {isRunning ? "Running..." : "Run Search"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex gap-1 border-b pb-1">
        {SIGNAL_TYPE_OPTIONS.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange({ signal_type: t.value })}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              (params.signal_type ?? "all") === t.value
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Signal Card
// ============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  "Sales-Led": "bg-blue-500/15 text-blue-400",
  "Product-Led": "bg-emerald-500/15 text-emerald-400",
  "Community-Led": "bg-violet-500/15 text-violet-400",
  "Competitor": "bg-red-500/15 text-red-400",
  "System": "bg-cyan-500/15 text-cyan-400",
  "Event": "bg-pink-500/15 text-pink-400",
  "Partner": "bg-orange-500/15 text-orange-400",
}

function SignalCard({ signal, expanded, onToggle }: { signal: SocialSignal; expanded: boolean; onToggle: () => void }) {
  const signalName = signal.signal_type?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Activity"
  const category = signal.signal_category || "Sales-Led"
  const activityColor = CATEGORY_COLORS[category] || "bg-muted text-muted-foreground"
  const initials = (signal.person_name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  const ago = signal.discovered_at ? formatTimeAgo(new Date(signal.discovered_at).getTime()) : ""

  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(!!signal.person_email)
  const [outreachLoading, setOutreachLoading] = useState(false)
  const [outreachDraft, setOutreachDraft] = useState<string | null>(signal.outreach_message || null)
  const [crmLoading, setCrmLoading] = useState(false)
  const [crmResult, setCrmResult] = useState<string | null>(null)

  const handleEnrich = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (revealed) return
    setEnriching(true)
    try {
      const res = await enrichSignal(signal.id)
      if (res?.email) {
        signal.person_email = res.email
        signal.person_email_verified = !res.email_unverified
      }
      setRevealed(true)
      setEnrichResult(res?.status === "already_enriched" ? "Already enriched" : res?.email ? `Found: ${res.email}` : "No email found")
    } catch { setEnrichResult("Failed") }
    finally { setEnriching(false); setTimeout(() => setEnrichResult(null), 5000) }
  }

  const handleOutreach = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (outreachDraft) { onToggle(); return }
    setOutreachLoading(true)
    try {
      const res = await signalOutreach(signal.id)
      const msg = res?.message || res?.error || "No outreach draft available — LLM may be unavailable."
      setOutreachDraft(msg)
      if (!expanded) onToggle()
    } catch { setOutreachDraft("Failed to generate outreach draft.") }
    finally { setOutreachLoading(false) }
  }

  const handleCrm = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setCrmLoading(true)
    try {
      const res = await signalCrmPush(signal.id)
      if (res?.status === "not_connected" && res?.auth_url) {
        window.open(res.auth_url, "_blank", "width=600,height=700")
        setCrmResult("Connect HubSpot to push contacts")
      } else if (res?.status === "not_connected") {
        const authUrl = await getHubSpotAuthUrl()
        if (authUrl) window.open(authUrl, "_blank", "width=600,height=700")
        setCrmResult("Connect HubSpot first")
      } else if (res?.status === "skipped") {
        setCrmResult(res.note || "Enrich first — no email")
      } else {
        setCrmResult(res?.note || "Pushed to HubSpot")
      }
      setTimeout(() => setCrmResult(null), 4000)
    } catch { setCrmResult("CRM push failed") }
    finally { setCrmLoading(false) }
  }

  return (
    <Card className={cn("border-border/60 transition-all cursor-pointer hover:border-primary/30", expanded && "border-primary/50 ring-1 ring-primary/20")} onClick={onToggle}>
      <CardContent className="py-4 px-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">{initials}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{signal.person_name || "Unknown"}</span>
                {signal.person_linkedin && <Linkedin className="size-3.5 text-blue-400" />}
                <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", activityColor)}>
                  {signalName}
                </Badge>
                {signal.signal_strength && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    signal.signal_strength === "High" ? "bg-red-500/15 text-red-400" :
                    signal.signal_strength === "Medium" ? "bg-amber-500/15 text-amber-400" :
                    "bg-slate-500/15 text-slate-400"
                  )}>
                    {signal.signal_strength}
                  </span>
                )}
                {signal.intent_score != null && <IntentBadge score={signal.intent_score} tier={signal.intent_tier} />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {signal.person_title}{signal.person_title && signal.person_company && " · "}
                <span className="font-medium text-foreground/80">{signal.person_company}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{ago}</span>
                {signal.matched_search_names.map((name) => (
                  <Badge key={name} variant="secondary" className="text-[10px] px-1.5 py-0">{name}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {signal.post_snippet && (
          <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3">
            {signal.post_snippet}
            {signal.post_url && (
              <a href={signal.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary text-xs ml-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                Read more <ArrowUpRight className="size-3" />
              </a>
            )}
          </p>
        )}

        {signal.best_hook && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
            <strong>Hook:</strong> {signal.best_hook}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {revealed && signal.person_email ? (
              <span className="flex items-center gap-1">
                <Mail className="size-3" />{signal.person_email}
                {!signal.person_email_verified && <span className="text-[10px] text-amber-400">(unverified)</span>}
              </span>
            ) : revealed ? (
              <span className="text-muted-foreground/60">no email found</span>
            ) : (
              <button
                onClick={handleEnrich}
                disabled={enriching}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                {enriching ? <Loader2 className="size-3 animate-spin" /> : <Mail className="size-3" />}
                <span className="text-xs font-medium">{enriching ? "Revealing..." : "Reveal contact · 2cr"}</span>
              </button>
            )}
            {enrichResult && <span className="text-[10px] text-emerald-400 ml-2">{enrichResult}</span>}
            {crmResult && <span className="text-[10px] text-sky-400 ml-2">{crmResult}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs text-foreground hover:text-foreground" onClick={handleOutreach} disabled={outreachLoading}>
              {outreachLoading ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Send className="size-3 mr-1" />}Outreach
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs text-foreground hover:text-foreground" onClick={handleCrm} disabled={crmLoading}>
              {crmLoading ? <Loader2 className="size-3 mr-1 animate-spin" /> : <ArrowUpRight className="size-3 mr-1" />}CRM
            </Button>
            {signal.post_url && (
              <a href={signal.post_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted" onClick={(e) => e.stopPropagation()} title="View post">
                <ExternalLink className="size-3.5 text-muted-foreground hover:text-foreground" />
              </a>
            )}
            {revealed && signal.person_linkedin && (
              <a href={signal.person_linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted" onClick={(e) => e.stopPropagation()} title="View LinkedIn profile">
                <Linkedin className="size-3.5 text-blue-400 hover:text-blue-300" />
              </a>
            )}
          </div>
        </div>

        {expanded && outreachDraft && (
          <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-border/60">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">AI Outreach Draft</p>
              <button className="text-xs text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(outreachDraft || "") }}>
                Copy
              </button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{outreachDraft}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function IntentBadge({ score, tier }: { score: number; tier: string }) {
  const colors: Record<string, string> = {
    hot: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    warm: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    cold: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", colors[tier] || colors.cold)}>
      {(tier === "hot" || tier === "warm") && <Flame className="size-3" />}
      {tier.charAt(0).toUpperCase() + tier.slice(1)} · {score}
    </span>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(epochMs: number): string {
  const diff = Date.now() - epochMs
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(epochMs).toLocaleDateString()
}
