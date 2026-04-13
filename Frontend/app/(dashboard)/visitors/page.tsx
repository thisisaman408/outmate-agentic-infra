"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Search,
  Code,
  Bell,
  Download,
  Star,
  X,
  Lock,
  Eye,
  ExternalLink,
  Linkedin,
  Sparkles,
  GitBranch,
  ListPlus,
  Building2,
  Users,
  Activity,
  Radar,
  Globe,
  Flame,
  Plus,
  PieChart,
  BarChart3,
  Clock,
  Check,
  Trash2,
  Coins,
  MapPin,
  Target,
  Mail,
  Phone,
  Play,
  SlidersHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import EnrichmentModal from "@/components/visitors/enrichment-modal"
import { cn } from "@/lib/utils"

// ── UTILS & CONSTANTS ───────────────────────────────────────────
const PERIODS = [
  { label: "Today", hours: 24 },
  { label: "7 Days", hours: 168 },
  { label: "30 Days", hours: 720 },
] as const
type PeriodHours = (typeof PERIODS)[number]["hours"]

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
const API = "/api/v1/visitors"

const PIXEL_HOST =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "https://app.outmate.ai"

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("outmate_auth_token") : null
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const intentColor: Record<string, string> = { Hot: "#EF4444", Warm: "#F59E0B", Cold: "#9CA3AF" }

// ── TYPES ────────────────────────────────────────────────────────
interface Visit {
  id: string
  ip: string
  url: string
  referrer: string
  intent_score: number
  matched: boolean
  created_at: string
  resolution: any
  category: string | null
  company: string | null
  domain: string | null
  website: string | null
  geo: { city: string; region: string; country: string } | null
  confidence: number
  email: string | null
  phone: string | null
  full_name: string | null
  linkedin_url: string | null
  job_title: string | null
  company_linkedin_url: string | null
  industry: string | null
  employee_count_range: string | null
  employee_count_exact: number | null
  revenue_range: string | null
  funding_stage: string | null
  technologies: string[]
  headquarters_city: string | null
  headquarters_country: string | null
  description: string | null
  source_site: string | null
  enrichment_status: "pending" | "processing" | "done" | "failed" | null
}

interface VisitorAnalytics {
  window: { hours: number; since: string; use_daily: boolean }
  live: { window_minutes: number; unique_ips: number }
  summary: { total: number; matched: number; companies: number; prospects: number; match_rate: number; bounce_rate?: number; total_sessions?: number; conversions?: number }
  timeseries: Array<{
    bucket: string
    total: number
    matched: number
    company: number
    prospect: number
    unknown: number
  }>
  top_pages: Array<{ page: string; count: number }>
  top_referrers: Array<{ referrer: string; count: number }>
  intent_distribution: Array<{ bucket: string; count: number }>
  geo_countries: Array<{ country: string; count: number }>
  geo_cities: Array<{ city: string; count: number }>
  industry_breakdown: Array<{ industry: string; count: number }>
  top_technologies: Array<{ tech: string; count: number }>
}

// ── DATA HELPERS ─────────────────────────────────────────────────
function getIntent(score: number) {
  if (score >= 0.7) return { label: "Hot", color: intentColor.Hot }
  if (score >= 0.4) return { label: "Warm", color: intentColor.Warm }
  return { label: "Cold", color: intentColor.Cold }
}

function getIcpScore(visit: Visit): number {
  let score = 0
  if (visit.company) score += 25
  if (visit.full_name || visit.email) score += 20
  if (visit.industry) score += 15
  if (visit.employee_count_range || visit.employee_count_exact) score += 15
  if (visit.revenue_range) score += 10
  if (visit.linkedin_url || visit.company_linkedin_url) score += 10
  if (visit.domain) score += 5
  return Math.min(score, 100)
}

