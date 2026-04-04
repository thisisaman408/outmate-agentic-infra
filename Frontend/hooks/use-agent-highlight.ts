'use client'

/**
 * USE AGENT HIGHLIGHT
 * Returns true when the automation agent has set a highlight on the given
 * element ID. The FilterController calls setHighlight(`${module}-filters-panel`)
 * for 2.5 seconds after each successful filter injection.
 *
 * Usage:
 *   const highlighted = useAgentHighlight('prospects-filters-panel')
 *   <div className={cn('...', highlighted && 'ring-2 ring-primary ring-offset-2')}>
 */

import { useCoPilotAgentStore } from '@/lib/copilot/agent-store'

export function useAgentHighlight(elementId: string): boolean {
  return useCoPilotAgentStore((s) => s.highlightedElement === elementId)
}
