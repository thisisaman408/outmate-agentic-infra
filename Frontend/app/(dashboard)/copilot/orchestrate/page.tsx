"use client"

import React, { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AutomationPanel } from "@/components/copilot/automation-panel"
import {
  Loader2,
  Play,
  Square,
  CheckCircle2,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  Brain,
  Zap,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useOrchestrator, StepState } from "@/hooks/use-orchestrator"
import { copilotApi, AuditLogEntry, OrchestratorEvent } from "@/lib/api/copilot"

// ── Prospect picker with name-search autocomplete ────────────

interface ProspectResult {
  id: string
  name: string
  title: string
  company: string
  source: "db" | "crustdata"
  context_overrides: Record<string, unknown> | null
}

interface ProspectPickerProps {
  prospectId: string
  onSelect: (id: string, label: string, contextOverrides: Record<string, unknown> | null) => void
}

function ProspectPicker({ prospectId, onSelect }: ProspectPickerProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProspectResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // If prospectId was set externally (URL param) show a placeholder label
  useEffect(() => {
    if (prospectId && !selectedLabel) setSelectedLabel(prospectId)
  }, [prospectId, selectedLabel])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    setSelectedLabel("")
    onSelect("", "", null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await copilotApi.searchProspects(val)
        setResults(res as ProspectResult[])
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
  }

  const handleSelect = (p: ProspectResult) => {
    const label = `${p.name}${p.company ? ` · ${p.company}` : ""}${p.source === "crustdata" ? " (external)" : ""}`
    setSelectedLabel(label)
    setQuery("")
    setResults([])
    onSelect(p.id, label, p.context_overrides)
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Prospect
      </label>

      {selectedLabel ? (
        <div className="flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm">
          <span className="flex-1 truncate text-foreground">{selectedLabel}</span>
          <button
            onClick={() => { setSelectedLabel(""); onSelect("", "", null) }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by name…"
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          {results.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border/40 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium flex-1">{p.name}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${p.source === "crustdata" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"}`}>
                      {p.source === "crustdata" ? "External" : "CRM"}
                    </span>
                  </div>
                  {(p.title || p.company) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[p.title, p.company].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Step progress row ────────────────────────────────────────

function StepRow({ step }: { step: StepState }) {
  const [open, setOpen] = useState(false)
  const icon = {
    waiting: <Circle className="w-4 h-4 text-muted-foreground" />,
    running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    done: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  }[step.status]

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => step.result && setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        {icon}
        <span className="flex-1 text-sm font-medium">{step.label}</span>
        <Badge variant="outline" className="text-xs font-mono">{step.action}</Badge>
        {!!step.result && (open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />)}
      </button>
      {open && !!step.result && (
        <div className="px-4 pb-3 text-xs text-muted-foreground font-mono bg-muted/20 whitespace-pre-wrap max-h-60 overflow-y-auto">
          {JSON.stringify(step.result, null, 2)}
        </div>
      )}
    </div>
  )
}

// ── Section result renderer ──────────────────────────────────

function renderValue(val: unknown, depth = 0): React.ReactNode {
  if (val === null || val === undefined) return <span className="text-muted-foreground/50">—</span>
  if (typeof val === "boolean") return <span className={val ? "text-emerald-600" : "text-red-500"}>{String(val)}</span>
  if (typeof val === "number") return <span className="text-blue-600 dark:text-blue-400 font-mono">{val}</span>
  if (typeof val === "string") {
    if (val.length === 0) return <span className="text-muted-foreground/50">—</span>
    return <span className="leading-relaxed">{val}</span>
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-muted-foreground/50">Empty</span>
    return (
      <ul className={`space-y-2 ${depth > 0 ? "mt-1" : ""}`}>
        {val.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
            <span className="flex-1">{renderValue(item, depth + 1)}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (typeof val === "object") {
    return (
      <div className={`space-y-3 ${depth > 0 ? "pl-3 border-l border-border/40 mt-1" : ""}`}>
        {Object.entries(val as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {k.replace(/_/g, " ")}
            </p>
            <div className="text-sm text-foreground">{renderValue(v, depth + 1)}</div>
          </div>
        ))}
      </div>
    )
  }
  return <span>{String(val)}</span>
}

function SectionResult({ result }: { result: Record<string, unknown> }) {
  if (result?.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
        <p className="font-semibold mb-1">Step failed</p>
        <p className="text-xs">{String(result.error)}</p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border bg-card p-4 max-h-[500px] overflow-y-auto">
      {renderValue(result)}
    </div>
  )
}


// ── Artifact viewer ─────────────────────────────────────────

function ArtifactViewer({
  artifact,
}: {
  artifact: NonNullable<ReturnType<typeof useOrchestrator>["state"]["artifact"]>
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const copyAll = () => {
    const text = [
      `Intent: ${artifact.intent}`,
      "",
      `Summary: ${artifact.summary}`,
      "",
      ...artifact.sections.map(
        (s) => `=== ${s.label.toUpperCase()} ===\n${JSON.stringify(s.result, null, 2)}`
      ),
    ].join("\n")
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Copied to clipboard" })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-base">{artifact.intent}</h3>
          <p className="text-sm text-muted-foreground mt-1">{artifact.summary}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {artifact.credits_used} credits
          </Badge>
          <Badge variant="outline" className="text-xs">
            {(artifact.duration_ms / 1000).toFixed(1)}s
          </Badge>
          <Button size="sm" variant="outline" onClick={copyAll} className="h-7 text-xs gap-1">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            Copy all
          </Button>
        </div>
      </div>

      <Separator />

      {/* Tabs for each step section */}
      {artifact.sections.length > 0 && (
        <Tabs defaultValue={artifact.sections[0].step_id}>
          <TabsList className="flex-wrap h-auto gap-1">
            {artifact.sections.map((s) => (
              <TabsTrigger key={s.step_id} value={s.step_id} className="text-xs">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {artifact.sections.map((s) => (
            <TabsContent key={s.step_id} value={s.step_id} className="mt-3">
              <SectionResult result={s.result} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

// ── Audit log panel ──────────────────────────────────────────

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState<import("@/lib/api/copilot").AuditLogEntryFull | null>(null)
  const [loadingFull, setLoadingFull] = useState(false)

  const toggle = async () => {
    if (!open && !full) {
      setLoadingFull(true)
      try {
        const data = await copilotApi.getAuditLogEntry(entry.id)
        setFull(data)
      } catch { /* show nothing */ }
      finally { setLoadingFull(false) }
    }
    setOpen((o) => !o)
  }

  const artifact = full?.output as Record<string, unknown> | undefined
  const sections = (artifact?.sections ?? []) as Array<{ step_id: string; label: string; result: Record<string, unknown> }>

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Row header — always visible */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{entry.action_type}</p>
          {entry.user_prompt && (
            <p className="text-xs text-muted-foreground truncate">{entry.user_prompt}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant={entry.status === "success" ? "default" : "destructive"}
            className="text-xs"
          >
            {entry.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{entry.credits_used}cr</span>
          {entry.created_at && (
            <span className="text-xs text-muted-foreground">
              {new Date(entry.created_at).toLocaleDateString()}
            </span>
          )}
          {loadingFull
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            : open
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Expanded output */}
      {open && (
        <div className="border-t bg-muted/10 px-4 py-3">
          {!full ? (
            <p className="text-xs text-muted-foreground">No output data available.</p>
          ) : sections.length > 0 ? (
            <div className="space-y-2">
              {!!artifact?.summary && (
                <p className="text-xs text-muted-foreground mb-3">{String(artifact.summary)}</p>
              )}
              <Tabs defaultValue={sections[0].step_id}>
                <TabsList className="flex-wrap h-auto gap-1">
                  {sections.map((s) => (
                    <TabsTrigger key={s.step_id} value={s.step_id} className="text-xs">
                      {s.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {sections.map((s) => (
                  <TabsContent key={s.step_id} value={s.step_id} className="mt-3">
                    <SectionResult result={s.result} />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          ) : (
            <SectionResult result={(full.output ?? {}) as Record<string, unknown>} />
          )}
        </div>
      )}
    </div>
  )
}

function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    copilotApi
      .getAuditLog(20, 0)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading history…
      </div>
    )

  if (!entries.length)
    return <p className="text-sm text-muted-foreground text-center py-8">No actions yet.</p>

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <AuditLogRow key={e.id} entry={e} />
      ))}
    </div>
  )
}

// ── URL params initialiser ───────────────────────────────────

function useQueryInit(
  setProspectId: (v: string) => void,
  setTask: (v: string) => void,
) {
  const params = useSearchParams()
  useEffect(() => {
    const pid = params.get("prospect_id")
    const t = params.get("task")
    if (pid) setProspectId(pid)
    if (t) setTask(t)
  }, [params, setProspectId, setTask])
}

// ── Main page ────────────────────────────────────────────────

const SUGGESTED_TASKS = [
  "Prepare me for my call — research, meeting brief, and objection prep",
  "Write me a personalised cold email",
  "Give me competitive intelligence on this company",
  "Find similar companies I should be targeting",
]

const STATUS_LABEL: Record<string, string> = {
  context_loading: "Loading context…",
  planning: "Planning steps…",
  executing: "Executing steps…",
  merging: "Merging artifact…",
  complete: "Done",
  error: "Error",
  idle: "",
}

function OrchestratePageInner() {
  const [prospectId, setProspectId] = useState("")
  const [prospectLabel, setProspectLabel] = useState("")
  const [contextOverrides, setContextOverrides] = useState<Record<string, unknown> | null>(null)
  const [task, setTask] = useState("")
  const { state, run, cancel, reset } = useOrchestrator()
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useQueryInit(setProspectId, setTask)

  const isRunning = ["context_loading", "planning", "executing", "merging"].includes(state.status)
  const canRun = prospectId.trim().length > 0 && task.trim().length > 0 && !isRunning

  const handleRun = async () => {
    if (!canRun) return
    try {
      await run(prospectId.trim(), task.trim(), contextOverrides)
    } catch (err: unknown) {
      toast({
        title: "Orchestration failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleSuggest = (t: string) => {
    setTask(t)
    textareaRef.current?.focus()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Co-Pilot Orchestrate</h1>
          <p className="text-sm text-muted-foreground">
            Describe what you need — Co-Pilot plans and executes the steps.
          </p>
        </div>
      </div>

      <Separator />

      {/* Input form */}
      <div className="space-y-4">
        <ProspectPicker
          prospectId={prospectId}
          onSelect={(id, label, overrides) => { setProspectId(id); setProspectLabel(label); setContextOverrides(overrides) }}
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            What do you need?
          </label>
          <Textarea
            ref={textareaRef}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Prepare me for my call with this prospect — research, meeting brief, and objection prep"
            rows={3}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleRun()
            }}
          />
          <p className="text-xs text-muted-foreground">⌘ + Enter to run</p>
        </div>

        {/* Suggested tasks */}
        {task.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TASKS.map((t) => (
              <button
                key={t}
                onClick={() => handleSuggest(t)}
                className="text-xs px-3 py-1.5 rounded-full border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-3">
          {!isRunning ? (
            <Button onClick={handleRun} disabled={!canRun} className="gap-2">
              <Play className="w-4 h-4" />
              Run Co-Pilot
            </Button>
          ) : (
            <Button onClick={cancel} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" />
              Cancel
            </Button>
          )}
          {state.status !== "idle" && !isRunning && (
            <Button onClick={reset} variant="ghost" size="sm">
              Reset
            </Button>
          )}
          {state.estimatedCredits > 0 && (
            <span className="text-sm text-muted-foreground">
              ~{state.estimatedCredits} credits estimated
            </span>
          )}
        </div>
      </div>

      {/* Progress panel */}
      {state.status !== "idle" && (
        <>
          <Separator />
          <div className="space-y-3">
            {/* Status header */}
            <div className="flex items-center gap-2 text-sm font-medium">
              {isRunning && <Loader2 className="w-4 h-4 animate-spin text-violet-500" />}
              {state.status === "complete" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {state.status === "error" && <AlertCircle className="w-4 h-4 text-red-500" />}
              <span>{STATUS_LABEL[state.status]}</span>
              {state.intent && (
                <span className="text-muted-foreground font-normal">— {state.intent}</span>
              )}
            </div>

            {/* Stage indicators */}
            {state.status === "context_loading" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                <Brain className="w-4 h-4 text-blue-400" />
                Assembling context from all available signals…
              </div>
            )}
            {state.status === "planning" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                <Zap className="w-4 h-4 text-amber-400" />
                Planning execution steps…
              </div>
            )}
            {state.status === "merging" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Merging outputs into one artifact…
              </div>
            )}

            {/* Step list */}
            {state.steps.length > 0 && (
              <div className="space-y-2">
                {state.steps.map((step) => (
                  <StepRow key={step.step_id} step={step} />
                ))}
              </div>
            )}

            {/* Error */}
            {state.status === "error" && state.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {state.error}
              </div>
            )}
          </div>
        </>
      )}

      {/* Artifact result */}
      {state.artifact && state.status === "complete" && (
        <>
          <Separator />
          <ArtifactViewer artifact={state.artifact} />
        </>
      )}

      {/* Past actions */}
      {state.status === "idle" && (
        <>
          <Separator />
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Past Actions
            </h2>
            <AuditLogPanel />
          </div>
        </>
      )}
    </div>
  )
}

export default function OrchestratePage() {
  return (
    <Tabs defaultValue="orchestrate" className="flex flex-col h-full">
      <div className="shrink-0 px-6 pt-5 pb-0 border-b border-border/60">
        <TabsList className="h-9 mb-0">
          <TabsTrigger value="orchestrate" className="text-xs px-4">
            Orchestrate
          </TabsTrigger>
          <TabsTrigger value="automation" className="text-xs px-4">
            Automation Agent
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="orchestrate" className="flex-1 overflow-auto mt-0 p-6">
        <Suspense fallback={null}>
          <OrchestratePageInner />
        </Suspense>
      </TabsContent>

      <TabsContent value="automation" className="flex-1 overflow-hidden mt-0">
        <AutomationPanel />
      </TabsContent>
    </Tabs>
  )
}