function extractVisitData(visit: Visit) {
  const geo = visit.geo || visit.resolution?.geo ||
    ((visit.headquarters_city || visit.headquarters_country)
      ? { city: visit.headquarters_city, region: null, country: visit.headquarters_country }
      : null)
  const company = visit.company || visit.resolution?.company
  const person = visit.resolution?.person || {}
  const email = visit.email || person.email || person.work_email || person.personal_email || person.emails?.[0]
  const phone = visit.phone || person.phone || person.mobile_phone || person.work_phone || person.phones?.[0]
  const fullName = visit.full_name || person.full_name || person.name
  const linkedinUrl = visit.linkedin_url || person.linkedin_url || person.linkedin
  const jobTitle = visit.job_title || person.title || person.job_title
  const category = visit.category || visit.resolution?.category
  const logoUrl = visit.resolution?.logo_url || visit.resolution?.explorium?.logo_url || null
  const techStack = visit.technologies || visit.resolution?.explorium?.technologies || []
  const industry = visit.industry || visit.resolution?.explorium?.industry
  const intent = getIntent(visit.intent_score)
  const icpScore = visit.resolution?.icp_score ?? getIcpScore(visit)
  
  let pagePath = visit.url
  try { pagePath = new URL(visit.url).pathname } catch { }

  return { geo, company, email, phone, fullName, linkedinUrl, jobTitle, category, logoUrl, techStack, industry, intent, icpScore, pagePath }
}

function groupByCompany(visits: Visit[]) {
  const map = new Map<string, Visit[]>()
  for (const v of visits) {
    const d = extractVisitData(v)
    const key = v.company || v.resolution?.company || d.fullName || v.domain || v.ip
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(v)
  }
  return Array.from(map.entries()).map(([company, g]) => {
    const sorted = [...g].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const firstVisit = sorted[0]
    const d = extractVisitData(firstVisit)
    return {
      id: company,
      name: d.company || d.fullName || firstVisit.domain || company,
      visits: sorted,
      totalIntent: Math.max(...g.map(v => v.intent_score)),
      lastSeen: sorted[0]?.created_at || "",
      icpScore: Math.max(...g.map(v => v.resolution?.icp_score ?? getIcpScore(v))),
      industry: d.industry || "B2B SaaS",
      logoUrl: d.logoUrl,
      intent: getIntent(Math.max(...g.map(v => v.intent_score))),
    }
  }).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
}

// ── UI COMPONENTS ────────────────────────────────────────────────
function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-500 text-white text-[9px] font-bold tracking-wider uppercase">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      LIVE
    </span>
  )
}

function MetricCard({ label, value, delta, isLoading }: { label: string; value: string; delta: string; isLoading?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">{label}</div>
      <div className="text-[20px] font-bold tracking-tight text-foreground">{isLoading ? "..." : value}</div>
      <div className="text-[10px] font-bold mt-0.5 text-green-500">{delta}</div>
    </div>
  )
}

function IntentBadge({ intent }: { intent: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: intentColor[intent] }} />
      <span className="text-[10px] font-bold" style={{ color: intentColor[intent] }}>{intent}</span>
    </span>
  )
}

