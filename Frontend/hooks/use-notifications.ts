"use client"

import { useEffect, useRef } from "react"
import { getNotifications, markRead as apiMarkRead, markAllRead as apiMarkAllRead, getToken } from "@/lib/api/notifications"
import { useNotificationStore } from "@/lib/stores/notificationStore"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export function useNotifications() {
  const { setAll, append, markRead, markAllRead, notifications, unreadCount } = useNotificationStore()
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // 1. Fetch initial list
    getNotifications()
      .then(setAll)
      .catch(() => {/* ignore auth errors before login */})

    // 2. Open SSE stream
    const token = getToken()
    if (!token) return

    const url = `${BACKEND_BASE}/api/copilot/notifications/stream?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data)
        append(notif)
      } catch {
        // heartbeat or malformed — ignore
      }
    }

    es.onerror = () => {
      es.close()
      // Retry after 5s on error
      setTimeout(() => {
        esRef.current = null
      }, 5000)
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [])  // mount once per session

  async function handleMarkRead(id: string) {
    markRead(id)  // optimistic
    await apiMarkRead(id).catch(() => {})
  }

  async function handleMarkAllRead() {
    markAllRead()  // optimistic
    await apiMarkAllRead().catch(() => {})
  }

  return { notifications, unreadCount, markRead: handleMarkRead, markAllRead: handleMarkAllRead }
}
