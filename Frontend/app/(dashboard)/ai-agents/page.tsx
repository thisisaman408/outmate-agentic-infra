"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mic, MicOff, Paperclip, ArrowUp,
  Bot, Search, Zap, Mail, Sparkles,
  Play, Settings, Code, Bug, TestTube,
  Plus, MoreHorizontal, ChevronRight, GripVertical,
  Check,
  Filter, Clock, MessageSquare, Database,
  Globe, FileText, Users, BarChart3,
  Linkedin, Phone, Target, Brain,
  Webhook, GitBranch, RefreshCw,
  Activity, CheckCircle2, Circle,
  RotateCcw, Copy, ExternalLink,
  Share2, Bell, BellRing, Download,
  Link, ToggleLeft, ToggleRight, AlertTriangle,
  PanelRightOpen, Layers, Send, X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

/* ── @ mention agents ─────────────────────── */
const mentionAgents = [
  { emoji: "🤖", name: "AI SDR", category: "Outbound Execution" },
  { emoji: "🗂", name: "Prospect Brief", category: "Research & Enrichment" },
  { emoji: "📡", name: "Intent Radar", category: "Signal Detection" },
  { emoji: "✉️", name: "Email Writer", category: "Outbound Execution" },
  { emoji: "💎", name: "Funding Scout", category: "Signal Detection" },
]

/* ── copilot conversation ─────────────────── */
interface CopilotMessage {
  id: string
  role: "user" | "assistant"
  content: string
  promptChange?: { title: string; applied: boolean }
  followUp?: string[]
}

const initialConversation: CopilotMessage[] = [
  {
    id: "1", role: "assistant",
    content: "I've analyzed your **ICP Outbound Agent** pipeline. Here's the current workflow:\n\n1. **Signal Detection**: Monitor hiring + funding signals for ICP companies\n2. **Waterfall Enrichment**: Multi-provider data enrichment for contacts\n3. **Lead Scoring**: AI-powered qualification with 80+ threshold\n4. **Email Sequence**: 5-step personalized outreach\n5. **CRM Update**: Push qualified leads to Salesforce\n\nThe pipeline looks solid. Would you like to optimize any specific step?",
    followUp: ["I want to add a LinkedIn touchpoint before email", "How can I improve the lead scoring accuracy?", "Add a condition to skip already-contacted leads"],
  },
]

/* ── canvas nodes ─────────────────────────── */
interface CanvasNode {
  id: string
  label: string
  type: "trigger" | "action" | "condition" | "output"
  emoji: string
  color: string
  y: number
  desc: string
  integration?: string
  outputPreview?: string
}

const initialNodes: CanvasNode[] = [
  { id: "n1", label: "Workflow Input Settings", type: "trigger", emoji: "⚡", color: "bg-teal-500/10 text-teal-500", y: 20, desc: "ICP match trigger · Hiring + Funding signals", integration: "Signal Engine", outputPreview: '{"matches": 12, "source": "LinkedIn Jobs"}' },
  { id: "n2", label: "Waterfall Enrich", type: "action", emoji: "✨", color: "bg-indigo-500/10 text-indigo-500", y: 170, desc: "Multi-provider data enrichment", integration: "Clearbit + Hunter", outputPreview: '{"enriched": 12, "match_rate": 0.92}' },
  { id: "n3", label: "Lead Scoring", type: "condition", emoji: "🎯", color: "bg-green-500/10 text-green-500", y: 320, desc: "Score ≥ 80 → qualified path", integration: "AI Scorer", outputPreview: '{"qualified": 8, "avg_score": 84.2}' },
  { id: "n4", label: "Email Sequence", type: "action", emoji: "✉️", color: "bg-purple-500/10 text-purple-500", y: 470, desc: "5-step personalized outreach", integration: "Gmail", outputPreview: '{"drafting": 8, "template": "outbound-v3"}' },
  { id: "n5", label: "CRM Update", type: "output", emoji: "🗂", color: "bg-teal-500/10 text-teal-500", y: 620, desc: "Push to Salesforce pipeline", integration: "Salesforce" },
]

