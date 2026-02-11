"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Target, TrendingUp, Zap, AlertCircle, ChevronRight, Award, Activity } from "lucide-react"

export default function ScoringPage() {
  const [selectedAccount, setSelectedAccount] = useState<any>(null)

  const scoredAccounts = [
    {
      id: 1,
      name: "Acme Corp",
      icpScore: 92,
      intentScore: 87,
      compositeScore: 95,
      status: "hot",
      signals: 8,
      reasoning: ["Perfect ICP match", "High buying intent", "Recent funding", "Hiring sales roles"],
    },
    {
      id: 2,
      name: "TechFlow Inc",
      icpScore: 88,
      intentScore: 76,
      compositeScore: 85,
      status: "warm",
      signals: 5,
      reasoning: ["Good ICP fit", "Moderate intent signals", "Tech stack match", "Growing team"],
    },
    {
      id: 3,
      name: "CloudBase",
      icpScore: 78,
      intentScore: 92,
      compositeScore: 88,
      status: "hot",
      signals: 6,
      reasoning: ["Strong intent signals", "Decent ICP fit", "Product launches", "Executive changes"],
    },
  ]

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500"
    if (score >= 75) return "text-yellow-500"
    return "text-orange-500"
  }

  const getStatusBadge = (status: string) => {
    const variants: any = {
      hot: "bg-red-500/10 text-red-500 border-red-500/20",
      warm: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      cold: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    }
    return variants[status] || variants.cold
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Scoring</h1>
        <p className="text-muted-foreground">AI-powered scoring to prioritize your outbound efforts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              ICP Fit Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">86.5</div>
            <p className="text-xs text-muted-foreground mt-1">Average across all leads</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Intent Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">78.2</div>
            <p className="text-xs text-muted-foreground mt-1">Buying window likelihood</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              High Priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">127</div>
            <p className="text-xs text-muted-foreground mt-1">Accounts to action now</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts">Scored Accounts</TabsTrigger>
          <TabsTrigger value="models">Scoring Models</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Top Priority Accounts</CardTitle>
              <CardDescription>Accounts ranked by composite score (ICP fit × Intent × Freshness)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scoredAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="rounded-lg border border-border/50 bg-card/50 p-5 hover:border-primary/30 transition-all cursor-pointer"
                    onClick={() => setSelectedAccount(account)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{account.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusBadge(account.status)}>{account.status.toUpperCase()}</Badge>
                          <span className="text-sm text-muted-foreground">{account.signals} active signals</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getScoreColor(account.compositeScore)}`}>
                          {account.compositeScore}
                        </div>
                        <p className="text-xs text-muted-foreground">Composite Score</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">ICP Fit</span>
                          <span className="text-sm font-medium">{account.icpScore}%</span>
                        </div>
                        <Progress value={account.icpScore} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Intent</span>
                          <span className="text-sm font-medium">{account.intentScore}%</span>
                        </div>
                        <Progress value={account.intentScore} className="h-2" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex gap-2">
                        {account.reasoning.slice(0, 2).map((reason: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm">
                        View Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedAccount && (
            <Card className="glass-card border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Score Breakdown: {selectedAccount.name}
                </CardTitle>
                <CardDescription>Understand why this account scored {selectedAccount.compositeScore}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Scoring Factors</h4>
                    <div className="space-y-3">
                      {selectedAccount.reasoning.map((reason: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <h4 className="font-medium mb-3">Recommended Actions</h4>
                    <div className="space-y-2">
                      <Button className="w-full justify-start">
                        <Activity className="mr-2 h-4 w-4" />
                        Add to High-Priority Campaign
                      </Button>
                      <Button variant="outline" className="w-full justify-start bg-transparent">
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Run Research Agent
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="models">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Custom Scoring Models</CardTitle>
              <CardDescription>Configure scoring logic per team or ICP</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {["Default Model", "Enterprise ICP", "SMB ICP"].map((model, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{model}</h4>
                      <Badge variant="secondary">{i === 0 ? "Active" : "Draft"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Custom weights for ICP fit, intent, and freshness
                    </p>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Scoring Insights</CardTitle>
              <CardDescription>Performance and optimization recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <h4 className="font-medium mb-2">Top Scoring Factors</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Tech Stack Match</span>
                      <Badge>+15 pts avg</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Hiring Signals</span>
                      <Badge>+12 pts avg</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Recent Funding</span>
                      <Badge>+10 pts avg</Badge>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <h4 className="font-medium mb-2">Conversion Rate by Score Band</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>90-100 Score</span>
                      <span className="font-medium text-green-500">42% conversion</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>75-89 Score</span>
                      <span className="font-medium text-yellow-500">28% conversion</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Below 75</span>
                      <span className="font-medium text-orange-500">12% conversion</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
