"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Loader2, Settings, Calendar, CheckCircle2, Zap } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { useCopilotPreferences } from "@/hooks/use-copilot"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

export default function CopilotSettingsPage() {
  const { preferences, isLoading, isSaving, fetchPreferences, savePreferences } = useCopilotPreferences()
  const { toast } = useToast()
  const [calendarConnecting, setCalendarConnecting] = useState(false)
  const [calendarConnected, setCalendarConnected] = useState(false)

  useEffect(() => {
    fetchPreferences()
  }, [fetchPreferences])

  const handleConnectCalendar = async () => {
    setCalendarConnecting(true)
    try {
      const res = await fetch("/api/calendar/register", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setCalendarConnected(true)
        toast({
          title: "Google Calendar connected",
          description: `Auto-briefs active. Webhook renews on ${new Date(data.expires_at).toLocaleDateString()}.`,
        })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({
          title: "Connection failed",
          description: err?.detail || "Could not register calendar webhook",
          variant: "destructive",
        })
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Network error", variant: "destructive" })
    } finally {
      setCalendarConnecting(false)
    }
  }

  const handleToggle = (key: string, value: boolean) => {
    if (!preferences) return
    savePreferences({ ...preferences, [key]: value })
  }

  const handleFieldChange = (key: string, value: string | number) => {
    if (!preferences) return
    savePreferences({ ...preferences, [key]: value })
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading preferences…</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Co-Pilot Settings</h2>
          <p className="text-sm text-muted-foreground">Configure your AI assistant preferences</p>
        </div>
      </div>

      {/* Daily Brief */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Brief</CardTitle>
          <CardDescription>Automated morning briefing with priority actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Daily Brief</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Generate a brief each morning automatically</p>
            </div>
            <Switch
              checked={preferences?.daily_brief_enabled ?? true}
              onCheckedChange={(v) => handleToggle("daily_brief_enabled", v)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="brief-time">Delivery Time</Label>
              <Input
                id="brief-time"
                type="time"
                value={preferences?.daily_brief_time ?? "08:00"}
                onChange={(e) => handleFieldChange("daily_brief_time", e.target.value)}
                disabled={isSaving || !preferences?.daily_brief_enabled}
              />
              <p className="text-xs text-muted-foreground">24-hour format, UTC</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brief-tz">Timezone</Label>
              <Input
                id="brief-tz"
                placeholder="UTC"
                value={preferences?.daily_brief_timezone ?? "UTC"}
                onChange={(e) => handleFieldChange("daily_brief_timezone", e.target.value)}
                disabled={isSaving || !preferences?.daily_brief_enabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Where to deliver your daily brief and pipeline alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Email Notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Send brief to your account email</p>
            </div>
            <Switch
              checked={preferences?.notify_email ?? true}
              onCheckedChange={(v) => handleToggle("notify_email", v)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Messaging Notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Send brief to a messaging channel via webhook</p>
            </div>
            <Switch
              checked={preferences?.notify_slack ?? false}
              onCheckedChange={(v) => handleToggle("notify_slack", v)}
              disabled={isSaving}
            />
          </div>

          {preferences?.notify_slack && (
            <div className="space-y-1.5">
              <Label htmlFor="slack-url">Webhook URL</Label>
              <Input
                id="slack-url"
                placeholder="https://hooks.slack.com/services/..."
                value={preferences?.slack_webhook_url ?? ""}
                onChange={(e) => handleFieldChange("slack_webhook_url", e.target.value)}
                disabled={isSaving}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Alerts</CardTitle>
          <CardDescription>Automated risk detection for stuck deals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Pipeline Alerts</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Get notified when deals go stale</p>
            </div>
            <Switch
              checked={preferences?.pipeline_alerts_enabled ?? true}
              onCheckedChange={(v) => handleToggle("pipeline_alerts_enabled", v)}
              disabled={isSaving}
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Alert Severity Threshold</Label>
            <p className="text-xs text-muted-foreground">
              Only alert when risk is at or above this level
            </p>
            <div className="flex gap-2 mt-1">
              {(["low", "medium", "high"] as const).map((level) => (
                <Button
                  key={level}
                  size="sm"
                  variant={preferences?.alert_severity_threshold === level ? "default" : "outline"}
                  className="capitalize"
                  onClick={() => handleFieldChange("alert_severity_threshold", level)}
                  disabled={isSaving}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signal-to-Sequence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Signal-to-Sequence
          </CardTitle>
          <CardDescription>
            Auto-generate personalised outreach when a watched account's ICP score crosses this threshold
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>ICP Score Threshold</Label>
              <span className="text-sm font-semibold tabular-nums">
                {preferences?.signal_score_threshold ?? 70}
              </span>
            </div>
            <Slider
              min={50}
              max={95}
              step={5}
              value={[preferences?.signal_score_threshold ?? 70]}
              onValueChange={([v]) => handleFieldChange("signal_score_threshold", v)}
              disabled={isSaving}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50 — more drafts</span>
              <span>95 — fewer, higher quality</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Signals below this score are ignored. Default is 70. Max 3 drafts per day.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Auto-generate meeting briefs 30 minutes before external calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar and Co-Pilot will prepare a brief for every external
            meeting — enriched with company research, talking points, objections, and a specific
            ask — delivered via Slack and visible here, with no action required from you.
          </p>
          {calendarConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Calendar connected</span>
              <Badge variant="outline" className="text-xs border-green-500/40 text-green-600">
                Active
              </Badge>
            </div>
          ) : (
            <Button
              onClick={handleConnectCalendar}
              disabled={calendarConnecting}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {calendarConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Connect Google Calendar
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Requires Google account connected via Settings → Account. Only reads calendar
            metadata — no email content is accessed.
          </p>
        </CardContent>
      </Card>

      {isSaving && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}
    </div>
  )
}
