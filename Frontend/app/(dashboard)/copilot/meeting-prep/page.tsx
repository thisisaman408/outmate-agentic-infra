"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar, ChevronDown, ChevronUp, X, Clock, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi, type MeetingPrepInput } from "@/lib/api/copilot"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"

interface AutoBrief {
  id: string
  meeting_title: string
  calendar_event_id: string
  event_start: string
  context: string
  objections: Array<{ objection: string; rebuttal: string }>
  talking_points: string[]
  ask: string
  enrichment_used: boolean
  created_at: string
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between py-3"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="text-base">{title}</CardTitle>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

function AutoBriefBanner({
  brief,
  onDismiss,
  onView,
}: {
  brief: AutoBrief
  onDismiss: (id: string) => void
  onView: (brief: AutoBrief) => void
}) {
  const formatTime = (iso: string) => {
    if (!iso) return ""
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5 relative">
      <div className="shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">Brief Ready: {brief.meeting_title}</p>
          {brief.enrichment_used && (
            <Badge variant="outline" className="text-xs border-green-500/40 text-green-600">
              Enriched
            </Badge>
          )}
        </div>
        {brief.event_start && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {formatTime(brief.event_start)}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{brief.context}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs"
          onClick={() => onView(brief)}
        >
          View Brief
        </Button>
      </div>
      <button
        onClick={() => onDismiss(brief.id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function MeetingPrepPage() {
  const [form, setForm] = useState<MeetingPrepInput>({ company_name: "" })
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoBriefs, setAutoBriefs] = useState<AutoBrief[]>([])
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // ── Agent store subscription ──
  const agentForm = useCoPilotAgentStore(
    (state) => state.copilotForms?.['meeting_prep']
  )
  const isAgentHighlighted = useCoPilotAgentStore(
    (state) => state.highlightedElement === 'meeting_prep-form-panel'
  )
  const prevSubmitSignal = useRef<number>(0)

  // When agent injects fields, pre-fill and optionally auto-submit
  useEffect(() => {
    if (!agentForm) return
    const { fields, submitSignal } = agentForm
    const f = fields as Record<string, any>

    // Pre-fill form fields
    setForm({
      company_name: f.company_name ?? "",
      company_domain: f.company_domain ?? "",
      prospect_name: f.prospect_name ?? "",
      prospect_title: f.prospect_title ?? "",
    })

    // Auto-submit only when submitSignal increments (new injection)
    if (submitSignal > prevSubmitSignal.current && f.company_name) {
      prevSubmitSignal.current = submitSignal
      // Run submit after state has settled
      setTimeout(() => {
        setIsLoading(true)
        copilotApi.generateMeetingPrep({
          company_name: f.company_name,
          company_domain: f.company_domain,
          prospect_name: f.prospect_name,
          prospect_title: f.prospect_title,
        }).then((data) => {
          setResult(data)
          localStorage.setItem("last_meeting_prep", JSON.stringify(data))
        }).catch((err: any) => {
          toast({ title: "Error", description: err?.message || "Failed to generate meeting prep", variant: "destructive" })
        }).finally(() => setIsLoading(false))
      }, 50)
    }
  }, [agentForm, toast])

  // Restore last result when arriving from a notification
  useEffect(() => {
    if (searchParams.get("show") === "latest") {
      try {
        const saved = localStorage.getItem("last_meeting_prep")
        if (saved) setResult(JSON.parse(saved))
      } catch {}
    }
  }, [searchParams])

  const fetchPendingBriefs = useCallback(async () => {
    try {
      const res = await fetch("/api/copilot/meeting-prep/pending", {
        headers: { "Content-Type": "application/json" },
      })
      if (res.ok) {
        const data = await res.json()
        setAutoBriefs(data)
      }
    } catch {
      // best-effort
    }
  }, [])

  // Poll on mount and every 60s, and on tab focus
  useEffect(() => {
    fetchPendingBriefs()
    const id = setInterval(fetchPendingBriefs, 60_000)
    const onFocus = () => fetchPendingBriefs()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [fetchPendingBriefs])

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/copilot/meeting-prep/${id}/viewed`, { method: "PUT" })
    } catch {}
    setAutoBriefs((prev) => prev.filter((b) => b.id !== id))
  }

  const handleViewAutoBrief = async (brief: AutoBrief) => {
    // Mark as viewed
    try {
      await fetch(`/api/copilot/meeting-prep/${brief.id}/viewed`, { method: "PUT" })
    } catch {}
    setAutoBriefs((prev) => prev.filter((b) => b.id !== brief.id))

    // Populate the result panel with the auto-brief data
    setResult({
      _is_auto_brief: true,
      meeting_title: brief.meeting_title,
      context: brief.context,
      objections: brief.objections,
      talking_points: brief.talking_points,
      ask: brief.ask,
      enrichment_used: brief.enrichment_used,
      event_start: brief.event_start,
    })
    // Pre-fill the form too
    setForm({ company_name: brief.meeting_title })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setIsLoading(true)
    try {
      const data = await copilotApi.generateMeetingPrep(form)
      setResult(data)
      localStorage.setItem("last_meeting_prep", JSON.stringify(data))
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to generate meeting prep",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Meeting Prep</h2>
        <p className="text-sm text-muted-foreground">Walk into every call prepared</p>
      </div>

      {/* Auto-generated briefs banner */}
      {autoBriefs.length > 0 && (
        <div className="space-y-3">
          {autoBriefs.map((brief) => (
            <AutoBriefBanner
              key={brief.id}
              brief={brief}
              onDismiss={handleDismiss}
              onView={handleViewAutoBrief}
            />
          ))}
        </div>
      )}

      <Card
        id="meeting_prep-form-panel"
        className={isAgentHighlighted ? "ring-2 ring-primary/60 shadow-lg shadow-primary/20 transition-shadow duration-300" : ""}
      >
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Company Name *</label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Company Domain</label>
                <Input
                  placeholder="e.g. acme.com"
                  value={form.company_domain ?? ""}
                  onChange={(e) => setForm({ ...form, company_domain: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Prospect Name</label>
                <Input
                  placeholder="e.g. Jane Doe"
                  value={form.prospect_name ?? ""}
                  onChange={(e) => setForm({ ...form, prospect_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Prospect Title</label>
                <Input
                  placeholder="e.g. VP of Sales"
                  value={form.prospect_title ?? ""}
                  onChange={(e) => setForm({ ...form, prospect_title: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={isLoading || !form.company_name.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Generate Pre-Call Brief
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Preparing your brief...</span>
          </CardContent>
        </Card>
      )}

      {/* Auto-brief result panel */}
      {result?._is_auto_brief && !isLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border-primary/30">Auto-generated</Badge>
            {result.event_start && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(result.event_start).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-sm font-medium text-primary mb-1">Context</p>
              <p className="text-sm">{result.context}</p>
            </CardContent>
          </Card>

          <CollapsibleSection title="Talking Points">
            <ul className="space-y-2">
              {(result.talking_points ?? []).map((tp: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                  {tp}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {(result.objections ?? []).length > 0 && (
            <CollapsibleSection title="Objections & Rebuttals">
              <ul className="space-y-3">
                {result.objections.map((o: { objection: string; rebuttal: string }, i: number) => (
                  <li key={i} className="text-sm space-y-0.5">
                    <p className="font-medium">⚡ {o.objection}</p>
                    <p className="text-muted-foreground pl-4">{o.rebuttal}</p>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {result.ask && (
            <Card className="border-green-500/30 bg-green-50/40 dark:bg-green-900/10">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">The Ask</p>
                <p className="text-sm">{result.ask}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Manual prep result panel */}
      {result && !result._is_auto_brief && !isLoading && (
        <div className="space-y-4">
          <CollapsibleSection title="Company Snapshot">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Industry:</span> {result.company_snapshot?.industry}</p>
              <p><span className="font-medium">Size:</span> {result.company_snapshot?.size}</p>
              {result.company_snapshot?.recent_news?.length > 0 && (
                <div>
                  <p className="font-medium mb-1">Recent News:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {result.company_snapshot.recent_news.map((n: string, i: number) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.company_snapshot?.tech_stack?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.company_snapshot.tech_stack.map((t: string, i: number) => (
                    <Badge key={i} variant="outline">{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {result.prospect_profile && (
            <CollapsibleSection title="Prospect Profile">
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Background:</span> {result.prospect_profile.background}</p>
                <p>
                  <span className="font-medium">Communication style:</span>{" "}
                  {result.prospect_profile.communication_style_hint}
                </p>
                {result.prospect_profile.likely_priorities?.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Likely priorities:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {result.prospect_profile.likely_priorities.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Talking Points">
            <ul className="space-y-2">
              {(result.talking_points ?? []).map((tp: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                  {tp}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          <CollapsibleSection title="Discovery Questions">
            <ul className="space-y-2">
              {(result.discovery_questions ?? []).map((q: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground p-2 rounded bg-muted/50">
                  ❓ {q}
                </li>
              ))}
            </ul>
          </CollapsibleSection>

          {(result.risk_factors ?? []).length > 0 && (
            <CollapsibleSection title="Risk Factors">
              <ul className="space-y-2">
                {result.risk_factors.map((r: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-red-600">
                    <span>⚠️</span> {r}
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}

          {result.recommended_approach && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-primary mb-1">Recommended Approach</p>
                <p className="text-sm">{result.recommended_approach}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
