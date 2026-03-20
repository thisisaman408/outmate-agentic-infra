"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
    Users,
    Target,
    Zap,
    Copy,
    Globe,
    Clock,
    CheckCircle2,
    Code2,
    ExternalLink,
    AlertTriangle,
    Mail,
    Phone,
    Linkedin,
    FlaskConical,
    RefreshCw,
    TrendingUp,
    Building2,
    MapPin,
    Layers,
    Search,
    Flame,
    Eye,
    Download,
    X,
    CreditCard,
    BarChart3,
    Settings,
    Activity,
    ChevronRight,
    User,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts"
import { toast } from "sonner"

const PERIODS = [
    { label: "Today", hours: 24 },
    { label: "7 Days", hours: 168 },
    { label: "30 Days", hours: 720 },
] as const
type PeriodHours = (typeof PERIODS)[number]["hours"]

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
const API = "/api/v1/visitors"

// The pixel snippet shown to customers must use the public-facing app URL,
// NOT the backend URL. It goes through Next.js which proxies to the backend
// and correctly forwards the real client IP.
const PIXEL_HOST =
    typeof window !== "undefined"
        ? window.location.origin                         // always correct at runtime
        : process.env.NEXT_PUBLIC_APP_URL || "https://app.outmate.ai"

function getAuthHeaders(): Record<string, string> {
    const token = typeof window !== "undefined" ? localStorage.getItem("outmate_auth_token") : null
    return token ? { Authorization: `Bearer ${token}` } : {}
}

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
    source_site: string | null  // pixel owner's domain (set at track time)
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

// ── Helpers ─────────────────────────────────────────────────────────

