"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Play, Pause, Copy, MoreVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import type { Campaign } from "@/lib/api/campaigns"
import { Skeleton } from "@/components/ui/skeleton"
import { campaignsApi } from "@/lib/api/campaigns"
import { useToast } from "@/hooks/use-toast"

interface CampaignsListProps {
  campaigns: Campaign[]
  isLoading?: boolean
  onCampaignsChange?: () => void
}

export function CampaignsList({ campaigns, isLoading, onCampaignsChange }: CampaignsListProps) {
  const { toast } = useToast()

  const handleStatusChange = async (campaignId: string, newStatus: Campaign["status"]) => {
    try {
      await campaignsApi.updateCampaignStatus(campaignId, newStatus)
      toast({
        title: "Success",
        description: `Campaign ${newStatus === "running" ? "started" : "paused"} successfully`,
      })
      onCampaignsChange?.()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: Campaign["status"]) => {
    switch (status) {
      case "running":
        return "default"
      case "paused":
        return "secondary"
      case "completed":
        return "outline"
      case "draft":
        return "destructive"
      default:
        return "default"
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaigns ({campaigns.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">No campaigns yet</p>
            <p className="text-sm text-muted-foreground">Create your first campaign to get started</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Open Rate</TableHead>
                  <TableHead className="text-right">Reply Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{campaign.name}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">{campaign.objective}</span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{campaign.type}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(campaign.status)} className="capitalize">
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{campaign.leadsCount}</TableCell>
                    <TableCell className="text-right">{campaign.stats.sent}</TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{campaign.stats.openRate}%</span>
                        <Progress value={campaign.stats.openRate} className="h-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{campaign.stats.replyRate}%</span>
                        <Progress value={campaign.stats.replyRate} className="h-1" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {campaign.status === "running" ? (
                          <Button variant="ghost" size="icon" onClick={() => handleStatusChange(campaign.id, "paused")}>
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : campaign.status === "paused" || campaign.status === "draft" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(campaign.id, "running")}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
