"use client"

import { useEffect, useState } from "react"
import { FunnelChart } from "@/components/analytics/funnel-chart"
import { SignalsCorrelationChart } from "@/components/analytics/signals-correlation-chart"
import { CampaignMetricsTable } from "@/components/analytics/campaign-metrics-table"
import { AgentEffectivenessCard } from "@/components/analytics/agent-effectiveness-card"
import {
  analyticsApi,
  type LeadFunnelData,
  type SignalsCorrelation,
  type CampaignMetrics,
  type AgentEffectiveness,
} from "@/lib/api/analytics"
import { Button } from "@/components/ui/button"
import { Calendar, Download } from "lucide-react"

export default function AnalyticsPage() {
  const [funnelData, setFunnelData] = useState<LeadFunnelData[]>([])
  const [signalsData, setSignalsData] = useState<SignalsCorrelation[]>([])
  const [campaignData, setCampaignData] = useState<CampaignMetrics[]>([])
  const [agentData, setAgentData] = useState<AgentEffectiveness[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [funnel, signals, campaigns, agents] = await Promise.all([
          analyticsApi.getLeadFunnel(),
          analyticsApi.getSignalsCorrelation(),
          analyticsApi.getCampaignMetrics(),
          analyticsApi.getAgentEffectiveness(),
        ])

        setFunnelData(funnel)
        setSignalsData(signals)
        setCampaignData(campaigns)
        setAgentData(agents)
      } catch (error) {
        console.error("Failed to fetch analytics data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Deep insights into your GTM performance and metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Last 30 Days
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <FunnelChart data={funnelData} isLoading={isLoading} />
        <SignalsCorrelationChart data={signalsData} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <CampaignMetricsTable data={campaignData} isLoading={isLoading} />
        </div>
        <AgentEffectivenessCard data={agentData} isLoading={isLoading} />
      </div>
    </div>
  )
}
