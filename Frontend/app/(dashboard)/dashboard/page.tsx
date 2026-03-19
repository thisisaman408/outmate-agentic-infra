"use client"

import { useEffect, useState } from "react"
import { Users, Activity, Send, TrendingUp, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KPICard } from "@/components/dashboard/kpi-card"
import { RecentLeadsTable } from "@/components/dashboard/recent-leads-table"
import { ActiveSignalsCard } from "@/components/dashboard/active-signals-card"
import { CampaignPerformanceCard } from "@/components/dashboard/campaign-performance-card"
import { AIAgentActivityCard } from "@/components/dashboard/ai-agent-activity-card"
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart"
import { DailyBriefWidget } from "@/components/copilot/daily-brief-widget"
import {
  dashboardApi,
  type KPIData,
  type RecentLead,
  type Signal,
  type CampaignPerformance,
  type AIAgentActivity,
  type TimeSeriesData,
} from "@/lib/api/dashboard"

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([])
  const [activities, setActivities] = useState<AIAgentActivity[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [today, setToday] = useState("")

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true)
    else setIsLoading(true)
    try {
      const [kpiData, leadsData, signalsData, campaignsData, activitiesData, chartData] = await Promise.all([
        dashboardApi.getKPIs(),
        dashboardApi.getRecentLeads(),
        dashboardApi.getActiveSignals(),
        dashboardApi.getCampaignPerformance(),
        dashboardApi.getAIAgentActivity(),
        dashboardApi.getTimeSeriesData(),
      ])
      setKpis(kpiData)
      setRecentLeads(leadsData)
      setSignals(signalsData)
      setCampaigns(campaignsData)
      setActivities(activitiesData)
      setTimeSeriesData(chartData)
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }))
  }, [])
  const buildStamp = process.env.NEXT_PUBLIC_BUILD_SHA ?? "local"

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GTM Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today} · Your pipeline at a glance</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">Build: {buildStamp.slice(0, 7)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="shrink-0 h-9 gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Leads"
          value={kpis?.totalLeads.toLocaleString() || "0"}
          change={kpis?.changePercentage.totalLeads}
          icon={Users}
          isLoading={isLoading}
          accent="primary"
        />
        <KPICard
          title="Active Signals"
          value={kpis?.activeSignals.toLocaleString() || "0"}
          change={kpis?.changePercentage.activeSignals}
          icon={Activity}
          isLoading={isLoading}
          accent="success"
        />
        <KPICard
          title="Running Campaigns"
          value={kpis?.runningCampaigns.toLocaleString() || "0"}
          change={kpis?.changePercentage.runningCampaigns}
          icon={Send}
          isLoading={isLoading}
          accent="warning"
        />
        <KPICard
          title="Conversion Rate"
          value={`${kpis?.conversionRate || "0"}%`}
          change={kpis?.changePercentage.conversionRate}
          icon={TrendingUp}
          isLoading={isLoading}
          accent="info"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TimeSeriesChart data={timeSeriesData} isLoading={isLoading} />
        <AIAgentActivityCard activities={activities} isLoading={isLoading} />
        <DailyBriefWidget />
      </div>

      {/* Data Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RecentLeadsTable leads={recentLeads} isLoading={isLoading} />
        <ActiveSignalsCard signals={signals} isLoading={isLoading} />
        <CampaignPerformanceCard campaigns={campaigns} isLoading={isLoading} />
      </div>
    </div>
  )
}
