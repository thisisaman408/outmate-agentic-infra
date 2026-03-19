"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Sparkles, Loader2, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useDailyBrief } from "@/hooks/use-copilot"

const priorityVariant = (priority: number): "destructive" | "default" | "secondary" => {
  if (priority === 1) return "destructive"
  if (priority === 2) return "default"
  return "secondary"
}

export function DailyBriefWidget() {
  const { brief, isLoading, fetch } = useDailyBrief()

  useEffect(() => {
    fetch(false)
  }, [fetch])

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Co-Pilot Daily Brief
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Generating brief...</span>
          </div>
        )}

        {!brief && !isLoading && (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <p className="text-xs text-muted-foreground">No brief generated yet today.</p>
            <Button size="sm" variant="outline" onClick={() => fetch(false)}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </Button>
          </div>
        )}

        {brief && !isLoading && (
          <>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {brief.summary}
            </p>

            <div className="space-y-1.5">
              {(brief.priority_actions ?? []).slice(0, 3).map((action: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge variant={priorityVariant(action.priority)} className="text-[10px] px-1.5 shrink-0">
                    #{action.priority}
                  </Badge>
                  <p className="text-xs leading-snug line-clamp-1">{action.action}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 text-[11px] text-muted-foreground pt-1">
              <span>Signals: {brief.key_metrics?.signals_detected ?? 0}</span>
              <span>Leads: {brief.key_metrics?.new_leads_today ?? 0}</span>
            </div>

            <Button asChild variant="ghost" size="sm" className="w-full mt-1 text-xs">
              <Link href="/copilot">
                View Full Brief <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
