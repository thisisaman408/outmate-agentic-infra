"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  AlertTriangle,
  Signal,
  Briefcase,
  Loader2,
} from "lucide-react"
import { copilotApi, type DailyBriefPriorityAction, type DailyBriefResponse } from "@/lib/api/copilot"
import { getNotifications, type Notification } from "@/lib/api/notifications"

const tierIcon: Record<string, any> = {
  HOT_SIGNAL: Eye,
  INTERESTED_REPLY: Mail,
  CHAMPION_MOVE: UserPlus,
  FUNDING: TrendingDown,
  JOB_CHANGE: Briefcase,
  INTENT_SPIKE: Signal,
}

const tierAccent: Record<string, { text: string; bg: string }> = {
  HOT_SIGNAL: { text: "text-destructive", bg: "bg-destructive/10" },
  INTERESTED_REPLY: { text: "text-primary", bg: "bg-primary/10" },
  CHAMPION_MOVE: { text: "text-violet-500", bg: "bg-violet-500/10" },
  FUNDING: { text: "text-green-500", bg: "bg-green-500/10" },
  JOB_CHANGE: { text: "text-amber-500", bg: "bg-amber-500/10" },
  INTENT_SPIKE: { text: "text-orange-500", bg: "bg-orange-500/10" },
}

const priorityAccent: Record<string, { text: string; bg: string }> = {
  red: { text: "text-destructive", bg: "bg-destructive/10" },
  indigo: { text: "text-primary", bg: "bg-primary/10" },
  green: { text: "text-green-500", bg: "bg-green-500/10" },
}

interface SuggestionItem {
  id: string
  icon: any
  title: string
  context: string
  accent: string
  accentBg: string
  tag: string
  href?: string
}

const AGENTIC_INFRA_URL =
  process.env.NEXT_PUBLIC_AGENTIC_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:7860")

const quickActions: { icon: any; label: string; href: string; external?: boolean }[] = [
  { icon: Search, label: "Find companies", href: "/leads/companies" },
  { icon: GitBranch, label: "Build workflow", href: AGENTIC_INFRA_URL || "/workflows", external: !!AGENTIC_INFRA_URL },
  { icon: Users, label: "Enrich leads", href: "/visitors" },
  { icon: Mail, label: "Run outreach", href: "/copilot" },
]

export default function CopilotSection() {
  const [input, setInput] = useState("")
  const router = useRouter()
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchSuggestions = async () => {
      const items: SuggestionItem[] = []
      try {
        const [brief, notifs] = await Promise.allSettled([
          copilotApi.getDailyBrief(),
          getNotifications(true),
        ])

        if (brief.status === "fulfilled" && brief.value?.priority_actions?.length) {
          brief.value.priority_actions.slice(0, 3).forEach((a: DailyBriefPriorityAction, i: number) => {
            const style = tierAccent[a.tier] || { text: "text-muted-foreground", bg: "bg-muted" }
            const Icon = tierIcon[a.tier] || AlertTriangle
            items.push({
              id: `brief-${i}`,
              icon: Icon,
              title: a.action,
              context: a.reason + (a.entity ? ` — ${a.entity}` : ""),
              accent: style.text,
              accentBg: style.bg,
              tag: a.tier.replace(/_/g, " "),
              href: a.entity_type === "company"
                ? `/leads/companies?search=${encodeURIComponent(a.entity)}`
                : a.entity_type === "prospect"
                  ? `/copilot?q=${encodeURIComponent(`Tell me about ${a.entity}`)}`
                  : "/copilot/daily-brief",
            })
          })
        }

        if (notifs.status === "fulfilled" && notifs.value?.length) {
          notifs.value.slice(0, Math.max(0, 4 - items.length)).forEach((n: Notification, i: number) => {
            const style = priorityAccent[n.priority] || { text: "text-muted-foreground", bg: "bg-muted" }
            items.push({
              id: `notif-${n.id || i}`,
              icon: n.priority === "red" ? AlertTriangle : n.priority === "green" ? UserPlus : Signal,
              title: n.title,
              context: n.body,
              accent: style.text,
              accentBg: style.bg,
              tag: n.type?.replace(/_/g, " ") || "Alert",
              href: n.cta_url || undefined,
            })
          })
        }
      } catch {
        // silent — fallback to empty
      }

      if (!cancelled) {
        setSuggestions(items)
        setLoading(false)
      }
    }
    fetchSuggestions()
    return () => { cancelled = true }
  }, [])

  const handleRunSuggestion = (s: SuggestionItem) => {
    if (s.href) {
      router.push(s.href)
    } else {
      router.push(`/copilot?q=${encodeURIComponent(s.title)}`)
    }
  }

  const handleCustomizeSuggestion = (s: SuggestionItem) => {
    router.push(`/copilot?q=${encodeURIComponent(s.title + ": " + s.context)}`)
  }

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
              onClick={() => router.push("/copilot?q=" + encodeURIComponent(input.trim()))}
            >
              <ArrowUpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Proactive Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">Suggested Actions</h3>
            {!loading && suggestions.length > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{suggestions.length} new</span>
            )}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground/50">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-[11px] font-medium">Loading suggestions...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[11px] text-muted-foreground/50 font-medium">No suggestions right now. Check back later or use the input above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary/20 hover:bg-muted/20 transition-all cursor-pointer"
                  onClick={() => handleRunSuggestion(s)}
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
                    <button
                      className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleRunSuggestion(s) }}
                    >
                      <Play className="w-2.5 h-2.5" /> Run
                    </button>
                    <button
                      className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => { e.stopPropagation(); handleCustomizeSuggestion(s) }}
                    >
                      <SlidersHorizontal className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2.5">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map((a, i) => {
              const cls = "flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 hover:border-primary/20 transition-all group"
              const inner = (
                <>
                  <a.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{a.label}</span>
                </>
              )
              return a.external ? (
                <a key={i} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
              ) : (
                <Link key={i} href={a.href} className={cls}>{inner}</Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
