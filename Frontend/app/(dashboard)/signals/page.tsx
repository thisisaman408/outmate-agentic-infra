"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search as SearchIcon, Zap } from "lucide-react"
import { signalsApi, type Signal } from "@/lib/api/signals"

export default function SignalsPage() {
  const [searchType, setSearchType] = useState<"business" | "prospect">("business")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Signal[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleInputChange = async (value: string) => {
    setSearchQuery(value)
    if (value.length > 1) {
      try {
        const suggs = await signalsApi.autocomplete(value)
        setSuggestions(suggs)
        setShowSuggestions(true)
      } catch (error) {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion)
    setShowSuggestions(false)
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setHasSearched(false)
    setShowSuggestions(false)
    try {
      const results = await signalsApi.searchEntitySignals(searchType, searchQuery, searchQuery)
      setSearchResults(results)
      setHasSearched(true)
    } catch (error) {
      console.error("Search failed:", error)
      setSearchResults([])
      setHasSearched(true)
    } finally {
      setIsSearching(false)
    }
  }

  const groupedSignals = useMemo(() => {
    const groups: Record<string, Signal[]> = {}
    searchResults.forEach(signal => {
      const key = signal.type
      if (!groups[key]) groups[key] = []
      groups[key].push(signal)
    })
    return groups
  }, [searchResults])

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.5em] text-primary">Signals</p>
        <h1 className="text-4xl font-bold leading-tight">Discover Comprehensive Signals</h1>
        <p className="text-muted-foreground max-w-3xl">
          Search for businesses or prospects and discover comprehensive signals using Explorium's data—intent topics, firmographics, website traffic, business challenges, and financial indicators.
        </p>
      </header>

      <section className="space-y-4">
        <Card className="border border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5" />
              Search for Signals
            </CardTitle>
            <CardDescription>
              Enter a business name/domain or prospect name/company to discover relevant signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative flex gap-4">
              <Select value={searchType} onValueChange={(value: "business" | "prospect") => setSearchType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder={`Enter ${searchType} name or domain`}
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {Object.keys(groupedSignals).length > 0 && (
        <section className="space-y-6">
          {Object.entries(groupedSignals).map(([type, signals]) => (
            <div key={type} className="space-y-4">
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.4em] text-muted-foreground">
                <Zap className="h-4 w-4 text-secondary" />
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Signals ({signals.length})
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {signals.map((signal, index) => (
                  <Card key={`${signal.id}-${index}`} className="border border-border/60">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{signal.title}</CardTitle>
                        <div className="flex gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {signal.impact}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {signal.confidence}%
                          </span>
                        </div>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground">
                        {signal.companyName} · {signal.source} · {signal.timestamp}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm">{signal.description}</CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {hasSearched && !isSearching && searchResults.length === 0 && searchQuery && (
        <section className="space-y-4">
          <Card className="border border-border/60">
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No signals found for "{searchQuery}". Try a different search term.</p>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}
