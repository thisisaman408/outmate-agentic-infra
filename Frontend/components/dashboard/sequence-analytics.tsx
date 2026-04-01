"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  type TooltipProps,
} from "recharts"
import {
  Mail,
  Linkedin,
  Phone,
  Trophy,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
  Info,
} from "lucide-react"
import {
  dashboardApi,
  type SequenceAnalytics as SequenceAnalyticsData,
  type SequenceRow,
  type ABTestResult,
  type BenchmarkComparison,
} from "@/lib/api/dashboard"

const COLORS = {
  sent: "#94a3b8",     // slate-400
  opened: "#818cf8",   // indigo-400
  replied: "#34d399",  // emerald-400
  meetings: "#fb923c", // orange-400
  email: "#818cf8",
  linkedin: "#60a5fa",
  voice_ai: "#a78bfa",
}

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  linkedin: Linkedin,
  voice_ai: Phone,
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
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

// ── Benchmark Badge ─────────────────────────────────────────────────────────

function BenchmarkBadge({ data, label }: { data: BenchmarkComparison; label: string }) {
  const Icon = data.status === "above" ? TrendingUp : data.status === "below" ? TrendingDown : Minus
  const color =
    data.status === "above"
      ? "text-emerald-500"
      : data.status === "below"
        ? "text-red-400"
        : "text-muted-foreground"
  const bg =
    data.status === "above"
      ? "bg-emerald-500/10"
      : data.status === "below"
        ? "bg-red-400/10"
        : "bg-muted/30"

  return (
    <div className={`rounded-lg border border-border/50 p-3 ${bg}`}>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-lg font-semibold tabular-nums">{data.your_rate}%</span>
        <div className={`flex items-center gap-0.5 text-xs ${color} mb-0.5`}>
          <Icon className="h-3 w-3" />
          <span>{data.difference > 0 ? "+" : ""}{data.difference}%</span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
        Platform avg: {data.platform_avg}%
      </p>
    </div>
  )
}

// ── A/B Test Card ───────────────────────────────────────────────────────────

function ABTestCard({ test }: { test: ABTestResult }) {
  const statusConfig = {
    winner_declared: { label: "Winner", color: "bg-emerald-500/20 text-emerald-400", icon: Trophy },
    insufficient_data: { label: "Needs Data", color: "bg-yellow-500/20 text-yellow-400", icon: AlertTriangle },
    no_significant_difference: { label: "No Difference", color: "bg-muted text-muted-foreground", icon: Minus },
  }
  const cfg = statusConfig[test.status]
  const StatusIcon = cfg.icon

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium truncate">{test.group}</p>
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {cfg.label}
        </Badge>
      </div>

      {test.variants.map((v, i) => {
        const isWinner = test.winner === v.label
        return (
          <div
            key={v.label}
            className={`flex items-center gap-2 text-xs rounded px-2 py-1.5 ${isWinner ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-muted/30"}`}
          >
            <span className="font-mono text-muted-foreground w-4">{String.fromCharCode(65 + i)}</span>
            <span className="flex-1 min-w-0 truncate text-foreground/80" title={v.subject}>
              {v.subject || v.label}
            </span>
            <span className="tabular-nums shrink-0">
              {v.open_rate}% <span className="text-muted-foreground/60">open</span>
            </span>
            <span className="tabular-nums shrink-0">
              {v.reply_rate}% <span className="text-muted-foreground/60">reply</span>
            </span>
            {isWinner && <Trophy className="h-3 w-3 text-emerald-400 shrink-0" />}
          </div>
        )
      })}

      {test.status === "insufficient_data" && (
        <p className="text-[10px] text-yellow-400/80">
          Needs {test.min_sends_required}+ sends per variant to determine winner.
        </p>
      )}
      {test.status === "winner_declared" && (
        <p className="text-[10px] text-emerald-400/80">
          Winner at {test.confidence}% confidence (z-test, p&lt;0.05).
        </p>
      )}
    </div>
  )
}

// ── Sequence Table ──────────────────────────────────────────────────────────

