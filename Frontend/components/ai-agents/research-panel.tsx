"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, CheckCircle2, AlertCircle, Building2, Globe, TrendingUp, ShieldAlert, Newspaper, Users } from "lucide-react"
import { aiAgentsApi, type ResearchResult } from "@/lib/api/ai-agents"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function SimulatedActivityFeed({ isActive }: { isActive: boolean }) {
  const [messages, setMessages] = useState<string[]>([])
  const allMessages = [
    "Initializing research vectors...",
    "Crawling web data for footprint...",
    "Analyzing LinkedIn company insights...",
    "Extracting competitive landscape...",
    "Synthesizing market position...",
    "Identifying primary growth levers...",
    "Assessing risk factors...",
    "Finalizing intelligence report..."
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
    }, 1500)

    return () => clearInterval(interval)
  }, [isActive])

  return (
    <div className="font-mono text-[10px] space-y-1 text-primary/60">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <motion.div
            key={`${msg}-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2"
          >
            <span className="opacity-40">{">"}</span>
            {msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function ResearchPanel() {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState("")
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard")
  const [isResearching, setIsResearching] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)

  const handleResearch = async () => {
    if (!companyName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a company name",
        variant: "destructive",
      })
      return
    }

    setIsResearching(true)
    setResult(null)
    try {
      const researchResult = await aiAgentsApi.researchCompany(companyName, depth)
      setResult(researchResult)
      toast({
        title: "Intelligence Gathered",
        description: `Deep research on ${companyName} is complete.`,
      })
    } catch (error: any) {
      toast({
        title: "Research Failed",
        description: error.message === 'Failed to research company' ? "Insufficient credits or database issue." : error.message,
        variant: "destructive",
      })
    } finally {
      setIsResearching(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="grid gap-6">
        <Card className="glass-effect border-white/10 dark:bg-black/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Search className="h-32 w-32" />
          </div>

          <CardHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Search className="h-5 w-5" />
                  </div>
                  Research Agent
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Gain comprehensive, real-time intelligence on any organization.
                </CardDescription>
              </div>
              <SimulatedActivityFeed isActive={isResearching} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6 relative z-10">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Entity Name</Label>
                <div className="relative">
                  <Input
                    id="companyName"
                    placeholder="e.g., Anthropic, Stripe, or SpaceX"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleResearch()}
                    disabled={isResearching}
                    className="h-12 bg-black/20 border-white/5 focus:border-emerald-500/50 transition-all pl-10 rounded-xl"
                  />
                  <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="depth" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Scan Intensity</Label>
                <Select value={depth} onValueChange={(value: any) => setDepth(value)}>
                  <SelectTrigger id="depth" disabled={isResearching} className="h-12 bg-black/20 border-white/5 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-effect border-white/10">
                    <SelectItem value="quick">Quick Pulse (30s)</SelectItem>
                    <SelectItem value="standard">Standard Inquiry (2m)</SelectItem>
                    <SelectItem value="deep">Deep Horizon Scan (5m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleResearch}
              disabled={isResearching}
              className={cn(
                "w-full h-12 text-lg font-bold rounded-xl transition-all duration-500",
                isResearching ? "bg-muted" : "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
              )}
            >
              {isResearching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Vectors...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Commence Research
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AnimatePresence>
        {result && !isResearching && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6"
          >
            {/* Overview Section */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2 glass-effect border-emerald-500/10">
                <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-xl">
                    {result.companyName[0]}
                  </div>
                    <div>
                      <CardTitle className="text-2xl">{result.companyName}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Globe className="h-3 w-3" />
                        Intelligence Summary
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-tighter text-muted-foreground mb-2 flex items-center gap-2">
                      Mission Profile
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
                  </div>
                  <div>
                    <h4 className="text-xs uppercase font-bold tracking-tighter text-muted-foreground mb-2 flex items-center gap-2">
                      Strategic Positioning
                    </h4>
                    <p className="text-muted-foreground leading-relaxed italic border-l-2 border-emerald-500/30 pl-4">
                      {typeof result.marketPosition === "string"
                        ? result.marketPosition
                        : result.marketPosition
                          ? `${result.marketPosition.positioning || "Positioning unknown"} · ${result.marketPosition.industry || "Industry unknown"} · ${result.marketPosition.geographicPresence || "Regions unspecified"}`
                          : "Positioning data unavailable."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Newspaper className="h-4 w-4" />
                    Latest Intel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-4">
                    {(result.recentNews ?? []).slice(0, 3).map((news, index) => (
                      <li key={index} className="text-sm leading-snug group border-b border-white/5 pb-3 last:border-0">
                        <p className="text-muted-foreground group-hover:text-foreground transition-colors">{news}</p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Insights & Competition */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass-effect shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary font-bold">
                    <TrendingUp className="h-5 w-5" />
                    Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-3">
                    {(result.opportunities ?? []).map((opp, index) => (
                      <li key={index} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{opp}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="glass-effect">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-400 font-bold">
                    <ShieldAlert className="h-5 w-5" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-3">
                    {(result.risks ?? []).map((risk, index) => (
                      <li key={index} className="flex items-start gap-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-sm">
                        <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Key Findings Multi-columns */}
            <Card className="glass-effect border-white/5 bg-transparent overflow-hidden">
              <div className="grid md:grid-cols-2 gap-0 divide-x divide-white/10">
                <div className="p-8">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Key Insight Findings
                  </h3>
                  <div className="space-y-6">
                    {(result.keyInsights ?? []).map((insight, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="font-mono text-emerald-500/40 text-sm">0{i + 1}</span>
                        <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-8 bg-black/10">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Competitor Landscape
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {(result.competitors ?? []).map((comp) => (
                      <Badge key={comp} className="px-4 py-2 bg-muted/40 hover:bg-primary/20 text-muted-foreground border-white/5 transition-colors cursor-default text-sm rounded-lg">
                        {comp}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-8 p-4 rounded-xl border border-white/5 bg-white/5">
                    <p className="text-[10px] uppercase font-black text-muted-foreground/40 tracking-widest mb-2 underline overline">AI PROJECTION</p>
                    <p className="text-xs text-muted-foreground">Entity shows 74% similarity to high-value cohorts. Recommended outreach tier: VIP.</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
