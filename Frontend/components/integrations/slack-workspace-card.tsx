"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Hash, Unlink, Send, Settings } from "lucide-react"
import {
  slackApi,
  type SlackStatus,
  type SlackChannel,
  type ChannelConfig,
  ALERT_TYPE_LABELS,
} from "@/lib/api/slack"
import { useToast } from "@/hooks/use-toast"

interface SlackWorkspaceCardProps {
  status: SlackStatus
  onDisconnect: () => void
}

export function SlackWorkspaceCard({ status, onDisconnect }: SlackWorkspaceCardProps) {
  const { toast } = useToast()
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [configs, setConfigs] = useState<ChannelConfig[]>([])
  const [alertTypes, setAlertTypes] = useState<string[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [testChannelId, setTestChannelId] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [channelList, configData] = await Promise.all([
        slackApi.getChannels(),
        slackApi.getChannelConfig(),
      ])
      setChannels(channelList)
      setConfigs(configData.configs)
      setAlertTypes(configData.alert_types)
      if (channelList.length > 0 && !testChannelId) {
        setTestChannelId(channelList[0].id)
      }
    } catch {
      // Non-critical
    }
  }

  const handleConfigChange = async (alertType: string, channelId: string) => {
    const channel = channels.find((c) => c.id === channelId)
    try {
      await slackApi.setChannelConfig([
        {
          alert_type: alertType,
          channel_id: channelId,
          channel_name: channel?.name,
          is_enabled: true,
        },
      ])
      setConfigs((prev) => {
        const filtered = prev.filter((c) => c.alert_type !== alertType)
        return [
          ...filtered,
          {
            alert_type: alertType,
            channel_id: channelId,
            channel_name: channel?.name ?? null,
            is_enabled: true,
          },
        ]
      })
      toast({ title: "Saved", description: `${ALERT_TYPE_LABELS[alertType]} routed to #${channel?.name}` })
    } catch {
      toast({ title: "Error", description: "Failed to save config", variant: "destructive" })
    }
  }

  const handleTestMessage = async () => {
    if (!testChannelId) return
    setIsSending(true)
    try {
      await slackApi.sendTestMessage(testChannelId)
      const ch = channels.find((c) => c.id === testChannelId)
      toast({ title: "Test Sent", description: `Check #${ch?.name || "channel"} in Slack` })
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Test message failed",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const getConfigForType = (alertType: string) =>
    configs.find((c) => c.alert_type === alertType)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{status.team_name || "Slack"}</CardTitle>
              <CardDescription className="text-sm">
                {status.team_domain ? `${status.team_domain}.slack.com` : "Connected workspace"}
              </CardDescription>
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
          {status.installed_at && (
            <span className="text-xs text-muted-foreground">
              Installed {new Date(status.installed_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Channel routing config */}
        {showConfig && channels.length > 0 && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Channel Routing</p>
            {alertTypes.map((alertType) => {
              const current = getConfigForType(alertType)
              return (
                <div key={alertType} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground min-w-[140px]">
                    {ALERT_TYPE_LABELS[alertType] || alertType}
                  </span>
                  <Select
                    value={current?.channel_id || ""}
                    onValueChange={(val) => handleConfigChange(alertType, val)}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((ch) => (
                        <SelectItem key={ch.id} value={ch.id}>
                          #{ch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        )}

        {/* Test message */}
        {showConfig && channels.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={testChannelId} onValueChange={setTestChannelId}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    #{ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestMessage}
              disabled={isSending || !testChannelId}
            >
              <Send className={`mr-2 h-3 w-3 ${isSending ? "animate-pulse" : ""}`} />
              {isSending ? "Sending..." : "Test"}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings className="mr-2 h-4 w-4" />
            {showConfig ? "Hide Config" : "Configure Channels"}
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
