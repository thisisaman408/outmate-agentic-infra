"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, RefreshCw, UserCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChampionAlertCard } from "@/components/copilot/ChampionAlertCard"
import { ChampionChangeEvent, getChampionAlerts } from "@/lib/api/copilot"

export default function ChampionAlertsPage() {
  const [events, setEvents] = useState<ChampionChangeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getChampionAlerts()
      setEvents(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load champion alerts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const pending   = events.filter((e) => e.status === "pending")
  const acted     = events.filter((e) => e.status === "acted")
  const dismissed = events.filter((e) => e.status === "dismissed")

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Champion Alerts
          </h2>
          <p className="text-sm text-muted-foreground">
            Job-change alerts for contacts you&apos;re tracking
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && events.length === 0 && (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground text-sm">
          <UserCheck className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No champion alerts yet</p>
          <p className="text-xs max-w-xs mx-auto">
            Enable &ldquo;Track job changes&rdquo; on a lead watcher and add a LinkedIn URL.
            Alerts appear here automatically when a contact changes company or gets promoted.
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      {events.length > 0 && (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              Pending
              {pending.length > 0 && (
                <span className="rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5 leading-none">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="acted">Acted ({acted.length})</TabsTrigger>
            <TabsTrigger value="dismissed">Dismissed ({dismissed.length})</TabsTrigger>
          </TabsList>

          {(["pending", "acted", "dismissed"] as const).map((tab) => {
            const list = { pending, acted, dismissed }[tab]
            return (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No {tab} alerts.
                  </p>
                ) : (
                  list.map((e) => (
                    <ChampionAlertCard key={e.id} event={e} onRefresh={load} />
                  ))
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