function getIntent(score: number): { label: string; color: string; variant: "default" | "secondary" | "outline" | "destructive" } {
    if (score >= 0.7) return { label: "Hot", color: "text-red-500", variant: "destructive" }
    if (score >= 0.4) return { label: "Warm", color: "text-orange-500", variant: "default" }
    return { label: "Cold", color: "text-blue-500", variant: "secondary" }
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

function maskEmail(email: string): string {
    const [local, domain] = email.split("@")
    if (!domain) return email
    return local.slice(0, 2) + "***@" + domain
}

function maskPhone(phone: string): string {
    if (phone.length <= 4) return phone
    return phone.slice(0, 3) + "****" + phone.slice(-2)
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
    const companyLinkedin = visit.company_linkedin_url || visit.resolution?.explorium?.linkedin_url
    const website = visit.website || visit.resolution?.explorium?.website || (visit.domain ? `https://${visit.domain}` : null)
    const industry = visit.industry || visit.resolution?.explorium?.industry
    const employeeRange = visit.employee_count_range || visit.resolution?.explorium?.employee_count_range
    const revenueRange = visit.revenue_range || visit.resolution?.explorium?.revenue_range
    const technologies: string[] = visit.technologies || visit.resolution?.explorium?.technologies || []
    const fundingStage = visit.funding_stage || visit.resolution?.explorium?.funding_stage
    const sourceSite = visit.source_site || visit.resolution?.source_site || ""
    const logoUrl = visit.resolution?.logo_url || visit.resolution?.explorium?.logo_url || null
    const decisionMakers = visit.resolution?.decision_makers || []
    let pagePath = visit.url
    try { pagePath = new URL(visit.url).pathname } catch { }
    return { geo, company, email, phone, fullName, linkedinUrl, jobTitle, category, companyLinkedin, website, industry, employeeRange, revenueRange, technologies, fundingStage, pagePath, sourceSite, logoUrl, decisionMakers }
}

// Group visits by company for Companies tab
function groupByCompany(visits: Visit[]): Array<{
    company: string
    domain: string | null
    visits: Visit[]
    totalIntent: number
    lastSeen: string
    icpScore: number
    contacts: Array<{ name: string | null; email: string | null; title: string | null }>
}> {
    const map = new Map<string, Visit[]>()
    for (const v of visits) {
        const key = v.company || v.resolution?.company || v.domain || v.ip
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(v)
    }
    return Array.from(map.entries()).map(([company, groupVisits]) => {
        const contacts = new Map<string, { name: string | null; email: string | null; title: string | null }>()
        for (const v of groupVisits) {
            const d = extractVisitData(v)
            if (d.decisionMakers && d.decisionMakers.length > 0) {
                for (const dm of d.decisionMakers) {
                    const key = dm.email || dm.full_name || dm.linkedin_url
                    if (key && !contacts.has(key)) {
                        contacts.set(key, { name: dm.full_name || null, email: dm.email || null, title: dm.job_title || null })
                    }
                }
            } else {
                const key = d.email || d.fullName || v.ip
                if (!contacts.has(key)) {
                    contacts.set(key, { name: d.fullName || null, email: d.email || null, title: d.jobTitle || null })
                }
            }
        }
        const sorted = [...groupVisits].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return {
            company,
            domain: groupVisits[0]?.domain || null,
            visits: sorted,
            totalIntent: Math.max(...groupVisits.map(v => v.intent_score)),
            lastSeen: sorted[0]?.created_at || "",
            icpScore: Math.max(...groupVisits.map(getIcpScore)),
            contacts: Array.from(contacts.values()),
        }
    }).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
}

// ── Main Page ──────────────────────────────────────────────────────

export default function VisitorsPage() {
    const [visits, setVisits] = useState<Visit[]>([])
    const [stats, setStats] = useState({ total_visits: 0, matched_visits: 0, match_rate: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<VisitorAnalytics | null>(null)
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [period, setPeriod] = useState<PeriodHours>(720)
    const [testLoading, setTestLoading] = useState(false)
    const [siteConfig, setSiteConfig] = useState<{ pixel_key: string; domain: string; org_id: string } | null>(null)
    const [siteConfigLoading, setSiteConfigLoading] = useState(true)
    const [domainInput, setDomainInput] = useState("")
    const [savingDomain, setSavingDomain] = useState(false)
    const pixelKey = siteConfig?.pixel_key ?? "loading..."

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0)
    const [totalVisits, setTotalVisits] = useState(0)
    const PAGE_SIZE = 50

    // UI State
    const [activeTab, setActiveTab] = useState("companies")
    const [searchQuery, setSearchQuery] = useState("")
    const [filter, setFilter] = useState<"all" | "hot" | "icp" | "new">("all")
    const [icpMinScore, setIcpMinScore] = useState(0)
    const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
    const [selectedCompanyGroup, setSelectedCompanyGroup] = useState<ReturnType<typeof groupByCompany>[0] | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [revealedContacts, setRevealedContacts] = useState<Set<string>>(new Set())
    const [isExporting, setIsExporting] = useState(false)

    const fetchSiteConfig = async () => {
        setSiteConfigLoading(true)
        try {
            const res = await fetch(`${API}/site-config`, { headers: getAuthHeaders() })
            if (res.ok) { const cfg = await res.json(); setSiteConfig(cfg); setDomainInput(cfg.domain || "") }
        } catch { } finally { setSiteConfigLoading(false) }
    }

    const sendTestHit = async () => {
        setTestLoading(true)
        try {
            // Resolve real public IP — needed because Next.js rewrites proxy the
            // test-hit request via localhost, so the backend would see 127.0.0.1.
            // Strategy: try our own route first (works in production behind a
            // reverse proxy that sets x-forwarded-for), then fall back to ipify
            // (always works in local dev, direct browser fetch).
            let realIp: string | undefined
            try {
                const ipRes = await fetch("/api/my-ip", { cache: "no-store" })
                if (ipRes.ok) {
                    const { ip } = await ipRes.json()
                    if (ip && ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") realIp = ip
                }
            } catch { }
            if (!realIp) {
                try {
                    const ipRes = await fetch("https://api64.ipify.org?format=json", { cache: "no-store" })
                    if (ipRes.ok) realIp = (await ipRes.json()).ip
                } catch { }
            }

            const res = await fetch(`${API}/test-hit`, {
                method: "POST",
                headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify(realIp ? { ip: realIp } : {}),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(`Test visit queued from IP ${data.ip} — refreshing in 3s…`)
                setTimeout(fetchData, 3000)
                setTimeout(fetchAnalytics, 3000)
            } else {
                toast.error(data.detail || data.error || "Test hit failed")
            }
        } catch { toast.error("Cannot reach backend") } finally { setTestLoading(false) }
    }

    const fetchData = async (page = currentPage) => {
        setError(null)
        try {
            const headers = getAuthHeaders()
            const offset = page * PAGE_SIZE
            const [visitsRes, statsRes] = await Promise.all([
                fetch(`${API}?limit=${PAGE_SIZE}&offset=${offset}`, { headers }),
                fetch(`${API}/stats`, { headers })
            ])
            if (visitsRes.ok) {
                const data = await visitsRes.json()
                // Handle new paginated format { visits, total, has_more } OR legacy array
                if (Array.isArray(data)) {
                    setVisits(data)
                } else if (data.visits) {
                    setVisits(data.visits)
                    setTotalVisits(data.total ?? data.visits.length)
                } else if (data.error) {
                    setError(data.error)
                }
            } else if (visitsRes.status === 503) {
                const errData = await visitsRes.json()
                setError(errData.error || "Database temporarily unavailable")
            }
            if (statsRes.ok) {
                const statsData = await statsRes.json()
                setStats({ total_visits: statsData.total_visits ?? 0, matched_visits: statsData.matched_visits ?? 0, match_rate: statsData.match_rate ?? 0 })
            }
        } catch {
            setError("Cannot connect to backend. Ensure the server is running on port 8000.")
        } finally { setIsLoading(false) }
    }

    const fetchAnalytics = useCallback(async (h: PeriodHours = period) => {
        setAnalyticsLoading(true)
        try {
            const res = await fetch(`${API}/analytics?hours=${h}&top_n=10`, { headers: getAuthHeaders() })
            if (!res.ok) {
                if (res.status === 503) { const d = await res.json().catch(() => null); setError(d?.error || "Database temporarily unavailable") }
                return
            }
            setAnalytics(await res.json())
        } catch { } finally { setAnalyticsLoading(false) }
    }, [period])

    const handlePeriodChange = (h: PeriodHours) => { setPeriod(h); fetchAnalytics(h) }

    const copyPixel = () => {
        navigator.clipboard.writeText(`<script src="${PIXEL_HOST}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey}"></script>`)
        toast.success("Pixel snippet copied to clipboard!")
    }

    const saveDomain = async () => {
        if (!domainInput.trim()) return
        setSavingDomain(true)
        try {
            const domain = domainInput.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "")
            const res = await fetch(`${API}/site-config`, {
                method: "POST",
                headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                body: JSON.stringify({ domain }),
            })
            if (res.ok) {
                setSiteConfig(prev => prev ? { ...prev, domain } : prev)
                setDomainInput(domain)
                toast.success("Website domain saved! Visitors will now be tagged with this site.")
            } else {
                toast.error("Failed to save domain")
            }
        } catch { toast.error("Failed to save domain") } finally { setSavingDomain(false) }
    }

    const exportCsv = async (matchedOnly = false) => {
        setIsExporting(true)
        try {
            const hours = period
            const params = new URLSearchParams({ format: "csv", hours: String(hours), matched_only: String(matchedOnly) })
            const res = await fetch(`${API}/export?${params}`, { headers: getAuthHeaders() })
            if (!res.ok) { toast.error("Export failed"); return }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `visitors_${hours}h${matchedOnly ? "_identified" : ""}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success("CSV exported!")
        } catch { toast.error("Export failed") } finally { setIsExporting(false) }
    }

    useEffect(() => {
        setMounted(true)
        fetchData()
        fetchAnalytics()
        fetchSiteConfig()

        const interval = setInterval(fetchData, 30000)
        const analyticsInterval = setInterval(() => fetchAnalytics(period), 60000)

        const streamToken = typeof window !== "undefined" ? localStorage.getItem("outmate_auth_token") : null
        // Use the backend URL directly for SSE (EventSource can't add headers,
        // and Next.js rewrites don't stream properly in all deploy configs).
        const streamBase = API_BASE
        const streamUrl = streamToken
            ? `${streamBase}/api/v1/visitors/stream?token=${encodeURIComponent(streamToken)}`
            : `${streamBase}/api/v1/visitors/stream`

        let es: EventSource | null = null
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
        let reconnectDelay = 1000

        const connectSSE = () => {
            if (es) { try { es.close() } catch { } }
            es = new EventSource(streamUrl)
            es.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data)
                    if (msg?.type === "visit_created" && msg?.visit) {
                        const v = msg.visit as Visit
                        // Prepend new visit and refresh full list to get DB-persisted data
                        setVisits((prev) => {
                            const already = prev.some(x => x.id === v.id)
                            if (already) return prev
                            return [v, ...prev].slice(0, 200)
                        })
                        setStats((s) => {
                            const total = (s.total_visits ?? 0) + 1
                            const matched = (s.matched_visits ?? 0) + (v.matched ? 1 : 0)
                            return { total_visits: total, matched_visits: matched, match_rate: total > 0 ? (matched / total) * 100 : 0 }
                        })
                        // After 3s, do a full refresh to get the enriched version
                        // (enrichment runs async after the SSE event fires)
                        setTimeout(() => fetchData(), 3000)
                        reconnectDelay = 1000 // reset backoff on success
                    }
                } catch { }
            }
            es.onerror = () => {
                try { es?.close() } catch { }
                es = null
                reconnectTimeout = setTimeout(() => {
                    reconnectDelay = Math.min(reconnectDelay * 2, 30000)
                    connectSSE()
                }, reconnectDelay)
            }
        }
        connectSSE()

        return () => {
            clearInterval(interval)
            clearInterval(analyticsInterval)
            if (reconnectTimeout) clearTimeout(reconnectTimeout)
            if (es) try { es.close() } catch { }
        }
    }, [])

    // Filtered visits
    const filteredVisits = useMemo(() => {
        let result = visits
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(v => {
                const d = extractVisitData(v)
                return (d.company || "").toLowerCase().includes(q) ||
                    (d.fullName || "").toLowerCase().includes(q) ||
                    (d.email || "").toLowerCase().includes(q) ||
                    (v.domain || "").toLowerCase().includes(q)
            })
        }
        if (filter === "hot") result = result.filter(v => v.intent_score >= 0.7)
        else if (filter === "icp") result = result.filter(v => (v.resolution?.icp_score ?? getIcpScore(v)) >= 50)
        else if (filter === "new") {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            result = result.filter(v => new Date(v.created_at) >= today)
        }
        if (icpMinScore > 0) result = result.filter(v => (v.resolution?.icp_score ?? getIcpScore(v)) >= icpMinScore)
        return result
    }, [visits, searchQuery, filter, icpMinScore])

    const companyGroups = useMemo(() => groupByCompany(filteredVisits), [filteredVisits])

    const hotAccounts = useMemo(() => companyGroups.filter(g => g.totalIntent >= 0.7).length, [companyGroups])
    const icpMatchRate = useMemo(() => {
        if (!visits.length) return 0
        const matched = visits.filter(v => (v.resolution?.icp_score ?? getIcpScore(v)) >= 50).length
        return Math.round((matched / visits.length) * 100)
    }, [visits])

    const openSidebar = (visit: Visit, companyGroup?: ReturnType<typeof groupByCompany>[0]) => {
        setSelectedVisit(visit)
        setSelectedCompanyGroup(companyGroup || null)
        setSidebarOpen(true)
    }

    const revealContact = (id: string) => {
        setRevealedContacts(prev => new Set(prev).add(id))
    }

    if (!mounted) return <div className="p-6 animate-pulse">Loading dashboard...</div>

    return (
        <div className="space-y-4">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">Visitor Identification</h1>
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
                        <Activity className="h-3 w-3" />
                        LIVE
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={sendTestHit} disabled={testLoading}>
                        {testLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                        {testLoading ? "Sending…" : "Test Hit"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCsv(false)} disabled={isExporting}>
                        {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {isExporting ? "Exporting…" : "Export CSV"}
                    </Button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="flex items-center gap-3 py-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 flex-1">{error}</p>
                        <Button size="sm" variant="outline" onClick={fetchData}>Retry</Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Tabs ───────────────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="companies" className="gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Companies
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{companyGroups.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="people" className="gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            People
                            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{filteredVisits.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Analytics
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-1.5">
                            <Settings className="h-3.5 w-3.5" />
                            Settings
                        </TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        {PERIODS.map((p) => (
                            <Button key={p.hours} size="sm" variant={period === p.hours ? "default" : "ghost"} className="h-7 px-3 text-xs" onClick={() => handlePeriodChange(p.hours)}>
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* ── Stats Row ────────────────────────────────── */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mt-4">
                    {[
                        { label: "Companies", value: analytics?.summary?.companies ?? companyGroups.length, icon: <Building2 className="h-4 w-4" /> },
                        { label: "ICP Match", value: `${icpMatchRate}%`, icon: <Target className="h-4 w-4" /> },
                        { label: "Hot Accounts", value: hotAccounts, icon: <Flame className="h-4 w-4" /> },
                        { label: "Prospects", value: analytics?.summary?.prospects ?? "—", icon: <Users className="h-4 w-4" /> },
                        { label: "Bounce Rate", value: analytics?.summary?.bounce_rate !== undefined ? `${analytics.summary.bounce_rate}%` : "—", icon: <Activity className="h-4 w-4" /> },
                        { label: "Sessions", value: analytics?.summary?.total_sessions ?? "—", icon: <Layers className="h-4 w-4" /> },
                        { label: "Conversions", value: analytics?.summary?.conversions ?? "—", icon: <Zap className="h-4 w-4" /> },
                    ].map((s) => (
                        <Card key={s.label} className="py-3">
                            <CardContent className="px-4 py-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-muted-foreground">{s.label}</span>
                                    <span className="text-muted-foreground">{s.icon}</span>
                                </div>
                                <div className="text-xl font-bold">{analyticsLoading ? "…" : s.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ── Companies Tab ──────────────────────────── */}
                <TabsContent value="companies" className="space-y-4 mt-4">
                    {/* Charts row */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Visitor Identification</CardTitle>
                                <CardDescription>Total vs identified breakdown</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {analyticsLoading ? (
                                    <div className="h-[220px] animate-pulse bg-muted/40 rounded-lg" />
                                ) : !analytics?.timeseries?.length ? (
                                    <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={analytics.timeseries.map(t => ({
                                            ...t,
                                            label: analytics.window.use_daily ? t.bucket.slice(5) : new Date(t.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                        }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                                            <Legend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="company" name="Companies" fill="#34d399" radius={[3, 3, 0, 0]} stackId="id" />
                                            <Bar dataKey="prospect" name="Prospects" fill="#fb923c" radius={[3, 3, 0, 0]} stackId="id" />
                                            <Bar dataKey="unknown" name="Unknown" fill="#94a3b8" radius={[3, 3, 0, 0]} stackId="id" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Top Pages</CardTitle>
                                <CardDescription>Most visited pages</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {analyticsLoading ? (
                                    <div className="h-[220px] animate-pulse bg-muted/40 rounded-lg" />
                                ) : !analytics?.top_pages?.length ? (
                                    <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={analytics.top_pages.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis type="category" dataKey="page" tick={{ fontSize: 10 }} width={120} stroke="hsl(var(--muted-foreground))" />
                                            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                                            <Bar dataKey="count" name="Visits" fill="#818cf8" radius={[0, 3, 3, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search + Filters */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search companies, people, emails..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1">
                            {([
                                { key: "all", label: "All" },
                                { key: "hot", label: "Hot" },
                                { key: "icp", label: "ICP Match" },
                                { key: "new", label: "New Today" },
                            ] as const).map(f => (
                                <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} className="h-8 px-3 text-xs" onClick={() => setFilter(f.key)}>
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Companies Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Company</TableHead>
                                        <TableHead className="w-[140px]">ICP Score</TableHead>
                                        <TableHead className="w-[100px]">Intent</TableHead>
                                        <TableHead className="w-[80px]">Pages</TableHead>
                                        <TableHead className="w-[120px]">Last Seen</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10">Loading...</TableCell></TableRow>
                                    ) : companyGroups.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                            {error ? "Unable to load visitors." : "No visitors yet. Install the pixel to get started!"}
                                        </TableCell></TableRow>
                                    ) : companyGroups.map((group) => {
                                        const intent = getIntent(group.totalIntent)
                                        const firstVisit = group.visits[0]
                                        const d = extractVisitData(firstVisit)
                                        return (
                                            <TableRow key={group.company} className="cursor-pointer hover:bg-muted/50" onClick={() => openSidebar(firstVisit, group)}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                                                            {(group.company || "?").charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">{group.company || "Anonymous"}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {[d.industry, d.employeeRange && `${d.employeeRange} emp`].filter(Boolean).join(" · ") || group.domain || "—"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={group.icpScore} className="h-2 flex-1" />
                                                        <span className="text-xs font-medium w-8 text-right">{group.icpScore}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={intent.variant} className="text-xs">
                                                        {intent.label === "Hot" && <Flame className="h-3 w-3 mr-1" />}
                                                        {intent.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{group.visits.length}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-muted-foreground">
                                                        {group.lastSeen ? new Date(group.lastSeen).toLocaleDateString([], { month: "short", day: "numeric" }) + " " + new Date(group.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── People Tab ──────────────────────────────── */}
                <TabsContent value="people" className="space-y-4 mt-4">
                    {/* Search + Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[180px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search people, emails..." className="pl-9 h-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-1">
                            {([
                                { key: "all", label: "All" },
                                { key: "hot", label: "Hot" },
                                { key: "icp", label: "ICP Match" },
                                { key: "new", label: "New Today" },
                            ] as const).map(f => (
                                <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} className="h-8 px-3 text-xs" onClick={() => setFilter(f.key)}>
                                    {f.label}
                                </Button>
                            ))}
                        </div>
                        {/* ICP minimum score filter */}
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">ICP ≥ {icpMinScore}%</span>
                            <input
                                type="range"
                                min={0}
                                max={80}
                                step={10}
                                value={icpMinScore}
                                onChange={e => setIcpMinScore(Number(e.target.value))}
                                className="w-24 h-2 accent-primary cursor-pointer"
                            />
                            {icpMinScore > 0 && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setIcpMinScore(0)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => exportCsv(false)} disabled={isExporting}>
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </Button>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Person</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead className="w-[140px]">ICP Score</TableHead>
                                        <TableHead className="w-[100px]">Intent</TableHead>
                                        <TableHead>Page</TableHead>
                                        <TableHead className="w-[120px]">Time</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-10">Loading...</TableCell></TableRow>
                                    ) : filteredVisits.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No visitors found</TableCell></TableRow>
                                    ) : filteredVisits.map((visit) => {
                                        const d = extractVisitData(visit)
                                        const intent = getIntent(visit.intent_score)
                                        const icp = visit.resolution?.icp_score ?? getIcpScore(visit)
                                        return (
                                            <TableRow key={visit.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openSidebar(visit)}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                                            {d.fullName ? d.fullName.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-sm">{d.fullName || d.email || "Anonymous"}</div>
                                                            <div className="text-xs text-muted-foreground">{d.fullName ? (d.jobTitle || d.email || visit.ip) : (d.jobTitle || visit.ip)}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {d.company ? (
                                                        <span className="text-sm font-medium">{d.company}</span>
                                                    ) : d.sourceSite ? (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Globe className="h-3 w-3 flex-shrink-0" />
                                                            {d.sourceSite}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={icp} className="h-2 flex-1" />
                                                        <span className="text-xs font-medium w-8 text-right">{icp}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={intent.variant} className="text-xs">
                                                        {intent.label === "Hot" && <Flame className="h-3 w-3 mr-1" />}
                                                        {intent.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-muted-foreground truncate max-w-[150px] block" title={visit.url}>{d.pagePath}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs text-muted-foreground">{new Date(visit.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Pagination Controls */}
                    {totalVisits > PAGE_SIZE && (
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-muted-foreground">
                                Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalVisits)} of {totalVisits} visits
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs"
                                    disabled={currentPage === 0 || isLoading}
                                    onClick={() => { const p = currentPage - 1; setCurrentPage(p); fetchData(p) }}
                                >
                                    ← Prev
                                </Button>
                                <span className="text-xs text-muted-foreground">
                                    Page {currentPage + 1} / {Math.ceil(totalVisits / PAGE_SIZE)}
                                </span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs"
                                    disabled={(currentPage + 1) * PAGE_SIZE >= totalVisits || isLoading}
                                    onClick={() => { const p = currentPage + 1; setCurrentPage(p); fetchData(p) }}
                                >
                                    Next →
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ── Analytics Tab ───────────────────────────── */}
                <TabsContent value="analytics" className="space-y-4 mt-4">
                    {/* Traffic chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                                {period === 24 ? "Hourly Traffic (Today)" : period === 168 ? "Daily Traffic (Last 7 Days)" : "Daily Traffic (Last 30 Days)"}
                            </CardTitle>
                            <CardDescription>Total visits vs. identified companies/prospects</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {analyticsLoading ? (
                                <div className="h-[280px] animate-pulse bg-muted/40 rounded-lg" />
                            ) : !analytics?.timeseries?.length ? (
                                <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No traffic data for this period.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={analytics.timeseries.map(t => ({
                                        ...t,
                                        label: analytics.window.use_daily ? t.bucket.slice(5) : new Date(t.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                    }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ fontWeight: 600 }} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="total" name="Total" fill="#818cf8" radius={[3, 3, 0, 0]} />
                                        <Bar dataKey="company" name="Companies" fill="#34d399" radius={[3, 3, 0, 0]} stackId="identified" />
                                        <Bar dataKey="prospect" name="Prospects" fill="#fb923c" radius={[3, 3, 0, 0]} stackId="identified" />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* Top pages + referrers */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2"><ExternalLink className="h-4 w-4 text-muted-foreground" />Top Pages</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {analyticsLoading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                    : (analytics?.top_pages || []).map((p) => {
                                        const max = analytics!.top_pages[0]?.count || 1
                                        return (
                                            <div key={p.page} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="truncate font-mono text-xs" title={p.page}>{p.page}</span>
                                                    <Badge variant="secondary" className="ml-2 shrink-0">{p.count}</Badge>
                                                </div>
                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(p.count / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                {!analyticsLoading && !analytics?.top_pages?.length && <p className="text-sm text-muted-foreground">—</p>}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" />Top Referrers</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {analyticsLoading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                    : (analytics?.top_referrers || []).map((r) => {
                                        const max = analytics!.top_referrers[0]?.count || 1
                                        return (
                                            <div key={r.referrer} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="truncate text-xs" title={r.referrer}>{r.referrer}</span>
                                                    <Badge variant="secondary" className="ml-2 shrink-0">{r.count}</Badge>
                                                </div>
                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                {!analyticsLoading && !analytics?.top_referrers?.length && <p className="text-sm text-muted-foreground">—</p>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Geo + Industry + Tech */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Top Countries</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {analyticsLoading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                    : (analytics?.geo_countries || []).map((g) => {
                                        const max = analytics!.geo_countries[0]?.count || 1
                                        return (
                                            <div key={g.country} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-xs">{g.country}</span>
                                                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">{g.count}</Badge>
                                                </div>
                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-green-400/60 rounded-full" style={{ width: `${(g.count / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                {!analyticsLoading && !analytics?.geo_countries?.length && <p className="text-sm text-muted-foreground">No geo data yet</p>}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />Industries</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {analyticsLoading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                    : (analytics?.industry_breakdown || []).map((ind) => {
                                        const max = analytics!.industry_breakdown[0]?.count || 1
                                        return (
                                            <div key={ind.industry} className="space-y-0.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="truncate text-xs" title={ind.industry}>{ind.industry}</span>
                                                    <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">{ind.count}</Badge>
                                                </div>
                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-orange-400/60 rounded-full" style={{ width: `${(ind.count / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                {!analyticsLoading && !analytics?.industry_breakdown?.length && <p className="text-sm text-muted-foreground">No industry data yet</p>}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" />Technologies</CardTitle></CardHeader>
                            <CardContent>
                                {analyticsLoading ? <div className="flex flex-wrap gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-6 w-16 animate-pulse bg-muted/40 rounded-full" />)}</div>
                                    : (analytics?.top_technologies || []).length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {(analytics?.top_technologies || []).map((t) => (
                                                <Badge key={t.tech} variant="secondary" className="text-xs gap-1">{t.tech}<span className="text-muted-foreground font-normal">{t.count}</span></Badge>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground">No technology data yet</p>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Intent distribution */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-muted-foreground" />Intent Score Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {analyticsLoading ? (
                                <div className="h-[180px] animate-pulse bg-muted/40 rounded-lg" />
                            ) : (analytics?.intent_distribution?.some(d => d.count > 0)) ? (
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={analytics!.intent_distribution} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                                        <Bar dataKey="count" name="Visitors" fill="#818cf8" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No intent data yet.</div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Settings Tab ────────────────────────────── */}
                <TabsContent value="settings" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Install the Visitor Tracking Pixel</CardTitle>
                            <CardDescription>Embed this pixel on any website to identify anonymous B2B visitors in real-time.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Website domain — used to label visitors in the dashboard */}
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Your Website Domain</p>
                                <p className="text-xs text-muted-foreground">
                                    Enter the domain where you installed the pixel. Visitors tracked from your site will be labelled with this name in the dashboard.
                                </p>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g. mycompany.com"
                                        value={domainInput}
                                        onChange={e => setDomainInput(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && saveDomain()}
                                        className="font-mono text-sm"
                                    />
                                    <Button onClick={saveDomain} disabled={savingDomain || !domainInput.trim()} size="sm" className="shrink-0">
                                        {savingDomain ? "Saving…" : siteConfig?.domain ? "Update" : "Save"}
                                    </Button>
                                </div>
                                {siteConfig?.domain && (
                                    <p className="text-xs text-success flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Currently tracking: <strong>{siteConfig.domain}</strong>
                                    </p>
                                )}
                            </div>

                            <Separator />

                            {/* Pixel key banner */}
                            <div className="flex items-center justify-between bg-muted/60 border rounded-lg px-4 py-3">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Your Pixel Key</p>
                                    <code className="text-sm font-mono font-bold text-primary">{siteConfigLoading ? "Loading…" : pixelKey}</code>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(pixelKey); toast.success("Pixel key copied!") }}>
                                    <Copy className="h-3.5 w-3.5" /> Copy Key
                                </Button>
                            </div>

                            {/* Snippets */}
                            {[
                                { title: "HTML / Any website", icon: <Code2 className="h-4 w-4 text-primary" />, desc: <>Paste inside <code>&lt;head&gt;</code> or before <code>&lt;/body&gt;</code>.</>, snippet: `<script\n  src="${PIXEL_HOST}/api/v1/visitors/pixel.js"\n  data-pixel-key="${pixelKey}"\n  async\n></script>` },
                                { title: "Next.js (App Router)", icon: <ExternalLink className="h-4 w-4 text-primary" />, desc: <>Add to <code>app/layout.tsx</code> inside <code>&lt;head&gt;</code>.</>, snippet: `// app/layout.tsx\n<head>\n  <script\n    src="${PIXEL_HOST}/api/v1/visitors/pixel.js"\n    data-pixel-key="${pixelKey}"\n    async\n  />\n</head>` },
                                { title: "WordPress / Shopify", icon: <Globe className="h-4 w-4 text-primary" />, desc: <>Paste before <code>&lt;/head&gt;</code> in your theme.</>, snippet: `<script src="${PIXEL_HOST}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey}" async></script>` },
                            ].map(s => (
                                <div key={s.title}>
                                    <p className="font-semibold mb-1.5 flex items-center gap-2 text-sm">{s.icon} {s.title}</p>
                                    <p className="text-muted-foreground text-xs mb-2">{s.desc}</p>
                                    <div className="bg-muted rounded-lg p-3 font-mono text-xs relative group">
                                        <pre className="whitespace-pre-wrap break-all">{s.snippet}</pre>
                                        <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={copyPixel}><Copy className="h-3 w-3" /></Button>
                                    </div>
                                </div>
                            ))}

                            {/* Verify + How it works */}
                            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                                <p className="font-semibold text-sm">Verify Installation</p>
                                <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                                    <li>Embed the snippet on your site and open any page.</li>
                                    <li>Click <strong>Test Hit</strong> above — a new entry should appear within ~5 seconds.</li>
                                    <li>Check DevTools → Network for a <code>track</code> POST with status 200.</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ── Detail Sidebar (Sheet) ─────────────────────────── */}
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
                    {selectedVisit && (() => {
                        const d = extractVisitData(selectedVisit)
                        const icp = selectedVisit.resolution?.icp_score ?? getIcpScore(selectedVisit)
                        const intent = getIntent(selectedVisit.intent_score)
                        const group = selectedCompanyGroup
                        return (
                            <>
                                <SheetHeader className="pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0 border shadow-sm">
                                            {d.logoUrl ? (
                                                <img src={d.logoUrl} alt={d.company || ""} className="h-full w-full object-contain bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.setAttribute('style', 'display: flex;') }} />
                                            ) : null}
                                            <div className="flex h-full w-full items-center justify-center font-bold text-lg" style={{ display: d.logoUrl ? 'none' : 'flex' }}>
                                                {(d.company || d.fullName || "?").charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div>
                                            <SheetTitle className="text-lg">{d.company || d.fullName || d.email || "Anonymous Visitor"}</SheetTitle>
                                            <p className="text-sm text-muted-foreground">
                                                {[d.industry, d.employeeRange && `${d.employeeRange} employees`].filter(Boolean).join(" · ") || selectedVisit.domain || selectedVisit.ip}
                                            </p>
                                        </div>
                                    </div>
                                </SheetHeader>

                                {/* ICP Score */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">ICP Score</span>
                                        <span className="font-bold">{icp}%</span>
                                    </div>
                                    <Progress value={icp} className="h-3" />
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    {[
                                        { label: "Pages Viewed", value: group?.visits.length || 1, icon: <Eye className="h-3.5 w-3.5" /> },
                                        { label: "Intent", value: intent.label, icon: <Flame className="h-3.5 w-3.5" /> },
                                        { label: "Last Seen", value: new Date(selectedVisit.created_at).toLocaleDateString([], { month: "short", day: "numeric" }), icon: <Clock className="h-3.5 w-3.5" /> },
                                        { label: "Location", value: d.geo ? [d.geo.city, (d.geo as any).country].filter(Boolean).join(", ") : "Unknown", icon: <MapPin className="h-3.5 w-3.5" /> },
                                        ...(d.sourceSite ? [{ label: "Tracked On", value: d.sourceSite, icon: <Globe className="h-3.5 w-3.5" /> }] : []),
                                    ].map(s => (
                                        <div key={s.label} className="bg-muted/50 rounded-lg p-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
                                            <div className="text-sm font-medium">{s.value}</div>
                                        </div>
                                    ))}
                                </div>

                                <Separator className="my-4" />

                                {/* Contacts */}
                                <div className="space-y-3 mb-4">
                                    <h3 className="text-sm font-semibold">Contacts</h3>
                                    {(group?.contacts || [{ name: d.fullName, email: d.email, title: d.jobTitle }]).map((contact, i) => {
                                        const contactId = contact.email || contact.name || `${i}`
                                        const revealed = revealedContacts.has(contactId)
                                        return (
                                            <div key={contactId} className="border rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-sm">{contact.name || "Unknown"}</div>
                                                        {contact.title && <div className="text-xs text-muted-foreground">{contact.title}</div>}
                                                    </div>
                                                    {!revealed && (contact.email || d.phone) && (
                                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => revealContact(contactId)}>
                                                            <Eye className="h-3 w-3" /> Reveal
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    {contact.email && (
                                                        <a href={revealed ? `mailto:${contact.email}` : undefined} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                                            <Mail className="h-3 w-3" />
                                                            {revealed ? contact.email : maskEmail(contact.email)}
                                                        </a>
                                                    )}
                                                    {d.phone && i === 0 && (
                                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <Phone className="h-3 w-3" />
                                                            {revealed ? d.phone : maskPhone(d.phone)}
                                                        </span>
                                                    )}
                                                    {d.linkedinUrl && i === 0 && (
                                                        <a href={d.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                                            <Linkedin className="h-3 w-3" /> LinkedIn Profile
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <Separator className="my-4" />

                                {/* Pages Visited */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold">Pages Visited</h3>
                                    <div className="space-y-1.5">
                                        {(group?.visits || [selectedVisit]).map((v) => {
                                            let path = v.url
                                            try { path = new URL(v.url).pathname } catch { }
                                            return (
                                                <div key={v.id} className="flex items-center justify-between text-xs bg-muted/40 rounded px-3 py-2">
                                                    <span className="font-mono truncate flex-1" title={v.url}>{path}</span>
                                                    <span className="text-muted-foreground ml-2 shrink-0">{new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Company links */}
                                {(d.website || d.companyLinkedin) && (
                                    <>
                                        <Separator className="my-4" />
                                        <div className="flex gap-2">
                                            {d.website && (
                                                <a href={d.website} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"><Globe className="h-3 w-3" />Website</Button>
                                                </a>
                                            )}
                                            {d.companyLinkedin && (
                                                <a href={d.companyLinkedin} target="_blank" rel="noopener noreferrer">
                                                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"><Linkedin className="h-3 w-3" />Company LinkedIn</Button>
                                                </a>
                                            )}
                                        </div>
                                    </>
                                )}
                            </>
                        )
                    })()}
                </SheetContent>
            </Sheet>
        </div>
    )
}
