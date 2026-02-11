"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, Loader2 } from "lucide-react"
import { aiAgentsApi, type LookalikeResult } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export function LookalikePanel() {
  const { toast } = useToast()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<LookalikeResult[]>([])

  const handleFindLookalikes = async () => {
    setIsAnalyzing(true)
    try {
      // In production, user would select seed companies
      const seedCompanies = ["1", "2", "3"]
      const lookalikeResults = await aiAgentsApi.findLookalikeCompanies(seedCompanies)
      setResults(lookalikeResults)
      toast({
        title: "Success",
        description: `Found ${lookalikeResults.length} similar companies`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to find lookalike companies",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Lookalike Agent
          </CardTitle>
          <CardDescription>Find companies similar to your best customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground mb-3">
              In production, you would select your top-performing customers as seed companies.
            </p>
            <Button onClick={handleFindLookalikes} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Find Similar Companies"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAnalyzing && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!isAnalyzing && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <Card key={result.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{result.companyName}</h3>
                    <Badge variant="default" className="text-base">
                      {result.similarityScore}% match
                    </Badge>
                  </div>
                  <Progress value={result.similarityScore} className="h-2" />
                  <div>
                    <p className="text-sm font-medium mb-2">Matching Factors:</p>
                    <div className="flex flex-wrap gap-2">
                      {result.matchingFactors.map((factor) => (
                        <Badge key={factor} variant="secondary">
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Industry</p>
                      <p className="font-medium">{result.industry}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Employees</p>
                      <p className="font-medium">{result.employees}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{result.location}</p>
                    </div>
                    {result.revenue && (
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-medium">{result.revenue}</p>
                      </div>
                    )}
                  </div>
                  <Button className="w-full">Add to Pipeline</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
