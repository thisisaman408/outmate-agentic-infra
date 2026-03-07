"use client"

import { useState } from "react"
import { Sparkles, Loader2, RefreshCw, ArrowRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useDailyBrief } from "@/hooks/use-copilot"

const priorityVariant = (priority: number): "destructive" | "default" | "secondary" => {
  if (priority === 1) return "destructive"
  if (priority === 2) return "default"
  return "secondary"
}

const urgencyVariant = (urgency: string): "destructive" | "default" | "secondary" => {
  if (urgency === "high") return "destructive"
  if (urgency === "medium") return "default"
  return "secondary"
}

export function CopilotSidebar() {
  const [open, setOpen] = useState(false)
  const { brief, isLoading, fetch } = useDailyBrief()

  const handleOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && !brief) {
      fetch(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
          title="Co-Pilot"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Co-Pilot Daily Brief
            </SheetTitle>
            {brief && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => fetch(true)}
                disabled={isLoading}
                title="Regenerate"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {brief && (
            <p className="text-xs text-muted-foreground mt-1">{brief.brief_date}</p>
          )}
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-5 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Generating brief…</span>
            </div>
          )}

          {!brief && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No brief yet for today.</p>
              <Button size="sm" onClick={() => fetch(false)}>
                Generate Brief
              </Button>
            </div>
          )}

          {brief && !isLoading && (
            <div className="space-y-5">
              {/* Summary */}
              <p className="text-sm font-medium leading-relaxed">{brief.summary}</p>

              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>📡 {brief.key_metrics?.signals_detected ?? 0} signals</span>
                <span>👥 {brief.key_metrics?.new_leads_today ?? 0} new leads</span>
                <span>📧 {brief.key_metrics?.active_campaigns ?? 0} campaigns</span>
              </div>

              <Separator />

              {/* Priority Actions */}
              {(brief.priority_actions ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Priority Actions
                  </p>
                  {brief.priority_actions.map((action: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                      <Badge variant={priorityVariant(action.priority)} className="shrink-0 text-[10px] px-1.5">
                        #{action.priority}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug">{action.action}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{action.reason}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}

              {/* New Signals */}
              {(brief.new_signals ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    New Signals
                  </p>
                  {brief.new_signals.map((signal: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                      <Badge variant={urgencyVariant(signal.urgency)} className="shrink-0 text-[10px] px-1.5">
                        {signal.urgency}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{signal.entity}</p>
                        <p className="text-[11px] text-muted-foreground">{signal.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Follow-ups */}
              {(brief.follow_ups ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Follow-ups
                  </p>
                  {brief.follow_ups.map((fu: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium">{fu.prospect} — {fu.company}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Last contact: {fu.last_contact}
                      </p>
                      <p className="text-[11px] text-primary mt-1">{fu.suggested_action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
