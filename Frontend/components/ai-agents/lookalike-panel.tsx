"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Users, Loader2, Target, BarChart3, MapPin, Building2, Layers, Search, PlusCircle, X } from "lucide-react"
import { aiAgentsApi, type LookalikeResult } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function SimulatedActivityFeed({ isActive }: { isActive: boolean }) {
  const [messages, setMessages] = useState<string[]>([])
  const allMessages = [
    "Analyzing seed firmographics...",
    "Querying global company graph...",
    "Calculating similarity vectors...",
    "Clustering market analogs...",
    "Filtering by tech stack overlap...",
    "Scoring revenue proximity...",
    "Verifying growth velocity...",
    "Rank-ordering lookalike cohort..."
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
    }, 1400)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className="font-mono text-[9px] uppercase tracking-tighter text-purple-400/60 h-10 flex flex-col justify-end">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <motion.div
            key={`${msg}-${idx}`}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            className="flex items-center gap-1.5"
          >
            <div className="h-1 w-1 bg-purple-500 rounded-full animate-pulse" />
            {msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function LookalikePanel() {
  const { toast } = useToast()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<LookalikeResult[]>([])
  const [seedPool, setSeedPool] = useState(["Stripe", "Airbnb", "Notion"])

  const handleAddSeed = () => {
    const candidate = window?.prompt?.("Enter a seed company name to expand the pool:")
    if (candidate && candidate.trim()) {
    setSeedPool((prev) => [...prev, candidate.trim()])
      toast({
        title: "Seed Added",
        description: `${candidate.trim()} added to the seed pool.`,
      })
    }
  }

  const handleFindLookalikes = async () => {
    setIsAnalyzing(true)
    setResults([])
    try {
    const seedCompanies = seedPool.map((seed, idx) => `${seed}-${idx}`)
      const lookalikeResults = await aiAgentsApi.findLookalikeCompanies(seedCompanies)
      setResults(lookalikeResults)
      toast({
        title: "Lookalikes Identified",
        description: `Agent found ${lookalikeResults.length} high-fidelity clones of your seed pool.`,
      })
    } catch (error: any) {
      toast({
        title: "Analysis Failure",
        description: error.message === 'Failed to find lookalikes' ? "Insufficient credits or database issue." : error.message,
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <Card className="glass-effect border-white/5 relative bg-transparent overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Users className="h-48 w-48 text-purple-400" />
        </div>

        <CardHeader className="pb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-black flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Users className="h-6 w-6" />
                </div>
                Lookalike Agent
              </CardTitle>
              <CardDescription className="text-lg font-medium text-muted-foreground/80 max-w-xl">
                Identify market clones by analyzing deep firmographic and technographic patterns of your top customers.
              </CardDescription>
            </div>
            <SimulatedActivityFeed isActive={isAnalyzing} />
          </div>
        </CardHeader>

        <CardContent className="pb-10">
          <div className="p-1 rounded-[2rem] bg-gradient-to-br from-white/10 to-transparent border border-white/5 overflow-hidden">
            <div className="rounded-[1.9rem] bg-black/20 p-8 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap gap-3">
                  {seedPool.map((seed, index) => (
                    <div key={`${seed}-${index}`} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 group hover:border-purple-500/30 transition-all">
                      <div className="h-6 w-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-400">{seed[0]}</div>
                      <span className="text-sm font-bold">{seed}</span>
                      <button
                        type="button"
                        onClick={() => setSeedPool(prev => prev.filter((value, idx) => idx !== index))}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                        title={`Remove ${seed}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddSeed}
                    className="p-2 px-4 rounded-xl border border-dashed border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-muted-foreground/60 hover:text-purple-400 flex items-center gap-2 text-xs font-bold"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Seed Pool
                  </button>
                </div>
                <p className="text-xs font-medium text-muted-foreground">The agent will analyze these seed companies to build a high-dimensional mirror model.</p>
              </div>

              <Button
                onClick={handleFindLookalikes}
                disabled={isAnalyzing}
                className={cn(
                  "h-16 px-12 text-lg font-bold rounded-2xl transition-all duration-300 w-full md:w-auto",
                  isAnalyzing
                    ? "bg-muted"
                    : "bg-purple-600 hover:bg-purple-500 shadow-2xl shadow-purple-500/20"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Profiling...
                  </>
                ) : (
                  <>
                    <Target className="mr-3 h-5 w-5" />
                    Identify Clones
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {isAnalyzing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 4].map((i) => (
                <Card key={i} className="glass-effect border-white/5 bg-transparent p-6 space-y-4">
                  <div className="flex justify-between">
                    <Skeleton className="h-8 w-1/2 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isAnalyzing && results.length > 0 && (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              initial="hidden"
              animate="show"
              variants={{
                show: { transition: { staggerChildren: 0.1 } }
              }}
            >
              {results.map((result) => (
                <motion.div
                  key={result.id}
                  variants={{
                    hidden: { opacity: 0, scale: 0.95, y: 20 },
                    show: { opacity: 1, scale: 1, y: 0 }
                  }}
                >
                  <Card className="glass-effect border-white/5 overflow-hidden group hover:border-purple-500/30 transition-all hover:shadow-2xl hover:shadow-purple-500/5 h-full flex flex-col">
                    <CardContent className="p-8 space-y-6 flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-xl group-hover:scale-110 transition-transform">
                            {result.companyName[0]}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold tracking-tight mb-1">{result.companyName}</h3>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-xs text-muted-foreground/60 font-medium">{result.location}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-purple-400 leading-none">{result.similarityScore}%</div>
                          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">Similarity</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Progress value={result.similarityScore} className="h-1.5 bg-white/5 overflow-hidden rounded-full">
                          <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${result.similarityScore}%` }} />
                        </Progress>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Core Matching Vectors</p>
                        <div className="flex flex-wrap gap-2">
                    {result.matchingFactors.map((factor) => (
                            <Badge key={factor} className="bg-white/5 hover:bg-purple-500/10 text-muted-foreground hover:text-purple-400 border-white/5 transition-colors font-bold px-3 py-1 rounded-lg">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground/40 font-bold uppercase text-[9px] tracking-widest">
                            <Layers className="h-3 w-3" />
                            Industry
                          </div>
                          <p className="text-sm font-bold text-muted-foreground/80 truncate">{result.industry}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground/40 font-bold uppercase text-[9px] tracking-widest">
                            <Building2 className="h-3 w-3" />
                            Revenue
                          </div>
                          <p className="text-sm font-bold text-muted-foreground/80">{result.revenue || "Tiers A-C"}</p>
                        </div>
                      </div>
                    </CardContent>

                    <button className="w-full py-5 bg-white/5 hover:bg-purple-600 hover:text-white transition-all text-xs font-black uppercase tracking-[0.2em] border-t border-white/5 text-muted-foreground">
                      Add to Pipeline Cohort
                    </button>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
