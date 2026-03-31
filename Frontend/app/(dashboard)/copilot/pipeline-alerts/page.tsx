"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, AlertTriangle, Plus, Trash2, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { copilotApi, type DealInput } from "@/lib/api/copilot"

const riskColor = (level: string) => {
  if (level === "red") return "destructive"
  if (level === "yellow") return "default"
  return "secondary"
}

const riskLabel = (level: string) => {
  if (level === "red") return "🔴 High Risk"
  if (level === "yellow") return "🟡 Medium Risk"
  return "🟢 Healthy"
}

const emptyDeal = (): DealInput => ({
  company: "",
  stage: "",
  last_activity: new Date().toISOString().split("T")[0],
  value: 0,
})

export default function PipelineAlertsPage() {
  const [deals, setDeals] = useState<DealInput[]>([emptyDeal()])
  const [result, setResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("show") === "latest") {
      try {
        const saved = localStorage.getItem("last_pipeline_result")
        if (saved) setResult(JSON.parse(saved))
      } catch {}
    }
  }, [searchParams])

  const addDeal = () => {
    if (deals.length >= 20) {
      toast({ title: "Limit reached", description: "Maximum 20 deals per scan.", variant: "destructive" })
      return
    }
    setDeals([...deals, emptyDeal()])
  }

  const removeDeal = (i: number) => setDeals(deals.filter((_, idx) => idx !== i))

  const updateDeal = (i: number, field: keyof DealInput, value: string | number) => {
    const updated = [...deals]
    updated[i] = { ...updated[i], [field]: value }
    setDeals(updated)
  }

  const handleScan = async () => {
    const validDeals = deals.filter((d) => d.company && d.stage)
    if (validDeals.length === 0) {
      toast({ title: "No deals", description: "Add at least one deal with company and stage.", variant: "destructive" })
      return
    }
    setIsLoading(true)
    try {
      const data = await copilotApi.scanPipeline(validDeals)
      setResult(data)
      localStorage.setItem("last_pipeline_result", JSON.stringify(data))
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Pipeline scan failed", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const scoreColor = (score: number) =>
    score >= 70 ? "text-green-500" : score >= 40 ? "text-yellow-500" : "text-red-500"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pipeline Risk Alert</h2>
        <p className="text-sm text-muted-foreground">Catch stuck deals before they die</p>
      </div>

      {/* Deal Input Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enter Your Deals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Value ($)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        placeholder="Acme Corp"
                        value={deal.company}
                        onChange={(e) => updateDeal(i, "company", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Proposal"
                        value={deal.stage}
                        onChange={(e) => updateDeal(i, "stage", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={deal.last_activity}
                        onChange={(e) => updateDeal(i, "last_activity", e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="10000"
                        value={deal.value || ""}
                        onChange={(e) => updateDeal(i, "value", parseFloat(e.target.value) || 0)}
                        className="h-8"
                        min={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDeal(i)}
                        disabled={deals.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addDeal}>
              <Plus className="h-4 w-4 mr-1" /> Add Deal
            </Button>
            <Button onClick={handleScan} disabled={isLoading}>
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <AlertTriangle className="h-4 w-4 mr-2" />}
              Detect Risks
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Scanning your pipeline...</span>
          </CardContent>
        </Card>
      )}

      {result && !isLoading && (
        <div className="space-y-4">
          {/* Health Score */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-4xl font-bold ${scoreColor(result.health_score)}`}>
                    {result.health_score}
                  </p>
                  <p className="text-xs text-muted-foreground">Health Score</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{result.risk_summary}</p>
                  {result.total_value_at_risk > 0 && (
                    <p className="text-sm text-red-500 mt-1">
                      ${result.total_value_at_risk.toLocaleString()} at risk
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* At-Risk Deals */}
          {(result.at_risk_deals ?? []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">At-Risk Deals</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Days Stale</TableHead>
                      <TableHead>Risk Level</TableHead>
                      <TableHead>Recommended Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.at_risk_deals.map((deal: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{deal.company}</TableCell>
                        <TableCell>{deal.stage}</TableCell>
                        <TableCell>{deal.days_stale}d</TableCell>
                        <TableCell>
                          <Badge variant={riskColor(deal.risk_level)}>
                            {riskLabel(deal.risk_level)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {deal.recommended_action}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {(result.at_risk_deals ?? []).length === 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="flex items-center gap-3 pt-6">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-700">All deals are healthy — no immediate risks detected.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
