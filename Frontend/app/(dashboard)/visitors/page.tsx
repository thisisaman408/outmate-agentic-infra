"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

// Department classification from job_title (Sales / Finance / Product / Executive / Marketing / Engineering / Other).
function inferDepartment(jobTitle?: string | null): string {
  if (!jobTitle) return "Unknown"
  const t = jobTitle.toLowerCase()
  if (/(ceo|cto|cfo|coo|cmo|chief|founder|president|owner|partner|board)/.test(t)) return "Executive"
  if (/(sale|account exec|business development|bdr|sdr|revenue|ae\b)/.test(t)) return "Sales"
  if (/(finance|accountant|controller|treasur|cfo|audit)/.test(t)) return "Finance"
  if (/(product|pm\b|po\b|product manager|product owner)/.test(t)) return "Product"
  if (/(market|growth|brand|content|seo|demand)/.test(t)) return "Marketing"
  if (/(engineer|developer|architect|devops|sre|software|coder)/.test(t)) return "Engineering"
  if (/(operation|ops|project|program)/.test(t)) return "Operations"
  if (/(hr|people|talent|recruit)/.test(t)) return "HR"
  return "Other"
}

const DEPARTMENT_COLOR: Record<string, string> = {
  Sales: "#10B981",
  Finance: "#F59E0B",
  Product: "#8B5CF6",
  Executive: "#EF4444",
  Marketing: "#EC4899",
  Engineering: "#3B82F6",
  Operations: "#6366F1",
  HR: "#14B8A6",
  Other: "#9CA3AF",
  Unknown: "#9CA3AF",
}

// Persona = seniority bucket inferred from job_title.
function inferPersona(jobTitle?: string | null): string {
  if (!jobTitle) return "Unknown"
  const t = jobTitle.toLowerCase()
  if (/(ceo|cto|cfo|coo|cmo|chief|founder|president|owner)/.test(t)) return "C-Suite"
  if (/(\bvp\b|vice president|head of|svp)/.test(t)) return "VP"
  if (/(director)/.test(t)) return "Director"
  if (/(manager|lead|principal)/.test(t)) return "Manager"
  if (/(senior|sr\.|staff)/.test(t)) return "Senior IC"
  if (/(intern|junior|jr\.|associate)/.test(t)) return "Junior"
  return "IC"
}

// Buying stage from intent score + page path keywords.
function inferBuyingStage(intentScore: number, pagePath?: string | null): string {
  const path = (pagePath || "").toLowerCase()
  if (/(pricing|demo|trial|signup|sign-up|book|contact|checkout|buy)/.test(path)) return "Decision"
  if (/(case-stud|customers|comparison|vs-|review|integration)/.test(path)) return "Evaluation"
  if (/(blog|guide|resources|docs|how-to|what-is)/.test(path)) return "Awareness"
  if (intentScore >= 0.7) return "Decision"
  if (intentScore >= 0.4) return "Consideration"
  return "Awareness"
}

const STAGE_COLOR: Record<string, string> = {
  Awareness: "#9CA3AF",
  Consideration: "#3B82F6",
  Evaluation: "#8B5CF6",
  Decision: "#EF4444",
}

// Engagement bucket from session count + intent.
function inferEngagement(sessionCount: number, intentScore: number): { label: string; color: string } {
  if (sessionCount >= 5 || intentScore >= 0.8) return { label: "High", color: "#EF4444" }
  if (sessionCount >= 2 || intentScore >= 0.5) return { label: "Medium", color: "#F59E0B" }
  return { label: "Low", color: "#9CA3AF" }
}

// Role prediction: short human-readable label combining persona + dept + stage signals.
function predictRole(jobTitle: string | null | undefined, intentScore: number, pagePath: string | null | undefined): string {
  const persona = inferPersona(jobTitle)
  const dept = inferDepartment(jobTitle)
  if (jobTitle) return `${persona} · ${dept}`
  const stage = inferBuyingStage(intentScore, pagePath)
  if (intentScore >= 0.7) return `Likely buyer · ${stage}`
  if (intentScore >= 0.4) return `Likely researcher · ${stage}`
  return `Likely browser · ${stage}`
}

