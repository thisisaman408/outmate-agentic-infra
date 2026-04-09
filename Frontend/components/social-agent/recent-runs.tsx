"use client"

import { Clock, Trash2, Play, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { SocialAgentRun } from "@/lib/social-agent"

interface Props {
  runs: SocialAgentRun[]
  activeRunId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onClear: () => void
}

export function RecentRuns({
  runs,
  activeRunId,
  onSelect,
  onDelete,
  onClear,
}: Props) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-3 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="size-4" />
            Recent Runs
            <span className="text-xs font-normal text-muted-foreground">
              ({runs.length})
            </span>
          </h3>
          {runs.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
            >
              Clear all
            </Button>
          )}
        </div>

        {runs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
            <Play className="size-8 mb-2 opacity-30" />
            <p className="text-sm">No runs yet</p>
            <p className="text-xs mt-1">
              Run the agent on a topic to see it here
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-2 px-2">
            <ul className="space-y-1.5">
              {runs.map((run) => (
                <RunListItem
                  key={run.id}
                  run={run}
                  isActive={run.id === activeRunId}
                  onSelect={() => onSelect(run.id)}
                  onDelete={() => onDelete(run.id)}
                />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

function RunListItem({
  run,
  isActive,
  onSelect,
  onDelete,
}: {
  run: SocialAgentRun
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const ago = formatTimeAgo(run.createdAt)
  const isError = run.status === "error"
  const isRunning = run.status === "running"

  return (
    <li>
      {/* Use a div with role=button instead of a real <button> so we can nest
          a real <button> for the delete action without producing invalid HTML
          (a <button> may not contain another <button>). */}
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect()
          }
        }}
        className={cn(
          "group w-full text-left rounded-lg border px-3 py-2.5 transition-all cursor-pointer",
          "hover:border-primary/40 hover:bg-muted/40",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          isActive && "border-primary/60 bg-primary/5",
          !isActive && "border-border/60",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isError && <AlertCircle className="size-3 text-destructive shrink-0" />}
              <p className="font-medium text-sm truncate">
                {run.input.topic || "(no topic)"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRunning
                ? "Running…"
                : isError
                  ? "Failed"
                  : `${run.leads.length} leads`}
              <span className="mx-1.5">·</span>
              {ago}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
            aria-label="Delete run"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  )
}

function formatTimeAgo(epochMs: number): string {
  const diff = Date.now() - epochMs
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(epochMs).toLocaleDateString()
}
