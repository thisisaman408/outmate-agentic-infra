import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { AgentEffectiveness } from "@/lib/api/analytics"
import { Skeleton } from "@/components/ui/skeleton"

interface AgentEffectivenessCardProps {
  data: AgentEffectiveness[]
  isLoading?: boolean
}

export function AgentEffectivenessCard({ data, isLoading }: AgentEffectivenessCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Effectiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
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
        <CardTitle>Agent Effectiveness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((agent) => (
            <div key={agent.agentType} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{agent.agentType}</p>
                <p className="text-sm text-muted-foreground">{agent.successRate}%</p>
              </div>
              <Progress value={agent.successRate} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{agent.tasksCompleted} tasks completed</span>
                <span>Avg: {agent.avgTime}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