function formatLocation(geo: any): string {
  if (!geo) return "—"
  const parts = [geo.city, geo.region, geo.country].filter(Boolean)
  return parts.length ? parts.join(", ") : "—"
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

  const persona = inferPersona(jobTitle)
  const department = inferDepartment(jobTitle)
  const buyingStage = inferBuyingStage(visit.intent_score, pagePath)
  const rolePrediction = predictRole(jobTitle, visit.intent_score, pagePath)
  const locationLabel = formatLocation(geo)

  return { geo, company, email, phone, fullName, linkedinUrl, jobTitle, category, logoUrl, techStack, industry, intent, icpScore, pagePath, persona, department, buyingStage, rolePrediction, locationLabel }
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

function buildVisitorMailtoLink(visit: Visit) {
  const d = extractVisitData(visit)
  const email = d.email || visit.email
  if (!email) return null

  const companyName = d.company || visit.domain || "your team"
  const personName = d.fullName || ""
  const firstName = personName.split(" ")[0] || ""
  const greetingName = firstName || "there"
  const senderName = "Outmate"

  const subject = d.company
    ? `Following up - ${companyName}`
    : personName
      ? `Following up - ${personName}`
      : "Following up"

  const bodyLines = [
    `Hi ${greetingName},`,
    "",
    d.company
      ? `I wanted to follow up about ${companyName} and see if this is relevant for your team.`
      : "I wanted to follow up and see if this is relevant for your team.",
    "",
    "Happy to share more context if helpful.",
    "",
    `Best,`,
    senderName,
  ]

  const params = new URLSearchParams({
    subject,
    body: bodyLines.join("\n"),
  })

  return `mailto:${email}?${params.toString()}`
}

async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return true
  }
  return false
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
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<"companies" | "people">("companies")
  const [filter, setFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodHours>(720)
  const [enrichOpen, setEnrichOpen] = useState(false)
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [revealedContacts, setRevealedContacts] = useState<Set<string>>(new Set())
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [slackWebhook, setSlackWebhook] = useState("")
  const [otherWebhooks, setOtherWebhooks] = useState<string[]>([])
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [emailAlertEnabled, setEmailAlertEnabled] = useState(false)
  const [emailAlertAddress, setEmailAlertAddress] = useState("")
  const [icpFilters, setIcpFilters] = useState<Record<string, any>>({})
  const [hubspotEnabled, setHubspotEnabled] = useState(false)
  const [instantlyEnabled, setInstantlyEnabled] = useState(false)
  const [instantlyCampaignId, setInstantlyCampaignId] = useState("")
  const [extraWebhookUrls, setExtraWebhookUrls] = useState<string[]>([])
  const [integrationStatus, setIntegrationStatus] = useState<Record<string, boolean>>({})

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

  const loadAlertSettings = useCallback(async () => {
    try {
      const [cfgRes, integrationsRes] = await Promise.all([
        fetch(`${API}/site-config`, { headers: getAuthHeaders() }),
        fetch(`/api/v1/integrations`, { headers: getAuthHeaders() }).catch(() => null),
      ])
      if (!cfgRes.ok) return
      const cfg = await cfgRes.json()
      const urls: string[] = Array.isArray(cfg.webhook_urls) ? cfg.webhook_urls : []
      const slack = urls.find((u) => u.includes("hooks.slack.com")) || ""
      setSlackWebhook(slack)
      // Webhooks the user pasted as Make/n8n/custom destinations (everything that isn't Slack)
      const nonSlack = urls.filter((u) => !u.includes("hooks.slack.com"))
      setExtraWebhookUrls(nonSlack)
      setOtherWebhooks(nonSlack)
      const filters = (cfg.icp_filters && typeof cfg.icp_filters === "object") ? cfg.icp_filters : {}
      setIcpFilters(filters)
      setEmailAlertEnabled(Boolean(filters.alert_email_enabled))
      setEmailAlertAddress(typeof filters.alert_email === "string" ? filters.alert_email : "")
      setHubspotEnabled(Boolean(filters.alerts_hubspot_enabled))
      setInstantlyEnabled(Boolean(filters.alerts_instantly_enabled))
      setInstantlyCampaignId(typeof filters.alerts_instantly_campaign_id === "string" ? filters.alerts_instantly_campaign_id : "")

      // Build {hubspot, instantly, ...} → connected map from /api/v1/integrations
      if (integrationsRes && integrationsRes.ok) {
        const data = await integrationsRes.json().catch(() => null)
        const list: any[] = Array.isArray(data) ? data : (data?.integrations || data?.items || [])
        const map: Record<string, boolean> = {}
        for (const item of list) {
          const slug = String(item.slug || item.integration_slug || item.name || "").toLowerCase()
          const status = String(item.status || item.user_status || "").toLowerCase()
          const isConnected = Boolean(item.connected) || status === "connected" || status === "active"
          if (slug) map[slug] = isConnected
        }
        setIntegrationStatus(map)
      }
    } catch { }
  }, [])

  const saveAlertSettings = useCallback(async () => {
    setSavingWebhook(true)
    try {
      const trimmed = slackWebhook.trim()
      if (trimmed && !trimmed.startsWith("https://hooks.slack.com/")) {
        toast.error("Enter a valid Slack incoming webhook URL (https://hooks.slack.com/services/...)")
        return
      }
      const trimmedEmail = emailAlertAddress.trim()
      if (emailAlertEnabled && trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        toast.error("Enter a valid email address")
        return
      }
      const cleanedExtras = extraWebhookUrls
        .map((u) => u.trim())
        .filter(Boolean)
        .filter((u) => /^https?:\/\//i.test(u))
      for (const u of cleanedExtras) {
        if (u.includes("hooks.slack.com")) {
          toast.error("Use the Slack field above for Slack webhook URLs")
          return
        }
      }
      if (instantlyEnabled && !instantlyCampaignId.trim()) {
        toast.error("Enter your Instantly campaign ID, or disable Instantly alerts")
        return
      }
      const nextUrls = [...(trimmed ? [trimmed] : []), ...cleanedExtras]
      const nextFilters = {
        ...icpFilters,
        alert_email_enabled: emailAlertEnabled,
        alert_email: trimmedEmail,
        alerts_hubspot_enabled: hubspotEnabled,
        alerts_instantly_enabled: instantlyEnabled,
        alerts_instantly_campaign_id: instantlyCampaignId.trim(),
      }
      const res = await fetch(`${API}/site-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ webhook_urls: nextUrls, icp_filters: nextFilters }),
      })
      if (res.ok) {
        toast.success("Alert settings saved")
        setIcpFilters(nextFilters)
        setOtherWebhooks(cleanedExtras)
      } else {
        toast.error("Failed to save settings")
      }
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "unknown"}`)
    } finally {
      setSavingWebhook(false)
    }
  }, [slackWebhook, extraWebhookUrls, emailAlertEnabled, emailAlertAddress, icpFilters, hubspotEnabled, instantlyEnabled, instantlyCampaignId])

  useEffect(() => {
    setMounted(true)
    fetchData()
    fetchAnalytics(period)

    // SSE Stream
    const streamUrl = `${API_BASE}/api/v1/visitors/stream?token=${encodeURIComponent(localStorage.getItem("outmate_auth_token") || "")}`
    let es: EventSource | null = null
    let retryCount = 0
    const MAX_RETRIES = 5
    
    const connectStream = () => {
      try {
        // Check if token is valid
        const token = localStorage.getItem("outmate_auth_token")
        if (!token) {
          console.error("No auth token found")
          return
        }
        
        es = new EventSource(streamUrl)
        
        es.onopen = () => {
          console.log("SSE stream connected")
          retryCount = 0 // Reset retry count on successful connection
        }
        
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
        
        es.onerror = (error) => {
          console.error("SSE stream error:", error)
          console.error("Stream URL:", streamUrl)
          console.error("Retry count:", retryCount)
          
          // Close and reconnect after delay
          if (es) {
            es.close()
            es = null
          }
          
          retryCount++
          
          // Stop retrying after max attempts
          if (retryCount >= MAX_RETRIES) {
            console.error("Max retries reached, falling back to polling only")
            // Fallback to polling every 30 seconds
            setInterval(fetchData, 30000)
            return
          }
          
          // Fallback to polling if SSE fails repeatedly
          setTimeout(() => {
            connectStream()
            // Also do a manual fetch as backup
            fetchData()
          }, 5000)
        }
        
        es.onclose = () => {
          console.log("SSE stream closed")
          if (es) {
            es.close()
            es = null
          }
          // Attempt to reconnect after 3 seconds
          setTimeout(connectStream, 3000)
        }
      } catch (error) {
        console.error("Failed to create SSE connection:", error)
        setTimeout(connectStream, 5000) // Retry after 5 seconds
      }
    }
    
    connectStream()
    
    return () => {
      if (es) {
        es.close()
        es = null
      }
    }
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

  // ── ACTION HANDLERS ────────────────────────────────────────────
  const handleRunEnrichments = useCallback(async (actionIds: string[], credits: number) => {
    try {
      const res = await fetch(`/api/v1/visitors/enrich-bulk`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_ids: selectedPeopleIds.length > 0 ? selectedPeopleIds : filteredVisits.map(v => v.id),
          actions: actionIds,
        }),
      })
      if (res.ok) {
        toast.success(`Enrichment started for ${actionIds.length} action(s)`)
        setEnrichOpen(false)
        setTimeout(fetchData, 3000)
      } else {
        const err = await res.json().catch(() => null)
        toast.error(err?.detail || "Enrichment failed")
      }
    } catch {
      toast.error("Could not reach enrichment service")
    }
  }, [selectedPeopleIds, filteredVisits])

  const handleCopilotCompany = useCallback((companyName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/copilot?context=company&company=${encodeURIComponent(companyName)}`)
  }, [router])

  const handleAddCompany = useCallback((company: { name: string; domain?: string | null; industry?: string }, e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/leads/companies?search=${encodeURIComponent(company.name)}`)
    toast.success(`Opening ${company.name} in Companies`)
  }, [router])

  const handleReveal = useCallback(async (visitId: string, field: "email" | "phone") => {
    const visit = visits.find(v => v.id === visitId)
    if (!visit) { toast.error("Visitor not found"); return }
    const linkedinUrl = visit.linkedin_url
    const domain = visit.domain
    if (!linkedinUrl && !domain) {
      toast.error(`Cannot reveal ${field} — no LinkedIn or domain available for this visitor`)
      return
    }
    const tid = toast.loading(`Revealing ${field}...`)
    try {
      let res: Response
      if (linkedinUrl) {
        res = await fetch(`/api/contactout/reveal-contact`, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ linkedin_url: linkedinUrl, include_phone: field === "phone" }),
        })
      } else {
        res = await fetch(`/api/contactout/reveal-company-contact`, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ domain, include_phone: field === "phone" }),
        })
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.dismiss(tid)
        toast.error(data?.error?.message || `Reveal failed (${res.status})`)
        return
      }
      const revealedEmail = data?.email || data?.emails?.[0]
      const revealedPhone = data?.phone || data?.phones?.[0]?.number || data?.phones?.[0]
      if ((field === "email" && revealedEmail) || (field === "phone" && revealedPhone)) {
        setVisits(prev => prev.map(v => v.id === visitId ? {
          ...v,
          email: revealedEmail || v.email,
          phone: revealedPhone || v.phone,
        } : v))
        setRevealedContacts(prev => new Set(prev).add(visitId))
        toast.dismiss(tid)
        toast.success(`${field === "email" ? "Email" : "Phone"} revealed`)
      } else {
        toast.dismiss(tid)
        toast.error(`No ${field} found for this contact`)
      }
    } catch (err) {
      toast.dismiss(tid)
      toast.error(`Failed to reveal ${field}`)
    }
  }, [visits])

  const handleAddToCrm = useCallback(async () => {
    const visit = selectedGroup ? selectedGroup.visits[0] : selectedVisit
    if (!visit) return
    const d = extractVisitData(visit)
    const contact = {
      company: d.company || "",
      name: d.fullName || "",
      email: visit.email || "",
      phone: visit.phone || "",
      linkedin_url: visit.linkedin_url || "",
      domain: visit.domain || "",
      job_title: visit.job_title || "",
    }
    try {
      const res = await fetch(`/api/v1/integrations/oauth/hubspot/push`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ entities: [contact], type: "contacts" }),
      })
      if (res.ok) {
        toast.success("Contact added to CRM")
      } else {
        const err = await res.json().catch(() => null)
        if (res.status === 404 || err?.detail?.includes("not connected")) {
          toast.error("No CRM connected. Go to Integrations to connect HubSpot, Salesforce, or Zoho.")
          router.push("/integrations")
        } else {
          toast.error(err?.detail || "Failed to push to CRM")
        }
      }
    } catch {
      toast.error("Could not reach CRM integration")
    }
  }, [selectedGroup, selectedVisit, router])

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
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] font-bold" onClick={() => setTrackingOpen(true)}>
            <Code className="w-3.5 h-3.5" /> Tracking script
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[11px] font-bold" onClick={() => setAlertsOpen(true)}>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[11px] font-bold text-muted-foreground">
                <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const rows = (activeTab === "companies" ? companyGroups : visits).map((r: any) => activeTab === "companies"
                  ? { company: r.company, domain: r.domain, visits: r.visits?.length ?? r.visitCount, intent: r.totalIntent?.toFixed(2) }
                  : { ip: r.ip, company: r.company_name, url: r.url, intent: r.intent_score, date: r.created_at }
                )
                if (!rows.length) { toast.error("Nothing to export"); return }
                const header = Object.keys(rows[0]).join(",")
                const csv = [header, ...rows.map((r: any) => Object.values(r).map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n")
                const blob = new Blob([csv], { type: "text/csv" })
                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `visitors-${activeTab}-${new Date().toISOString().slice(0,10)}.csv`; a.click()
                toast.success("CSV exported")
              }}>
                <Download className="w-3.5 h-3.5 mr-2" /> Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6 flex flex-col no-scrollbar">
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Companies identified" value={String(analytics?.summary.companies ?? stats.matched_visits)} delta={`${PERIODS.find(p => p.hours === period)?.label ?? ""}`} isLoading={analyticsLoading} />
            <MetricCard label="ICP match rate" value={`${(analytics?.summary.match_rate ?? stats.match_rate).toFixed(0)}%`} delta={`${PERIODS.find(p => p.hours === period)?.label ?? ""}`} isLoading={analyticsLoading} />
            <MetricCard label="Total visits" value={String(analytics?.summary.total ?? stats.total_visits)} delta={`${PERIODS.find(p => p.hours === period)?.label ?? ""}`} isLoading={analyticsLoading} />
            <MetricCard label="Live now" value={String(analytics?.live.unique_ips ?? 0)} delta={`${analytics?.live.window_minutes ?? 5}m window`} isLoading={analyticsLoading} />
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
                      ["Company", "ICP Score", "Intent", "Engagement", "Visits", "Location", "Last Seen", "Industry", ""].map(h => (
                        <th key={h} className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{h}</th>
                      ))
                    ) : (
                      ["Person", "Account", "Persona", "Dept", "Buying Stage", "Intent", "Engagement", "IP", "Location", "Time", ""].map(h => (
                        <th key={h} className="px-3 py-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">{h}</th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    [1,2,3,4,5,6].map(i => <tr key={i} className="h-16 animate-pulse" />)
                  ) : activeTab === "companies" ? (
                    companyGroups.map(c => {
                      const firstD = extractVisitData(c.visits[0])
                      const eng = inferEngagement(c.visits.length, c.totalIntent)
                      return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "group hover:bg-muted/30 transition-colors cursor-pointer",
                          selectedId === c.id && "bg-primary/5"
                        )}
                      >
                        <td className="px-4 py-4">
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
                        <td className="px-4 py-4"><MiniProgressBar value={c.icpScore} /></td>
                        <td className="px-4 py-4"><IntentBadge intent={c.intent.label} /></td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: eng.color }} />
                            <span className="text-[10px] font-bold" style={{ color: eng.color }}>{eng.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[11px] font-bold text-foreground">{c.visits.length}</td>
                        <td className="px-4 py-4 text-[10px] text-muted-foreground font-medium truncate max-w-[140px]">{firstD.locationLabel}</td>
                        <td className="px-4 py-4 text-[10px] text-muted-foreground font-medium">{formatTime(c.lastSeen)}</td>
                        <td className="px-4 py-4 text-[10px] text-muted-foreground font-medium italic truncate max-w-[120px]">{c.industry}</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              title="Open in Copilot"
                              onClick={(e) => handleCopilotCompany(c.name, e)}
                              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              title="Save to leads"
                              onClick={(e) => handleAddCompany({ name: c.name, domain: c.visits[0]?.domain, industry: c.industry }, e)}
                              className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})
                  ) : (
                    filteredVisits.map(v => {
                      const d = extractVisitData(v)
                      const sessionsForThis = visits.filter(x =>
                        (x.company && d.company && x.company === d.company) ||
                        (!x.company && !d.company && x.ip === v.ip)
                      ).length
                      const eng = inferEngagement(sessionsForThis, v.intent_score)
                      const stageColor = STAGE_COLOR[d.buyingStage] || "#9CA3AF"
                      const deptColor = DEPARTMENT_COLOR[d.department] || "#9CA3AF"
                      return (
                        <tr
                          key={v.id}
                          onClick={() => setSelectedId(v.id)}
                          className={cn(
                            "group hover:bg-muted/30 transition-colors cursor-pointer",
                            selectedId === v.id && "bg-primary/5"
                          )}
                        >
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                 {d.fullName?.charAt(0).toUpperCase() || "U"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[12px] font-bold text-foreground truncate max-w-[140px]">{d.fullName || "Unresolved"}</div>
                                <div className="text-[10px] text-muted-foreground font-medium truncate max-w-[140px]">{d.jobTitle || "Verified Visitor"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-[11px] font-bold text-muted-foreground truncate max-w-[120px]">{d.company || v.domain || "Unknown"}</td>
                          <td className="px-3 py-4 text-[10px] font-bold text-foreground">{d.persona}</td>
                          <td className="px-3 py-4">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold"
                              style={{ backgroundColor: `${deptColor}1A`, color: deptColor }}
                            >
                              {d.department}
                            </span>
                          </td>
                          <td className="px-3 py-4">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold"
                              style={{ backgroundColor: `${stageColor}1A`, color: stageColor }}
                            >
                              {d.buyingStage}
                            </span>
                          </td>
                          <td className="px-3 py-4"><IntentBadge intent={d.intent.label} /></td>
                          <td className="px-3 py-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: eng.color }} />
                              <span className="text-[10px] font-bold" style={{ color: eng.color }}>{eng.label}</span>
                            </span>
                          </td>
                          <td className="px-3 py-4 text-[10px] font-mono text-muted-foreground truncate max-w-[110px]">{v.ip || "—"}</td>
                          <td className="px-3 py-4 text-[10px] text-muted-foreground font-medium truncate max-w-[140px]">{d.locationLabel}</td>
                          <td className="px-3 py-4 text-[10px] text-muted-foreground font-medium whitespace-nowrap">{formatTime(v.created_at)}</td>
                          <td className="px-3 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5 text-[10px] font-bold"
                                onClick={async () => {
                                  if (v.email) {
                                    const mailtoLink = buildVisitorMailtoLink(v)
                                    if (!mailtoLink) {
                                      toast.error("No email available for this visitor")
                                      return
                                    }
                                    const copied = await copyTextToClipboard(v.email)
                                    window.location.href = mailtoLink
                                    if (copied) {
                                      toast.success(`Email copied: ${v.email}`)
                                    } else {
                                      toast.success(`Trying to open mail for ${v.email}`)
                                    }
                                  } else {
                                    handleReveal(v.id, "email")
                                  }
                                }}
                              >
                                <Mail className="w-3.5 h-3.5" /> {v.email ? "Email" : "Reveal"}
                              </Button>
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
          ) : (() => {
            const panelVisit: Visit = (selectedGroup ? selectedGroup.visits[0] : selectedVisit!) as Visit
            const panelData = extractVisitData(panelVisit)
            const panelSessions = selectedGroup ? selectedGroup.visits.length : 1
            const panelEng = inferEngagement(panelSessions, panelVisit.intent_score)
            const stageColor = STAGE_COLOR[panelData.buyingStage] || "#9CA3AF"
            const deptColor = DEPARTMENT_COLOR[panelData.department] || "#9CA3AF"
            return (
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
                    { label: "Email", field: "email" as const, value: selectedGroup ? selectedGroup.visits[0].email : selectedVisit?.email, icon: Mail },
                    { label: "Phone", field: "phone" as const, value: selectedGroup ? selectedGroup.visits[0].phone : selectedVisit?.phone, icon: Phone },
                    { label: "LinkedIn", field: null, value: selectedGroup ? selectedGroup.visits[0].linkedin_url : selectedVisit?.linkedin_url, icon: Linkedin, type: 'link' as const },
                  ].map((f, i) => {
                    const visitId = selectedGroup ? selectedGroup.visits[0].id : selectedVisit?.id
                    return (
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
                          ) : f.field ? (
                            <div className="flex items-center gap-2">
                               <span className="text-[11px] font-bold text-muted-foreground/40 italic">Hidden (3 credits)</span>
                               <button
                                 onClick={() => visitId && handleReveal(visitId, f.field!)}
                                 className="text-[9px] font-black text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded cursor-pointer transition-all"
                               >
                                 REVEAL
                               </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-muted-foreground/40 italic">Not available</span>
                          )}
                       </div>
                    </div>
                    )
                  })}
                </div>
              </div>

               {/* Visitor Intelligence — derived from intent + fingerprint + page signals */}
               <div className="space-y-3">
                <h3 className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">Visitor Intelligence</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card rounded-xl p-3 border border-border/50">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Persona</div>
                    <div className="text-[12px] font-black text-foreground">{panelData.persona}</div>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border/50">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Department</div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={{ backgroundColor: `${deptColor}1A`, color: deptColor }}
                    >
                      {panelData.department}
                    </span>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border/50">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Buying Stage</div>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold"
                      style={{ backgroundColor: `${stageColor}1A`, color: stageColor }}
                    >
                      {panelData.buyingStage}
                    </span>
                  </div>
                  <div className="bg-card rounded-xl p-3 border border-border/50">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Engagement</div>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: panelEng.color }} />
                      <span className="text-[11px] font-bold" style={{ color: panelEng.color }}>{panelEng.label}</span>
                    </span>
                  </div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">Role Prediction</span>
                  </div>
                  <p className="text-[12px] font-bold text-foreground leading-snug">{panelData.rolePrediction}</p>
                  <p className="text-[10px] text-muted-foreground font-medium mt-1">
                    Inferred from {panelData.jobTitle ? "title + " : ""}intent score, page path, and fingerprint signals.
                  </p>
                </div>
              </div>

              {/* Enrichment Details */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-black text-muted-foreground/40 uppercase tracking-widest">Enrichment</h3>
                <div className="bg-card border border-border rounded-xl divide-y divide-border">
                  {[
                    { label: "Industry", value: panelData.industry, icon: Building2 },
                    { label: "Company", value: panelData.company, icon: Building2 },
                    { label: "Job Title", value: panelData.jobTitle, icon: Users },
                    { label: "Location", value: panelData.locationLabel !== "—" ? panelData.locationLabel : null, icon: MapPin },
                    { label: "IP Address", value: panelVisit.ip, icon: Globe, mono: true },
                    {
                      label: "Employees",
                      value: panelVisit.employee_count_exact
                        ? String(panelVisit.employee_count_exact)
                        : panelVisit.employee_count_range,
                      icon: Users,
                    },
                    { label: "Revenue", value: panelVisit.revenue_range, icon: BarChart3 },
                    { label: "Funding", value: panelVisit.funding_stage, icon: Coins },
                    {
                      label: "HQ",
                      value: [panelVisit.headquarters_city, panelVisit.headquarters_country].filter(Boolean).join(", ") || null,
                      icon: MapPin,
                    },
                    { label: "Domain", value: panelVisit.domain, icon: Globe },
                    {
                      label: "Source Site",
                      value: panelVisit.source_site,
                      icon: GitBranch,
                    },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <row.icon className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mb-1">{row.label}</div>
                        {row.value ? (
                          <div className={cn(
                            "text-[12px] font-bold text-foreground truncate",
                            row.mono && "font-mono text-[11px]"
                          )}>{row.value}</div>
                        ) : (
                          <span className="text-[11px] font-bold text-muted-foreground/40 italic">Not enriched</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {panelData.techStack && panelData.techStack.length > 0 && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Tech Stack</div>
                    <div className="flex flex-wrap gap-1.5">
                      {panelData.techStack.slice(0, 12).map((t: string, i: number) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-foreground">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {panelVisit.description && (
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Description</div>
                    <p className="text-[11px] font-medium text-foreground leading-relaxed">{panelVisit.description}</p>
                  </div>
                )}
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
                  <Button
                    className="w-full bg-primary text-primary-foreground font-black py-6 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    onClick={() => {
                      const name = selectedGroup ? selectedGroup.name : extractVisitData(selectedVisit!).company || extractVisitData(selectedVisit!).fullName
                      router.push(`/campaigns?new=true&company=${encodeURIComponent(name || "")}`)
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" /> Start Outreach Flow
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full font-bold py-6 rounded-xl border-border hover:bg-muted transition-all"
                    onClick={handleAddToCrm}
                  >
                    <Building2 className="w-4 h-4 mr-2" /> Add to CRM
                  </Button>
               </div>
            </div>
            )
          })()}
        </div>
      </div>
      
      <EnrichmentModal
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        selectedRows={selectedPeopleIds.length > 0 ? selectedPeopleIds.length : filteredVisits.length}
        onRun={handleRunEnrichments}
      />

      {/* Tracking Script Dialog */}
      <Dialog open={trackingOpen} onOpenChange={setTrackingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Install Tracking Script</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add this snippet before the closing <code>&lt;/head&gt;</code> tag on every page you want to track.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 font-mono text-[11px] leading-relaxed relative">
            <pre className="whitespace-pre-wrap break-all">{`<!-- Outmate.ai Tracking -->\n<script\n  src="${PIXEL_HOST}/api/v1/visitors/pixel.js"\n  data-pixel-key="${user?.id || "YOUR_KEY"}"\n  async\n></script>`}</pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2 h-7 text-[10px] font-bold gap-1"
              onClick={() => {
                navigator.clipboard.writeText(
                  `<script src="${PIXEL_HOST}/api/v1/visitors/pixel.js" data-pixel-key="${user?.id || "YOUR_KEY"}" async></script>`
                )
                toast.success("Tracking script copied to clipboard")
              }}
            >
              <Check className="w-3 h-3" /> Copy
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Script v2.1 &middot; Loads async &middot; &lt;2 KB gzipped</p>
        </DialogContent>
      </Dialog>

      {/* Alert Rules Dialog */}
      <Dialog
        open={alertsOpen}
        onOpenChange={(o) => {
          setAlertsOpen(o)
          if (o) loadAlertSettings()
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Alert Rules</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Get notified when high-intent visitors match your ICP. Pick any subset of channels — they all fire on every identified visit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {[
              { label: "Hot account detected", desc: "Intent score above 70%", enabled: true },
              { label: "ICP match visit", desc: "Visitor matches your ideal customer profile", enabled: false },
              { label: "Return visitor", desc: "Known company visits again within 24h", enabled: false },
            ].map((rule) => (
              <div key={rule.label} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs font-bold">{rule.label}</p>
                  <p className="text-[10px] text-muted-foreground">{rule.desc}</p>
                </div>
                <Badge variant={rule.enabled ? "default" : "outline"} className="text-[9px]">
                  {rule.enabled ? "Active" : "Off"}
                </Badge>
              </div>
            ))}
          </div>

          <Separator className="my-2" />

          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs font-bold">Slack webhook</p>
              <p className="text-[10px] text-muted-foreground">
                Paste your Slack incoming webhook URL. Every new visit will post to that channel.
              </p>
              <Input
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../xxx"
                className="text-xs"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">Email alerts</p>
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailAlertEnabled}
                    onChange={(e) => setEmailAlertEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Get an email for every new visit. Leave empty to use your account email.
              </p>
              <Input
                value={emailAlertAddress}
                onChange={(e) => setEmailAlertAddress(e.target.value)}
                placeholder="alerts@yourcompany.com"
                className="text-xs"
                disabled={!emailAlertEnabled}
              />
            </div>

            {/* HubSpot */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">HubSpot CRM</p>
                <label className={cn(
                  "flex items-center gap-2 text-[10px] cursor-pointer",
                  !integrationStatus.hubspot && "text-muted-foreground/40 cursor-not-allowed"
                )}>
                  <input
                    type="checkbox"
                    checked={hubspotEnabled}
                    disabled={!integrationStatus.hubspot}
                    onChange={(e) => setHubspotEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Identified visitors with an email are pushed as HubSpot contacts (with intent score + visit URL custom properties).
              </p>
              {!integrationStatus.hubspot && (
                <button
                  type="button"
                  onClick={() => router.push("/integrations")}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Connect HubSpot in Integrations →
                </button>
              )}
            </div>

            {/* Instantly */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">Instantly</p>
                <label className={cn(
                  "flex items-center gap-2 text-[10px] cursor-pointer",
                  !integrationStatus.instantly && "text-muted-foreground/40 cursor-not-allowed"
                )}>
                  <input
                    type="checkbox"
                    checked={instantlyEnabled}
                    disabled={!integrationStatus.instantly}
                    onChange={(e) => setInstantlyEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Identified visitors with an email are added as leads to the Instantly campaign below.
              </p>
              <Input
                value={instantlyCampaignId}
                onChange={(e) => setInstantlyCampaignId(e.target.value)}
                placeholder="Instantly campaign ID"
                className="text-xs"
                disabled={!integrationStatus.instantly || !instantlyEnabled}
              />
              {!integrationStatus.instantly && (
                <button
                  type="button"
                  onClick={() => router.push("/integrations")}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Connect Instantly in Integrations →
                </button>
              )}
            </div>

            {/* Make.com / n8n / custom webhooks */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">Make.com · n8n · Custom webhooks</p>
                <button
                  type="button"
                  onClick={() => setExtraWebhookUrls([...extraWebhookUrls, ""])}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  + Add URL
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Any HTTPS webhook URL receives a generic JSON payload per visit. Make and n8n URLs are auto-detected and tagged in the payload.
              </p>
              {extraWebhookUrls.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60 italic">No custom webhooks configured.</p>
              ) : (
                extraWebhookUrls.map((u, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      value={u}
                      onChange={(e) => {
                        const next = [...extraWebhookUrls]
                        next[i] = e.target.value
                        setExtraWebhookUrls(next)
                      }}
                      placeholder="https://hook.us2.make.com/... or https://your.n8n.cloud/webhook/..."
                      className="text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setExtraWebhookUrls(extraWebhookUrls.filter((_, j) => j !== i))}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={saveAlertSettings} disabled={savingWebhook} className="h-7 text-[11px]">
                {savingWebhook ? "Saving..." : "Save"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Need a Slack URL? Slack → Apps → search “Incoming Webhooks” → add to a channel → copy the URL.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
