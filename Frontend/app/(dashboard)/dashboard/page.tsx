"use client"

import { useEffect, useState } from "react"
import { Users, Activity, Send, TrendingUp } from "lucide-react"
import { KPICard } from "@/components/dashboard/kpi-card"
import { RecentLeadsTable } from "@/components/dashboard/recent-leads-table"
import { ActiveSignalsCard } from "@/components/dashboard/active-signals-card"
import { CampaignPerformanceCard } from "@/components/dashboard/campaign-performance-card"
import { AIAgentActivityCard } from "@/components/dashboard/ai-agent-activity-card"
import { TimeSeriesChart } from "@/components/dashboard/time-series-chart"
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

  useEffect(() => {
    const fetchData = async () => {
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
      }
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your GTM performance overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Leads"
          value={kpis?.totalLeads.toLocaleString() || "0"}
          change={kpis?.changePercentage.totalLeads}
          icon={Users}
          isLoading={isLoading}
        />
        <KPICard
          title="Active Signals"
          value={kpis?.activeSignals.toLocaleString() || "0"}
          change={kpis?.changePercentage.activeSignals}
          icon={Activity}
          isLoading={isLoading}
        />
        <KPICard
          title="Running Campaigns"
          value={kpis?.runningCampaigns.toLocaleString() || "0"}
          change={kpis?.changePercentage.runningCampaigns}
          icon={Send}
          isLoading={isLoading}
        />
        <KPICard
          title="Conversion Rate"
          value={`${kpis?.conversionRate || "0"}%`}
          change={kpis?.changePercentage.conversionRate}
          icon={TrendingUp}
          isLoading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TimeSeriesChart data={timeSeriesData} isLoading={isLoading} />
        <AIAgentActivityCard activities={activities} isLoading={isLoading} />
      </div>

      {/* Tables and Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RecentLeadsTable leads={recentLeads} isLoading={isLoading} />
        <ActiveSignalsCard signals={signals} isLoading={isLoading} />
        <CampaignPerformanceCard campaigns={campaigns} isLoading={isLoading} />
      </div>
    </div>
  )
}
