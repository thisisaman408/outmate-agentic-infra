"use client"

import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Sparkles, Calendar, Target, AlertTriangle, Settings } from "lucide-react"
import DailyBriefPage from "./daily-brief/page"
import MeetingPrepPage from "./meeting-prep/page"
import CampaignOptimizerPage from "./campaign-optimizer/page"
import PipelineAlertsPage from "./pipeline-alerts/page"

export default function CopilotPage() {
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
        <Button asChild variant="ghost" size="sm">
          <Link href="/copilot/settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="daily-brief" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
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
            Campaign Optimizer
          </TabsTrigger>
          <TabsTrigger value="pipeline-alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pipeline Alerts
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
      </Tabs>
    </div>
  )
}
