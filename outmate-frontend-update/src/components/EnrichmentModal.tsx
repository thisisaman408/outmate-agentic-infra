import { useState, useMemo } from "react";
import {
  Mail, Phone, Linkedin, Building2, Target, PenTool, Activity, Upload,
  X, Flame, Sparkles, Check, Trash2, Coins
} from "lucide-react";

// ── ENRICHMENT DATA ──────────────────────────────────────

type EnrichAction = {
  id: string;
  title: string;
  description: string;
  creditPerRow: number;
  badge?: "Hot" | "Free";
};

type Category = {
  id: string;
  label: string;
  icon: React.ElementType;
  actions: EnrichAction[];
};

const categories: Category[] = [
  {
    id: "email", label: "Email", icon: Mail,
    actions: [
      { id: "find-work-email", title: "Find work email", description: "Waterfall lookup across 6 providers for verified work email", creditPerRow: 3, badge: "Hot" },
      { id: "verify-email", title: "Verify email", description: "Check deliverability and catch-all status for existing emails", creditPerRow: 1 },
      { id: "find-personal-email", title: "Find personal email", description: "Lookup personal/home email address for direct outreach", creditPerRow: 4 },
      { id: "analyze-email-fill", title: "Analyze email fill rate", description: "See how many selected contacts already have verified emails and where gaps exist", creditPerRow: 0, badge: "Free" },
    ],
  },
  {
    id: "phone", label: "Phone", icon: Phone,
    actions: [
      { id: "find-phone", title: "Find phone number", description: "Direct dial and mobile lookup", creditPerRow: 5 },
      { id: "verify-phone", title: "Verify phone number", description: "Validate phone reachability and format", creditPerRow: 1 },
      { id: "analyze-phone", title: "Analyze phone coverage", description: "Review phone coverage across selected contacts", creditPerRow: 0, badge: "Free" },
    ],
  },
  {
    id: "linkedin", label: "LinkedIn", icon: Linkedin,
    actions: [
      { id: "find-linkedin", title: "Find LinkedIn URL", description: "Match missing LinkedIn profiles", creditPerRow: 1 },
      { id: "extract-profile", title: "Extract profile insights", description: "Summarize role, experience, and seniority", creditPerRow: 2 },
      { id: "gather-posts", title: "Gather professional posts", description: "Pull recent public LinkedIn activity", creditPerRow: 3 },
      { id: "analyze-linkedin", title: "Analyze LinkedIn fill rate", description: "See profile coverage across selected contacts", creditPerRow: 0, badge: "Free" },
    ],
  },
  {
    id: "company", label: "Company", icon: Building2,
    actions: [
      { id: "company-brief", title: "Add company brief", description: "Generate a 10-second company summary", creditPerRow: 2 },
      { id: "find-hq", title: "Find company HQ", description: "Enrich company location and headquarters", creditPerRow: 1 },
      { id: "find-tech", title: "Find technologies used", description: "Identify current tech stack", creditPerRow: 3 },
      { id: "funding-stage", title: "Company funding stage", description: "Enrich funding and company maturity", creditPerRow: 2 },
      { id: "employee-range", title: "Company employee range", description: "Estimate employee band", creditPerRow: 1 },
    ],
  },
  {
    id: "icp", label: "ICP & Scoring", icon: Target,
    actions: [
      { id: "icp-fit", title: "ICP fit score", description: "Score contacts based on your ICP criteria", creditPerRow: 5, badge: "Hot" },
      { id: "seniority-tags", title: "Seniority & role tags", description: "Standardize title, department, and level", creditPerRow: 2 },
      { id: "buying-intent", title: "Buying intent score", description: "Estimate likelihood of active interest", creditPerRow: 4 },
    ],
  },
  {
    id: "ai-writing", label: "AI Writing", icon: PenTool,
    actions: [
      { id: "personal-opener", title: "Personalized opener", description: "AI-written first line for outreach", creditPerRow: 4, badge: "Hot" },
      { id: "person-brief", title: "Person brief", description: "Short summary for sales context", creditPerRow: 2 },
      { id: "outreach-angles", title: "Outreach angle suggestions", description: "Suggest hooks based on role and activity", creditPerRow: 3 },
      { id: "ai-email-draft", title: "AI email draft", description: "Generate a cold email draft", creditPerRow: 5 },
    ],
  },
  {
    id: "signals", label: "Signals", icon: Activity,
    actions: [
      { id: "job-change", title: "Job change signal", description: "Detect recent role or employer change", creditPerRow: 3 },
      { id: "hiring-signal", title: "Hiring signal", description: "Check if company is actively hiring", creditPerRow: 2 },
      { id: "news-mention", title: "Recent news mention", description: "Detect notable recent public mentions", creditPerRow: 2 },
      { id: "website-activity", title: "Website activity signal", description: "Identify web engagement if available", creditPerRow: 5 },
    ],
  },
  {
    id: "export", label: "Export & Push", icon: Upload,
    actions: [
      { id: "push-crm", title: "Push to CRM", description: "Send selected contacts into connected CRM", creditPerRow: 0, badge: "Free" },
      { id: "export-csv", title: "Export CSV", description: "Download selected records as CSV", creditPerRow: 0, badge: "Free" },
      { id: "add-sequence", title: "Add to sequence", description: "Push selected contacts into an outreach flow", creditPerRow: 0, badge: "Free" },
      { id: "create-workflow", title: "Create workflow", description: "Trigger automated enrichment workflow", creditPerRow: 0, badge: "Free" },
    ],
  },
];

