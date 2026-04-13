import { useState } from "react";
import {
  Search, Filter, ArrowDownAZ, Plus, Upload, Globe, Link2, PenLine, Library,
  FileText, Phone, Database, Briefcase, BookOpen, ChevronRight,
  Edit2, Trash2, RefreshCw, UploadCloud,
  File, FileSpreadsheet, Presentation, Music, Video,
  Lightbulb, Target, TrendingUp, Mail, Award, MessageSquare,
  Check, X
} from "lucide-react";

/* ─── data ─── */
const knowledgeItems = [
  { icon: "📋", name: "ICP Definition v3", source: "PDF", chunks: "1,240", size: "", status: "indexed" as const, agents: 3 },
  { icon: "◎", name: "Outmate Website", source: "Website, auto-sync", chunks: "847", size: "", status: "syncing" as const, agents: 2 },
  { icon: "📞", name: "Q4 Call Transcripts", source: "23 files, 86 MB", chunks: "4,102", size: "", status: "indexed" as const, agents: 2 },
  { icon: "⊞", name: "HubSpot CRM Data", source: "Integration, live sync", chunks: "12,400 records", size: "", status: "syncing" as const, agents: 2 },
  { icon: "📄", name: "Case Study Library", source: "8 files", chunks: "340", size: "", status: "indexed" as const, agents: 2 },
  { icon: "📖", name: "Sales Playbook 2025", source: "DOCX", chunks: "2,100", size: "", status: "indexed" as const, agents: 2 },
];

const connectedAgents = [
  "Intent Radar", "AI SDR", "Personal Opener", "Reply Handler",
  "Prospect Brief", "Pre-Call Briefing", "Objection Handler", "Proposal Builder",
];

const integrations = [
  { name: "HubSpot", connected: true }, { name: "Salesforce", connected: false },
  { name: "Slack", connected: true }, { name: "LinkedIn", connected: false },
  { name: "Google Drive", connected: false }, { name: "Gmail", connected: false },
  { name: "Notion", connected: false }, { name: "Zapier", connected: false },
  { name: "Crunchbase", connected: false },
];

const syncedData = [
  { integration: "HubSpot", items: ["Contacts & companies", "Deal stages & pipeline", "Activity history", "Custom properties"] },
  { integration: "Slack", items: ["Channel messages", "Thread conversations", "Shared files", "Bookmarked items"] },
];

const suggestedUploads = [
  { icon: <Target size={16} />, name: "ICP definition doc", desc: "Define your ideal customer profile" },
  { icon: <Phone size={16} />, name: "Call transcripts", desc: "Past sales call recordings" },
  { icon: <Award size={16} />, name: "Case studies", desc: "Customer success stories" },
  { icon: <BookOpen size={16} />, name: "Product playbook", desc: "Product positioning & messaging" },
  { icon: <TrendingUp size={16} />, name: "Win/loss analysis", desc: "Deal outcome breakdowns" },
  { icon: <Mail size={16} />, name: "Top-performing emails", desc: "Best outreach templates" },
];

const writingPrompts = [
  "Describe your ideal customer profile in detail",
  "List your top 5 competitor differentiators",
  "Write common objections and rebuttals",
  "Document your sales qualification criteria",
];

const categoryTags = ["ICP", "Messaging", "Objections", "Competitor intel", "Product", "Process", "Other"];

/* ─── tabs config ─── */
const tabs = [
  { id: "upload", label: "Upload", icon: <UploadCloud size={18} strokeWidth={2.5} /> },
  { id: "library", label: "Library", icon: <Library size={18} strokeWidth={2.5} /> },
  { id: "website", label: "Website", icon: <Globe size={18} strokeWidth={2.5} /> },
  { id: "integration", label: "Integration", icon: <Link2 size={18} strokeWidth={2.5} /> },
  { id: "write", label: "Write", icon: <PenLine size={18} strokeWidth={2.5} /> },
];

