"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  Share2,
  Save,
  Rocket,
  Zap,
  Database,
  Target,
  BarChart3,
  Mail,
  Clock,
  GitBranch,
  Sparkles,
  Users,
  ListChecks,
  Handshake,
  UserPlus,
  ClipboardList,
  Minus,
  Plus,
  Maximize2,
  RotateCcw,
  Eye,
  List,
  X,
  AlertCircle,
  SearchIcon,
  Settings2,
  MessageSquare,
  Globe,
  Shield,
  Linkedin,
  Timer,
  LogOut,
  Hash,
  Layers,
  Shuffle,
  SplitSquareHorizontal,
  Percent,
  Bot,
  RefreshCw,
  Grip,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getWorkflow, type Workflow } from "@/lib/api/workflows"

/* ------------------------------------------------------------------ */
/*  DEMO DATA                                                         */
/* ------------------------------------------------------------------ */

const DEMO_WORKFLOW: Workflow = {
  id: "demo-wf-001",
  name: "Outbound Signal Cadence",
  description: "End-to-end outbound workflow that detects buying signals, enriches and scores leads, then runs a multi-channel sequence.",
  status: "draft",
  trigger_type: "event_triggered",
  target_object: "People",
  nodes: [],
  settings: {
    timezone: "America/New_York",
    business_hours_only: true,
    skip_weekends: true,
    max_runs_per_record: "Unlimited",
    re_enrollment_rule: "Once per 30 days",
    notify_owner_on_exit: true,
    slack_alerts: false,
    email_notifications: true,
    error_alerts: true,
  },
  owner_name: "Aman Kumar",
  folder: null,
  created_at: "2026-04-15T10:30:00Z",
  updated_at: "2026-04-17T08:00:00Z",
  last_run_at: null,
  next_run_at: null,
  runs_total: 0,
  runs_completed: 0,
  runs_in_progress: 0,
  runs_failed: 0,
  credit_usage: 0,
}

/* ---- Signal tags ---- */
const SIGNAL_TAGS = [
  { label: "Daily 8AM", color: "#6366F1" },
  { label: "Funding alert", color: "#10B981" },
  { label: "Hiring signal", color: "#F59E0B" },
  { label: "Visitor ID", color: "#EC4899" },
  { label: "LinkedIn signal", color: "#3B82F6" },
  { label: "Predict Data Room", color: "#8B5CF6" },
]

/* ---- Canvas node definitions ---- */
interface CanvasNode {
  id: string
  type: "trigger" | "action" | "condition" | "branch_yes" | "branch_no" | "delay" | "exit" | "label"
  name: string
  subtitle?: string
  badge?: { text: string; color: string }
  tags?: { label: string; color: string }[]
  icon: string
  iconColor: string
  children?: string[]       // next node ids
  branchYes?: string        // yes branch entry
  branchNo?: string         // no branch entry
}

