"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { gtmAgentsApi } from "@/lib/api/gtm-agents"
import { Loader2, Globe } from "lucide-react"

export function RegimeShifterPanel() {
  const { toast } = useToast()
  const [geoFocus, setGeoFocus] = useState("")
  const [scenario, setScenario] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

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
      setOutput(JSON.stringify(res, null, 2))
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
            <pre className="text-xs text-muted-foreground bg-black/40 rounded-xl p-4 overflow-x-auto max-h-[360px]">
              {output}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

