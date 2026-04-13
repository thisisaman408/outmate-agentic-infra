import { useState } from "react";
import {
  Search, Command, Bot, Zap, Bookmark, Star, Play,
  ChevronDown, ChevronUp, X, Lock, Plus
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

/* ─── data ─── */

interface FilterDef {
  icon: string;
  label: string;
  locked?: boolean;
  tier?: "Growth" | "Scale";
  signalRow?: boolean;
  chips?: string[];
  expanded?: boolean;
}

const unlockedFilters: FilterDef[] = [
  { icon: "🏢", label: "Company", expanded: true, chips: ["Stripe", "Linear", "Attio"] },
  { icon: "🏷", label: "Industry & keywords", expanded: true, chips: ["SaaS"] },
  { icon: "👥", label: "# Employees" },
  { icon: "💵", label: "Revenue range" },
  { icon: "💰", label: "Funding stage", expanded: true, chips: ["Series A", "Series B"] },
  { icon: "⚙️", label: "Technologies" },
  { icon: "⚡", label: "Signals", signalRow: true },
  { icon: "📋", label: "Job postings" },
];

const lockedFilters: FilterDef[] = [
  { icon: "📈", label: "Headcount growth", locked: true, tier: "Growth" },
  { icon: "🎯", label: "Buying intent", locked: true, tier: "Growth" },
  { icon: "💡", label: "Intent topics", locked: true, tier: "Growth" },
  { icon: "👁", label: "Website visitors", locked: true, tier: "Growth" },
  { icon: "🤖", label: "AI filters", locked: true, tier: "Growth" },
  { icon: "⭐", label: "ICP fit score", locked: true, tier: "Growth" },
  { icon: "📊", label: "Scores (composite)", locked: true, tier: "Scale" },
  { icon: "🔗", label: "Company lookalikes", locked: true, tier: "Scale" },
  { icon: "🧠", label: "Composite GTM score", locked: true, tier: "Scale" },
  { icon: "🗂", label: "SIC and NAICS", locked: true, tier: "Growth" },
  { icon: "🗺", label: "Territories", locked: true, tier: "Scale" },
  { icon: "🏦", label: "Parent accounts", locked: true, tier: "Scale" },
];

interface Company {
  initials: string;
  color: string;
  name: string;
  domain: string;
  industry: string;
  employees: string;
  funding: string;
  fundingColor: "green" | "blue" | "amber" | "gray";
  hq: string;
  tech: string[];
  signal: { emoji: string; label: string; heat: "hot" | "live" | "normal" | "none" } | null;
  hiring: { count: number; level: "high" | "medium" | "none" };
  icpScore: number;
  intent: number;
  aiBrief: "ready" | "generate" | "low";
  selected?: boolean;
}

const companies: Company[] = [
  { initials: "S", color: "#635BFF", name: "Stripe Inc.", domain: "stripe.com", industry: "Fintech SaaS", employees: "4k–7k", funding: "Series D+", fundingColor: "green", hq: "SF", tech: ["HubSpot", "AWS"], signal: { emoji: "💰", label: "Funding", heat: "hot" }, hiring: { count: 12, level: "high" }, icpScore: 92, intent: 4, aiBrief: "ready", selected: true },
  { initials: "L", color: "#5E6AD2", name: "Linear", domain: "linear.app", industry: "Dev tools", employees: "200–500", funding: "Series B", fundingColor: "blue", hq: "SF", tech: ["Figma", "Notion"], signal: { emoji: "👥", label: "Hiring", heat: "normal" }, hiring: { count: 5, level: "medium" }, icpScore: 87, intent: 3, aiBrief: "generate", selected: true },
  { initials: "R", color: "#FDB515", name: "Rippling", domain: "rippling.com", industry: "HR Tech", employees: "1k–3k", funding: "Series E", fundingColor: "green", hq: "NY", tech: ["Salesforce", "Okta"], signal: { emoji: "⚡", label: "Tech", heat: "normal" }, hiring: { count: 18, level: "high" }, icpScore: 78, intent: 3, aiBrief: "generate" },
  { initials: "A", color: "#2563EB", name: "Attio", domain: "attio.com", industry: "CRM SaaS", employees: "50–200", funding: "Series A", fundingColor: "amber", hq: "London", tech: ["Segment", "Intercom"], signal: { emoji: "📰", label: "News", heat: "live" }, hiring: { count: 3, level: "medium" }, icpScore: 84, intent: 4, aiBrief: "ready" },
  { initials: "A", color: "#4F46E5", name: "Apollo.io", domain: "apollo.io", industry: "Sales intel", employees: "500–1k", funding: "Series C", fundingColor: "blue", hq: "SF", tech: ["HubSpot", "Marketo"], signal: { emoji: "👁", label: "Visit", heat: "normal" }, hiring: { count: 9, level: "high" }, icpScore: 73, intent: 3, aiBrief: "generate" },
  { initials: "C", color: "#10B981", name: "Clay", domain: "clay.com", industry: "GTM tools", employees: "50–100", funding: "Series A", fundingColor: "amber", hq: "NY", tech: ["OpenAI", "Zapier"], signal: null, hiring: { count: 0, level: "none" }, icpScore: 61, intent: 2, aiBrief: "low" },
  { initials: "H", color: "#FF7A59", name: "HubSpot", domain: "hubspot.com", industry: "CRM", employees: "5k–10k", funding: "Public", fundingColor: "green", hq: "Boston", tech: ["Salesforce", "Segment"], signal: { emoji: "💰", label: "Funding", heat: "hot" }, hiring: { count: 31, level: "high" }, icpScore: 55, intent: 2, aiBrief: "generate" },
];

/* ─── helpers ─── */

const tierPill = (tier: "Growth" | "Scale") => {
  const cls = tier === "Growth"
    ? "bg-[rgba(147,51,234,.3)] text-[#C084FC]"
    : "bg-[rgba(239,68,68,.2)] text-[#FCA5A5]";
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{tier}</span>;
};

const fundingBadge = (c: Company) => {
  const map = { green: "bg-green-light text-green-text", blue: "bg-indigo-light text-indigo-text", amber: "bg-amber-light text-amber-text", gray: "bg-muted text-muted-foreground" };
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${map[c.fundingColor]}`}>{c.funding}</span>;
};

const signalChip = (s: Company["signal"]) => {
  if (!s) return <span className="text-[10px] text-muted-foreground">—</span>;
  const heat = s.heat === "hot" ? "bg-[rgba(239,68,68,.12)] text-destructive" : s.heat === "live" ? "bg-green-light text-green-text" : "bg-amber-light text-amber-text";
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${heat}`}>{s.emoji} {s.label}</span>;
};

