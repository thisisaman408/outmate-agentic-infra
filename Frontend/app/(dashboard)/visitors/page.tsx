"use client"

import { useEffect, useState } from "react"
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

// All API calls use relative URLs so they route through the Next.js proxy
// (next.config.mjs rewrites /api/* → backend). This avoids CORS entirely.
// API_BASE is kept only for the pixel snippet shown in the setup dialog.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
const API = "/api/v1/visitors"

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
    // Company identity
    company: string | null
    domain: string | null
    website: string | null
    geo: { city: string; region: string; country: string } | null
    confidence: number
    // Person contact (Enrich.so)
    email: string | null
    phone: string | null
    full_name: string | null
    linkedin_url: string | null
    job_title: string | null
    // Company firmographics (Explorium)
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
}

interface VisitorAnalytics {
    window: { hours: number; since: string; use_daily: boolean }
    live: { window_minutes: number; unique_ips: number }
    summary: { total: number; matched: number; companies: number; prospects: number; match_rate: number }
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

export default function VisitorsPage() {
    const [visits, setVisits] = useState<Visit[]>([])
    const [stats, setStats] = useState({ total_visits: 0, matched_visits: 0, match_rate: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [analytics, setAnalytics] = useState<VisitorAnalytics | null>(null)
    const [analyticsLoading, setAnalyticsLoading] = useState(false)
    const [period, setPeriod] = useState<PeriodHours>(24)
    const [segment, setSegment] = useState<"all" | "company" | "prospect">("all")
    const [testLoading, setTestLoading] = useState(false)
    const [siteConfig, setSiteConfig] = useState<{ pixel_key: string; domain: string; org_id: string } | null>(null)
    const [siteConfigLoading, setSiteConfigLoading] = useState(true)
    const pixelKey = siteConfig?.pixel_key ?? "loading..."

    const fetchSiteConfig = async () => {
        setSiteConfigLoading(true)
        try {
            const res = await fetch(`${API}/site-config`, { headers: getAuthHeaders() })
            if (res.ok) {
                const config = await res.json()
                setSiteConfig(config)
                console.log("[VisitorsPage] Active SiteConfig:", config)
            }
        } catch { /* non-fatal */ } finally {
            setSiteConfigLoading(false)
        }
    }

    const sendTestHit = async () => {
        setTestLoading(true)
        try {
            const res = await fetch(`${API}/test-hit`, { method: "POST", headers: getAuthHeaders() })
            const data = await res.json()
            if (res.ok) {
                toast.success(`Test visit queued from IP ${data.ip} — refreshing in 3s…`)
                setTimeout(fetchData, 3000)
                setTimeout(fetchAnalytics, 3000)
            } else {
                toast.error(data.detail || data.error || "Test hit failed")
            }
        } catch {
            toast.error("Cannot reach backend")
        } finally {
            setTestLoading(false)
        }
    }

    const fetchData = async () => {
        setError(null)
        try {
            const headers = getAuthHeaders()
            const [visitsRes, statsRes] = await Promise.all([
                fetch(`${API}`, { headers }),
                fetch(`${API}/stats`, { headers })
            ])

            if (visitsRes.ok) {
                const data = await visitsRes.json()
                // Handle both array response and error object
                if (Array.isArray(data)) {
                    setVisits(data)
                } else if (data.error) {
                    setError(data.error)
                }
            } else if (visitsRes.status === 503) {
                const errData = await visitsRes.json()
                setError(errData.error || "Database temporarily unavailable")
            }

            if (statsRes.ok) {
                const statsData = await statsRes.json()
                setStats({
                    total_visits: statsData.total_visits ?? 0,
                    matched_visits: statsData.matched_visits ?? 0,
                    match_rate: statsData.match_rate ?? 0,
                })
            }
        } catch (err) {
            console.error("Failed to fetch visitor data:", err)
            setError("Cannot connect to backend. Ensure the server is running on port 8000.")
        } finally {
            setIsLoading(false)
        }
    }

    const fetchAnalytics = async (h: PeriodHours = period) => {
        setAnalyticsLoading(true)
        try {
            const res = await fetch(`${API}/analytics?hours=${h}&top_n=10`, { headers: getAuthHeaders() })
            if (!res.ok) {
                const errData = await res.json().catch(() => null)
                if (res.status === 503) setError(errData?.error || "Database temporarily unavailable")
                return
            }
            const data = (await res.json()) as VisitorAnalytics
            setAnalytics(data)
        } catch (err) {
            console.error("Failed to fetch visitor analytics:", err)
        } finally {
            setAnalyticsLoading(false)
        }
    }

    const handlePeriodChange = (h: PeriodHours) => {
        setPeriod(h)
        fetchAnalytics(h)
    }

    const copyPixel = () => {
        const snippet = `<script src="${API_BASE}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey}"></script>`
        navigator.clipboard.writeText(snippet)
        toast.success("Pixel snippet copied to clipboard!")
    }

    useEffect(() => {
        setMounted(true)
        fetchData()
        fetchAnalytics()
        fetchSiteConfig()

        const interval = setInterval(fetchData, 30000)
        const analyticsInterval = setInterval(() => fetchAnalytics(period), 60000)

        // SSE must connect DIRECTLY to the backend (not through the Next.js proxy).
        // Next.js rewrites buffer responses, which breaks streaming. In production
        // (Azure Static Web Apps → api.outmate.ai) the browser hits the backend directly;
        // CORS is handled by the backend's CORSMiddleware for the frontend origin.
        const streamToken = typeof window !== "undefined" ? localStorage.getItem("outmate_auth_token") : null
        const streamBase = API_BASE  // e.g. http://127.0.0.1:8000 (dev) or https://api.outmate.ai (prod)
        const streamUrl = streamToken
            ? `${streamBase}/api/v1/visitors/stream?token=${encodeURIComponent(streamToken)}`
            : `${streamBase}/api/v1/visitors/stream`
        const es = new EventSource(streamUrl)
        es.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data)
                if (msg?.type === "visit_created" && msg?.visit) {
                    const v = msg.visit as Visit
                    setVisits((prev) => [v, ...prev].slice(0, 200))
                    setStats((s) => {
                        const total = (s.total_visits ?? 0) + 1
                        const matched = (s.matched_visits ?? 0) + (v.matched ? 1 : 0)
                        return {
                            total_visits: total,
                            matched_visits: matched,
                            match_rate: total > 0 ? (matched / total) * 100 : 0,
                        }
                    })
                }
            } catch {
                // ignore
            }
        }
        es.onerror = () => {
            // avoid noisy console; polling still keeps UI fresh
            es.close()
        }

        return () => {
            clearInterval(interval)
            clearInterval(analyticsInterval)
            es.close()
        }
    }, [])

