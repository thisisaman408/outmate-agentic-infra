import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity } from "lucide-react"
import type { Signal } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ActiveSignalsCardProps {
  signals: Signal[]
  isLoading?: boolean
}

export function ActiveSignalsCard({ signals, isLoading }: ActiveSignalsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Signals</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 py-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (signals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No active signals</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Active Signals</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="divide-y divide-border/50">
          {signals.map((signal) => (
            <div key={signal.id} className="py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium leading-none truncate">{signal.companyName}</p>
                <span
                  className={cn(
                    "text-[10px] font-medium tabular-nums shrink-0 rounded-full px-1.5 py-0.5",
                    (signal.confidence ?? 0) >= 80
                      ? "bg-success/10 text-success"
                      : (signal.confidence ?? 0) >= 60
                      ? "bg-warning/10 text-warning"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {signal.confidence}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {signal.type}
                </Badge>
                <p className="text-xs text-muted-foreground truncate">{signal.description}</p>
              </div>
              <p className="text-[10px] text-muted-foreground/60">{signal.timestamp}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
