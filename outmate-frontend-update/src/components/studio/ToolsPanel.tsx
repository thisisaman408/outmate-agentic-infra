import { useState } from "react";
import { GripVertical, Clock } from "lucide-react";
import { C } from "./constants";

/* ── Tool items data ── */
const LOGIC = [
  { name: "True / false branch", sub: "Binary condition", icon: "⊤", bg: "rgba(59,130,246,.15)", color: "#60A5FA", cr: "0" },
  { name: "Multi-split branch", sub: "Multiple paths", icon: "⊞", bg: "rgba(168,85,247,.15)", color: "#C084FC", cr: "0" },
  { name: "Delay", sub: "Wait N hours/days", icon: "⏳", bg: "rgba(245,158,11,.15)", color: "#FCD34D", cr: "0" },
  { name: "Loop", sub: "Re-enter flow", icon: "↻", bg: "rgba(16,185,129,.15)", color: "#34D399", cr: "0" },
  { name: "Exit", sub: "End workflow", icon: "⏹", bg: "rgba(239,68,68,.12)", color: "#F87171", cr: "0" },
];
const AGENTS = [
  { name: "AI SDR", sub: "Autonomous outbound", icon: "◈", bg: "rgba(79,70,229,.15)", color: "#818CF8", cr: "5" },
  { name: "Prospect Brief", sub: "Contact dossier", icon: "◉", bg: "rgba(168,85,247,.15)", color: "#C084FC", cr: "2" },
  { name: "ICP Scorer", sub: "Lead scoring", icon: "★", bg: "rgba(245,158,11,.15)", color: "#FCD34D", cr: "2" },
  { name: "Personal Opener", sub: "Email personalisation", icon: "✦", bg: "rgba(59,130,246,.15)", color: "#60A5FA", cr: "1" },
];
const ACTIONS = [
  { name: "Send email", sub: "Gmail / SMTP", icon: "✉", bg: "rgba(16,185,129,.15)", color: "#34D399", cr: "1" },
  { name: "LinkedIn outreach", sub: "Via Unipile", icon: "⊕", bg: "rgba(59,130,246,.15)", color: "#60A5FA", cr: "1" },
  { name: "Slack notify", sub: "Channel message", icon: "▣", bg: "rgba(245,158,11,.15)", color: "#FCD34D", cr: "0" },
  { name: "Update CRM", sub: "HubSpot / Salesforce", icon: "◧", bg: "rgba(168,85,247,.15)", color: "#C084FC", cr: "0" },
  { name: "Enrich contact", sub: "Waterfall cascade", icon: "◎", bg: "rgba(79,70,229,.15)", color: "#818CF8", cr: "1–3" },
];

const TRIGGERS = [
  { name: "Every 6 hours", sub: "Scheduled interval", icon: "⏰", on: true },
  { name: "Signal ≥ High", sub: "Intent threshold", icon: "⚡", on: true },
  { name: "Manual run", sub: "Click to trigger", icon: "▶", on: true },
  { name: "Webhook", sub: "External HTTP call", icon: "⬡", on: false },
  { name: "CRM stage change", sub: "Deal stage event", icon: "⊞", on: false },
  { name: "Email reply received", sub: "Inbound reply", icon: "✉", on: false },
];

const APIS = [
  { name: "Crustdata", sub: "Company data", connected: true },
  { name: "Gmail", sub: "Email sending", connected: true },
  { name: "HubSpot", sub: "CRM sync", connected: true },
  { name: "LinkedIn / Unipile", sub: "Social outreach", connected: false },
  { name: "Salesforce", sub: "CRM sync", connected: false },
  { name: "G2 Intent", sub: "Buyer signals", connected: false },
];

const CREDIT_STEPS = [
  { name: "Signal trigger", cr: "0 cr", amber: false },
  { name: "Waterfall enrichment", cr: "1–3 cr", amber: true },
  { name: "AI lead scoring", cr: "2 cr", amber: true },
  { name: "Email sequence", cr: "1 cr", amber: false },
  { name: "CRM update", cr: "0 cr", amber: false },
];

function ToolCard({ item }: { item: typeof LOGIC[0] }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab transition-colors group"
      style={{ background: "rgba(255,255,255,.03)", borderColor: C.border07 }}>
      <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-[13px] shrink-0" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium" style={{ color: C.text70 }}>{item.name}</div>
        <div className="text-[10px]" style={{ color: C.text30 }}>{item.sub}</div>
      </div>
      <span className="text-[9px] font-medium shrink-0" style={{ color: item.cr === "0" ? C.text30 : "#FCD34D" }}>{item.cr} cr</span>
      <GripVertical size={12} className="shrink-0 opacity-15 group-hover:opacity-35 transition-opacity" style={{ color: "#fff" }} />
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-7 h-4 rounded-full p-[2px] transition-colors shrink-0"
      style={{ background: on ? C.primary : "rgba(255,255,255,.1)" }}>
      <div className="w-3 h-3 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(12px)" : "translateX(0)" }} />
    </button>
  );
}

