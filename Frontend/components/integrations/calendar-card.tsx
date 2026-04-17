"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { calendarApi, type CalendarStatus, type CalendarEvent } from "@/lib/api/calendar"
import { useToast } from "@/hooks/use-toast"
import {
  Calendar,
  RefreshCw,
  Power,
  PowerOff,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"

interface CalendarCardProps {
  status: CalendarStatus
  onStatusChange: () => void
}

export function CalendarCard({ status, onStatusChange }: CalendarCardProps) {
  const { toast } = useToast()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [disabling, setDisabling] = useState(false)

  const isActive = status.push_notifications?.active ?? false

  useEffect(() => {
    if (isActive) {
      loadEvents()
    }
  }, [isActive])

  const loadEvents = async () => {
    setEventsLoading(true)
    try {
      const data = await calendarApi.getEvents(7)
      setEvents(data.events)
    } catch {
      // silently fail — events are supplementary
    } finally {
      setEventsLoading(false)
    }
  }

  const handleEnable = async () => {
    setEnabling(true)
    try {
      await calendarApi.enable()
      toast({ title: "Calendar sync enabled", description: "Push notifications are now active" })
      onStatusChange()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enable sync",
        variant: "destructive",
      })
    } finally {
      setEnabling(false)
    }
  }

  const handleDisable = async () => {
    setDisabling(true)
    try {
      await calendarApi.disable()
      toast({ title: "Calendar sync disabled" })
      setEvents([])
      onStatusChange()
    } catch {
      toast({ title: "Error", description: "Failed to disable sync", variant: "destructive" })
    } finally {
      setDisabling(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await calendarApi.sync()
      toast({
        title: "Sync complete",
        description: `${result.sync.created} new, ${result.sync.updated} updated, ${result.preps_scheduled} preps scheduled`,
      })
      loadEvents()
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Failed to sync",
        variant: "destructive",
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleTriggerPrep = async (eventId: string) => {
    try {
      await calendarApi.triggerPrep(eventId)
      toast({ title: "Meeting prep triggered" })
      loadEvents()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to trigger prep",
        variant: "destructive",
      })
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Calendar</CardTitle>
              <CardDescription>{status.email}</CardDescription>
            </div>
          </div>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Syncing" : "Paused"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Push notification status */}
        {isActive && status.push_notifications?.expires_at && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Push notifications renew automatically. Expires{" "}
            {formatTime(status.push_notifications.expires_at)}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isActive ? (
            <>
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDisable} disabled={disabling}>
                <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                {disabling ? "Disabling..." : "Disable"}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleEnable} disabled={enabling}>
              <Power className="mr-1.5 h-3.5 w-3.5" />
              {enabling ? "Enabling..." : "Enable Sync"}
            </Button>
          )}
        </div>

        {/* Upcoming events */}
        {isActive && events.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Upcoming meetings ({events.length})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between rounded-md border p-2.5 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.summary || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(event.start_time)}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {event.external_attendee_count} external
                        {event.is_large_meeting && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Large
                          </Badge>
                        )}
                        {event.recurring && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Recurring
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="ml-2 shrink-0">
                      {event.prep_completed ? (
                        <Badge variant="default" className="text-[10px]">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Prepped
                        </Badge>
                      ) : event.prep_scheduled ? (
                        <Badge variant="secondary" className="text-[10px]">
                          <Clock className="mr-1 h-3 w-3" />
                          Scheduled
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => handleTriggerPrep(event.id)}
                        >
                          Prep
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {events.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{events.length - 5} more meetings
                </p>
              )}
            </div>
          </>
        )}

        {isActive && events.length === 0 && !eventsLoading && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No upcoming meetings with external attendees
          </div>
        )}
      </CardContent>
    </Card>
  )
}
