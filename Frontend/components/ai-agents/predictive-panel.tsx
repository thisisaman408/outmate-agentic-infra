"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Loader2, BrainCircuit, ArrowUpRight, ArrowDownRight, Info, Mail, ExternalLink, Download } from "lucide-react"
import { aiAgentsApi, type PredictiveScore } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { exportToCSV } from "@/lib/export-csv"

function SimulatedActivityFeed({ isActive }: { isActive: boolean }) {
  const [messages, setMessages] = useState<string[]>([])
  const allMessages = [
    "Synthesizing historical conversion data...",
    "Extracting behavioral intent signals...",
    "Running multivariate regression...",
    "Validating against lookalike cohorts...",
    "Calculating propensity coefficients...",
    "Identifying primary churn inhibitors...",
    "Weighting firmographic alignment...",
    "Generating final predictive score..."
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
    }, 1300)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className="font-mono text-[9px] uppercase tracking-tighter text-orange-400/60 h-10 flex flex-col justify-end">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <motion.div
            key={`${msg}-${idx}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-center gap-1.5"
          >
            <div className="h-1 w-1 bg-orange-500 rounded-full animate-pulse" />
            {msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function PredictivePanel() {
  const { toast } = useToast()
  const [isScoring, setIsScoring] = useState(false)
  const [results, setResults] = useState<PredictiveScore[]>([])
  const [companyName, setCompanyName] = useState("")
  const [companyDomain, setCompanyDomain] = useState("")
  const [industry, setIndustry] = useState("")
  const [country, setCountry] = useState("US")

  const handleScoreLeads = async () => {
    if (!companyName.trim()) {
      toast({
        title: "Company Required",
        description: "Enter a company name to run predictive scoring.",
        variant: "destructive",
      })
      return
    }
    setIsScoring(true)
    setResults([])
    try {
      const scores = await aiAgentsApi.scoreLeads({
        name: companyName.trim(),
        domain: companyDomain.trim() || undefined,
        industry: industry.trim() || undefined,
        country: country.trim() || "US",
      })
      setResults(scores)
      toast({
        title: "Intelligence Model Run",
        description: `Agent calculated conversion propensity for ${companyName}.`,
      })
    } catch (error: any) {
      toast({
        title: "Model Execution Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsScoring(false)
    }
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <Card className="glass-effect border-white/5 relative bg-transparent overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <BrainCircuit className="h-48 w-48 text-orange-400" />
        </div>

        <CardHeader className="pb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <CardTitle className="text-3xl font-black flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <TrendingUp className="h-6 w-6" />
                </div>
                Predictive Agent
              </CardTitle>
              <CardDescription className="text-lg font-medium text-muted-foreground/80 max-w-xl">
                Advanced propensity modeling to prioritize your pipeline based on actual conversion probability.
              </CardDescription>
            </div>
            <SimulatedActivityFeed isActive={isScoring} />
          </div>
        </CardHeader>

        <CardContent className="pb-10">
          <div className="space-y-6 p-8 rounded-3xl bg-black/20 border border-white/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase font-black tracking-widest text-muted-foreground/60 block">
                  Company Name *
                </label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScoreLeads()}
                  disabled={isScoring}
                  className="h-12 bg-black/20 border-white/10 focus-visible:border-orange-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase font-black tracking-widest text-muted-foreground/60 block">
                  Domain (optional)
                </label>
                <Input
                  placeholder="e.g. acmecorp.com"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  disabled={isScoring}
                  className="h-12 bg-black/20 border-white/10 focus-visible:border-orange-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase font-black tracking-widest text-muted-foreground/60 block">
                  Industry (optional)
                </label>
                <Input
                  placeholder="e.g. SaaS, Fintech, Healthcare"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={isScoring}
                  className="h-12 bg-black/20 border-white/10 focus-visible:border-orange-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase font-black tracking-widest text-muted-foreground/60 block">
                  Country
                </label>
                <Input
                  placeholder="e.g. US"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isScoring}
                  className="h-12 bg-black/20 border-white/10 focus-visible:border-orange-500/40"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleScoreLeads}
                disabled={isScoring}
                className={cn(
                  "h-14 px-12 text-base font-bold rounded-2xl transition-all duration-300",
                  isScoring
                    ? "bg-muted"
                    : "bg-orange-600 hover:bg-orange-500 shadow-2xl shadow-orange-500/20"
                )}
              >
                {isScoring ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Running Inference...
                  </>
                ) : (
                  <>
                    <BrainCircuit className="mr-3 h-5 w-5" />
                    Run Model
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {isScoring && (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="glass-effect border-white/5 p-8 flex items-center gap-8">
                  <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <Skeleton className="h-12 w-24 rounded-xl" />
                </Card>
              ))}
            </div>
          )}

          {!isScoring && results.length > 0 && (
            <div key="predictive-export" className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{results.length} Leads Scored</p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-white/10 hover:border-orange-500/30"
                onClick={() => {
                  const headers = ["Company Name", "Contact Name", "Title", "Email", "Score", "Prediction", "Confidence", "Factors", "Guidance", "Recommendation"]
                  const rows = results.map(r => [
                    r.companyName || "", r.contactName || "", r.title || "", r.email || "",
                    String(r.score ?? ""), r.prediction || "", String(r.confidence ?? ""),
                    (r.factors || []).map((f: any) => `${f.name} (${f.impact})`).join(" | "),
                    r.guidance || "", r.recommendation || ""
                  ])
                  exportToCSV(`predictive_export_${new Date().toISOString().split('T')[0]}.csv`, headers, rows)
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          )}

          {!isScoring && results.length > 0 && (
            <motion.div
              className="grid gap-6"
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
                    hidden: { opacity: 0, x: -20 },
                    show: { opacity: 1, x: 0 }
                  }}
                >
                  <Card className="glass-effect border-white/5 hover:border-orange-500/30 transition-all group overflow-hidden bg-transparent">
                    <CardContent className="p-0 flex flex-col xl:flex-row">
                      <div className="p-8 flex-1 space-y-6">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-5">
                            <div className="h-20 w-20 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-black text-3xl group-hover:scale-110 transition-transform">
                              {result.contactName?.[0] || "?"}
                            </div>
                            <div className="space-y-1">
                              <h3 className="text-2xl font-black tracking-tight">{result.contactName}</h3>
                              <p className="text-muted-foreground font-medium">{result.title} @ <span className="text-foreground">{result.companyName}</span></p>
                              <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground/80">
                                {result.email ? (
                                  <a className="flex items-center gap-1 hover:text-foreground transition-colors" href={`mailto:${result.email}`}>
                                    <Mail className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground/50">
                                    <Mail className="h-4 w-4" />
                                  </span>
                                )}
                                {result.profileLink ? (
                                  <a className="flex items-center gap-1 hover:text-foreground transition-colors" href={result.profileLink} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground/50">
                                    <ExternalLink className="h-4 w-4" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={cn("px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest",
                              result.prediction === "High" ? "bg-emerald-500/20 text-emerald-400" :
                                result.prediction === "Medium" ? "bg-orange-500/20 text-orange-400" : "bg-red-500/20 text-red-400")}>
                              {result.prediction} Propensity
                            </Badge>
                            <div className="mt-2 text-[10px] font-bold text-muted-foreground uppercase opacity-40">Classification</div>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-white/5">
                          <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contributing Signals</p>
                            <div className="space-y-3">
                              {(result.factors ?? []).map((factor: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                                  <span className="text-xs font-medium text-muted-foreground/80">{factor.name}</span>
                                  <span className={cn("text-xs font-bold flex items-center gap-1", factor.impact === "positive" ? "text-emerald-400" : "text-red-400")}>
                                    {factor.impact === "positive" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {factor.impact === "positive" ? "Boost" : "Draft"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agent Guidance</p>
                            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 italic text-sm text-orange-100/70 leading-relaxed relative">
                              <div className="absolute top-2 right-3 opacity-20"><Info className="h-4 w-4" /></div>
                              "{result.guidance}"
                            </div>
                            <div className="flex gap-4 items-end justify-between">
                              <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Model Confidence</p>
                                <p className="text-xl font-mono font-bold">{result.confidence * 100}%</p>
                              </div>
                              <Progress value={result.confidence * 100} className="h-2 w-32 bg-white/10" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="xl:w-64 bg-white/5 p-8 border-l border-white/5 flex flex-col justify-center gap-6">
                        <div className="text-center space-y-1">
                          <div className="text-4xl font-black text-orange-400 leading-none">{result.score}</div>
                          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">GTM Score</div>
                        </div>
                        <Button className="w-full h-12 bg-orange-600 hover:bg-orange-500 font-bold rounded-xl shadow-lg shadow-orange-500/10 transition-all">
                          Engage Prospect
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
          {!isScoring && results.length === 0 && (
            <motion.div
              key="predictive-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground"
            >
              Run the model to score leads. If the API returns an error (e.g., insufficient credits), check the toast for details.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
