"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
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
  { icon: Eye, label: "Find hot website visitors", desc: "Analyze recent high-intent companies", color: "bg-emerald-500/10 text-emerald-500" },
  { icon: Users, label: "Enrich leads", desc: "Run waterfall enrichment on contacts", color: "bg-indigo-500/10 text-indigo-500" },
  { icon: GitBranch, label: "Build workflow", desc: "Create automated GTM sequences", color: "bg-orange-500/10 text-orange-500" },
  { icon: Mail, label: "Run outreach", desc: "Launch personalized email campaigns", color: "bg-purple-500/10 text-purple-500" },
  { icon: Database, label: "Query database", desc: "Search companies and contacts", color: "bg-sky-500/10 text-sky-500" },
  { icon: BarChart3, label: "Analyze pipeline", desc: "Review conversion and performance", color: "bg-amber-500/10 text-amber-500" },
]

/* ─── component ─── */
export default function UnifiedCopilotPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialQuerySent = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    if (messages.length > 0) scrollToBottom()
  }, [messages, isTyping])

  const sendMessage = useCallback(async (text?: string) => {
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

    try {
      const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const headers = {
        "Content-Type": "application/json",
      }
      const authHeaders = typeof window !== 'undefined' ? (await import('@/lib/auth')).authService.getAuthHeaders() : {}
      Object.entries(authHeaders).forEach(([key, value]) => {
        if (value) headers[key] = value
      })

      const response = await fetch(`${BACKEND_BASE}/api/copilot/product-assistant`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question: content }),
      })

      if (!response.ok) {
        throw new Error("Failed to get AI response")
      }

      const data = await response.json()
      // Remove markdown asterisks for bold formatting
      const cleanContent = (data.response || data.answer || "I apologize, but I couldn't generate a response.")
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: cleanContent,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (error) {
      console.error("Failed to get AI response:", error)
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }, [input])

  useEffect(() => {
    const q = searchParams.get("q")
    if (q && !initialQuerySent.current) {
      initialQuerySent.current = true
      sendMessage(q)
    }
  }, [searchParams, sendMessage])

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
          <h2 className="text-lg font-black tracking-tight text-foreground">AI-powered GTM assistant</h2>
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
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">AI Ready</span>
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
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                     <div className="text-center space-y-4">
                        <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center mx-auto shadow-2xl shadow-primary/20">
                           <Sparkles className="w-10 h-10 text-primary" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase pt-4">What would you like to <span className="text-primary italic">do</span> ?</h2>
                        <p className="text-[13px] font-medium text-muted-foreground/60 max-w-md mx-auto leading-relaxed">
                           Query your database, analyze visitors, build workflows, or run outreach — all from one place.
                        </p>
                     </div>

                     {/* Input Bar (above suggestions) */}
                     <div className="max-w-3xl mx-auto">
                        <div className="flex flex-col bg-card border border-border rounded-xl p-4 shadow-sm transition-all focus-within:border-primary/30 focus-within:shadow-md">
                           <textarea
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                              placeholder="Ask anything... Find hot visitors, enrich leads, build workflows, run outreach"
                              className="w-full h-20 bg-transparent border-none outline-none resize-none px-2 py-1 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground"
                           />
                           <div className="flex items-center justify-between px-2 pt-2">
                              <span className="text-[11px] font-medium text-muted-foreground/40">Powered by Outmate AI</span>
                              <button
                                 onClick={() => sendMessage()}
                                 disabled={!input.trim()}
                                 className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 transition-all hover:bg-primary/90"
                              >
                                 <ArrowUpCircle className="w-5 h-5" />
                              </button>
                           </div>
                        </div>
                     </div>

                     {/* Suggestion Cards (below input) */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {suggestions.map((s, i) => (
                           <button
                              key={i}
                              onClick={() => sendMessage(s.label)}
                              className="group p-5 bg-card border border-border rounded-xl text-left hover:border-primary/20 hover:shadow-lg transition-all"
                           >
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", s.color)}>
                                 <s.icon className="w-4.5 h-4.5" />
                              </div>
                              <p className="text-[13px] font-bold text-foreground mb-1">{s.label}</p>
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

         {/* Bottom Input Bar (only when messages exist) */}
         {hasMessages && (
            <div className="p-8 bg-gradient-to-t from-background via-background to-transparent">
               <div className="max-w-3xl mx-auto">
                  <div className="flex flex-col bg-card border border-border rounded-xl p-4 shadow-sm transition-all focus-within:border-primary/30 focus-within:shadow-md">
                     <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        placeholder="Ask anything... Find hot visitors, enrich leads, build workflows, run outreach"
                        className="w-full h-20 bg-transparent border-none outline-none resize-none px-2 py-1 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground"
                     />
                     <div className="flex items-center justify-between px-2 pt-2">
                        <span className="text-[11px] font-medium text-muted-foreground/40">Powered by Outmate AI</span>
                        <button
                           onClick={() => sendMessage()}
                           disabled={!input.trim()}
                           className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30 transition-all hover:bg-primary/90"
                        >
                           <ArrowUpCircle className="w-5 h-5" />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}

      </div>
      </div>
    </div>
  )
}
