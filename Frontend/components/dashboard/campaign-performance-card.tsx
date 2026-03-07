import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Send } from "lucide-react"
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
          <CardTitle className="text-base">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 py-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Send className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No campaigns running</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Campaign Performance</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="divide-y divide-border/50">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{campaign.name}</p>
                <Badge
                  variant={campaign.status === "running" ? "default" : "secondary"}
                  className="text-[10px] h-4 px-1.5 capitalize shrink-0"
                >
                  {campaign.status}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Sent</p>
                  <p className="font-semibold text-foreground">{campaign.sent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Open</p>
                  <p className="font-semibold text-foreground">{campaign.openRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reply</p>
                  <p className="font-semibold text-foreground">{campaign.replyRate}%</p>
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
