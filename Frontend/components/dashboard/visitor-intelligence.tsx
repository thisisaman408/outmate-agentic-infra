"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  type TooltipProps,
} from "recharts"
import {
  Eye,
  Building2,
  UserCheck,
  Target,
  Globe,
  TrendingUp,
} from "lucide-react"
import {
  dashboardApi,
  type VisitorIntelligence,
} from "@/lib/api/dashboard"

// Concrete color values — recharts renders inside SVG and cannot resolve CSS oklch variables
const COLORS = {
  visitors: "#818cf8",  // indigo-400
  matched: "#34d399",   // emerald-400
  icpFit: "#f472b6",    // pink-400
  accent: "#60a5fa",    // blue-400
}

// ── Metric Card ─────────────────────────────────────────────────────────────

interface MetricProps {
  label: string
  value: string
  subtitle?: string
  icon: React.ElementType
  accent?: string
  pulse?: boolean
}

function Metric({ label, value, subtitle, icon: Icon, accent = "text-primary", pulse }: MetricProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
      <div className={`mt-0.5 rounded-md p-1.5 ${accent} bg-muted/50`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">{value}</span>
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-muted-foreground/70">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Custom Tooltip ──────────────────────────────────────────────────────────

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl text-xs">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground ml-1">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function VisitorIntelligence() {
  const [data, setData] = useState<VisitorIntelligence | null>(null)
  const [realtimeCount, setRealtimeCount] = useState<number>(0)
  const [days, setDays] = useState<number>(7)
  const [isLoading, setIsLoading] = useState(true)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch main data
  const fetchData = useCallback(async (period: number) => {
    setIsLoading(true)
    try {
      const result = await dashboardApi.getVisitorIntelligence(period)
      setData(result)
      setRealtimeCount(result.realtime_visitors)
    } catch (err) {
      console.error("Failed to fetch visitor intelligence:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Heartbeat for real-time count (every 15s)
  useEffect(() => {
    const tick = async () => {
      try {
        const hb = await dashboardApi.getRealtimeHeartbeat()
        setRealtimeCount(hb.realtime_visitors)
      } catch {
        // silent — non-critical
      }
    }
    heartbeatRef.current = setInterval(tick, 15_000)
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [])

  // Fetch on mount and when period changes
  useEffect(() => {
    fetchData(days)
  }, [days, fetchData])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Visitor Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
          <Skeleton className="h-[220px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const hasTraffic = data.total_visitors > 0

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Visitor Intelligence
            </CardTitle>
            <CardDescription className="mt-0.5">
              Website traffic quality &amp; identification rates
            </CardDescription>
          </div>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs px-2.5 h-6">7d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-2.5 h-6">30d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2.5 h-6">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Metric Cards Row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric
            label="Active Right Now"
            value={String(realtimeCount)}
            subtitle="30-minute rolling window"
            icon={Eye}
            accent="text-emerald-500"
            pulse={realtimeCount > 0}
          />
          <Metric
            label="ICP Traffic Ratio"
            value={hasTraffic ? `${data.icp_traffic_ratio}%` : "—"}
            subtitle="Visitors with ICP score 70+"
            icon={Target}
            accent="text-pink-500"
          />
          <Metric
            label="Company ID Rate"
            value={hasTraffic ? `${data.company_id_rate}%` : "—"}
            subtitle="Resolved to an entity"
            icon={Building2}
            accent="text-blue-500"
          />
          <Metric
            label="Person-Level ID Rate"
            value={hasTraffic ? `${data.person_id_rate}%` : "—"}
            subtitle="Identified decision-makers"
            icon={UserCheck}
            accent="text-indigo-500"
          />
        </div>

        {/* ── Traffic Trend Chart ───────────────────────────────────────────── */}
        {data.traffic_trend.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
               <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Traffic Trend — Last {days} days
              </p>
              <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5">
                   <div className="h-1.5 w-1.5 rounded-full" style={{ background: COLORS.visitors }} />
                   <span className="text-[10px] font-medium text-muted-foreground">All Visitors</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <div className="h-1.5 w-3 rounded-full border border-dashed" style={{ borderColor: COLORS.matched }} />
                   <span className="text-[10px] font-medium text-muted-foreground">Identified</span>
                 </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.traffic_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.visitors} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.visitors} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradIcp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.icpFit} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.icpFit} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={days <= 7 ? 0 : days <= 30 ? 6 : 14}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "rgba(0,0,0,0.08)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  stroke={COLORS.visitors}
                  strokeWidth={2.5}
                  fill="url(#gradVisitors)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  name="Total Visitors"
                />
                <Area
                  type="monotone"
                  dataKey="icp_fit"
                  stroke={COLORS.icpFit}
                  strokeWidth={2}
                  fill="url(#gradIcp)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  name="ICP Visitors"
                />
                <Line
                  type="monotone"
                  dataKey="matched"
                  stroke={COLORS.matched}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  name="Matched Company"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Top 10 Pages by ICP Traffic ─────────────────────────────────── */}
        {data.top_pages_by_icp.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-4">
              Top 10 Content Pages by ICP Fit Traffic
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
              {data.top_pages_by_icp.slice(0, 10).map((entry, i) => {
                const maxCount = data.top_pages_by_icp[0]?.icp_visitors || 1
                const widthPct = Math.max(5, (entry.icp_visitors / maxCount) * 100)
                return (
                  <div key={entry.page} className="flex items-center gap-3 text-xs group py-1 border-b border-border/10 last:border-0 md:last:border-b">
                    <span className="text-muted-foreground/40 w-5 font-bold tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="truncate block font-semibold text-foreground/90 group-hover:text-primary transition-colors cursor-help" title={entry.page}>
                        {entry.page}
                      </span>
                      <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-500/60 transition-all duration-500 ease-out"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-bold tabular-nums text-foreground">{entry.icp_visitors}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">ICP Hits</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