const CANVAS_NODES: CanvasNode[] = [
  {
    id: "label-when",
    type: "label",
    name: "WHEN THIS HAPPENS",
    icon: "Zap",
    iconColor: "#F59E0B",
  },
  {
    id: "signal-engine",
    type: "trigger",
    name: "Signal Engine",
    subtitle: "6 active sources",
    badge: { text: "TRIGGER", color: "#F59E0B" },
    tags: SIGNAL_TAGS,
    icon: "Zap",
    iconColor: "#F59E0B",
    children: ["label-then"],
  },
  {
    id: "label-then",
    type: "label",
    name: "THEN DO THIS",
    icon: "Zap",
    iconColor: "#3B82F6",
  },
  {
    id: "waterfall-enrich",
    type: "action",
    name: "Waterfall Enrich",
    subtitle: "People Data Labs, Hunter.io, Clearbit",
    badge: { text: "LOOP", color: "#3B82F6" },
    icon: "Database",
    iconColor: "#3B82F6",
    children: ["icp-match"],
  },
  {
    id: "icp-match",
    type: "condition",
    name: "ICP match check",
    subtitle: "Ideal Customer Profile scoring",
    icon: "Target",
    iconColor: "#8B5CF6",
    branchYes: "lead-scoring",
    branchNo: "wait-30d",
  },
  // --- YES branch ---
  {
    id: "lead-scoring",
    type: "action",
    name: "Lead Scoring",
    subtitle: "AI model: gradient-boost-v3",
    badge: { text: "AI MODEL", color: "#10B981" },
    icon: "BarChart3",
    iconColor: "#10B981",
    children: ["score-threshold"],
  },
  {
    id: "score-threshold",
    type: "condition",
    name: "Score threshold",
    subtitle: "Score >= 80?",
    icon: "GitBranch",
    iconColor: "#F97316",
    branchYes: "email-sequence",
    branchNo: "wait-30d",
  },
  {
    id: "email-sequence",
    type: "action",
    name: "Email Sequence",
    subtitle: "3-step personalized cadence",
    icon: "Mail",
    iconColor: "#EC4899",
    children: ["wait-7d"],
  },
  {
    id: "wait-7d",
    type: "delay",
    name: "Wait 7 days",
    icon: "Clock",
    iconColor: "#6B7280",
    children: ["linkedin-connect"],
  },
  {
    id: "linkedin-connect",
    type: "action",
    name: "LinkedIn Connect",
    subtitle: "Personalized connection request",
    icon: "Linkedin",
    iconColor: "#3B82F6",
    children: ["wait-3d"],
  },
  {
    id: "wait-3d",
    type: "delay",
    name: "Wait 3 days",
    icon: "Clock",
    iconColor: "#6B7280",
    children: ["followup-email"],
  },
  {
    id: "followup-email",
    type: "action",
    name: "Follow-up Email",
    subtitle: "Break-up email + CTA",
    icon: "Mail",
    iconColor: "#EC4899",
  },
  // --- NO branch ---
  {
    id: "wait-30d",
    type: "delay",
    name: "Wait 30 days",
    icon: "Clock",
    iconColor: "#6B7280",
    children: ["recheck-icp"],
  },
  {
    id: "recheck-icp",
    type: "action",
    name: "Re-check ICP",
    subtitle: "Re-evaluate profile against updated ICP",
    icon: "RefreshCw",
    iconColor: "#8B5CF6",
    children: ["exit-disqualified"],
  },
  {
    id: "exit-disqualified",
    type: "exit",
    name: "Exit — disqualified",
    icon: "LogOut",
    iconColor: "#EF4444",
  },
]

/* ---- Sidebar node palette ---- */
const SIDEBAR_SECTIONS = [
  {
    title: "RULES",
    items: [
      { id: "true-false", label: "True / false branch", icon: GitBranch, color: "#F97316" },
      { id: "multi-split", label: "Multi-split branch", icon: SplitSquareHorizontal, color: "#8B5CF6" },
      { id: "traffic-branch", label: "Traffic branch", icon: Percent, color: "#3B82F6" },
      { id: "delay", label: "Delay", icon: Clock, color: "#6B7280" },
      { id: "exit", label: "Exit", icon: LogOut, color: "#EF4444" },
    ],
  },
  {
    title: "AGENTS",
    isNew: true,
    items: [
      { id: "research-ai", label: "Research with AI", icon: Bot, color: "#6366F1" },
      { id: "qualify", label: "Qualify records", icon: Shield, color: "#10B981" },
    ],
  },
  {
    title: "ACTIONS",
    items: [
      { id: "integrations", label: "Integrations", icon: Layers, color: "#0EA5E9", dots: ["#FF6B35", "#10B981", "#3B82F6"] },
      { id: "manage-sequences", label: "Manage Sequences", icon: Mail, color: "#EC4899" },
      { id: "manage-lists", label: "Manage lists", icon: ListChecks, color: "#8B5CF6" },
      { id: "manage-deals", label: "Manage deals", icon: Handshake, color: "#F59E0B" },
      { id: "enrich-data", label: "Enrich data", icon: Database, color: "#3B82F6" },
      { id: "assign-tasks", label: "Assign manual tasks", icon: ClipboardList, color: "#6B7280" },
    ],
  },
]

/* ---- Connected integrations ---- */
const CONNECTED_INTEGRATIONS = [
  { name: "Predict Data Room", category: "Signals", icon: "🔮", active: true },
  { name: "People Data Labs", category: "Enrichment", icon: "👥", active: true },
  { name: "Hunter.io", category: "Enrichment", icon: "🎯", active: true },
  { name: "HubSpot", category: "CRM", icon: "🟠", active: true },
  { name: "Smartlead", category: "Email", icon: "📧", active: true },
  { name: "Slack", category: "Notifications", icon: "💬", active: true },
]

