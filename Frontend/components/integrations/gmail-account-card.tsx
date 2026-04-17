"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Mail, Unlink, BarChart3, Shield } from "lucide-react"
import { gmailApi, type GmailQuota, type OutreachStats } from "@/lib/api/gmail"
import { useToast } from "@/hooks/use-toast"

interface GmailAccountCardProps {
  email: string
  onDisconnect: () => void
}

export function GmailAccountCard({ email, onDisconnect }: GmailAccountCardProps) {
  const { toast } = useToast()
  const [quota, setQuota] = useState<GmailQuota | null>(null)
  const [stats, setStats] = useState<OutreachStats | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [q, s] = await Promise.all([
        gmailApi.getQuota(),
        gmailApi.getOutreachStats(),
      ])
      setQuota(q)
      setStats(s)
    } catch {
      // Non-critical — card still shows connection info
    }
  }

  const quotaPercent = quota ? (quota.used / quota.safe_limit) * 100 : 0
  const quotaWarning = quotaPercent > 80

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Gmail</CardTitle>
              <CardDescription className="text-sm">{email}</CardDescription>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-success border-success">
            Connected
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Send + Read-only
          </div>
        </div>

        {/* Quota bar */}
        {quota && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Emails sent today</span>
              <span className={`font-medium ${quotaWarning ? "text-warning" : ""}`}>
                {quota.used}/{quota.safe_limit}
              </span>
            </div>
            <Progress
              value={Math.min(quotaPercent, 100)}
              className={`h-2 ${quotaWarning ? "[&>div]:bg-warning" : ""}`}
            />
            <p className="text-xs text-muted-foreground">
              {quota.remaining} remaining &middot;{" "}
              {quota.is_workspace ? "Workspace" : "Standard"} account &middot; Resets{" "}
              {new Date(quota.resets_at).toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Reply stats */}
        {stats && stats.total_sent > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Reply Tracking
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted p-2">
                <p className="text-lg font-semibold">{stats.total_sent}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-lg font-semibold text-success">
                  {stats.interested + stats.replied}
                </p>
                <p className="text-xs text-muted-foreground">Replied</p>
              </div>
              <div className="rounded-md bg-muted p-2">
                <p className="text-lg font-semibold">
                  {stats.total_sent > 0
                    ? Math.round(
                        ((stats.interested + stats.replied) / stats.total_sent) * 100,
                      )
                    : 0}
                  %
                </p>
                <p className="text-xs text-muted-foreground">Reply Rate</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onDisconnect}>
            <Unlink className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
