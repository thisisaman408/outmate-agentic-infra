"use client"

import { useState, useMemo } from "react"
import {
  Mail,
  Phone,
  Linkedin,
  Building2,
  Target,
  PenTool,
  Activity,
  Upload,
  X,
  Flame,
  Sparkles,
  Check,
  Trash2,
  Coins,
} from "lucide-react"

type EnrichAction = {
  id: string
  title: string
  description: string
  creditPerRow: number
  badge?: "Hot" | "Free"
}

type Category = {
  id: string
  label: string
  icon: any
  actions: EnrichAction[]
}

const categories: Category[] = [
  {
    id: "email",
    label: "Email",
    icon: Mail,
    actions: [
      { id: "find-work-email", title: "Find work email", description: "Waterfall lookup across 6 providers for verified work email", creditPerRow: 3, badge: "Hot" },
      { id: "verify-email", title: "Verify email", description: "Check deliverability and catch-all status for existing emails", creditPerRow: 1 },
      { id: "find-personal-email", title: "Find personal email", description: "Lookup personal/home email address for direct outreach", creditPerRow: 4 },
      { id: "analyze-email-fill", title: "Analyze email fill rate", description: "See how many selected contacts already have verified emails and where gaps exist", creditPerRow: 0, badge: "Free" },
    ],
  },
  {
    id: "phone",
    label: "Phone",
    icon: Phone,
    actions: [
      { id: "find-phone", title: "Find phone number", description: "Direct dial and mobile lookup", creditPerRow: 5 },
      { id: "verify-phone", title: "Verify phone number", description: "Validate phone reachability and format", creditPerRow: 1 },
      { id: "analyze-phone", title: "Analyze phone coverage", description: "Review phone coverage across selected contacts", creditPerRow: 0, badge: "Free" },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    actions: [
      { id: "find-linkedin", title: "Find LinkedIn URL", description: "Match missing LinkedIn profiles", creditPerRow: 1 },
      { id: "extract-profile", title: "Extract profile insights", description: "Summarize role, experience, and seniority", creditPerRow: 2 },
      { id: "gather-posts", title: "Gather professional posts", description: "Pull recent public LinkedIn activity", creditPerRow: 3 },
      { id: "analyze-linkedin", title: "Analyze LinkedIn fill rate", description: "See profile coverage across selected contacts", creditPerRow: 0, badge: "Free" },
    ],
  },
  {
    id: "company",
    label: "Company",
    icon: Building2,
    actions: [
      { id: "company-brief", title: "Add company brief", description: "Generate a 10-second company summary", creditPerRow: 2 },
      { id: "find-hq", title: "Find company HQ", description: "Enrich company location and headquarters", creditPerRow: 1 },
      { id: "find-tech", title: "Find technologies used", description: "Identify current tech stack", creditPerRow: 3 },
      { id: "funding-stage", title: "Company funding stage", description: "Enrich funding and company maturity", creditPerRow: 2 },
      { id: "employee-range", title: "Company employee range", description: "Estimate employee band", creditPerRow: 1 },
    ],
  },
  {
    id: "icp",
    label: "ICP & Scoring",
    icon: Target,
    actions: [
      { id: "icp-fit", title: "ICP fit score", description: "Score contacts based on your ICP criteria", creditPerRow: 5, badge: "Hot" },
      { id: "seniority-tags", title: "Seniority & role tags", description: "Standardize title, department, and level", creditPerRow: 2 },
      { id: "buying-intent", title: "Buying intent score", description: "Estimate likelihood of active interest", creditPerRow: 4 },
    ],
  },
  {
    id: "ai-writing",
    label: "AI Writing",
    icon: PenTool,
    actions: [
      { id: "personal-opener", title: "Personalized opener", description: "AI-written first line for outreach", creditPerRow: 4, badge: "Hot" },
      { id: "person-brief", title: "Person brief", description: "Short summary for sales context", creditPerRow: 2 },
      { id: "outreach-angles", title: "Outreach angle suggestions", description: "Suggest hooks based on role and activity", creditPerRow: 3 },
      { id: "ai-email-draft", title: "AI email draft", description: "Generate a cold email draft", creditPerRow: 5 },
    ],
  },
  {
    id: "signals",
    label: "Signals",
    icon: Activity,
    actions: [
      { id: "job-change", title: "Job change signal", description: "Detect recent role or employer change", creditPerRow: 3 },
      { id: "hiring-signal", title: "Hiring signal", description: "Check if company is actively hiring", creditPerRow: 2 },
      { id: "news-mention", title: "Recent news mention", description: "Detect notable recent public mentions", creditPerRow: 2 },
      { id: "website-activity", title: "Website activity signal", description: "Identify web engagement if available", creditPerRow: 5 },
    ],
  },
  {
    id: "export",
    label: "Export & Push",
    icon: Upload,
    actions: [
      { id: "push-crm", title: "Push to CRM", description: "Send selected contacts into connected CRM", creditPerRow: 0, badge: "Free" },
      { id: "export-csv", title: "Export CSV", description: "Download selected records as CSV", creditPerRow: 0, badge: "Free" },
      { id: "add-sequence", title: "Add to sequence", description: "Push selected contacts into an outreach flow", creditPerRow: 0, badge: "Free" },
      { id: "create-workflow", title: "Create workflow", description: "Trigger automated enrichment workflow", creditPerRow: 0, badge: "Free" },
    ],
  },
]

interface EnrichmentModalProps {
  open: boolean
  onClose: () => void
  selectedRows: number
  totalCredits?: number
}

export default function EnrichmentModal({
  open,
  onClose,
  selectedRows,
  totalCredits = 22400,
}: EnrichmentModalProps) {
  const [activeCat, setActiveCat] = useState("email")
  const [queue, setQueue] = useState<string[]>([])

  const activeCategory = categories.find((c) => c.id === activeCat)!

  const toggleAction = (actionId: string) => {
    setQueue((prev) => (prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]))
  }

  const removeAction = (actionId: string) => {
    setQueue((prev) => prev.filter((id) => id !== actionId))
  }

  const queuedActions = useMemo(() => {
    return queue
      .map((id) => {
        for (const cat of categories) {
          const action = cat.actions.find((a) => a.id === id)
          if (action) return { ...action, category: cat.label }
        }
        return null
      })
      .filter(Boolean) as (EnrichAction & { category: string })[]
  }, [queue])

  const estimatedCredits = useMemo(() => {
    return queuedActions.reduce((sum, a) => sum + a.creditPerRow * selectedRows, 0)
  }, [queuedActions, selectedRows])

  const overBudget = estimatedCredits > totalCredits

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-[960px] max-w-[95vw] h-[560px] max-h-[85vh] rounded-2xl overflow-hidden flex flex-col bg-card border border-border mt-14 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div>
            <h2 className="text-sm font-bold text-foreground">Enrich selected contacts</h2>
            <p className="text-[10px] mt-0.5 text-muted-foreground font-medium">
              {selectedRows} rows selected · choose actions to run
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-primary/10 text-primary">
              <Coins className="w-3 h-3" />
              {totalCredits.toLocaleString()} credits left
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Categories */}
          <div className="w-[200px] min-w-[200px] py-3 overflow-y-auto border-r border-border bg-muted/20 no-scrollbar">
            {categories.map((cat) => {
              const isActive = activeCat === cat.id
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                    isActive ? "bg-primary/10 text-primary border-r-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0`} />
                  <span className={`text-[12px] font-bold flex-1`}>{cat.label}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/60"
                    }`}
                  >
                    {cat.actions.length}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Action cards */}
          <div className="flex-1 min-w-0 p-5 overflow-y-auto space-y-3 no-scrollbar">
            <div className="flex items-center gap-2 mb-4">
              <activeCategory.icon className="w-4.5 h-4.5 text-primary" />
              <span className="text-sm font-bold text-foreground">{activeCategory.label}</span>
              <span className="text-[10px] text-muted-foreground font-bold">{activeCategory.actions.length} actions</span>
            </div>

            {activeCategory.actions.map((action) => {
              const isSelected = queue.includes(action.id)
              return (
                <button
                  key={action.id}
                  onClick={() => toggleAction(action.id)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl text-left transition-all border ${
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected ? "bg-primary text-primary-foreground" : "border-2 border-muted"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-foreground">{action.title}</span>
                      {action.badge === "Hot" && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-[1px] rounded-[4px] bg-destructive/10 text-destructive uppercase tracking-wider">
                          <Flame className="w-3 h-3" /> Hot
                        </span>
                      )}
                      {action.badge === "Free" && (
                        <span className="text-[9px] font-bold px-1.5 py-[1px] rounded-[4px] bg-green-500/10 text-green-500 uppercase tracking-wider">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-1 text-muted-foreground font-medium leading-relaxed">
                      {action.description}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg ${
                      action.creditPerRow === 0 ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {action.creditPerRow === 0 ? "free" : `${action.creditPerRow} cr/row`}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Queue */}
          <div className="w-[280px] min-w-[280px] flex flex-col border-l border-border bg-muted/5">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-foreground">Order Summary</span>
                {queue.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    {queue.length}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
              {queuedActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <Sparkles className="w-8 h-8 mb-3 text-muted-foreground" />
                  <span className="text-[11px] font-bold text-muted-foreground">No actions selected</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Select enrichments to continue</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {queuedActions.map((action) => (
                    <div key={action.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 group border border-border/50">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-foreground truncate">{action.title}</div>
                        <div className="text-[9px] text-muted-foreground font-bold">
                          {action.creditPerRow === 0 ? "free" : `${action.creditPerRow} cr/row`}
                        </div>
                      </div>
                      <button
                        onClick={() => removeAction(action.id)}
                        className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-5 space-y-4 border-t border-border bg-card">
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-muted-foreground">Selected Rows</span>
                  <span className="text-foreground font-bold">{selectedRows}</span>
                </div>
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-muted-foreground">Total Actions</span>
                  <span className="text-foreground font-bold">{queuedActions.length}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-[12px] font-bold text-foreground">Total Credits</span>
                  <span className={`text-[13px] font-black ${overBudget ? "text-destructive" : "text-primary"}`}>
                    {estimatedCredits.toLocaleString()}
                  </span>
                </div>
              </div>

              {overBudget && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-[10px] font-bold flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5" />
                  Insufficient credits for this selection
                </div>
              )}

              <button
                disabled={queue.length === 0 || overBudget}
                className={`w-full py-3 text-[12px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                  queue.length === 0 || overBudget
                    ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
                }`}
              >
                <Sparkles className="w-4 h-4" /> Run {queue.length} enrichment{queue.length !== 1 && 's'}
              </button>
              <p className="text-[9px] text-muted-foreground/60 text-center font-medium">Credits are only consumed for successful lookup results</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
