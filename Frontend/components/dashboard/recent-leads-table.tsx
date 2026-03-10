import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Users } from "lucide-react"
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
          <CardTitle className="text-base">Recent Leads</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No leads yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Leads</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="divide-y divide-border/50">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between py-2.5 group">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium leading-none truncate">{lead.companyName}</p>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                    {lead.signalsCount} signals
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {lead.contactName} · {lead.title}
                </p>
                <p className="text-[10px] text-muted-foreground/60">{lead.addedAt}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
