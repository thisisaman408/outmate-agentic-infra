import { RULES_ITEMS, AGENTS_ITEMS, ACTIONS_ITEMS, type ToolboxItem } from "@/data/toolboxItems";

function ToolIcon({ type, color }: { type: string; color: string }) {
  const p: Record<string, JSX.Element> = {
    fork: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 3v6l6 6 6-6V3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    split: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4v6l8 8M20 4v6l-8 8M12 4v14" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>,
    clock: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" /><path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>,
    loop: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    exit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" /><path d="M15 9l-6 6M9 9l6 6" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>,
    sparkle: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" stroke={color} strokeWidth="1.5" fill="none" /></svg>,
    gauge: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke={color} strokeWidth="2" /><path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>,
    person: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" /><path d="M5.5 21a6.5 6.5 0 0113 0" stroke={color} strokeWidth="2" /><path d="M19 8h4M21 6v4" stroke={color} strokeWidth="2" strokeLinecap="round" /></svg>,
    envelope: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="2" /><path d="M3 7l9 6 9-6" stroke={color} strokeWidth="2" /></svg>,
    bubble: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={color} strokeWidth="2" /></svg>,
    grid: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth="2" /></svg>,
    hash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="4" y1="9" x2="20" y2="9" stroke={color} strokeWidth="2" /><line x1="4" y1="15" x2="20" y2="15" stroke={color} strokeWidth="2" /><line x1="10" y1="3" x2="8" y2="21" stroke={color} strokeWidth="2" /><line x1="16" y1="3" x2="14" y2="21" stroke={color} strokeWidth="2" /></svg>,
    globe: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke={color} strokeWidth="1.5" /></svg>,
    checklist: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3 8-8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" stroke={color} strokeWidth="2" /></svg>,
  };
  return p[type] || null;
}

function ToolCard({ item }: { item: ToolboxItem }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 mb-1 cursor-grab active:cursor-grabbing transition-all group"
      style={{ border: "0.5px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.03)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(79,70,229,.3)";
        e.currentTarget.style.background = "rgba(79,70,229,.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,.07)";
        e.currentTarget.style.background = "rgba(255,255,255,.03)";
      }}
    >
      <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0" style={{ background: item.iconBg }}>
        <ToolIcon type={item.iconType} color={item.iconColor} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium" style={{ color: "var(--wf-text-secondary)" }}>{item.name}</div>
        <div className="text-[10px] mt-px" style={{ color: "rgba(255,255,255,.3)" }}>{item.desc}</div>
      </div>
      <span className="ml-auto text-[10px] shrink-0 opacity-20 group-hover:opacity-40 transition-opacity">⋮⋮</span>
    </div>
  );
}

export default function ToolboxPanel() {
  return (
    <div
      className="w-[256px] flex flex-col shrink-0"
      style={{ background: "var(--wf-bg-panel)", borderLeft: "0.5px solid var(--wf-border-default)" }}
    >
      {/* Header */}
      <div className="flex items-center px-3 py-2.5" style={{ borderBottom: "0.5px solid var(--wf-border-subtle)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--wf-text-primary)" }}>Toolbox</span>
        <span className="text-[10px] ml-1.5 flex-1" style={{ color: "rgba(255,255,255,.3)" }}>Click or drag to add</span>
        <button className="w-6 h-6 rounded flex items-center justify-center" style={{ color: "var(--wf-text-tertiary)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 studio-scroll">
        {/* Rules */}
        <div className="text-[9px] font-bold uppercase tracking-wider px-1 pt-2 pb-1" style={{ color: "rgba(255,255,255,.25)", letterSpacing: ".08em" }}>
          Rules
        </div>
        {RULES_ITEMS.map((item) => <ToolCard key={item.name} item={item} />)}

        {/* Agents */}
        <div className="flex items-center gap-1.5 px-1 pt-3 pb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,.25)", letterSpacing: ".08em" }}>Agents</span>
          <span className="text-[8px] font-bold px-1 py-px rounded" style={{ background: "rgba(16,185,129,.2)", color: "#34D399", letterSpacing: ".04em" }}>NEW</span>
        </div>
        {AGENTS_ITEMS.map((item) => <ToolCard key={item.name} item={item} />)}

        {/* Actions */}
        <div className="text-[9px] font-bold uppercase tracking-wider px-1 pt-3 pb-1" style={{ color: "rgba(255,255,255,.25)", letterSpacing: ".08em" }}>
          Actions
        </div>
        {ACTIONS_ITEMS.map((item) => <ToolCard key={item.name} item={item} />)}
      </div>
    </div>
  );
}
