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
    ExternalLink
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

interface Visit {
    id: string
    ip: string
    url: string
    referrer: string
    intent_score: number
    matched: boolean
    created_at: string
    resolution: any
}

export default function VisitorsPage() {
    const [visits, setVisits] = useState<Visit[]>([])
    const [stats, setStats] = useState({ total_visits: 0, matched_visits: 0, match_rate: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const pixelKey = "outmate_test_key_123"

    const fetchData = async () => {
        try {
            const [visitsRes, statsRes] = await Promise.all([
                fetch('http://127.0.0.1:8000/api/visitors/'),
                fetch('http://127.0.0.1:8000/api/visitors/stats')
            ])

            if (visitsRes.ok) setVisits(await visitsRes.json())
            if (statsRes.ok) setStats(await statsRes.json())
        } catch (error) {
            console.error("Failed to fetch visitor data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const copyPixel = () => {
        const snippet = `<script src="http://127.0.0.1:8000/pixel.js" data-pixel-key="${pixelKey}"></script>`
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
                                {`<script src="http://localhost:8000/pixel.js" \n  data-pixel-key="${pixelKey}">\n</script>`}
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
                        <p className="text-xs text-muted-foreground">Success rate: {stats.match_rate.toFixed(1)}%</p>
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
                                <TableHead>Location</TableHead>
                                <TableHead>Page Visited</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Intent</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">Loading visitors...</TableCell>
                                </TableRow>
                            ) : visits.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">No visitors tracked yet. Install the pixel to get started!</TableCell>
                                </TableRow>
                            ) : (
                                visits.map((visit) => (
                                    <TableRow key={visit.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {visit.resolution?.company || "Anonymous Visitor"}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    {visit.ip}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {visit.resolution?.geo ? (
                                                <span className="flex items-center gap-1 text-sm">
                                                    <Globe className="h-3 w-3" />
                                                    {visit.resolution.geo.city}, {visit.resolution.geo.country}
                                                </span>
                                            ) : "Unknown"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 max-w-[200px]">
                                                <span className="truncate text-sm" title={visit.url}>
                                                    {new URL(visit.url).pathname}
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
                                                <Button size="sm" variant="outline">View Details</Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Resolving...</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
