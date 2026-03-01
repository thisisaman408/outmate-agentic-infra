"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { gtmAgentsApi } from "@/lib/api/gtm-agents"
import { Loader2, Target, Globe2, Sparkles } from "lucide-react"

export function CrossfirePanel() {
  const { toast } = useToast()
  const [competitorDomain, setCompetitorDomain] = useState("")
  const [targetRegion, setTargetRegion] = useState("")
  const [notes, setNotes] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const handleRun = async () => {
    if (!competitorDomain.trim()) {
      toast({
        title: "Competitor required",
        description: "Please enter a primary competitor domain (e.g. apollo.io).",
        variant: "destructive",
      })
      return
    }

    setIsRunning(true)
    setOutput(null)
    try {
      const res = await gtmAgentsApi.runCrossfire({
        competitor_domain: competitorDomain.trim(),
        target_region: targetRegion.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setOutput(JSON.stringify(res, null, 2))
      toast({
        title: "Crossfire deployed",
        description: "Competitive intelligence run completed.",
      })
    } catch (err: any) {
      toast({
        title: "Crossfire failed",
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <Target className="h-5 w-5" />
                </span>
                Crossfire Agent
              </CardTitle>
              <CardDescription className="mt-1">
                Competitive intelligence warfare: identify stealable accounts and poaching sequences.
              </CardDescription>
            </div>
            <Sparkles className="h-6 w-6 text-rose-400/60 hidden sm:block" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Competitor Domain
              </label>
              <Input
                placeholder="e.g. apollo.io"
                value={competitorDomain}
                onChange={(e) => setCompetitorDomain(e.target.value)}
                disabled={isRunning}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Globe2 className="h-3 w-3" />
                Target Region (optional)
              </label>
              <Input
                placeholder="e.g. US, EU, Global"
                value={targetRegion}
                onChange={(e) => setTargetRegion(e.target.value)}
                disabled={isRunning}
                className="h-11"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Extra Context (ICP, pipeline, segments)
            </label>
            <Textarea
              placeholder="Describe your ICP or any constraints (e.g. ARR bands, segments you care about)."
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isRunning}
            />
          </div>
          <Button
            onClick={handleRun}
            disabled={isRunning}
            className="mt-2 w-full md:w-auto h-11 font-semibold rounded-xl"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Crossfire…
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Run Crossfire
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {output && (
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Crossfire Output</CardTitle>
            <CardDescription>Raw structured response from the GTM agent.</CardDescription>
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

