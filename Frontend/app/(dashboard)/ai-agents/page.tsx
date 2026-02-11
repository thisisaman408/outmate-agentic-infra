"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgenticSearchPanel } from "@/components/ai-agents/agentic-search-panel"
import { LookalikePanel } from "@/components/ai-agents/lookalike-panel"
import { ResearchPanel } from "@/components/ai-agents/research-panel"
import { PredictivePanel } from "@/components/ai-agents/predictive-panel"

export default function AIAgentsPage() {
  const [activeTab, setActiveTab] = useState("search")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
        <p className="text-muted-foreground">Leverage AI-powered agents to supercharge your GTM operations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search">Agentic Search</TabsTrigger>
          <TabsTrigger value="lookalike">Lookalike</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          <AgenticSearchPanel />
        </TabsContent>

        <TabsContent value="lookalike" className="space-y-6">
          <LookalikePanel />
        </TabsContent>

        <TabsContent value="research" className="space-y-6">
          <ResearchPanel />
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          <PredictivePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
