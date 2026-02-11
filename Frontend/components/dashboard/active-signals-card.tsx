import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Signal } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface ActiveSignalsCardProps {
  signals: Signal[]
  isLoading?: boolean
}

export function ActiveSignalsCard({ signals, isLoading }: ActiveSignalsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {signals.map((signal) => (
            <div key={signal.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{signal.companyName}</p>
                <Badge variant="outline" className="text-xs">
                  {signal.confidence}% confidence
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {signal.type}
                </Badge>
                <p className="text-sm text-muted-foreground">{signal.description}</p>
              </div>
              <p className="text-xs text-muted-foreground">{signal.timestamp}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
