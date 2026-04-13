import { Link } from "react-router-dom";
import {
  Eye, ArrowRight, Building2, Users, GitBranch,
  TrendingUp, Zap, Mail, Activity, Clock,
  CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";
import CopilotSection from "@/components/home/CopilotSection";

/* ── DATA ── */
const hotAccounts = [
  { name: "TechVault Labs", initials: "TV", color: "#4F46E5", industry: "SaaS · 51-200", icpScore: 91, intent: "Hot", pages: ["/pricing", "/enterprise"], lastSeen: "2m ago" },
  { name: "FounderOS", initials: "FO", color: "#F59E0B", industry: "Productivity · 1-10", icpScore: 94, intent: "Hot", pages: ["/enterprise", "/api-docs"], lastSeen: "1h ago" },
  { name: "Meridian Ops", initials: "MO", color: "#06B6D4", industry: "RevOps · 201-500", icpScore: 87, intent: "Hot", pages: ["/features", "/demo"], lastSeen: "11m ago" },
  { name: "Crestwave AI", initials: "CA", color: "#06B6D4", industry: "AI · 11-50", icpScore: 88, intent: "Hot", pages: ["/enterprise", "/api-docs"], lastSeen: "4h ago" },
  { name: "Novalytics", initials: "NV", color: "#EF4444", industry: "Data · 201-500", icpScore: 85, intent: "Hot", pages: ["/pricing", "/demo"], lastSeen: "3h ago" },
];

const recentActivity = [
  { icon: Building2, label: "12 new companies identified", detail: "Website Visitors", time: "2m ago", color: "text-primary" },
  { icon: GitBranch, label: "Outbound workflow triggered", detail: "Hot Visitor → Sequence", time: "8m ago", color: "text-green-500" },
  { icon: CheckCircle2, label: "Enrichment completed", detail: "47 contacts enriched (89% match)", time: "15m ago", color: "text-primary" },
  { icon: Mail, label: "Email sequence sent", detail: "Q2 Outbound · 23 recipients", time: "1h ago", color: "text-amber-500" },
  { icon: Zap, label: "Funding signal detected", detail: "Stripe raised Series D", time: "2h ago", color: "text-orange-500" },
  { icon: Users, label: "3 hot leads added to list", detail: "Enterprise Target Accounts", time: "3h ago", color: "text-purple-500" },
  { icon: AlertCircle, label: "ICP match: FounderOS", detail: "Score 94 · Pricing page 3x", time: "4h ago", color: "text-destructive" },
];

const intentColor: Record<string, string> = { Hot: "#EF4444", Warm: "#F59E0B", Cold: "#9CA3AF" };

export default function HomePage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* ── WEBSITE VISITORS HERO ── */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
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
              <p className="text-[10px] text-muted-foreground">Real-time visitor identification</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/visitor-id" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              View all visitors <ArrowRight className="w-3 h-3" />
            </Link>
            <Link to="/workflows" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              <GitBranch className="w-3.5 h-3.5" /> Trigger workflow
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-4 divide-x divide-border">
          {[
            { label: "Companies identified", value: "312", delta: "+24%", deltaColor: "text-green-500" },
            { label: "ICP match rate", value: "68%", delta: "+5%", deltaColor: "text-green-500" },
            { label: "Hot accounts", value: "47", delta: "+31%", deltaColor: "text-green-500" },
            { label: "Active sessions", value: "18", delta: "right now", deltaColor: "text-primary" },
          ].map((m, i) => (
            <div key={i} className="px-6 py-5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{m.label}</div>
              <div className="text-2xl font-bold text-foreground tracking-tight">{m.value}</div>
              <div className={`text-[11px] font-medium mt-1 ${m.deltaColor}`}>{m.delta}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COPILOT (UNIFIED) ── */}
      <CopilotSection />

      {/* ── HOT ACCOUNTS ── */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Hot Accounts</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
              {hotAccounts.length} priority
            </span>
          </div>
          <Link to="/visitor-id" className="text-[11px] text-primary hover:underline font-medium">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Company", "ICP", "Intent", "Pages", "Last seen", "Actions"].map(h => (
                  <th key={h} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hotAccounts.map((a, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: a.color }}>{a.initials}</div>
                      <div>
                        <div className="text-[12px] font-semibold text-foreground">{a.name}</div>
                        <div className="text-[10px] text-muted-foreground">{a.industry}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${a.icpScore}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground">{a.icpScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: intentColor[a.intent] }} />
                      <span className="text-[10px] font-semibold" style={{ color: intentColor[a.intent] }}>{a.intent}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {a.pages.map(p => (
                        <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-muted-foreground">{a.lastSeen}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Send to Copilot">
                        <Sparkles className="w-3 h-3" />
                      </button>
                      <button className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Trigger outreach">
                        <Mail className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── PERFORMANCE + RECENT ACTIVITY ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Performance */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">Performance</h3>
            <span className="text-[10px] text-muted-foreground">Last 30 days</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Leads identified", value: "1,247", delta: "+18%", icon: Users },
              { label: "Workflows triggered", value: "342", delta: "+24%", icon: GitBranch },
              { label: "Conversion rate", value: "12.4%", delta: "+2.1%", icon: TrendingUp },
              { label: "Active campaigns", value: "8", delta: "3 new", icon: Activity },
            ].map((m, i) => (
              <div key={i} className="rounded-xl bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <m.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-green-500">{m.delta}</span>
                </div>
                <div className="text-lg font-bold text-foreground">{m.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Recent Activity</h3>
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-[10px] text-muted-foreground">Auto-updating</span>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <a.icon className={`w-4 h-4 ${a.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-foreground">{a.label}</div>
                  <div className="text-[10px] text-muted-foreground">{a.detail}</div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
