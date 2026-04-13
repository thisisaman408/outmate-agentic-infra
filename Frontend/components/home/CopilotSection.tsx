"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Sparkles,
  ArrowRight,
  ArrowUpCircle,
  Search,
  GitBranch,
  Users,
  Mail,
  Eye,
  TrendingDown,
  UserPlus,
  RefreshCw,
  Play,
  SlidersHorizontal,
  ExternalLink,
  Zap,
} from "lucide-react"

const suggestions = [
  {
    id: 1,
    icon: Eye,
    title: "5 high-intent visitors on /pricing",
    context: "TechVault Labs, FounderOS, and 3 others visited pricing in the last hour",
    accent: "text-destructive",
    accentBg: "bg-destructive/10",
    tag: "Website Visitors",
  },
  {
    id: 2,
    icon: UserPlus,
    title: "12 new ICP matches detected",
    context: "Scored 85+ from today's visitor identification batch",
    accent: "text-primary",
    accentBg: "bg-primary/10",
    tag: "ICP Match",
  },
  {
    id: 3,
    icon: RefreshCw,
    title: "CRM follow-ups overdue for 8 contacts",
    context: "Last touchpoint was 7+ days ago — re-engagement recommended",
    accent: "text-amber-500",
    accentBg: "bg-amber-500/10",
    tag: "CRM Update",
  },
  {
    id: 4,
    icon: TrendingDown,
    title: "Outbound sequence open rate dropped 11%",
    context: "Q2 Enterprise Outbound sequence needs subject line optimization",
    accent: "text-orange-500",
    accentBg: "bg-orange-500/10",
    tag: "Workflow",
  },
]

const quickActions = [
  { icon: Search, label: "Find companies", href: "/leads/companies" },
  { icon: GitBranch, label: "Build workflow", href: "/workflows" },
  { icon: Users, label: "Enrich leads", href: "/visitors" },
  { icon: Mail, label: "Run outreach", href: "/copilot" },
]

export default function CopilotSection() {
  const [input, setInput] = useState("")

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">Copilot</h2>
            <p className="text-[10px] text-muted-foreground font-medium">AI-powered suggestions & actions</p>
          </div>
        </div>
        <Link
          href="/copilot"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          Open Copilot <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* Input */}
        <div className="border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Find visitors, enrich leads, build workflows, or run outreach..."
            className="w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[12px] font-medium outline-none min-h-[56px] placeholder:text-muted-foreground/40"
            rows={2}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <span className="text-[9px] text-muted-foreground/40 font-bold flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Powered by AI
            </span>
            <button
              className="p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors"
              disabled={!input.trim()}
            >
              <ArrowUpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Proactive Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Suggested Actions</h3>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{suggestions.length} new</span>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="group flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/20 hover:bg-muted/20 transition-all cursor-pointer"
              >
                <div className={`w-8 h-8 rounded-lg ${s.accentBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <s.icon className={`w-4 h-4 ${s.accent}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-bold text-foreground tracking-tight">{s.title}</span>
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{s.tag}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">{s.context}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Play className="w-2.5 h-2.5" /> Run
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <SlidersHorizontal className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2.5">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map((a, i) => (
              <Link
                key={i}
                href={a.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 hover:border-primary/20 transition-all group"
              >
                <a.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
