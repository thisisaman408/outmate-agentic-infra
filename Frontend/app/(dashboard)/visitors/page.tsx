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
    ArrowRight,
    ExternalLink,
    AlertTriangle,
    Mail,
    Phone,
    Linkedin
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

interface Visit {
    id: string
    ip: string
    url: string
    referrer: string
    intent_score: number
    matched: boolean
    created_at: string
    resolution: any
    // Flattened enrichment fields
    company: string | null
    domain: string | null
    geo: { city: string; region: string; country: string } | null
    confidence: number
    email: string | null
    phone: string | null
    full_name: string | null
    linkedin_url: string | null
    job_title: string | null
}

export default function VisitorsPage() {
    const [visits, setVisits] = useState<Visit[]>([])
    const [stats, setStats] = useState({ total_visits: 0, matched_visits: 0, match_rate: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pixelKey = "outmate_test_key_123"

    const fetchData = async () => {
        setError(null)
        try {
            const [visitsRes, statsRes] = await Promise.all([
                fetch(`${API_BASE}/api/visitors/`),
                fetch(`${API_BASE}/api/visitors/stats`)
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

    const copyPixel = () => {
        const snippet = `<script src="${API_BASE}/api/visitors/pixel.js" data-pixel-key="${pixelKey}"></script>`
        navigator.clipboard.writeText(snippet)
        toast.success("Pixel snippet copied to clipboard!")
    }

    useEffect(() => {
        setMounted(true)
        fetchData()
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [])

    if (!mounted) return <div className="p-6 animate-pulse">Loading dashboard...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Visitor Tracker</h1>
                    <p className="text-muted-foreground">Identify anonymous B2B visitors in real-time</p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Code2 className="h-4 w-4" />
                            Setup Tracking Pixel
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Install Outmate Pixel</DialogTitle>
                            <DialogDescription>
                                Copy and paste this snippet into the <code>&lt;head&gt;</code> of your website to start identifying visitors.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="bg-muted p-4 rounded-lg relative font-mono text-sm group">
                            <pre className="whitespace-pre-wrap break-all">
                                {`<script src="${API_BASE}/api/visitors/pixel.js" \n  data-pixel-key="${pixelKey}">\n</script>`}
                            </pre>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={copyPixel}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-2">
                            <p className="font-medium text-foreground">Next Steps:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Embed the script on all pages you want to track.</li>
                                <li>Verify your domain in settings.</li>
                                <li>Visitor data will start appearing in this dashboard within seconds.</li>
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

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
            <div className="grid gap-4 md:grid-cols-3">
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
            </div>

            {/* Main Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Visitors</CardTitle>
                    <CardDescription>
                        A real-time feed of visitors and their identified details.
                    </CardDescription>
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
                                visits.map((visit) => {
                                    const geo = visit.geo || visit.resolution?.geo
                                    const company = visit.company || visit.resolution?.company
                                    const person = visit.resolution?.person || {}
                                    const email = visit.email || person.email
                                    const phone = visit.phone || person.phone
                                    const fullName = visit.full_name || person.full_name || person.name
                                    const linkedinUrl = visit.linkedin_url || person.linkedin_url || person.linkedin
                                    const jobTitle = visit.job_title || person.title || person.job_title

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
                                                            LinkedIn
                                                        </a>
                                                    ) : null}
                                                    {!email && !phone && !linkedinUrl && (
                                                        <span className="text-xs text-muted-foreground italic">—</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {geo ? (
                                                    <span className="flex items-center gap-1 text-sm">
                                                        <Globe className="h-3 w-3" />
                                                        {geo.city}, {geo.country}
                                                    </span>
                                                ) : "Unknown"}
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