    if (!mounted) return <div className="p-6 animate-pulse">Loading dashboard...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Visitor Tracker</h1>
                    <p className="text-muted-foreground">Identify anonymous B2B visitors in real-time</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={sendTestHit}
                        disabled={testLoading}
                    >
                        {testLoading
                            ? <RefreshCw className="h-4 w-4 animate-spin" />
                            : <FlaskConical className="h-4 w-4" />
                        }
                        {testLoading ? "Sending…" : "Send Test Hit"}
                    </Button>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Code2 className="h-4 w-4" />
                            Setup Tracking Pixel
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Install the Visitor Tracking Pixel</DialogTitle>
                            <DialogDescription>
                                Embed this pixel on any website to identify anonymous B2B visitors in real-time.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Pixel key banner */}
                        <div className="flex items-center justify-between bg-muted/60 border rounded-lg px-4 py-3">
                            <div>
                                <p className="text-xs text-muted-foreground mb-0.5">Your Pixel Key</p>
                                <code className="text-sm font-mono font-bold text-primary">
                                    {siteConfigLoading ? "Loading…" : pixelKey}
                                </code>
                            </div>
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                                navigator.clipboard.writeText(pixelKey)
                                toast.success("Pixel key copied!")
                            }}>
                                <Copy className="h-3.5 w-3.5" /> Copy Key
                            </Button>
                        </div>

                        {/* Installation tabs */}
                        <div className="space-y-4 text-sm">
                            {/* HTML snippet */}
                            <div>
                                <p className="font-semibold mb-1.5 flex items-center gap-2">
                                    <Code2 className="h-4 w-4 text-primary" /> HTML / Any website
                                </p>
                                <p className="text-muted-foreground text-xs mb-2">Paste inside <code>&lt;head&gt;</code> or before <code>&lt;/body&gt;</code> on every page you want to track.</p>
                                <div className="bg-muted rounded-lg p-3 font-mono text-xs relative group">
                                    <pre className="whitespace-pre-wrap break-all">{`<script\n  src="${API_BASE}/api/v1/visitors/pixel.js"\n  data-pixel-key="${pixelKey}"\n  async\n></script>`}</pre>
                                    <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={copyPixel}><Copy className="h-3 w-3" /></Button>
                                </div>
                            </div>

                            {/* Next.js */}
                            <div>
                                <p className="font-semibold mb-1.5 flex items-center gap-2">
                                    <ExternalLink className="h-4 w-4 text-primary" /> Next.js (App Router)
                                </p>
                                <p className="text-muted-foreground text-xs mb-2">Add to <code>app/layout.tsx</code> inside the <code>&lt;head&gt;</code> tag.</p>
                                <div className="bg-muted rounded-lg p-3 font-mono text-xs relative group">
                                    <pre className="whitespace-pre-wrap break-all">{`// app/layout.tsx\n<head>\n  <script\n    src="${API_BASE}/api/v1/visitors/pixel.js"\n    data-pixel-key="${pixelKey}"\n    async\n  />\n</head>`}</pre>
                                    <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => { navigator.clipboard.writeText(`<script src="${API_BASE}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey}" async />`); toast.success("Copied!") }}><Copy className="h-3 w-3" /></Button>
                                </div>
                            </div>

                            {/* React */}
                            <div>
                                <p className="font-semibold mb-1.5 flex items-center gap-2">
                                    <Code2 className="h-4 w-4 text-primary" /> React (index.html / Vite)
                                </p>
                                <p className="text-muted-foreground text-xs mb-2">Add to <code>public/index.html</code> or your root HTML template.</p>
                                <div className="bg-muted rounded-lg p-3 font-mono text-xs">
                                    <pre className="whitespace-pre-wrap break-all">{`<!-- public/index.html -->\n<script\n  src="${API_BASE}/api/v1/visitors/pixel.js"\n  data-pixel-key="${pixelKey}"\n  async\n></script>`}</pre>
                                </div>
                            </div>

                            {/* WordPress */}
                            <div>
                                <p className="font-semibold mb-1.5 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-primary" /> WordPress
                                </p>
                                <p className="text-muted-foreground text-xs mb-2">Go to <strong>Appearance → Theme Editor → header.php</strong> and paste before <code>&lt;/head&gt;</code>. Or use a plugin like <em>Insert Headers and Footers</em>.</p>
                                <div className="bg-muted rounded-lg p-3 font-mono text-xs">
                                    <pre className="whitespace-pre-wrap break-all">{`<script src="${API_BASE}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey}" async></script>`}</pre>
                                </div>
                            </div>

                            {/* Shopify */}
                            <div>
                                <p className="font-semibold mb-1.5 flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-primary" /> Shopify
                                </p>
                                <p className="text-muted-foreground text-xs mb-2">Go to <strong>Online Store → Themes → Edit code → theme.liquid</strong>. Paste before <code>&lt;/head&gt;</code>.</p>
                                <div className="bg-muted rounded-lg p-3 font-mono text-xs">
                                    <pre className="whitespace-pre-wrap break-all">{`<script src="${API_BASE}/api/v1/visitors/pixel.js" data-pixel-key="${pixelKey}" async></script>`}</pre>
                                </div>
                            </div>
                        </div>

                        {/* Verification steps */}
                        <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                            <p className="font-semibold text-sm">Verify Installation</p>
                            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                                <li>Embed the snippet on your site and open any page in a browser.</li>
                                <li>Come back to this dashboard and click <strong>Send Test Hit</strong> — you should see a new entry appear within ~5 seconds.</li>
                                <li>For your live site, open DevTools → Network and search for <code>track</code> — you should see a POST request with status 200.</li>
                                <li>Enriched company/contact data populates within 5–10 seconds after the visit is recorded.</li>
                            </ol>
                        </div>

                        {/* How it works */}
                        <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                            <p className="font-semibold text-sm">How it works</p>
                            <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
                                <li>Pixel fires a lightweight POST to the backend with the visitor's IP, page URL, and referrer.</li>
                                <li>IP is enriched via IPinfo (geo + org), Enrich.so (IP-to-person), and Explorium (company firmographics).</li>
                                <li>Visitor is categorised as <strong>Company</strong> or <strong>Prospect</strong> and saved to your database.</li>
                                <li>Dashboard updates in real-time via SSE — no page refresh needed.</li>
                                <li>All data is scoped to your account only — other users cannot see your visitors.</li>
                            </ol>
                        </div>
                    </DialogContent>
                </Dialog>
                </div>{/* end flex items-center gap-2 */}
            </div>{/* end flex items-center justify-between */}

            {/* Error Banner */}
            {error && (
                <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                    <CardContent className="flex items-center gap-3 py-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">{error}</p>
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                Check your Supabase database connection or try refreshing.
                            </p>
                        </div>
                        <Button size="sm" variant="outline" className="ml-auto" onClick={fetchData}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_visits}</div>
                        <p className="text-xs text-muted-foreground">Live tracking active</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Identified Companies</CardTitle>
                        <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.matched_visits}</div>
                        <p className="text-xs text-muted-foreground">Success rate: {(stats.match_rate ?? 0).toFixed(1)}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Intent</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">High</div>
                        <p className="text-xs text-muted-foreground">Based on page engagement</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Live Online</CardTitle>
                        <Globe className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{analytics?.live?.unique_ips ?? "—"}</div>
                        <p className="text-xs text-muted-foreground">
                            Unique IPs in last {analytics?.live?.window_minutes ?? 5} min
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Analytics Dashboard ───────────────────────────────── */}
            <div className="space-y-4">

                {/* Period selector + summary stats */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Traffic Analytics
                    </h2>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        {PERIODS.map((p) => (
                            <Button
                                key={p.hours}
                                size="sm"
                                variant={period === p.hours ? "default" : "ghost"}
                                className="h-7 px-3 text-xs"
                                onClick={() => handlePeriodChange(p.hours)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Period summary cards */}
                <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                    {[
                        { label: "Total Visits", value: analytics?.summary?.total ?? stats.total_visits, icon: <Users className="h-4 w-4" /> },
                        { label: "Identified", value: analytics?.summary?.matched ?? stats.matched_visits, icon: <CheckCircle2 className="h-4 w-4" /> },
                        { label: "Companies", value: analytics?.summary?.companies ?? "—", icon: <Building2 className="h-4 w-4" /> },
                        { label: "Prospects", value: analytics?.summary?.prospects ?? "—", icon: <Target className="h-4 w-4" /> },
                        { label: "Match Rate", value: analytics?.summary ? `${analytics.summary.match_rate}%` : `${(stats.match_rate ?? 0).toFixed(1)}%`, icon: <Zap className="h-4 w-4" /> },
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
                            <div className="h-[280px] w-full animate-pulse bg-muted/40 rounded-lg" />
                        ) : !analytics?.timeseries?.length ? (
                            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                                No traffic data for this period.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart
                                    data={analytics.timeseries.map((t) => ({
                                        ...t,
                                        label: analytics.window.use_daily
                                            ? t.bucket.slice(5)   // MM-DD
                                            : new Date(t.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                                    }))}
                                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ fontWeight: 600 }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="total" name="Total" fill="#818cf8" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="company" name="Companies" fill="#34d399" radius={[3, 3, 0, 0]} stackId="identified" />
                                    <Bar dataKey="prospect" name="Prospects" fill="#fb923c" radius={[3, 3, 0, 0]} stackId="identified" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Top pages + Top referrers */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                Top Pages
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {analyticsLoading
                                ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
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
                            <CardTitle className="text-base flex items-center gap-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                Top Referrers
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {analyticsLoading
                                ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                : (analytics?.top_referrers || []).map((r) => {
                                    const max = analytics!.top_referrers[0]?.count || 1
                                    return (
                                        <div key={r.referrer} className="space-y-0.5">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="truncate text-xs" title={r.referrer}>{r.referrer}</span>
                                                <Badge variant="secondary" className="ml-2 shrink-0">{r.count}</Badge>
                                            </div>
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-info/60 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            {!analyticsLoading && !analytics?.top_referrers?.length && <p className="text-sm text-muted-foreground">—</p>}
                        </CardContent>
                    </Card>
                </div>

                {/* Geo + Industry + Technologies */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                Top Countries
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {analyticsLoading
                                ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                : (analytics?.geo_countries || []).map((g) => {
                                    const max = analytics!.geo_countries[0]?.count || 1
                                    return (
                                        <div key={g.country} className="space-y-0.5">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-xs">{g.country}</span>
                                                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">{g.count}</Badge>
                                            </div>
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-success/60 rounded-full" style={{ width: `${(g.count / max) * 100}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            {!analyticsLoading && !analytics?.geo_countries?.length && <p className="text-sm text-muted-foreground">No geo data yet</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                Industries
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {analyticsLoading
                                ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 animate-pulse bg-muted/40 rounded" />)
                                : (analytics?.industry_breakdown || []).map((ind) => {
                                    const max = analytics!.industry_breakdown[0]?.count || 1
                                    return (
                                        <div key={ind.industry} className="space-y-0.5">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="truncate text-xs" title={ind.industry}>{ind.industry}</span>
                                                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">{ind.count}</Badge>
                                            </div>
                                            <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-warning/60 rounded-full" style={{ width: `${(ind.count / max) * 100}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            {!analyticsLoading && !analytics?.industry_breakdown?.length && <p className="text-sm text-muted-foreground">No industry data yet</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                Technologies
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {analyticsLoading
                                ? <div className="flex flex-wrap gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-6 w-16 animate-pulse bg-muted/40 rounded-full" />)}</div>
                                : (analytics?.top_technologies || []).length > 0
                                    ? (
                                        <div className="flex flex-wrap gap-2">
                                            {(analytics?.top_technologies || []).map((t) => (
                                                <Badge key={t.tech} variant="secondary" className="text-xs gap-1">
                                                    {t.tech}
                                                    <span className="text-muted-foreground font-normal">{t.count}</span>
                                                </Badge>
                                            ))}
                                        </div>
                                    )
                                    : <p className="text-sm text-muted-foreground">No technology data yet</p>
                            }
                        </CardContent>
                    </Card>
                </div>

                {/* Intent distribution */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="h-4 w-4 text-muted-foreground" />
                            Intent Score Distribution
                        </CardTitle>
                        <CardDescription>How engaged are your visitors</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {analyticsLoading ? (
                            <div className="h-[180px] animate-pulse bg-muted/40 rounded-lg" />
                        ) : (analytics?.intent_distribution?.some((d) => d.count > 0)) ? (
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart
                                    data={analytics!.intent_distribution}
                                    margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                                    />
                                    <Bar dataKey="count" name="Visitors" fill="#818cf8" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">No intent data yet.</div>
                        )}
                    </CardContent>
                </Card>
            </div>
            {/* ── end Analytics Dashboard ─────────────────────────────── */}

            {/* Main Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <CardTitle>Recent Visitors</CardTitle>
                            <CardDescription>
                                A real-time feed of visitors and their identified details.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant={segment === "all" ? "default" : "outline"} onClick={() => setSegment("all")}>
                                All
                            </Button>
                            <Button size="sm" variant={segment === "company" ? "default" : "outline"} onClick={() => setSegment("company")}>
                                Companies
                            </Button>
                            <Button size="sm" variant={segment === "prospect" ? "default" : "outline"} onClick={() => setSegment("prospect")}>
                                Prospects
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Visitor / Company</TableHead>
                                <TableHead>Contact Info</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Page Visited</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Intent</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10">Loading visitors...</TableCell>
                                </TableRow>
                            ) : visits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10">
                                        {error ? "Unable to load visitors. Check database connection." : "No visitors tracked yet. Install the pixel to get started!"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visits
                                    .filter((v) => {
                                        if (segment === "all") return true
                                        const cat = (v as any).category || v.resolution?.category
                                        return cat === segment
                                    })
                                    .map((visit) => {
                                    // Geo: prefer IPinfo result, fall back to Explorium HQ
                                    const geo =
                                        visit.geo ||
                                        visit.resolution?.geo ||
                                        ((visit.headquarters_city || visit.headquarters_country)
                                            ? { city: visit.headquarters_city, region: null, country: visit.headquarters_country }
                                            : null)

                                    const company = visit.company || visit.resolution?.company
                                    const person = visit.resolution?.person || {}
                                    const email =
                                        visit.email ||
                                        person.email ||
                                        person.work_email ||
                                        person.personal_email ||
                                        person.emails?.[0]
                                    const phone =
                                        visit.phone ||
                                        person.phone ||
                                        person.mobile_phone ||
                                        person.work_phone ||
                                        person.phones?.[0]
                                    const fullName = visit.full_name || person.full_name || person.name
                                    const linkedinUrl = visit.linkedin_url || person.linkedin_url || person.linkedin
                                    const jobTitle = visit.job_title || person.title || person.job_title
                                    const category = visit.category || visit.resolution?.category

                                    // Company enrichment
                                    const companyLinkedin = visit.company_linkedin_url || visit.resolution?.explorium?.linkedin_url
                                    const website = visit.website || visit.resolution?.explorium?.website || (visit.domain ? `https://${visit.domain}` : null)
                                    const industry = visit.industry || visit.resolution?.explorium?.industry
                                    const employeeRange = visit.employee_count_range || visit.resolution?.explorium?.employee_count_range
                                    const revenueRange = visit.revenue_range || visit.resolution?.explorium?.revenue_range
                                    const technologies: string[] = visit.technologies || visit.resolution?.explorium?.technologies || []
                                    const fundingStage = visit.funding_stage || visit.resolution?.explorium?.funding_stage

                                    // Safe URL parsing
                                    let pagePath = visit.url
                                    try { pagePath = new URL(visit.url).pathname } catch { }

                                    return (
                                        <TableRow key={visit.id}>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    {fullName && (
                                                        <span className="font-semibold text-sm">{fullName}</span>
                                                    )}
                                                    <span className="font-medium text-sm">
                                                        {company || "Anonymous Visitor"}
                                                    </span>
                                                    {jobTitle && (
                                                        <span className="text-xs text-muted-foreground">{jobTitle}</span>
                                                    )}
                                                    {/* Industry + employee count */}
                                                    {(industry || employeeRange) && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {[industry, employeeRange && `${employeeRange} employees`].filter(Boolean).join(" · ")}
                                                        </span>
                                                    )}
                                                    {/* Revenue + funding */}
                                                    {(revenueRange || fundingStage) && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {[revenueRange, fundingStage].filter(Boolean).join(" · ")}
                                                        </span>
                                                    )}
                                                    {/* Technologies (first 3) */}
                                                    {technologies.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {technologies.slice(0, 3).map((t) => (
                                                                <Badge key={t} variant="outline" className="text-[9px] h-3.5 px-1 py-0">
                                                                    {t}
                                                                </Badge>
                                                            ))}
                                                            {technologies.length > 3 && (
                                                                <span className="text-[9px] text-muted-foreground self-center">
                                                                    +{technologies.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {category && category !== "unknown" && (
                                                        <span className="text-xs">
                                                            <Badge variant={category === "prospect" ? "default" : "secondary"}>
                                                                {category === "prospect" ? "Prospect" : "Company"}
                                                            </Badge>
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {visit.ip}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    {email ? (
                                                        <a href={`mailto:${email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                            <Mail className="h-3 w-3" />
                                                            {email}
                                                        </a>
                                                    ) : null}
                                                    {phone ? (
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Phone className="h-3 w-3" />
                                                            {phone}
                                                        </span>
                                                    ) : null}
                                                    {linkedinUrl ? (
                                                        <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                            <Linkedin className="h-3 w-3" />
                                                            Profile
                                                        </a>
                                                    ) : null}
                                                    {/* Company-level links */}
                                                    {companyLinkedin ? (
                                                        <a href={companyLinkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                            <Linkedin className="h-3 w-3" />
                                                            Company page
                                                        </a>
                                                    ) : null}
                                                    {website ? (
                                                        <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                                                            <Globe className="h-3 w-3" />
                                                            {visit.domain || website}
                                                        </a>
                                                    ) : null}
                                                    {!email && !phone && !linkedinUrl && !companyLinkedin && !website && (
                                                        <span className="text-xs text-muted-foreground italic">—</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {geo?.city || (geo as any)?.country ? (
                                                    <span className="flex items-center gap-1 text-sm">
                                                        <Globe className="h-3 w-3" />
                                                        {[geo.city, (geo as any).country].filter(Boolean).join(", ")}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Unknown</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 max-w-[200px]">
                                                    <span className="truncate text-sm" title={visit.url}>
                                                        {pagePath}
                                                    </span>
                                                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="flex items-center gap-1 text-sm">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(visit.created_at).toLocaleTimeString()}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={visit.intent_score > 0.7 ? "default" : "secondary"}>
                                                    {(visit.intent_score * 100).toFixed(0)}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {visit.matched ? (
                                                    <Badge variant="default" className="bg-green-600">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Identified
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Resolving...</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
