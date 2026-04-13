"use client"

import React, { useState, useMemo } from "react"
import { Search, ArrowRight, Eye, Zap, Flame, Sparkles, TrendingUp, Target, BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── types ─── */
interface Agent {
  id: number
  name: string
  emoji: string
  category: string
  hint: string
  desc: string
  color: string
  trending?: boolean
  isNew?: boolean
}

/* ─── data ─── */
const AGENTS: Agent[] = [
  { id: 1, name: "Intent Radar", emoji: "📡", category: "Signal Detection", hint: "Alert me when target accounts show buying signals", desc: "Monitors G2, Capterra, and review sites for ICP accounts researching your category.", color: "hsl(0,72%,50%)", trending: true },
  { id: 2, name: "AI SDR", emoji: "🤖", category: "Outbound", hint: "Run fully autonomous outbound prospecting end-to-end", desc: "Fully autonomous SDR — prospects, enriches, personalises, and handles replies 24/7.", color: "hsl(239,84%,67%)", trending: true },
  { id: 3, name: "Job Switch Tracker", emoji: "🔄", category: "Signal Detection", hint: "Notify me when a prospect changes company", desc: "Detects when ICP contacts switch companies or take new leadership roles.", color: "hsl(25,95%,53%)", trending: true },
  { id: 4, name: "Prospect Researcher", emoji: "🔍", category: "Research & Enrichment", hint: "Deep-research any prospect in under 60 seconds", desc: "Compiles a comprehensive prospect brief from LinkedIn, news, and social media.", color: "hsl(239,84%,67%)", isNew: true },
]

const QUICK_CATS = [
  { name: "Signal Detection", color: "bg-orange-500/10", icon: <Flame className="w-4 h-4 text-orange-500" /> },
  { name: "Outbound Execution", color: "bg-indigo-500/10", icon: <Zap className="w-4 h-4 text-indigo-500" /> },
  { name: "Research & Enrichment", color: "bg-emerald-500/10", icon: <Sparkles className="w-4 h-4 text-emerald-500" /> },
  { name: "Sales Enablement", color: "bg-purple-500/10", icon: <Target className="w-4 h-4 text-purple-500" /> },
]

/* ─── component ─── */
export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Hero Section */}
      <section className="relative px-8 py-20 bg-[#0F172A] overflow-hidden">
         <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "linear-gradient(rgba(79,70,229,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
         }} />
         
         <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center">
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full mb-6">
               <BadgeCheck className="w-3.5 h-3.5 text-primary" />
               <span className="text-[10px] font-black uppercase tracking-widest text-primary">Certified Outmate Agents</span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white mb-6 uppercase">
               Agent <span className="text-primary italic">Marketplace</span>
            </h1>
            <p className="text-[14px] font-medium text-slate-400 max-w-2xl mx-auto leading-relaxed uppercase tracking-widest opacity-60 mb-10">
               Deploy pre-configured autonomous agents for every stage of your GTM funnel. From intent detection to cold call automation.
            </p>
            
            {/* Search */}
            <div className="w-full max-w-xl relative group">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
               <input 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 50+ agents by skill or use case..."
                  className="w-full h-16 pl-14 pr-4 bg-white/[0.03] border border-white/10 rounded-3xl text-white text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-600"
               />
            </div>
         </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-12 no-scrollbar bg-muted/5">
         <div className="max-w-6xl mx-auto space-y-12">
            
            {/* Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {QUICK_CATS.map(cat => (
                  <button 
                     key={cat.name}
                     onClick={() => setActiveCategory(cat.name)}
                     className="group flex items-center gap-4 p-6 bg-card border border-border rounded-[24px] shadow-xl shadow-black/[0.02] hover:border-primary/20 hover:-translate-y-1 transition-all"
                  >
                     <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", cat.color)}>
                        {cat.icon}
                     </div>
                     <div className="text-left">
                        <span className="text-[12px] font-black uppercase tracking-widest text-foreground">{cat.name}</span>
                        <p className="text-[10px] font-bold text-muted-foreground/40 mt-1">12+ AGENTS</p>
                     </div>
                  </button>
               ))}
            </div>

            {/* Trending Section */}
            <div>
               <div className="flex items-center justify-between mb-8 px-2">
                  <div className="flex items-center gap-3">
                     <TrendingUp className="w-5 h-5 text-primary" />
                     <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-foreground">Featured Intelligence</h2>
                  </div>
                  <button className="text-[11px] font-black uppercase tracking-widest text-primary hover:underline">View All Agents</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {AGENTS.map(agent => (
                     <div key={agent.id} className="group flex flex-col bg-card border border-border rounded-[32px] overflow-hidden shadow-xl shadow-black/[0.02] hover:border-primary/20 transition-all">
                        <div className="h-2 w-full" style={{ backgroundColor: agent.color }} />
                        <div className="p-8">
                           <div className="flex items-start justify-between mb-6">
                              <div className="w-14 h-14 rounded-[20px] bg-muted/50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                 {agent.emoji}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                 {agent.trending && (
                                    <span className="px-2.5 py-1 bg-orange-500/10 text-orange-500 rounded-lg text-[9px] font-black uppercase tracking-widest border border-orange-500/20">Hot</span>
                                 )}
                                 {agent.isNew && (
                                    <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase tracking-widest border border-primary/20">New</span>
                                 )}
                              </div>
                           </div>
                           
                           <h3 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">{agent.name}</h3>
                           <p className="text-[11px] font-bold text-primary italic mb-6 leading-relaxed">"{agent.hint}"</p>
                           <p className="text-[13px] font-medium text-muted-foreground/60 leading-relaxed mb-10">
                              {agent.desc}
                           </p>

                           <div className="flex items-center gap-3 mt-auto">
                              <button className="flex-1 h-12 bg-primary text-primary-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all">
                                 Deploy Agent
                              </button>
                              <button className="w-12 h-12 border border-border rounded-2xl flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                                 <Eye className="w-5 h-5" />
                              </button>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

         </div>
      </main>
    </div>
  )
}