function MiniProgressBar({ value, color = "#4F46E5" }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[44px] h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold text-foreground">{value}</span>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────
export default function VisitorsPage() {
  const { user } = useStore()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"companies" | "people">("companies")
  const [filter, setFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodHours>(720)
  const [enrichOpen, setEnrichOpen] = useState(false)
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [revealedContacts, setRevealedContacts] = useState<Set<string>>(new Set())

  // Core Data State
  const [visits, setVisits] = useState<Visit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_visits: 0, matched_visits: 0, match_rate: 0 })
  const [analytics, setAnalytics] = useState<VisitorAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // ── DATA FETCHING ──────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const headers = getAuthHeaders()
      const [visitsRes, statsRes] = await Promise.all([
        fetch(`${API}?limit=100`, { headers }),
        fetch(`${API}/stats`, { headers })
      ])
      if (visitsRes.ok) {
        const data = await visitsRes.json()
        setVisits(Array.isArray(data) ? data : data.visits || [])
      }
      if (statsRes.ok) {
        const s = await statsRes.json()
        setStats({ total_visits: s.total_visits ?? 0, matched_visits: s.matched_visits ?? 0, match_rate: s.match_rate ?? 0 })
      }
    } catch {
      setError("Cannot connect to backend")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAnalytics = useCallback(async (h: PeriodHours) => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`${API}/analytics?hours=${h}`, { headers: getAuthHeaders() })
      if (res.ok) setAnalytics(await res.json())
    } catch { } finally { setAnalyticsLoading(false) }
  }, [])

  useEffect(() => {
    setMounted(true)
    fetchData()
    fetchAnalytics(period)

    // SSE Stream
    const streamUrl = `${API_BASE}/api/v1/visitors/stream?token=${encodeURIComponent(localStorage.getItem("outmate_auth_token") || "")}`
    const es = new EventSource(streamUrl)
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg?.type === "visit_created" && msg?.visit) {
          const v = msg.visit as Visit
          setVisits(prev => [v, ...prev].slice(0, 200))
          setTimeout(fetchData, 3000) // Full refresh after enrichment
        }
      } catch { }
    }
    return () => es.close()
  }, [])

  // ── COMPUTED DATA ──────────────────────────────────────────────
  const filteredVisits = useMemo(() => {
    let list = visits
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(v => {
        const d = extractVisitData(v)
        return (d.company || "").toLowerCase().includes(q) || (d.fullName || "").toLowerCase().includes(q)
      })
    }
    if (filter === "Hot") list = list.filter(v => v.intent_score >= 0.7)
    if (filter === "ICP match") list = list.filter(v => (v.resolution?.icp_score ?? 0) >= 80)
    return list
  }, [visits, searchQuery, filter])

  const companyGroups = useMemo(() => groupByCompany(filteredVisits), [filteredVisits])
  
  const selectedGroup = companyGroups.find(g => g.id === selectedId)
  const selectedVisit = visits.find(v => v.id === selectedId)

  // ── UI RENDER HELPERS ──────────────────────────────────────────
  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 1) return "Just now"
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return d.toLocaleDateString()
  }

  if (!mounted) return null

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── TOPBAR ── */}
      <div className="flex items-center justify-between px-6 border-b bg-card" style={{ minHeight: 64 }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-foreground">Visitor Identification</h1>
            <LivePill />
          </div>
          <div className="text-[11px] text-muted-foreground font-medium">Tracking since inception · Script v2.1 active</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] font-bold">
            <Code className="w-3.5 h-3.5" /> Tracking script
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] font-bold">
            <Bell className="w-3.5 h-3.5" /> Alert rules
          </Button>
          <Button 
            className="h-8 gap-1.5 text-[11px] font-black bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setEnrichOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" /> Run outreach
          </Button>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex items-center justify-between px-6 border-b border-border bg-card">
        <div className="flex">
          {[
            { key: "companies", label: "Companies", count: companyGroups.length },
            { key: "people", label: "People", count: visits.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key as any); setSelectedId(null); setFilter("All"); }}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-[12px] font-bold border-b-2 transition-all relative",
                activeTab === t.key
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30"
              )}
            >
              {t.label}
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-md",
                activeTab === t.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 mr-2">
              {PERIODS.map((p) => (
                  <button 
                    key={p.hours} 
                    className={cn(
                      "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                      period === p.hours ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => { setPeriod(p.hours); fetchAnalytics(p.hours); }}
                  >
                      {p.label}
                  </button>
              ))}
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px] font-bold text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6 flex flex-col no-scrollbar">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Companies identified" value={String(stats.matched_visits)} delta="+24% vs last period" isLoading={isLoading} />
            <MetricCard label="ICP match rate" value={`${stats.match_rate.toFixed(0)}%`} delta="+5% vs last period" isLoading={isLoading} />
            <MetricCard label="Hot accounts" value={String(companyGroups.filter(g => g.totalIntent >= 0.7).length)} delta="+31% vs last period" isLoading={isLoading} />
            <MetricCard label="Identification rate" value={`${Math.round(stats.match_rate)}%`} delta="Resets in 18d" isLoading={isLoading} />
          </div>

          {/* Charts (Always show simplified version) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-foreground">Matched vs Unknown</h3>
                  <p className="text-[10px] text-muted-foreground font-medium">Identification trend over time</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> Matched</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted" /> Unknown</span>
                </div>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.timeseries || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="bucket" hide />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                    <Bar dataKey="company" stackId="a" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="unknown" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-foreground">Top Visited Pages</h3>
                <p className="text-[10px] text-muted-foreground font-medium">Most active URLs</p>
              </div>
              <div className="space-y-3">
                {analytics?.top_pages.slice(0, 5).map((p, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="truncate max-w-[140px] text-foreground tracking-tight">{p.page}</span>
                      <span className="text-muted-foreground">{p.count}</span>
                    </div>
                    <Progress value={(p.count / (analytics.top_pages[0]?.count || 1)) * 100} className="h-1" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:max-w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by company or name..."
                className="pl-9 h-10 bg-muted/30 border-transparent focus:bg-background transition-all rounded-xl text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {["All", "Hot", "ICP match"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-4 py-2 text-[11px] font-bold rounded-xl border transition-all whitespace-nowrap",
                    filter === f
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* TABLE */}
          <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    {activeTab === "companies" ? (
                      ["Company", "ICP Score", "Intent", "Visits", "Last Seen", "Industry", ""].map(h => (
                        <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{h}</th>
                      ))
                    ) : (
                      ["Person", "Account", "ICP Score", "Intent", "Last seen", "Outreach", ""].map(h => (
                        <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{h}</th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    [1,2,3,4,5,6].map(i => <tr key={i} className="h-16 animate-pulse" />)
                  ) : activeTab === "companies" ? (
                    companyGroups.map(c => (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "group hover:bg-muted/30 transition-colors cursor-pointer",
                          selectedId === c.id && "bg-primary/5"
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-xs font-bold shrink-0">
                               {c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="w-6 h-6 object-contain" /> : c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[13px] font-bold text-foreground truncate">{c.name}</div>
                              <div className="text-[10px] text-muted-foreground font-medium truncate">{c.industry}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><MiniProgressBar value={c.icpScore} /></td>
                        <td className="px-6 py-4"><IntentBadge intent={c.intent.label} /></td>
                        <td className="px-6 py-4 text-[11px] font-bold text-foreground">{c.visits.length} sessions</td>
                        <td className="px-6 py-4 text-[10px] text-muted-foreground font-medium">{formatTime(c.lastSeen)}</td>
                        <td className="px-6 py-4 text-[10px] text-muted-foreground font-medium italic">{c.industry}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredVisits.map(v => {
                      const d = extractVisitData(v)
                      return (
                        <tr 
                          key={v.id} 
                          onClick={() => setSelectedId(v.id)}
                          className={cn(
                            "group hover:bg-muted/30 transition-colors cursor-pointer",
                            selectedId === v.id && "bg-primary/5"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                 {d.fullName?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold text-foreground truncate">{d.fullName || "Unresolved Person"}</div>
                                <div className="text-[10px] text-muted-foreground font-medium truncate">{d.jobTitle || "Verified Visitor"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[11px] font-bold text-muted-foreground">{d.company || v.domain || "Unknown"}</td>
                          <td className="px-6 py-4"><MiniProgressBar value={d.icpScore} /></td>
                          <td className="px-6 py-4"><IntentBadge intent={d.intent.label} /></td>
                          <td className="px-6 py-4 text-[10px] text-muted-foreground font-medium">{formatTime(v.created_at)}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="text-[9px] font-bold border-border bg-muted/30">Not Contacted</Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && filteredVisits.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                 <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                   <Radar className="w-8 h-8 text-muted-foreground/30 animate-pulse" />
                 </div>
                 <h2 className="text-sm font-bold text-foreground">Listening for visitors...</h2>
                 <p className="text-[11px] text-muted-foreground font-medium mt-1">Make sure your tracking script is installed correctly.</p>
              </div>
            )}
          </section>
        </div>

        {/* ── DETAIL PANEL ── */}
        <div className="w-[360px] min-w-[360px] border-l border-border bg-card overflow-y-auto no-scrollbar">
          {(!selectedGroup && !selectedVisit) ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 opacity-40">
              <Eye className="w-12 h-12 mb-4 text-muted-foreground" />
              <div className="text-[13px] font-bold text-foreground">Select a visitor</div>
              <div className="text-[11px] text-muted-foreground mt-1 font-medium leading-relaxed">Click any row to view full session details, enrichment data, and account intelligence.</div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-black text-foreground uppercase tracking-tight">Detail View</span>
                <button 
                  onClick={() => setSelectedId(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted font-bold transition-all border border-border"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Profile Card */}
              <div className="bg-muted/30 rounded-2xl p-5 border border-border/50">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center text-xl font-bold text-primary shadow-sm">
                    {selectedGroup ? (selectedGroup.logoUrl ? <img src={selectedGroup.logoUrl} className="w-10 h-10 object-contain" /> : selectedGroup.name.charAt(0)) : (extractVisitData(selectedVisit!).fullName?.charAt(0) || "U")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-black leading-tight tracking-tight text-foreground truncate">
                       {selectedGroup ? selectedGroup.name : extractVisitData(selectedVisit!).fullName}
                    </h2>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                      {selectedGroup ? selectedGroup.industry : extractVisitData(selectedVisit!).jobTitle || 'Verified Visitor'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">ICP SCORE</div>
                    <div className="text-xl font-black text-primary">{selectedGroup ? selectedGroup.icpScore : extractVisitData(selectedVisit!).icpScore}</div>
                  </div>
                   <div className="bg-card rounded-xl p-3 border border-border/50 text-center">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">INTENT</div>
                    <div className="text-xl font-black" style={{ color: selectedGroup ? selectedGroup.intent.color : extractVisitData(selectedVisit!).intent.color }}>
                      {selectedGroup ? selectedGroup.intent.label : extractVisitData(selectedVisit!).intent.label}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">Contact Information</h3>
                <div className="space-y-1 bg-card border border-border rounded-xl p-1">
                   {[
                    { label: "Email", value: selectedGroup ? selectedGroup.visits[0].email : selectedVisit?.email, icon: Mail },
                    { label: "Phone", value: selectedGroup ? selectedGroup.visits[0].phone : selectedVisit?.phone, icon: Phone },
                    { label: "LinkedIn", value: selectedGroup ? selectedGroup.visits[0].linkedin_url : selectedVisit?.linkedin_url, icon: Linkedin, type: 'link' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 hover:bg-muted/30 rounded-lg transition-all group">
                       <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                         <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">{f.label}</div>
                          {f.value ? (
                             f.type === 'link' ? (
                               <a href={f.value} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-primary hover:underline truncate flex items-center gap-1">
                                 View Profile <ExternalLink className="w-2.5 h-2.5" />
                               </a>
                             ) : (
                               <div className="text-[12px] font-bold text-foreground truncate">{f.value}</div>
                             )
                          ) : (
                            <div className="flex items-center gap-2">
                               <span className="text-[11px] font-bold text-muted-foreground/40 italic">Hidden (3 credits)</span>
                               <button className="text-[9px] font-black text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded cursor-pointer transition-all">REVEAL</button>
                            </div>
                          )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>

               {/* Recent Session Log */}
               <div className="space-y-3">
                <h3 className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">Recent Activity</h3>
                <div className="space-y-3 pl-2 border-l-2 border-border ml-2">
                  {(selectedGroup ? selectedGroup.visits : [selectedVisit!]).slice(0, 5).map((v, i) => {
                    const d = extractVisitData(v)
                    return (
                      <div key={i} className="relative pl-6">
                        <div className="absolute left-[-29px] top-1.5 w-2 h-2 rounded-full bg-primary border-2 border-card shadow-sm" />
                        <div className="text-[11px] font-bold text-foreground tracking-tight leading-snug">
                          Visited <span className="text-primary">{d.pagePath}</span>
                        </div>
                        <div className="text-[9px] text-muted-foreground font-medium mt-0.5">{formatTime(v.created_at)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

               {/* Actions */}
               <div className="pt-4 space-y-2">
                  <Button className="w-full bg-primary text-primary-foreground font-black py-6 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
                    <Play className="w-4 h-4 mr-2" /> Start Outreach Flow
                  </Button>
                  <Button variant="outline" className="w-full font-bold py-6 rounded-xl border-border hover:bg-muted transition-all">
                    <Building2 className="w-4 h-4 mr-2" /> Add to CRM
                  </Button>
               </div>
            </div>
          )}
        </div>
      </div>
      
      <EnrichmentModal
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        selectedRows={selectedPeopleIds.length > 0 ? selectedPeopleIds.length : filteredVisits.length}
      />
    </div>
  )
}
