"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, AlertCircle, Linkedin, Unlink, RefreshCw } from "lucide-react"
import { linkedinApi, type LinkedInAccount, type RateLimitStatus } from "@/lib/api/linkedin"
import { useToast } from "@/hooks/use-toast"

interface LinkedInAccountCardProps {
  account: LinkedInAccount
  onDisconnect: () => void
  onRefresh: () => void
}

export function LinkedInAccountCard({ account, onDisconnect, onRefresh }: LinkedInAccountCardProps) {
  const { toast } = useToast()
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(false)

  useEffect(() => {
    loadRateLimit()
  }, [])

  const loadRateLimit = async () => {
    try {
      const data = await linkedinApi.getRateLimitStatus()
      setRateLimit(data)
    } catch {
      // Rate limit info is non-critical
    }
  }

  const handleCheckSession = async () => {
    setIsCheckingSession(true)
    try {
      const result = await linkedinApi.checkSessionStatus()
      toast({
        title: "Session Status",
        description: `Status: ${result.session_status}`,
      })
      onRefresh()
    } catch {
      toast({
        title: "Error",
        description: "Failed to check session status",
        variant: "destructive",
      })
    } finally {
      setIsCheckingSession(false)
    }
  }

  const getStatusIcon = () => {
    switch (account.session_status) {
      case "active":
        return <CheckCircle2 className="h-5 w-5 text-success" />
      case "expired":
        return <AlertCircle className="h-5 w-5 text-warning" />
      default:
        return <XCircle className="h-5 w-5 text-destructive" />
    }
  }

  const getStatusBadge = () => {
    switch (account.session_status) {
      case "active":
        return (
          <Badge variant="outline" className="text-success border-success">
            Active
          </Badge>
        )
      case "expired":
        return (
          <Badge variant="outline" className="text-warning border-warning">
            Session Expired
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-destructive border-destructive">
            Error
          </Badge>
        )
    }
  }

  const rateLimitPercent = rateLimit ? (rateLimit.used / rateLimit.limit) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Linkedin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {account.display_name || "LinkedIn Account"}
              </CardTitle>
              <CardDescription className="text-sm">
                {account.linkedin_profile_url || account.unipile_account_id}
              </CardDescription>
            </div>
          </div>
          {getStatusIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {account.session_checked_at && (
            <span className="text-xs text-muted-foreground">
              Checked {new Date(account.session_checked_at).toLocaleString()}
            </span>
          )}
        </div>

        {account.session_status === "expired" && (
          <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
            Your LinkedIn session has expired. Please re-authenticate through Unipile to continue
            sending connection requests and messages.
          </div>
        )}

        {rateLimit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Connection requests today</span>
              <span className="font-medium">
                {rateLimit.used}/{rateLimit.limit}
              </span>
            </div>
            <Progress value={rateLimitPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {rateLimit.remaining} remaining &middot; Resets{" "}
              {new Date(rateLimit.resets_at).toLocaleTimeString()}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckSession}
            disabled={isCheckingSession}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isCheckingSession ? "animate-spin" : ""}`} />
            {isCheckingSession ? "Checking..." : "Check Session"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDisconnect}>
            <Unlink className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
