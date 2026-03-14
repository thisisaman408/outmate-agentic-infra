"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Sparkles, RefreshCw, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi } from "@/lib/api/copilot"

const priorityVariant = (priority: number) => {
  if (priority === 1) return "destructive"
  if (priority === 2) return "default"
  return "secondary"
}

const priorityLabel = (priority: number) => {
  if (priority === 1) return "High"
  if (priority === 2) return "Medium"
  return "Low"
}

const urgencyVariant = (urgency: string) => {
  if (urgency === "high") return "destructive"
  if (urgency === "medium") return "default"
  return "secondary"
}

export default function DailyBriefPage() {
  const [brief, setBrief] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Daily Brief</h2>
          <p className="text-sm text-muted-foreground">Here's what to act on today</p>
        </div>
        <div className="flex gap-2">
          {brief && (
            <Button variant="outline" size="sm" onClick={() => fetchBrief(true)} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          )}
          {!brief && (
            <Button onClick={() => fetchBrief(false)} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate Today's Brief
            </Button>
          )}
        </div>
      </div>

      {!brief && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Click "Generate Today's Brief" to get your personalized action list</p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Generating your brief...</span>
          </CardContent>
        </Card>
      )}

      {brief && !isLoading && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium">{brief.summary}</p>
              <div className="flex gap-4 mt-3">
                <span className="text-xs text-muted-foreground">
                  📡 {brief.key_metrics?.signals_detected ?? 0} signals detected
                </span>
                <span className="text-xs text-muted-foreground">
                  👥 {brief.key_metrics?.new_leads_today ?? 0} new leads
                </span>
                <span className="text-xs text-muted-foreground">
                  📧 {brief.key_metrics?.active_campaigns ?? 0} active campaigns
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Priority Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Priority Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(brief.priority_actions ?? []).map((action: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant={priorityVariant(action.priority)} className="mt-0.5 shrink-0">
                    {priorityLabel(action.priority)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.reason}</p>
                    {action.entity && (
                      <p className="text-xs text-primary mt-1">{action.entity}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* New Signals */}
          {(brief.new_signals ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brief.new_signals.map((signal: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Badge variant={urgencyVariant(signal.urgency)} className="mt-0.5 shrink-0">
                      {signal.urgency}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{signal.entity}</p>
                      <p className="text-xs text-muted-foreground">{signal.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Follow-ups */}
          {(brief.follow_ups ?? []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Follow-ups Needed</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {brief.follow_ups.map((fu: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">{fu.prospect} — {fu.company}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Last contact: {fu.last_contact}</p>
                    <p className="text-xs text-primary mt-1">{fu.suggested_action}</p>
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
