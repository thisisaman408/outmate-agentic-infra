import { useState, useMemo } from "react";
import {
  Search, Lock, ChevronDown, ChevronUp, X,
  Bot, Bookmark, Star, Play, Settings, Mic,
  Clock, ArrowRight, SlidersHorizontal,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

/* ─── types ─── */

interface FilterDef {
  label: string;
  locked?: boolean;
  tier?: "Starter" | "Growth" | "Scale";
  signalRow?: boolean;
  chips?: string[];
  expanded?: boolean;
  options?: string[];
  category?: string;
  advancedOptions?: { label: string; description: string }[];
}

/* ─── filter data ─── */

const activeFilters: FilterDef[] = [
  { label: "Current title", expanded: true, chips: ["VP Sales", "Head of Growth"] },
  { label: "Company", expanded: true, chips: ["Series A–C SaaS"] },
  { label: "Seniority level", expanded: true, chips: ["VP", "C-suite"] },
];

const unlockedFilters: FilterDef[] = [
  /* ── Identity ── */
  { label: "Name", category: "Identity", options: [], advancedOptions: [{ label: "Exact match", description: "Only show exact name matches" }, { label: "Exclude contacts", description: "Exclude already contacted people" }] },
  { label: "Current title", category: "Identity", options: ["VP Sales", "Head of Growth", "CRO", "Director of Sales", "Account Executive", "SDR Manager", "CMO", "Head of Marketing", "RevOps Lead", "BDR Manager"], advancedOptions: [{ label: "Include similar titles", description: "Match related job titles automatically" }, { label: "Exclude past titles", description: "Don't match on previous positions" }] },
  { label: "Past title", category: "Identity", options: ["VP Sales", "Head of Growth", "CRO", "Director of Sales", "Account Executive", "CMO", "Head of Marketing", "RevOps Lead"], advancedOptions: [{ label: "Within last 2 years", description: "Only titles held in the last 2 years" }] },
  { label: "Seniority level", category: "Identity", options: ["C-suite", "VP", "Director", "Senior IC", "Manager", "IC", "Founder"], advancedOptions: [{ label: "Include one level up/down", description: "Broaden to adjacent seniority" }] },
  { label: "Function / department", category: "Identity", options: ["Sales", "Marketing", "Engineering", "Product", "Operations", "Finance", "Customer Success", "Design"], advancedOptions: [{ label: "Cross-functional", description: "Include people spanning multiple departments" }] },

  /* ── Location & Language ── */
  { label: "Location", category: "Location", options: ["United States", "United Kingdom", "Germany", "France", "Canada", "Australia", "New York", "San Francisco", "London", "Berlin", "Austin", "Boston", "Chicago", "Toronto", "Paris", "Singapore"], advancedOptions: [{ label: "Include remote", description: "Include remote workers based in region" }, { label: "HQ location only", description: "Match company HQ, not person location" }] },
  { label: "Profile language", category: "Location", options: ["English", "Spanish", "French", "German", "Portuguese", "Chinese", "Japanese"], advancedOptions: [{ label: "Primary language only", description: "Exclude secondary languages" }] },

  /* ── Experience ── */
  { label: "Total years of experience", category: "Experience", options: ["0–2 years", "3–5 years", "6–10 years", "11–15 years", "16–20 years", "20+ years"], advancedOptions: [{ label: "Industry-specific", description: "Count only years in selected industry" }] },
  { label: "Years at company", category: "Experience", options: ["< 1 year", "1–2 years", "3–5 years", "5–10 years", "10+ years"] },
  { label: "Years in current role", category: "Experience", options: ["< 6 months", "6–12 months", "1–2 years", "2–5 years", "5+ years"] },

  /* ── Contact & Status ── */
  { label: "Email status", category: "Contact", options: ["Verified", "Unverified", "Invalid", "Catch-all", "No email"], advancedOptions: [{ label: "Verified only", description: "Strictly show verified emails" }] },
  { label: "Phone status", category: "Contact", options: ["Direct dial", "Mobile", "HQ number", "No phone"] },
  { label: "Source", category: "Contact", options: ["LinkedIn", "Website", "Referral", "Cold outbound", "Inbound", "Event", "Partner", "Import", "API", "Chrome extension"] },

  /* ── CRM & Activity ── */
  { label: "Owner", category: "CRM", options: ["Me", "Unassigned", "Team A", "Team B", "All owners"] },
  { label: "Stage", category: "CRM", options: ["New", "Contacted", "Qualified", "Meeting booked", "Opportunity", "Customer", "Disqualified", "Nurture"], advancedOptions: [{ label: "Exclude converted", description: "Hide already converted leads" }] },
  { label: "Last activity", category: "CRM", options: ["Today", "Last 7 days", "Last 30 days", "Last 90 days", "No activity", "More than 90 days ago"] },
  { label: "Keyword", category: "CRM", options: ["SaaS", "B2B", "AI/ML", "Fintech", "DevTools", "Cybersecurity", "E-commerce", "Cloud Infrastructure", "PLG", "Enterprise Sales"] },
];

const signalFilters: FilterDef[] = [
  { label: "Signals", signalRow: true, expanded: true, chips: ["Job change", "Promotion", "New hire"] },
  { label: "Job change signal", signalRow: true },
  { label: "Promotion signal", signalRow: true },
  { label: "Champion tracker", signalRow: true },
];

const starterLocked: FilterDef[] = [
  { label: "# Employees (company)", locked: true, tier: "Starter" },
  { label: "Revenue", locked: true, tier: "Starter" },
  { label: "Funding", locked: true, tier: "Starter" },
  { label: "Technologies", locked: true, tier: "Starter" },
  { label: "Job postings", locked: true, tier: "Starter" },
  { label: "Market segments", locked: true, tier: "Starter" },
  { label: "Industry & keywords", locked: true, tier: "Starter" },
];

const growthLocked: FilterDef[] = [
  { label: "Buying intent", locked: true, tier: "Growth" },
  { label: "Intent topics", locked: true, tier: "Growth" },
  { label: "Website visitors", locked: true, tier: "Growth" },
  { label: "Headcount growth", locked: true, tier: "Growth" },
  { label: "ICP fit score", locked: true, tier: "Growth" },
  { label: "People lookalikes", locked: true, tier: "Growth" },
  { label: "AI filters", locked: true, tier: "Growth" },
];

const scaleLocked: FilterDef[] = [
  { label: "Composite GTM score", locked: true, tier: "Scale" },
  { label: "Buying group signals", locked: true, tier: "Scale" },
  { label: "Territories", locked: true, tier: "Scale" },
  { label: "AI custom filter", locked: true, tier: "Scale" },
  { label: "Awards & certifications", locked: true, tier: "Scale" },
];

/* ─── people data ─── */

interface Person {
  initials: string;
  color: string;
  name: string;
  linkedin: string;
  title: string;
  company: string;
  companyInitials: string;
  companyColor: string;
  seniority: "C-suite" | "VP" | "Director" | "Senior IC" | "IC";
  location: string;
  experience: string;
  email: "Verified" | "Unverified" | "Invalid";
  signal: { label: string; heat: "hot" | "mid" | "live" } | null;
  jobChange: { label: string; recent: boolean } | null;
  timeInRole: string;
  icpScore: number;
  intent: number;
  aiBrief: "ready" | "generate" | "low";
  selected?: boolean;
}

const people: Person[] = [
  { initials: "SR", color: "#E11D48", name: "Sarah Richards", linkedin: "linkedin.com/in/srichards", title: "VP of Sales", company: "Rippling", companyInitials: "R", companyColor: "#FDB515", seniority: "VP", location: "New York", experience: "9 yrs", email: "Verified", signal: { label: "Job change", heat: "hot" }, jobChange: { label: "3 days", recent: true }, timeInRole: "3 months", icpScore: 94, intent: 4, aiBrief: "ready", selected: true },
  { initials: "MK", color: "#2563EB", name: "Marcus Klein", linkedin: "linkedin.com/in/mklein", title: "Head of Revenue", company: "Attio", companyInitials: "A", companyColor: "#2563EB", seniority: "Director", location: "London", experience: "12 yrs", email: "Verified", signal: { label: "Hiring spike", heat: "mid" }, jobChange: { label: "2 wks", recent: true }, timeInRole: "8 months", icpScore: 88, intent: 4, aiBrief: "generate", selected: true },
  { initials: "PW", color: "#7C3AED", name: "Priya Watts", linkedin: "linkedin.com/in/pwatts", title: "CRO", company: "Apollo.io", companyInitials: "A", companyColor: "#4F46E5", seniority: "C-suite", location: "San Francisco", experience: "15 yrs", email: "Verified", signal: { label: "Promotion", heat: "live" }, jobChange: { label: "1 wk", recent: true }, timeInRole: "1 month", icpScore: 91, intent: 5, aiBrief: "ready", selected: true },
  { initials: "DJ", color: "#0891B2", name: "David Jensen", linkedin: "linkedin.com/in/djensen", title: "VP Marketing", company: "Linear", companyInitials: "L", companyColor: "#5E6AD2", seniority: "VP", location: "Austin TX", experience: "11 yrs", email: "Unverified", signal: null, jobChange: null, timeInRole: "2 years", icpScore: 74, intent: 3, aiBrief: "generate" },
  { initials: "AL", color: "#059669", name: "Anita Lim", linkedin: "linkedin.com/in/alim", title: "Growth Lead", company: "Clay", companyInitials: "C", companyColor: "#10B981", seniority: "Senior IC", location: "New York", experience: "7 yrs", email: "Verified", signal: { label: "Funding", heat: "mid" }, jobChange: { label: "1 mo", recent: false }, timeInRole: "14 months", icpScore: 82, intent: 4, aiBrief: "generate" },
  { initials: "TC", color: "#DC2626", name: "Tom Castillo", linkedin: "linkedin.com/in/tcastillo", title: "Head of Sales", company: "HubSpot", companyInitials: "H", companyColor: "#FF7A59", seniority: "Director", location: "Boston", experience: "13 yrs", email: "Invalid", signal: { label: "Tech change", heat: "hot" }, jobChange: null, timeInRole: "3 years", icpScore: 58, intent: 2, aiBrief: "low" },
  { initials: "RN", color: "#635BFF", name: "Raj Nair", linkedin: "linkedin.com/in/rnair", title: "VP Revenue Ops", company: "Stripe", companyInitials: "S", companyColor: "#635BFF", seniority: "VP", location: "San Francisco", experience: "10 yrs", email: "Verified", signal: { label: "Job change", heat: "hot" }, jobChange: { label: "5 days", recent: true }, timeInRole: "5 months", icpScore: 89, intent: 4, aiBrief: "generate" },
  { initials: "EK", color: "#D97706", name: "Emma Kowalski", linkedin: "linkedin.com/in/ekowalski", title: "Head of GTM", company: "Rippling", companyInitials: "R", companyColor: "#FDB515", seniority: "Senior IC", location: "Berlin DE", experience: "6 yrs", email: "Verified", signal: { label: "New hire", heat: "live" }, jobChange: { label: "2 wks", recent: true }, timeInRole: "2 months", icpScore: 86, intent: 4, aiBrief: "generate" },
];

const exampleChips = [
  "VP Sales · Series A SaaS · EU",
  "CRO at recently funded fintech",
  "Head of Growth · dev tools · US",
  "GTM leaders who changed jobs last 30 days",
  "RevOps leads using HubSpot · 100–500 emp",
  "Founders at AI SaaS · raised last 6 months",
];

const recentSearches = [
  { filters: 4, time: "2 min ago", desc: "Title: VP Sales, Head of Growth · Seniority: VP, C-suite · Signal: Job change" },
  { filters: 3, time: "1 hr ago", desc: "Company size: 50–500 · Location: US + UK · Funding: Series A–C" },
  { filters: 2, time: "14 days ago", desc: "Title: CRO, Chief Revenue Officer · Signal: Promotion" },
  { filters: 1, time: "63 days ago", desc: "People lookalikes: Top 10 customers" },
];

/* ─── helpers ─── */

const tierPill = (tier: "Starter" | "Growth" | "Scale") => {
  const cls = tier === "Starter"
    ? "bg-amber-light text-amber-text"
    : tier === "Growth"
    ? "bg-purple-light text-purple-text"
    : "bg-[hsl(0_93%_94%)] text-[hsl(0_84%_40%)]";
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{tier}</span>;
};

const seniorityBadge = (s: Person["seniority"]) => {
  const map: Record<string, string> = {
    "C-suite": "bg-[hsl(0_93%_94%)] text-[hsl(0_72%_51%)]",
    "VP": "bg-indigo-light text-indigo-text",
    "Director": "bg-indigo-light text-indigo-text",
    "Senior IC": "bg-amber-light text-amber-text",
    "IC": "bg-muted text-muted-foreground",
  };
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${map[s]}`}>{s}</span>;
};

const emailBadge = (e: Person["email"]) => {
  const map: Record<string, string> = {
    Verified: "bg-green-light text-green-text",
    Unverified: "bg-amber-light text-amber-text",
    Invalid: "bg-[hsl(0_93%_94%)] text-[hsl(0_72%_51%)]",
  };
  return <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${map[e]}`}>{e}</span>;
};

