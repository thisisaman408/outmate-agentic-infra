"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, Lightbulb, Radar } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { LeadCard } from "@/components/social-agent/lead-card"
import { RecentRuns } from "@/components/social-agent/recent-runs"
import { RunForm } from "@/components/social-agent/run-form"
import { StatsRow } from "@/components/social-agent/stats-row"
import {
  apiDeleteRun,
  apiListRuns,
  apiRunSocialAgent,
  newRunId,
  type SocialAgentRun,
  type SocialAgentRunInput,
} from "@/lib/social-agent"

export default function SocialAgentPage() {
  const [runs, setRuns] = useState<SocialAgentRun[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Hydrate from Outmate Backend on mount.  The Backend hard-filters by
  // current_user.id so this only ever returns the logged-in user's runs.
  useEffect(() => {
    let cancelled = false
    apiListRuns(25)
      .then((stored) => {
        if (cancelled) return
        setRuns(stored)
        if (stored.length > 0) setActiveRunId(stored[0].id)
      })
      .catch((err) => {
        if (cancelled) return
        // Don't surface as a blocking error — empty list is a valid state.
        console.warn("[social-agent] failed to load run history:", err)
      })
      .finally(() => {
        if (!cancelled) setMounted(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activeRun = useMemo(
    () => runs.find((r) => r.id === activeRunId) ?? null,
    [runs, activeRunId],
  )

  // Seed the form with the most recent run's client context so the user
  // doesn't retype it every time (the topic is intentionally left blank).
  const initialFormValues = useMemo<Partial<SocialAgentRunInput> | undefined>(
    () => (runs[0] ? { ...runs[0].input, topic: "" } : undefined),
    [runs],
  )

  async function handleRun(input: SocialAgentRunInput) {
    setErrorMsg(null)
    setIsRunning(true)

    // Optimistic local placeholder so the spinner appears immediately —
    // replaced with the persisted row once the Backend responds.
    const tempId = newRunId()
    const placeholder: SocialAgentRun = {
      id: tempId,
      createdAt: Date.now(),
      input,
      status: "running",
      leads: [],
      upgradeTips: [],
    }
    setRuns((prev) => [placeholder, ...prev])
    setActiveRunId(tempId)

    try {
      const finished = await apiRunSocialAgent(input)
      // Replace the placeholder with the real persisted row.
      setRuns((prev) => [finished, ...prev.filter((r) => r.id !== tempId)])
      setActiveRunId(finished.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const failed: SocialAgentRun = {
        ...placeholder,
        status: "error",
        errorMessage: message,
        durationMs: Date.now() - placeholder.createdAt,
      }
      setRuns((prev) => prev.map((r) => (r.id === tempId ? failed : r)))
      setErrorMsg(message)
    } finally {
      setIsRunning(false)
    }
  }

  async function handleDelete(id: string) {
    const previous = runs
    // Optimistic — remove first, roll back on failure.
    setRuns((prev) => prev.filter((r) => r.id !== id))
    if (activeRunId === id) {
      const remaining = previous.filter((r) => r.id !== id)
      setActiveRunId(remaining[0]?.id ?? null)
    }
    try {
      // Don't try to delete optimistic-only rows that never made it to the server.
      if (!id.startsWith("run_")) {
        await apiDeleteRun(id)
      }
    } catch (err) {
      console.error("[social-agent] delete failed, rolling back:", err)
      setRuns(previous)
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleClear() {
    const previous = runs
    setRuns([])
    setActiveRunId(null)
    try {
      await Promise.all(
        previous
          .filter((r) => !r.id.startsWith("run_"))
          .map((r) => apiDeleteRun(r.id)),
      )
    } catch (err) {
      console.error("[social-agent] clear failed:", err)
      // Refresh from server to get the true state after a partial failure.
      try {
        const refreshed = await apiListRuns(25)
        setRuns(refreshed)
      } catch {
        setRuns(previous)
      }
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Radar className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Social Agent</h1>
            <Badge variant="secondary" className="ml-1">
              New
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 ml-12">
            Find people actively posting about a topic on LinkedIn / X and draft
            personalized outreach grounded in what they posted today.
          </p>
        </div>
      </div>

      {/* Stats */}
      {mounted && <StatsRow runs={runs} />}

      {/* Form + content layout: form on top, then 2-column results/runs */}
      <RunForm
        onSubmit={handleRun}
        isRunning={isRunning}
        initialValues={initialFormValues}
      />

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="break-words">
            {errorMsg}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Results column */}
        <div className="space-y-4 min-w-0">
          <ResultsView run={activeRun} isRunning={isRunning} />
        </div>

        {/* Recent runs sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)]">
          <RecentRuns
            runs={runs}
            activeRunId={activeRunId}
            onSelect={setActiveRunId}
            onDelete={handleDelete}
            onClear={handleClear}
          />
        </div>
      </div>
    </div>
  )
}

function ResultsView({
  run,
  isRunning,
}: {
  run: SocialAgentRun | null
  isRunning: boolean
}) {
  if (!run) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-2">
          <Radar className="size-10 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium">Ready when you are</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Enter a topic above and hit{" "}
            <span className="font-medium text-foreground">Run Agent</span> to
            discover people posting about it and generate personalized outreach.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (run.status === "running") {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="size-12 mx-auto rounded-full border-4 border-primary/20 border-t-primary"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Running on "{run.input.topic}"…
            </p>
            <p className="text-xs text-muted-foreground">
              Searching social posts → enriching profiles → drafting messages.
              This usually takes 30s–2min.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (run.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription className="break-words">
          <strong>Run failed:</strong> {run.errorMessage || "Unknown error"}
        </AlertDescription>
      </Alert>
    )
  }

  // Success — but maybe zero leads
  if (run.leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <p className="text-sm font-medium">No leads found for this topic</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The agent ran successfully but couldn't find recent posts matching
            "{run.input.topic}". Try a broader keyword.
          </p>
          {run.rawOutput && (
            <pre className="text-left text-[11px] mt-4 p-3 bg-muted/40 rounded border border-border/60 overflow-auto max-h-60">
              {run.rawOutput.slice(0, 800)}
            </pre>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Run summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Topic ·</span>{" "}
          <span className="font-semibold">"{run.input.topic}"</span>
          <span className="text-muted-foreground"> · {run.leads.length} leads</span>
        </div>
        {run.durationMs !== undefined && (
          <Badge variant="outline" className="text-[10px]">
            ran in {(run.durationMs / 1000).toFixed(1)}s
          </Badge>
        )}
      </div>

      {/* Lead cards */}
      <div className="space-y-4">
        {run.leads.map((lead, idx) => (
          <LeadCard key={`${run.id}_${idx}`} lead={lead} index={idx} />
        ))}
      </div>

      {/* Upgrade tips */}
      {run.upgradeTips.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-warning text-sm font-semibold">
              <Lightbulb className="size-4" />
              Upgrade Tips
            </div>
            <ul className="space-y-1 text-sm text-foreground/85">
              {run.upgradeTips.map((tip, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">·</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
