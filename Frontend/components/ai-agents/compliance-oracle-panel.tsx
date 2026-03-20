"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { gtmAgentsApi, type GTMAgentRunResponse } from "@/lib/api/gtm-agents"

function extractResultText(res: GTMAgentRunResponse): string {
  if (res.result && typeof res.result === "string") return res.result
  if (res.results) return typeof res.results === "string" ? res.results : JSON.stringify(res.results, null, 2)
  const keys = Object.keys(res).filter(k => k !== "result" && k !== "results")
  if (keys.length > 0) return keys.map(k => `${k}: ${JSON.stringify(res[k])}`).join("\n\n")
  return "Agent completed — no output returned."
}

export function ComplianceOraclePanel() {
  const { toast } = useToast()
  const [template, setTemplate] = useState("")
  const [jurisdictions, setJurisdictions] = useState("US, EU, UK")
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [lastClickAt, setLastClickAt] = useState<string | null>(null)

  const handleRun = async () => {
    setClickCount((prev) => prev + 1)
    setLastClickAt(new Date().toLocaleTimeString())
    if (!template.trim()) {
      setInlineError("Paste the outbound copy to analyze.")
      toast({
        title: "Message required",
        description: "Paste the outbound copy you want the Compliance Oracle to review and rewrite.",
        variant: "destructive",
      })
      return
    }
    setInlineError(null)
    setIsRunning(true)
    setOutput(null)
    try {
      const res = await gtmAgentsApi.runComplianceOracle({
        message_template: template.trim(),
        jurisdictions: jurisdictions.trim() || undefined,
      })
      setOutput(extractResultText(res))
      toast({
        title: "Compliance analysis complete",
        description: "Review the suggested compliant version and risk notes.",
      })
    } catch (err: any) {
      toast({
        title: "Compliance Oracle failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-effect border-white/10 pointer-events-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="h-5 w-5" />
            </span>
            Compliance Oracle
          </CardTitle>
          <CardDescription>
            Check and rewrite your sequences for global outreach compliance without killing performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pointer-events-auto">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Jurisdictions
            </label>
            <Input
              value={jurisdictions}
              onChange={(e) => setJurisdictions(e.target.value)}
              disabled={isRunning}
              className="h-10"
              placeholder="US, EU, UK, CA, APAC"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Outbound Message / Sequence
            </label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={isRunning}
              rows={7}
              placeholder="Paste your cold email, LinkedIn sequence, or multi-step outreach here..."
            />
            {inlineError && (
              <p className="text-xs text-red-500">{inlineError}</p>
            )}
          </div>
          <Button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="mt-2 w-full md:w-auto h-11 font-semibold rounded-xl pointer-events-auto"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Auditing…
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Run Compliance Oracle
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Clicks: {clickCount} {lastClickAt ? `· Last click ${lastClickAt}` : ""}
          </p>
        </CardContent>
      </Card>

      {output && (
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Compliance Report</CardTitle>
            <CardDescription>Includes rewritten copy and jurisdiction-specific risk notes.</CardDescription>
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