export default function AgentStudioPage() {
  const [copilotMode, setCopilotMode] = useState<"build" | "debug" | "test">("build")
  const [input, setInput] = useState("")
  const [conversation, setConversation] = useState<CopilotMessage[]>(initialConversation)
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showOutputPanel, setShowOutputPanel] = useState(false)

  const sendMessage = (text?: string) => {
    const content = text || input.trim()
    if (!content) return
    setConversation(prev => [...prev, { id: Date.now().toString(), role: "user", content }])
    setInput("")
    setTimeout(() => {
      setConversation(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: "assistant",
        content: "I've analyzed the request. I recommend adding a **LinkedIn warm-up** step before the email sequence to increase reply rates by ~15%.",
        followUp: ["Apply this change", "Show benchmark comparison"],
      }])
    }, 1000)
  }

  return (
    <div className="flex h-full bg-background overflow-hidden font-sans">
      {/* Copilot Sidebar */}
      <aside className="w-[360px] border-r border-border bg-card flex flex-col shrink-0">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Copilot</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-transparent text-[8px] font-black uppercase tracking-widest">v2.4 ALPHA</Badge>
          </div>
          <div className="flex gap-1">
             <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-foreground">
                <RotateCcw className="w-4 h-4" />
             </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto no-scrollbar p-6 space-y-6">
           {conversation.map(msg => (
             <div key={msg.id} className={cn("flex flex-col gap-2", msg.role === 'user' ? 'items-end' : 'items-start')}>
                <div className={cn("max-w-[85%] p-4 rounded-2xl text-[11px] font-medium leading-relaxed", 
                  msg.role === 'user' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-tr-sm' : 'bg-muted/30 text-foreground rounded-tl-sm')}>
                   {msg.content}
                </div>
                {msg.followUp && (
                   <div className="flex flex-wrap gap-1.5 mt-1">
                      {msg.followUp.map(q => (
                        <button key={q} onClick={() => sendMessage(q)} className="text-[9px] font-black uppercase tracking-widest border border-border bg-card hover:bg-muted px-3 py-1.5 rounded-lg transition-all text-muted-foreground/60">
                           {q}
                        </button>
                      ))}
                   </div>
                )}
             </div>
           ))}
        </div>

        <div className="p-6 border-t border-border bg-muted/5 space-y-4">
           <div className="flex gap-1.5 p-1 bg-muted/30 rounded-xl max-w-fit">
              {(["build", "debug", "test"] as const).map(m => (
                <button
                   key={m}
                   onClick={() => setCopilotMode(m)}
                   className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                      copilotMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                   )}
                >
                   {m}
                </button>
              ))}
           </div>
           <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-indigo-500/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
              <div className="relative border border-border rounded-2xl bg-card overflow-hidden focus-within:border-primary transition-all shadow-xl shadow-black/5">
                 <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Ask Copilot to build or edit..."
                    className="w-full h-24 bg-transparent p-4 text-[11px] font-medium placeholder:text-muted-foreground/30 focus:outline-none resize-none"
                 />
                 <div className="px-3 py-2 bg-muted/20 border-t border-border flex items-center justify-between">
                    <div className="flex gap-2">
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-foreground rounded-lg">
                          <Paperclip className="w-3.5 h-3.5" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-foreground rounded-lg">
                          <Mic className="w-3.5 h-3.5" />
                       </Button>
                    </div>
                    <Button onClick={() => sendMessage()} disabled={!input} size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-lg active:scale-90 transition-all">
                       <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 overflow-hidden relative bg-muted/5 flex flex-col">
         {/* Canvas Header */}
         <div className="px-8 py-4 bg-card border-b border-border flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-orange-500" strokeWidth={1.5} />
               </div>
               <div>
                  <h1 className="text-sm font-black text-foreground uppercase tracking-widest leading-none">Global Outreach Pilot</h1>
                  <p className="text-[10px] font-bold text-muted-foreground/40 mt-1 uppercase tracking-widest">Last edited by Gautam Singh · 2h ago</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <Button onClick={() => setShowOutputPanel(!showOutputPanel)} variant="outline" className={cn("h-9 px-4 text-[10px] font-black uppercase tracking-widest border-border gap-2 rounded-xl transition-all", showOutputPanel && "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20")}>
                  <PanelRightOpen className="w-3.5 h-3.5" />
                  Live Console
               </Button>
               <Button variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-border gap-2 rounded-xl">
                  <Play className="w-3.5 h-3.5" />
                  Test Sequence
               </Button>
               <Button className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 rounded-xl gap-2 hover:bg-emerald-600 border-none transition-all">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Deploy Agent
               </Button>
            </div>
         </div>

         {/* Visual Canvas (Mock) */}
         <div className="flex-1 overflow-auto p-12 relative flex flex-col items-center gap-0 no-scrollbar" style={{ backgroundImage: "radial-gradient(hsl(var(--muted-foreground) / 0.1) 1px, transparent 1px)", backgroundSize: "32px 32px" }}>
            {nodes.map((node, i) => (
              <React.Fragment key={node.id}>
                <div onClick={() => setSelectedNode(node.id)} className={cn(
                  "w-[340px] bg-card border-2 rounded-3xl p-6 transition-all cursor-pointer relative group",
                  selectedNode === node.id ? "border-primary shadow-2xl shadow-primary/10" : "border-border hover:border-primary/20 shadow-xl shadow-black/[0.02]"
                )}>
                  <div className="absolute top-4 right-4 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/20">Step 0{i+1}</div>
                   <div className="flex items-center gap-4 mb-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner", node.color)}>
                         {node.emoji}
                      </div>
                      <div className="min-w-0">
                         <div className="text-[13px] font-black text-foreground uppercase tracking-widest truncate">{node.label}</div>
                         <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                            {node.integration}
                         </div>
                      </div>
                   </div>
                   <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed line-clamp-2">
                      {node.desc}
                   </p>
                   {selectedNode === node.id && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 mt-4 border-t border-border overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Preview Output</span>
                           <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md text-muted-foreground/40"><Copy className="w-2.5 h-2.5" /></Button>
                        </div>
                        <pre className="text-[10px] font-mono p-3 bg-muted/30 rounded-xl border border-border/50 text-indigo-500 overflow-x-auto whitespace-pre">
                           {JSON.stringify(JSON.parse(node.outputPreview || '{}'), null, 2)}
                        </pre>
                     </motion.div>
                   )}
                </div>
                {i < nodes.length - 1 && (
                  <div className="h-12 w-px bg-gradient-to-b from-primary/40 to-muted/20 relative">
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
                     </div>
                  </div>
                )}
              </React.Fragment>
            ))}
            
            <button className="mt-12 w-[340px] h-16 border-2 border-dashed border-border rounded-3xl flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 hover:border-primary/40 hover:text-primary/60 transition-all hover:bg-primary/5">
                <Plus className="w-4 h-4" /> Add Next Step
            </button>
         </div>

         {/* Output Slid-in Panel */}
         <AnimatePresence>
            {showOutputPanel && (
              <motion.aside 
                initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
                className="absolute right-0 top-0 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl z-20 flex flex-col">
                 <div className="p-8 border-b border-border flex items-center justify-between">
                    <div>
                       <h3 className="text-lg font-black tracking-tight text-foreground uppercase tracking-widest">Live Console</h3>
                       <div className="flex items-center gap-2 mt-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">System Operational</span>
                       </div>
                    </div>
                    <Button onClick={() => setShowOutputPanel(false)} variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground/40 hover:text-foreground rounded-2xl bg-muted/50">
                       <X className="w-4 h-4" />
                    </Button>
                 </div>
                 <div className="flex-1 overflow-auto no-scrollbar p-8 space-y-6 bg-muted/5">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="space-y-3">
                         <div className="flex items-center gap-3">
                            <Activity className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40">14:02:{20 + i * 14}</span>
                            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Enrichment Processed</span>
                         </div>
                         <div className="p-4 rounded-2xl bg-black font-mono text-[9px] text-emerald-500 overflow-x-auto border border-white/5 shadow-2xl">
                            {`> FETCHING DATA FROM SOURCE_0${i}...\n> SUCCESS: 128 RECORDS MATCHED\n> ENRICHING VIA CLEARBIT_V3...\n> QUALITY SCORE: 0.94\n> [OK]`}
                         </div>
                      </div>
                    ))}
                 </div>
                 <div className="p-8 border-t border-border bg-card">
                    <Button className="w-full h-11 bg-indigo text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-indigo/20">
                       Clear Logs
                    </Button>
                 </div>
              </motion.aside>
            )}
         </AnimatePresence>
      </main>
    </div>
  )
}
