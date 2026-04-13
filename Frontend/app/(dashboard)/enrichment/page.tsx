"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  Settings, List, Plus, X, Search, Filter, ArrowUpDown,
  History, Download, ExternalLink, ChevronRight,
  ArrowUp, Sparkles, Zap, Mail, Building2, Star, PenLine,
  Shield, Globe, Phone, TrendingUp, FileText, Hash,
  MessageSquare, Target, Award, Coins, Users
} from "lucide-react"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/* ─── types ─── */
interface Person {
  id: number
  firstName: string
  lastName: string
  company: string
  title: string
  email: string | null
  emailStatus: "Verified" | "Unverified" | "Invalid" | null
  phone: string | null
  linkedin: string
  icpScore: number
  companyBrief: string
  avatarColor: string
}

interface ChatMsg {
  role: "user" | "ai"
  text: string
  columnTag?: string
}

interface DynamicColumn {
  id: string
  label: string
  type: "enrichment" | "ai" | "company"
  data: Record<number, string>
}

/* ─── data ─── */
const PEOPLE: Person[] = [
  { id: 1, firstName: "Carolyn", lastName: "Maury", company: "Accelevate Solutions", title: "VP Sales", email: "c.maury@accelevate.io", emailStatus: "Verified", phone: "+1 415 555 0121", linkedin: "linkedin.com/in/carolynmaury", icpScore: 92, companyBrief: "B2B SaaS platform for sales acceleration", avatarColor: "bg-indigo-500" },
  { id: 2, firstName: "Andrés", lastName: "Peña", company: "Valiot", title: "Head of Growth", email: "andres.p@valiot.io", emailStatus: "Verified", phone: null, linkedin: "linkedin.com/in/andrespena", icpScore: 87, companyBrief: "Industrial IoT analytics platform", avatarColor: "bg-emerald-500" },
]

