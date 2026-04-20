"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Workflow as WorkflowIcon,
  Play,
  Pause,
  Settings,
  Clock,
  Zap,
  Database,
  Bot,
  Plus,
  MoreVertical,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import {
  fetchWorkflows,
  fetchTemplates,
  createWorkflow,
  activateWorkflow,
  pauseWorkflow,
  deleteWorkflow,
  runWorkflow,
  type Workflow,
  type WorkflowTemplate,
} from "@/lib/api/workflows"

export default function WorkflowsPage() {
  const [showCopilotResults, setShowCopilotResults] = useState(true)
  const copilotResult = useCoPilotAgentStore((s) =>
    [...s.executionResults].reverse().find((r) => r.module === "workflows" && r.status === "success")
  )

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Create workflow dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    trigger_type: "event_triggered" as "event_triggered" | "time_triggered" | "manual",
    target_object: "People" as "People" | "Companies",
  })
  const [creating, setCreating] = useState(false)

  // Template preview
  const [templateOpen, setTemplateOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [templateCreating, setTemplateCreating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [wf, tpl] = await Promise.all([fetchWorkflows(), fetchTemplates()])
      setWorkflows(wf)
      setTemplates(tpl)
    } catch (err: any) {
      setError(err.message || "Failed to load workflows")
      setWorkflows([])
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = useCallback(async () => {
    if (!createForm.name) return
    setCreating(true)
    try {
      await createWorkflow(createForm)
      setCreateOpen(false)
      setCreateForm({ name: "", description: "", trigger_type: "event_triggered", target_object: "People" })
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }, [createForm, loadData])

  const handleCreateFromTemplate = useCallback(async () => {
    if (!selectedTemplate) return
    setTemplateCreating(true)
    try {
      await createWorkflow({
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        trigger_type: "event_triggered",
        target_object: "People",
        nodes: selectedTemplate.nodes.map((n, i) => ({
          id: `node_${i}`,
          type: n.toLowerCase().replace(/\s+/g, "_"),
          name: n,
          config: {},
        })),
      })
      setTemplateOpen(false)
      setSelectedTemplate(null)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTemplateCreating(false)
    }
  }, [selectedTemplate, loadData])

  const handleToggleStatus = useCallback(async (wf: Workflow) => {
    try {
      if (wf.status === "active") {
        await pauseWorkflow(wf.id)
      } else {
        await activateWorkflow(wf.id)
      }
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }, [loadData])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteWorkflow(id)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }, [loadData])

  const handleRun = useCallback(async (id: string) => {
    try {
      await runWorkflow(id)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }, [loadData])

  // Computed stats from real data
  const activeCount = workflows.filter((w) => w.status === "active").length
  const totalRuns = workflows.reduce((sum, w) => sum + (w.runs_total || 0), 0)
  const totalCompleted = workflows.reduce((sum, w) => sum + (w.runs_completed || 0), 0)
  const totalCredits = workflows.reduce((sum, w) => sum + (w.credit_usage || 0), 0)
  const successRate = totalRuns > 0 ? Math.round((totalCompleted / totalRuns) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Copilot automation agent results banner */}
      {copilotResult && (copilotResult.resultCount ?? 0) > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Automation Agent found {copilotResult.resultCount} workflow{copilotResult.resultCount !== 1 ? "s" : ""}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowCopilotResults((v) => !v)} className="h-7 w-7 p-0">
              {showCopilotResults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          {showCopilotResults && copilotResult.error && (
            <p className="mt-2 text-sm text-destructive">{copilotResult.error}</p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setError("")}>
            &times;
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">Automate your GTM motions with AI-powered workflows</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {/* Stats Cards — real data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <WorkflowIcon className="h-4 w-4 text-primary" />
              Active Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">{workflows.length} total</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Total Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRuns}</div>
            <p className="text-xs text-muted-foreground mt-1">{totalCompleted} completed</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Credits Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCredits}</div>
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
            <div className="text-3xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">Average completion rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Your Workflows</CardTitle>
          <CardDescription>Manage and monitor your automated GTM workflows</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading workflows...</div>
          ) : workflows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No workflows yet.</p>
              <p className="text-sm mt-1">Create one from scratch or use a template below.</p>
            </div>
          ) : (
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
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Trigger:</span>
                          <Badge variant="secondary" className="text-xs">
                            {workflow.trigger_type.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Target:</span>
                          <Badge variant="secondary" className="text-xs">
                            {workflow.target_object}
                          </Badge>
                        </div>
                        {workflow.last_run_at && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>Last run {new Date(workflow.last_run_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRun(workflow.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Run now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(workflow)}>
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
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(workflow.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Runs</p>
                      <p className="text-lg font-semibold">{workflow.runs_total || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
                      <p className="text-lg font-semibold text-green-500">
                        {workflow.runs_total > 0
                          ? Math.round(((workflow.runs_completed || 0) / workflow.runs_total) * 100)
                          : 0}
                        %
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Credits Used</p>
                      <p className="text-lg font-semibold">{workflow.credit_usage || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle>Workflow Templates</CardTitle>
          <CardDescription>Get started quickly with pre-built workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-lg border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium">{template.name}</h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {template.category}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                  <p>Leads/mo: {template.stats.leads_per_month}</p>
                  <p>Conv rate: {template.stats.conv_rate}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-transparent"
                  onClick={() => {
                    setSelectedTemplate(template)
                    setTemplateOpen(true)
                  }}
                >
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Workflow Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>Set up a new automation workflow</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g., Funding Signal Outreach"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="What does this workflow do?"
              />
            </div>
            <div>
              <Label>Trigger type</Label>
              <Select
                value={createForm.trigger_type}
                onValueChange={(v: any) => setCreateForm({ ...createForm, trigger_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="event_triggered">Event triggered</SelectItem>
                  <SelectItem value="time_triggered">Time triggered</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target object</Label>
              <Select
                value={createForm.target_object}
                onValueChange={(v: any) => setCreateForm({ ...createForm, target_object: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="People">People</SelectItem>
                  <SelectItem value="Companies">Companies</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !createForm.name}>
              {creating ? "Creating..." : "Create workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use Template Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Use Template</DialogTitle>
            <DialogDescription>Create a workflow from the "{selectedTemplate?.name}" template</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              <div>
                <p className="text-sm font-medium mb-1">Nodes in this workflow:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.nodes.map((n) => (
                    <Badge key={n} variant="secondary">{n}</Badge>
                  ))}
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Expected leads/month: {selectedTemplate.stats.leads_per_month}</p>
                <p>Typical conversion rate: {selectedTemplate.stats.conv_rate}</p>
                <p>Best for: {selectedTemplate.stats.use_case}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFromTemplate} disabled={templateCreating}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {templateCreating ? "Creating..." : "Create from template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
