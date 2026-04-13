import { useState, useMemo, useCallback } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  CalendarDays, ChevronDown, Search, Code, Bell, Download, Star, X, Lock, Eye,
  ExternalLink, Linkedin, Sparkles, GitBranch, ListPlus
} from "lucide-react";
import EnrichmentModal from "@/components/EnrichmentModal";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip);

// ── DATA ──────────────────────────────────────────────────
const companyData = [
  { id: "c1", name: "TechVault Labs", initials: "TV", color: "#4F46E5", industry: "SaaS · 51-200", icpScore: 91, intent: "Hot", pages: 34, time: "18m 42s", lastSeen: "2m ago", pagesVisited: ["/pricing", "/enterprise", "/api-docs"], contact: { name: "James K.", role: "Head of Eng." }, contactEmail: "j.kim@techvaultlabs.com", contactPhone: "+1 (415) 882-3301", contactLinkedin: "https://linkedin.com/in/jameskim-eng", status: "In sequence", isNew: false, location: "San Francisco, CA", techStack: ["React", "AWS", "Snowflake", "HubSpot"], signals: [{ title: "Pricing page visited 3x", sub: "High intent signal", color: "#EF4444" }, { title: "Downloaded whitepaper", sub: "Content engagement", color: "#F59E0B" }] },
  { id: "c2", name: "Meridian Ops", initials: "MO", color: "#06B6D4", industry: "RevOps · 201-500", icpScore: 87, intent: "Hot", pages: 28, time: "14m 10s", lastSeen: "11m ago", pagesVisited: ["/features", "/demo"], contact: { name: "Sarah L.", role: "CTO" }, contactEmail: "sarah.lin@meridianops.com", contactPhone: "+1 (628) 440-7712", contactLinkedin: "https://linkedin.com/in/sarahlin-cto", status: "Not contacted", isNew: true, location: "Austin, TX", techStack: ["Python", "GCP", "Kubernetes"], signals: [{ title: "Demo page deep dive", sub: "Technical evaluation", color: "#4F46E5" }] },
  { id: "c3", name: "Stackline Co", initials: "SC", color: "#10B981", industry: "Analytics · 11-50", icpScore: 79, intent: "Warm", pages: 15, time: "8m 20s", lastSeen: "34m ago", pagesVisited: ["/case-studies", "/pricing"], contact: { name: "Ravi M.", role: "VP Product" }, contactEmail: "r.mehta@stackline.io", contactPhone: "+1 (512) 330-9124", contactLinkedin: "https://linkedin.com/in/ravimehta", status: "Not contacted", isNew: false, location: "Seattle, WA", techStack: ["Terraform", "AWS", "Datadog"], signals: [{ title: "Case study download", sub: "Research phase", color: "#F59E0B" }] },
  { id: "c4", name: "FounderOS", initials: "FO", color: "#F59E0B", industry: "Productivity · 1-10", icpScore: 94, intent: "Hot", pages: 41, time: "22m 05s", lastSeen: "1h ago", pagesVisited: ["/enterprise", "/api-docs", "/demo"], contact: { name: "Emily R.", role: "Co-founder" }, contactEmail: "emily@founderos.com", contactPhone: "+1 (917) 224-6631", contactLinkedin: "https://linkedin.com/in/emilyross-founder", status: "Sequence paused", isNew: true, location: "New York, NY", techStack: ["React", "Node.js", "Stripe"], signals: [{ title: "Enterprise page reviewed", sub: "Scale evaluation", color: "#4F46E5" }, { title: "API docs deep dive", sub: "Technical evaluation", color: "#F59E0B" }] },
  { id: "c5", name: "Axiom Digital", initials: "AD", color: "#8B5CF6", industry: "Agency · 51-200", icpScore: 72, intent: "Warm", pages: 11, time: "5m 44s", lastSeen: "2h ago", pagesVisited: ["/features"], contact: { name: "Tom B.", role: "Ops Lead" }, contactEmail: "tom.b@axiomdigital.com", contactPhone: "+1 (206) 551-0098", contactLinkedin: "https://linkedin.com/in/tombarrett-ops", status: "Not contacted", isNew: false, location: "Portland, OR", techStack: ["WordPress", "HubSpot"], signals: [] },
  { id: "c6", name: "Novalytics", initials: "NV", color: "#EF4444", industry: "Data · 201-500", icpScore: 85, intent: "Hot", pages: 23, time: "12m 30s", lastSeen: "3h ago", pagesVisited: ["/pricing", "/demo"], contact: { name: "Priya S.", role: "Head of Product" }, contactEmail: "priya.shah@novalytics.com", contactPhone: "+1 (650) 778-4452", contactLinkedin: "https://linkedin.com/in/priyashah-product", status: "In sequence", isNew: false, location: "San Jose, CA", techStack: ["Python", "Snowflake", "dbt"], signals: [{ title: "Pricing comparison", sub: "Budget evaluation", color: "#F59E0B" }] },
  { id: "c7", name: "Crestwave AI", initials: "CA", color: "#06B6D4", industry: "AI · 11-50", icpScore: 88, intent: "Hot", pages: 31, time: "16m 15s", lastSeen: "4h ago", pagesVisited: ["/enterprise", "/api-docs"], contact: { name: "Marcus J.", role: "CTO" }, contactEmail: "marcus@crestwave.ai", contactPhone: "+1 (737) 895-2210", contactLinkedin: "https://linkedin.com/in/marcusjames-cto", status: "Not contacted", isNew: true, location: "Austin, TX", techStack: ["PyTorch", "AWS", "FastAPI"], signals: [{ title: "API docs deep dive", sub: "Technical evaluation", color: "#4F46E5" }] },
  { id: "c8", name: "Orion Fintech", initials: "OF", color: "#10B981", industry: "Finance · 51-200", icpScore: 76, intent: "Warm", pages: 18, time: "9m 30s", lastSeen: "5h ago", pagesVisited: ["/features", "/case-studies"], contact: { name: "Diana W.", role: "VP Eng." }, contactEmail: "d.wu@orionfintech.com", contactPhone: "+1 (332) 664-0871", contactLinkedin: "https://linkedin.com/in/dianawu-eng", status: "Not contacted", isNew: false, location: "Chicago, IL", techStack: ["Java", "Azure", "Kafka"], signals: [] },
  { id: "c9", name: "Pulsar Labs", initials: "PL", color: "#4F46E5", industry: "DevTools · 11-50", icpScore: 82, intent: "Warm", pages: 20, time: "10m 45s", lastSeen: "6h ago", pagesVisited: ["/pricing"], contact: { name: "Chris H.", role: "CTO" }, contactEmail: "chris.h@pulsarlabs.dev", contactPhone: "+1 (469) 320-5543", contactLinkedin: "https://linkedin.com/in/chrishall-dev", status: "In sequence", isNew: false, location: "Denver, CO", techStack: ["Go", "AWS", "Terraform"], signals: [] },
  { id: "c10", name: "Gridline SaaS", initials: "GS", color: "#F59E0B", industry: "B2B SaaS · 51-200", icpScore: 69, intent: "Cold", pages: 7, time: "3m 12s", lastSeen: "8h ago", pagesVisited: ["/features"], contact: { name: "Anna T.", role: "Product Lead" }, contactEmail: "anna@gridlinesaas.com", contactPhone: "+1 (303) 118-7764", contactLinkedin: "https://linkedin.com/in/annatorres-pm", status: "Not contacted", isNew: false, location: "Boulder, CO", techStack: ["React", "Segment", "BigQuery"], signals: [] },
];

