import { create } from "zustand"
import type { Notification } from "@/lib/api/notifications"

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  setAll: (notifications: Notification[]) => void
  append: (notification: Notification) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setAll: (notifications) => {
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    })
  },

  append: (notification) => {
    const existing = get().notifications
    // If this notification already exists (grouped), update it in place.
    const idx = existing.findIndex((n) => n.id === notification.id)
    let updated: Notification[]
    if (idx >= 0) {
      updated = [...existing]
      updated[idx] = notification
    } else {
      updated = [notification, ...existing].slice(0, 50)
    }
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.is_read).length,
    })
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    )
    set({ notifications: updated, unreadCount: updated.filter((n) => !n.is_read).length })
  },

  markAllRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, is_read: true }))
    set({ notifications: updated, unreadCount: 0 })
  },
}))