function SequenceTable({ sequences }: { sequences: SequenceRow[] }) {
  if (!sequences.length) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        No sequence data for this period.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border/50">
            <th className="text-left py-2 pr-3 font-medium">Sequence</th>
            <th className="text-left py-2 px-2 font-medium">Channel</th>
            <th className="text-right py-2 px-2 font-medium">Sent</th>
            <th className="text-right py-2 px-2 font-medium">Open %</th>
            <th className="text-right py-2 px-2 font-medium">Reply %</th>
            <th className="text-right py-2 pl-2 font-medium">Meeting %</th>
          </tr>
        </thead>
        <tbody>
          {sequences.slice(0, 10).map((s) => {
            const ChIcon = CHANNEL_ICONS[s.channel] || Mail
            return (
              <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate max-w-[180px]">{s.name}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize shrink-0">
                      {s.status}
                    </Badge>
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ChIcon className="h-3 w-3" />
                    <span className="capitalize">{s.channel.replace("_", " ")}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">{s.sent.toLocaleString()}</td>
                <td className="py-2 px-2 text-right tabular-nums">{s.open_rate}%</td>
                <td className="py-2 px-2 text-right tabular-nums font-medium text-emerald-400">{s.reply_rate}%</td>
                <td className="py-2 pl-2 text-right tabular-nums">{s.meeting_booked_rate}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SequenceAnalytics() {
  const [data, setData] = useState<SequenceAnalyticsData | null>(null)
  const [days, setDays] = useState<number>(7)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async (period: number) => {
    setIsLoading(true)
    try {
      const result = await dashboardApi.getSequenceAnalytics(period)
      setData(result)
    } catch (err) {
      console.error("Failed to fetch sequence analytics:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(days)
  }, [days, fetchData])

  // Loading
  if (isLoading && !data) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Sequence Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[80px]" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const hasTrend = data.trend.some((t) => t.sent > 0)
  const hasABTests = data.ab_tests.length > 0

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Sequence Analytics
            </CardTitle>
            <CardDescription className="mt-0.5">
              Outreach performance, A/B tests &amp; benchmarks
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {/* Data freshness indicator */}
            {data.data_freshness.last_sync && (
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                Data as of {new Date(data.data_freshness.last_sync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs px-2.5 h-6">7d</TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-2.5 h-6">30d</TabsTrigger>
                <TabsTrigger value="90" className="text-xs px-2.5 h-6">90d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Benchmark comparison row ─────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <BenchmarkBadge data={data.benchmarks.open_rate} label="Open Rate" />
          <BenchmarkBadge data={data.benchmarks.reply_rate} label="Reply Rate" />
          <BenchmarkBadge data={data.benchmarks.meeting_booked_rate} label="Meeting Booked" />
        </div>

        {/* ── MPP warning ─────────────────────────────────────────────────── */}
        {data.warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-yellow-500/5 border border-yellow-500/20 px-3 py-2 text-[11px] text-yellow-400/80">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{data.warnings[0]}</span>
          </div>
        )}

        {/* ── Trend chart ─────────────────────────────────────────────────── */}
        {hasTrend && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Performance Trend — Last {days} days
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data.trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReplied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.replied} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.replied} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.opened} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.opened} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={days <= 7 ? 0 : days <= 30 ? 4 : 13}
                />
                <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="sent" stroke={COLORS.sent} strokeWidth={1} fill="none" dot={false} name="Sent" />
                <Area type="monotone" dataKey="opened" stroke={COLORS.opened} strokeWidth={2} fill="url(#gradOpened)" dot={false} activeDot={{ r: 3 }} name="Opened" />
                <Area type="monotone" dataKey="replied" stroke={COLORS.replied} strokeWidth={2} fill="url(#gradReplied)" dot={false} activeDot={{ r: 3 }} name="Replied" />
                <Area type="monotone" dataKey="meetings" stroke={COLORS.meetings} strokeWidth={2} fill="none" strokeDasharray="4 4" dot={false} activeDot={{ r: 3 }} name="Meetings" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Channel breakdown (horizontal bar) ──────────────────────────── */}
        {data.channel_breakdown.some((ch) => ch.sent > 0) && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Channel Breakdown</p>
            <div className="space-y-2">
              {data.channel_breakdown
                .filter((ch) => ch.sent > 0)
                .map((ch) => {
                  const ChIcon = CHANNEL_ICONS[ch.channel] || Mail
                  const maxSent = Math.max(...data.channel_breakdown.map((c) => c.sent), 1)
                  const widthPct = Math.max(6, (ch.sent / maxSent) * 100)
                  return (
                    <div key={ch.channel} className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5 w-20 shrink-0">
                        <ChIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="capitalize text-foreground/80">{ch.channel.replace("_", " ")}</span>
                      </div>
                      <div className="flex-1 relative h-5 rounded-sm bg-muted/30 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-sm transition-all"
                          style={{
                            width: `${widthPct}%`,
                            background: COLORS[ch.channel as keyof typeof COLORS] || COLORS.email,
                            opacity: 0.3,
                          }}
                        />
                        <div className="relative flex items-center justify-between px-2 h-full">
                          <span className="tabular-nums">{ch.sent.toLocaleString()} sent</span>
                          <span className="tabular-nums text-muted-foreground/70">
                            {ch.open_rate}% open · {ch.reply_rate}% reply
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ── A/B Tests ───────────────────────────────────────────────────── */}
        {hasABTests && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">A/B Test Results</p>
            <div className="grid gap-3 md:grid-cols-2">
              {data.ab_tests.map((test) => (
                <ABTestCard key={test.group} test={test} />
              ))}
            </div>
          </div>
        )}

        {/* ── Sequence table ──────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Sequences ({data.total_sequences})
          </p>
          <SequenceTable sequences={data.sequences} />
        </div>
      </CardContent>
    </Card>
  )
}
