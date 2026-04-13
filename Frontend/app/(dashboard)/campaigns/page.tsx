"use client"

import React, { useState, useReducer, useCallback } from "react"
import {
  Search, Filter, Plus, MoreVertical, Sparkles, ChevronDown,
  Clock, Zap, Mail, Database, Bot, BarChart3, Globe, Users, Building2,
  Bell, Settings, Eye, ArrowRight, TrendingUp, Target, Layers,
  MessageSquare, Phone, Share2, Gauge, Shield
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/* ═══════════════════════════════════════════════
   WORKFLOWS TAB — Types & Data
   ═══════════════════════════════════════════════ */
type WfStatus = "draft" | "live" | "paused"
type TriggerType = "event" | "time" | "signal" | "manual"
interface ActionChip { label: string; icon: any; color: string; }
interface WfItem {
  id: string; on: boolean; name: string; desc: string;
  status: WfStatus; trigger: TriggerType;
  target: "People" | "Companies" | "Signals"; owner: string;
  inProgress: number; completed: number; failed: number;
  lastRun: string; nextRun: string; folder: string; actions: ActionChip[];
}

const workflows: WfItem[] = [
  { id:"w1", on:false, name:"GTM Leadership Email Engagement Monitor", desc:"This workflow monitors email engagement from GTM leadership and triggers personalized follow-ups", status:"draft", trigger:"event", target:"People", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"(Upon event)", folder:"", actions:[{label:"Notification",icon:Bell,color:"text-purple-500"}] },
  { id:"w2", on:false, name:"GTM Leadership Email Engagement Alerts", desc:"Automatically sends Slack notifications when key GTM leaders engage with emails", status:"draft", trigger:"event", target:"People", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"(Upon event)", folder:"", actions:[{label:"Notification",icon:Bell,color:"text-purple-500"}] },
  { id:"w3", on:false, name:"Weekly AI Company Outreach Automation", desc:"This workflow runs weekly to identify target companies and auto-enrich with AI-powered outreach", status:"draft", trigger:"time", target:"Companies", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"-", folder:"", actions:[{label:"Add to sequence",icon:Mail,color:"text-red-500"}] },
  { id:"w4", on:false, name:"Target Website Visitors", desc:"This template will automatically identify and engage website visitors with high intent signals", status:"draft", trigger:"time", target:"Companies", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"-", folder:"", actions:[{label:"Add to lists",icon:Database,color:"text-muted-foreground"},{label:"Set field",icon:Settings,color:"text-muted-foreground"}] },
  { id:"w5", on:false, name:"Auto-enrich form submissions", desc:"Enrich every inbound lead on form submission with company and contact data", status:"draft", trigger:"event", target:"People", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"(Upon event)", folder:"", actions:[{label:"Enrich data",icon:Database,color:"text-muted-foreground"}] },
]

type WfAction = { type:"TOGGLE"; id:string } | { type:"DELETE"; id:string } | { type:"SET"; workflows:WfItem[] }
function wfReducer(state: WfItem[], action: WfAction): WfItem[] {
  switch(action.type){
    case "TOGGLE": return state.map(w=>w.id===action.id?{...w,on:!w.on}:w)
    case "DELETE": return state.filter(w=>w.id!==action.id)
    case "SET": return action.workflows
    default: return state
  }
}

const triggerConfigText = (t: TriggerType) => {
  if(t==="event") return {label:"Event-triggered", color:"text-purple-500"}
  if(t==="time") return {label:"Time-triggered", color:"text-emerald-500"}
  if(t==="signal") return {label:"Signal-triggered", color:"text-orange-500"}
  return {label:"Manual", color:"text-muted-foreground"}
}
const targetConfigText = (t: string) => {
  if(t==="People") return {color:"text-purple-500", icon:Users}
  if(t==="Companies") return {color:"text-emerald-500", icon:Building2}
  return {color:"text-orange-500", icon:Zap}
}

/* ═══════════════════════════════════════════════
   TEMPLATES TAB — Types & Data
   ═══════════════════════════════════════════════ */
interface FlowNode { label: string; icon: any; colorClass: string; bgClass: string; }
interface Template {
  id: string; title: string; desc: string;
  tags: string[]; category: string;
  steps: FlowNode[];
  leads: string; conversion: string; useCase: string;
}

const categories = [
  { key: "all", label: "All Templates", icon: Layers },
  { key: "outbound", label: "Outbound", icon: Mail },
  { key: "inbound", label: "Inbound", icon: TrendingUp },
  { key: "enrichment", label: "Enrichment", icon: Database },
  { key: "scoring", label: "Scoring & Routing", icon: Gauge },
  { key: "signals", label: "Signal-Based", icon: Zap },
  { key: "ai", label: "AI-Powered", icon: Bot },
  { key: "multichannel", label: "Multi-Channel", icon: Share2 },
]

const tagColors: Record<string,{bg:string;color:string}> = {
  "AI": { bg:"bg-purple-500/10", color:"text-purple-500" },
  "Outbound": { bg:"bg-blue-500/10", color:"text-blue-500" },
  "Inbound": { bg:"bg-emerald-500/10", color:"text-emerald-500" },
  "Enrichment": { bg:"bg-amber-500/10", color:"text-amber-500" },
  "Scoring": { bg:"bg-pink-500/10", color:"text-pink-500" },
  "CRM": { bg:"bg-indigo-500/10", color:"text-indigo-500" },
  "Email": { bg:"bg-sky-500/10", color:"text-sky-500" },
  "LinkedIn": { bg:"bg-blue-500/10", color:"text-blue-500" },
  "Signal": { bg:"bg-yellow-500/10", color:"text-yellow-500" },
  "Voice": { bg:"bg-fuchsia-500/10", color:"text-fuchsia-500" },
  "Multi-Channel": { bg:"bg-teal-500/10", color:"text-teal-500" },
}

const templates: Template[] = [
  {
    id:"t1", title:"AI-Powered Outbound Prospecting", desc:"Find and engage AI-ready companies with intelligent multi-step outreach",
    tags:["AI","Outbound","Enrichment"], category:"outbound",
    steps:[
      {label:"Signal",icon:Zap,colorClass:"text-purple-500",bgClass:"bg-purple-500/10"},
      {label:"Enrich",icon:Database,colorClass:"text-blue-500",bgClass:"bg-blue-500/10"},
      {label:"Score",icon:Bot,colorClass:"text-amber-500",bgClass:"bg-amber-500/10"},
      {label:"Sequence",icon:Mail,colorClass:"text-emerald-500",bgClass:"bg-emerald-500/10"},
    ],
    leads:"120–300/mo", conversion:"8–14%", useCase:"Outbound SDR",
  },
  {
    id:"t2", title:"Inbound Lead Auto-Enrichment", desc:"Auto-enrich inbound leads and push scored contacts to CRM instantly",
    tags:["Inbound","Enrichment","CRM"], category:"inbound",
    steps:[
      {label:"Form Trigger",icon:Globe,colorClass:"text-purple-500",bgClass:"bg-purple-500/10"},
      {label:"Enrich Data",icon:Database,colorClass:"text-blue-500",bgClass:"bg-blue-500/10"},
      {label:"ICP Match",icon:Target,colorClass:"text-amber-500",bgClass:"bg-amber-500/10"},
      {label:"CRM Sync",icon:Building2,colorClass:"text-indigo-500",bgClass:"bg-indigo-500/10"},
    ],
    leads:"50–150/mo", conversion:"18–25%", useCase:"Inbound Ops",
  },
  {
    id:"t4", title:"Multi-Channel Engagement Engine", desc:"Orchestrate email, LinkedIn, and voice across a single unified workflow",
    tags:["Multi-Channel","AI","Email","LinkedIn"], category:"multichannel",
    steps:[
      {label:"Trigger",icon:Zap,colorClass:"text-purple-500",bgClass:"bg-purple-500/10"},
      {label:"Email",icon:Mail,colorClass:"text-blue-500",bgClass:"bg-blue-500/10"},
      {label:"LinkedIn",icon:MessageSquare,colorClass:"text-emerald-500",bgClass:"bg-emerald-500/10"},
      {label:"CRM",icon:Building2,colorClass:"text-indigo-500",bgClass:"bg-indigo-500/10"},
    ],
    leads:"80–200/mo", conversion:"12–20%", useCase:"Full-Cycle AE",
  },
]

function MiniFlow({ steps }: { steps: FlowNode[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={i} className="flex items-center shrink-0">
            <div className={cn("flex items-center gap-1.5 py-1.5 px-2.5 rounded-md", step.bgClass)}>
              <Icon className={cn("w-3 h-3", step.colorClass)} />
              <span className={cn("text-[11px] font-medium whitespace-nowrap", step.colorClass)}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center px-0.5">
                <div className="w-3 h-px bg-border mx-0.5" />
                <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/30" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TemplateCard({ t, onUse }: { t: Template; onUse: () => void }) {
  return (
    <div className="rounded-[24px] p-5 flex flex-col transition-all duration-300 bg-card border border-border hover:border-primary/20 hover:shadow-xl hover:shadow-black/[0.02] hover:-translate-y-0.5">
      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {t.tags.map(tag => {
          const tc = tagColors[tag] || { bg: "bg-muted", color: "text-muted-foreground" }
          return (
             <span key={tag} className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", tc.bg, tc.color)}>
               {tag}
             </span>
          )
        })}
      </div>

      <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">{t.title}</h3>
      <p className="text-[12px] font-medium mb-6 text-muted-foreground leading-relaxed">{t.desc}</p>

      {/* Steps */}
      <div className="mb-6">
        <MiniFlow steps={t.steps} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-6 bg-muted/40 p-3 rounded-2xl border border-border/50">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Leads</div>
          <div className="text-[11px] font-bold text-emerald-500">{t.leads}</div>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Conv. Rate</div>
          <div className="text-[11px] font-bold text-blue-500">{t.conversion}</div>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Use Case</div>
          <div className="text-[11px] font-bold text-purple-500">{t.useCase}</div>
        </div>
      </div>

      <Button onClick={onUse} className="w-full mt-auto h-12 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90">
        <Plus className="w-4 h-4 mr-2" /> Use Template
      </Button>
    </div>
  )
}

export default function CampaignsPage() {
  const router = useRouter()
  const [wfs, dispatch] = useReducer(wfReducer, workflows)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"workflows" | "templates">("workflows")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [templateSearch, setTemplateSearch] = useState("")

  const filtered = wfs.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.desc.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory !== "all" && t.category !== selectedCategory) return false
    if (templateSearch && !t.title.toLowerCase().includes(templateSearch.toLowerCase()) && !t.desc.toLowerCase().includes(templateSearch.toLowerCase())) return false
    return true
  })

  const createNew = useCallback(() => { router.push("/campaigns/new") }, [router])

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      
      {/* ── Header ── */}
      <div className="shrink-0 px-8 py-6 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col gap-1">
             <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Outreach Workflows</h1>
             <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Build automated sequences and pipelines</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" className="gap-2 text-[10px] font-black uppercase tracking-widest border-border h-10 px-4 rounded-xl">
               <Sparkles className="w-3.5 h-3.5 text-primary" /> Copilot Assist
             </Button>
             <Button onClick={createNew} className="gap-2 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground h-10 px-6 rounded-xl shadow-lg shadow-primary/20">
               <Plus className="w-3.5 h-3.5" /> Create Workflow
             </Button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-6">
          {(["workflows", "templates"] as const).map(t => (
             <button 
                key={t} 
                onClick={() => setTab(t)} 
                className={cn(
                   "pb-4 text-[12px] font-black uppercase tracking-widest transition-all",
                   tab === t ? "text-foreground border-b-2 border-primary" : "text-muted-foreground/50 border-b-2 border-transparent hover:text-foreground/80"
                )}
             >
                {t}
             </button>
          ))}
        </div>
      </div>

      {/* ═══════════ WORKFLOWS TAB ═══════════ */}
      {tab === "workflows" && (
         <main className="flex-1 overflow-auto bg-muted/5 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
               
               {/* Toolbar */}
               <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center gap-4">
                     <Button variant="ghost" className="h-9 px-3 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                        <Filter className="w-3.5 h-3.5" /> Filter
                     </Button>
                     <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <input 
                           value={search} 
                           onChange={e => setSearch(e.target.value)} 
                           placeholder="Search workflows..."
                           className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-[300px]"
                        />
                     </div>
                  </div>
                  <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-foreground">
                     <Settings className="w-4 h-4" />
                  </Button>
               </div>

               {/* Table */}
               <div className="bg-card border border-border rounded-[32px] overflow-hidden shadow-xl shadow-black/[0.02]">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-muted/30 border-b border-border">
                           <th className="p-4 w-12 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">#</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Name</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Status</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Target</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Trigger</th>
                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border/50">
                        {filtered.map(w => {
                           const trig = triggerConfigText(w.trigger)
                           const tgt = targetConfigText(w.target)
                           const TgtIcon = tgt.icon

                           return (
                              <tr key={w.id} className="group hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => router.push("/campaigns/new")}>
                                 <td className="p-4 align-top">
                                    <button 
                                       onClick={e => { e.stopPropagation(); dispatch({ type: "TOGGLE", id: w.id }) }}
                                       className={cn("w-10 h-5 rounded-full relative transition-colors duration-200 mt-1", w.on ? "bg-emerald-500" : "bg-muted-foreground/20")}
                                    >
                                       <div className={cn("absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200", w.on ? "left-[22px]" : "left-[2px]")} />
                                    </button>
                                 </td>
                                 <td className="p-4">
                                    <div className="flex flex-col gap-1 max-w-md">
                                       <span className="text-[13px] font-black text-foreground uppercase tracking-tight truncate">{w.name}</span>
                                       <span className="text-[11px] font-medium text-muted-foreground/60 line-clamp-1">{w.desc}</span>
                                    </div>
                                 </td>
                                 <td className="p-4">
                                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest", 
                                       w.status === "live" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : 
                                       w.status === "paused" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : 
                                       "bg-muted text-muted-foreground border border-border"
                                    )}>
                                       <div className={cn("w-1.5 h-1.5 rounded-full", w.status === "live" ? "bg-emerald-500" : w.status === "paused" ? "bg-amber-500" : "bg-muted-foreground")} />
                                       {w.status}
                                    </span>
                                 </td>
                                 <td className="p-4">
                                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-muted/50 border border-border", tgt.color)}>
                                       <TgtIcon className="w-3 h-3" /> {w.target}
                                    </span>
                                 </td>
                                 <td className="p-4">
                                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-muted/50 border border-border", trig.color)}>
                                       <Zap className="w-3 h-3" /> {trig.label}
                                    </span>
                                 </td>
                                 <td className="p-4 text-right">
                                    <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg">
                                          <MoreVertical className="w-4 h-4" />
                                       </Button>
                                    </div>
                                 </td>
                              </tr>
                           )
                        })}
                     </tbody>
                  </table>
                  
                  {filtered.length === 0 && (
                     <div className="p-12 text-center text-muted-foreground">
                        <p className="text-sm font-medium">No workflows found</p>
                     </div>
                  )}
               </div>
            </div>
         </main>
      )}

      {/* ═══════════ TEMPLATES TAB ═══════════ */}
      {tab === "templates" && (
         <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar */}
            <div className="w-[240px] shrink-0 border-r border-border bg-card p-4 overflow-y-auto hidden md:block">
               <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4 px-2">Categories</div>
               <div className="space-y-1">
                  {categories.map(cat => {
                     const active = selectedCategory === cat.key
                     const CatIcon = cat.icon
                     return (
                        <button 
                           key={cat.key} 
                           onClick={() => setSelectedCategory(cat.key)}
                           className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                              active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:bg-muted hover:text-foreground"
                           )}
                        >
                           <CatIcon className="w-4 h-4" /> {cat.label}
                        </button>
                     )
                  })}
               </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
               <div className="p-6 border-b border-border bg-card flex items-center justify-between">
                  <div className="relative group w-full max-w-sm">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                     <input 
                        value={templateSearch} 
                        onChange={e => setTemplateSearch(e.target.value)} 
                        placeholder="Search templates..."
                        className="w-full pl-11 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                     />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 hidden sm:block">
                     {filteredTemplates.length} Templates Open
                  </span>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
                     {filteredTemplates.map(t => (
                        <TemplateCard key={t.id} t={t} onUse={createNew} />
                     ))}
                  </div>

                  {filteredTemplates.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center p-12 text-muted-foreground/60">
                        <Layers className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-[12px] font-black uppercase tracking-widest">No templates match</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      )}

    </div>
  )
}
