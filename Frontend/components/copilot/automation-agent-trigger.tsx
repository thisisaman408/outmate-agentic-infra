'use client'

/**
 * AUTOMATION AGENT TRIGGER
 * Floating button in the main layout that opens the AutomationPanel Sheet.
 * Sits to the left of the GlobalCopilotPanel button so they don't overlap.
 * Shows a pulse badge when the agent is actively running.
 */

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AutomationPanel } from '@/components/copilot/automation-panel'

export function AutomationAgentTrigger({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>

      {/* Sheet panel — full-height side panel */}
      <SheetContent
        side="right"
        className="p-0 w-full sm:w-[420px] flex flex-col"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">Automation Agent</SheetTitle>
        <AutomationPanel />
      </SheetContent>
    </Sheet>
  )
}
