import { useState, useCallback, useEffect, useRef } from "react"
import { authService } from "@/lib/auth"

// ── Types ────────────────────────────────────────────────────

export interface OrchestrateIntentData {
  source: "db" | "crustdata" | "not_found"
  prospect_id: string
  prospect_name: string
  prospect_title: string
  prospect_company: string
  task: string
  estimated_credits: number
  context_overrides: Record<string, unknown> | null
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
  links?: { label: string; url: string }[]
  tags?: string[]
  isError?: boolean
  isCreditError?: boolean
  orchestrateData?: OrchestrateIntentData
}

export interface ChatSession {
  id: string
  title: string
  message_count: number
  created_at: string | null
  updated_at: string | null
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Strip JSON wrapper from streamed content to show only the answer text.
 */
function stripJSONWrapper(raw: string): string {
  let s = raw.trim()

  // If not JSON format, unescape and return as-is
  if (!s.startsWith("{")) {
    return s
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\r/g, "")
  }

  // JSON mode — strip the opening brace
  s = s.substring(1).trim()

  const answerKeyPattern = /^"answer"\s*:\s*"/
  const match = s.match(answerKeyPattern)
  if (!match) {
    // The "answer": " prefix hasn't fully arrived yet — show nothing
    // rather than flashing raw JSON characters to the user
    return ""
  }
  s = s.substring(match[0].length)

  const trailingPatterns = [
    /",\s*"related_links"\s*:/,
    /",\s*"feature_tags"\s*:/,
    /",\s*"raw_text"\s*:/,
  ]
  for (const pattern of trailingPatterns) {
    const trailMatch = s.match(pattern)
    if (trailMatch && trailMatch.index !== undefined) {
      s = s.substring(0, trailMatch.index)
    }
  }

  if (s.endsWith('"')) s = s.slice(0, -1)

  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\r/g, "")
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function getAuthHeaders(): Record<string, string> {
  return authService.getAuthHeaders()
}

// ── Chat History API ─────────────────────────────────────────

async function fetchChatSessions(): Promise<ChatSession[]> {
  try {
    const res = await fetch(`${API_BASE}/api/copilot/chat-history`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.sessions || []
  } catch {
    // Network failure / CORS / backend down — degrade to empty list silently
    return []
  }
}

async function fetchChatSession(sessionId: string): Promise<{ messages: Message[]; title: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/copilot/chat-history/${sessionId}`, {
      headers: getAuthHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      messages: (data.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
        links: m.links || undefined,
        tags: m.tags || undefined,
      })),
      title: data.title,
    }
  } catch {
    return null
  }
}

async function saveChatSession(
  sessionId: string | null,
  messages: Message[],
  title?: string
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/copilot/chat-history`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        title,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          links: m.links || null,
          tags: m.tags || null,
        })),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.id || null
  } catch {
    return null
  }
}

