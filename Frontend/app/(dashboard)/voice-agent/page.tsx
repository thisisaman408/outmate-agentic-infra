"use client"

import React, { useState } from "react"
import { 
  BarChart3, Upload, Plus, Pause, Play, Sparkles, 
  Phone, Users, Calendar, Settings, Shield, MessageSquare,
  Flame, Target, Zap, Waves, Mic2, PhoneCall
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── data ─── */
const stats = [
  { label: "Calls Made", value: "247", trend: "+34 today", color: "text-emerald-500" },
  { label: "Meetings Booked", value: "18", trend: "7.3% Rate", color: "text-emerald-500" },
  { label: "Avg Duration", value: "2:14", trend: "min:sec", color: "text-muted-foreground" },
  { label: "Signal Triggered", value: "89", trend: "36% Volume", color: "text-primary" },
]

const recentCalls = [
  { name: "Sarah R.", company: "Stripe", signal: "Funding Round", outcome: "Booked", color: "bg-emerald-500/10 text-emerald-600", duration: "3:42" },
  { name: "Marcus K.", company: "Valiot", signal: "New VP Hired", outcome: "Call Back", color: "bg-orange-500/10 text-orange-600", duration: "1:18" },
]

/* ─── component ─── */
export default function VoiceAgentPage() {
  const [isActive, setIsActive] = useState(true)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Header */}
      <div className="px-8 py-6 bg-card border-b border-border flex items-center justify-between">
         <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
               <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Voice Node Active</span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Autonomous Voice Agent</h1>
         </div>
         <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 text-[10px] font-black uppercase tracking-widest border-border h-10 px-4 rounded-xl">
               <Upload className="w-3.5 h-3.5 opacity-40" />
               Upload List
            </Button>
            <Button className="gap-2 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground h-10 px-6 rounded-xl shadow-lg shadow-primary/20">
               <Plus className="w-3.5 h-3.5" />
               New Campaign
            </Button>
         </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 space-y-8 no-scrollbar bg-muted/5">
         <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               {stats.map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-[24px] p-6 shadow-xl shadow-black/[0.02]">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-2">{s.label}</p>
                     <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black tracking-tighter text-foreground">{s.value}</span>
                        <span className={cn("text-[10px] font-bold uppercase", s.color)}>{s.trend}</span>
                     </div>
                  </div>
               ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Config Section */}
               <div className="lg:col-span-2 space-y-8">
                  {/* Live Visualizer */}
                  <div className="bg-[#0F172A] border border-white/5 rounded-[32px] p-8 relative overflow-hidden group">
                     <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                        backgroundImage: "radial-gradient(circle at 2px 2px, #4F46E5 1px, transparent 0)",
                        backgroundSize: "24px 24px"
                     }} />
                     
                     <div className="relative z-10 flex flex-col items-center py-10">
                        <div className="flex items-end gap-1.5 h-16 mb-8 px-4">
                           {[20, 45, 30, 65, 40, 80, 50, 70, 35, 55, 25, 60, 45, 75, 40, 60, 30, 50, 20].map((h, i) => (
                              <div 
                                 key={i} 
                                 className="w-1.5 bg-primary/40 rounded-full animate-pulse group-hover:bg-primary transition-colors" 
                                 style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} 
                              />
                           ))}
                        </div>
                        <div className="flex flex-col items-center gap-4">
                           <div className="flex items-center gap-3 px-6 py-2 bg-white/5 border border-white/10 rounded-full">
                              <Mic2 className="w-4 h-4 text-primary" />
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Synthesizing: Alex (Warm EN-US)</span>
                           </div>
                           <button 
                              onClick={() => setIsActive(!isActive)}
                              className={cn("h-14 px-10 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all", 
                                 isActive ? "bg-red-500 text-white shadow-xl shadow-red-500/20" : "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20")}
                           >
                              {isActive ? (
                                 <><Pause className="w-4 h-4 fill-current" /> Pause Autonomous Outbound</>
                              ) : (
                                 <><Play className="w-4 h-4 fill-current" /> Resume Autonomous Outbound</>
                              )}
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* Script Editor */}
                  <div className="bg-card border border-border rounded-[32px] p-8 shadow-xl shadow-black/[0.02]">
                     <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                           <MessageSquare className="w-5 h-5 text-primary" />
                           <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-foreground">Interactive Call Script</h2>
                        </div>
                        <Button variant="outline" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-border gap-2">
                           <Sparkles className="w-3.5 h-3.5 text-primary" />
                           AI Rewrite
                        </Button>
                     </div>
                     <div className="space-y-6">
                        <div className="p-6 bg-muted/30 border border-border rounded-2xl min-h-[120px] font-medium text-[13px] leading-relaxed text-foreground/80">
                           "Hi <span className="text-primary font-black">{"{{first_name}}"}</span>, this is Alex from Outmate. I noticed <span className="text-primary font-black">{"{{company_name}}"}</span> just announced their Series B—congratulations. I saw you're hiring for Sales Dev, which usually means scaling outbound is a priority. Would it make sense to explore how autonomous agents could handle your top-of-funnel?"
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {["{{first_name}}", "{{company_name}}", "{{signal_event}}", "{{pain_point}}"].map(tag => (
                              <button key={tag} className="px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all">
                                 + {tag}
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>

               {/* Activity Sidebar */}
               <div className="space-y-8">
                  {/* Triggers */}
                  <div className="bg-card border border-border rounded-[32px] p-8 shadow-xl shadow-black/[0.02]">
                     <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-6">Execution Triggers</h2>
                     <div className="space-y-4">
                        {[
                           { name: "Funding Rounds", icon: <Waves className="w-4 h-4 text-primary" />, desc: "Call within 24h of Series A+" },
                           { name: "Executive Hires", icon: <Users className="w-4 h-4 text-indigo-500" />, desc: "Call when new VP Sales starts" },
                           { name: "Pricing Visits", icon: <Target className="w-4 h-4 text-emerald-500" />, desc: "Call when target visits pricing" },
                        ].map(trigger => (
                           <div key={trigger.name} className="flex items-center gap-4 p-4 rounded-2xl border border-border hover:border-primary/20 transition-all">
                              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                                 {trigger.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="text-[12px] font-black uppercase tracking-tight text-foreground truncate">{trigger.name}</p>
                                 <p className="text-[10px] font-bold text-muted-foreground/40 truncate">{trigger.desc}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-card border border-border rounded-[32px] p-8 shadow-xl shadow-black/[0.02]">
                     <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-6">Live Feed</h2>
                     <div className="space-y-6">
                        {recentCalls.map((call, i) => (
                           <div key={i} className="flex items-start gap-4 pb-6 border-b border-border last:border-0 last:pb-0">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                 <PhoneCall className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-1">
                                    <span className="text-[12px] font-black uppercase tracking-tight text-foreground">{call.name}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground/40">{call.duration}</span>
                                 </div>
                                 <p className="text-[10px] font-bold text-primary mb-2 uppercase">{call.company}</p>
                                 <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest", call.color)}>
                                    {call.outcome}
                                 </span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

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
