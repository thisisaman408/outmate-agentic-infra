"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, RefreshCw, ArrowRight, Radio, Users, Mail, TrendingUp, Clock, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi, DailyBriefResponse, DailyBriefPriorityAction } from "@/lib/api/copilot"

const tierConfig: Record<string, { label: string; border: string; bg: string; text: string }> = {
  HOT_SIGNAL:       { label: "🔥 Hot Signal",    border: "border-l-red-500",    bg: "bg-red-50 dark:bg-red-950/20",    text: "text-red-600 dark:text-red-400" },
  INTERESTED_REPLY: { label: "💬 Reply",          border: "border-l-red-400",    bg: "bg-red-50 dark:bg-red-950/20",    text: "text-red-500 dark:text-red-400" },
  CHAMPION_MOVE:    { label: "♟ Champion Move",  border: "border-l-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-400" },
  FUNDING:          { label: "💰 Funding",        border: "border-l-amber-400",  bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-600 dark:text-amber-400" },
  JOB_CHANGE:       { label: "🔄 Job Change",     border: "border-l-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/20",  text: "text-blue-600 dark:text-blue-400" },
  INTENT_SPIKE:     { label: "📈 Intent Spike",   border: "border-l-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/20",  text: "text-blue-600 dark:text-blue-400" },
  OTHER:            { label: "📌 Action",         border: "border-l-slate-300",  bg: "bg-slate-50 dark:bg-slate-800/40", text: "text-slate-500 dark:text-slate-400" },
}

const urgencyConfig: Record<string, { dot: string; label: string }> = {
  high:   { dot: "bg-red-500",    label: "High" },
  medium: { dot: "bg-amber-400",  label: "Medium" },
  low:    { dot: "bg-slate-300",  label: "Low" },
}

export default function DailyBriefPage() {
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const navigateToEntity = (entity_type: string) => {
    if (entity_type === "prospect") router.push("/leads/prospects")
    else router.push("/leads/companies")
  }

  const copyAction = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      toast({ description: "Action copied to clipboard" })
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      toast({ description: "Could not copy", variant: "destructive" })
    }
  }

  const fetchBrief = async (forceRegenerate = false) => {
    setIsLoading(true)
    try {
      const data = forceRegenerate
        ? await copilotApi.regenerateDailyBrief()
        : await copilotApi.getDailyBrief()
      setBrief(data)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to load daily brief",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBrief(false)
  }, [])

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Daily Brief</h2>
          <p className="text-sm text-muted-foreground">Here's what to act on today</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchBrief(true)}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Analysing your pipeline...</p>
        </div>
      )}

      {brief && !isLoading && (
        <div className="space-y-4">

          {/* Greeting card */}
          <div className="rounded-2xl border bg-card shadow-sm px-6 py-5">
            {brief.greeting && (
              <p className="text-xl font-semibold tracking-tight mb-1">{brief.greeting}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">{brief.summary}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1 text-muted-foreground">
                <Radio className="h-3 w-3" />
                {brief.key_metrics?.signals_detected ?? 0} signals
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                {brief.key_metrics?.new_leads_today ?? 0} new leads
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1 text-muted-foreground">
                <Mail className="h-3 w-3" />
                {brief.key_metrics?.active_campaigns ?? 0} campaigns
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-full px-3 py-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Opens {brief.key_metrics?.open_rate_trend ?? "stable"}
              </span>
            </div>
          </div>

          {/* Priority Actions */}
          {(brief.priority_actions ?? []).length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-sm font-semibold">Priority Actions</h3>
              </div>
              <div className="divide-y">
                {brief.priority_actions.map((action: DailyBriefPriorityAction, i: number) => {
                  const cfg = tierConfig[action.tier] ?? tierConfig.OTHER
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-4 px-6 py-4 border-l-4 ${cfg.border} hover:bg-muted/30 transition-colors group cursor-pointer`}
                      onClick={() => navigateToEntity(action.entity_type)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-medium ${cfg.text}`}>{cfg.label}</span>
                          {action.icp_score > 0 && (
                            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                              ICP {action.icp_score}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug">{action.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{action.reason}</p>
                        {action.entity && (
                          <span className={`inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>
                            {action.entity}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* New Signals */}
          {(brief.new_signals ?? []).length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-sm font-semibold">New Signals</h3>
              </div>
              <div className="divide-y">
                {brief.new_signals.map((signal, i) => {
                  const urg = urgencyConfig[signal.urgency] ?? urgencyConfig.low
                  return (
                    <div key={i} className="flex items-start gap-4 px-6 py-4">
                      <div className="flex items-center gap-1.5 shrink-0 mt-1">
                        <span className={`h-2 w-2 rounded-full ${urg.dot}`} />
                        <span className="text-[11px] text-muted-foreground">{urg.label}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{signal.entity}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{signal.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Follow-ups */}
          {(brief.follow_ups ?? []).length > 0 && (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-sm font-semibold">Follow-ups Needed</h3>
              </div>
              <div className="divide-y">
                {brief.follow_ups.map((fu, i) => (
                  <div key={i} className="flex items-start gap-4 px-6 py-4 group">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{fu.prospect}
                        <span className="text-muted-foreground font-normal"> · {fu.company}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Last contact: {fu.last_contact}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-primary flex-1">{fu.suggested_action}</p>
                        <button
                          onClick={() => copyAction(fu.suggested_action, i)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          title="Copy action"
                        >
                          {copiedIndex === i
                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                            : <Copy className="h-3.5 w-3.5" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
