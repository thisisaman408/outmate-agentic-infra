import { useState, useReducer, useCallback } from "react";
import {
  Search, Filter, Plus, MoreVertical, Sparkles, ChevronDown,
  Clock, Zap, Mail, Database, Bot, BarChart3, Globe, Users, Building2,
  Bell, Settings, Eye, ArrowRight, TrendingUp, Target, Layers,
  MessageSquare, Phone, Share2, Gauge, Shield, Workflow
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════
   WORKFLOWS TAB — Types & Data
   ═══════════════════════════════════════════════ */
type WfStatus = "draft" | "live" | "paused";
type TriggerType = "event" | "time" | "signal" | "manual";
interface ActionChip { label: string; icon: typeof Zap; color: string; }
interface WfItem {
  id: string; on: boolean; name: string; desc: string;
  status: WfStatus; trigger: TriggerType;
  target: "People" | "Companies" | "Signals"; owner: string;
  inProgress: number; completed: number; failed: number;
  lastRun: string; nextRun: string; folder: string; actions: ActionChip[];
}

const workflows: WfItem[] = [
  { id:"w1", on:false, name:"GTM Leadership Email Engagement Monitor", desc:"This workflow monitors email engagement from GTM leadership and triggers personalized follow-ups", status:"draft", trigger:"event", target:"People", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"(Upon event)", folder:"", actions:[{label:"Notification",icon:Bell,color:"#8B5CF6"}] },
  { id:"w2", on:false, name:"GTM Leadership Email Engagement Alerts", desc:"Automatically sends Slack notifications when key GTM leaders engage with emails", status:"draft", trigger:"event", target:"People", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"(Upon event)", folder:"", actions:[{label:"Notification",icon:Bell,color:"#8B5CF6"}] },
  { id:"w3", on:false, name:"Weekly AI Company Outreach Automation", desc:"This workflow runs weekly to identify target companies and auto-enrich with AI-powered outreach", status:"draft", trigger:"time", target:"Companies", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"-", folder:"", actions:[{label:"Add to sequence",icon:Mail,color:"#EF4444"}] },
  { id:"w4", on:false, name:"Target Website Visitors", desc:"This template will automatically identify and engage website visitors with high intent signals", status:"draft", trigger:"time", target:"Companies", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"-", folder:"", actions:[{label:"Add to account lists",icon:Database,color:"#6B7280"},{label:"Set account field",icon:Settings,color:"#6B7280"}] },
  { id:"w5", on:false, name:"Auto-enrich form submissions", desc:"Enrich every inbound lead on form submission with company and contact data", status:"draft", trigger:"event", target:"People", owner:"GS", inProgress:0, completed:0, failed:0, lastRun:"-", nextRun:"(Upon event)", folder:"", actions:[{label:"Enrich data",icon:Database,color:"#6B7280"}] },
];

type WfAction = { type:"TOGGLE"; id:string } | { type:"DELETE"; id:string } | { type:"SET"; workflows:WfItem[] };
function wfReducer(state: WfItem[], action: WfAction): WfItem[] {
  switch(action.type){
    case "TOGGLE": return state.map(w=>w.id===action.id?{...w,on:!w.on}:w);
    case "DELETE": return state.filter(w=>w.id!==action.id);
    case "SET": return action.workflows;
    default: return state;
  }
}

const triggerConfig = (t: TriggerType) => {
  if(t==="event") return {label:"Event-triggered",color:"#7C3AED"};
  if(t==="time") return {label:"Time-triggered",color:"#059669"};
  if(t==="signal") return {label:"Signal-triggered",color:"#D97706"};
  return {label:"Manual",color:"#6B7280"};
};
const targetConfig = (t: string) => {
  if(t==="People") return {color:"#7C3AED",icon:Users};
  if(t==="Companies") return {color:"#059669",icon:Building2};
  return {color:"#D97706",icon:Zap};
};

/* ═══════════════════════════════════════════════
   TEMPLATES TAB — Types & Data
   ═══════════════════════════════════════════════ */
interface FlowNode { label: string; icon: typeof Zap; color: string; }
interface Template {
  id: string; title: string; desc: string;
  tags: string[]; category: string;
  steps: FlowNode[];
  leads: string; conversion: string; useCase: string;
}

const categories = [
  { key: "all", label: "All Templates", icon: Layers },
  { key: "outbound", label: "Outbound", icon: Mail },
  { key: "inbound", label: "Inbound", icon: TrendingUp },
  { key: "enrichment", label: "Enrichment", icon: Database },
  { key: "scoring", label: "Scoring & Routing", icon: Gauge },
  { key: "signals", label: "Signal-Based", icon: Zap },
  { key: "ai", label: "AI-Powered", icon: Bot },
  { key: "multichannel", label: "Multi-Channel", icon: Share2 },
];

const tagColors: Record<string,{bg:string;color:string}> = {
  "AI": { bg:"rgba(139,92,246,.12)", color:"#A78BFA" },
  "Outbound": { bg:"rgba(59,130,246,.12)", color:"#60A5FA" },
  "Inbound": { bg:"rgba(16,185,129,.12)", color:"#34D399" },
  "Enrichment": { bg:"rgba(245,158,11,.12)", color:"#FBBF24" },
  "Scoring": { bg:"rgba(236,72,153,.12)", color:"#F472B6" },
  "CRM": { bg:"rgba(99,102,241,.12)", color:"#818CF8" },
  "Email": { bg:"rgba(14,165,233,.12)", color:"#38BDF8" },
  "LinkedIn": { bg:"rgba(59,130,246,.12)", color:"#60A5FA" },
  "Signal": { bg:"rgba(234,179,8,.12)", color:"#FACC15" },
  "Voice": { bg:"rgba(168,85,247,.12)", color:"#C084FC" },
  "Multi-Channel": { bg:"rgba(20,184,166,.12)", color:"#2DD4BF" },
};

const templates: Template[] = [
  {
    id:"t1", title:"AI-Powered Outbound Prospecting", desc:"Find and engage AI-ready companies with intelligent multi-step outreach",
    tags:["AI","Outbound","Enrichment"], category:"outbound",
    steps:[
      {label:"Signal Engine",icon:Zap,color:"#8B5CF6"},
      {label:"Waterfall Enrich",icon:Database,color:"#3B82F6"},
      {label:"AI Score",icon:Bot,color:"#F59E0B"},
      {label:"Email Sequence",icon:Mail,color:"#10B981"},
      {label:"CRM Push",icon:Building2,color:"#6366F1"},
    ],
    leads:"120–300/mo", conversion:"8–14%", useCase:"Outbound SDR",
  },
  {
    id:"t2", title:"Inbound Lead Auto-Enrichment", desc:"Auto-enrich inbound leads and push scored contacts to CRM instantly",
    tags:["Inbound","Enrichment","CRM"], category:"inbound",
    steps:[
      {label:"Form Trigger",icon:Globe,color:"#8B5CF6"},
      {label:"Enrich Data",icon:Database,color:"#3B82F6"},
      {label:"ICP Match",icon:Target,color:"#F59E0B"},
      {label:"CRM Sync",icon:Building2,color:"#6366F1"},
    ],
    leads:"50–150/mo", conversion:"18–25%", useCase:"Inbound Ops",
  },
  {
    id:"t3", title:"Website Visitor Intent Capture", desc:"Identify anonymous website visitors and trigger real-time outreach sequences",
    tags:["Signal","Enrichment","Outbound"], category:"signals",
    steps:[
      {label:"Visitor ID",icon:Globe,color:"#8B5CF6"},
      {label:"De-anonymize",icon:Users,color:"#3B82F6"},
      {label:"Enrich",icon:Database,color:"#F59E0B"},
      {label:"Score",icon:Gauge,color:"#10B981"},
      {label:"Sequence",icon:Mail,color:"#6366F1"},
    ],
    leads:"200–500/mo", conversion:"5–10%", useCase:"Demand Gen",
  },
  {
    id:"t4", title:"Multi-Channel Engagement Engine", desc:"Orchestrate email, LinkedIn, and voice across a single unified workflow",
    tags:["Multi-Channel","AI","Email","LinkedIn","Voice"], category:"multichannel",
    steps:[
      {label:"Trigger",icon:Zap,color:"#8B5CF6"},
      {label:"Email",icon:Mail,color:"#3B82F6"},
      {label:"Wait",icon:Clock,color:"#F59E0B"},
      {label:"LinkedIn",icon:MessageSquare,color:"#10B981"},
      {label:"Voice AI",icon:Phone,color:"#EF4444"},
      {label:"CRM",icon:Building2,color:"#6366F1"},
    ],
    leads:"80–200/mo", conversion:"12–20%", useCase:"Full-Cycle AE",
  },
  {
    id:"t5", title:"AI Lead Scoring Pipeline", desc:"Score every lead with AI-powered ICP matching and route to the right rep",
    tags:["AI","Scoring","CRM"], category:"scoring",
    steps:[
      {label:"Trigger",icon:Zap,color:"#8B5CF6"},
      {label:"Enrich",icon:Database,color:"#3B82F6"},
      {label:"AI Score",icon:Bot,color:"#F59E0B"},
      {label:"Route",icon:Share2,color:"#10B981"},
      {label:"CRM",icon:Building2,color:"#6366F1"},
    ],
    leads:"All inbound", conversion:"2× faster routing", useCase:"Rev Ops",
  },
  {
    id:"t6", title:"Hiring Signal Outreach", desc:"Detect hiring signals and auto-trigger personalized outbound to growing teams",
    tags:["Signal","AI","Outbound"], category:"signals",
    steps:[
      {label:"Hiring Signal",icon:Zap,color:"#8B5CF6"},
      {label:"Enrich",icon:Database,color:"#3B82F6"},
      {label:"AI Personalize",icon:Bot,color:"#F59E0B"},
      {label:"Sequence",icon:Mail,color:"#10B981"},
    ],
    leads:"60–180/mo", conversion:"10–16%", useCase:"Signal-Based SDR",
  },
  {
    id:"t7", title:"Data Waterfall Enrichment", desc:"Run contacts through a multi-provider waterfall to maximize data coverage",
    tags:["Enrichment","CRM"], category:"enrichment",
    steps:[
      {label:"Import",icon:Database,color:"#8B5CF6"},
      {label:"PDL",icon:Shield,color:"#3B82F6"},
      {label:"Hunter",icon:Globe,color:"#F59E0B"},
      {label:"Clearbit",icon:Users,color:"#10B981"},
      {label:"CRM Sync",icon:Building2,color:"#6366F1"},
    ],
    leads:"Batch process", conversion:"85–95% fill rate", useCase:"Data Ops",
  },
  {
    id:"t8", title:"AI Reply Classification", desc:"Classify email replies with AI and auto-route positive responses to sales",
    tags:["AI","Email","CRM"], category:"ai",
    steps:[
      {label:"Reply Trigger",icon:Mail,color:"#8B5CF6"},
      {label:"AI Classify",icon:Bot,color:"#3B82F6"},
      {label:"Route",icon:Share2,color:"#F59E0B"},
      {label:"CRM Update",icon:Building2,color:"#10B981"},
      {label:"Slack Alert",icon:Bell,color:"#6366F1"},
    ],
    leads:"All replies", conversion:"3× faster response", useCase:"Sales Ops",
  },
];

/* ═══════════════════════════════════════════════
   Mini Flow Component
   ═══════════════════════════════════════════════ */
function MiniFlow({ steps, size = "sm" }: { steps: FlowNode[]; size?: "sm" | "md" }) {
  const nodeH = size === "md" ? "py-1.5 px-2.5" : "py-1 px-2";
  const textSz = size === "md" ? "text-[11px]" : "text-[10px]";
  const iconSz = size === "md" ? 12 : 10;
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={i} className="flex items-center shrink-0">
            <div className={`flex items-center gap-1.5 ${nodeH} rounded-md`} style={{ background: `${step.color}12` }}>
              <Icon size={iconSz} style={{ color: step.color }} />
              <span className={`${textSz} font-medium whitespace-nowrap`} style={{ color: step.color }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center px-0.5">
                <div className="w-3 h-px" style={{ background: "rgba(255,255,255,.1)" }} />
                <ArrowRight size={7} style={{ color: "rgba(255,255,255,.15)" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Template Card
   ═══════════════════════════════════════════════ */
function TemplateCard({ t, onUse, onView }: { t: Template; onUse: () => void; onView: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="rounded-xl p-4 flex flex-col transition-all duration-200 group"
      style={{
        background: hovered ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.025)",
        border: `1px solid ${hovered ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.06)"}`,
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,.25)" : "0 2px 8px rgba(0,0,0,.1)",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tags */}
      <div className="flex flex-wrap gap-1 mb-3">
        {t.tags.map(tag => {
          const tc = tagColors[tag] || { bg: "rgba(255,255,255,.06)", color: "#A0A0B0" };
          return (
            <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: tc.bg, color: tc.color }}>
              {tag}
            </span>
          );
        })}
      </div>

      {/* Title + Desc */}
      <h3 className="text-[14px] font-semibold mb-1" style={{ color: "#F0F0F4" }}>{t.title}</h3>
      <p className="text-[12px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,.4)" }}>{t.desc}</p>

      {/* Mini Flow */}
      <div className="rounded-lg px-3 py-2.5 mb-3" style={{ background: "rgba(0,0,0,.2)", border: "1px solid rgba(255,255,255,.04)" }}>
        <MiniFlow steps={t.steps} size="md" />
      </div>

      {/* Expected Outcomes */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(16,185,129,.06)" }}>
          <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,.3)" }}>Leads</div>
          <div className="text-[12px] font-semibold" style={{ color: "#34D399" }}>{t.leads}</div>
        </div>
        <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(59,130,246,.06)" }}>
          <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,.3)" }}>Conv. Rate</div>
          <div className="text-[12px] font-semibold" style={{ color: "#60A5FA" }}>{t.conversion}</div>
        </div>
        <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(139,92,246,.06)" }}>
          <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,.3)" }}>Use Case</div>
          <div className="text-[12px] font-semibold" style={{ color: "#A78BFA" }}>{t.useCase}</div>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex items-center gap-2 mt-auto">
        <button onClick={onView}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-colors"
          style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#C8C8D4" }}
        >
          <Eye size={13} /> View Flow
        </button>
        <button onClick={onUse}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-colors"
          style={{ background: "linear-gradient(135deg, #B8860B 0%, #D4A020 100%)", color: "#FFFFFF", boxShadow: "0 2px 8px rgba(184,134,11,.25)" }}
        >
          <Plus size={13} /> Use Template
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */
export default function WorkflowsPage({ defaultTab }: { defaultTab?: "workflows" | "templates" }) {
  const navigate = useNavigate();
  const [wfs, dispatch] = useReducer(wfReducer, workflows);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"workflows" | "templates">(defaultTab || "workflows");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [templateSearch, setTemplateSearch] = useState("");

  const filtered = wfs.filter(w => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
    if (templateSearch && !t.title.toLowerCase().includes(templateSearch.toLowerCase()) && !t.desc.toLowerCase().includes(templateSearch.toLowerCase())) return false;
    return true;
  });

  const openWorkflow = useCallback((_id: string) => { navigate("/workflow-canvas"); }, [navigate]);
  const createNew = useCallback(() => { navigate("/workflow-canvas"); }, [navigate]);

  const columns = [
    { key:"toggle", label:"Off / On", w:"60px" },
    { key:"name", label:"Name", w:"1fr" },
    { key:"status", label:"Status", w:"90px" },
    { key:"actions", label:"Actions", w:"200px" },
    { key:"target", label:"Target", w:"120px" },
    { key:"trigger", label:"Trigger", w:"140px" },
    { key:"inProgress", label:"In progress", w:"90px" },
    { key:"completed", label:"Completed", w:"90px" },
    { key:"failed", label:"Failed", w:"70px" },
    { key:"owner", label:"Owner", w:"65px" },
    { key:"folder", label:"Folder", w:"65px" },
    { key:"lastRun", label:"Last run", w:"80px" },
    { key:"nextRun", label:"Next run", w:"110px" },
    { key:"menu", label:"", w:"36px" },
  ];
  const gridTemplate = columns.map(c => c.w).join(" ");

  return (
    <div className="h-full flex flex-col" style={{ background: "#1A1A22", fontFamily: "Inter, system-ui, sans-serif", color: "#E2E2E8" }}>
      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-5 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[20px] font-bold" style={{ color: "#F0F0F4" }}>Workflows</h1>
          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "#A0A0B0" }}>
              Learn more <ChevronDown size={14} />
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium"
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)", color: "#C8C8D4" }}>
              <Sparkles size={14} style={{ color: "#D4A844" }} /> Outbound Copilot
            </button>
            <button onClick={createNew} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold"
              style={{ background: "#FFFFFF", color: "#111116" }}>
              Create workflow
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
          <div className="flex gap-0">
            {(["workflows", "templates"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className="px-4 py-2.5 text-[13px] font-medium capitalize"
                style={{
                  color: tab === t ? "#F0F0F4" : "rgba(255,255,255,.35)",
                  borderBottom: tab === t ? "2px solid #F0F0F4" : "2px solid transparent",
                }}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════ WORKFLOWS TAB ═══════════ */}
      {tab === "workflows" && (
        <>
          <div className="shrink-0 px-6">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium" style={{ color: "#A0A0B0" }}>
                  <Filter size={13} /> Show Filters
                </button>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,.25)" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows"
                    className="pl-8 pr-3 py-1.5 rounded-md text-[12px] w-[200px] placeholder:text-[rgba(255,255,255,.25)]"
                    style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#E2E2E8", outline: "none" }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium" style={{ color: "#A0A0B0" }}>
                  <BarChart3 size={13} /> Sort
                </button>
                <button className="p-1.5 rounded-md" style={{ color: "#A0A0B0" }}><Settings size={15} /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6">
            <div className="grid items-center py-2.5 text-[11px] font-medium uppercase tracking-wider"
              style={{ gridTemplateColumns: gridTemplate, color: "rgba(255,255,255,.35)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              {columns.map(c => <div key={c.key}>{c.label}</div>)}
            </div>

            {filtered.map(w => {
              const trig = triggerConfig(w.trigger);
              const tgt = targetConfig(w.target);
              const TgtIcon = tgt.icon;
              const extraActions = w.actions.length > 2 ? w.actions.length - 2 : 0;
              const shownActions = w.actions.slice(0, 2);

              return (
                <div key={w.id}
                  className="grid items-center py-3 cursor-pointer transition-colors hover:bg-[rgba(255,255,255,.03)]"
                  style={{ gridTemplateColumns: gridTemplate, borderBottom: "1px solid rgba(255,255,255,.04)" }}
                  onClick={() => openWorkflow(w.id)}>
                  <div>
                    <button onClick={e => { e.stopPropagation(); dispatch({ type: "TOGGLE", id: w.id }); }}
                      className="w-9 h-[20px] rounded-full relative transition-colors duration-200"
                      style={{ background: w.on ? "#10B981" : "rgba(255,255,255,.12)" }}>
                      <div className="absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ left: w.on ? "18px" : "2px" }} />
                    </button>
                  </div>
                  <div className="min-w-0 pr-3">
                    <div className="text-[13px] font-medium truncate" style={{ color: "#E2E2E8" }}>{w.name}</div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>{w.desc}</div>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ background: "rgba(255,255,255,.06)", color: "#A0A0B0" }}>
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: w.status === "live" ? "#10B981" : w.status === "paused" ? "#F59E0B" : "#64748B" }} />
                      {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    {shownActions.map((a, i) => {
                      const Icon = a.icon;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium truncate"
                          style={{ background: "rgba(255,255,255,.06)", color: "#C8C8D4" }}>
                          <Icon size={11} style={{ color: a.color }} /> {a.label}
                        </span>
                      );
                    })}
                    {extraActions > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,.06)", color: "#A0A0B0" }}>+{extraActions}</span>
                    )}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ background: `${tgt.color}18`, color: tgt.color }}>
                      <TgtIcon size={11} /> {w.target}
                    </span>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ background: `${trig.color}18`, color: trig.color }}>
                      {w.trigger === "time" ? <Clock size={11} /> : <Zap size={11} />}
                      {trig.label}
                    </span>
                  </div>
                  <div className="text-[13px]" style={{ color: w.inProgress > 0 ? "#E2E2E8" : "rgba(255,255,255,.2)" }}>{w.inProgress > 0 ? w.inProgress : "-"}</div>
                  <div className="text-[13px]" style={{ color: w.completed > 0 ? "#E2E2E8" : "rgba(255,255,255,.2)" }}>{w.completed > 0 ? w.completed : "-"}</div>
                  <div className="text-[13px]" style={{ color: w.failed > 0 ? "#F87171" : "rgba(255,255,255,.2)" }}>{w.failed > 0 ? w.failed : "-"}</div>
                  <div>
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold"
                      style={{ background: "rgba(255,255,255,.08)", color: "#A0A0B0" }}>{w.owner}</span>
                  </div>
                  <div className="text-[12px]" style={{ color: "rgba(255,255,255,.2)" }}>-</div>
                  <div className="text-[12px]" style={{ color: "rgba(255,255,255,.35)" }}>{w.lastRun}</div>
                  <div className="text-[12px]" style={{ color: "rgba(255,255,255,.35)" }}>{w.nextRun}</div>
                  <div>
                    <button onClick={e => e.stopPropagation()} className="p-1 rounded hover:bg-[rgba(255,255,255,.06)]">
                      <MoreVertical size={15} style={{ color: "rgba(255,255,255,.3)" }} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-[14px]" style={{ color: "rgba(255,255,255,.3)" }}>No workflows found</p>
                <button onClick={createNew} className="mt-3 px-4 py-2 rounded-lg text-[13px] font-medium"
                  style={{ background: "rgba(255,255,255,.06)", color: "#D4A844" }}>
                  Create your first workflow
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════ TEMPLATES TAB ═══════════ */}
      {tab === "templates" && (
        <div className="flex-1 flex overflow-hidden">
          {/* Category Sidebar */}
          <div className="w-[200px] shrink-0 py-4 px-3 overflow-y-auto" style={{ borderRight: "1px solid rgba(255,255,255,.06)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: "rgba(255,255,255,.3)" }}>Categories</div>
            {categories.map(cat => {
              const active = selectedCategory === cat.key;
              const CatIcon = cat.icon;
              return (
                <button key={cat.key} onClick={() => setSelectedCategory(cat.key)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors mb-0.5"
                  style={{
                    background: active ? "rgba(184,134,11,.1)" : "transparent",
                    color: active ? "#D4A844" : "rgba(255,255,255,.45)",
                  }}>
                  <CatIcon size={14} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Template Grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="shrink-0 px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,.25)" }} />
                  <input value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Search templates..."
                    className="pl-8 pr-3 py-1.5 rounded-md text-[12px] w-[260px] placeholder:text-[rgba(255,255,255,.25)]"
                    style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", color: "#E2E2E8", outline: "none" }}
                  />
                </div>
                <span className="text-[12px]" style={{ color: "rgba(255,255,255,.3)" }}>{filteredTemplates.length} templates</span>
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-auto px-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                {filteredTemplates.map(t => (
                  <TemplateCard
                    key={t.id}
                    t={t}
                    onView={() => navigate("/workflow-canvas")}
                    onUse={() => navigate("/workflow-canvas")}
                  />
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Layers size={40} style={{ color: "rgba(255,255,255,.1)" }} />
                  <p className="text-[14px] mt-3" style={{ color: "rgba(255,255,255,.3)" }}>No templates match your search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
