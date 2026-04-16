"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { 
  Sparkles, Send, Building2, Users, GitBranch, Mail, 
  Search, Bot, FileText, X, ArrowUpCircle, Database,
  BarChart3, Zap, Eye, Command, MessageSquare, ChevronRight,
  Sun, Calendar, AlertTriangle, Signal, Settings as SettingsIcon, Layers
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/* ─── types ─── */
interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface CopilotFeature {
  id: string
  name: string
  description: string
  icon: any
  href: string
  badge?: string
  badgeColor?: string
}

/* ─── data ─── */
const copilotFeatures: CopilotFeature[] = [
  { 
    id: "chat", 
    name: "AI Chat", 
    description: "Conversational AI assistant", 
    icon: MessageSquare, 
    href: "/copilot",
  },
  { 
    id: "daily-brief", 
    name: "Daily Brief", 
    description: "AI-generated daily insights", 
    icon: Sun, 
    href: "/copilot/daily-brief",
    badge: "New",
    badgeColor: "green"
  },
  { 
    id: "meeting-prep", 
    name: "Meeting Prep", 
    description: "AI meeting preparation", 
    icon: Calendar, 
    href: "/copilot/meeting-prep",
  },
  { 
    id: "campaign-optimizer", 
    name: "Campaign Optimizer", 
    description: "AI campaign analysis", 
    icon: BarChart3, 
    href: "/copilot/campaign-optimizer",
  },
  { 
    id: "pipeline-alerts", 
    name: "Pipeline Alerts", 
    description: "AI pipeline monitoring", 
    icon: AlertTriangle, 
    href: "/copilot/pipeline-alerts",
  },
  { 
    id: "champion-alerts", 
    name: "Champion Alerts", 
    description: "Champion change detection", 
    icon: Signal, 
    href: "/copilot/champion-alerts",
  },
  { 
    id: "signal-drafts", 
    name: "Signal Drafts", 
    description: "AI-generated signal drafts", 
    icon: FileText, 
    href: "/copilot/signal-drafts",
  },
  { 
    id: "settings", 
    name: "Settings", 
    description: "Copilot preferences", 
    icon: SettingsIcon, 
    href: "/copilot/settings",
  },
]

const suggestions = [
  { icon: Eye, label: "Hot Visitors", desc: "Find high-intent accounts from 24h", color: "bg-emerald-500/10 text-emerald-500" },
  { icon: Users, label: "Enrich Leads", desc: "Run waterfall lookup on target list", color: "bg-indigo-500/10 text-indigo-500" },
  { icon: GitBranch, label: "Build Flow", desc: "Automate outbound for new signals", color: "bg-orange-500/10 text-orange-500" },
  { icon: Mail, label: "Draft Outreach", desc: "Personalize sequence with AI", color: "bg-purple-500/10 text-purple-500" },
]