async function deleteChatSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/copilot/chat-history/${sessionId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Hook ─────────────────────────────────────────────────────

export function useChatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load sessions list on mount
  useEffect(() => {
    fetchChatSessions().then((s) => {
      setSessions(s)
      setSessionsLoaded(true)
    })
  }, [])

  // Debounced auto-save after messages change (only when there are messages)
  const saveCurrentSession = useCallback(async (msgs: Message[], sessionId: string | null) => {
    if (msgs.length < 2) return // Need at least 1 user + 1 assistant message
    // Don't save if last message is empty (still streaming)
    const lastMsg = msgs[msgs.length - 1]
    if (!lastMsg.content) return

    const newId = await saveChatSession(sessionId, msgs)
    if (newId && !sessionId) {
      setActiveSessionId(newId)
      // Refresh sessions list
      fetchChatSessions().then(setSessions)
    }
  }, [])

  const sendMessage = useCallback(async (content: string, route?: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const safeContent = trimmed.slice(0, 1000)

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: safeContent,
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = Math.random().toString(36).substring(7)
    setMessages((prev) => [...prev, {
      id: assistantId,
      role: "assistant" as const,
      content: "",
      createdAt: Date.now(),
    }])

    let accumulatedContent = ""
    let gotDoneEvent = false
    let finalMessages: Message[] = []

    try {
      const response = await fetch(`${API_BASE}/api/copilot/product-assistant/stream`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          question: safeContent,
          context: { route },
        }),
      })

      if (response.status === 402) {
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: "You've run out of AI credits. Visit **Settings** to manage your plan and continue using Copilot.",
                  links: [{ label: "Manage Credits", url: "/copilot/settings" }],
                  isCreditError: true,
                }
              : msg
          )
          finalMessages = updated
          return updated
        })
        return
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith("data: ")) continue

          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === "orchestrate_intent") {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, orchestrateData: data.data as OrchestrateIntentData }
                    : msg
                )
              )
            } else if (data.type === "token") {
              accumulatedContent += data.content
              const displayContent = stripJSONWrapper(accumulatedContent)
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: displayContent } : msg
                )
              )
            } else if (data.type === "done") {
              gotDoneEvent = true
              let result = data.result
              if (typeof result === "string") {
                try { result = JSON.parse(result) } catch { /* keep */ }
              }

              const answer = result?.answer || stripJSONWrapper(accumulatedContent) || "I couldn't process that properly."
              const links = result?.related_links || []
              const tags = result?.feature_tags || []

              setMessages((prev) => {
                const updated = prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: answer, links, tags } : msg
                )
                finalMessages = updated
                return updated
              })
            } else if (data.type === "error") {
              setMessages((prev) => {
                const updated = prev.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, content: "Something went wrong. Please try again.", isError: true, links: [{ label: "Go to Dashboard", url: "/dashboard" }] }
                    : msg
                )
                finalMessages = updated
                return updated
              })
            }
          } catch (e) {
            console.error("Error parsing SSE chunk:", e)
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim().startsWith("data: ")) {
        try {
          const data = JSON.parse(buffer.trim().slice(6))
          if (data.type === "done") {
            gotDoneEvent = true
            let result = data.result
            if (typeof result === "string") {
              try { result = JSON.parse(result) } catch { /* keep */ }
            }
            setMessages((prev) => {
              const updated = prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: result?.answer || stripJSONWrapper(accumulatedContent), links: result?.related_links || [], tags: result?.feature_tags || [] }
                  : msg
              )
              finalMessages = updated
              return updated
            })
          }
        } catch { /* ignore */ }
      }

      // Fallback if no done event
      if (!gotDoneEvent && accumulatedContent) {
        try {
          const start = accumulatedContent.indexOf("{")
          const end = accumulatedContent.lastIndexOf("}")
          if (start !== -1 && end > start) {
            const parsed = JSON.parse(accumulatedContent.substring(start, end + 1))
            setMessages((prev) => {
              const updated = prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: parsed.answer || stripJSONWrapper(accumulatedContent), links: parsed.related_links || [], tags: parsed.feature_tags || [] }
                  : msg
              )
              finalMessages = updated
              return updated
            })
          } else {
            setMessages((prev) => {
              const updated = prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: stripJSONWrapper(accumulatedContent) } : msg
              )
              finalMessages = updated
              return updated
            })
          }
        } catch {
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: stripJSONWrapper(accumulatedContent) } : msg
            )
            finalMessages = updated
            return updated
          })
        }
      }
    } catch (error) {
      console.error("Chatbot streaming error:", error)
      setMessages((prev) => {
        const updated = prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: "Something went wrong while connecting to Copilot. Please check your connection and try again.", isError: true, links: [{ label: "Go to Dashboard", url: "/dashboard" }] }
            : msg
        )
        finalMessages = updated
        return updated
      })
    } finally {
      setIsLoading(false)
      // Auto-save after response completes (debounced)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        if (finalMessages.length >= 2) {
          saveCurrentSession(finalMessages, activeSessionId)
        }
      }, 1000)
    }
  }, [activeSessionId, saveCurrentSession])

  const loadSession = useCallback(async (sessionId: string) => {
    const data = await fetchChatSession(sessionId)
    if (data) {
      setMessages(data.messages)
      setActiveSessionId(sessionId)
    }
  }, [])

  const deleteSession = useCallback(async (sessionId: string) => {
    const success = await deleteChatSession(sessionId)
    if (success) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        setMessages([])
        setActiveSessionId(null)
      }
    }
  }, [activeSessionId])

  const startNewChat = useCallback(() => {
    setMessages([])
    setActiveSessionId(null)
  }, [])

  const refreshSessions = useCallback(async () => {
    const s = await fetchChatSessions()
    setSessions(s)
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    setMessages,
    // Chat history
    sessions,
    sessionsLoaded,
    activeSessionId,
    loadSession,
    deleteSession,
    startNewChat,
    refreshSessions,
  }
}