/* ─── component ─── */
export default function EnrichmentPage() {
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [panelOpen, setPanelOpen] = useState(true)
  const [dynamicColumns, setDynamicColumns] = useState<DynamicColumn[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState(0)
  const [enrichingRow, setEnrichingRow] = useState(-1)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return
    const userMsg: ChatMsg = { role: "user", text: chatInput }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput("")

    // Simple AI mock
    setTimeout(() => {
       const aiMsg: ChatMsg = { 
          role: "ai", 
          text: "I've analyzed your table. Found 3 missing emails and added an ICP score column based on your criteria.",
          columnTag: "ICP Score"
       }
       setChatMessages(prev => [...prev, aiMsg])
       runEnrichment()
    }, 600)
  }, [chatInput])

  const runEnrichment = useCallback(() => {
    setIsRunning(true)
    setEnrichProgress(0)
    let row = 0
    const interval = setInterval(() => {
      row++
      if (row >= PEOPLE.length) {
        clearInterval(interval)
        setIsRunning(false)
        setEnrichingRow(-1)
        setEnrichProgress(100)
      } else {
        setEnrichingRow(row)
        setEnrichProgress(Math.round((row / PEOPLE.length) * 100))
      }
    }, 400)
  }, [])

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-[12px] font-bold text-foreground">
          <span className="text-muted-foreground font-medium">All Files</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span>Waterfall Enrichment Table</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-2">Enterprise</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-bold">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground font-black uppercase tracking-widest">24,800 Credits</span>
           </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* AI Panel */}
         {panelOpen && (
            <aside className="w-[320px] border-r border-border bg-card flex flex-col shrink-0">
               <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white">
                        <Sparkles className="w-4 h-4" />
                     </div>
                     <span className="text-sm font-black uppercase tracking-widest">AI Co-pilot</span>
                  </div>
                  <Button onClick={() => setPanelOpen(false)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground">
                    <X className="w-4 h-4" />
                  </Button>
               </div>
               
               <div className="flex-1 overflow-auto p-4 space-y-4 no-scrollbar">
                  {chatMessages.length === 0 && (
                     <p className="text-[12px] font-medium text-muted-foreground/60 leading-relaxed">
                        I'm your enrichment co-pilot. Ask me to find missing emails, score leads based on ICP, or generate outreach openers.
                     </p>
                  )}
                  {chatMessages.map((msg, i) => (
                     <div key={i} className={cn("flex flex-col gap-1", msg.role === 'user' ? "items-end" : "items-start")}>
                        <div className={cn("max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium leading-relaxed", 
                           msg.role === 'user' ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted/50 border border-border")}>
                           {msg.text}
                        </div>
                        {msg.columnTag && (
                           <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 border border-primary/20 rounded-full">
                              <Zap className="w-3 h-3 text-primary" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary">{msg.columnTag} Layer Added</span>
                           </div>
                        )}
                     </div>
                  ))}
                  <div ref={chatEndRef} />
               </div>

               <div className="p-4 border-t border-border bg-muted/20">
                  <div className="relative">
                     <textarea 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        placeholder="Ask co-pilot..."
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[80px] resize-none"
                     />
                     <Button onClick={sendMessage} className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-primary hover:bg-primary/90">
                        <ArrowUp className="w-4 h-4" />
                     </Button>
                  </div>
               </div>
            </aside>
         )}

        {/* Table Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-muted/5">
           <div className="p-4 border-b border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                 {!panelOpen && (
                    <Button onClick={() => setPanelOpen(true)} variant="outline" size="icon" className="h-8 w-8 rounded-lg">
                       <Sparkles className="w-4 h-4 text-primary" />
                    </Button>
                 )}
                 <div className="flex h-8 items-center gap-2 px-3 border border-border rounded-lg bg-emerald-500/5 text-emerald-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Auto-run Active</span>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <Button variant="outline" className="h-8 px-3 text-[10px] font-black uppercase tracking-widest border-border gap-2">
                    <Filter className="w-3.5 h-3.5 opacity-40" />
                    Advanced Filters
                 </Button>
                 <Button className="h-8 px-4 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 gap-2">
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                 </Button>
              </div>
           </div>

           {/* Progress */}
           <div className="h-1 w-full bg-border/50 relative">
              <div 
                 className="h-full bg-primary transition-all duration-300 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" 
                 style={{ width: `${enrichProgress}%` }}
              />
           </div>

           <div className="flex-1 overflow-auto p-4 no-scrollbar">
              <div className="bg-card border border-border rounded-[24px] overflow-hidden shadow-xl shadow-black/[0.02]">
                 <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                       <tr className="bg-muted/30 border-b border-border">
                          <th className="p-4 w-12"><div className="w-4 h-4 rounded border border-border" /></th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Profile</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Role & Co.</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5">Work Email</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5">Verification</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-500/5">ICP Score</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 text-right">Actions</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                       {PEOPLE.map((p, idx) => (
                         <tr key={p.id} className="group hover:bg-muted/10 transition-colors">
                            <td className="p-4 w-12"><div className="w-4 h-4 rounded border border-border group-hover:border-primary transition-colors" /></td>
                            <td className="p-4">
                               <div className="flex items-center gap-3">
                                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black", p.avatarColor)}>
                                     {p.firstName[0]}{p.lastName[0]}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="text-[13px] font-black text-foreground uppercase tracking-tight">{p.firstName} {p.lastName}</span>
                                     <span className="text-[10px] font-bold text-muted-foreground/40">{p.linkedin}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="p-4">
                               <div className="flex flex-col">
                                  <span className="text-[12px] font-bold text-foreground">{p.title}</span>
                                  <span className="text-[11px] font-black uppercase tracking-widest text-primary/60">{p.company}</span>
                               </div>
                            </td>
                            <td className="p-4 bg-primary/[0.02]">
                               <span className="text-[12px] font-bold text-primary">{p.email}</span>
                            </td>
                            <td className="p-4 bg-primary/[0.02]">
                               <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg w-fit">
                                  <Shield className="w-3 h-3" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">{p.emailStatus}</span>
                               </div>
                            </td>
                            <td className="p-4 bg-emerald-500/[0.02]">
                               <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-12 bg-border/50 rounded-full overflow-hidden">
                                     <div className="h-full bg-emerald-500" style={{ width: `${p.icpScore}%` }} />
                                  </div>
                                  <span className="text-[11px] font-black text-emerald-600">{p.icpScore}</span>
                               </div>
                            </td>
                            <td className="p-4 text-right">
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </main>
      </div>
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
