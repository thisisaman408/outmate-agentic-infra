"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Loader2, ThumbsUp, ThumbsDown, Minus } from "lucide-react"
import { aiAgentsApi, type PredictiveScore } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function PredictivePanel() {
  const { toast } = useToast()
  const [isScoring, setIsScoring] = useState(false)
  const [scores, setScores] = useState<PredictiveScore[]>([])

  const handleScoreLeads = async () => {
    setIsScoring(true)
    try {
      // In production, user would select leads to score
      const leadIds = ["1", "2"]
      const predictiveScores = await aiAgentsApi.scoreLeads(leadIds)
      setScores(predictiveScores)
      toast({
        title: "Success",
        description: `Scored ${predictiveScores.length} leads`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to score leads",
        variant: "destructive",
      })
    } finally {
      setIsScoring(false)
    }
  }

  const getImpactIcon = (impact: "positive" | "negative" | "neutral") => {
    switch (impact) {
      case "positive":
        return <ThumbsUp className="h-4 w-4 text-success" />
      case "negative":
        return <ThumbsDown className="h-4 w-4 text-destructive" />
      case "neutral":
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Predictive Agent
          </CardTitle>
          <CardDescription>Predict conversion likelihood and prioritize your pipeline</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-3">
              In production, you would select leads from your pipeline to score.
            </p>
            <Button onClick={handleScoreLeads} disabled={isScoring}>
              {isScoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scoring Leads...
                </>
              ) : (
                "Score Selected Leads"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isScoring && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {!isScoring && scores.length > 0 && (
        <div className="space-y-4">
          {scores.map((score) => (
            <Card key={score.companyId}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{score.companyName}</h3>
                    <Badge variant={score.conversionLikelihood >= 80 ? "default" : "secondary"} className="text-base">
                      {score.conversionLikelihood}% likely
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conversion Likelihood</span>
                      <span className="font-medium">{score.conversionLikelihood}%</span>
                    </div>
                    <Progress value={score.conversionLikelihood} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Model Confidence</span>
                      <span className="font-medium">{score.confidence}%</span>
                    </div>
                    <Progress value={score.confidence} className="h-2" />
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-3">Contributing Factors:</p>
                    <div className="space-y-2">
                      {score.reasons.map((reason, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {getImpactIcon(reason.impact)}
                            <span>{reason.factor}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-medium",
                                reason.impact === "positive" && "text-success",
                                reason.impact === "negative" && "text-destructive",
                              )}
                            >
                              {reason.weight > 0 ? "+" : ""}
                              {reason.weight}%
                            </span>
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full",
                                  reason.impact === "positive" && "bg-success",
                                  reason.impact === "negative" && "bg-destructive",
                                  reason.impact === "neutral" && "bg-muted-foreground",
                                )}
                                style={{ width: `${Math.abs(reason.weight) * 4}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm font-medium mb-1">Recommendation</p>
                    <p className="text-sm text-muted-foreground">{score.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
