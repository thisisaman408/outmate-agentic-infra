import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: LucideIcon
  isLoading?: boolean
}

export function KPICard({ title, value, change, icon: Icon, isLoading }: KPICardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-24" />
          </CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    )
  }

  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            {isPositive && <ArrowUp className="h-3 w-3 text-success" />}
            {isNegative && <ArrowDown className="h-3 w-3 text-destructive" />}
            <span className={cn(isPositive && "text-success", isNegative && "text-destructive")}>
              {Math.abs(change)}%
            </span>
            <span>vs last month</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
