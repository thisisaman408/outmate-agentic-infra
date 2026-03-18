"use client"

import { create } from "zustand"
import { useState, useCallback } from "react"
import {
  copilotApi,
  InsufficientCreditsError,
  type LeadContextData,
  type LeadActionRequest,
  type LeadActionResponse,
  type LeadSuggestionsResponse,
  type StreamStage,
  type StreamEvent,
} from "@/lib/api/copilot"
import { useToast } from "@/hooks/use-toast"

// ── Panel Conversation Message ───────────────────────────────

export interface CopilotMessage {
  id: string
  role: "user" | "assistant"
  action_type?: string
  prompt?: string
  result?: Record<string, any>
  credits_used?: number
  timestamp: number
}

// ── Panel Store (Zustand) ────────────────────────────────────

interface CopilotPanelState {
  isPanelOpen: boolean
  selectedProspect: any | null
  messages: CopilotMessage[]
  openPanel: (prospect: any) => void
  closePanel: () => void
  addMessage: (msg: CopilotMessage) => void
  clearMessages: () => void
}

export const useCopilotPanelStore = create<CopilotPanelState>((set) => ({
  isPanelOpen: false,
  selectedProspect: null,
  messages: [],
  openPanel: (prospect) => set({ isPanelOpen: true, selectedProspect: prospect, messages: [] }),
  closePanel: () => set({ isPanelOpen: false, selectedProspect: null, messages: [] }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
}))

// ── Lead Context Hook ────────────────────────────────────────

export function useLeadContext(prospectId: string | null) {
  const [context, setContext] = useState<LeadContextData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchContext = useCallback(async () => {
    if (!prospectId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await copilotApi.getLeadContext(prospectId)
      setContext(data)
      return data
    } catch (err: any) {
      setError(err?.message || "Failed to load context")
    } finally {
      setIsLoading(false)
    }
  }, [prospectId])

  return { context, isLoading, error, fetchContext }
}

// ── Lead Action Hook ─────────────────────────────────────────

export function useLeadAction() {
  const [isLoading, setIsLoading] = useState(false)
  const [streamingStage, setStreamingStage] = useState<StreamStage | null>(null)
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null)
  const { toast } = useToast()
  const addMessage = useCopilotPanelStore((s) => s.addMessage)

  const executeAction = useCallback(async (request: LeadActionRequest): Promise<LeadActionResponse | null> => {
    setIsLoading(true)
    setStreamingStage(null)
    setStreamingMessage(null)

    // Add user message to conversation
    addMessage({
      id: `user-${Date.now()}`,
      role: "user",
      action_type: request.action_type,
      prompt: request.prompt || request.action_type.replace(/_/g, " "),
      timestamp: Date.now(),
    })

    try {
      let finalResult: LeadActionResponse | null = null

      await copilotApi.executeLeadActionStream(request, (event: StreamEvent) => {
        switch (event.stage) {
          case "enriching":
            setStreamingStage("enriching")
            setStreamingMessage(event.message || "Researching lead...")
            break
          case "generating":
            setStreamingStage("generating")
            setStreamingMessage(event.message || "Generating response...")
            break
          case "token":
            // tokens are streaming in — keep generating stage
            setStreamingStage("generating")
            break
          case "complete":
            setStreamingStage("complete")
            setStreamingMessage(null)
            finalResult = {
              action_type: event.action_type || request.action_type,
              result: event.result || {},
              suggestions: [],
              credits_used: event.credits_used || 0,
            }
            // Add assistant response to conversation
            addMessage({
              id: `assistant-${Date.now()}`,
              role: "assistant",
              action_type: finalResult.action_type,
              result: finalResult.result,
              credits_used: finalResult.credits_used,
              timestamp: Date.now(),
            })
            break
          case "error":
            // Show error as inline assistant message so it's always visible
            addMessage({
              id: `assistant-${Date.now()}`,
              role: "assistant",
              action_type: request.action_type,
              result: { error: event.message || "Action failed" },
              credits_used: 0,
              timestamp: Date.now(),
            })
            toast({
              title: "Error",
              description: event.message || "Action failed",
              variant: "destructive",
            })
            break
        }
      })

      return finalResult
    } catch (err: any) {
      if (err instanceof InsufficientCreditsError) {
        toast({
          title: "Insufficient Credits",
          description: `This action requires ${err.credits_required} credit(s). You have ${err.credits_remaining} remaining.`,
          variant: "destructive",
        })
      } else {
        // Fallback to non-streaming endpoint
        try {
          const data = await copilotApi.executeLeadAction(request)
          addMessage({
            id: `assistant-${Date.now()}`,
            role: "assistant",
            action_type: data.action_type,
            result: data.result,
            credits_used: data.credits_used,
            timestamp: Date.now(),
          })
          return data
        } catch (fallbackErr: any) {
          toast({
            title: "Error",
            description: fallbackErr?.message || "Failed to execute action",
            variant: "destructive",
          })
        }
      }
      return null
    } finally {
      setIsLoading(false)
      setStreamingStage(null)
      setStreamingMessage(null)
    }
  }, [toast, addMessage])

  return { isLoading, streamingStage, streamingMessage, executeAction }
}

// ── Lead Suggestions Hook ────────────────────────────────────

export function useLeadSuggestions(prospectId: string | null) {
  const [suggestions, setSuggestions] = useState<LeadSuggestionsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchSuggestions = useCallback(async () => {
    if (!prospectId) return
    setIsLoading(true)
    try {
      const data = await copilotApi.getLeadSuggestions(prospectId)
      setSuggestions(data)
      return data
    } catch (err: any) {
      if (err instanceof InsufficientCreditsError) {
        toast({
          title: "Insufficient Credits",
          description: `Suggestions require ${err.credits_required} credit(s). You have ${err.credits_remaining} remaining.`,
          variant: "destructive",
        })
      }
      // Suggestions are non-critical — don't block the panel
    } finally {
      setIsLoading(false)
    }
  }, [prospectId, toast])

  return { suggestions, isLoading, fetchSuggestions }
}
