import { useState, useCallback } from "react"
import axios from "axios"
import { authService } from "@/lib/auth"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
  links?: { label: string; url: string }[]
  tags?: string[]
}

export function useChatbot() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = useCallback(async (content: string, route?: string) => {
    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content,
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    // Initial placeholder for assistant message
    const assistantId = Math.random().toString(36).substring(7)
    const initialAssistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, initialAssistantMessage])

    try {
      const response = await fetch("/api/copilot/product-assistant/stream", {
        method: "POST",
        headers: {
          ...authService.getAuthHeaders(),
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          question: content,
          context: { route },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      let accumulatedContent = ""
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n\n")

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          
          try {
            const data = JSON.parse(line.slice(6))
            
            if (data.type === "token") {
              accumulatedContent += data.content
              
              let displayContent = accumulatedContent
              
              // Try to extract the "answer" string if it exists in the partial JSON
              // This relies on the LLM outputting the "answer" key first
              const match = accumulatedContent.match(/"answer"\s*:\s*"([^]*)/)
              if (match) {
                displayContent = match[1]
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                
                // If the stream has moved on to related_links, stop at the end of the answer
                const endMatch = displayContent.indexOf('",\n') !== -1 ? displayContent.indexOf('",\n') : displayContent.indexOf('",\r\n')
                if (endMatch !== -1) {
                  displayContent = displayContent.substring(0, endMatch)
                } else {
                  // Fallback for compact JSON
                  const compactEndMatch = displayContent.indexOf('","')
                  if (compactEndMatch !== -1) {
                    displayContent = displayContent.substring(0, compactEndMatch)
                  }
                }
              }

              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === assistantId 
                    ? { ...msg, content: displayContent } 
                    : msg
                )
              )
            } else if (data.type === "done") {
              setMessages((prev) => 
                prev.map((msg) => 
                  msg.id === assistantId 
                    ? { 
                        ...msg, 
                        content: data.result.answer || data.result.raw_text || "I couldn't process that properly.",
                        links: data.result.related_links || [],
                        tags: data.result.feature_tags || []
                      } 
                    : msg
                )
              )
            }
          } catch (e) {
            console.error("Error parsing SSE chunk:", e)
          }
        }
      }
    } catch (error) {
      console.error("Chatbot streaming error:", error)
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === assistantId 
            ? { ...msg, content: "I'm sorry, I encountered an error. Please try again later." } 
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    setMessages,
  }
}
