"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Globe, Download, Plus, History, Link, FileText, AlertCircle, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { WebFilterSidebar } from "@/components/leads/web/web-filter-sidebar"
import { SearchResultCard } from "@/components/leads/web/search-result-card"
import { FetchResultCard } from "@/components/leads/web/fetch-result-card"
import { Badge } from "@/components/ui/badge"

// ──────────────────────────────────────────────
// Types  (mirrors Pydantic response models in web_routes.py)
// ──────────────────────────────────────────────
interface SearchResult {
  id: string
  query_id: string
  rank: number
  title: string
  url: string
  snippet: string
  domain: string
  saved: boolean
  searched_at: string
}

interface SearchQueryResponse {
  id: string
  query: string
  status: string
  result_count: number
  response_time: number | null
  executed_at: string | null
  created_at: string
  results?: SearchResult[]
}

interface FetchResult {
  id: string
  url: string
  title: string
  status: "success" | "failed" | "pending" | "timeout"
  content_length: number
  response_time: number | null
  saved: boolean
  fetched_at: string
  error: string | null
}

interface BatchFetchResponse {
  id: string
  urls: string[]
  status: string
  success_count: number
  failed_count: number
  total_time: number | null
  results: FetchResult[]
}

// ──────────────────────────────────────────────
// API layer
// ──────────────────────────────────────────────
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init
  })
  if (res.status === 204) return null as unknown as T
  const body = await res.json()
  if (!res.ok) throw new Error(body.detail ?? res.statusText)
  return body as T
}