/* ---- Quick suggestion chips (co-pilot tab) ---- */
const COPILOT_SUGGESTIONS = [
  "Outbound email cadence",
  "Lead scoring pipeline",
  "Multi-channel sequence",
  "ICP enrichment flow",
]

/* ------------------------------------------------------------------ */
/*  ICON RESOLVER                                                     */
/* ------------------------------------------------------------------ */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Database, Target, BarChart3, Mail, Clock, GitBranch, Sparkles,
  Linkedin, LogOut, RefreshCw, Bot, Shield, Globe,
}

function NodeIcon({ name, className }: { name: string; className?: string; color?: string }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return <Zap className={className} />
  return <Icon className={className} />
}

/* ------------------------------------------------------------------ */
/*  CANVAS NODE COMPONENT                                             */
/* ------------------------------------------------------------------ */
function CanvasNodeCard({
  node,
  selected,
  onClick,
  viewMode,
}: {
  node: CanvasNode
  selected: boolean
  onClick: () => void
  viewMode: "detail" | "outline"
}) {
  if (node.type === "label") {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">{node.name}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    )
  }

  if (viewMode === "outline") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all",
          selected
            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
            : "border-border bg-background hover:border-primary/40 hover:bg-muted/30"
        )}
      >
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: node.iconColor + "18" }}
        >
          <NodeIcon name={node.icon} className="h-3.5 w-3.5" color={node.iconColor} />
        </div>
        <span className="text-xs font-medium truncate">{node.name}</span>
        {node.badge && (
          <Badge variant="outline" className="text-[9px] ml-auto px-1.5 py-0 h-4 shrink-0" style={{ borderColor: node.badge.color + "40", color: node.badge.color }}>
            {node.badge.text}
          </Badge>
        )}
      </div>
    )
  }

  // Detail view
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl border-2 bg-background shadow-sm cursor-pointer transition-all group",
        selected
          ? "border-primary ring-4 ring-primary/10 shadow-md"
          : "border-border hover:border-primary/40 hover:shadow-md",
        node.type === "exit" && "border-red-200 bg-red-50/30 dark:bg-red-950/10",
        node.type === "delay" && "border-dashed"
      )}
    >
      <div className="p-4 flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: node.iconColor + "18" }}
        >
          <NodeIcon name={node.icon} className="h-5 w-5" color={node.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold truncate">{node.name}</span>
            {node.badge && (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 shrink-0 font-bold"
                style={{ borderColor: node.badge.color + "40", color: node.badge.color, backgroundColor: node.badge.color + "10" }}
              >
                {node.badge.text}
              </Badge>
            )}
          </div>
          {node.subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">{node.subtitle}</p>
          )}
          {node.tags && node.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {node.tags.map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: tag.color + "18", color: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CONNECTOR LINE                                                    */
/* ------------------------------------------------------------------ */
function ConnectorLine({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className={cn("w-0.5 bg-border", label ? "h-4" : "h-6")} />
      {label && (
        <>
          <span className="text-[9px] font-bold tracking-wider text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full my-0.5">
            {label}
          </span>
          <div className="w-0.5 h-4 bg-border" />
        </>
      )}
      <div className="h-2 w-2 rounded-full border-2 border-border bg-background" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  BRANCH CONNECTOR                                                  */
/* ------------------------------------------------------------------ */
function BranchConnector({
  yesLabel,
  noLabel,
}: {
  yesLabel: string
  noLabel: string
}) {
  return (
    <div className="flex items-start justify-center gap-8 w-full my-1">
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-border" />
        <span className="text-[9px] font-bold tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full">
          YES — {yesLabel}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-border" />
        <span className="text-[9px] font-bold tracking-wider text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
          NO — {noLabel}
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN PAGE COMPONENT                                               */
/* ------------------------------------------------------------------ */
export default function WorkflowCanvasPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
      <WorkflowCanvasInner />
    </Suspense>
  )
}

function WorkflowCanvasInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workflowId = searchParams.get("id")

  const [workflow, setWorkflow] = useState<Workflow>(DEMO_WORKFLOW)
  const [activeTab, setActiveTab] = useState("workflow")
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"detail" | "outline">("detail")
  const [zoom, setZoom] = useState(100)
  const [sidebarSearch, setSidebarSearch] = useState("")
  const [showRightPanel, setShowRightPanel] = useState(false)
  const [settings, setSettings] = useState(DEMO_WORKFLOW.settings)

  /* Load workflow from API if id is provided */
  useEffect(() => {
    if (workflowId) {
      getWorkflow(workflowId)
        .then(setWorkflow)
        .catch(() => { /* fallback to demo data */ })
    }
  }, [workflowId])

  const selectedNode = CANVAS_NODES.find((n) => n.id === selectedNodeId) ?? null

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setShowRightPanel(true)
  }, [])

  const handleCloseRightPanel = useCallback(() => {
    setShowRightPanel(false)
    setSelectedNodeId(null)
  }, [])

  /* Filtered sidebar items */
  const filteredSections = SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      item.label.toLowerCase().includes(sidebarSearch.toLowerCase())
    ),
  })).filter((section) => section.items.length > 0)

  /* ---- YES branch nodes (ICP match YES -> ... -> followup-email) ---- */
  const yesBranchNodes = ["lead-scoring", "score-threshold", "email-sequence", "wait-7d", "linkedin-connect", "wait-3d", "followup-email"]
  /* ---- NO branch nodes (ICP match NO -> wait-30d -> recheck -> exit) ---- */
  const noBranchNodes = ["wait-30d", "recheck-icp", "exit-disqualified"]

  /* ---- Helper to render a vertical chain of nodes ---- */
  function renderNodeChain(nodeIds: string[]) {
    return nodeIds.map((id, i) => {
      const node = CANVAS_NODES.find((n) => n.id === id)
      if (!node) return null
      return (
        <div key={id} className="flex flex-col items-center">
          {i > 0 && <ConnectorLine />}
          <div className="w-full max-w-sm">
            <CanvasNodeCard
              node={node}
              selected={selectedNodeId === id}
              onClick={() => handleNodeClick(id)}
              viewMode={viewMode}
            />
          </div>
          {/* Show score branch after score-threshold */}
          {id === "score-threshold" && viewMode === "detail" && (
            <BranchConnector yesLabel="SCORE ≥80" noLabel="SCORE <80" />
          )}
        </div>
      )
    })
  }

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 sm:-m-6">
      {/* ===== TOP HEADER BAR ===== */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background z-20 shrink-0">
        {/* Left — breadcrumb + name */}
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push("/workflows")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider shrink-0">Workflows</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-semibold truncate">{workflow.name}</span>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0 h-5 shrink-0 border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
            >
              Draft
            </Badge>
          </div>
        </div>

        {/* Center — page tabs */}
        <div className="hidden md:flex">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8">
              <TabsTrigger value="workflow" className="text-xs px-3">Workflow</TabsTrigger>
              <TabsTrigger value="outcome" className="text-xs px-3">Outcome</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs px-3">Settings</TabsTrigger>
              <TabsTrigger value="copilot" className="text-xs px-3 gap-1">
                <Sparkles className="h-3 w-3" />
                Co-pilot
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Right — action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 hidden sm:flex">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-gradient-to-r from-primary to-violet-600 border-none shadow-md text-white">
                <Rocket className="h-3.5 w-3.5" />
                Launch workflow
                <ChevronDown className="h-3 w-3 ml-0.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs">Launch now</DropdownMenuItem>
              <DropdownMenuItem className="text-xs">Schedule launch</DropdownMenuItem>
              <DropdownMenuItem className="text-xs">Test run (dry)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden border-b px-4 py-1.5 bg-background">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="workflow" className="text-xs flex-1">Workflow</TabsTrigger>
            <TabsTrigger value="outcome" className="text-xs flex-1">Outcome</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs flex-1">Settings</TabsTrigger>
            <TabsTrigger value="copilot" className="text-xs flex-1">Co-pilot</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div className="flex-1 overflow-hidden">
        {/* ========================================================== */}
        {/*  TAB 1: WORKFLOW (CANVAS)                                  */}
        {/* ========================================================== */}
        {activeTab === "workflow" && (
          <div className="flex h-full">
            {/* LEFT SIDEBAR — Build Panel */}
            <div className="w-[280px] lg:w-[300px] border-r bg-background flex flex-col shrink-0 overflow-hidden">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search nodes..."
                    className="h-8 pl-8 text-xs"
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-5">
                {filteredSections.map((section) => (
                  <div key={section.title}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {section.title}
                      </h3>
                      {section.isNew && (
                        <Badge className="text-[8px] px-1 py-0 h-3.5 bg-violet-500 text-white border-none">
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 cursor-grab active:cursor-grabbing transition-all group"
                          >
                            <div
                              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: item.color + "15" }}
                            >
                              <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                            </div>
                            <span className="text-xs font-medium">{item.label}</span>
                            {"dots" in item && (item as any).dots && (
                              <div className="flex gap-0.5 ml-auto">
                                {((item as any).dots as string[]).map((dot: string, i: number) => (
                                  <div
                                    key={i}
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: dot }}
                                  />
                                ))}
                              </div>
                            )}
                            <Grip className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-40 ml-auto shrink-0" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CENTER CANVAS */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/20 relative">
              {/* Draft mode banner */}
              <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    Draft mode — activate to start enrolling
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] text-amber-700 dark:text-amber-400 hover:text-amber-900 font-semibold"
                >
                  Activate <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>

              {/* Canvas scroll area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div
                  className="py-8 px-4 flex flex-col items-center min-h-full"
                  style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
                >
                  <div className="w-full max-w-lg space-y-0">
                    {/* WHEN THIS HAPPENS label */}
                    {CANVAS_NODES.filter((n) => n.id === "label-when").map((n) => (
                      <CanvasNodeCard
                        key={n.id}
                        node={n}
                        selected={false}
                        onClick={() => {}}
                        viewMode={viewMode}
                      />
                    ))}

                    <ConnectorLine />

                    {/* Signal Engine trigger */}
                    <CanvasNodeCard
                      node={CANVAS_NODES.find((n) => n.id === "signal-engine")!}
                      selected={selectedNodeId === "signal-engine"}
                      onClick={() => handleNodeClick("signal-engine")}
                      viewMode={viewMode}
                    />

                    <ConnectorLine />

                    {/* THEN DO THIS label */}
                    {CANVAS_NODES.filter((n) => n.id === "label-then").map((n) => (
                      <CanvasNodeCard
                        key={n.id}
                        node={n}
                        selected={false}
                        onClick={() => {}}
                        viewMode={viewMode}
                      />
                    ))}

                    <ConnectorLine />

                    {/* Waterfall Enrich */}
                    <CanvasNodeCard
                      node={CANVAS_NODES.find((n) => n.id === "waterfall-enrich")!}
                      selected={selectedNodeId === "waterfall-enrich"}
                      onClick={() => handleNodeClick("waterfall-enrich")}
                      viewMode={viewMode}
                    />

                    <ConnectorLine />

                    {/* ICP Match */}
                    <CanvasNodeCard
                      node={CANVAS_NODES.find((n) => n.id === "icp-match")!}
                      selected={selectedNodeId === "icp-match"}
                      onClick={() => handleNodeClick("icp-match")}
                      viewMode={viewMode}
                    />

                    {/* Branch split */}
                    <BranchConnector yesLabel="ICP MATCH" noLabel="NOT ICP" />

                    {/* Two-column branch layout */}
                    <div className="grid grid-cols-2 gap-4 w-full">
                      {/* YES branch */}
                      <div className="flex flex-col items-center space-y-0">
                        {renderNodeChain(yesBranchNodes)}
                      </div>

                      {/* NO branch */}
                      <div className="flex flex-col items-center space-y-0">
                        {renderNodeChain(noBranchNodes)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-background border-t shrink-0">
                {/* View toggle */}
                <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
                  <button
                    onClick={() => setViewMode("outline")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      viewMode === "outline" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="h-3 w-3" />
                    Outline
                  </button>
                  <button
                    onClick={() => setViewMode("detail")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      viewMode === "detail" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    Detail
                  </button>
                </div>

                {/* Zoom controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom((z) => Math.max(25, z - 10))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-[11px] font-mono text-muted-foreground w-10 text-center">{zoom}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom((z) => Math.min(200, z + 10))}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom(100)}
                    title="Fit to screen"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom(100)}
                    title="Reset zoom"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL — Node configuration (shown when a node is selected) */}
            {showRightPanel && selectedNode && selectedNode.type !== "label" && (
              <div className="w-[300px] lg:w-[320px] border-l bg-background flex flex-col shrink-0 overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: selectedNode.iconColor + "18" }}
                    >
                      <NodeIcon name={selectedNode.icon} className="h-3.5 w-3.5" color={selectedNode.iconColor} />
                    </div>
                    <span className="text-sm font-semibold truncate">{selectedNode.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCloseRightPanel}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5">
                  {/* Signal Engine config */}
                  {selectedNode.id === "signal-engine" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Active trigger sources
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {SIGNAL_TAGS.map((tag) => (
                            <span
                              key={tag.label}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                              style={{ backgroundColor: tag.color + "18", color: tag.color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Schedule
                        </label>
                        <Select defaultValue="daily-8am">
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily-8am">Daily at 8:00 AM</SelectItem>
                            <SelectItem value="daily-9am">Daily at 9:00 AM</SelectItem>
                            <SelectItem value="hourly">Every hour</SelectItem>
                            <SelectItem value="realtime">Real-time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium">Business hours only</p>
                            <p className="text-[10px] text-muted-foreground">Only trigger during 9AM-6PM</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium">Skip weekends</p>
                            <p className="text-[10px] text-muted-foreground">No triggers on Sat/Sun</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Generic node config */}
                  {selectedNode.id !== "signal-engine" && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Node name
                        </label>
                        <Input className="h-8 text-xs" defaultValue={selectedNode.name} />
                      </div>

                      {selectedNode.subtitle && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Description
                          </label>
                          <p className="text-xs text-muted-foreground">{selectedNode.subtitle}</p>
                        </div>
                      )}

                      {selectedNode.type === "delay" && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Duration
                          </label>
                          <Select defaultValue={selectedNode.name.includes("7") ? "7d" : selectedNode.name.includes("3") ? "3d" : "30d"}>
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1d">1 day</SelectItem>
                              <SelectItem value="3d">3 days</SelectItem>
                              <SelectItem value="7d">7 days</SelectItem>
                              <SelectItem value="14d">14 days</SelectItem>
                              <SelectItem value="30d">30 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.type === "condition" && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Condition type
                          </label>
                          <Select defaultValue="match">
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="match">Property match</SelectItem>
                              <SelectItem value="score">Score threshold</SelectItem>
                              <SelectItem value="list">List membership</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {selectedNode.badge && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Execution badge
                          </p>
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{
                              borderColor: selectedNode.badge.color + "40",
                              color: selectedNode.badge.color,
                              backgroundColor: selectedNode.badge.color + "10",
                            }}
                          >
                            {selectedNode.badge.text}
                          </Badge>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/*  TAB 2: OUTCOME                                            */}
        {/* ========================================================== */}
        {activeTab === "outcome" && (
          <div className="h-full overflow-y-auto">
            {/* Inactive banner */}
            <div className="flex items-center justify-between px-6 py-3 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  This workflow is currently inactive. Activate to start running.
                </span>
              </div>
              <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                Activate
              </Button>
            </div>

            <div className="p-6 space-y-6 max-w-6xl mx-auto">
              {/* Record runs table */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Record runs</h3>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Target</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Runs</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Completed</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In progress</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Failed</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Credit usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b last:border-b-0">
                        <td colSpan={6} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                              <SearchIcon className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Records will appear once the specified event happens...</p>
                              <p className="text-xs text-muted-foreground/60 mt-1">Activate the workflow to start enrolling records.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pre-qualified section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold">Pre-qualified</h3>
                  <Badge variant="outline" className="text-[10px] h-4">0 records</Badge>
                </div>
                <div className="border rounded-xl p-8 flex flex-col items-center gap-3 bg-muted/10">
                  <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">No pre-qualified records yet.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/*  TAB 3: SETTINGS                                           */}
        {/* ========================================================== */}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <div className="p-6 max-w-6xl mx-auto space-y-6">
              {/* Row 1 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Workflow Basics */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Workflow Basics
                    </h3>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Name</label>
                      <Input
                        className="h-9 text-sm"
                        value={workflow.name}
                        onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Description</label>
                      <Textarea
                        className="text-sm min-h-20"
                        value={workflow.description}
                        onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Owner</label>
                      <Input className="h-9 text-sm" defaultValue={workflow.owner_name} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Target object</label>
                      <Select defaultValue={workflow.target_object}>
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="People">People</SelectItem>
                          <SelectItem value="Companies">Companies</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Execution Rules */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Execution Rules
                    </h3>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Timezone</label>
                      <Select
                        defaultValue={settings.timezone}
                        onValueChange={(v) => setSettings({ ...settings, timezone: v })}
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                          <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                          <SelectItem value="Europe/London">GMT / London</SelectItem>
                          <SelectItem value="Asia/Kolkata">IST / Kolkata</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-medium">Business hours only</p>
                        <p className="text-[10px] text-muted-foreground">Only run during 9AM-6PM</p>
                      </div>
                      <Switch
                        checked={settings.business_hours_only}
                        onCheckedChange={(v) => setSettings({ ...settings, business_hours_only: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs font-medium">Skip weekends</p>
                        <p className="text-[10px] text-muted-foreground">Pause on Saturday and Sunday</p>
                      </div>
                      <Switch
                        checked={settings.skip_weekends}
                        onCheckedChange={(v) => setSettings({ ...settings, skip_weekends: v })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Max runs per record</label>
                      <Select
                        defaultValue={settings.max_runs_per_record}
                        onValueChange={(v) => setSettings({ ...settings, max_runs_per_record: v })}
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unlimited">Unlimited</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Re-enrollment rule</label>
                      <Select
                        defaultValue={settings.re_enrollment_rule}
                        onValueChange={(v) => setSettings({ ...settings, re_enrollment_rule: v })}
                      >
                        <SelectTrigger className="h-9 text-sm w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Once per 30 days">Once per 30 days</SelectItem>
                          <SelectItem value="Once">Once</SelectItem>
                          <SelectItem value="Always">Always</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2 */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Notifications */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Notifications
                    </h3>
                    <div className="space-y-3">
                      {[
                        { key: "notify_owner_on_exit" as const, label: "Notify owner on exit", desc: "Send an alert when a record exits the workflow" },
                        { key: "slack_alerts" as const, label: "Slack alerts", desc: "Post notifications to connected Slack channel" },
                        { key: "email_notifications" as const, label: "Email notifications", desc: "Send email digest of workflow activity" },
                        { key: "error_alerts" as const, label: "Error alerts", desc: "Notify immediately when errors occur" },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-1">
                          <div>
                            <p className="text-xs font-medium">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                          </div>
                          <Switch
                            checked={settings[item.key]}
                            onCheckedChange={(v) => setSettings({ ...settings, [item.key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Connected Integrations */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Connected Integrations
                    </h3>
                    <div className="space-y-2">
                      {CONNECTED_INTEGRATIONS.map((integration) => (
                        <div
                          key={integration.name}
                          className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/10"
                        >
                          <span className="text-lg shrink-0">{integration.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{integration.name}</p>
                            <p className="text-[10px] text-muted-foreground">{integration.category}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 shrink-0"
                          >
                            Active
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/*  TAB 4: CO-PILOT (NON-FUNCTIONAL UI)                      */}
        {/* ========================================================== */}
        {activeTab === "copilot" && (
          <div className="h-full flex items-center justify-center bg-muted/10">
            <div className="w-full max-w-lg p-8 space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl font-bold">AI Co-pilot</h2>
                <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                  Describe what you want to build and the AI will generate a complete workflow for you.
                </p>
              </div>

              <div className="space-y-3">
                <Textarea
                  placeholder="e.g. Create an outbound sequence that enriches leads from Predict Data Room, scores them, and sends personalised emails..."
                  className="min-h-28 text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Powered by Outmate AI</span>
                  <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-none shadow-md text-xs h-8 gap-1.5">
                    Generate workflow
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Quick suggestion chips */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                  Quick suggestions
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {COPILOT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="px-3 py-1.5 rounded-full border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
