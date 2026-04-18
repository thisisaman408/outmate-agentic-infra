"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Loader2, Pause, Play, Square, Phone, CheckCircle2, XCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  getCampaign, pauseCampaign, resumeCampaign, cancelCampaign,
  type CampaignDetail, type CampaignProspect,
} from "@/lib/api/voice-campaigns"
import { fetchCallDetails, type CallDetails } from "@/lib/api/voice-agent"

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  error: "bg-red-100 text-red-700",
  calling: "bg-blue-100 text-blue-700",
  success: "bg-green-100 text-green-700",
  skipped: "bg-gray-100 text-gray-500",
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [data, setData] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedProspect, setSelectedProspect] = useState<CampaignProspect | null>(null)
  const [callDetail, setCallDetail] = useState<CallDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getCampaign(id)
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!data) return
    if (data.status === "completed" || data.status === "cancelled") return
    const t = setInterval(load, 5_000)
    return () => clearInterval(t)
  }, [data, load])

  const openProspectDetail = useCallback(async (p: CampaignProspect) => {
    setSelectedProspect(p)
    setCallDetail(null)
    if (!p.agent_run_id) return
    setDetailLoading(true)
    try {
      const d = await fetchCallDetails(p.agent_run_id)
      setCallDetail(d)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Campaign not found</div>

  const pct = data.total_prospects ? Math.round((data.calls_made / data.total_prospects) * 100) : 0

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <Link href="/voice-agent" className="flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
          <ChevronLeft className="h-4 w-4" /> Voice agent
        </Link>
        <div className="flex gap-2">
          {(data.status === "running" || data.status === "queued") && (
            <Button size="sm" variant="outline" onClick={async () => { await pauseCampaign(id); load() }}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
          )}
          {data.status === "paused" && (
            <Button size="sm" variant="outline" onClick={async () => { await resumeCampaign(id); load() }}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
          )}
          {data.status !== "completed" && data.status !== "cancelled" && (
            <Button size="sm" variant="destructive" onClick={async () => { await cancelCampaign(id); load() }}>
              <Square className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <Badge className={STATUS_COLORS[data.status]}>{data.status}</Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {data.source_type} &middot; {data.call_objective} &middot; max {data.max_calls_per_day}/day
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total prospects</div>
          <div className="text-2xl font-semibold">{data.total_prospects}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Calls made</div>
          <div className="text-2xl font-semibold">{data.calls_made}</div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Booked</div>
          <div className="text-2xl font-semibold text-green-600">{data.calls_booked}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Failed</div>
          <div className="text-2xl font-semibold text-red-600">{data.calls_failed}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y text-sm">
            {data.prospects.map((p) => {
              const Icon = p.status === "success" ? CheckCircle2
                : p.status === "error" ? XCircle
                : p.status === "calling" ? Phone
                : Clock
              return (
                <div
                  key={p.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => openProspectDetail(p)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Icon className={`h-4 w-4 shrink-0 ${p.status === "success" ? "text-green-600" : p.status === "error" ? "text-red-600" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.prospect_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.prospect_company} &middot; {p.prospect_phone}
                      </div>
                    </div>
                  </div>
                  <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedProspect} onOpenChange={(v) => !v && setSelectedProspect(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProspect?.prospect_name} — call details</DialogTitle>
          </DialogHeader>
          {detailLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {!detailLoading && selectedProspect && !callDetail && (
            <div className="text-sm text-muted-foreground py-4">
              {selectedProspect.status === "queued"
                ? "Call hasn't started yet."
                : selectedProspect.status === "error"
                ? `Error: ${selectedProspect.error_message}`
                : "No call data yet — transcript arrives after the call ends via the Retell webhook."}
            </div>
          )}
          {callDetail && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Duration:</span> {callDetail.duration}</div>
                <div><span className="text-muted-foreground">Credits:</span> {callDetail.credits_used}</div>
                <div><span className="text-muted-foreground">Disconnect:</span> {callDetail.disconnection_reason || "—"}</div>
                <div><span className="text-muted-foreground">Objective:</span> {callDetail.call_objective}</div>
              </div>
              {callDetail.extracted_variables && Object.entries(callDetail.extracted_variables).some(([, v]) => v) && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Extracted variables</div>
                  <div className="space-y-1 border rounded-md p-3 bg-muted/30">
                    {Object.entries(callDetail.extracted_variables)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="font-medium">{k}:</span> {String(v)}
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {callDetail.transcript && (
                <div>
                  <div className="font-medium text-xs uppercase text-muted-foreground mb-1">Transcript</div>
                  <div className="whitespace-pre-wrap border rounded-md p-3 bg-muted/30 text-xs max-h-64 overflow-y-auto">
                    {callDetail.transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
