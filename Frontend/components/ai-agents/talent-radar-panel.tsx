"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { gtmAgentsApi } from "@/lib/api/gtm-agents"
import { Loader2, Radar } from "lucide-react"

export function TalentRadarPanel() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState("")
  const [lookback, setLookback] = useState(90)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)

  const handleRun = async () => {
    if (!accounts.trim()) {
      toast({
        title: "Accounts required",
        description: "List the key accounts you want Talent Radar to monitor.",
        variant: "destructive",
      })
      return
    }
    setIsRunning(true)
    setOutput(null)
    try {
      const res = await gtmAgentsApi.runTalentRadar({
        accounts: accounts.trim(),
        lookback_days: lookback,
      })
      setOutput(JSON.stringify(res, null, 2))
      toast({
        title: "Talent Radar signal map ready",
        description: "Review early churn risk and retention plays.",
      })
    } catch (err: any) {
      toast({
        title: "Talent Radar failed",
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
            <span className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
              <Radar className="h-5 w-5" />
            </span>
            Talent Radar
          </CardTitle>
          <CardDescription>
            Predict churn risk 90 days early from hiring signals and visitor intent drops.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Key Accounts
            </label>
            <Textarea
              value={accounts}
              onChange={(e) => setAccounts(e.target.value)}
              disabled={isRunning}
              rows={4}
              placeholder="Comma-separated list of customers or account descriptors."
            />
          </div>
          <div className="space-y-2 max-w-xs">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Lookback Window (days)
            </label>
            <Input
              type="number"
              min={7}
              max={365}
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value || 90))}
              disabled={isRunning}
              className="h-10"
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
                Scanning signals…
              </>
            ) : (
              <>
                <Radar className="mr-2 h-4 w-4" />
                Run Talent Radar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {output && (
        <Card className="glass-effect border-white/10">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Talent Radar Output</CardTitle>
            <CardDescription>Accounts, risk levels, and retention plays.</CardDescription>
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

