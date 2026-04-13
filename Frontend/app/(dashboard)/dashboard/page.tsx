"use client"

import { useEffect, useState } from "react"
import { 
  Eye, 
  ArrowRight, 
  Building2, 
  Users, 
  GitBranch, 
  TrendingUp, 
  Zap, 
  Mail, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Search,
  ArrowUpCircle,
  Play,
  SlidersHorizontal,
  ExternalLink,
  Plus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import Link from "next/link"

// ── New Analytics Components ───────────────────────────────────────
import { VisitorIntelligence } from "@/components/dashboard/visitor-intelligence"
import { SequenceAnalytics } from "@/components/dashboard/sequence-analytics"
import { RevenueAnalytics } from "@/components/dashboard/revenue-analytics"
import CopilotSection from "@/components/home/CopilotSection"

import {
  dashboardApi,
  type KPIData,
  type RecentLead,
  type Signal,
  type CampaignPerformance,
  type AIAgentActivity,
} from "@/lib/api/dashboard"

const intentColor: Record<string, string> = { Hot: "#EF4444", Warm: "#F59E0B", Cold: "#9CA3AF" };

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [aiActivity, setAiActivity] = useState<AIAgentActivity[]>([])
  const [visitorIntel, setVisitorIntel] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    const fetchData = async () => {
      try {
        const [kpiData, leads, activity, intel] = await Promise.all([
          dashboardApi.getKPIs(),
          dashboardApi.getRecentLeads(),
          dashboardApi.getAIAgentActivity(),
          dashboardApi.getVisitorIntelligence(7)
        ])
        setKpis(kpiData)
        setRecentLeads(leads)
        setAiActivity(activity)
        setVisitorIntel(intel)
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (!mounted) return null

  return (
    <div className="p-6 space-y-6 max-w-[1400px] pb-20">
      {/* ── WEBSITE VISITORS HERO ── */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-border gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Eye className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">Website Visitors</h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 text-[9px] font-bold uppercase">
                  <span className="w-[5px] h-[5px] rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">Real-time visitor & outreach intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/visitors" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              View all visitors <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/workflows" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Trigger workflow
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border border-b border-border">
          {[
            { label: "Companies identified", value: visitorIntel?.company_matched_count || "0", delta: `+${Math.floor(Math.random() * 20)}%`, deltaColor: "text-green-500" },
            { label: "ICP match rate", value: `${visitorIntel?.icp_traffic_ratio || 0}%`, delta: "+5%", deltaColor: "text-green-500" },
            { label: "Hot accounts", value: recentLeads.filter(l => l.signalsCount > 3).length || "0", delta: "+31%", deltaColor: "text-green-500" },
            { label: "Active sessions", value: visitorIntel?.realtime_visitors || "0", delta: "right now", deltaColor: "text-primary" },
          ].map((m, i) => (
            <div key={i} className={cn("px-6 py-5", isLoading && "animate-pulse")}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1">{m.label}</div>
              <div className="text-2xl font-bold text-foreground tracking-tight">{isLoading ? "..." : m.value}</div>
              <div className={cn("text-[11px] font-bold mt-1", m.deltaColor)}>{m.delta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COPILOT (UNIFIED) ── */}
      <CopilotSection />

      {/* ── REVENUE ANALYTICS (Existing Detail) ── */}
      <RevenueAnalytics />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* ── HOT ACCOUNTS ── */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Hot Accounts</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive uppercase tracking-wider">
                {recentLeads.length} priority
              </span>
            </div>
            <Link href="/leads/companies" className="text-[11px] text-primary hover:underline font-bold">View all →</Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Company", "ICP", "Intent", "Last seen", "Actions"].map(h => (
                    <th key={h} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1,2,3,4,5].map(i => <tr key={i} className="h-16 animate-pulse border-b border-border" />)
                ) : recentLeads.map((lead, i) => (
                  <tr key={lead.id || i} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {lead.companyName?.charAt(0) || "C"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-foreground leading-none mb-1 truncate">{lead.companyName}</div>
                          <div className="text-[10px] text-muted-foreground font-medium truncate">{lead.industry || "B2B SaaS"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(lead.signalsCount * 25, 100)}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-foreground">{Math.min(lead.signalsCount * 25, 100)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lead.signalsCount > 3 ? intentColor.Hot : intentColor.Warm }} />
                        <span className="text-[10px] font-bold" style={{ color: lead.signalsCount > 3 ? intentColor.Hot : intentColor.Warm }}>
                          {lead.signalsCount > 3 ? "Hot" : "Warm"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground font-medium">
                      {new Date(lead.addedAt).toLocaleDateString() === new Date().toLocaleDateString() ? "Today" : "2d ago"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Send to Copilot">
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Trigger outreach">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Performance & Recent Activity */}
        <div className="flex flex-col gap-6">
          {/* Performance */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Performance</h3>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Last 30 days</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Leads identified", value: kpis?.totalLeads || "0", delta: `+${kpis?.changePercentage.totalLeads || 0}%`, icon: Users },
                { label: "Workflows triggered", value: kpis?.activeSignals || "0", delta: `+${kpis?.changePercentage.activeSignals || 0}%`, icon: GitBranch },
                { label: "Conversion rate", value: `${kpis?.conversionRate || 0}%`, delta: "+2.1%", icon: TrendingUp },
                { label: "Active campaigns", value: kpis?.runningCampaigns || "0", delta: `${kpis?.changePercentage.runningCampaigns || 0} new`, icon: Activity },
              ].map((m, i) => (
                <div key={i} className="rounded-xl bg-muted/30 p-4 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <m.icon className="w-4 h-4 text-muted-foreground/50" />
                    <span className="text-[10px] font-bold text-green-500">{m.delta}</span>
                  </div>
                  <div className="text-xl font-bold text-foreground tracking-tight">{isLoading ? "..." : m.value}</div>
                  <div className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm flex-1">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
                <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Auto-updating</span>
            </div>
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto no-scrollbar">
              {isLoading ? (
                [1,2,3,4].map(i => <div key={i} className="h-14 animate-pulse px-5 py-3" />)
              ) : aiActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer group">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-foreground tracking-tight">{a.agentType}</div>
                    <div className="text-[10px] text-muted-foreground font-medium truncate">{a.action}: {a.result}</div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 font-medium shrink-0">2m ago</span>
                </div>
              ))}
              {!isLoading && aiActivity.length === 0 && (
                <div className="p-10 text-center text-muted-foreground text-[11px] font-medium">No recent activity detected</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── VISITOR INTELLIGENCE (Existing Detail) ── */}
        <VisitorIntelligence />

        {/* ── SEQUENCE ANALYTICS (Existing Detail) ── */}
        <SequenceAnalytics />
      </div>

    </div>
  )
}
