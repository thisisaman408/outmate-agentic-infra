"use client"

import React, { useState, useMemo } from "react"
import {
  Search, Filter, Plus, MoreVertical, Clock, SlidersHorizontal,
  ChevronLeft, Check, ExternalLink, Heart, MessageCircle,
  RefreshCw, X, Info, Link2, ChevronDown, TrendingUp,
  Users, Zap, Eye, ThumbsUp, Share2, Briefcase, Bell,
  BarChart3, ArrowUpRight, Flame, Target, UserPlus, Send
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"

/* ─── types ─── */
interface SavedSearch {
  id: string
  name: string
  platform: "linkedin" | "x"
  frequency: string
  updatedAt: string
  keywords: string[]
  paused?: boolean
  matchCount?: number
  enrichedCount?: number
}

type ActivityType = "post" | "comment" | "reaction" | "job_change" | "article" | "share"

interface Post {
  id: string
  searchId: string
  author: string
  initials: string
  role: string
  company: string
  timeAgo: string
  body: string
  likes: number
  comments: number
  shares?: number
  avatarTint: string
  platform: "linkedin"
  activityType: ActivityType
  intentScore: number
}

/* ─── seed data ─── */
const INITIAL_SEARCHES: SavedSearch[] = [
  { id: "s1", name: "Founders Posting: AI Strategy", platform: "linkedin", frequency: "Daily", updatedAt: "Updated Feb 16, 12:33 PM", keywords: ["ai automation", "agentic workflows"], matchCount: 142, enrichedCount: 89 },
  { id: "s2", name: "CTOs/VPs Posting: AI Stack", platform: "linkedin", frequency: "Daily", updatedAt: "Updated Feb 16, 12:32 PM", keywords: ["generative ai", "llm implementation"], matchCount: 97, enrichedCount: 61 },
]

const POSTS: Post[] = [
  { id: "p1", searchId: "s1", author: "Abhijith P.B", initials: "AP", role: "CEO & Founder", company: "NeuralFlow AI", timeAgo: "2 hours ago", likes: 24, comments: 8, shares: 3, avatarTint: "bg-indigo-500/10", platform: "linkedin", activityType: "post", intentScore: 87, body: "I attended a 2 Day Generative AI Mastermind. I went in curious. I came out transformed. In just two days, I learned: How to design structured prompts that produce clear, usable outcomes — not just clever answers." },
]

export default function SocialAgentPage() {
  const [searches, setSearches] = useState<SavedSearch[]>(INITIAL_SEARCHES)
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null)
  const [view, setView] = useState<"feed" | "builder">("feed")

  return (
    <div className="flex h-full bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-[300px] border-r border-border bg-card flex flex-col shrink-0">
         <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Social Pulse</h2>
            <Button onClick={() => setView('builder')} variant="ghost" size="icon" className="h-8 w-8 rounded-lg bg-primary/10 text-primary">
               <Plus className="w-4 h-4" />
            </Button>
         </div>
         <div className="p-4">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
               <Input placeholder="Filter monitors..." className="pl-9 h-9 text-[11px] font-medium bg-muted/20 border-border/50 rounded-xl" />
            </div>
         </div>
         <div className="flex-1 overflow-auto no-scrollbar px-3 space-y-1">
            {searches.map(s => (
               <button 
                 key={s.id} 
                 onClick={() => {setSelectedSearchId(s.id); setView('feed')}}
                 className={cn("w-full text-left p-4 rounded-2xl border transition-all group", 
                   selectedSearchId === s.id && view === 'feed' ? "bg-primary/5 border-primary/20" : "bg-transparent border-transparent hover:bg-muted/30")}>
                  <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                        {s.platform === 'linkedin' ? <div className="w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center text-[10px] text-white font-bold">in</div> : <div className="w-5 h-5 rounded bg-black flex items-center justify-center text-[10px] text-white font-bold">𝕏</div>}
                        <span className={cn("text-[12px] font-black uppercase tracking-tight truncate max-w-[140px]", selectedSearchId === s.id ? "text-primary" : "text-foreground")}>{s.name}</span>
                     </div>
                     <Badge variant="outline" className="text-[8px] font-black uppercase border-border/50 text-muted-foreground/40">{s.frequency}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                     <span className="text-[10px] font-bold text-muted-foreground/40">{s.matchCount} Signals</span>
                     <span className="text-[10px] font-bold text-emerald-500">{s.enrichedCount} Enriched</span>
                  </div>
               </button>
            ))}
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-muted/5">
         {view === 'feed' ? (
           <>
             {/* Header */}
             <div className="px-8 py-4 bg-card border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-indigo-500" />
                   </div>
                   <h1 className="text-sm font-black uppercase tracking-widest text-foreground">
                      {selectedSearchId ? searches.find(s => s.id === selectedSearchId)?.name : "All Social Signals"}
                   </h1>
                </div>
                <div className="flex items-center gap-3">
                   <Button variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-border gap-2 rounded-xl">
                      <Filter className="w-3.5 h-3.5 opacity-40" />
                      Filter View
                   </Button>
                   <Button className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-xl">
                      Configure Agent
                   </Button>
                </div>
             </div>

             {/* Feed */}
             <div className="flex-1 overflow-auto p-8 space-y-6 no-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                   {POSTS.map(p => (
                     <div key={p.id} className="bg-card border border-border rounded-[32px] p-8 shadow-xl shadow-black/[0.02] hover:border-primary/20 transition-all">
                        <div className="flex items-start justify-between mb-6">
                           <div className="flex items-center gap-4">
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-primary", p.avatarTint)}>
                                 {p.initials}
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <h3 className="text-[14px] font-black text-foreground uppercase tracking-tight">{p.author}</h3>
                                    <div className="w-4 h-4 rounded bg-[#0A66C2] flex items-center justify-center text-[8px] text-white font-bold">in</div>
                                 </div>
                                 <p className="text-[11px] font-bold text-muted-foreground/40 mt-0.5 uppercase tracking-widest">{p.role} @ <span className="text-primary">{p.company}</span></p>
                              </div>
                           </div>
                           <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/20 shadow-sm shadow-orange-500/5">
                                 <Flame className="w-3.5 h-3.5" />
                                 <span className="text-[10px] font-black uppercase tracking-widest">Hot · {p.intentScore} Score</span>
                              </div>
                              <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">{p.timeAgo}</span>
                           </div>
                        </div>

                        <div className="text-[13px] font-medium text-foreground/80 leading-relaxed mb-8 pl-1">
                           {p.body}
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-border">
                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-1.5 text-muted-foreground/40">
                                 <Heart className="w-4 h-4" />
                                 <span className="text-[11px] font-black uppercase">{p.likes}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground/40">
                                 <MessageCircle className="w-4 h-4" />
                                 <span className="text-[11px] font-black uppercase">{p.comments}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-border gap-2 rounded-xl text-primary border-primary/20 bg-primary/5">
                                 <UserPlus className="w-3.5 h-3.5" />
                                 Enrich Contact
                              </Button>
                              <Button className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-xl gap-2">
                                 <Send className="w-3.5 h-3.5" />
                                 Draft Outreach
                              </Button>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           </>
         ) : (
           <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mb-8">
                 <Target className="w-10 h-10 text-primary" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-foreground mb-4 uppercase tracking-[0.1em]">Signal Intelligence Builder</h1>
              <p className="max-w-md text-[13px] font-medium text-muted-foreground/60 leading-relaxed mb-12">
                 Configure your autonomous social listening agent to identify high-intent prospects based on real-time activity across LinkedIn and X.
              </p>
              
              <div className="w-full max-w-xl mx-auto space-y-4">
                 <div className="bg-card border border-border rounded-3xl p-8 shadow-xl shadow-black/[0.02]">
                    <div className="space-y-6 text-left">
                       <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Agent Name</label>
                          <Input placeholder="e.g. Founder Intent Radar" className="h-12 text-sm font-medium bg-muted/20 border-border/50 rounded-2xl px-5" />
                       </div>
                       <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Keywords to Monitor</label>
                          <Input placeholder="e.g. hiring, series A, struggling with enrichment" className="h-12 text-sm font-medium bg-muted/20 border-border/50 rounded-2xl px-5" />
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <Button onClick={() => setView('feed')} variant="ghost" className="flex-1 h-14 rounded-3xl text-[11px] font-black uppercase tracking-widest text-muted-foreground/60 border border-border">Cancel</Button>
                    <Button className="flex-1 h-14 rounded-3xl text-[11px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all border-none">Launch Agent</Button>
                 </div>
              </div>
           </div>
         )}
      </main>
    </div>
  )
}