const api = {
  // search
  search:        (query: string, limit = 10, filters?: Record<string, unknown>) => req<SearchQueryResponse>("/api/web/search", { method: "POST", body: JSON.stringify({ query, limit, filters }) }),
  searchHistory: (days = 7, limit = 50)  => req<SearchQueryResponse[]>(`/api/web/search/history?days=${days}&limit=${limit}`),
  savedSearches: (limit = 50) => req<SearchResult[]>(`/api/web/search/saved?limit=${limit}`),
  saveSearch:    (id: string, saved: boolean) => req<SearchResult>(`/api/web/search/${id}/save?saved=${saved}`, { method: "POST" }),

  // fetch
  fetch:         (urls: string[], options?: Record<string,unknown>) => req<BatchFetchResponse>("/api/web/fetch", { method: "POST", body: JSON.stringify({ urls, options }) }),
  fetchList: (status?: string, limit = 50) => {
    // Build query string properly
    const params = new URLSearchParams();
    if (status) {
      params.set("status", status);
    }
    params.set("limit", limit.toString());

    const queryString = params.toString();
    const path = queryString ? `/api/web/fetch?${queryString}` : "/api/web/fetch";

    return req<FetchResult[]>(path);
  },
  saveFetch:     (id: string, saved: boolean)=> req<FetchResult>(`/api/web/fetch/${id}/save?saved=${saved}`, { method: "POST" }),
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function WebPage() {
  const [activeTab, setActiveTab] = useState<"search"|"fetch">("search")
  const [input, setInput] = useState("")                 // shared input box

  // ── search state ────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // ── fetch state ─────────────────────────────────────────
  const [fetchResults, setFetchResults] = useState<FetchResult[]>([])
  const [fetchLoading, setFetchLoading] = useState(false)

  // shared
  const [error, setError] = useState<string | null>(null)

  // ── initial load: pull history + previous fetches ───────
  const loadHistory = useCallback(async () => {
    setSearchLoading(true)
    setFetchLoading(true)
    setError(null)
    try {
      // search: flatten all results from recent queries
      const queries = await api.searchHistory(7, 20)
      const allResults: SearchResult[] = queries.flatMap(q => q.results ?? [])
      setSearchResults(allResults)

      // fetch: list previous fetches
      const fetches = await api.fetchList(undefined, 50)
      setFetchResults(fetches)
    } catch (e) { setError((e as Error).message) }
    finally {
      setSearchLoading(false)
      setFetchLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // ── execute search ────────────────────────────────────────
  const handleSearch = async () => {
    if (!input.trim()) return
    setSearchLoading(true); setError(null)
    try {
      const resp = await api.search(input.trim())
      setSearchResults(prev => [...(resp.results ?? []), ...prev])
    } catch (e) { setError((e as Error).message) }
    finally { setSearchLoading(false) }
  }

  // ── execute fetch ─────────────────────────────────────────
  const handleFetch = async () => {
    if (!input.trim()) return
    const urls = input.split(",").map(u => u.trim()).filter(Boolean)
    if (urls.length === 0) return
    if (urls.length > 10) { setError("Maximum 10 URLs per batch"); return }
    setFetchLoading(true); setError(null)
    try {
      const resp = await api.fetch(urls)
      setFetchResults(prev => [...resp.results, ...prev])
    } catch (e) { setError((e as Error).message) }
    finally { setFetchLoading(false) }
  }

  // ── save toggle (search) ──────────────────────────────────
  const handleToggleSearchSave = async (result: SearchResult) => {
    const next = !result.saved
    // optimistic
    setSearchResults(prev => prev.map(r => r.id === result.id ? { ...r, saved: next } : r))
    try {
      await api.saveSearch(result.id, next)
    } catch (e) {
      setSearchResults(prev => prev.map(r => r.id === result.id ? { ...r, saved: !next } : r))
      setError((e as Error).message)
    }
  }

  // ── save toggle (fetch) ───────────────────────────────────
  const handleToggleFetchSave = async (result: FetchResult) => {
    const next = !result.saved
    setFetchResults(prev => prev.map(r => r.id === result.id ? { ...r, saved: next } : r))
    try {
      await api.saveFetch(result.id, next)
    } catch (e) {
      setFetchResults(prev => prev.map(r => r.id === result.id ? { ...r, saved: !next } : r))
      setError((e as Error).message)
    }
  }

  // ── submit dispatcher ─────────────────────────────────────
  const handleSubmit = () => activeTab === "search" ? handleSearch() : handleFetch()

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSubmit() }

  // ── counts ────────────────────────────────────────────────
  const searchCount = searchResults.length
  const fetchCount  = fetchResults.filter(r => r.status === "success").length

  // ── render ────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <WebFilterSidebar activeTab={activeTab} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/5">
        <div className="flex-1 overflow-y-auto">

          {/* sticky header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Globe className="h-8 w-8 text-primary" /> Web Intelligence
                  </h1>
                  <p className="text-muted-foreground mt-1 text-lg">
                    Search the web and fetch content for market research and competitive intelligence.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="gap-2 bg-background" onClick={loadHistory}>
                    <RefreshCw className="h-4 w-4" /> Refresh
                  </Button>
                  <Button variant="outline" className="gap-2 bg-background">
                    <History className="h-4 w-4" /> History
                  </Button>
                  <Button variant="outline" className="gap-2 bg-background">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </div>
              </div>

              {/* input bar — adapts label/icon per tab */}
              <div className="relative max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={activeTab === "search" ? "Search the web…" : "Enter URLs to fetch (comma separated, max 10)"}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  className="pl-10 h-12 text-base bg-background/50 border-border/60 focus-visible:ring-primary pr-28"
                />
                <Button
                  className="absolute right-1 top-1/2 -translate-y-1/2 gap-2 bg-primary hover:bg-primary/90"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!input.trim() || (activeTab === "search" ? searchLoading : fetchLoading)}
                >
                  {activeTab === "search" ? (
                    <><Search className="h-4 w-4" /> Search</>
                  ) : (
                    <><Link className="h-4 w-4" /> Fetch</>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* error banner */}
          {error && (
            <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/8 p-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 flex-1">{error}</p>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-500/10" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          )}

          {/* tabs */}
          <div className="p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab as (v: string) => void} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="search" className="gap-2">
                  <Search className="h-4 w-4" /> Web Search
                  <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{searchCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="fetch" className="gap-2">
                  <FileText className="h-4 w-4" /> Web Fetch
                  <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary">{fetchCount}</Badge>
                </TabsTrigger>
              </TabsList>

              {/* ── Search tab ─────────────────────────────── */}
              <TabsContent value="search" className="mt-0">
                {searchLoading && searchResults.length === 0 ? (
                  <SearchSkeleton />
                ) : searchResults.length === 0 ? (
                  <EmptyState 
                    icon={Search} 
                    title="Start searching the web"
                    description="Use the search bar above to find relevant articles, news, and research. Results include title, URL, snippet, and ranking." 
                  />
                ) : (
                  <div className="space-y-3">
                    {searchResults.map(r => (
                      <SearchResultCard
                        key={r.id}
                        result={{
                          ...r,
                          query: "",                           // history endpoint doesn't nest query string per-result
                          searchedAt: new Date(r.searched_at)
                        }}
                        onSaveToggle={() => handleToggleSearchSave(r)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Fetch tab ──────────────────────────────── */}
              <TabsContent value="fetch" className="mt-0">
                {fetchLoading && fetchResults.length === 0 ? (
                  <FetchSkeleton />
                ) : fetchResults.length === 0 ? (
                  <EmptyState 
                    icon={FileText} 
                    title="Fetch web page content"
                    description="Enter up to 10 URLs to fetch HTML content, extract text, and parse metadata. Perfect for competitive analysis." 
                  />
                ) : (
                  <div className="space-y-3">
                    {fetchResults.map(r => (
                      <FetchResultCard
                        key={r.id}
                        result={{
                          ...r,
                          htmlContent: null,
                          textContent: null,
                          contentLength: r.content_length,
                          fetchedAt: new Date(r.fetched_at),
                          responseTime: r.response_time ?? 0,
                          metadata: undefined
                        }}
                        onSaveToggle={() => handleToggleFetchSave(r)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Skeletons
// ──────────────────────────────────────────────
function SearchSkeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <Card key={i} className="p-4 animate-pulse border-border/60">
          <div className="flex gap-3">
            <div className="h-5 w-5 rounded bg-muted flex-shrink-0 mt-1" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/4 rounded bg-muted" />
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function FetchSkeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3].map(i => (
        <Card key={i} className="p-4 animate-pulse border-border/60">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <div className="h-5 w-16 rounded bg-muted" />
            <div className="h-5 w-16 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
          <div className="h-16 w-full rounded bg-muted mt-3" />
        </Card>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────
function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{className?: string}>, title: string, description: string }) {
  return (
    <Card className="p-12 border-border/60 shadow-sm bg-card/80 backdrop-blur-sm">
      <div className="text-center space-y-4 max-w-md mx-auto">
        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </Card>
  )
}