// ── COMPONENT ────────────────────────────────────────────

interface EnrichmentModalProps {
  open: boolean;
  onClose: () => void;
  selectedRows: number;
  totalCredits?: number;
}

export default function EnrichmentModal({ open, onClose, selectedRows, totalCredits = 22400 }: EnrichmentModalProps) {
  const [activeCat, setActiveCat] = useState("email");
  const [queue, setQueue] = useState<string[]>([]);

  const activeCategory = categories.find(c => c.id === activeCat)!;

  const toggleAction = (actionId: string) => {
    setQueue(prev => prev.includes(actionId) ? prev.filter(id => id !== actionId) : [...prev, actionId]);
  };

  const removeAction = (actionId: string) => {
    setQueue(prev => prev.filter(id => id !== actionId));
  };

  const queuedActions = useMemo(() => {
    return queue.map(id => {
      for (const cat of categories) {
        const action = cat.actions.find(a => a.id === id);
        if (action) return { ...action, category: cat.label };
      }
      return null;
    }).filter(Boolean) as (EnrichAction & { category: string })[];
  }, [queue]);

  const estimatedCredits = useMemo(() => {
    return queuedActions.reduce((sum, a) => sum + a.creditPerRow * selectedRows, 0);
  }, [queuedActions, selectedRows]);

  const overBudget = estimatedCredits > totalCredits;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — light theme */}
      <div className="relative z-10 w-[960px] max-w-[95vw] h-[560px] max-h-[85vh] rounded-xl overflow-hidden flex flex-col bg-card border border-border shadow-xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div>
            <h2 className="text-[15px] font-bold text-foreground tracking-[-0.01em]">Enrich selected contacts</h2>
            <p className="text-[11px] mt-0.5 text-muted-foreground">
              {selectedRows} rows selected · choose actions to run
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-light text-indigo">
              <Coins className="w-3 h-3" />
              {totalCredits.toLocaleString()} credits left
            </span>
            <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* ── Body: 3-column ── */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT: Categories */}
          <div className="w-[180px] min-w-[180px] py-2 overflow-y-auto border-r border-border bg-secondary/30" style={{ scrollbarWidth: "thin" }}>
            {categories.map(cat => {
              const isActive = activeCat === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    isActive ? "bg-indigo-light" : "hover:bg-secondary"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-indigo" : "text-muted-foreground"}`} />
                  <span className={`text-[12px] font-medium flex-1 ${isActive ? "text-indigo font-semibold" : "text-foreground"}`}>{cat.label}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ${
                    isActive ? "bg-indigo/10 text-indigo" : "bg-secondary text-muted-foreground"
                  }`}>
                    {cat.actions.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* CENTER: Action cards */}
          <div className="flex-1 min-w-0 p-4 overflow-y-auto space-y-2" style={{ scrollbarWidth: "thin" }}>
            <div className="flex items-center gap-2 mb-3">
              <activeCategory.icon className="w-4 h-4 text-indigo" />
              <span className="text-[13px] font-semibold text-foreground">{activeCategory.label}</span>
              <span className="text-[11px] text-muted-foreground">{activeCategory.actions.length} actions</span>
            </div>

            {activeCategory.actions.map(action => {
              const isSelected = queue.includes(action.id);
              return (
                <button
                  key={action.id}
                  onClick={() => toggleAction(action.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all border ${
                    isSelected
                      ? "border-indigo bg-indigo-light"
                      : "border-border hover:bg-secondary/50"
                  }`}
                >
                  {/* Selection indicator */}
                  <div className={`w-[18px] h-[18px] rounded-[4px] flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? "bg-indigo" : "border border-border"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-foreground">{action.title}</span>
                      {action.badge === "Hot" && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] bg-destructive/10 text-destructive uppercase tracking-[.03em]">
                          <Flame className="w-[9px] h-[9px]" /> Hot
                        </span>
                      )}
                      {action.badge === "Free" && (
                        <span className="text-[9px] font-bold px-1.5 py-[1px] rounded-[3px] bg-green-light text-green-text uppercase tracking-[.03em]">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] mt-0.5 text-muted-foreground">{action.description}</p>
                  </div>

                  {/* Credit pill */}
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    action.creditPerRow === 0 ? "bg-green-light text-green-text" : "bg-indigo-light text-indigo"
                  }`}>
                    {action.creditPerRow === 0 ? "free" : `${action.creditPerRow} cr/row`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIGHT: Queue */}
          <div className="w-[240px] min-w-[240px] flex flex-col border-l border-border bg-secondary/20">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-foreground">Queue</span>
                {queue.length > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-indigo-light text-indigo">
                    {queue.length}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: "thin" }}>
              {queuedActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Sparkles className="w-5 h-5 mb-2 text-muted-foreground/30" />
                  <span className="text-[11px] text-muted-foreground">No actions selected</span>
                  <span className="text-[10px] text-muted-foreground/60 mt-0.5">Click actions to add them</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {queuedActions.map(action => (
                    <div key={action.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary group">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold text-foreground truncate">{action.title}</div>
                        <div className="text-[9px] text-muted-foreground">{action.creditPerRow === 0 ? "free" : `${action.creditPerRow} cr/row`}</div>
                      </div>
                      <button
                        onClick={() => removeAction(action.id)}
                        className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Queue footer */}
            <div className="px-4 py-3 space-y-2.5 border-t border-border">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Rows</span>
                  <span className="text-foreground font-medium">{selectedRows}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Actions</span>
                  <span className="text-foreground font-medium">{queuedActions.length}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Est. credits</span>
                  <span className={`font-bold ${overBudget ? "text-destructive" : "text-indigo"}`}>
                    {estimatedCredits.toLocaleString()}
                  </span>
                </div>
              </div>

              {overBudget && (
                <div className="text-[9px] text-destructive bg-destructive/10 rounded-md px-2 py-1.5 text-center">
                  Estimated credits exceed available balance
                </div>
              )}

              <p className="text-[9px] text-muted-foreground/60 text-center">Credits are charged only for successful enrichments</p>

              <button
                disabled={queue.length === 0 || overBudget}
                className={`w-full py-2 text-[11px] font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  queue.length === 0 || overBudget
                    ? "bg-secondary text-muted-foreground cursor-not-allowed"
                    : "bg-indigo text-white hover:opacity-90"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Run enrichments
              </button>
              <button className="w-full py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                Save as workflow
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
