"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { Workflow, Play, Pause, Settings, Clock, Zap, Database, Bot, Send, Plus, MoreVertical, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import { useState } from "react"

export default function WorkflowsPage() {
  const router = useRouter()
  const [showCopilotResults, setShowCopilotResults] = useState(true)
  const copilotResult = useCoPilotAgentStore(s =>
    [...s.executionResults].reverse().find(r => r.module === 'workflows' && r.status === 'success')
  )
  const workflows = [
    {
      id: 1,
      name: "New VP Sales Outreach",
      description: "When VP Sales is hired → enrich → research → personalize → add to campaign",
      status: "active",
      trigger: "Hiring Signal",
      lastRun: "2 hours ago",
      executions: 156,
      successRate: 94,
    },
    {
      id: 2,
      name: "Series B Funding Flow",
      description: "Detect funding → score ICP fit → assign to AE → sync to CRM",
      status: "active",
      trigger: "Funding Event",
      lastRun: "5 hours ago",
      executions: 89,
      successRate: 98,
    },
    {
      id: 3,
      name: "Tech Stack Adoption",
      description: "Monitor tech changes → qualify → research pain points → route to SDR",
      status: "paused",
      trigger: "Technographic Change",
      lastRun: "1 day ago",
      executions: 234,
      successRate: 91,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Copilot automation agent results banner */}
      {copilotResult && (copilotResult.resultCount ?? 0) > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Automation Agent found {copilotResult.resultCount} workflow{copilotResult.resultCount !== 1 ? 's' : ''}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCopilotResults(v => !v)} className="h-7 w-7 p-0">
              {showCopilotResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          {showCopilotResults && copilotResult.error && (
            <p className="mt-2 text-sm text-destructive">{copilotResult.error}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Automate your GTM motions with AI-powered workflows</p>
        </div>
        <Button onClick={() => router.push('/flow-builder')}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary" />
              Active Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1">Running continuously</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Executions Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground mt-1">+23% from yesterday</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Records Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">8,934</div>
            <p className="text-xs text-muted-foreground mt-1">Across all workflows</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">96%</div>
            <p className="text-xs text-muted-foreground mt-1">Average completion rate</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Your Workflows</CardTitle>
          <CardDescription>Manage and monitor your automated GTM workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="rounded-lg border border-border/50 bg-card/50 p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{workflow.name}</h3>
                      <Badge
                        variant={workflow.status === "active" ? "default" : "secondary"}
                        className={workflow.status === "active" ? "bg-green-500/10 text-green-500" : ""}
                      >
                        {workflow.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Trigger:</span>
                        <Badge variant="secondary" className="text-xs">
                          {workflow.trigger}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Last run {workflow.lastRun}</span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        Edit Workflow
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Send className="mr-2 h-4 w-4" />
                        View Executions
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        {workflow.status === "active" ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Executions</p>
                    <p className="text-lg font-semibold">{workflow.executions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
                    <p className="text-lg font-semibold text-green-500">{workflow.successRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Credits Used</p>
                    <p className="text-lg font-semibold">{workflow.executions * 2}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle>Workflow Templates</CardTitle>
          <CardDescription>Get started quickly with pre-built workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              "SDR Outbound Automation",
              "ABM Account Engagement",
              "Partner Co-Marketing",
              "Expansion Opportunity",
              "Churn Risk Detection",
              "Product Launch Targeting",
            ].map((template, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-colors cursor-pointer"
              >
                <h4 className="font-medium mb-2">{template}</h4>
                <p className="text-sm text-muted-foreground mb-3">Pre-configured workflow ready to use</p>
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