export default function ToolsPanel() {
  const [tab, setTab] = useState<"tools" | "triggers" | "apis" | "credits">("tools");
  const [triggers, setTriggers] = useState(TRIGGERS.map(t => t.on));

  const TABS = [
    { id: "tools" as const, label: "Tools" },
    { id: "triggers" as const, label: "Triggers" },
    { id: "apis" as const, label: "APIs" },
    { id: "credits" as const, label: "Credits" },
  ];

  return (
    <div className="w-[268px] shrink-0 flex flex-col border-l" style={{ background: C.panel, borderColor: C.border07 }}>
      {/* Tabs */}
      <div className="flex border-b shrink-0" style={{ borderColor: C.border07 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 h-9 text-[11px] font-medium transition-colors relative"
            style={{ color: tab === t.id ? "#fff" : C.text30 }}>
            {t.label}
            {tab === t.id && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: C.primary }} />}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 studio-scroll">
        {tab === "tools" && (
          <div className="space-y-4">
            <Section label="Logic">{LOGIC.map((t, i) => <ToolCard key={i} item={t} />)}</Section>
            <Section label="AI Agents" badge="NEW">{AGENTS.map((t, i) => <ToolCard key={i} item={t} />)}</Section>
            <Section label="Actions">{ACTIONS.map((t, i) => <ToolCard key={i} item={t} />)}</Section>
          </div>
        )}

        {tab === "triggers" && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.text25 }}>Active triggers</div>
            <div className="space-y-1.5">
              {TRIGGERS.map((t, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.03)" }}>
                  <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-[12px] shrink-0"
                    style={{ background: "rgba(255,255,255,.07)", color: C.text40 }}>{t.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium" style={{ color: C.text70 }}>{t.name}</div>
                    <div className="text-[10px]" style={{ color: C.text30 }}>{t.sub}</div>
                  </div>
                  <Toggle on={triggers[i]} onToggle={() => setTriggers(prev => prev.map((v, j) => j === i ? !v : v))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "apis" && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.text25 }}>Required for this workflow</div>
            <div className="space-y-1.5">
              {APIS.map((a, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.03)" }}>
                  <div className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: a.connected ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.07)", color: a.connected ? "#34D399" : C.text40 }}>
                    {a.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium" style={{ color: C.text70 }}>{a.name}</div>
                    <div className="text-[10px]" style={{ color: C.text30 }}>{a.sub}</div>
                  </div>
                  {a.connected ? (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,.15)", color: "#34D399" }}>Connected</span>
                  ) : (
                    <button className="text-[9px] font-semibold px-2 py-1 rounded-md" style={{ background: C.primary, color: "#fff" }}>Connect</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "credits" && (
          <div className="space-y-4">
            <div className="rounded-[9px] p-3 border" style={{ background: "rgba(245,158,11,.06)", borderColor: "rgba(245,158,11,.2)" }}>
              <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold" style={{ color: "#FCD34D" }}>
                <Clock size={12} /> Estimated credits per run
              </div>
              {CREDIT_STEPS.map((s, i) => (
                <div key={i} className="flex justify-between py-1.5 text-[10px]" style={{ borderBottom: i < CREDIT_STEPS.length - 1 ? `1px solid rgba(245,158,11,.1)` : "none" }}>
                  <span style={{ color: C.text40 }}>{s.name}</span>
                  <span style={{ color: s.amber ? "#FCD34D" : C.text30 }}>{s.cr}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 mt-1 text-xs font-semibold" style={{ borderTop: "1px solid rgba(245,158,11,.25)", color: "#FCD34D" }}>
                <span>Total</span><span>~14 credits</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: C.text25 }}>Monthly projection</div>
              {[["Leads/day", "100"], ["Days", "30"], ["Plan limit", "7,500 cr"], ["Headroom", "3,300 cr"]].map(([k, v]) => (
                <div key={k} className="flex justify-between px-2.5 py-2 rounded-md mb-1 text-[10px]" style={{ background: "rgba(255,255,255,.03)" }}>
                  <span style={{ color: C.text30 }}>{k}</span>
                  <span style={{ color: C.text70 }}>{v}</span>
                </div>
              ))}
              <div className="rounded-lg p-2.5 mt-2 text-[10px] leading-relaxed border"
                style={{ background: "rgba(16,185,129,.06)", borderColor: "rgba(16,185,129,.2)", color: "#34D399" }}>
                Within plan limits. At 100 leads/day this workflow uses 56% of your budget.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, badge, children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.text25 }}>{label}</span>
        {badge && <span className="text-[8px] font-bold px-1.5 py-px rounded-full" style={{ background: "rgba(16,185,129,.15)", color: "#34D399" }}>{badge}</span>}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
