"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Calendar, Target, AlertTriangle, Settings, Coins, Layers } from "lucide-react"
import { useCopilotCredits } from "@/hooks/use-copilot"
import DailyBriefPage from "./daily-brief/page"
import MeetingPrepPage from "./meeting-prep/page"
import CampaignOptimizerPage from "./campaign-optimizer/page"
import PipelineAlertsPage from "./pipeline-alerts/page"
import OrchestratePage from "./orchestrate/page"

export default function CopilotPage() {
  const { credits, fetchCredits } = useCopilotCredits()

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Co-Pilot</h1>
            <p className="text-sm text-muted-foreground">AI-powered sales intelligence at your fingertips</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {credits && (
            <Badge variant={credits.credits_remaining > 10 ? "secondary" : "destructive"} className="flex items-center gap-1 px-3 py-1">
              <Coins className="h-3.5 w-3.5" />
              {credits.credits_remaining} credits
            </Badge>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/copilot/settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="daily-brief" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="daily-brief" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Daily Brief
          </TabsTrigger>
          <TabsTrigger value="meeting-prep" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Meeting Prep
          </TabsTrigger>
          <TabsTrigger value="campaign-optimizer" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Campaign
          </TabsTrigger>
          <TabsTrigger value="pipeline-alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="orchestrate" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Orchestrate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily-brief" className="mt-6">
          <DailyBriefPage />
        </TabsContent>
        <TabsContent value="meeting-prep" className="mt-6">
          <MeetingPrepPage />
        </TabsContent>
        <TabsContent value="campaign-optimizer" className="mt-6">
          <CampaignOptimizerPage />
        </TabsContent>
        <TabsContent value="pipeline-alerts" className="mt-6">
          <PipelineAlertsPage />
        </TabsContent>
        <TabsContent value="orchestrate" className="mt-6">
          <OrchestratePage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
