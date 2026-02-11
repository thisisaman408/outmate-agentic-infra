import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CampaignMetrics } from "@/lib/api/analytics"
import { Skeleton } from "@/components/ui/skeleton"

interface CampaignMetricsTableProps {
  data: CampaignMetrics[]
  isLoading?: boolean
}

export function CampaignMetricsTable({ data, isLoading }: CampaignMetricsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Conv. Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((campaign) => {
              const conversionRate = ((campaign.conversions / campaign.leads) * 100).toFixed(1)
              return (
                <TableRow key={campaign.campaignName}>
                  <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                  <TableCell className="text-right">{campaign.leads}</TableCell>
                  <TableCell className="text-right">{campaign.conversions}</TableCell>
                  <TableCell className="text-right">${campaign.revenue.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{conversionRate}%</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
