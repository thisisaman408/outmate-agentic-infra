import { authService } from "@/lib/auth"

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  cta_url: string
  priority: "red" | "indigo" | "green"
  is_read: boolean
  grouped_count: number
  created_at: string
}

function authHeaders(): HeadersInit {
  const h = authService.getAuthHeaders()
  const out: Record<string, string> = {}
  Object.entries(h).forEach(([k, v]) => { if (v) out[k] = v })
  return out
}

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const qs = unreadOnly ? "?unread_only=true" : ""
  const res = await fetch(`${BACKEND_BASE}/api/copilot/notifications${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error("Failed to fetch notifications")
  return res.json()
}

export async function markRead(id: string): Promise<void> {
  await fetch(`${BACKEND_BASE}/api/copilot/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  })
}

export async function markAllRead(): Promise<void> {
  await fetch(`${BACKEND_BASE}/api/copilot/notifications/read-all`, {
    method: "PATCH",
    headers: authHeaders(),
  })
}

/** Return the raw JWT token string for SSE query-param auth. */
export function getToken(): string {
  const h = authService.getAuthHeaders() as Record<string, string>
  const bearer = h["Authorization"] || h["authorization"] || ""
  return bearer.replace(/^Bearer\s+/i, "")
}
