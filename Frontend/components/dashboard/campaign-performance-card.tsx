import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { CampaignPerformance } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface CampaignPerformanceCardProps {
  campaigns: CampaignPerformance[]
  isLoading?: boolean
}

export function CampaignPerformanceCard({ campaigns, isLoading }: CampaignPerformanceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
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
        <CardTitle>Campaign Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{campaign.name}</p>
                <Badge variant={campaign.status === "running" ? "default" : "secondary"} className="text-xs capitalize">
                  {campaign.status}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                <div>
                  <p>Sent</p>
                  <p className="font-medium text-foreground">{campaign.sent}</p>
                </div>
                <div>
                  <p>Open Rate</p>
                  <p className="font-medium text-foreground">{campaign.openRate}%</p>
                </div>
                <div>
                  <p>Reply Rate</p>
                  <p className="font-medium text-foreground">{campaign.replyRate}%</p>
                </div>
              </div>
              <Progress value={campaign.openRate} className="h-1" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