const hiringBadge = (h: Company["hiring"]) => {
  if (h.level === "none") return <span className="text-[10px] text-muted-foreground">—</span>;
  const cls = h.level === "high" ? "bg-green-light text-green-text" : "bg-amber-light text-amber-text";
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>+{h.count} roles</span>;
};

const intentDots = (n: number) => (
  <div className="flex items-center gap-[3px]">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className={`w-[7px] h-[7px] rounded-full ${i <= n ? "bg-indigo" : "bg-border"}`} />
    ))}
  </div>
);

const scoreBar = (score: number) => (
  <div className="flex items-center gap-1.5">
    <div className="w-[44px] h-[5px] rounded-[3px] bg-border overflow-hidden">
      <div className="h-full rounded-[3px] bg-indigo" style={{ width: `${score}%` }} />
    </div>
    <span className="text-[10px] font-medium">{score}</span>
  </div>
);

/* ─── component ─── */

export default function CompaniesPage() {
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    Company: true, "Industry & keywords": true, "Funding stage": true,
  });
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    Company: ["Stripe", "Linear", "Attio"],
    "Industry & keywords": ["SaaS"],
    "Funding stage": ["Series A", "Series B"],
  });
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({ 0: true, 1: true });
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new");

  const toggleFilter = (label: string) => {
    setExpandedFilters(p => ({ ...p, [label]: !p[label] }));
  };

  const removeChip = (filter: string, chip: string) => {
    setFilterChips(p => ({ ...p, [filter]: (p[filter] || []).filter(c => c !== chip) }));
  };

  const toggleRow = (i: number) => {
    setSelectedRows(p => ({ ...p, [i]: !p[i] }));
  };

  const selectedCount = Object.values(selectedRows).filter(Boolean).length;
  const activeFilterCount = Object.values(filterChips).filter(v => v.length > 0).length;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ─── Filter sidebar ─── */}
      <aside className="w-[256px] min-w-[256px] h-full flex flex-col bg-card border-r border-border">
        {/* Search */}
        <div className="p-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input placeholder="Search companies..." className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {([["total", "Total", "4,847"], ["new", "Net New", "312"], ["saved", "Saved", "24"]] as const).map(([key, label, num]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex flex-col items-center py-2.5 relative ${activeTab === key ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span className="text-[16px] font-bold">{num}</span>
              <span className="text-[11px]">{label}</span>
              {activeTab === key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-indigo rounded-full" />}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex-1 overflow-y-auto">
          {/* Unlocked */}
          {unlockedFilters.map(f => {
            const isExpanded = expandedFilters[f.label];
            const chips = filterChips[f.label] || [];
            const hasChips = chips.length > 0;
            return (
              <div key={f.label}>
                <button
                  onClick={() => f.chips ? toggleFilter(f.label) : undefined}
                  className={`w-full flex items-center gap-2 px-3 h-[40px] text-left transition-colors hover:bg-muted ${
                    f.signalRow ? "text-amber-text" : hasChips ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="flex-1 text-[12px] font-medium">{f.label}</span>
                  {hasChips && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo text-primary-foreground">{chips.length}</span>
                  )}
                  {f.chips && (isExpanded ? <ChevronUp className="w-3 h-3 opacity-40" /> : <ChevronDown className="w-3 h-3 opacity-40" />)}
                </button>
                {isExpanded && hasChips && (
                  <div className="px-3 pb-2 pt-1 bg-muted/50 border-t border-border">
                    <div className="text-[10px] uppercase font-semibold mb-1.5 text-muted-foreground">Include</div>
                    <div className="flex flex-wrap gap-1">
                      {chips.map(c => (
                        <span key={c} className="flex items-center gap-1 text-[10px] font-medium px-2 py-[3px] rounded bg-indigo-light text-indigo-text">
                          {c}
                          <button onClick={() => removeChip(f.label, c)} className="opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-border" />

          {/* Locked */}
          {lockedFilters.map(f => (
            <Popover key={f.label}>
              <PopoverTrigger asChild>
                <button
                  className="w-full flex items-center gap-2 px-3 h-[40px] text-left cursor-default text-muted-foreground/55"
                >
                  <span className="flex-1 text-[12px]">{f.label}</span>
                  <Lock className="w-3 h-3 opacity-40" />
                  {f.tier && tierPill(f.tier)}
                </button>
              </PopoverTrigger>
              <PopoverContent side="right" className="w-[200px] p-3" style={{ boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[12px] font-semibold">Requires {f.tier} plan</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">Unlock {f.label.toLowerCase()} filtering to find high-intent accounts.</p>
                <button className="w-full py-1.5 bg-indigo text-white text-[11px] font-semibold rounded-md">Upgrade</button>
              </PopoverContent>
            </Popover>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-border">
          <button className="text-[11px] text-muted-foreground">Clear all · {activeFilterCount}</button>
          <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground">More filters</button>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-card">
        {/* Top action bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input placeholder="Search across Outmate..." className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border font-medium">⌘K</span>
          </div>
          <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
            <Bot className="w-3.5 h-3.5" /> Research with AI
          </button>
          <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
            <Zap className="w-3.5 h-3.5" /> Create workflow
          </button>
          <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
            <Bookmark className="w-3.5 h-3.5" /> Save search
          </button>
          <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
            <Star className="w-3.5 h-3.5" /> Auto-score
          </button>
          <button className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground bg-indigo px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
            <Play className="w-3.5 h-3.5" /> Run agent
          </button>
        </div>

        {/* Result bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">4,847</span> companies · <span className="font-semibold text-foreground">312</span> net new · {activeFilterCount} filters active
          </span>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-light text-indigo-text">{selectedCount} selected</span>
            )}
            <button className="text-[11px] text-muted-foreground hover:text-foreground">Export CSV</button>
            <button className="text-[11px] text-muted-foreground hover:text-foreground">Push to CRM</button>
            <button className="text-[11px] text-muted-foreground hover:text-foreground">Enrich all</button>
            <button className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-dashed border-border">+ AI column</button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-[36px] px-3 py-2 bg-muted text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">
                  <input type="checkbox" className="w-[14px] h-[14px] rounded-[3px] accent-indigo" />
                </th>
                {["Company", "Industry", "Employees", "Funding", "HQ", "Tech stack"].map(h => (
                  <th key={h} className="px-3 py-2 bg-muted text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">{h}</th>
                ))}
                {["⚡ Signal", "Hiring"].map(h => (
                  <th key={h} className="px-3 py-2 text-[10px] uppercase font-semibold border-b border-border" style={{ background: "rgba(251,191,36,.04)", color: "#D97706" }}>{h}</th>
                ))}
                {["ICP score", "Intent", "AI brief"].map(h => (
                  <th key={h} className="px-3 py-2 text-[10px] uppercase font-semibold border-b border-border" style={{ background: "rgba(79,70,229,.04)", color: "#4F46E5" }}>{h}</th>
                ))}
                <th className="px-3 py-2 bg-muted text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr
                  key={i}
                  className="group border-b border-border hover:bg-secondary/60 transition-colors"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selectedRows[i]}
                      onChange={() => toggleRow(i)}
                      className="w-[14px] h-[14px] rounded-[3px] accent-indigo"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: c.color }}>{c.initials}</div>
                      <div>
                        <div className="text-[12px] font-semibold leading-tight">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">{c.industry}</td>
                  <td className="px-3 py-2 text-[11px]">{c.employees}</td>
                  <td className="px-3 py-2">{fundingBadge(c)}</td>
                  <td className="px-3 py-2 text-[11px]">{c.hq}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {c.tech.map(t => (
                        <span key={t} className="text-[9px] font-medium px-1.5 py-[2px] rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </td>
                  {/* Signal cell */}
                  <td className="px-3 py-2 group-hover:bg-[rgba(251,191,36,.04)]" style={{ background: "rgba(251,191,36,.02)" }}>
                    {signalChip(c.signal)}
                  </td>
                  {/* Hiring cell */}
                  <td className="px-3 py-2 group-hover:bg-[rgba(251,191,36,.04)]" style={{ background: "rgba(251,191,36,.02)" }}>
                    {hiringBadge(c.hiring)}
                  </td>
                  {/* ICP score */}
                  <td className="px-3 py-2 group-hover:bg-[rgba(79,70,229,.04)]" style={{ background: "rgba(79,70,229,.02)" }}>
                    {scoreBar(c.icpScore)}
                  </td>
                  {/* Intent */}
                  <td className="px-3 py-2 group-hover:bg-[rgba(79,70,229,.04)]" style={{ background: "rgba(79,70,229,.02)" }}>
                    {intentDots(c.intent)}
                  </td>
                  {/* AI brief */}
                  <td className="px-3 py-2 group-hover:bg-[rgba(79,70,229,.04)]" style={{ background: "rgba(79,70,229,.02)" }}>
                    {c.aiBrief === "ready" ? (
                      <span className="text-[11px] font-medium text-green">Ready ↗</span>
                    ) : c.aiBrief === "low" ? (
                      <span className="text-[11px] text-muted-foreground">Low priority</span>
                    ) : (
                      <button className="text-[11px] font-medium text-indigo hover:underline">Generate</button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                      Actions <ChevronDown className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
