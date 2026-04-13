"use client"

import { useState, useMemo, useCallback } from "react"
import { Search, Lock, Check, Mic, Sparkles, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/* ─── signal data ─── */
interface Signal {
  id: string
  name: string
  description: string
  category: string
  strength: "High" | "Med" | "Low"
  tier: "Free" | "Starter" | "Growth" | "Scale"
  isNew?: boolean
  isTrending?: boolean
}

const SIGNALS: Signal[] = [
  { id: "jc1", name: "New VP Sales hired", description: "Detect when a company hires a new VP of Sales — strong buying signal", category: "Job change", strength: "High", tier: "Free", isTrending: true },
  { id: "jc2", name: "New CRO appointed", description: "Chief Revenue Officer change signals budget re-allocation", category: "Job change", strength: "High", tier: "Free" },
  { id: "jc3", name: "First GTM hire", description: "Early-stage company makes their first go-to-market hire", category: "Job change", strength: "High", tier: "Starter", isNew: true },
  { id: "fe1", name: "Series A raised", description: "Company raised Series A — scaling phase begins", category: "Funding events", strength: "High", tier: "Free", isTrending: true },
  { id: "fe2", name: "Series B raised", description: "Series B signals growth-stage investment in tools", category: "Funding events", strength: "High", tier: "Free" },
  { id: "bi1", name: "Pricing page visited", description: "Prospect visited your pricing page — high intent", category: "Buying intent", strength: "High", tier: "Free", isTrending: true },
  { id: "bi2", name: "G2 category research", description: "Prospect researching your category on G2", category: "Buying intent", strength: "High", tier: "Starter" },
  { id: "ts1", name: "Competitor tool removed", description: "Company uninstalled a competitor's product", category: "Tech stack", strength: "High", tier: "Starter", isTrending: true },
  { id: "cg1", name: "Employee count +20%", description: "Rapid headcount growth signals tool scaling needs", category: "Company growth", strength: "High", tier: "Free" },
]

const CATEGORIES = [
  { label: "All signals" },
  { label: "Job change", section: "Trending now" },
  { label: "Funding events", section: "Trending now" },
  { label: "Buying intent", section: "Trending now" },
  { label: "Tech stack", section: "Company signals" },
  { label: "Company growth", section: "Company signals" },
]

const FILTER_PILLS = ["All", "🔥 Trending", "High strength", "New", "Free", "Starter", "Growth", "Scale"]

export default function SignalsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState("All signals")
  const [activePill, setActivePill] = useState("All")
  const [promptInput, setPromptInput] = useState("")

  const filteredSignals = useMemo(() => {
    let list = SIGNALS
    if (activeCategory !== "All signals") list = list.filter(s => s.category === activeCategory)
    if (activePill === "🔥 Trending") list = list.filter(s => s.isTrending)
    else if (activePill === "High strength") list = list.filter(s => s.strength === "High")
    else if (activePill === "New") list = list.filter(s => s.isNew)
    else if (["Free", "Starter", "Growth", "Scale"].includes(activePill)) list = list.filter(s => s.tier === activePill)
    return list
  }, [activeCategory, activePill])

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Nav */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black tracking-tight text-foreground">Signals Library</h1>
          <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase tracking-widest text-[9px]">4,000+ Available</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 px-4 text-[11px] font-black uppercase tracking-widest border-border hover:bg-muted transition-all rounded-xl">
             + Custom Signal
          </Button>
          {selectedIds.size > 0 && (
            <Button className="h-9 px-4 text-[11px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-xl">
               Apply to Workflow ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="shrink-0 bg-gradient-to-b from-card to-background border-b border-border px-8 pt-12 pb-10 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black tracking-tighter text-foreground mb-3">Target any high-intent trigger</h2>
          <p className="text-sm font-medium text-muted-foreground/60 mb-8 max-w-lg mx-auto leading-relaxed">
            Describe your ideal customer trigger in plain English, and our AI will suggest the most relevant technical signals to track.
          </p>

          <div className="relative group max-w-xl mx-auto mb-8">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
            <div className="relative flex items-center gap-2 p-2 rounded-2xl bg-card border border-border shadow-xl focus-within:border-primary transition-all">
              <Search className="w-5 h-5 ml-2 text-muted-foreground/30" />
              <input
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="e.g. When a Series A fintech company hires a new Head of Growth..."
                className="flex-1 bg-transparent text-sm font-bold text-foreground placeholder:text-muted-foreground/30 outline-none px-2"
              />
              <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground/50 hover:bg-muted rounded-xl">
                <Mic className="w-5 h-5" />
              </Button>
              <Button className="h-10 px-6 font-black bg-primary text-primary-foreground rounded-xl active:scale-95 transition-all">
                Find
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 opacity-80">
            {["Funded + hiring GTM", "Pricing page intent", "Competitor displacement"].map(chip => (
              <button key={chip} onClick={() => setPromptInput(chip)} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/30 hover:text-primary transition-all shadow-sm">
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[240px] shrink-0 border-r border-border bg-muted/5 flex flex-col p-4 overflow-y-auto no-scrollbar">
           <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 px-3 py-4">Categories</div>
           {CATEGORIES.map(cat => (
             <button
              key={cat.label}
              onClick={() => setActiveCategory(cat.label)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-black transition-all",
                activeCategory === cat.label ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
             >
               {cat.label}
             </button>
           ))}
        </aside>

        {/* Grid Area */}
        <div className="flex-1 flex flex-col min-w-0">
           <div className="shrink-0 px-8 py-4 border-b border-border/50 bg-card flex items-center gap-2 flex-wrap overflow-x-auto no-scrollbar">
              {FILTER_PILLS.map(p => (
                <button
                  key={p}
                  onClick={() => setActivePill(p)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    activePill === p ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-card border-border text-muted-foreground hover:border-primary/30 hover:text-primary"
                  )}
                >
                  {p}
                </button>
              ))}
           </div>

           <div className="flex-1 overflow-auto no-scrollbar p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {filteredSignals.map(s => {
                    const sel = selectedIds.has(s.id)
                    const locked = s.tier === 'Scale'
                    return (
                      <div 
                        key={s.id}
                        onClick={() => !locked && toggle(s.id)}
                        className={cn(
                          "group bg-card border rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden",
                          sel ? "border-primary bg-primary/5 shadow-xl shadow-primary/5" : "border-border hover:border-primary/30",
                          locked && "opacity-60 grayscale cursor-not-allowed"
                        )}
                      >
                         <div className="flex items-start justify-between mb-3">
                            <h3 className="text-[13px] font-black tracking-tight text-foreground leading-snug pr-6">{s.name}</h3>
                            {locked ? (
                              <Lock className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                            ) : (
                              <div className={cn("w-4 h-4 rounded border transition-all shrink-0 mt-0.5", sel ? "bg-primary border-primary" : "border-border/60 group-hover:border-primary/40")}>
                                 {sel && <Check className="w-3 h-3 text-white m-auto translate-y-[0.5px]" strokeWidth={4} />}
                              </div>
                            )}
                         </div>
                         <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed mb-4 line-clamp-2">{s.description}</p>
                         
                         <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border-transparent px-2", 
                              s.strength === 'High' ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500")}>
                               {s.strength} Strength
                            </Badge>
                            {s.tier !== 'Free' && (
                              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border-transparent px-2">
                                 {s.tier}
                              </Badge>
                            )}
                            {s.isTrending && (
                              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border-transparent px-2">
                                 🔥 Trending
                              </Badge>
                            )}
                         </div>
                      </div>
                    )
                 })}
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
