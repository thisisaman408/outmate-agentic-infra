"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, Mail, Users, MapPin, Briefcase, ChevronRight, Zap, Download } from "lucide-react"
import { aiAgentsApi, type AgenticSearchResult } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { exportToCSV } from "@/lib/export-csv"

function SimulatedActivityFeed({ isActive }: { isActive: boolean }) {
  const [messages, setMessages] = useState<string[]>([])
  const allMessages = [
    "Mapping persona parameters...",
    "Scanning unified B2B database...",
    "Filtering by recent funding rounds...",
    "Verifying tech stack compatibility...",
    "Calculating ICP match scores...",
    "Predicting stakeholder accessibility...",
    "Validating contact deliverability...",
    "Ranking results by relevance..."
  ]

  useEffect(() => {
    if (!isActive) {
      setMessages([])
      return
    }

    let i = 0
    const interval = setInterval(() => {
      if (i < allMessages.length) {
        setMessages(prev => [...prev.slice(-3), allMessages[i]])
        i++
      } else {
        clearInterval(interval)
      }
    }, 1200)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className="font-mono text-[9px] uppercase tracking-tighter text-blue-400/60 h-12 flex flex-col justify-end">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, index) => (
          <motion.div
            key={`${msg}-${index}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1"
          >
            <span className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
            {msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function AgenticSearchPanel() {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<AgenticSearchResult[]>([])
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)

  const getCardKey = (result: AgenticSearchResult, idx: number) =>
    `${result.id ?? `record-${idx}`}-${idx}`

  const activeRecord = activeRecordId
    ? results.find((result, idx) => getCardKey(result, idx) === activeRecordId)
    : null

  const handleSearch = async () => {
    if (!query.trim()) {
      toast({
        title: "Query Required",
        description: "Please specify your target prospect persona.",
        variant: "destructive",
      })
      return
    }

    setIsSearching(true)
    setResults([])
      try {
        const searchResults = await aiAgentsApi.searchProspects(query)
        console.log("Agentic search response", searchResults)
        setResults(searchResults)
        setActiveRecordId(null)
        toast({
        title: "Search Complete",
        description: `Agent identified ${searchResults.length} high-confidence prospects.`,
      })
    } catch (error: any) {
      toast({
        title: "Search Interrupt",
        description: error.message === 'Failed to search prospects' ? "Insufficient credits or database issue." : error.message,
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <Card className="glass-effect border-white/5 relative overflow-hidden bg-transparent">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Sparkles className="h-48 w-48 text-blue-400" />
        </div>

        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-3xl font-black flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Sparkles className="h-6 w-6" />
                </div>
                Agentic Search
              </CardTitle>
              <CardDescription className="text-lg font-medium text-muted-foreground/80">
                Natural-language discovery for hyper-targeted lead generation.
              </CardDescription>
            </div>
            <SimulatedActivityFeed isActive={isSearching} />
          </div>
        </CardHeader>

        <CardContent className="pb-8">
          <div className="relative group p-1 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/5 border border-white/10 transition-all focus-within:border-blue-500/50 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="Find sales leaders at Series B startups in SF with >20% headcount growth..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={isSearching}
                  className="h-16 text-lg border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/40 pl-6 rounded-2xl"
                />
                <div className="absolute right-4 top-5 flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-muted-foreground/50 border border-white/5">
                  <Zap className="h-3 w-3" />
                  POWERED BY GPT-4O
                </div>
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className={cn(
                  "h-16 px-10 text-lg font-bold rounded-2xl transition-all duration-300",
                  isSearching
                    ? "bg-muted"
                    : "bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/20"
                )}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    Deploy Agent
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 px-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-2 my-auto">Suggestions:</span>
            {["Series B SaaS", "Remote Sales VPs", "Recent Funding", "Hiring Product Mgrs"].map(tag => (
              <button
                key={tag}
                onClick={() => setQuery(`Find companies that match: ${tag}`)}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/5 border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all transition-colors text-muted-foreground hover:text-blue-400"
              >
                {tag}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {isSearching && (
            <motion.div
              key="searching-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-4"
            >
              {[1, 2, 3].map((i) => (
                <Card key={i} className="glass-effect border-white/5 bg-transparent p-8">
                  <div className="flex items-center gap-6">
                    <Skeleton className="h-20 w-20 rounded-2xl" />
                    <div className="space-y-4 flex-1">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}

          {!isSearching && results.length > 0 && (
            <div key="agentic-export" className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{results.length} Prospects Found</p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-white/10 hover:border-blue-500/30"
                onClick={() => {
                  const headers = ["Company Name", "Score", "Contact Name", "Title", "Email", "Location", "Industry", "Employees", "Reason"]
                  const rows = results.map(r => [
                    r.companyName || "", String(r.score ?? ""), r.contactName || "", r.title || "",
                    r.email || "", r.location || "", r.industry || "", r.employees || "", r.reason || ""
                  ])
                  exportToCSV(`agentic_search_export_${new Date().toISOString().split('T')[0]}.csv`, headers, rows)
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <motion.div
              key="results-list"
              className="grid gap-6"
              variants={{
                show: { transition: { staggerChildren: 0.1 } }
              }}
              initial="hidden"
              animate="show"
            >
              {results.map((result, idx) => {
                const cardKey = getCardKey(result, idx)
                const isActiveCard = activeRecordId === cardKey
                const contactName = result.contactName?.trim() || "Not found"
                const contactTitle = result.title?.trim() || "N/A"
                const rawEmail = result.email?.trim() || ""
                const contactEmail = rawEmail || "Email not available"
                const employeesLabel = result.employees?.trim()
                const companyName = result.companyName?.trim() || "Unnamed company"
                const matchScore = result.score ?? 0
                const locationLabel = result.location?.trim() || "Location not specified"
                const reasonText = result.reason?.trim() || "No reasoning provided yet."
                const industryLabel = result.industry || "Industry Unknown"
                const initialLetter = (companyName.charAt(0) || "?").toUpperCase()
                const engagedHref = rawEmail.includes("@") ? `mailto:${rawEmail}` : undefined

                return (
                  <motion.div
                    key={cardKey}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 }
                    }}
                  >
                    <Card className="glass-effect border-white/5 overflow-hidden active:scale-[0.99] transition-transform hover:shadow-2xl hover:shadow-blue-500/5 hover:border-white/10 cursor-default group">
                      <CardContent className="p-0">
                        <div className="flex flex-col lg:flex-row">
                          <div className="p-8 flex-1 space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-2xl group-hover:scale-110 transition-transform">
                                  {initialLetter}
                                </div>
                                <div>
                                  <h3 className="text-2xl font-black tracking-tight">{companyName}</h3>
                                  <div className="flex items-center gap-3 mt-1 sm:mt-0">
                                    <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-0 font-bold px-3">
                                      Match Score: {matchScore}%
                                    </Badge>
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                      <MapPin className="h-3 w-3" />
                                      {locationLabel}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {engagedHref ? (
                                <a
                                  href={engagedHref}
                                  className="rounded-xl px-6 h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-foreground transition-all inline-flex items-center justify-center gap-2"
                                >
                                  <Mail className="mr-2 h-4 w-4" />
                                  Engage Now
                                </a>
                              ) : (
                                <span className="rounded-xl px-6 h-12 bg-muted/70 border border-white/10 text-muted-foreground flex items-center justify-center gap-2">
                                  <Mail className="mr-2 h-4 w-4" />
                                  Email not available
                                </span>
                              )}
                            </div>

                            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 relative">
                              <div className="absolute top-3 right-4">
                                <Sparkles className="h-4 w-4 text-blue-400/30" />
                              </div>
                              <p className="text-sm text-blue-300 leading-relaxed pr-8">
                                <span className="font-black text-[10px] uppercase tracking-widest mr-2 opacity-50">Agent Reasoning:</span>
                                {reasonText}
                              </p>
                              {result.perplexityDetails && (
                                <p className="mt-3 text-xs text-blue-100 leading-relaxed line-clamp-3">
                                  <span className="font-bold uppercase tracking-[0.3em] text-white/70 mr-2">Perplexity:</span>
                                  {result.perplexityDetails}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-8 py-2 border-y border-white/5">
                              <div className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground/60" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{industryLabel}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground/60" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{employeesLabel} Employees</span>
                              </div>
                            </div>
                          </div>

                          <div className="lg:w-80 bg-white/5 p-8 border-l border-white/5 flex flex-col justify-center gap-4">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Target Stakeholder</p>
                              <h4 className="text-lg font-bold leading-tight">{contactName}</h4>
                              <p className="text-sm font-medium text-blue-400/80">{contactTitle}</p>
                            </div>
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20 border border-white/5 hover:border-blue-500/30 transition-colors cursor-pointer group/mail">
                                <Mail className="h-4 w-4 text-muted-foreground group-hover/mail:text-blue-400" />
                                <span className="text-[11px] font-mono text-muted-foreground group-hover/mail:text-foreground line-clamp-1">
                                  {contactEmail}
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors border-t border-white/5 mt-2"
                                onClick={() => setActiveRecordId((prev) => (prev === cardKey ? null : cardKey))}
                              >
                                View Intelligence Record
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
          {activeRecord && (
            <motion.div
              key="active-record"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Intelligence Record</p>
                <button
                  className="text-[10px] uppercase tracking-[0.6em] text-muted-foreground hover:text-white transition-colors"
                  onClick={() => setActiveRecordId(null)}
                >
                  Close
                </button>
              </div>
              <h3 className="text-xl font-bold">{activeRecord.companyName || "Unnamed company"}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">{activeRecord.reason}</p>
              {activeRecord.perplexityDetails && (
                <p className="text-sm text-blue-100 line-clamp-3">{activeRecord.perplexityDetails}</p>
              )}
              {activeRecord.perplexityReasoning && (
                <p className="text-[10px] text-muted-foreground">
                  Reasoning details: {JSON.stringify(activeRecord.perplexityReasoning)}
                </p>
              )}
              <pre className="text-xs text-muted-foreground bg-black/40 p-4 rounded-2xl overflow-x-auto">
                {JSON.stringify(activeRecord, null, 2)}
              </pre>
            </motion.div>
          )}
          {!isSearching && results.length === 0 && (
            <motion.div
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 text-muted-foreground text-sm text-center"
            >
              No prospects found yet. The model may still be processing - check the console log for the raw response.
            </motion.div>
          )}
          {!isSearching && results.length > 0 && (
            <motion.div
              key="results-json"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <pre className="text-xs text-muted-foreground bg-black/30 p-4 rounded-2xl overflow-x-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
