"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Zap,
  User,
  Mail,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface SignalDraft {
  id: string
  signal_id: string
  lead_name: string | null
  lead_email: string | null
  lead_role: string | null
  lead_domain: string | null
  lead_linkedin_url: string | null
  draft_email_subject: string | null
  draft_email_body: string | null
  optimizer_output: Record<string, unknown> | null
  signal_score: number | null
  signal_type: string
  company_name: string | null
  company_domain: string | null
  status: string
  campaign_id: string | null
  created_at: string
}

interface Props {
  draft: SignalDraft
  onActioned: (id: string) => void
}

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  funding: "Funding Round",
  job_change: "Job Change",
  hiring: "Hiring Surge",
  g2_intent: "G2 Intent",
  website_visit: "Website Visit",
  email_open: "Email Open",
  linkedin_activity: "LinkedIn Activity",
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const color =
    score >= 80 ? "bg-emerald-500/15 text-emerald-600 border-emerald-200" :
    score >= 65 ? "bg-amber-500/15 text-amber-600 border-amber-200" :
    "bg-slate-100 text-slate-500 border-slate-200"
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}>
      <Zap className="h-3 w-3" />
      {score}
    </span>
  )
}

export function SignalDraftCard({ draft, onActioned }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState<"use" | "dismiss" | "push_to_campaign" | null>(null)
  const [sequenceOpen, setSequenceOpen] = useState(false)

  const followUps = (draft.optimizer_output?.follow_up_sequence as Array<{
    delay_days: number
    subject_line: string
    body: string
    strategy?: string
  }>) ?? []

  const act = async (action: "use" | "dismiss" | "push_to_campaign") => {
    setLoading(action)
    try {
      const { copilotApi } = await import("@/lib/api/copilot")
      const data = await copilotApi.updateSignalDraft(draft.id, action) as Record<string, unknown>

      if (action === "push_to_campaign" && data.campaign_id) {
        toast({ title: "Campaign created", description: "Opening the campaign editor…" })
        router.push(`/campaigns/${data.campaign_id}/edit`)
      } else if (action === "use") {
        toast({ title: "Draft marked as used" })
      } else {
        toast({ title: "Draft dismissed" })
      }
      onActioned(draft.id)
    } catch (e: unknown) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs font-medium">
                {SIGNAL_TYPE_LABELS[draft.signal_type] ?? draft.signal_type}
              </Badge>
              <ScoreBadge score={draft.signal_score} />
              <span className="text-xs text-muted-foreground">
                {new Date(draft.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1.5 font-semibold text-sm truncate">
              {draft.company_name || draft.company_domain || "Unknown Company"}
            </p>
          </div>
        </div>

        {/* Contact line */}
        {(draft.lead_name || draft.lead_role) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {draft.lead_name}
              {draft.lead_role && ` · ${draft.lead_role}`}
            </span>
            {draft.lead_linkedin_url && (
              <a
                href={draft.lead_linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 hover:text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 pb-4 px-5 space-y-4">
        {/* Email preview */}
        {draft.draft_email_subject && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              Draft Email
            </div>
            <p className="text-sm font-medium leading-snug">{draft.draft_email_subject}</p>
            {draft.draft_email_body && (
              <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-line">
                {draft.draft_email_body}
              </p>
            )}
          </div>
        )}

        {/* Follow-up sequence (collapsible) */}
        {followUps.length > 0 && (
          <Collapsible open={sequenceOpen} onOpenChange={setSequenceOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1.5 w-full justify-between">
                <span>View {followUps.length}-email follow-up sequence</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${sequenceOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {followUps.map((fu, i) => (
                <div key={i} className="rounded-md bg-muted/40 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Day {fu.delay_days}</span>
                    {fu.strategy && (
                      <span className="text-xs text-muted-foreground italic">{fu.strategy}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium">{fu.subject_line}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                    {fu.body}
                  </p>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* CTAs */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1.5"
            onClick={() => act("push_to_campaign")}
            disabled={loading !== null}
          >
            {loading === "push_to_campaign" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlusCircle className="h-3.5 w-3.5" />
            )}
            Add to Campaign
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => act("use")}
            disabled={loading !== null}
          >
            {loading === "use" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Review &amp; Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => act("dismiss")}
            disabled={loading !== null}
          >
            {loading === "dismiss" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
