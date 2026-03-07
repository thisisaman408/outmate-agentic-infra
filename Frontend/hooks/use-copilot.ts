"use client"

import { useState, useCallback } from "react"
import { copilotApi, type CopilotPreferences } from "@/lib/api/copilot"
import { useToast } from "@/hooks/use-toast"

export function useDailyBrief() {
  const [brief, setBrief] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetch = useCallback(async (forceRegenerate = false) => {
    setIsLoading(true)
    try {
      const data = forceRegenerate
        ? await copilotApi.regenerateDailyBrief()
        : await copilotApi.getDailyBrief()
      setBrief(data)
      return data
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to load daily brief", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  return { brief, isLoading, fetch }
}

export function useCopilotPreferences() {
  const [preferences, setPreferences] = useState<CopilotPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  const fetchPreferences = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await copilotApi.getPreferences()
      setPreferences(data)
      return data
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to load preferences", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const savePreferences = useCallback(async (data: CopilotPreferences) => {
    setIsSaving(true)
    try {
      const updated = await copilotApi.updatePreferences(data)
      setPreferences(updated)
      toast({ title: "Saved", description: "Preferences updated successfully." })
      return updated
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to save preferences", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }, [toast])

  return { preferences, isLoading, isSaving, fetchPreferences, savePreferences }
}

export function usePipelineAlerts() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await copilotApi.getPipelineAlerts()
      setAlerts(data?.alerts ?? data ?? [])
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to load alerts", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const resolve = useCallback(async (alertId: string) => {
    try {
      await copilotApi.resolveAlert(alertId)
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
      toast({ title: "Resolved", description: "Alert marked as resolved." })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to resolve alert", variant: "destructive" })
    }
  }, [toast])

  return { alerts, isLoading, fetchAlerts, resolve }
}