/* ─── component ─── */
export default function UnifiedCopilotPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages, isTyping])

  const sendMessage = useCallback((text?: string) => {
    const content = text || input.trim()
    if (!content) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    // Mock AI Response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I've analyzed your request. Based on the current signals, I found **47 high-intent companies** active on your site today. 12 of them have raised funding in the last 30 days.\n\nWould you like me to trigger the **Series B Prospecting** workflow for these accounts?`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, response])
      setIsTyping(false)
    }, 1500)
  }, [input])

  const hasMessages = messages.length > 0

  return (
    <div className="flex h-full bg-background overflow-hidden font-sans">
      {/* Copilot Sidebar */}
      <aside className={cn(
        "w-64 border-r border-border bg-card flex flex-col transition-all duration-300",
        !sidebarOpen && "w-0 overflow-hidden"
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-primary">Copilot</span>
          </div>
          <h2 className="text-lg font-black tracking-tight text-foreground">AI Features</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {copilotFeatures.map((feature) => {
            const Icon = feature.icon
            const isActive = pathname === feature.href
            return (
              <button
                key={feature.id}
                onClick={() => router.push(feature.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground/40 group-hover:text-current")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider truncate">{feature.name}</p>
                  <p className="text-[10px] font-medium opacity-60 truncate">{feature.description}</p>
                </div>
                {feature.badge && (
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-black px-1.5 py-0.5 border-transparent",
                    feature.badgeColor === "green" && "bg-green-500/10 text-green-500",
                    isActive && "bg-white/20 text-white"
                  )}>
                    {feature.badge}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full h-9 text-[10px] font-black uppercase tracking-widest"
          >
            {sidebarOpen ? "Collapse" : "Expand"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 bg-card border-b border-border flex items-center justify-between">
         <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
               <Sparkles className="w-3.5 h-3.5 text-primary" />
               <span className="text-[10px] font-black uppercase tracking-widest text-primary">Intelligence Node</span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Outmate Copilot</h1>
         </div>
         <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl border border-border">
               <Command className="w-3 h-3 text-muted-foreground/40" />
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Shift + Enter to send</span>
            </div>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
               <Layers className="w-4 h-4 text-muted-foreground" />
            </button>
         </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-muted/5">
         
         {/* Message Feed */}
         <div className="flex-1 overflow-y-auto px-4 md:px-0 no-scrollbar">
            <div className="max-w-3xl mx-auto py-12 space-y-8">
               
               {!hasMessages && (
                  <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                     <div className="text-center space-y-4">
                        <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mx-auto shadow-2xl shadow-primary/20">
                           <Sparkles className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase pt-4">How can I help you <span className="text-primary italic">scale</span>?</h2>
                        <p className="text-[13px] font-medium text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
                           Autonomous research, waterfall enrichment, or workflow automation. Just ask and I'll execute.
                        </p>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {suggestions.map((s, i) => (
                           <button 
                              key={i}
                              onClick={() => sendMessage(s.label)}
                              className="group p-6 bg-card border border-border rounded-[24px] text-left hover:border-primary/20 hover:shadow-xl hover:shadow-black/[0.02] transition-all"
                           >
                              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", s.color)}>
                                 <s.icon className="w-5 h-5" />
                              </div>
                              <p className="text-[13px] font-black uppercase tracking-tight text-foreground mb-1">{s.label}</p>
                              <p className="text-[11px] font-medium text-muted-foreground/60">{s.desc}</p>
                           </button>
                        ))}
                     </div>
                  </div>
               )}

               {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                     <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", 
                        msg.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground border border-border")}>
                        {msg.role === "assistant" ? <Sparkles className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                     </div>
                     <div className={cn("max-w-[85%] space-y-2", msg.role === "user" ? "text-right" : "text-left")}>
                        <div className={cn("p-6 rounded-[24px] text-[14px] leading-relaxed font-medium shadow-sm", 
                           msg.role === "assistant" ? "bg-card border border-border text-foreground" : "bg-primary text-primary-foreground")}>
                           {msg.content.split('\n').map((line, j) => (
                              <p key={j} className={cn(j > 0 && "mt-2")}>{line}</p>
                           ))}
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 px-2">
                           {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                     </div>
                  </div>
               ))}

               {isTyping && (
                  <div className="flex gap-6 animate-in fade-in duration-300">
                     <div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-lg">
                        <Sparkles className="w-5 h-5" />
                     </div>
                     <div className="p-6 rounded-[24px] bg-card border border-border shadow-sm">
                        <div className="flex gap-1.5">
                           {[0, 1, 2].map(i => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                           ))}
                        </div>
                     </div>
                  </div>
               )}
               <div ref={messagesEndRef} />
            </div>
         </div>

         {/* Fixed Input Bar */}
         <div className="p-8 bg-gradient-to-t from-background via-background to-transparent">
            <div className="max-w-3xl mx-auto relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-[32px] blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
               <div className="relative flex flex-col bg-card border-2 border-border group-focus-within:border-primary/30 rounded-[32px] p-4 shadow-2xl transition-all">
                  <textarea 
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                     placeholder="Ask me to find visitors, enrich leads, or build a workflow..."
                     className="w-full h-24 bg-transparent border-none outline-none resize-none px-4 py-2 text-[14px] font-medium placeholder:text-muted-foreground/30 text-foreground"
                  />
                  <div className="flex items-center justify-between px-4 pt-2 pb-1 border-t border-border/10">
                     <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"><Database className="w-4 h-4" /></button>
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"><Zap className="w-4 h-4" /></button>
                        <div className="h-4 w-px bg-border mx-1" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Agent Context: Dashboard V3</span>
                     </div>
                     <button 
                        onClick={() => sendMessage()}
                        disabled={!input.trim()}
                        className="h-10 px-6 bg-primary text-primary-foreground rounded-2xl flex items-center gap-2 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
                     >
                        Execute <ArrowUpCircle className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>
         </div>

      </div>
      </div>
    </div>
  )
}
