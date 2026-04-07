"use client"

import { useState, useCallback, useRef } from "react"
import { copilotApi, OrchestratorEvent, OrchestratorArtifact, PlanStep } from "@/lib/api/copilot"

export type OrchestratorStatus =
  | "idle"
  | "context_loading"
  | "planning"
  | "executing"
  | "merging"
  | "complete"
  | "error"

export interface StepState {
  step_id: string
  label: string
  action: string
  status: "waiting" | "running" | "done" | "error"
  result?: unknown
}

export interface OrchestratorState {
  status: OrchestratorStatus
  intent: string
  estimatedCredits: number
  steps: StepState[]
  runningStepIds: string[]
  artifact: OrchestratorArtifact | null
  error: string | null
  creditsUsed: number
}

const initialState: OrchestratorState = {
  status: "idle",
  intent: "",
  estimatedCredits: 0,
  steps: [],
  runningStepIds: [],
  artifact: null,
  error: null,
  creditsUsed: 0,
}

export function useOrchestrator() {
  const [state, setState] = useState<OrchestratorState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (prospectId: string, task: string, contextOverrides?: Record<string, unknown> | null) => {
    // Cancel any in-flight run
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setState({ ...initialState, status: "context_loading" })

    const handleEvent = (event: OrchestratorEvent) => {
      setState((prev) => {
        switch (event.type) {
          case "context_loading":
            return { ...prev, status: "context_loading" }

          case "planning":
            return { ...prev, status: "planning" }

          case "plan_ready": {
            const steps: StepState[] = event.data.steps.map((s: PlanStep) => ({
              step_id: s.step_id,
              label: s.label,
              action: s.action,
              status: "waiting",
            }))
            return {
              ...prev,
              status: "executing",
              intent: event.data.intent,
              estimatedCredits: event.data.estimated_credits,
              steps,
            }
          }

          case "steps_starting": {
            const runningIds = event.data.steps
            return {
              ...prev,
              runningStepIds: runningIds,
              steps: prev.steps.map((s) =>
                runningIds.includes(s.step_id) ? { ...s, status: "running" } : s
              ),
            }
          }

          case "step_complete": {
            const { step_id, result } = event.data
            return {
              ...prev,
              steps: prev.steps.map((s) =>
                s.step_id === step_id ? { ...s, status: "done", result } : s
              ),
              runningStepIds: prev.runningStepIds.filter((id) => id !== step_id),
            }
          }

          case "merging":
            return { ...prev, status: "merging" }

          case "complete":
            return {
              ...prev,
              status: "complete",
              artifact: event.data,
              creditsUsed: event.data.credits_used,
            }

          case "error":
            return {
              ...prev,
              status: "error",
              error: event.data.message,
              steps: event.data.step_id
                ? prev.steps.map((s) =>
                    s.step_id === event.data.step_id ? { ...s, status: "error" } : s
                  )
                : prev.steps,
            }

          default:
            return prev
        }
      })
    }

    try {
      await copilotApi.orchestrate(
        prospectId,
        task,
        handleEvent,
        abortRef.current.signal,
        contextOverrides,
      )
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Orchestration failed",
      }))
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((prev) => ({ ...prev, status: "idle" }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(initialState)
  }, [])

  return { state, run, cancel, reset }
}