const signalChip = (s: Person["signal"]) => {
  if (!s) return <span className="text-[10px] text-muted-foreground">—</span>;
  const heat = s.heat === "hot"
    ? "bg-[hsl(0_93%_94%)] text-[hsl(0_72%_51%)]"
    : s.heat === "live"
    ? "bg-green-light text-green-text"
    : "bg-amber-light text-amber-text";
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${heat}`}>{s.label}</span>;
};

const jobChangeBadge = (j: Person["jobChange"]) => {
  if (!j) return <span className="text-[10px] text-muted-foreground">—</span>;
  const cls = j.recent ? "bg-green-light text-green-text" : "bg-amber-light text-amber-text";
  return <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${cls}`}>{j.label}</span>;
};

const scoreBar = (score: number) => {
  const isLow = score < 65;
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[38px] h-[4px] rounded-[3px] bg-border overflow-hidden">
        <div className={`h-full rounded-[3px] ${isLow ? "bg-muted-foreground/30" : "bg-indigo"}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-medium ${isLow ? "text-muted-foreground" : "text-indigo-text"}`}>{score}</span>
    </div>
  );
};

const intentDots = (n: number) => (
  <div className="flex items-center gap-[3px]">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className={`w-[6px] h-[6px] rounded-full ${i <= n ? "bg-indigo" : "bg-border"}`} />
    ))}
  </div>
);

