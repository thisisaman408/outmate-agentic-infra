'use client'

/**
 * USE AGENT TOAST
 * Watches executionResults in the agent store and fires a sonner toast
 * whenever a new result lands. Mount once in main-layout-wrapper.
 *
 * Usage:
 *   // in MainLayoutWrapper or any always-mounted client component:
 *   useAgentToast()
 */

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useCoPilotAgentStore } from '@/lib/copilot/agent-store'

export function useAgentToast() {
  const results = useCoPilotAgentStore((s) => s.executionResults)
  const seenCount = useRef(results.length)

  useEffect(() => {
    if (results.length <= seenCount.current) {
      seenCount.current = results.length
      return
    }

    // New results arrived — toast each unseen one
    const newResults = results.slice(seenCount.current)
    seenCount.current = results.length

    for (const result of newResults) {
      if (result.status === 'success') {
        toast.success(
          result.resultCount
            ? `Agent: found ${result.resultCount} result${result.resultCount !== 1 ? 's' : ''} in ${result.module}`
            : `Agent: completed ${result.module}`,
          { duration: 4000 }
        )
      } else if (result.status === 'error') {
        toast.error(
          `Agent: ${result.module} failed${result.error ? ` — ${result.error}` : ''}`,
          { duration: 5000 }
        )
      }
    }
  }, [results])
}
