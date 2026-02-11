import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import type { RecentLead } from "@/lib/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

interface RecentLeadsTableProps {
  leads: RecentLead[]
  isLoading?: boolean
}

export function RecentLeadsTable({ leads, isLoading }: RecentLeadsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-9 w-20" />
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
        <CardTitle>Recent Leads</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-none">{lead.companyName}</p>
                  <Badge variant="secondary" className="text-xs">
                    {lead.signalsCount} signals
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {lead.contactName} · {lead.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{lead.addedAt}</p>
              </div>
              <Button variant="ghost" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
