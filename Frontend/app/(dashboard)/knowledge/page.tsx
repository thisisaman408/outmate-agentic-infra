"use client"

import React, { useState } from "react"
import {
  Search, Filter, ArrowDownAZ, Plus, Globe, Link2, PenLine, Library,
  ChevronRight, Edit2, Trash2, RefreshCw, UploadCloud,
  FileText, Target, Award, BookOpen, TrendingUp, Mail, Shield, Check
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── data ─── */
const knowledgeItems = [
  { icon: "📋", name: "ICP Definition v3", source: "PDF", chunks: "1,240", status: "indexed" as const, agents: 3 },
  { icon: "◎", name: "Outmate Website", source: "Website, auto-sync", chunks: "847", status: "syncing" as const, agents: 2 },
  { icon: "📞", name: "Q4 Call Transcripts", source: "23 files, 86 MB", chunks: "4,102", status: "indexed" as const, agents: 2 },
  { icon: "⊞", name: "HubSpot CRM Data", source: "Integration, live sync", chunks: "12,400", status: "syncing" as const, agents: 2 },
]

const connectedAgents = ["Intent Radar", "AI SDR", "Personal Opener", "Prospect Brief"]

const integrations = [
  { name: "HubSpot", icon: "HS", connected: true },
  { name: "Salesforce", icon: "SF", connected: false },
  { name: "Slack", icon: "SL", connected: true },
]

/* ─── component ─── */
export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("library")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Hero / Header */}
      <div className="relative pt-12 pb-20 px-8 bg-[#0F172A] overflow-hidden shrink-0">
         <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "radial-gradient(#4F46E5 1px, transparent 1px)",
            backgroundSize: "24px 24px"
         }} />
         <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 blur-[120px] rounded-full" />
         <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full" />
         
         <div className="relative z-10 max-w-4xl mx-auto text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-4 block">Neural Context Engine</span>
            <h1 className="text-4xl font-black tracking-tighter text-white mb-4 uppercase">Knowledge Base</h1>
            <p className="text-[13px] font-medium text-slate-400 max-w-lg mx-auto leading-relaxed uppercase tracking-widest opacity-60">
               Centralized intelligence for your AI agents. Feed documents, websites, and CRM data to build a custom brain.
            </p>
         </div>
      </div>

      {/* Tabs Selector */}
      <div className="relative z-20 -mt-8 flex justify-center shrink-0">
         <div className="flex p-1.5 bg-card border border-border rounded-2xl shadow-2xl shadow-black/10">
            {[
               { id: 'library', label: 'Library', icon: Library },
               { id: 'upload', label: 'Upload', icon: UploadCloud },
               { id: 'website', label: 'Website', icon: Globe },
               { id: 'integration', label: 'Connect', icon: Link2 },
               { id: 'write', label: 'Editor', icon: PenLine }
            ].map(tab => (
               <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn("flex flex-col items-center gap-1.5 px-6 py-3 rounded-xl transition-all", 
                     activeTab === tab.id ? "bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/50")}
               >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-all", 
                     activeTab === tab.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-muted border border-border")}>
                     <tab.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
               </button>
            ))}
         </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 no-scrollbar bg-muted/5">
         <div className="max-w-5xl mx-auto space-y-8">
            {activeTab === 'library' ? (
               <>
                  {/* Filter Bar */}
                  <div className="flex items-center gap-3">
                     <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                        <input 
                           placeholder="Search your knowledge base..." 
                           className="w-full h-12 pl-11 pr-4 bg-card border border-border rounded-2xl text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                        />
                     </div>
                     <Button variant="outline" className="h-12 px-6 rounded-2xl border-border gap-2 text-[11px] font-black uppercase tracking-widest">
                        <Filter className="w-4 h-4 opacity-40" />
                        Filter
                     </Button>
                     <Button className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 gap-2 text-[11px] font-black uppercase tracking-widest">
                        <Plus className="w-4 h-4" />
                        Add Intelligence
                     </Button>
                  </div>

                  {/* Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {knowledgeItems.map((item, i) => (
                        <div key={i} className="bg-card border border-border rounded-[24px] p-6 shadow-xl shadow-black/[0.02] hover:border-primary/20 transition-all group">
                           <div className="flex items-start justify-between mb-6">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg">{item.icon}</div>
                                 <div className="flex flex-col">
                                    <span className="text-[14px] font-black text-foreground uppercase tracking-tight">{item.name}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest">{item.source}</span>
                                 </div>
                              </div>
                              <div className={cn("w-2 h-2 rounded-full", item.status === 'indexed' ? "bg-emerald-500" : "bg-primary animate-pulse")} />
                           </div>
                           <div className="flex items-center gap-4 mb-6">
                              <div className="px-3 py-1 bg-muted/50 border border-border rounded-lg text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                 {item.chunks} Chunks
                              </div>
                              <div className="px-3 py-1 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                 {item.agents} Connected Agents
                              </div>
                           </div>
                           <div className="flex items-center justify-end gap-2 pt-4 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary"><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                           </div>
                        </div>
                     ))}
                  </div>

                  {/* Agents */}
                  <div className="pt-8">
                     <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4 px-1">Synchronized Intelligence Network</h2>
                     <div className="flex flex-wrap gap-2">
                        {connectedAgents.map(a => (
                           <div key={a} className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-xl shadow-sm hover:border-primary/20 transition-all cursor-pointer">
                              <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center text-[10px]">🤖</div>
                              <span className="text-[11px] font-black uppercase tracking-widest text-foreground">{a}</span>
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           </div>
                        ))}
                     </div>
                  </div>
               </>
            ) : (
               <div className="bg-card border border-border rounded-[32px] p-20 text-center flex flex-col items-center">
                  <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mb-8">
                     <UploadCloud className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-foreground mb-4">Integrate Intelligence</h2>
                  <p className="text-[13px] font-medium text-muted-foreground/60 max-w-sm mx-auto mb-10 leading-relaxed uppercase tracking-widest">
                     Connect your ecosystem to feed real-time context to your autonomous agents.
                  </p>
                  <Button className="h-14 px-10 rounded-3xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 text-[11px] font-black uppercase tracking-[0.2em]">
                     Start Integration
                  </Button>
               </div>
            )}
         </div>
      </main>
    </div>
  )
}

function Button({ children, variant = "primary", size = "default", className, ...props }: any) {
  const variants: any = {
    primary: "bg-primary text-primary-foreground",
    outline: "border border-border bg-transparent hover:bg-muted/50",
    ghost: "hover:bg-muted",
  }
  const sizes: any = {
    default: "h-10 px-4",
    sm: "h-8 px-3",
    icon: "h-8 w-8 p-0",
  }
  return (
    <button className={cn("inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors disabled:opacity-50", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}
