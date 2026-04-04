'use client'

/**
 * USE COPILOT AGENT
 * Primary hook for the Automation Agent feature.
 * Wraps ClaudeIntegration + syncs route + exposes execution state.
 */

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCoPilotAgentStore, Message, ExecutionResult, FilterSnapshot } from '@/lib/copilot/agent-store'
import { getClaudeIntegration } from '@/lib/copilot/claude-integration'
import { initNavigationRouter } from '@/lib/copilot/navigation-controller'

export interface CoPilotAgentHook {
  // Conversation
  messages: Message[]
  isLoading: boolean
  sendMessage: (text: string) => Promise<void>
  interrupt: () => void
  clearHistory: () => void

  // Execution state
  executionResults: ExecutionResult[]
  highlightedElement: string | null
  navigationInProgress: boolean
  currentRoute: string

  // Filters
  appliedFilters: Record<string, Record<string, unknown>>
  filterHistory: FilterSnapshot[]

  // Undo/redo
  canUndo: boolean
  canRedo: (module: string) => boolean
}

export function useCoPilotAgent(): CoPilotAgentHook {
  const pathname = usePathname()
  const router = useRouter()

  // Wire the router into NavigationController before any tool calls happen
  initNavigationRouter(router)

  // Store selectors
  const messages = useCoPilotAgentStore((s) => s.messages)
  const isLoading = useCoPilotAgentStore((s) => s.isLoading)
  const executionResults = useCoPilotAgentStore((s) => s.executionResults)
  const highlightedElement = useCoPilotAgentStore((s) => s.highlightedElement)
  const navigationInProgress = useCoPilotAgentStore((s) => s.navigationInProgress)
  const currentRoute = useCoPilotAgentStore((s) => s.currentRoute)
  const appliedFilters = useCoPilotAgentStore((s) => s.appliedFilters)
  const filterHistory = useCoPilotAgentStore((s) => s.filterHistoryStack)
  const redoStack = useCoPilotAgentStore((s) => s.redoStack)
  const setCurrentRoute = useCoPilotAgentStore((s) => s.setCurrentRoute)

  // Keep store in sync with the actual Next.js route
  useEffect(() => {
    if (pathname && pathname !== currentRoute) {
      setCurrentRoute(pathname)
    }
  }, [pathname, currentRoute, setCurrentRoute])

  // Singleton — safe to call directly now that NavigationController
  // no longer calls useRouter() in its constructor.
  const integration = getClaudeIntegration()

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return
    try {
      await integration.chat(text)
    } catch (err) {
      console.error('[CoPilotAgent] sendMessage error:', err)
    }
  }, [integration])

  const clearHistory = useCallback(() => {
    integration.clearHistory()
  }, [integration])

  const interrupt = useCallback(() => {
    integration.interrupt()
  }, [integration])

  return {
    messages,
    isLoading,
    sendMessage,
    interrupt,
    clearHistory,
    executionResults,
    highlightedElement,
    navigationInProgress,
    currentRoute,
    appliedFilters,
    filterHistory,
    canUndo: filterHistory.length > 0,
    canRedo: (module: string) => redoStack.some((r) => r.module === module),
  }
}
