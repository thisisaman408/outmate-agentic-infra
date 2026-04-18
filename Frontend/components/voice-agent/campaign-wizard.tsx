"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, ChevronRight, Users, FileSpreadsheet, Zap, Link2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Card, CardContent } from "@/components/ui/card"
import {
  createCampaign,
  getHubSpotLists,
  previewSource,
  type CampaignSourceType,
  type HubSpotList,
  type ManualProspect,
  type PreviewResult,
  type Campaign,
} from "@/lib/api/voice-campaigns"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (c: Campaign) => void
}

type Step = "source" | "config" | "preview"

const SOURCES: { id: CampaignSourceType; icon: typeof Users; label: string; desc: string }[] = [
  { id: "hot_signals", icon: Zap, label: "Hot Signals", desc: "Prospects with fresh signals (funding, hiring, job changes)" },
  { id: "hubspot", icon: Link2, label: "HubSpot list", desc: "Pull contacts from one of your HubSpot lists" },
  { id: "csv", icon: FileSpreadsheet, label: "Uploaded CSV", desc: "The CSV you uploaded via 'Upload list'" },
  { id: "manual", icon: Users, label: "Manual list", desc: "Paste rows — name, phone, company" },
]

export function CampaignWizard({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>("source")
  const [source, setSource] = useState<CampaignSourceType | null>(null)

  const [name, setName] = useState("")
  const [objective, setObjective] = useState("discovery")
  const [maxPerDay, setMaxPerDay] = useState(50)

  const [minIntent, setMinIntent] = useState(70)
  const [days, setDays] = useState(7)

  const [hsLists, setHsLists] = useState<HubSpotList[]>([])
  const [hsListId, setHsListId] = useState("")
  const [hsError, setHsError] = useState<{ message: string; connect_url?: string } | null>(null)
  const [hsLoading, setHsLoading] = useState(false)

  const [manualText, setManualText] = useState("")

  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const reset = useCallback(() => {
    setStep("source"); setSource(null); setName(""); setObjective("discovery")
    setMaxPerDay(50); setMinIntent(70); setDays(7); setHsListId("")
    setHsError(null); setManualText(""); setPreview(null); setSubmitError("")
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    if (source !== "hubspot") return
    setHsLoading(true); setHsError(null)
    getHubSpotLists()
      .then(setHsLists)
      .catch((e: Error) => {
        try {
          const detail = JSON.parse(e.message.split(": ").slice(1).join(": "))
          if (detail.error === "hubspot_not_connected") {
            setHsError({ message: detail.message, connect_url: detail.connect_url })
          } else {
            setHsError({ message: e.message })
          }
        } catch {
          setHsError({ message: e.message })
        }
      })
      .finally(() => setHsLoading(false))
  }, [source])

  const manualProspects: ManualProspect[] = useMemo(() => {
    return manualText.split("\n").map((line) => {
      const [n, p, c = "", r = ""] = line.split(",").map((x) => x.trim())
      return n && p ? { prospect_name: n, prospect_phone: p, prospect_company: c, prospect_role: r } : null
    }).filter(Boolean) as ManualProspect[]
  }, [manualText])

  const canLaunch = useMemo(() => {
    if (!name.trim()) return false
    if (source === "manual") return manualProspects.length > 0
    if (source === "hubspot") return !!hsListId
    return true
  }, [name, source, manualProspects, hsListId])

  const sourceParams = useMemo(() => {
    if (source === "hot_signals") return { min_intent: minIntent, days, max_prospects: 200 }
    if (source === "hubspot") return { list_id: hsListId }
    return {}
  }, [source, minIntent, days, hsListId])

  const runPreview = useCallback(async () => {
    if (source !== "hot_signals" && source !== "hubspot") {
      setStep("preview"); return
    }
    setPreviewLoading(true)
    try {
      const p = await previewSource(source, sourceParams)
      setPreview(p)
      setStep("preview")
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Preview failed")
    } finally {
      setPreviewLoading(false)
    }
  }, [source, sourceParams])

  const handleLaunch = useCallback(async () => {
    if (!source) return
    setSubmitting(true); setSubmitError("")
    try {
      const c = await createCampaign({
        name,
        call_objective: objective,
        source_type: source,
        source_params: sourceParams,
        max_calls_per_day: maxPerDay,
        manual_prospects: source === "manual" ? manualProspects : undefined,
      })
      onCreated(c)
      onOpenChange(false)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create campaign")
    } finally {
      setSubmitting(false)
    }
  }, [source, name, objective, sourceParams, maxPerDay, manualProspects, onCreated, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New voice campaign</DialogTitle>
          <DialogDescription>
            {step === "source" && "Pick where the prospects come from"}
            {step === "config" && "Configure the campaign"}
            {step === "preview" && "Review and launch"}
          </DialogDescription>
        </DialogHeader>

        {step === "source" && (
          <div className="grid grid-cols-2 gap-3">
            {SOURCES.map((s) => {
              const Icon = s.icon
              const active = source === s.id
              return (
                <Card
                  key={s.id}
                  onClick={() => setSource(s.id)}
                  className={`cursor-pointer transition ${active ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/50"}`}
                >
                  <CardContent className="p-4">
                    <Icon className="h-5 w-5 mb-2 text-primary" />
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {step === "config" && source && (
          <div className="space-y-4">
            <div>
              <Label>Campaign name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funding outreach — Apr 2026" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Call objective</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="demo">Intro demo</SelectItem>
                    <SelectItem value="followup">Follow up</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max calls/day</Label>
                <Input type="number" value={maxPerDay} onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 50)} min={1} max={500} />
              </div>
            </div>

            {source === "hot_signals" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min intent score</Label>
                  <Input type="number" value={minIntent} onChange={(e) => setMinIntent(parseInt(e.target.value) || 0)} min={0} max={100} />
                </div>
                <div>
                  <Label>Signals from last N days</Label>
                  <Input type="number" value={days} onChange={(e) => setDays(parseInt(e.target.value) || 7)} min={1} max={90} />
                </div>
              </div>
            )}

            {source === "hubspot" && (
              <div>
                <Label>HubSpot list</Label>
                {hsLoading && <div className="text-xs text-muted-foreground mt-2"><Loader2 className="h-3 w-3 inline animate-spin" /> Loading lists…</div>}
                {hsError && (
                  <div className="text-sm text-destructive mt-2 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <div>{hsError.message}</div>
                      {hsError.connect_url && (
                        <a href={hsError.connect_url} className="underline text-primary text-xs">Connect HubSpot →</a>
                      )}
                    </div>
                  </div>
                )}
                {!hsLoading && !hsError && (
                  <Select value={hsListId} onValueChange={setHsListId}>
                    <SelectTrigger><SelectValue placeholder="Choose a list" /></SelectTrigger>
                    <SelectContent>
                      {hsLists.map((l) => (
                        <SelectItem key={l.list_id} value={l.list_id}>
                          {l.name} {l.size ? `(${l.size})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {source === "manual" && (
              <div>
                <Label>Prospects (one per line: name, phone, company, role)</Label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm font-mono min-h-[120px] bg-background"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Jane Smith, +14155551234, Acme Corp, VP Sales"
                />
                <div className="text-xs text-muted-foreground mt-1">{manualProspects.length} valid rows</div>
              </div>
            )}

            {source === "csv" && (
              <div className="text-sm text-muted-foreground">
                Uses whichever CSV you last uploaded via the &quot;Upload list&quot; button.
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="font-medium">{preview?.total ?? manualProspects.length}</span> prospects will be called.
            </div>
            <div className="text-xs text-muted-foreground">
              Credit cost: <span className="font-medium text-foreground">{(preview?.total ?? manualProspects.length) * 5}</span> credits (5 per call).
              Calls will spread across {Math.ceil((preview?.total ?? manualProspects.length) / maxPerDay)} day(s) at {maxPerDay}/day.
            </div>
            <div className="border rounded-md divide-y max-h-64 overflow-y-auto text-sm">
              {(preview?.preview ?? manualProspects.slice(0, 10)).map((p, i) => (
                <div key={i} className="px-3 py-2 flex justify-between">
                  <span>{p.prospect_name} — {p.prospect_company}</span>
                  <span className="text-muted-foreground text-xs">{p.prospect_phone}</span>
                </div>
              ))}
            </div>
            {submitError && <div className="text-sm text-destructive">{submitError}</div>}
          </div>
        )}

        <DialogFooter>
          {step !== "source" && (
            <Button variant="ghost" onClick={() => setStep(step === "preview" ? "config" : "source")} disabled={submitting}>
              Back
            </Button>
          )}
          {step === "source" && (
            <Button onClick={() => setStep("config")} disabled={!source}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "config" && (
            <Button onClick={runPreview} disabled={!canLaunch || previewLoading}>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Preview <ChevronRight className="h-4 w-4 ml-1" /></>}
            </Button>
          )}
          {step === "preview" && (
            <Button onClick={handleLaunch} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Launch campaign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
