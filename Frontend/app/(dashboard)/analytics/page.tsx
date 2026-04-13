"use client"

import React, { useState } from "react"
import { 
  BarChart3, 
  TrendingUp, 
  Calendar as CalendarIcon, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download,
  Activity,
  Zap,
  Target,
  Mail,
  CalendarCheck2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/* 
  NOTE: Real chart implementation would use Chart.js or Recharts.
  For this port, we are implementing the high-end UI structure.
  We'll use purely Tailwind & CSS for the visual representations of charts
  to ensure 100% compatibility without adding new heavy dependencies if possible,
  though the update used Chart.js. 
*/

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d")

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden font-sans">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
             <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-foreground uppercase tracking-widest">Global Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/30 p-1 rounded-xl border border-border/50">
             {["7d", "30d", "90d", "12m"].map(t => (
               <button
                 key={t}
                 onClick={() => setTimeRange(t)}
                 className={cn(
                   "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                   timeRange === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                 )}
               >
                 {t}
               </button>
             ))}
          </div>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <Button variant="outline" size="sm" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-border gap-2 rounded-xl">
             <Filter className="w-3.5 h-3.5 opacity-40" />
             Filters
          </Button>
          <Button className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-xl gap-2">
             <Download className="w-3.5 h-3.5" />
             Export
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Agent Runs", value: "14,802", trend: "+12.4%", up: true, icon: Activity },
              { label: "Signals Detected", value: "2,410", trend: "+18.2%", up: true, icon: Zap },
              { label: "Success Rate", value: "96.4%", trend: "+2.1%", up: true, icon: Target },
              { label: "Meetings Booked", value: "142", trend: "-4.2%", up: false, icon: CalendarCheck2 },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-3xl p-6 shadow-xl shadow-black/[0.02] group hover:border-primary/20 transition-all">
                <div className="flex items-center justify-between mb-4">
                   <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                      <stat.icon className="w-5 h-5" strokeWidth={1.5} />
                   </div>
                   <div className={cn("flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg", 
                     stat.up ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                      {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {stat.trend}
                   </div>
                </div>
                <h3 className="text-3xl font-black tracking-tighter text-foreground leading-none mb-1">{stat.value}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Performance Chart Placeholder */}
             <div className="lg:col-span-2 bg-card border border-border rounded-[32px] p-8 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                   <div>
                      <h3 className="text-xl font-black tracking-tight text-foreground uppercase tracking-widest leading-none">Agent Performance</h3>
                      <p className="text-[10px] font-bold text-muted-foreground/40 mt-1 uppercase tracking-widest">Network throughput vs Success rate</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                         <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Runs</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                         <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Success</span>
                      </div>
                   </div>
                </div>
                
                <div className="flex-1 flex items-end justify-between gap-4 pt-4">
                   {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                         <div className="w-full flex flex-col items-center justify-end gap-1 h-[200px]">
                            <div 
                              className="w-full max-w-[12px] bg-primary/20 rounded-t-full group-hover:bg-primary transition-all duration-500" 
                              style={{ height: `${20 + Math.random() * 60}%` }} 
                            />
                            <div 
                              className="w-full max-w-[12px] bg-green-500/40 rounded-t-full group-hover:bg-green-500 transition-all duration-500" 
                              style={{ height: `${10 + Math.random() * 40}%` }} 
                            />
                         </div>
                         <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}</span>
                      </div>
                   ))}
                </div>
             </div>

             {/* ROI Calculator / Quick View */}
             <div className="bg-card border border-border rounded-[32px] p-8 flex flex-col">
                <h3 className="text-xl font-black tracking-tight text-foreground uppercase tracking-widest leading-none mb-8">Efficiency ROI</h3>
                
                <div className="space-y-8 flex-1">
                   <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                         <span>Time Saved</span>
                         <span className="text-foreground">842 Hours</span>
                      </div>
                      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                         <div className="h-full w-[78%] bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)] rounded-full" />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-black text-muted-foreground uppercase tracking-widest">
                         <span>Cost Reduction</span>
                         <span className="text-foreground">$12,400</span>
                      </div>
                      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                         <div className="h-full w-[62%] bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)] rounded-full" />
                      </div>
                   </div>

                   <Separator className="opacity-50" />

                   <div className="space-y-4">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-amber-500" />
                         </div>
                         <div>
                            <div className="text-[11px] font-black text-foreground uppercase tracking-widest">AI Efficiency Score</div>
                            <p className="text-[10px] font-bold text-muted-foreground/40 mt-0.5">Top 3% of workspaces</p>
                         </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-muted/20 border border-border/50">
                         <div className="text-2xl font-black text-foreground">98.2</div>
                         <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">Excellent Performance</p>
                      </div>
                   </div>
                </div>

                <Button className="mt-8 h-12 w-full bg-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-primary/20">
                   Generate Full Report
                </Button>
             </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="bg-card border border-border rounded-[32px] overflow-hidden">
             <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-black tracking-tight text-foreground uppercase tracking-widest">Channel Distribution</h3>
                <div className="flex gap-2">
                   <Badge variant="secondary" className="bg-muted/50 text-muted-foreground font-black text-[9px] px-2 py-0.5 rounded-lg border-transparent">Last 30 Days</Badge>
                </div>
             </div>
             <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
                {[
                  { channel: "Email Outbound", count: "12,402", rate: "92%", color: "bg-indigo-500" },
                  { channel: "LinkedIn Automated", count: "3,110", rate: "84%", color: "bg-blue-400" },
                  { channel: "Social Signals", count: "1,240", rate: "98%", color: "bg-amber-400" },
                ].map(item => (
                  <div key={item.channel} className="space-y-4">
                     <div>
                        <div className="text-[11px] font-black text-foreground uppercase tracking-widest mb-1">{item.channel}</div>
                        <div className="text-3xl font-black tracking-tighter text-foreground">{item.count}</div>
                     </div>
                     <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                           <div className={cn("h-full rounded-full shadow-lg", item.color)} style={{ width: item.rate }} />
                        </div>
                        <span className="text-[11px] font-black text-foreground">{item.rate}</span>
                     </div>
                     <p className="text-[10px] font-bold text-muted-foreground/40 leading-relaxed uppercase tracking-widest">Conversion probability: <span className="text-foreground">22.4%</span></p>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
