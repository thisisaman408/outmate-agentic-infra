"use client"

import { useEffect, useState } from "react"
import { 
  Users, 
  Search, 
  Zap, 
  TrendingUp, 
  Activity, 
  ArrowRight, 
  Sparkles,
  SearchIcon,
  Workflow,
  Globe,
  Share2,
  MoreHorizontal,
  Mail,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

// ── New Analytics Components ───────────────────────────────────────
import { VisitorIntelligence } from "@/components/dashboard/visitor-intelligence"
import { SequenceAnalytics } from "@/components/dashboard/sequence-analytics"
import { RevenueAnalytics } from "@/components/dashboard/revenue-analytics"

import {
  dashboardApi,
  type KPIData,
  type RecentLead,
  type Signal,
  type CampaignPerformance,
} from "@/lib/api/dashboard"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [isLoadingLeads, setIsLoadingLeads] = useState(true)

  useEffect(() => {
    setMounted(true)
    const fetchLeads = async () => {
      try {
        const leads = await dashboardApi.getRecentLeads()
        setRecentLeads(leads)
      } finally {
        setIsLoadingLeads(false)
      }
    }
    fetchLeads()
  }, [])

  if (!mounted) return null

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* ── Header Section ────────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 p-6 rounded-2xl border border-border/40">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">GTM Command Center</h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
               <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               Real-time visitor & outreach intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl text-xs font-bold gap-2" onClick={() => window.location.href = '/integrations'}>
            Settings
          </Button>
          <Button size="sm" className="h-10 px-5 rounded-xl text-xs font-bold gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-primary-foreground transition-all active:scale-95" onClick={() => window.location.href = '/campaigns'}>
            <Zap className="h-3.5 w-3.5 fill-current" />
            New Campaign
          </Button>
        </div>
      </section>

      {/* ── 1. Revenue & ROI (Highest Priority) ───────────────────────── */}
      <RevenueAnalytics />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Main Analytics) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* ── 2. Visitor Intelligence ─────────────────────────────────── */}
          <VisitorIntelligence />

          {/* ── 3. Sequence Analytics ──────────────────────────────────── */}
          <SequenceAnalytics />

        </div>

        {/* Right Column (Tools & Alerts) */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Copilot Card */}
          <section className="p-7 rounded-[24px] bg-card border border-border/60 shadow-xl shadow-muted/20 overflow-hidden group">
            <div className="flex flex-col gap-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">AI Copilot</h2>
              </div>

              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within/input:text-primary">
                  <SearchIcon className="h-5 w-5" />
                </div>
                <Input 
                  placeholder="Ask about pipeline..." 
                  className="h-14 pl-12 pr-12 text-[15px] font-medium rounded-2xl bg-muted/40 border-border/40 focus:bg-background transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                   <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 active:scale-90 transition-transform cursor-pointer">
                     <ArrowUpIcon className="h-5 w-5" />
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                 <Button variant="ghost" className="justify-start gap-2 h-9 px-3 text-[11px] font-bold text-muted-foreground hover:text-primary">
                   <Activity className="h-3 w-3" /> "Summarize today's visitor intent"
                 </Button>
                 <Button variant="ghost" className="justify-start gap-2 h-9 px-3 text-[11px] font-bold text-muted-foreground hover:text-primary">
                   <Mail className="h-3 w-3" /> "Draft a follow up email for Founders"
                 </Button>
              </div>
            </div>
          </section>

          {/* System Actions */}
          <section className="bg-card p-6 rounded-[24px] border border-border/50 shadow-sm space-y-4">
             <h2 className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest leading-none">Quick Actions</h2>
             <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Search", icon: Search, href: "/ai-powered-search" },
                  { name: "Workflow", icon: Workflow, href: "/workflows" },
                  { name: "Enrich", icon: Zap, href: "/leads" },
                  { name: "Outreach", icon: Mail, href: "/campaigns" },
                ].map((action) => (
                  <Button 
                    variant="outline" 
                    key={action.name} 
                    className="h-20 flex flex-col gap-2 items-center justify-center rounded-xl bg-card border-border/50 hover:border-primary group transition-all"
                    onClick={() => window.location.href = action.href}
                  >
                    <action.icon className="h-5 w-5 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    <span className="text-[11px] font-bold text-muted-foreground/80 group-hover:text-primary">{action.name}</span>
                  </Button>
                ))}
             </div>
          </section>

        </div>
      </div>

      {/* ── Recent Prospects Table ─────────────────────────────────── */}
      <section className="bg-card p-7 rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-tight">Recent Pipeline Prospects</h2>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">{recentLeads.length} total</span>
          </div>
          <Button variant="link" className="text-xs font-bold text-primary p-0 h-auto" onClick={() => window.location.href='/leads'}>
             Manage Full Database <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/20">
                <th className="pb-4 text-[10px] font-bold text-muted-foreground tracking-[0.05em] uppercase px-2">Identity</th>
                <th className="pb-4 text-[10px] font-bold text-muted-foreground tracking-[0.05em] uppercase px-2">Score</th>
                <th className="pb-4 text-[10px] font-bold text-muted-foreground tracking-[0.05em] uppercase px-2 text-center">Status</th>
                <th className="pb-4 text-[10px] font-bold text-muted-foreground tracking-[0.05em] uppercase px-2">Source</th>
                <th className="pb-4 text-[10px] font-bold text-muted-foreground tracking-[0.05em] uppercase px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {isLoadingLeads ? (
                [1,2,3,4,5].map(i => <tr key={i} className="h-16 animate-pulse bg-muted overflow-hidden" />)
              ) : recentLeads.map((lead, i) => (
                <tr key={lead.id || i} className="group hover:bg-muted/20 transition-colors">
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center font-bold text-[11px] group-hover:bg-primary/10 transition-colors">
                         {lead.companyName?.charAt(0) || "U"}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight">{lead.contactName}</span>
                        <span className="text-[11px] text-muted-foreground font-medium truncate max-w-[150px]">{lead.companyName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <div className="h-1 flex-1 bg-muted rounded-full">
                        <div className="h-full bg-primary" style={{ width: `${(lead.signalsCount * 20) % 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground/80">{(lead.signalsCount * 20) % 100}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                      "bg-primary/10 text-primary"
                    )}>
                      Enriched
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-1.5 opacity-60">
                      <Globe className="h-3 w-3" />
                      <span className="text-[10px] font-medium truncate max-w-[100px]">{lead.industry || "B2B Tech"}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-primary/10 transition-all">
                         <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-muted transition-all">
                         <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoadingLeads && recentLeads.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Users className="h-8 w-8 opacity-20" />
              <p className="text-xs font-medium">No recent prospects active</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ArrowUpIcon(props: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
    </svg>
  )
}