const peopleData = [
  { id: "p1", name: "James Kim", initials: "JK", color: "#4F46E5", dept: "Engineering", company: "TechVault Labs", role: "Head of Engineering", icpScore: 91, intent: "Hot", email: "j.kim@techvaultlabs.com", phone: "+1 (415) 882-3301", linkedin: "https://linkedin.com/in/jameskim-eng", pages: 34, lastSeen: "2m ago", status: "In sequence", isNew: false },
  { id: "p2", name: "Sarah Lin", initials: "SL", color: "#06B6D4", dept: "Product", company: "Meridian Ops", role: "CTO", icpScore: 89, intent: "Hot", email: "sarah.lin@meridianops.com", phone: "+1 (628) 440-7712", linkedin: "https://linkedin.com/in/sarahlin-cto", pages: 28, lastSeen: "11m ago", status: "Not contacted", isNew: true },
  { id: "p3", name: "Ravi Mehta", initials: "RM", color: "#10B981", dept: "Product", company: "Stackline Co", role: "VP of Product", icpScore: 79, intent: "Warm", email: "r.mehta@stackline.io", phone: "+1 (512) 330-9124", linkedin: "https://linkedin.com/in/ravimehta", pages: 15, lastSeen: "34m ago", status: "Not contacted", isNew: false },
  { id: "p4", name: "Emily Ross", initials: "ER", color: "#F59E0B", dept: "Exec", company: "FounderOS", role: "Co-founder & CEO", icpScore: 94, intent: "Hot", email: "emily@founderos.com", phone: "+1 (917) 224-6631", linkedin: "https://linkedin.com/in/emilyross-founder", pages: 41, lastSeen: "1h ago", status: "Sequence paused", isNew: true },
  { id: "p5", name: "Tom Barrett", initials: "TB", color: "#8B5CF6", dept: "Operations", company: "Axiom Digital", role: "Operations Lead", icpScore: 72, intent: "Warm", email: "tom.b@axiomdigital.com", phone: "+1 (206) 551-0098", linkedin: "https://linkedin.com/in/tombarrett-ops", pages: 11, lastSeen: "2h ago", status: "Not contacted", isNew: false },
  { id: "p6", name: "Priya Shah", initials: "PS", color: "#EF4444", dept: "Product", company: "Novalytics", role: "Head of Product", icpScore: 85, intent: "Hot", email: "priya.shah@novalytics.com", phone: "+1 (650) 778-4452", linkedin: "https://linkedin.com/in/priyashah-product", pages: 23, lastSeen: "3h ago", status: "In sequence", isNew: false },
  { id: "p7", name: "Marcus James", initials: "MJ", color: "#06B6D4", dept: "Engineering", company: "Crestwave AI", role: "CTO", icpScore: 88, intent: "Hot", email: "marcus@crestwave.ai", phone: "+1 (737) 895-2210", linkedin: "https://linkedin.com/in/marcusjames-cto", pages: 31, lastSeen: "4h ago", status: "Not contacted", isNew: true },
  { id: "p8", name: "Diana Wu", initials: "DW", color: "#10B981", dept: "Engineering", company: "Orion Fintech", role: "VP Engineering", icpScore: 76, intent: "Warm", email: "d.wu@orionfintech.com", phone: "+1 (332) 664-0871", linkedin: "https://linkedin.com/in/dianawu-eng", pages: 18, lastSeen: "5h ago", status: "Not contacted", isNew: false },
  { id: "p9", name: "Chris Hall", initials: "CH", color: "#4F46E5", dept: "Engineering", company: "Pulsar Labs", role: "CTO", icpScore: 82, intent: "Warm", email: "chris.h@pulsarlabs.dev", phone: "+1 (469) 320-5543", linkedin: "https://linkedin.com/in/chrishall-dev", pages: 20, lastSeen: "6h ago", status: "In sequence", isNew: false },
  { id: "p10", name: "Anna Torres", initials: "AT", color: "#F59E0B", dept: "Product", company: "Gridline SaaS", role: "Product Lead", icpScore: 69, intent: "Cold", email: "anna@gridlinesaas.com", phone: "+1 (303) 118-7764", linkedin: "https://linkedin.com/in/annatorres-pm", pages: 7, lastSeen: "8h ago", status: "Not contacted", isNew: false },
];

