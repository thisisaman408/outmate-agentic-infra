"use client"

import { useState, useCallback } from "react"
import { copilotApi, type CopilotPreferences, InsufficientCreditsError } from "@/lib/api/copilot"
import { useToast } from "@/hooks/use-toast"

function useCopilotError() {
  const { toast } = useToast()
  const handleError = useCallback((err: any, fallback: string) => {
    if (err instanceof InsufficientCreditsError) {
      toast({
        title: "Insufficient Credits",
        description: `This action requires ${err.credits_required} credit(s). You have ${err.credits_remaining} remaining.`,
        variant: "destructive",
      })
    } else {
      toast({ title: "Error", description: err?.message || fallback, variant: "destructive" })
    }
  }, [toast])
  return { toast, handleError }
}

export function useCopilotCredits() {
  const [credits, setCredits] = useState<{ credits_remaining: number; costs: Record<string, number> } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchCredits = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await copilotApi.getCredits()
      setCredits(data)
      return data
    } catch {
      // silent — credits display is non-critical
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { credits, isLoading, fetchCredits }
}

export function useDailyBrief() {
  const [brief, setBrief] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { handleError } = useCopilotError()

  const fetch = useCallback(async (forceRegenerate = false) => {
    setIsLoading(true)
    try {
      const data = forceRegenerate
        ? await copilotApi.regenerateDailyBrief()
        : await copilotApi.getDailyBrief()
      setBrief(data)
      return data
    } catch (err: any) {
      handleError(err, "Failed to load daily brief")
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  return { brief, isLoading, fetch }
}

export function useCopilotPreferences() {
  const [preferences, setPreferences] = useState<CopilotPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast, handleError } = useCopilotError()

  const fetchPreferences = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await copilotApi.getPreferences()
      setPreferences(data)
      return data
    } catch (err: any) {
      handleError(err, "Failed to load preferences")
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  const savePreferences = useCallback(async (data: CopilotPreferences) => {
    setIsSaving(true)
    try {
      const updated = await copilotApi.updatePreferences(data)
      setPreferences(updated)
      toast({ title: "Saved", description: "Preferences updated successfully." })
      return updated
    } catch (err: any) {
      handleError(err, "Failed to save preferences")
    } finally {
      setIsSaving(false)
    }
  }, [toast, handleError])

  return { preferences, isLoading, isSaving, fetchPreferences, savePreferences }
}

export function usePipelineAlerts() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast, handleError } = useCopilotError()

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await copilotApi.getPipelineAlerts()
      setAlerts(data?.alerts ?? data ?? [])
    } catch (err: any) {
      handleError(err, "Failed to load alerts")
    } finally {
      setIsLoading(false)
    }
  }, [handleError])

  const resolve = useCallback(async (alertId: string) => {
    try {
      await copilotApi.resolveAlert(alertId)
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
      toast({ title: "Resolved", description: "Alert marked as resolved." })
    } catch (err: any) {
      handleError(err, "Failed to resolve alert")
    }
  }, [toast, handleError])

  return { alerts, isLoading, fetchAlerts, resolve }
}