/* ─── component ─── */
export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoSync, setAutoSync] = useState(true);
  const [crawlDepth, setCrawlDepth] = useState("full");
  const [syncFreq, setSyncFreq] = useState("daily");
  const [activeCategory, setActiveCategory] = useState("ICP");
  const [writeContent, setWriteContent] = useState("");
  const [writeTitle, setWriteTitle] = useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ HERO ═══ */}
      <div className="relative h-[200px] overflow-hidden" style={{ background: "#0F172A" }}>
        {/* dot grid */}
        <div className="absolute inset-0" style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
        {/* glow left */}
        <div className="absolute" style={{ width: 180, height: 180, top: 20, left: 40, borderRadius: "50%", background: "rgba(79,70,229,.18)", filter: "blur(55px)" }} />
        {/* glow right */}
        <div className="absolute" style={{ width: 160, height: 160, top: 10, right: 60, borderRadius: "50%", background: "rgba(139,92,246,.14)", filter: "blur(50px)" }} />

        <div className="relative z-[2] flex flex-col items-center justify-center h-full text-center">
          <span style={{ fontSize: 10, letterSpacing: ".1em", color: "#818CF8" }} className="uppercase font-medium">CONTEXT ENGINE</span>
          <h1 style={{ fontSize: 26, color: "#fff" }} className="font-medium mt-2">Your knowledge base</h1>
          <p style={{ fontSize: 12, color: "#94A3B8" }} className="mt-1.5 max-w-md">
            Everything your agents know — documents, websites, CRM, and live integrations
          </p>
        </div>
      </div>

      {/* ═══ SOURCE TYPE TABS ═══ */}
      <div className="flex justify-center" style={{ marginTop: -28 }}>
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1.5" style={{ boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
          {tabs.map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-md px-[18px] py-[10px] min-w-[80px] transition-colors
                  ${active ? "bg-secondary" : "hover:bg-secondary"}`}
              >
                <div className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors
                  ${active ? "bg-indigo text-white border-indigo" : "bg-secondary border-border"}`}>
                  {t.icon}
                </div>
                <span className="text-[11px] font-medium text-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="max-w-[900px] mx-auto px-8 pb-8 pt-8">
        {activeTab === "library" && <LibraryTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} autoSync={autoSync} setAutoSync={setAutoSync} />}
        {activeTab === "upload" && <UploadTab />}
        {activeTab === "website" && <WebsiteTab crawlDepth={crawlDepth} setCrawlDepth={setCrawlDepth} syncFreq={syncFreq} setSyncFreq={setSyncFreq} />}
        {activeTab === "integration" && <IntegrationTab />}
        {activeTab === "write" && <WriteTab activeCategory={activeCategory} setActiveCategory={setActiveCategory} writeContent={writeContent} setWriteContent={setWriteContent} writeTitle={writeTitle} setWriteTitle={setWriteTitle} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 1: LIBRARY
   ═══════════════════════════════════════════════ */
function LibraryTab({ searchQuery, setSearchQuery, autoSync, setAutoSync }: { searchQuery: string; setSearchQuery: (v: string) => void; autoSync: boolean; setAutoSync: (v: boolean) => void }) {
  return (
    <div className="space-y-6">
      {/* actions bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} strokeWidth={2.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full h-9 pl-9 pr-3 text-[12px] rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button className="h-9 px-3 text-[12px] font-medium rounded-md border border-border bg-card hover:bg-secondary flex items-center gap-1.5">
          <Filter size={13} strokeWidth={2.5} /> Filter
        </button>
        <button className="h-9 px-3 text-[12px] font-medium rounded-md border border-border bg-card hover:bg-secondary flex items-center gap-1.5">
          <ArrowDownAZ size={13} strokeWidth={2.5} /> Sort
        </button>
        <button className="h-9 px-3 text-[12px] font-medium rounded-md bg-indigo text-white hover:opacity-90 flex items-center gap-1.5">
          <Plus size={13} strokeWidth={2.5} /> Add knowledge
        </button>
      </div>

      {/* knowledge grid */}
      <div className="grid grid-cols-3 gap-3">
        {knowledgeItems.map((item, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-3.5 hover:border-muted-foreground/30 hover:shadow-sm transition-all group">
            {/* header */}
            <div className="flex items-start gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-[14px] shrink-0">{item.icon}</div>
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-foreground truncate">{item.name}</div>
                <div className="text-[10px] text-muted-foreground">{item.source}</div>
              </div>
            </div>
            {/* stats */}
            <div className="flex gap-1.5 mb-3">
              <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-foreground">{item.chunks} chunks</span>
            </div>
            {/* footer */}
            <div className="pt-2.5 border-t border-border flex items-center text-[10px]">
              <div className="flex items-center gap-1.5 flex-1">
                <div className={`w-[6px] h-[6px] rounded-full ${item.status === "indexed" ? "bg-green" : "bg-amber animate-pulse"}`} />
                <span className="font-medium text-muted-foreground capitalize">{item.status === "indexed" ? "Indexed" : "Syncing"}</span>
              </div>
              <span className="text-muted-foreground font-medium">⊟ {item.agents} agents</span>
              <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-[22px] h-[22px] rounded flex items-center justify-center hover:bg-secondary"><Edit2 size={11} strokeWidth={2.5} /></button>
                <button className="w-[22px] h-[22px] rounded flex items-center justify-center hover:bg-secondary text-destructive"><Trash2 size={11} strokeWidth={2.5} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* connected agents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-foreground">Connected agents</span>
          <button className="text-[11px] font-medium text-indigo hover:underline flex items-center gap-0.5">Manage access <ChevronRight size={12} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          {connectedAgents.map(a => (
            <div key={a} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary transition-colors">
              <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[10px]">🤖</div>
              <span className="text-[11px] font-medium text-foreground">{a}</span>
              <div className="w-[6px] h-[6px] rounded-full bg-green" />
            </div>
          ))}
        </div>
      </div>

      {/* auto-sync */}
      <div className="flex items-center gap-3 p-3.5 bg-secondary border border-border rounded-md">
        <RefreshCw size={15} strokeWidth={2.5} className="text-muted-foreground" />
        <div className="flex-1">
          <div className="text-[12px] font-medium text-foreground">Auto-sync enabled</div>
          <div className="text-[10px] text-muted-foreground">Last sync: 2 hours ago · Next sync: in 4 hours</div>
        </div>
        <button onClick={() => setAutoSync(!autoSync)}
          className="relative w-8 h-[18px] rounded-[9px] transition-colors"
          style={{ background: autoSync ? "hsl(var(--indigo))" : "hsl(var(--border))" }}
        >
          <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all"
            style={{ left: autoSync ? 14 : 2 }}
          />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 2: UPLOAD
   ═══════════════════════════════════════════════ */
function UploadTab() {
  const [hovering, setHovering] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">Upload documents</span>
        <button className="text-[11px] font-medium text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-secondary">Supported formats</button>
      </div>

      {/* dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setHovering(true); }}
        onDragLeave={() => setHovering(false)}
        onDrop={() => setHovering(false)}
        className={`flex flex-col items-center justify-center py-8 px-6 rounded-lg border-[1.5px] border-dashed transition-colors cursor-pointer
          ${hovering ? "border-indigo bg-indigo-light" : "border-border"}`}
      >
        <UploadCloud size={28} strokeWidth={2} className="text-muted-foreground mb-3" />
        <div className="text-[12px] font-medium text-foreground">Drop files here or click to upload</div>
        <div className="text-[10px] text-muted-foreground mt-1">Supports multiple files up to 50 MB each</div>
        <div className="flex flex-wrap gap-1.5 mt-4 justify-center">
          {["PDF", "DOCX", "TXT", "CSV", "XLSX", "PPTX", "MP3", "MP4"].map(f => (
            <span key={f} className="px-2 py-0.5 rounded-md bg-secondary text-[9px] font-medium text-muted-foreground">{f}</span>
          ))}
        </div>
      </div>

      {/* suggested */}
      <div className="grid grid-cols-2 gap-2.5">
        {suggestedUploads.map((s, i) => (
          <button key={i} className="flex items-start gap-2.5 p-3 rounded-md bg-secondary hover:bg-muted transition-colors text-left">
            <div className="w-7 h-7 rounded-md bg-card border border-border flex items-center justify-center text-muted-foreground shrink-0">{s.icon}</div>
            <div>
              <div className="text-[11px] font-medium text-foreground">{s.name}</div>
              <div className="text-[10px] text-muted-foreground">{s.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button className="h-9 px-4 text-[12px] font-medium rounded-md bg-indigo text-white hover:opacity-90">Process files</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 3: WEBSITE
   ═══════════════════════════════════════════════ */
function WebsiteTab({ crawlDepth, setCrawlDepth, syncFreq, setSyncFreq }: { crawlDepth: string; setCrawlDepth: (v: string) => void; syncFreq: string; setSyncFreq: (v: string) => void }) {
  return (
    <div className="space-y-6">
      <span className="text-[14px] font-medium text-foreground block">Scrape a website</span>

      <div className="space-y-4">
        {/* url */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">URL</label>
          <input placeholder="https://yourwebsite.com" className="w-full h-9 px-3 text-[12px] rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        {/* crawl depth */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">Crawl depth</label>
          <div className="flex gap-2">
            {[["single", "Single page"], ["full", "Full site"], ["paths", "Specific paths"]].map(([v, l]) => (
              <button key={v} onClick={() => setCrawlDepth(v)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors
                  ${crawlDepth === v ? "bg-indigo text-white border-indigo" : "bg-card border-border hover:bg-secondary"}`}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* auto-sync */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">Auto-sync</label>
          <div className="flex gap-2">
            {[["daily", "Daily"], ["weekly", "Weekly"], ["manual", "Manual only"]].map(([v, l]) => (
              <button key={v} onClick={() => setSyncFreq(v)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors
                  ${syncFreq === v ? "bg-indigo text-white border-indigo" : "bg-card border-border hover:bg-secondary"}`}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* label */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">Label</label>
          <input placeholder="e.g. Main website" className="w-full h-9 px-3 text-[12px] rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      {/* suggested websites */}
      <div>
        <label className="text-[11px] font-medium text-muted-foreground block mb-2">Suggested websites</label>
        <div className="flex flex-wrap gap-1.5">
          {["Your pricing page", "Your documentation", "Competitor website", "G2 reviews page", "Your blog", "Product changelog"].map(s => (
            <button key={s} className="px-3 py-1.5 rounded-md bg-secondary text-[11px] font-medium text-foreground hover:bg-muted transition-colors">{s}</button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className="h-9 px-3 text-[12px] font-medium rounded-md border border-border hover:bg-secondary">Preview scrape</button>
        <button className="h-9 px-4 text-[12px] font-medium rounded-md bg-indigo text-white hover:opacity-90">Start scraping</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 4: INTEGRATION
   ═══════════════════════════════════════════════ */
function IntegrationTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">Connect an integration</span>
        <button className="text-[11px] font-medium text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-secondary">Browse all integrations</button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {integrations.map(ig => (
          <div key={ig.name}
            className={`flex items-center gap-2.5 p-3 rounded-md border transition-colors
              ${ig.connected ? "border-green bg-green-light" : "border-border hover:bg-secondary"}`}
          >
            <div className="w-8 h-8 rounded-md bg-secondary border border-border flex items-center justify-center text-[12px] font-medium shrink-0">
              {ig.name.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground">{ig.name}</div>
            </div>
            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-md
              ${ig.connected ? "bg-green text-white" : "bg-secondary text-muted-foreground"}`}
            >{ig.connected ? "Connected" : "Connect"}</span>
          </div>
        ))}
      </div>

      {/* what gets synced */}
      <div className="bg-secondary rounded-md p-4 space-y-3">
        <span className="text-[12px] font-medium text-foreground">What gets synced</span>
        {syncedData.map(sd => (
          <div key={sd.integration} className="space-y-1">
            <span className="text-[11px] font-medium text-foreground">{sd.integration}</span>
            <div className="grid grid-cols-2 gap-1">
              {sd.items.map(item => (
                <div key={item} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Check size={10} strokeWidth={2.5} className="text-green" /> {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 5: WRITE
   ═══════════════════════════════════════════════ */
function WriteTab({ activeCategory, setActiveCategory, writeContent, setWriteContent, writeTitle, setWriteTitle }: {
  activeCategory: string; setActiveCategory: (v: string) => void;
  writeContent: string; setWriteContent: (v: string) => void;
  writeTitle: string; setWriteTitle: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-foreground">Write knowledge manually</span>
        <button className="text-[11px] font-medium text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-secondary">Formatting tips</button>
      </div>

      <div className="space-y-4">
        {/* title */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">Knowledge title</label>
          <input value={writeTitle} onChange={e => setWriteTitle(e.target.value)}
            placeholder="e.g. Ideal Customer Profile"
            className="w-full h-9 px-3 text-[12px] rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        {/* categories */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {categoryTags.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors
                  ${activeCategory === c ? "bg-indigo text-white border-indigo" : "bg-card border-border hover:bg-secondary"}`}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* textarea */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">Content</label>
          <textarea
            rows={10} value={writeContent} onChange={e => setWriteContent(e.target.value)}
            placeholder={"Our ideal customer is a B2B SaaS company with:\n- 50-500 employees\n- Series A to Series C funding\n- Using outbound sales as a primary channel\n- Annual contract value > $20K\n- Based in North America or Europe"}
            className="w-full px-3 py-2.5 text-[12px] rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
          />
        </div>
      </div>

      {/* writing prompts */}
      <div className="bg-secondary rounded-md p-4 space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground">Writing prompts</span>
        <div className="grid grid-cols-2 gap-2">
          {writingPrompts.map((p, i) => (
            <button key={i} onClick={() => setWriteContent(p)}
              className="text-left p-2.5 rounded-md bg-card border border-border text-[11px] text-foreground hover:bg-muted transition-colors">
              <Lightbulb size={12} className="text-amber inline mr-1.5" />{p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className="h-9 px-3 text-[12px] font-medium rounded-md border border-border hover:bg-secondary">Preview for agents</button>
        <button className="h-9 px-4 text-[12px] font-medium rounded-md bg-indigo text-white hover:opacity-90">Save knowledge</button>
      </div>
    </div>
  );
}
