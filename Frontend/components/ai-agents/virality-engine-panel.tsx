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
import { Loader2, Network } from "lucide-react"

export function ViralityEnginePanel() {
  const { toast } = useToast()
  const [seedCustomers, setSeedCustomers] = useState("Rippling, Figma, Linear")
  const [channels, setChannels] = useState("email, linkedin, in-product")
  const [additionalNotes, setAdditionalNotes] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  // ── Automation Agent injection ──
  const agentForm = useCoPilotAgentStore((s) => s.copilotForms?.['virality_engine'])
  const prevSubmitSignal = useRef(0)
  useEffect(() => {
    if (!agentForm) return
    const { fields, submitSignal } = agentForm
    const f = fields as Record<string, any>
    if (f.seed_customers) setSeedCustomers(f.seed_customers as string)
    if (f.channels) setChannels(f.channels as string)
    if (f.additional_notes) setAdditionalNotes(f.additional_notes as string)
    if (submitSignal > prevSubmitSignal.current && f.seed_customers) {
      prevSubmitSignal.current = submitSignal
      setTimeout(async () => {
        setIsRunning(true)
        setOutput(null)
        try {
          const res = await gtmAgentsApi.runViralityEngine({
            seed_customers: f.seed_customers as string,
            channels: f.channels as string | undefined,
          })
          setOutput(extractResultText(res))
          toast({ title: 'Virality Plan Generated', description: 'Review referral hooks and multi-channel cascades.' })
        } catch (err: any) {
          toast({ title: 'Virality Engine Failed', description: err.message, variant: 'destructive' })
        } finally { setIsRunning(false) }
      }, 80)
    }
  }, [agentForm])

  const handleRun = async () => {
    if (!seedCustomers.trim()) {
      toast({
        title: "Seed customers required",
        description: "List at least one champion customer or persona.",
        variant: "destructive",
      })
      return
    }
    setIsRunning(true)
    setOutput(null)
    try {
      const res = await gtmAgentsApi.runViralityEngine({
        seed_customers: seedCustomers.trim(),
        channels: channels.trim() || undefined,
      })
      setOutput(extractResultText(res))
      toast({
        title: "Virality plan generated",
        description: "Review the referral hooks and multi-channel cascades.",
      })
    } catch (err: any) {
      toast({
        title: "Virality Engine failed",
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
            <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Network className="h-5 w-5" />
            </span>
            Virality Engine
          </CardTitle>
          <CardDescription>
            Design self-propagating referral chains and viral loops around your champions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Seed Customers / Personas
            </label>
            <Input
              value={seedCustomers}
              onChange={(e) => setSeedCustomers(e.target.value)}
              disabled={isRunning}
              className="h-10"
              placeholder="Comma-separated list, e.g. 'Dev tools champions, RevOps leaders'"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Channels
            </label>
            <Input
              value={channels}
              onChange={(e) => setChannels(e.target.value)}
              disabled={isRunning}
              className="h-10"
              placeholder="email, linkedin, slack, in-product"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Additional Notes (optional)
            </label>
            <Textarea
              disabled={isRunning}
              rows={4}
              placeholder="Describe constraints, incentives, or audiences you want to prioritize."
              onChange={() => {
                /* optional free-form context captured by LLM via channels/seed text */
              }}
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
                Engineering viral loop…
              </>
            ) : (
              <>
                <Network className="mr-2 h-4 w-4" />
                Run Virality Engine
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {output && (
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Virality Engine Output</CardTitle>
            <CardDescription>Hooks, cascades, and referral logic suggested by the agent.</CardDescription>
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