/* ─── UnlockedFilterPanel ─── */

function UnlockedFilterPanel({ filter, isExpanded, chips, onToggle, onAddChip, onRemoveChip }: {
  filter: FilterDef;
  isExpanded: boolean;
  chips: string[];
  onToggle: () => void;
  onAddChip: (val: string) => void;
  onRemoveChip: (chip: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasChips = chips.length > 0;
  const options = filter.options || [];
  const advOpts = filter.advancedOptions || [];

  const filtered = useMemo(() => {
    const available = options.filter(o => !chips.includes(o));
    if (!search.trim()) return available;
    return available.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  }, [options, chips, search]);

  const addOption = (val: string) => {
    if (!chips.includes(val)) onAddChip(val);
    setSearch("");
  };

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-3 h-[40px] text-left transition-colors hover:bg-muted ${
          hasChips ? "text-foreground font-semibold" : "text-muted-foreground"
        }`}
      >
        <span className="flex-1 text-[12px] font-medium">{filter.label}</span>
        {hasChips && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo text-primary-foreground">{chips.length}</span>
        )}
        {isExpanded
          ? <ChevronUp className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />
          : <ChevronDown className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />
        }
      </button>
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-1.5 bg-muted/40 border-t border-border">
          {/* Search input */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-background border border-border mb-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2.5} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${filter.label.toLowerCase()}...`}
              className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  addOption(search.trim());
                }
              }}
            />
          </div>

          {/* Selected chips */}
          {hasChips && (
            <div className="mb-2">
              <div className="text-[10px] uppercase font-semibold mb-1.5 text-muted-foreground">Selected</div>
              <div className="flex flex-wrap gap-1">
                {chips.map(c => (
                  <span key={c} className="flex items-center gap-1 text-[10px] font-medium px-2 py-[3px] rounded bg-indigo-light text-indigo-text">
                    {c}
                    <button onClick={() => onRemoveChip(c)} className="opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preset options list */}
          {filtered.length > 0 && (
            <div className="max-h-[160px] overflow-y-auto">
              <div className="text-[10px] uppercase font-semibold mb-1 text-muted-foreground">
                {hasChips ? "Add more" : "Options"}
              </div>
              {filtered.map(opt => (
                <button
                  key={opt}
                  onClick={() => addOption(opt)}
                  className="w-full flex items-center gap-2 px-2 py-[5px] text-left text-[11px] text-foreground rounded hover:bg-muted transition-colors"
                >
                  <span className="w-3.5 h-3.5 rounded border border-border flex items-center justify-center shrink-0">
                    {chips.includes(opt) && <span className="w-1.5 h-1.5 rounded-sm bg-indigo" />}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          )}
          {options.length > 0 && filtered.length === 0 && search.trim() && (
            <button
              onClick={() => addOption(search.trim())}
              className="w-full text-left text-[11px] text-indigo-text px-2 py-1.5 hover:bg-muted rounded transition-colors"
            >
              + Add "{search.trim()}"
            </button>
          )}

          {/* Advanced settings */}
          {advOpts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <SlidersHorizontal className="w-3 h-3" strokeWidth={2.5} />
                <span>Advanced settings</span>
                {showAdvanced
                  ? <ChevronUp className="w-3 h-3 ml-auto" strokeWidth={2.5} />
                  : <ChevronDown className="w-3 h-3 ml-auto" strokeWidth={2.5} />
                }
              </button>
              {showAdvanced && (
                <div className="mt-1.5 space-y-1">
                  {advOpts.map(ao => (
                    <label key={ao.label} className="flex items-start gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer transition-colors">
                      <input type="checkbox" className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-[hsl(var(--indigo))]" />
                      <div>
                        <div className="text-[11px] font-medium text-foreground">{ao.label}</div>
                        <div className="text-[10px] text-muted-foreground leading-tight">{ao.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── component ─── */

export default function PeoplePage() {
  const [view, setView] = useState<"nlp" | "results">("nlp");
  const [nlpQuery, setNlpQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"total" | "new" | "saved">("new");
  const [recentTab, setRecentTab] = useState<"searched" | "saved">("searched");
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>({
    "Current title": true, Company: true, "Seniority level": true, Signals: true,
  });
  const [filterChips, setFilterChips] = useState<Record<string, string[]>>({
    "Current title": ["VP Sales", "Head of Growth"],
    Company: ["Series A–C SaaS"],
    "Seniority level": ["VP", "C-suite"],
    Signals: ["Job change", "Promotion", "New hire"],
  });
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true });

  const toggleFilter = (label: string) => setExpandedFilters(p => ({ ...p, [label]: !p[label] }));
  const removeChip = (filter: string, chip: string) => setFilterChips(p => ({ ...p, [filter]: (p[filter] || []).filter(c => c !== chip) }));
  const toggleRow = (i: number) => setSelectedRows(p => ({ ...p, [i]: !p[i] }));
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;
  const activeFilterCount = Object.values(filterChips).filter(v => v.length > 0).length;

  const doSearch = () => { if (nlpQuery.trim()) setView("results"); };

  /* ─── render filter row (unlocked) ─── */
  const renderFilterRow = (f: FilterDef) => {
    const isExpanded = expandedFilters[f.label];
    const chips = filterChips[f.label] || [];
    const hasChips = chips.length > 0;
    const hasExpandable = f.chips || hasChips;
    return (
      <div key={f.label}>
        <button
          onClick={() => hasExpandable ? toggleFilter(f.label) : undefined}
          className={`w-full flex items-center gap-2 px-3 h-[40px] text-left transition-colors hover:bg-muted ${
            f.signalRow ? "text-amber-text" : hasChips ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <span className="flex-1 text-[12px] font-medium">{f.label}</span>
          {hasChips && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo text-primary-foreground">{chips.length}</span>
          )}
          {hasExpandable && (isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} /> : <ChevronDown className="w-3.5 h-3.5 text-foreground/70" strokeWidth={2.5} />)}
        </button>
        {isExpanded && hasChips && (
          <div className="px-3 pb-2 pt-1 bg-muted/50 border-t border-border">
            <div className="text-[10px] uppercase font-semibold mb-1.5 text-muted-foreground">Include</div>
            <div className="flex flex-wrap gap-1">
              {chips.map(c => (
                <span key={c} className={`flex items-center gap-1 text-[10px] font-medium px-2 py-[3px] rounded ${
                  f.signalRow ? "bg-amber-light text-amber-text" : "bg-indigo-light text-indigo-text"
                }`}>
                  {c}
                  <button onClick={() => removeChip(f.label, c)} className="opacity-60 hover:opacity-100"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─── render locked row ─── */
  const renderLockedRow = (f: FilterDef) => (
    <Popover key={f.label}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 h-[40px] text-left cursor-default opacity-55 text-muted-foreground">
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
        <p className="text-[11px] text-muted-foreground mb-3">Unlock {f.label.toLowerCase()} filtering to find high-intent prospects.</p>
        <button className="w-full py-1.5 bg-indigo text-primary-foreground text-[11px] font-semibold rounded-md hover:opacity-90">Upgrade</button>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ─── Filter sidebar ─── */}
      <aside className="w-[240px] min-w-[240px] h-full flex flex-col bg-card border-r border-border">
        {/* Search */}
        <div className="p-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input placeholder="Search filters..." className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {([["total", "Total", "128K"], ["new", "Net New", "2,847"], ["saved", "Saved", "12"]] as const).map(([key, label, num]) => (
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
          {activeFilters.map(renderFilterRow)}
          <div className="mx-3 my-1 border-t border-border" />
          {(() => {
            const categories = [...new Set(unlockedFilters.map(f => f.category))];
            return categories.map(cat => (
              <div key={cat}>
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-foreground/70 px-3 pt-4 pb-2">{cat}</div>
                {unlockedFilters.filter(f => f.category === cat).map(f => (
                  <UnlockedFilterPanel
                    key={f.label}
                    filter={f}
                    isExpanded={!!expandedFilters[f.label]}
                    chips={filterChips[f.label] || []}
                    onToggle={() => toggleFilter(f.label)}
                    onAddChip={(val) => setFilterChips(p => ({ ...p, [f.label]: [...(p[f.label] || []), val] }))}
                    onRemoveChip={(chip) => removeChip(f.label, chip)}
                  />
                ))}
              </div>
            ));
          })()}
          <div className="mx-3 my-1 border-t border-border" />
          {signalFilters.map(renderFilterRow)}
          <div className="mx-3 my-1 border-t border-border" />
          {starterLocked.map(renderLockedRow)}
          <div className="mx-3 my-1 border-t border-border" />
          {growthLocked.map(renderLockedRow)}
          <div className="mx-3 my-1 border-t border-border" />
          {scaleLocked.map(renderLockedRow)}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-border">
          <button className="text-[11px] text-muted-foreground">Clear all · {activeFilterCount}</button>
          <button className="text-[11px] font-medium text-muted-foreground hover:text-foreground">More filters</button>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col min-w-0 bg-card">
        {/* Top nav */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-0">
            <button className="px-4 py-2 text-[12px] font-semibold text-foreground border-b-2 border-indigo">Find people</button>
            <button onClick={() => window.location.href = "/database/companies"} className="px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground">Find companies</button>
          </div>
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 text-[11px] font-medium text-indigo-text bg-indigo-light px-2.5 py-1.5 rounded-md hover:opacity-80 transition-colors">
              <Bot className="w-3.5 h-3.5" /> Research with AI <ChevronDown className="w-3 h-3" />
            </button>
            <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors">
              Create sequence <ChevronDown className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors">
              <Bookmark className="w-3.5 h-3.5" /> Save search <ChevronDown className="w-3 h-3" />
            </button>
            <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors">
              <Star className="w-3.5 h-3.5" /> Auto-score <ChevronDown className="w-3 h-3" />
            </button>
            <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors">
              <Settings className="w-3.5 h-3.5" /> Search settings
            </button>
          </div>
        </div>

        {/* ─── STATE 1: NLP Search ─── */}
        {view === "nlp" && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 transition-opacity duration-200">
            <div className="w-full max-w-[660px]">
              <h2 className="text-[20px] font-medium text-foreground mb-5 text-center">Use Outmate AI to find the right people</h2>

              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted border border-border focus-within:border-indigo focus-within:bg-indigo-light/30 transition-colors mb-4">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  value={nlpQuery}
                  onChange={e => setNlpQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doSearch()}
                  placeholder="e.g. VP Sales at Series A SaaS in Europe who changed jobs last 30 days..."
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
                  <Mic className="w-4 h-4" />
                </button>
                <button onClick={doSearch} className="px-3 py-1.5 bg-indigo text-primary-foreground text-[12px] font-semibold rounded-lg hover:opacity-90">Search</button>
              </div>

              {/* Example chips */}
              <div className="flex flex-wrap gap-2 mb-6">
                {exampleChips.map(chip => (
                  <button
                    key={chip}
                    onClick={() => setNlpQuery(chip)}
                    className="text-[11px] text-muted-foreground px-3 py-1.5 rounded-lg bg-muted border border-border hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Recent searches */}
              <div className="rounded-xl bg-card border border-border overflow-hidden mb-5">
                <div className="flex border-b border-border">
                  {(["searched", "saved"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setRecentTab(tab)}
                      className={`px-4 py-2.5 text-[11px] font-medium ${recentTab === tab ? "text-foreground border-b-2 border-indigo" : "text-muted-foreground"}`}
                    >
                      {tab === "searched" ? "Recently searched" : "Recently saved"}
                    </button>
                  ))}
                </div>
                <div>
                  {recentSearches.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setView("results")}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted border-b border-border last:border-0 transition-colors group"
                    >
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-semibold text-foreground">{s.filters} Filters</span>
                          <span className="text-[10px] text-muted-foreground">· {s.time}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{s.desc}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Unlock banner */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted border border-border">
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] text-muted-foreground">
                    Unlock advanced filters: <span className="text-foreground font-medium">Buying intent · People lookalikes · ICP fit score · Headcount growth</span>
                  </p>
                </div>
                <button className="px-3 py-1.5 bg-amber text-primary-foreground text-[11px] font-semibold rounded-lg hover:opacity-90 shrink-0">View plans</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STATE 2: Results Grid ─── */}
        {view === "results" && (
          <div className="flex-1 flex flex-col min-w-0 transition-opacity duration-200">
            {/* Result bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <span className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">128,440</span> people · <span className="font-semibold text-foreground">2,847</span> net new · {activeFilterCount} filters
              </span>
              <div className="flex items-center gap-2">
                {selectedCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-light text-indigo-text">{selectedCount} selected</span>
                )}
                <button className="text-[11px] text-muted-foreground hover:text-foreground">Export CSV</button>
                <button className="text-[11px] text-muted-foreground hover:text-foreground">Push to CRM</button>
                <button className="text-[11px] text-muted-foreground hover:text-foreground">Enrich</button>
                <button className="text-[11px] text-muted-foreground hover:text-foreground">Add to sequence</button>
                <button className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-dashed border-border">+ AI column</button>
                <button className="flex items-center gap-1 text-[11px] font-semibold text-primary-foreground bg-indigo px-3 py-1.5 rounded-md hover:opacity-90">
                  <Play className="w-3.5 h-3.5" /> Run agent
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[1400px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-[52px] px-3 py-2 bg-muted text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <span>#</span>
                        <input type="checkbox" className="w-[14px] h-[14px] rounded-[3px] accent-indigo" />
                      </div>
                    </th>
                    {["Person", "Title", "Company", "Seniority", "Location", "Exp.", "Email"].map(h => (
                      <th key={h} className="px-3 py-2 bg-muted text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">{h}</th>
                    ))}
                    {["Signal", "Job change", "Time in role"].map(h => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase font-semibold border-b border-border" style={{ background: "rgba(251,191,36,.04)", color: "#D97706" }}>{h === "Signal" ? "⚡ Signal" : h}</th>
                    ))}
                    {["ICP score", "Intent", "AI brief"].map(h => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase font-semibold border-b border-border" style={{ background: "rgba(79,70,229,.04)", color: "#4F46E5" }}>{h}</th>
                    ))}
                    <th className="px-3 py-2 bg-muted text-[10px] uppercase text-muted-foreground font-semibold border-b border-border">
                      <button className="text-[10px] text-muted-foreground border border-dashed border-border px-2 py-0.5 rounded hover:text-foreground hover:border-foreground/20">+ Add column</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p, i) => (
                    <tr key={i} className="group border-b border-border hover:bg-secondary/60 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground/50">{i + 1}</span>
                          <input type="checkbox" checked={!!selectedRows[i]} onChange={() => toggleRow(i)} className="w-[14px] h-[14px] rounded-[3px] accent-indigo" />
                        </div>
                      </td>
                      {/* Person */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-primary-foreground shrink-0" style={{ background: p.color }}>{p.initials}</div>
                          <div>
                            <div className="text-[11px] font-semibold text-foreground leading-tight">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground">{p.linkedin}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-foreground/80">{p.title}</td>
                      {/* Company */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[18px] h-[18px] rounded-[3px] flex items-center justify-center text-[8px] font-bold text-primary-foreground shrink-0" style={{ background: p.companyColor }}>{p.companyInitials}</div>
                          <span className="text-[11px] text-foreground/80">{p.company}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{seniorityBadge(p.seniority)}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{p.location}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{p.experience}</td>
                      <td className="px-3 py-2">{emailBadge(p.email)}</td>
                      {/* Signal cells */}
                      <td className="px-3 py-2 group-hover:bg-[rgba(251,191,36,.06)]" style={{ background: "rgba(251,191,36,.02)" }}>{signalChip(p.signal)}</td>
                      <td className="px-3 py-2 group-hover:bg-[rgba(251,191,36,.06)]" style={{ background: "rgba(251,191,36,.02)" }}>{jobChangeBadge(p.jobChange)}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground group-hover:bg-[rgba(251,191,36,.06)]" style={{ background: "rgba(251,191,36,.02)" }}>{p.timeInRole}</td>
                      {/* AI cells */}
                      <td className="px-3 py-2 group-hover:bg-[rgba(79,70,229,.06)]" style={{ background: "rgba(79,70,229,.02)" }}>{scoreBar(p.icpScore)}</td>
                      <td className="px-3 py-2 group-hover:bg-[rgba(79,70,229,.06)]" style={{ background: "rgba(79,70,229,.02)" }}>{intentDots(p.intent)}</td>
                      <td className="px-3 py-2 group-hover:bg-[rgba(79,70,229,.06)]" style={{ background: "rgba(79,70,229,.02)" }}>
                        {p.aiBrief === "ready" ? (
                          <span className="text-[11px] font-medium text-green">Ready ↗</span>
                        ) : p.aiBrief === "low" ? (
                          <span className="text-[11px] text-muted-foreground">Low priority</span>
                        ) : (
                          <button className="text-[11px] font-medium text-indigo hover:underline">Generate</button>
                        )}
                      </td>
                      <td className="px-3 py-2" />
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Load more */}
              <button className="w-full py-3 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted border-t border-border transition-colors">
                + Load more results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
