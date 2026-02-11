import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot } from "lucide-react"
import type { AIAgentActivity } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface AIAgentActivityCardProps {
  activities: AIAgentActivity[]
  isLoading?: boolean
}

export function AIAgentActivityCard({ activities, isLoading }: AIAgentActivityCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Agent Activity
          </CardTitle>
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
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Agent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {activity.agentType}
                </Badge>
                <p className="text-sm text-muted-foreground">{activity.timestamp}</p>
              </div>
              <p className="text-sm font-medium">{activity.action}</p>
              <p className="text-sm text-muted-foreground">{activity.result}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
