"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { 
  Sparkles, Send, Building2, Users, GitBranch, Mail, 
  Search, Bot, FileText, X, ArrowUpCircle, Database,
  BarChart3, Zap, Eye, Command, MessageSquare, ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── types ─── */
interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

/* ─── data ─── */
const suggestions = [
  { icon: Eye, label: "Hot Visitors", desc: "Find high-intent accounts from 24h", color: "bg-emerald-500/10 text-emerald-500" },
  { icon: Users, label: "Enrich Leads", desc: "Run waterfall lookup on target list", color: "bg-indigo-500/10 text-indigo-500" },
  { icon: GitBranch, label: "Build Flow", desc: "Automate outbound for new signals", color: "bg-orange-500/10 text-orange-500" },
  { icon: Mail, label: "Draft Outreach", desc: "Personalize sequence with AI", color: "bg-purple-500/10 text-purple-500" },
]

/* ─── component ─── */
export default function UnifiedCopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
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
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Search Header */}
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
            <button className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors">
               <Settings className="w-4 h-4 text-muted-foreground" />
            </button>
         </div>
      </div>

      {/* Main Container */}
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
  )
}

function Settings({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  )
}
