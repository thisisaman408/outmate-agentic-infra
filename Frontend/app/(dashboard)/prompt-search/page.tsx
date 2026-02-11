"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Search, Sparkles, Save, History, TrendingUp, Loader2, Users, Building2, DollarSign } from "lucide-react"

export default function PromptSearchPage() {
  const [prompt, setPrompt] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<any>(null)

  const recentPrompts = [
    "Find SaaS companies in the USA with 50-500 employees that recently adopted Salesforce",
    "Show me fintech startups that raised Series B in the last 6 months",
    "Who are VPs of Marketing in healthcare companies hiring SDRs?",
  ]

  const handleSearch = async () => {
    setIsSearching(true)
    setTimeout(() => {
      setResults({
        count: 847,
        cost: 42,
        preview: [
          { name: "DataFlow Inc", employees: "150-200", revenue: "$20M", location: "Austin, TX", score: 96 },
          { name: "CloudSync", employees: "100-150", revenue: "$15M", location: "Boston, MA", score: 94 },
          { name: "MetricPro", employees: "200-300", revenue: "$35M", location: "Denver, CO", score: 92 },
        ],
        filters: {
          industry: "SaaS",
          employees: "50-500",
          location: "USA",
          techStack: ["Salesforce"],
          signals: ["Tech Adoption"],
        },
      })
      setIsSearching(false)
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prompt-Native Search</h1>
        <p className="text-muted-foreground">Search your TAM with natural language - no complex filters needed</p>
      </div>

      <Card className="glass-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Search
          </CardTitle>
          <CardDescription>Describe what you're looking for in plain English - AI handles the rest</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Example: Find me 1,000 B2B SaaS companies in North America with 50-200 employees, using HubSpot, that raised Series B funding in the last 12 months and are hiring sales leaders..."
            className="min-h-[140px] resize-none text-base"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <History className="mr-2 h-4 w-4" />
                Recent
              </Button>
              <Button variant="outline" size="sm">
                <Save className="mr-2 h-4 w-4" />
                Saved
              </Button>
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !prompt} size="lg">
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Search Database
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results && (
        <>
          <Card className="glass-card border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Search Results</p>
                  <p className="text-4xl font-bold text-primary">{results.count.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">companies match your criteria</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Estimated Cost</p>
                  <p className="text-2xl font-bold">{results.cost} credits</p>
                  <Button className="mt-3" size="sm">
                    Pull All Results
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>AI-Generated Filters</CardTitle>
              <CardDescription>These filters were automatically created from your prompt</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-sm py-2 px-3">
                  <Building2 className="mr-2 h-4 w-4" />
                  Industry: {results.filters.industry}
                </Badge>
                <Badge variant="secondary" className="text-sm py-2 px-3">
                  <Users className="mr-2 h-4 w-4" />
                  Employees: {results.filters.employees}
                </Badge>
                <Badge variant="secondary" className="text-sm py-2 px-3">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Location: {results.filters.location}
                </Badge>
                {results.filters.techStack.map((tech: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-sm py-2 px-3">
                    Tech: {tech}
                  </Badge>
                ))}
                {results.filters.signals.map((signal: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-sm py-2 px-3">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {signal}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Preview Results</CardTitle>
              <CardDescription>
                Sample of {results.preview.length} companies from {results.count.toLocaleString()} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.preview.map((company: any, i: number) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{company.name}</h3>
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        Score: {company.score}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Employees: </span>
                        <span className="font-medium">{company.employees}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Revenue: </span>
                        <span className="font-medium">{company.revenue}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Location: </span>
                        <span className="font-medium">{company.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Button className="flex-1">Export All {results.count.toLocaleString()} Companies</Button>
                <Button variant="outline">Refine Search</Button>
                <Button variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Prompts
          </CardTitle>
          <CardDescription>Quick access to your previous searches</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentPrompts.map((recentPrompt, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-card/50 p-4 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setPrompt(recentPrompt)}
              >
                <p className="text-sm">{recentPrompt}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
