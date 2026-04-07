"use client"

import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Bell, CheckCheck, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useNotifications } from "@/hooks/use-notifications"
import type { Notification } from "@/lib/api/notifications"

const PRIORITY_DOT: Record<string, string> = {
  red: "bg-red-500",
  indigo: "bg-indigo-500",
  green: "bg-green-500",
}

function NotificationRow({
  notif,
  onRead,
}: {
  notif: Notification
  onRead: (id: string, url: string) => void
}) {
  const ago = (() => {
    try {
      return formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })
    } catch {
      return ""
    }
  })()

  return (
    <button
      onClick={() => onRead(notif.id, notif.cta_url)}
      className={cn(
        "w-full text-left flex gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-accent/60",
        !notif.is_read && "bg-accent/30"
      )}
    >
      {/* Priority dot */}
      <div className="mt-1.5 shrink-0">
        <span
          className={cn(
            "block h-2 w-2 rounded-full",
            PRIORITY_DOT[notif.priority] ?? "bg-muted"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug truncate", !notif.is_read && "font-semibold")}>
            {notif.title}
            {notif.grouped_count > 1 && (
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                ×{notif.grouped_count}
              </span>
            )}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{ago}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
      </div>
    </button>
  )
}

export function NotificationDropdown() {
  const router = useRouter()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const unread = notifications.filter((n) => !n.is_read)

  function handleRead(id: string, url: string) {
    markRead(id)
    if (url) router.push(url)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-lg">
          <Bell className="h-[1.1rem] w-[1.1rem]" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 shadow-xl border-border/40"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[400px]">
          {unread.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-40" />
              <p className="text-sm">You're all caught up</p>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-0.5">
              {unread.map((n) => (
                <NotificationRow key={n.id} notif={n} onRead={handleRead} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
