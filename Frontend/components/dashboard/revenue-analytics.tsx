"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  type TooltipProps,
} from "recharts"
import {
  DollarSign,
  TrendingUp,
  Clock,
  Briefcase,
  Layers,
  Info,
  ArrowRight,
} from "lucide-react"
import {
  dashboardApi,
  type RevenueAnalytics as RevenueAnalyticsData,
} from "@/lib/api/dashboard"

const COLORS = {
  revenue: "#7b5cff",
  sqls: "#caff00",
}

export function RevenueAnalytics() {
  const [data, setData] = useState<RevenueAnalyticsData | null>(null)
  const [days, setDays] = useState<number>(30)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async (period: number) => {
    setIsLoading(true)
    try {
      const result = await dashboardApi.getRevenueAnalytics(period)
      setData(result)
    } catch (err) {
      console.error("Failed to fetch revenue analytics:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(days)
  }, [days, fetchData])

  if (isLoading && !data) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Revenue Attribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: data.currency || "USD",
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <Card className="col-span-full border-primary/20 bg-primary/5">
      <CardHeader className="pb-3 border-b border-primary/10 mb-4 bg-primary/5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
              <DollarSign className="h-5 w-5" /> Revenue & ROI Influence
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-0.5">
              <span>{data.attribution_type}</span>
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-white/50">{data.currency}</Badge>
            </CardDescription>
          </div>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList className="h-8 bg-muted/50">
              <TabsTrigger value="7" className="text-xs px-2.5 h-6">7d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs px-2.5 h-6">30d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs px-2.5 h-6">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Revenue Influenced</p>
            <p className="text-2xl font-bold tracking-tight text-primary">{formatCurrency(data.revenue_influenced)}</p>
            <p className="text-[10px] text-muted-foreground/70">From Outmate-originated signals</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SQLs Created</p>
            <p className="text-2xl font-bold tracking-tight">{data.sql_count}</p>
            <p className="text-[10px] text-muted-foreground/70">Active deals in pipeline</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CAC (via Outmate)</p>
            <p className="text-2xl font-bold tracking-tight">{formatCurrency(data.cac)}</p>
            <p className="text-[10px] text-muted-foreground/70">Based on subscription cost</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Deal Velocity</p>
            <p className="text-2xl font-bold tracking-tight">{data.deal_velocity} days</p>
            <p className="text-[10px] text-muted-foreground/70">Avg. time Signal → SQL</p>
          </div>
        </div>

        {/* Funnel & Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Funnel View */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Attribution Funnel</p>
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none">Pipeline View</Badge>
            </div>
            <div className="space-y-2">
              {data.funnel.map((stage, i) => (
                <div key={stage.stage} className="relative">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50 relative z-10 group hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                      <span className="text-xs font-bold">{stage.stage}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold tabular-nums">{stage.count}</span>
                      {stage.drop_off_pct > 0 && (
                        <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 rounded font-bold">-{stage.drop_off_pct}%</span>
                      )}
                    </div>
                  </div>
                  {i < data.funnel.length - 1 && (
                    <div className="flex justify-center -my-1">
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Trend */}
          <div className="lg:col-span-3 space-y-4">
             <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Revenue Attribution Trend</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <span className="text-[10px] font-bold text-muted-foreground">SQLs</span>
                </div>
              </div>
            </div>
            <div className="h-[250px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trends}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.revenue} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS.revenue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} 
                    axisLine={false} 
                    tickLine={false} 
                    interval={days <= 7 ? 0 : days <= 30 ? 6 : 14}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ stroke: "rgba(0,0,0,0.1)", strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      
                      const revData = payload.find(p => p.dataKey === "revenue");
                      const sqlData = payload.find(p => p.dataKey === "sqls");

                      return (
                        <div className="rounded-lg border border-primary/20 bg-background px-3 py-2 shadow-xl text-xs">
                          <p className="font-bold text-foreground mb-1">{label}</p>
                          {revData && (
                            <p className="text-primary font-bold">
                              Revenue: {formatCurrency(revData.value as number)}
                            </p>
                          )}
                          {sqlData && (
                            <p className="text-muted-foreground font-medium">
                              SQLs: {sqlData.value}
                            </p>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="revenue"
                    stroke={COLORS.revenue}
                    strokeWidth={2}
                    fill="url(#gradRev)"
                    dot={false}
                    name="Revenue"
                  />
                  <Bar
                    dataKey="sqls"
                    fill={COLORS.sqls}
                    radius={[2, 2, 0, 0]}
                    name="SQLs"
                    barSize={10}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Note Area */}
        <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/10 px-3 py-2 text-[10px] text-primary/80">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            <strong>Attribution Logic:</strong> Revenue is attributed if Outmate originated the first touchpoint (signal or sequence reply) within the deal journey.
            CAC includes platform subscription costs and variable usage.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