const intentColor: Record<string, string> = { Hot: "#EF4444", Warm: "#F59E0B", Cold: "#9CA3AF" };
const maskEmail = (e: string) => { const [, d] = e.split("@"); return "••••@" + d; };
const maskPhone = () => "+1 (•••) •••-••••";

// ── CHART DATA ────────────────────────────────────────────
const dailyLabels = ["Feb 14", "Feb 18", "Feb 22", "Feb 26", "Mar 2", "Mar 6", "Mar 10", "Mar 14"];
const icpMatch = [18, 22, 28, 24, 30, 26, 32, 31];
const nonIcp = [12, 8, 10, 16, 9, 11, 7, 10];

const topPages = [
  { page: "/pricing", visits: 89 },
  { page: "/features", visits: 76 },
  { page: "/enterprise", visits: 64 },
  { page: "/api-docs", visits: 52 },
  { page: "/demo", visits: 48 },
  { page: "/case-studies", visits: 41 },
];

// ── COMPONENTS ────────────────────────────────────────────
function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-green text-white text-[9px] font-bold tracking-[.03em] uppercase">
      <span className="w-[5px] h-[5px] rounded-full bg-white animate-[blink_1.4s_ease-in-out_infinite]" />
      LIVE
    </span>
  );
}

function MetricCard({ label, value, delta, deltaType = "up" }: { label: string; value: string; delta: string; deltaType?: "up" | "neutral" }) {
  return (
    <div className="bg-secondary rounded-lg p-4">
      <div className="text-[10px] font-medium uppercase tracking-[.05em] text-muted-foreground mb-1">{label}</div>
      <div className="text-[22px] font-semibold tracking-[-.02em] text-foreground">{value}</div>
      <div className={`text-[10px] font-medium mt-1 ${deltaType === "up" ? "text-green" : "text-muted-foreground"}`}>{delta}</div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "In sequence": "bg-green-light text-green-text",
    "Not contacted": "bg-secondary text-muted-foreground",
    "Sequence paused": "bg-amber-light text-amber-text",
  };
  return (
    <span className={`inline-flex items-center text-[9px] font-semibold px-2 py-0.5 rounded-[4px] tracking-[.02em] ${styles[status] || "bg-secondary text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: intentColor[intent] }} />
      <span className="text-[10px] font-semibold" style={{ color: intentColor[intent] }}>{intent}</span>
    </span>
  );
}

function MiniProgressBar({ value, max = 100, color = "#4F46E5" }: { value: number; max?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[44px] h-[4px] rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

function RevealButton({ onReveal, cost = 1 }: { onReveal: () => void; cost?: number }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onReveal(); }}
      className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-[1px] rounded-[3px] border border-indigo/30 text-indigo hover:bg-indigo-light transition-colors"
    >
      Reveal <span className="text-[8px] font-bold text-indigo/60">({cost} cr)</span>
    </button>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function VisitorIdentificationPage() {
  const [activeTab, setActiveTab] = useState<"companies" | "people">("companies");
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);

  const reveal = useCallback((key: string) => {
    setRevealed(prev => ({ ...prev, [key]: true }));
  }, []);

  const filteredCompanies = useMemo(() => {
    let list = companyData;
    if (searchQuery) list = list.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filter === "Hot") list = list.filter(c => c.intent === "Hot");
    if (filter === "ICP match") list = list.filter(c => c.icpScore >= 80);
    if (filter === "New today") list = list.filter(c => c.isNew);
    return list;
  }, [filter, searchQuery]);

  const filteredPeople = useMemo(() => {
    let list = peopleData;
    if (searchQuery) list = list.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.company.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filter === "Hot") list = list.filter(p => p.intent === "Hot");
    if (filter === "ICP match") list = list.filter(p => p.icpScore >= 80);
    if (filter === "New today") list = list.filter(p => p.isNew);
    return list;
  }, [filter, searchQuery]);

  const selectedCompany = companyData.find(c => c.id === selectedId);
  const selectedPerson = peopleData.find(p => p.id === selectedId);

  const tabs = [
    { key: "companies" as const, label: "Companies", count: 312 },
    { key: "people" as const, label: "People", count: 847 },
  ];
  const filters = ["All", "Hot", "ICP match", "New today"];

  const stackedBarData = {
    labels: dailyLabels,
    datasets: [
      { label: "ICP match", data: icpMatch, backgroundColor: "#4F46E5", borderRadius: 3, borderWidth: 0 },
      { label: "Non-ICP", data: nonIcp, backgroundColor: "#E5E7EB", borderRadius: 3, borderWidth: 0 },
    ],
  };
  const stackedBarOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: "index" as const, intersect: false } },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, family: "DM Sans" }, color: "#9CA3AF", maxTicksLimit: 8 } },
      y: { stacked: true, grid: { color: "#F3F4F6" }, ticks: { font: { size: 10, family: "DM Sans" }, color: "#9CA3AF" } },
    },
  };

  const horizBarData = {
    labels: topPages.map(p => p.page),
    datasets: [{ data: topPages.map(p => p.visits), backgroundColor: "#4F46E5", borderRadius: 3, borderWidth: 0, barThickness: 18 }],
  };
  const horizBarOpts: any = {
    responsive: true, maintainAspectRatio: false, indexAxis: "y" as const,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "#F3F4F6" }, ticks: { font: { size: 10 }, color: "#9CA3AF" } },
      y: { grid: { display: false }, ticks: { font: { size: 10, family: "JetBrains Mono" }, color: "#6B7280" } },
    },
  };

  return (
    <div className="flex flex-col h-full font-dm">
      {/* ── TOPBAR ── */}
      <div className="flex items-center justify-between px-5 border-b" style={{ minHeight: 52 }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold tracking-[-.015em] text-foreground">Visitor Identification</span>
            <LivePill />
          </div>
          <div className="text-[11px] text-muted-foreground">outmate.io · Tracking since Jan 12, 2026 · Script v2.1 active</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border rounded-md hover:bg-secondary transition-colors border-border">
            <Code className="w-3.5 h-3.5" /> Tracking script
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border rounded-md hover:bg-secondary transition-colors border-border">
            <Bell className="w-3.5 h-3.5" /> Alert rules
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border rounded-md hover:bg-secondary transition-colors border-border">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo rounded-md hover:opacity-90 transition-opacity">
            <Star className="w-3.5 h-3.5" /> Run outreach
          </button>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex items-center justify-between px-5 border-b border-border">
        <div className="flex">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSelectedId(null); setFilter("All"); setSearchQuery(""); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "font-bold text-indigo border-indigo"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {t.label}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ${
                activeTab === t.key ? "bg-indigo-light text-indigo" : "bg-secondary text-muted-foreground"
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border rounded-md border-border">
          <CalendarDays className="w-3.5 h-3.5" /> Last 30 days <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4" style={{ scrollbarWidth: "thin" }}>
          {/* Metrics */}
          <div className="grid grid-cols-5 gap-3">
            {activeTab === "companies" ? (
              <>
                <MetricCard label="Companies identified" value="312" delta="+24% vs last period" />
                <MetricCard label="ICP match rate" value="68%" delta="+5% vs last period" />
                <MetricCard label="Hot accounts" value="47" delta="+31% vs last period" />
                <MetricCard label="Sequences triggered" value="156" delta="+18% vs last period" />
                <MetricCard label="Credits used (ID)" value="4,680" delta="Resets in 18d" deltaType="neutral" />
              </>
            ) : (
              <>
                <MetricCard label="People identified" value="847" delta="+19% vs last period" />
                <MetricCard label="Emails found" value="623" delta="+12% vs last period" />
                <MetricCard label="Phone numbers" value="284" delta="+8% vs last period" />
                <MetricCard label="ICP contacts" value="391" delta="+22% vs last period" />
                <MetricCard label="Outreach ready" value="178" delta="+34% vs last period" />
              </>
            )}
          </div>

          {/* Charts (companies only) */}
          {activeTab === "companies" && (
            <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">Visitor Identification</div>
                    <div className="text-[11px] text-muted-foreground">ICP vs non-ICP visitors · Daily</div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5"><span className="w-[10px] h-[10px] rounded-[2px] bg-indigo" /> ICP match</span>
                    <span className="flex items-center gap-1.5"><span className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: "#E5E7EB" }} /> Non-ICP</span>
                  </div>
                </div>
                <div style={{ height: 180 }}><Bar data={stackedBarData} options={stackedBarOpts} /></div>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="mb-3">
                  <div className="text-[12px] font-semibold text-foreground">Top Pages by Visits</div>
                  <div className="text-[11px] text-muted-foreground">Unique visitor page views</div>
                </div>
                <div style={{ height: 180 }}><Bar data={horizBarData} options={horizBarOpts} /></div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={activeTab === "companies" ? "Search companies..." : "Search people..."}
                className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-secondary rounded-md border-none outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-1.5">
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    filter === f
                      ? "bg-secondary border border-foreground/20 font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            {activeTab === "people" && (
              <button
                onClick={() => setEnrichOpen(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white bg-indigo rounded-md hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-3.5 h-3.5" /> Enrich selected {selectedPeopleIds.length > 0 && `(${selectedPeopleIds.length})`}
              </button>
            )}
          </div>

          {/* TABLE */}
          {activeTab === "companies" ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ tableLayout: "fixed", minWidth: 1100 }}>
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Company","ICP Score","Intent","Pages","Time","Last Seen","Pages Visited","Primary Contact","Status",""].map((h, i) => (
                        <th key={h || i} className="text-[10px] font-semibold tracking-[-.01em] text-muted-foreground px-3 py-2"
                          style={{ width: [160,80,72,52,68,80,125,130,90,70][i] }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`border-b border-border cursor-pointer transition-colors ${selectedId === c.id ? "bg-indigo-light" : "hover:bg-secondary"}`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[8px] font-semibold text-white shrink-0" style={{ backgroundColor: c.color }}>{c.initials}</div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-semibold text-foreground truncate">{c.name}</span>
                                {c.isNew && <span className="text-[8px] font-semibold px-1 py-[1px] rounded-[3px] bg-indigo-light text-indigo tracking-[.02em]">NEW</span>}
                              </div>
                              <div className="text-[9px] text-muted-foreground truncate">{c.industry}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><MiniProgressBar value={c.icpScore} /></td>
                        <td className="px-3 py-2"><IntentBadge intent={c.intent} /></td>
                        <td className="px-3 py-2 text-[11px] font-semibold text-foreground">{c.pages}</td>
                        <td className="px-3 py-2 text-[10px] text-muted-foreground">{c.time}</td>
                        <td className="px-3 py-2 text-[10px] text-muted-foreground">{c.lastSeen}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {c.pagesVisited.slice(0, 2).map(p => (
                              <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded-[3px] bg-secondary border border-border text-muted-foreground">{p}</span>
                            ))}
                            {c.pagesVisited.length > 2 && <span className="text-[9px] text-muted-foreground">+{c.pagesVisited.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-[10px] font-medium text-foreground">{c.contact.name}</div>
                          <div className="text-[9px] text-muted-foreground">{c.contact.role}</div>
                        </td>
                        <td className="px-3 py-2"><StatusChip status={c.status} /></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={e => e.stopPropagation()} className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Send to Copilot">
                              <Sparkles className="w-3 h-3" />
                            </button>
                            <button onClick={e => e.stopPropagation()} className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Trigger workflow">
                              <GitBranch className="w-3 h-3" />
                            </button>
                            <button onClick={e => e.stopPropagation()} className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Add to list">
                              <ListPlus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ tableLayout: "fixed", minWidth: 1240 }}>
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-3 py-2 w-[36px]">
                        <input
                          type="checkbox"
                          checked={selectedPeopleIds.length === filteredPeople.length && filteredPeople.length > 0}
                          onChange={e => setSelectedPeopleIds(e.target.checked ? filteredPeople.map(p => p.id) : [])}
                          className="w-3.5 h-3.5 rounded accent-[#4F46E5]"
                        />
                      </th>
                      {["Person","Company · Role","ICP Score","Intent","Email","Phone","LinkedIn","Pages","Last Seen","Status",""].map((h, i) => (
                        <th key={h || i} className="text-[10px] font-semibold tracking-[-.01em] text-muted-foreground px-3 py-2"
                          style={{ width: [160,130,80,72,155,130,100,52,80,90,65][i] }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map(p => {
                      const emailKey = `${p.id}-email`;
                      const phoneKey = `${p.id}-phone`;
                      const isChecked = selectedPeopleIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className={`border-b border-border cursor-pointer transition-colors ${selectedId === p.id ? "bg-indigo-light" : "hover:bg-secondary"}`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onClick={e => e.stopPropagation()}
                              onChange={() => setSelectedPeopleIds(prev => isChecked ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                              className="w-3.5 h-3.5 rounded accent-[#4F46E5]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: p.color }}>{p.initials}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] font-semibold text-foreground truncate">{p.name}</span>
                                  {p.isNew && <span className="text-[8px] font-semibold px-1 py-[1px] rounded-[3px] bg-indigo-light text-indigo tracking-[.02em]">NEW</span>}
                                </div>
                                <div className="text-[9px] text-muted-foreground">{p.dept}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-[11px] font-medium text-foreground truncate">{p.company}</div>
                            <div className="text-[9px] text-muted-foreground truncate">{p.role}</div>
                          </td>
                          <td className="px-3 py-2"><MiniProgressBar value={p.icpScore} /></td>
                          <td className="px-3 py-2"><IntentBadge intent={p.intent} /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {revealed[emailKey] ? (
                                <span className="text-[10px] font-mono font-medium text-indigo">{p.email}</span>
                              ) : (
                                <>
                                  <Lock className="w-[10px] h-[10px] text-muted-foreground" />
                                  <span className="text-[10px] font-mono text-muted-foreground">{maskEmail(p.email)}</span>
                                  <RevealButton onReveal={() => reveal(emailKey)} cost={3} />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {revealed[phoneKey] ? (
                                <span className="text-[10px] font-mono font-medium text-indigo">{p.phone}</span>
                              ) : (
                                <>
                                  <Lock className="w-[10px] h-[10px] text-muted-foreground" />
                                  <span className="text-[10px] font-mono text-muted-foreground">{maskPhone()}</span>
                                  <RevealButton onReveal={() => reveal(phoneKey)} cost={5} />
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <a href={p.linkedin} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-indigo hover:underline">
                              <span className="w-[16px] h-[16px] rounded-[3px] bg-[#0A66C2] flex items-center justify-center">
                                <Linkedin className="w-[10px] h-[10px] text-white" />
                              </span>
                              View Profile <ExternalLink className="w-[8px] h-[8px]" />
                            </a>
                          </td>
                          <td className="px-3 py-2 text-[11px] font-semibold text-foreground">{p.pages}</td>
                          <td className="px-3 py-2 text-[10px] text-muted-foreground">{p.lastSeen}</td>
                          <td className="px-3 py-2"><StatusChip status={p.status} /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={e => e.stopPropagation()} className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Send to Copilot">
                                <Sparkles className="w-3 h-3" />
                              </button>
                              <button onClick={e => e.stopPropagation()} className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Trigger workflow">
                                <GitBranch className="w-3 h-3" />
                              </button>
                              <button onClick={e => e.stopPropagation()} className="text-[9px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Add to list">
                                <ListPlus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── DETAIL PANEL ── */}
        <div className="w-[320px] min-w-[320px] border-l border-border overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {!selectedId || (!selectedCompany && !selectedPerson) ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
                <Eye className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="text-[12px] font-medium text-foreground mb-1">Select a row</div>
              <div className="text-[11px] text-muted-foreground">Click any company or person to see full visitor details</div>
            </div>
          ) : selectedCompany ? (
            <CompanyDetail company={selectedCompany} revealed={revealed} onReveal={reveal} onClose={() => setSelectedId(null)} />
          ) : selectedPerson ? (
            <PersonDetail person={selectedPerson} revealed={revealed} onReveal={reveal} onClose={() => setSelectedId(null)} />
          ) : null}
        </div>
      </div>
      <EnrichmentModal
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        selectedRows={selectedPeopleIds.length > 0 ? selectedPeopleIds.length : filteredPeople.length}
      />
    </div>
  );
}

// ── COMPANY DETAIL ────────────────────────────────────────
function CompanyDetail({ company: c, revealed, onReveal, onClose }: { company: typeof companyData[0]; revealed: Record<string, boolean>; onReveal: (k: string) => void; onClose: () => void }) {
  const emailKey = `${c.id}-email`;
  const phoneKey = `${c.id}-phone`;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">{c.name}</span>
        <button onClick={onClose} className="w-[22px] h-[22px] rounded flex items-center justify-center hover:bg-secondary transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Header card */}
      <div className="bg-secondary rounded-lg p-3 flex items-center gap-3">
        <div className="w-[40px] h-[40px] rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: c.color }}>{c.initials}</div>
        <div>
          <div className="text-[14px] font-bold tracking-[-.01em] text-foreground">{c.name}</div>
          <div className="text-[11px] text-muted-foreground">{c.industry} · {c.location}</div>
        </div>
      </div>

      {/* ICP Score */}
      <div className="border border-border rounded-lg p-3 flex items-center justify-between">
        <span className="text-[26px] font-bold tracking-[-.01em] text-indigo">{c.icpScore}</span>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase text-muted-foreground">ICP SCORE</div>
          <div className="w-[80px] h-[5px] rounded-full bg-secondary overflow-hidden mt-1">
            <div className="h-full rounded-full bg-indigo" style={{ width: `${c.icpScore}%` }} />
          </div>
        </div>
      </div>

      {/* Visit summary */}
      <div className="space-y-0">
        {[
          ["Pages viewed", String(c.pages)],
          ["Time on site", c.time],
          ["Last seen", c.lastSeen],
          ["Intent", c.intent],
          ["Outreach status", c.status],
        ].map(([k, v], i) => (
          <div key={i} className="flex justify-between py-[5px] border-b border-border text-[11px]">
            <span className="font-medium text-muted-foreground">{k}</span>
            <span className={`font-medium ${k === "Last seen" ? "text-green" : k === "Intent" ? "font-bold" : "text-foreground"}`} style={k === "Intent" ? { color: intentColor[v] } : undefined}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {/* Primary Contact */}
      <div>
        <div className="text-[11px] font-semibold text-foreground mb-2">Primary Contact</div>
        <div className="bg-secondary rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: c.color }}>{c.contact.name.split(" ").map(n => n[0]).join("")}</div>
            <div>
              <div className="text-[12px] font-semibold text-foreground">{c.contact.name}</div>
              <div className="text-[10px] text-muted-foreground">{c.contact.role}</div>
            </div>
          </div>
          {/* Email */}
          <div className="flex items-center gap-2 py-1.5">
            <Lock className="w-[10px] h-[10px] text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground w-[36px]">Email</span>
            {revealed[emailKey] ? (
              <span className="text-[10px] font-mono font-medium text-indigo">{c.contactEmail}</span>
            ) : (
              <>
                <span className="text-[10px] font-mono text-muted-foreground">{maskEmail(c.contactEmail)}</span>
                <RevealButton onReveal={() => onReveal(emailKey)} cost={3} />
              </>
            )}
          </div>
          {/* Phone */}
          <div className="flex items-center gap-2 py-1.5">
            <Lock className="w-[10px] h-[10px] text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground w-[36px]">Phone</span>
            {revealed[phoneKey] ? (
              <span className="text-[10px] font-mono font-medium text-indigo">{c.contactPhone}</span>
            ) : (
              <>
                <span className="text-[10px] font-mono text-muted-foreground">{maskPhone()}</span>
                <RevealButton onReveal={() => onReveal(phoneKey)} cost={5} />
              </>
            )}
          </div>
          {/* LinkedIn */}
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-[16px] h-[16px] rounded-[3px] bg-[#0A66C2] flex items-center justify-center shrink-0">
              <Linkedin className="w-[10px] h-[10px] text-white" />
            </span>
            <a href={c.contactLinkedin} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-indigo hover:underline inline-flex items-center gap-1">
              View Profile <ExternalLink className="w-[8px] h-[8px]" />
            </a>
          </div>
        </div>
      </div>

      {/* Pages visited */}
      <div>
        <div className="text-[11px] font-semibold text-foreground mb-2">Pages visited</div>
        <div className="space-y-1">
          {c.pagesVisited.map(p => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-[5px] h-[5px] rounded-full bg-destructive shrink-0" />
              <span className="text-[10px] font-mono text-muted-foreground">{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Signals */}
      {c.signals.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-foreground mb-2">Signals detected</div>
          <div className="space-y-2">
            {c.signals.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0" style={{ backgroundColor: s.color + "20" }}>
                  <span className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: s.color }} />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-foreground">{s.title}</div>
                  <div className="text-[10px] text-muted-foreground">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech stack */}
      <div>
        <div className="text-[11px] font-semibold text-foreground mb-2">Tech stack</div>
        <div className="flex flex-wrap gap-1.5">
          {c.techStack.map(t => (
            <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-secondary border border-border text-muted-foreground">{t}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button className="w-full py-2 text-[11px] font-semibold text-white bg-indigo rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
          <Star className="w-3.5 h-3.5" /> Run outreach agent
        </button>
        <button className="w-full py-2 text-[11px] font-semibold text-foreground bg-secondary rounded-md hover:bg-muted transition-colors">Add to ABM list</button>
        <button className="w-full py-2 text-[11px] font-semibold text-foreground bg-secondary rounded-md hover:bg-muted transition-colors">Push to HubSpot</button>
      </div>
    </div>
  );
}

// ── PERSON DETAIL ─────────────────────────────────────────
function PersonDetail({ person: p, revealed, onReveal, onClose }: { person: typeof peopleData[0]; revealed: Record<string, boolean>; onReveal: (k: string) => void; onClose: () => void }) {
  const emailKey = `${p.id}-email`;
  const phoneKey = `${p.id}-phone`;
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">{p.name}</span>
        <button onClick={onClose} className="w-[22px] h-[22px] rounded flex items-center justify-center hover:bg-secondary transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Header */}
      <div className="bg-secondary rounded-lg p-3 flex items-center gap-3">
        <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: p.color }}>{p.initials}</div>
        <div>
          <div className="text-[14px] font-bold tracking-[-.01em] text-foreground">{p.name}</div>
          <div className="text-[11px] text-muted-foreground">{p.role} at {p.company}</div>
        </div>
      </div>

      {/* ICP Score */}
      <div className="border border-border rounded-lg p-3 flex items-center justify-between">
        <span className="text-[26px] font-bold tracking-[-.01em] text-indigo">{p.icpScore}</span>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase text-muted-foreground">ICP SCORE</div>
          <div className="w-[80px] h-[5px] rounded-full bg-secondary overflow-hidden mt-1">
            <div className="h-full rounded-full bg-indigo" style={{ width: `${p.icpScore}%` }} />
          </div>
        </div>
      </div>

      {/* Contact details */}
      <div>
        <div className="text-[11px] font-semibold text-foreground mb-2">Contact details</div>
        <div className="bg-secondary rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-[10px] h-[10px] text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground w-[36px]">Email</span>
            {revealed[emailKey] ? (
              <span className="text-[10px] font-mono font-medium text-indigo">{p.email}</span>
            ) : (
              <>
                <span className="text-[10px] font-mono text-muted-foreground">{maskEmail(p.email)}</span>
                <RevealButton onReveal={() => onReveal(emailKey)} cost={3} />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-[10px] h-[10px] text-muted-foreground shrink-0" />
            <span className="text-[10px] font-medium text-muted-foreground w-[36px]">Phone</span>
            {revealed[phoneKey] ? (
              <span className="text-[10px] font-mono font-medium text-indigo">{p.phone}</span>
            ) : (
              <>
                <span className="text-[10px] font-mono text-muted-foreground">{maskPhone()}</span>
                <RevealButton onReveal={() => onReveal(phoneKey)} cost={5} />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="w-[16px] h-[16px] rounded-[3px] bg-[#0A66C2] flex items-center justify-center shrink-0">
              <Linkedin className="w-[10px] h-[10px] text-white" />
            </span>
            <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-indigo hover:underline inline-flex items-center gap-1">
              View Profile <ExternalLink className="w-[8px] h-[8px]" />
            </a>
          </div>
        </div>
      </div>

      {/* Visit summary */}
      <div className="space-y-0">
        {[
          ["Pages viewed", String(p.pages)],
          ["Last seen", p.lastSeen],
          ["Intent", p.intent],
          ["Department", p.dept],
          ["Status", p.status],
        ].map(([k, v], i) => (
          <div key={i} className="flex justify-between py-[5px] border-b border-border text-[11px]">
            <span className="font-medium text-muted-foreground">{k}</span>
            <span className={`font-medium ${k === "Last seen" ? "text-green" : k === "Intent" ? "font-bold" : "text-foreground"}`} style={k === "Intent" ? { color: intentColor[v] } : undefined}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button className="w-full py-2 text-[11px] font-semibold text-white bg-indigo rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
          <Star className="w-3.5 h-3.5" /> Run outreach agent
        </button>
        <button className="w-full py-2 text-[11px] font-semibold text-foreground bg-secondary rounded-md hover:bg-muted transition-colors">Add to ABM list</button>
        <button className="w-full py-2 text-[11px] font-semibold text-foreground bg-secondary rounded-md hover:bg-muted transition-colors">Push to HubSpot</button>
      </div>
    </div>
  );
}
