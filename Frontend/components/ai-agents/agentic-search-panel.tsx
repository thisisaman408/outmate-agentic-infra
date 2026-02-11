"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Mail } from "lucide-react"
import { aiAgentsApi, type AgenticSearchResult } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

export function AgenticSearchPanel() {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<AgenticSearchResult[]>([])

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await aiAgentsApi.searchProspects(query)
      setResults(searchResults)
      toast({
        title: "Success",
        description: `Found ${searchResults.length} matching prospects`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search prospects",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Agentic Search
          </CardTitle>
          <CardDescription>Describe your ideal prospect and let AI find the best matches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Find B2B SaaS companies with 100-500 employees that recently raised Series B..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={isSearching}
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isSearching && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-4">
          {results.map((result) => (
            <Card key={result.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{result.companyName}</h3>
                      <Badge variant="default">Score: {result.score}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.reason}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{result.industry}</Badge>
                      <Badge variant="outline">{result.employees} employees</Badge>
                      <Badge variant="outline">{result.location}</Badge>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{result.contactName}</p>
                      <p className="text-muted-foreground">{result.title}</p>
                      <p className="text-muted-foreground">{result.email}</p>
                    </div>
                  </div>
                  <Button>
                    <Mail className="mr-2 h-4 w-4" />
                    Add to Campaign
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
