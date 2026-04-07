"use client"

import { useState, useEffect, useRef } from "react"
import { useCoPilotAgentStore } from "@/lib/copilot/agent-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { gtmAgentsApi, type GTMAgentRunResponse } from "@/lib/api/gtm-agents"

function extractResultText(res: GTMAgentRunResponse): string {
  if (res.result && typeof res.result === "string") return res.result
  if (res.results) return typeof res.results === "string" ? res.results : JSON.stringify(res.results, null, 2)
  const keys = Object.keys(res).filter(k => k !== "result" && k !== "results")
  if (keys.length > 0) return keys.map(k => `${k}: ${JSON.stringify(res[k])}`).join("\n\n")
  return "Agent completed — no output returned."
}
import { Loader2, Globe } from "lucide-react"

export function RegimeShifterPanel() {
  const { toast } = useToast()
  const [geoFocus, setGeoFocus] = useState("")
  const [scenario, setScenario] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  // ── Automation Agent injection ──
  const agentForm = useCoPilotAgentStore((s) => s.copilotForms?.['regime_shifter'])
  const prevSubmitSignal = useRef(0)
  useEffect(() => {
    if (!agentForm) return
    const { fields, submitSignal } = agentForm
    const f = fields as Record<string, any>
    if (f.geo_icp_focus) setGeoFocus(f.geo_icp_focus as string)
    if (f.scenario) setScenario(f.scenario as string)
    if (submitSignal > prevSubmitSignal.current && f.geo_icp_focus) {
      prevSubmitSignal.current = submitSignal
      setTimeout(async () => {
        setIsRunning(true)
        setOutput(null)
        try {
          const res = await gtmAgentsApi.runRegimeShifter({
            geo_focus: f.geo_icp_focus as string,
            scenario: f.scenario as string | undefined,
          })
          setOutput(extractResultText(res))
          toast({ title: 'ICP Recalibration Generated', description: 'Review geo-specific ICP tweaks and sequences.' })
        } catch (err: any) {
          toast({ title: 'Regime Shifter Failed', description: err.message, variant: 'destructive' })
        } finally { setIsRunning(false) }
      }, 80)
    }
  }, [agentForm])

  const handleRun = async () => {
    if (!geoFocus.trim()) {
      toast({
        title: "Geo / ICP required",
        description: "Describe the markets or segments you want Regime Shifter to recalibrate.",
        variant: "destructive",
      })
      return
    }
    setIsRunning(true)
    setOutput(null)
    try {
      const res = await gtmAgentsApi.runRegimeShifter({
        geo_focus: geoFocus.trim(),
        scenario: scenario.trim() || undefined,
      })
      setOutput(extractResultText(res))
      toast({
        title: "ICP recalibration generated",
        description: "Review the geo-specific ICP tweaks and sequences.",
      })
    } catch (err: any) {
      toast({
        title: "Regime Shifter failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-effect border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <span className="p-2 rounded-lg bg-lime-500/10 text-lime-400 border border-lime-500/30">
              <Globe className="h-5 w-5" />
            </span>
            Regime Shifter
          </CardTitle>
          <CardDescription>
            Dynamically adapt ICP and sequences to macro events across regions and markets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Geo / ICP Focus
            </label>
            <Input
              value={geoFocus}
              onChange={(e) => setGeoFocus(e.target.value)}
              disabled={isRunning}
              className="h-10"
              placeholder="e.g. EU SaaS mid-market, US manufacturing, APAC fintech"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Scenario (optional)
            </label>
            <Textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              disabled={isRunning}
              rows={4}
              placeholder="Describe the macro events to react to (e.g. new tariffs, elections, downturn, regulation)."
            />
          </div>
          <Button
            onClick={handleRun}
            disabled={isRunning}
            className="mt-2 w-full md:w-auto h-11 font-semibold rounded-xl"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recalibrating ICP…
              </>
            ) : (
              <>
                <Globe className="mr-2 h-4 w-4" />
                Run Regime Shifter
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {output && (
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Regime Shifter Output</CardTitle>
            <CardDescription>ICP adjustments and geo-specific sequences.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[480px] overflow-y-auto">
              {output}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

