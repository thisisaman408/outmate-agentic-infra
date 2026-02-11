"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { aiAgentsApi, type ResearchResult } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"

export function ResearchPanel() {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState("")
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard")
  const [isResearching, setIsResearching] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)

  const handleResearch = async () => {
    if (!companyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a company name",
        variant: "destructive",
      })
      return
    }

    setIsResearching(true)
    try {
      const researchResult = await aiAgentsApi.researchCompany(companyName, depth)
      setResult(researchResult)
      toast({
        title: "Success",
        description: "Company research completed",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to research company",
        variant: "destructive",
      })
    } finally {
      setIsResearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Research Agent
          </CardTitle>
          <CardDescription>Get comprehensive insights about any company</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="TechCorp Solutions"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResearch()}
                disabled={isResearching}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depth">Research Depth</Label>
              <Select value={depth} onValueChange={(value: any) => setDepth(value)}>
                <SelectTrigger id="depth" disabled={isResearching}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick (30s)</SelectItem>
                  <SelectItem value="standard">Standard (1-2 min)</SelectItem>
                  <SelectItem value="deep">Deep (3-5 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleResearch} disabled={isResearching} className="w-full">
            {isResearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Research Company
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && !isResearching && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{result.companyName}</CardTitle>
              <CardDescription>Company Overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Market Position</h4>
                <p className="text-sm text-muted-foreground">{result.marketPosition}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.keyInsights.map((insight, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.opportunities.map((opp, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {opp}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.risks.map((risk, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {risk}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent News</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.recentNews.map((news, index) => (
                  <li key={index} className="text-sm border-l-2 border-primary pl-3">
                    {news}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Competitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.competitors.map((competitor) => (
                  <Badge key={competitor} variant="outline">
                    {competitor}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
