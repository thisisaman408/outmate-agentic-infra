"use client"

import { useCallback, useEffect, useState } from "react"
import { SignalDraftCard, type SignalDraft } from "@/components/copilot/signal-draft-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, RefreshCw, Inbox } from "lucide-react"

export default function SignalDraftsPage() {
  const [drafts, setDrafts] = useState<SignalDraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"pending" | "shown" | "all">("shown")

  const fetchDrafts = useCallback(async () => {
    setIsLoading(true)
    try {
      const { copilotApi } = await import("@/lib/api/copilot")
      const data = await copilotApi.getSignalDrafts(filter, 20)
      setDrafts(data as SignalDraft[])
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handleActioned = (id: string) => {
    setDrafts((prev: SignalDraft[]) => prev.filter((d: SignalDraft) => d.id !== id))
  }

  const pendingCount = drafts.filter((d: SignalDraft) => d.status === "pending" || d.status === "shown").length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Signal Drafts</h2>
            {pendingCount > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {pendingCount} new
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-generated outreach emails triggered by ICP signals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-xs">
            {(["shown", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 transition-colors capitalize ${
                  filter === f
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "shown" ? "Pending" : "All"}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={fetchDrafts}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="rounded-full bg-muted p-4">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No signal drafts yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            When a watched account's ICP score crosses your threshold, a personalised
            outreach email will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((d: SignalDraft) => (
            <SignalDraftCard key={d.id} draft={d} onActioned={handleActioned} />
          ))}
        </div>
      )}
    </div>
  )
}
