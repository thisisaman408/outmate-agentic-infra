"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Loader2, Target, Copy, Check, Mail, Send, TrendingUp,
  User, Building2, Briefcase, Globe, ChevronRight,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  copilotApi,
  type CampaignOptimizerInput,
  type EmailOptimizerInput,
} from "@/lib/api/copilot"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function ScoreCircle({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const color = score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500"
  const ring = score >= 70 ? "border-green-500/30" : score >= 40 ? "border-yellow-500/30" : "border-red-500/30"
  if (size === "sm") {
    return (
      <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border-[3px] ${ring}`}>
        <span className={`text-xl font-bold ${color}`}>{score}</span>
      </div>
    )
  }
  return (
    <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 ${ring}`}>
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-muted-foreground">/ 100</span>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function SourceBadge({ name, active }: { name: string; active: boolean }) {
  return (
    <Badge variant={active ? "default" : "outline"} className={active ? "" : "opacity-40"}>
      {name}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CampaignOptimizerPage() {
  const [form, setForm] = useState<CampaignOptimizerInput>({ subject_line: "", email_body: "" })
  const [leadName, setLeadName] = useState("")
  const [leadCompany, setLeadCompany] = useState("")
  const [leadRole, setLeadRole] = useState("")
  const [leadDomain, setLeadDomain] = useState("")
  const [openRate, setOpenRate] = useState("")
  const [replyRate, setReplyRate] = useState("")
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  // ── Agent store subscription ──
  const agentForm = useCoPilotAgentStore(
    (state) => state.copilotForms?.['email_optimizer']
  )
  const isAgentHighlighted = useCoPilotAgentStore(
    (state) => state.highlightedElement === 'email_optimizer-form-panel'
  )
  const prevSubmitSignal = useRef<number>(0)

  useEffect(() => {
    if (!agentForm) return
    const { fields, submitSignal } = agentForm
    const f = fields as Record<string, any>

    // Pre-fill all form fields
    if (f.subject_line !== undefined) setForm((prev) => ({ ...prev, subject_line: f.subject_line }))
    if (f.email_body !== undefined) setForm((prev) => ({ ...prev, email_body: f.email_body }))
    if (f.lead_name !== undefined) setLeadName(f.lead_name)
    if (f.lead_company !== undefined) setLeadCompany(f.lead_company)
    if (f.lead_role !== undefined) setLeadRole(f.lead_role)
    if (f.lead_domain !== undefined) setLeadDomain(f.lead_domain)
    if (f.open_rate !== undefined) setOpenRate(String(f.open_rate))
    if (f.reply_rate !== undefined) setReplyRate(String(f.reply_rate))

    // Auto-submit when signal increments
    if (submitSignal > prevSubmitSignal.current && f.subject_line && f.email_body) {
      prevSubmitSignal.current = submitSignal
      setTimeout(() => {
        setIsLoading(true)
        const metrics =
          f.open_rate || f.reply_rate
            ? { opened: f.open_rate ? parseFloat(f.open_rate) : undefined, replied: f.reply_rate ? parseFloat(f.reply_rate) : undefined }
            : undefined

        const hasLead = Boolean(f.lead_name?.trim() && f.lead_company?.trim())
        const promise = hasLead
          ? copilotApi.optimizeEmail({
              subject_line: f.subject_line,
              email_body: f.email_body,
              metrics,
              lead_name: f.lead_name?.trim(),
              lead_company: f.lead_company?.trim(),
              lead_role: f.lead_role?.trim() || undefined,
              lead_domain: f.lead_domain?.trim() || undefined,
            })
          : copilotApi.analyzeCampaign({ subject_line: f.subject_line, email_body: f.email_body, metrics })

        promise.then((data) => {
          setResult(data)
          localStorage.setItem("last_campaign_result", JSON.stringify(data))
        }).catch((err: any) => {
          toast({ title: "Error", description: err?.message || "Failed to analyze campaign", variant: "destructive" })
        }).finally(() => setIsLoading(false))
      }, 50)
    }
  }, [agentForm, toast])

  useEffect(() => {
    if (searchParams.get("show") === "latest") {
      try {
        const saved = localStorage.getItem("last_campaign_result")
        if (saved) setResult(JSON.parse(saved))
      } catch {}
    }
  }, [searchParams])

  const hasLeadContext = Boolean(leadName.trim() && leadCompany.trim())
  const hasOptimizerResult = result?.optimized_email

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const metrics =
        openRate || replyRate
          ? {
              opened: openRate ? parseFloat(openRate) : undefined,
              replied: replyRate ? parseFloat(replyRate) : undefined,
            }
          : undefined

      if (hasLeadContext) {
        const payload: EmailOptimizerInput = {
          ...form,
          metrics,
          lead_name: leadName.trim(),
          lead_company: leadCompany.trim(),
          lead_role: leadRole.trim() || undefined,
          lead_domain: leadDomain.trim() || undefined,
        }
        const data = await copilotApi.optimizeEmail(payload)
        setResult(data)
        localStorage.setItem("last_campaign_result", JSON.stringify(data))
      } else {
        const payload: CampaignOptimizerInput = { ...form, metrics }
        const data = await copilotApi.analyzeCampaign(payload)
        setResult(data)
        localStorage.setItem("last_campaign_result", JSON.stringify(data))
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to analyze campaign",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Email Optimizer</h2>
        <p className="text-sm text-muted-foreground">
          Score your email — or add lead context for a hyper-personalized rewrite
        </p>
      </div>

      {/* ── Form ────────────────────────────────────────────── */}
      <Card
        id="email_optimizer-form-panel"
        className={isAgentHighlighted ? "ring-2 ring-primary/60 shadow-lg shadow-primary/20 transition-shadow duration-300" : ""}
      >
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Subject Line *</label>
              <Input
                placeholder="e.g. Quick question about your outreach"
                value={form.subject_line}
                onChange={(e) => setForm({ ...form, subject_line: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email Body *</label>
              <Textarea
                placeholder="Paste your full email body here..."
                value={form.email_body}
                onChange={(e) => setForm({ ...form, email_body: e.target.value })}
                rows={6}
                required
              />
            </div>

            {/* Lead Context */}
            <Separator />
            <p className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" /> Lead Context
              <span className="text-muted-foreground font-normal">(optional — unlocks personalized rewrite)</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Lead Name
                </label>
                <Input
                  placeholder="e.g. Sarah Chen"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Lead Company
                </label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={leadCompany}
                  onChange={(e) => setLeadCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> Role / Title
                </label>
                <Input
                  placeholder="e.g. VP of Sales"
                  value={leadRole}
                  onChange={(e) => setLeadRole(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Company Domain
                </label>
                <Input
                  placeholder="e.g. acme.com"
                  value={leadDomain}
                  onChange={(e) => setLeadDomain(e.target.value)}
                />
              </div>
            </div>

            {/* Metrics */}
            <Separator />
            <p className="text-sm font-medium">Metrics <span className="text-muted-foreground font-normal">(optional)</span></p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Open Rate %</label>
                <Input
                  type="number"
                  placeholder="e.g. 18"
                  value={openRate}
                  onChange={(e) => setOpenRate(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Reply Rate %</label>
                <Input
                  type="number"
                  placeholder="e.g. 2"
                  value={replyRate}
                  onChange={(e) => setReplyRate(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading || !form.subject_line || !form.email_body}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : hasLeadContext ? (
                <Mail className="h-4 w-4 mr-2" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              {hasLeadContext ? "Optimize Email" : "Analyze Campaign"}
            </Button>
            {hasLeadContext && (
              <p className="text-xs text-muted-foreground">
                Lead context detected — this will use 2 credits and return a personalized rewrite + follow-up sequence.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Loading ─────────────────────────────────────────── */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">
              {hasLeadContext ? "Enriching lead data & optimizing..." : "Analyzing your campaign..."}
            </span>
          </CardContent>
        </Card>
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {result && !isLoading && (
        <div className="space-y-4">

          {/* Enrichment Sources */}
          {result.enrichment_sources_used && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Enrichment sources:</span>
              {["google", "youtube", "linkedin", "explorium", "tavily_news"].map((src) => (
                <SourceBadge
                  key={src}
                  name={src === "tavily_news" ? "News" : src.charAt(0).toUpperCase() + src.slice(1)}
                  active={(result.enrichment_sources_used as string[]).includes(src)}
                />
              ))}
            </div>
          )}

          {/* Optimized Email */}
          {hasOptimizerResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Optimized Email
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Subject: <span className="font-normal">{result.optimized_email.subject_line}</span>
                  </p>
                  <CopyButton text={result.optimized_email.subject_line} />
                </div>
                <div className="relative p-4 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                  {result.optimized_email.body}
                  <div className="absolute top-2 right-2">
                    <CopyButton text={result.optimized_email.body} />
                  </div>
                </div>
                {/* Personalization hooks */}
                {(result.optimized_email.personalization_hooks_used ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {result.optimized_email.personalization_hooks_used.map((hook: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs font-normal">
                        {hook}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reply Probability */}
          {result.reply_probability && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Reply Probability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <ScoreCircle score={result.reply_probability.score} size="sm" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">{result.reply_probability.reasoning}</p>
                    {(result.reply_probability.boost_suggestions ?? []).length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium">Boost suggestions:</p>
                        {result.reply_probability.boost_suggestions.map((s: string, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                            <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />{s}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Follow-Up Sequence */}
          {(result.follow_up_sequence ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4" /> Follow-Up Sequence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {result.follow_up_sequence.map((fu: any, i: number) => (
                    <AccordionItem key={i} value={`fu-${i}`}>
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Day {fu.delay_days}</Badge>
                          {fu.subject_line}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        <div className="relative p-3 rounded bg-muted/50 text-sm whitespace-pre-wrap">
                          {fu.body}
                          <div className="absolute top-1 right-1">
                            <CopyButton text={fu.body} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Strategy:</span> {fu.strategy}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Score Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-6">
                <ScoreCircle score={result.overall_score} />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Category Scores</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.category_scores ?? {}).map(([key, val]: [string, any]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                        <span className={val >= 70 ? "text-green-500" : val >= 40 ? "text-yellow-500" : "text-red-500"}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {result.predicted_lift && (
                <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
                  {result.predicted_lift}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Weaknesses */}
          {(result.weaknesses ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Weaknesses</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.weaknesses.map((w: string, i: number) => (
                  <p key={i} className="text-sm flex gap-2"><span className="text-red-500">&#10007;</span>{w}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Improvements */}
          {(result.improvements ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Improvements</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.improvements.map((imp: string, i: number) => (
                  <p key={i} className="text-sm flex gap-2"><span className="text-green-500">&#10003;</span>{imp}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Suggested Subjects */}
          {(result.suggested_subjects ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Suggested Subject Lines</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.suggested_subjects.map((s: string, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                    <span className="text-sm">{s}</span>
                    <CopyButton text={s} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Suggested Openers */}
          {(result.suggested_openers ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Suggested Opening Lines</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.suggested_openers.map((s: string, i: number) => (
                  <div key={i} className="flex items-start justify-between p-2 rounded bg-muted/50 gap-2">
                    <span className="text-sm">{s}</span>
                    <CopyButton text={s} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
